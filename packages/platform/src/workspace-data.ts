import { z } from 'zod';
import type { KvStore } from './store/types.js';
import { PlatformError } from './errors.js';
import { audit, authorize, getOrg, OK, type AuthContext, type Org } from './orgs.js';
import { getAssessment } from './assessments.js';

/**
 * Small per-workspace records that sit beside assessments: the organisation
 * profile collected at onboarding (defaults for new intakes) and the risk
 * register edits made on a saved assessment. Org-scoped by key and by
 * AuthContext, like everything else in this package.
 */

export const WDK = {
  profile: (orgId: string) => `org:${orgId}:profile`,
  risks: (orgId: string, rootId: string) => `org:${orgId}:risks:${rootId}`,
};

const DATA = ['public', 'internal', 'pii', 'sensitive_pii', 'phi', 'pci', 'financial', 'credentials', 'trade_secret', 'minors'] as const;

export const OrgProfileInput = z.object({
  industry: z.string().trim().max(80).default(''),
  size: z.enum(['', '1-50', '51-250', '251-1000', '1001-5000', '5000+']).default(''),
  regions: z.array(z.enum(['us', 'eu', 'uk', 'apac', 'other'])).max(5).default([]),
  dataResidency: z.enum(['any', 'us', 'eu', 'on_prem']).default('any'),
  dataClasses: z.array(z.enum(DATA)).max(DATA.length).default([]),
  regulated: z.array(z.enum(['hipaa', 'pci', 'gdpr', 'ccpa', 'sox', 'ferpa', 'glba', 'eu_ai_act'])).max(8).default([]),
  engineers: z.number().int().min(0).max(100_000).nullable().default(null),
}).strict();
export type OrgProfile = z.infer<typeof OrgProfileInput> & { updatedAt: string; updatedBy: string };

export async function readOrgProfile(store: KvStore, ctx: AuthContext): Promise<OrgProfile | null> {
  authorize(ctx, 'assessment:read');
  return store.get<OrgProfile>(WDK.profile(ctx.orgId));
}

export async function saveOrgProfile(store: KvStore, ctx: AuthContext, input: unknown): Promise<OrgProfile> {
  authorize(ctx, 'members:manage');
  const parsed = OrgProfileInput.safeParse(input);
  if (!parsed.success) throw new PlatformError('invalid', 'That organisation profile could not be saved.');
  const profile: OrgProfile = { ...parsed.data, updatedAt: new Date().toISOString(), updatedBy: ctx.userId };
  await store.set(WDK.profile(ctx.orgId), profile);
  await audit(store, ctx.orgId, ctx.userId, 'org.profile_updated', {});
  return profile;
}

export async function renameOrg(store: KvStore, ctx: AuthContext, name: unknown): Promise<Org> {
  authorize(ctx, 'members:manage');
  const clean = z.string().trim().min(1).max(100).safeParse(name);
  if (!clean.success) throw new PlatformError('invalid', 'Organisation name must be 1–100 characters.');
  const org = await getOrg(store, ctx.orgId);
  if (!org) throw new PlatformError('not_found', 'Workspace not found.');
  const next = { ...org, name: clean.data };
  await store.set(OK.org(ctx.orgId), next);
  await audit(store, ctx.orgId, ctx.userId, 'org.renamed', { name: clean.data });
  return next;
}

/** Risk edits are keyed by the assessment root, so they carry over to reassessed versions. */
export async function readRiskEdits(store: KvStore, ctx: AuthContext, assessmentId: string): Promise<Record<string, unknown>> {
  const rec = await getAssessment(store, ctx, assessmentId);
  return (await store.get<Record<string, unknown>>(WDK.risks(ctx.orgId, rec.rootId))) ?? {};
}

export async function saveRiskEdit(store: KvStore, ctx: AuthContext, assessmentId: string, riskId: string, edit: Record<string, unknown>): Promise<Record<string, unknown>> {
  authorize(ctx, 'assessment:write');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(riskId)) throw new PlatformError('invalid', 'Unknown risk.');
  const rec = await getAssessment(store, ctx, assessmentId);
  const key = WDK.risks(ctx.orgId, rec.rootId);
  const all = (await store.get<Record<string, unknown>>(key)) ?? {};
  if (Object.keys(all).length >= 200 && !(riskId in all)) throw new PlatformError('invalid', 'Too many risk edits on one assessment.');
  all[riskId] = { ...(all[riskId] as object | undefined), ...edit, editedBy: ctx.userId, editedAt: new Date().toISOString() };
  await store.set(key, all);
  await audit(store, ctx.orgId, ctx.userId, 'risk.edited', { assessmentId, riskId });
  return all;
}
