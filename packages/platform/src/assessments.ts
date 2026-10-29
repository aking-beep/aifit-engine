import { z } from 'zod';
import type { KvStore } from './store/types.js';
import { PlatformError } from './errors.js';
import { randomId } from './crypto.js';
import { audit, authorize, type AuthContext } from './orgs.js';

/**
 * Saved, versioned assessments. A record holds the inputs (so the report can be
 * recomputed exactly) and a snapshot of what the engines said at the time,
 * with their versions, so a later rules change never silently rewrites
 * history. Reassessment creates a new version linked to the same root.
 */
export interface AssessmentRecord {
  id: string;
  orgId: string;
  rootId: string;
  parentId: string | null;
  version: number;
  title: string;
  createdBy: string;
  createdAt: string;
  /** The Teams Workload, validated by the caller before it reaches here. */
  workload: unknown;
  snapshot: {
    verdict: string;
    outcome: string;
    pattern: string;
    decisionInputHash: string;
    engines: Record<string, string>;
  };
}

export const SaveInput = z.object({
  title: z.string().trim().min(1).max(160),
  workload: z.unknown(),
  snapshot: z.object({
    verdict: z.string().max(40),
    outcome: z.string().max(40),
    pattern: z.string().max(60),
    decisionInputHash: z.string().regex(/^[0-9a-f]{64}$/),
    engines: z.record(z.string().max(60), z.string().max(60)),
  }),
});

const AK = {
  record: (orgId: string, id: string) => `org:${orgId}:assessment:${id}`,
  index: (orgId: string) => `org:${orgId}:assessments`,
  versions: (orgId: string, rootId: string) => `org:${orgId}:assessment-versions:${rootId}`,
};

export const MAX_ASSESSMENTS_PER_ORG = 500;

async function put(store: KvStore, ctx: AuthContext, input: z.infer<typeof SaveInput>, parent: AssessmentRecord | null): Promise<AssessmentRecord> {
  const index = await store.smembers(AK.index(ctx.orgId));
  if (index.length >= MAX_ASSESSMENTS_PER_ORG) throw new PlatformError('conflict', `A workspace can hold ${MAX_ASSESSMENTS_PER_ORG} saved assessments.`);
  const id = randomId('asm');
  const rec: AssessmentRecord = {
    id,
    orgId: ctx.orgId,
    rootId: parent?.rootId ?? id,
    parentId: parent?.id ?? null,
    version: parent ? (await versions(store, ctx, parent.rootId)).length + 1 : 1,
    title: input.title,
    createdBy: ctx.userId,
    createdAt: new Date().toISOString(),
    workload: input.workload,
    snapshot: input.snapshot,
  };
  await store.set(AK.record(ctx.orgId, id), rec);
  await store.sadd(AK.index(ctx.orgId), id);
  await store.sadd(AK.versions(ctx.orgId, rec.rootId), id);
  await audit(store, ctx.orgId, ctx.userId, parent ? 'assessment.reassessed' : 'assessment.saved', { id, rootId: rec.rootId, version: rec.version });
  return rec;
}

export async function saveAssessment(store: KvStore, ctx: AuthContext, input: unknown): Promise<AssessmentRecord> {
  authorize(ctx, 'assessment:write');
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) throw new PlatformError('invalid', 'That assessment could not be saved.');
  return put(store, ctx, parsed.data, null);
}

export async function reassess(store: KvStore, ctx: AuthContext, id: string, input: unknown): Promise<AssessmentRecord> {
  authorize(ctx, 'assessment:write');
  const parent = await getAssessment(store, ctx, id);
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) throw new PlatformError('invalid', 'That assessment could not be saved.');
  return put(store, ctx, parsed.data, parent);
}

/** Org scoping is in the key itself and checked again on the record. */
export async function getAssessment(store: KvStore, ctx: AuthContext, id: string): Promise<AssessmentRecord> {
  authorize(ctx, 'assessment:read');
  if (!/^asm_[A-Za-z0-9]{1,32}$/.test(id)) throw new PlatformError('not_found', 'Assessment not found.');
  const rec = await store.get<AssessmentRecord>(AK.record(ctx.orgId, id));
  if (!rec || rec.orgId !== ctx.orgId) throw new PlatformError('not_found', 'Assessment not found.');
  return rec;
}

export async function versions(store: KvStore, ctx: AuthContext, rootId: string): Promise<AssessmentRecord[]> {
  authorize(ctx, 'assessment:read');
  const out: AssessmentRecord[] = [];
  for (const id of await store.smembers(AK.versions(ctx.orgId, rootId))) {
    const rec = await store.get<AssessmentRecord>(AK.record(ctx.orgId, id));
    if (rec && rec.orgId === ctx.orgId) out.push(rec);
  }
  return out.sort((a, b) => a.version - b.version);
}

/** The latest version of each assessment, newest first. */
export async function listAssessments(store: KvStore, ctx: AuthContext): Promise<(AssessmentRecord & { versions: number })[]> {
  authorize(ctx, 'assessment:read');
  const byRoot = new Map<string, AssessmentRecord[]>();
  for (const id of await store.smembers(AK.index(ctx.orgId))) {
    const rec = await store.get<AssessmentRecord>(AK.record(ctx.orgId, id));
    if (!rec || rec.orgId !== ctx.orgId) continue;
    byRoot.set(rec.rootId, [...(byRoot.get(rec.rootId) ?? []), rec]);
  }
  return Array.from(byRoot.values())
    .map((vs) => ({ ...vs.sort((a, b) => b.version - a.version)[0]!, versions: vs.length }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteAssessment(store: KvStore, ctx: AuthContext, id: string): Promise<void> {
  authorize(ctx, 'assessment:delete');
  const rec = await getAssessment(store, ctx, id);
  for (const v of await versions(store, ctx, rec.rootId)) {
    await store.del(AK.record(ctx.orgId, v.id));
    await store.srem(AK.index(ctx.orgId), v.id);
  }
  await store.del(AK.versions(ctx.orgId, rec.rootId));
  await store.del(`org:${ctx.orgId}:risks:${rec.rootId}`); // risk register edits (workspace-data.ts)
  await audit(store, ctx.orgId, ctx.userId, 'assessment.deleted', { rootId: rec.rootId });
}

export async function deleteAllOrgAssessments(store: KvStore, orgId: string): Promise<void> {
  for (const id of await store.smembers(AK.index(orgId))) {
    const rec = await store.get<AssessmentRecord>(AK.record(orgId, id));
    if (rec) {
      await store.del(AK.versions(orgId, rec.rootId));
      await store.del(`org:${orgId}:risks:${rec.rootId}`);
    }
    await store.del(AK.record(orgId, id));
  }
  await store.del(AK.index(orgId));
}
