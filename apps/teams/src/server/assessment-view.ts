import { assess, fetchCalibration, type Workload } from '@aifit/teams-core';
import { buildBlueprint, buildControlExport, architectureGraph, deriveRisks, applyRiskEdits, type RiskEdit } from '@aifit/deliverables';
import {
  PlatformError, can, checkEntitlement, getAssessment, levelAllows, readRiskEdits, sectionAccess, versions,
  type AccessLevel, type AssessmentRecord, type Section,
} from '@aifit/platform';
import { Workload as WorkloadSchema } from '@aifit/teams-core';
import { encodeWorkload } from '@/lib/encode';
import { decisionFor } from './assessments';
import { billing, currentViewer, storeResolution, type Viewer } from './platform';

/**
 * Everything one assessment screen shows, computed on the server from the
 * workload and today's engines, and trimmed to what the viewer may see. No
 * figure on any assessment screen is computed anywhere else.
 */

export const SECTIONS: { id: Section; label: string; stage: 'decide' | 'configure' | 'validate' | 'improve' }[] = [
  { id: 'verdict', label: 'Verdict', stage: 'decide' },
  { id: 'build-vs-buy', label: 'Build vs buy', stage: 'decide' },
  { id: 'cost', label: 'Cost model', stage: 'decide' },
  { id: 'roi', label: 'ROI', stage: 'decide' },
  { id: 'architecture', label: 'Architecture', stage: 'configure' },
  { id: 'models', label: 'Models', stage: 'configure' },
  { id: 'infrastructure', label: 'Infrastructure', stage: 'configure' },
  { id: 'blueprint', label: 'Blueprint', stage: 'configure' },
  { id: 'governance', label: 'Governance', stage: 'validate' },
  { id: 'security', label: 'Security', stage: 'validate' },
  { id: 'risks', label: 'Risks', stage: 'validate' },
  { id: 'evaluation', label: 'Evaluation', stage: 'validate' },
  { id: 'roadmap', label: 'Roadmap', stage: 'improve' },
];

export const isSection = (s: string): s is Section => SECTIONS.some((x) => x.id === s);

export type Source =
  | { kind: 'link'; encoded: string; reassess: string | null }
  | { kind: 'saved'; record: AssessmentRecord; history: AssessmentRecord[]; encoded: string };

export interface AssessmentView {
  source: Source;
  workload: Workload;
  a: ReturnType<typeof assess>;
  decision: ReturnType<typeof decisionFor>;
  calibrated: boolean;
  level: AccessLevel;
  levelReason: string;
  viewer: Viewer | null;
  billingEnabled: boolean;
  /** Where each section lives for this source. */
  href: (section: Section | 'overview') => string;
  intakeHref: string;
}

export async function viewFromLink(encoded: string, workload: Workload, reassess: string | null = null): Promise<AssessmentView> {
  const calibration = await fetchCalibration({ days: 30 });
  const a = assess(workload, { depth: 'business', calibration });
  const viewer = await currentViewer().catch(() => null);
  const { store } = storeResolution();
  // A link is not an assessment the viewer owns: purchases never apply to it.
  const access = await sectionAccess(store, viewer?.ctx ?? null, billing(), null);
  const w = encodeURIComponent(encoded);
  return {
    source: { kind: 'link', encoded, reassess: viewer && reassess && /^asm_[A-Za-z0-9]{1,32}$/.test(reassess) ? reassess : null },
    workload, a, decision: decisionFor(a), calibrated: a.trust.calibrated,
    level: access.level, levelReason: access.reason, viewer, billingEnabled: billing().enabled,
    href: (s) => (s === 'verdict' || s === 'overview' ? `/report?w=${w}` : `/report/${s}?w=${w}`),
    intakeHref: `/assess?w=${w}`,
  };
}

/** A saved assessment, for a signed-in member of its workspace. Not found for anyone else. */
export async function viewFromSaved(id: string, viewer: Viewer): Promise<AssessmentView> {
  const { store } = storeResolution();
  if (!store) throw new PlatformError('unavailable', 'Workspaces are switched off on this deployment.');
  const record = await getAssessment(store, viewer.ctx, id);
  const history = await versions(store, viewer.ctx, record.rootId);
  const workload = WorkloadSchema.parse(record.workload);
  const encoded = encodeWorkload(workload);
  const calibration = await fetchCalibration({ days: 30 });
  const a = assess(workload, { depth: 'business', calibration });
  const access = await sectionAccess(store, viewer.ctx, billing(), record.rootId);
  const latest = history[history.length - 1]!;
  return {
    source: { kind: 'saved', record, history, encoded },
    workload, a, decision: decisionFor(a), calibrated: a.trust.calibrated,
    level: access.level, levelReason: access.reason, viewer, billingEnabled: billing().enabled,
    href: (s) => (s === 'verdict' || s === 'overview' ? `/workspace/assessments/${record.id}` : `/workspace/assessments/${record.id}/${s}`),
    intakeHref: `/assess?w=${encodeURIComponent(encoded)}&reassess=${encodeURIComponent(latest.id)}`,
  };
}

export function allows(v: AssessmentView, s: Section): boolean {
  return levelAllows(v.level, s);
}

export function blueprintFor(v: AssessmentView) {
  const rec = v.source.kind === 'saved' ? v.source.record : null;
  return buildBlueprint(v.workload, {
    generatedAt: new Date().toISOString(),
    assessment: rec ? { id: rec.id, rootId: rec.rootId, version: rec.version } : null,
  });
}

export function governanceFor(v: AssessmentView) {
  return buildControlExport(blueprintFor(v));
}

export function graphFor(v: AssessmentView) {
  return architectureGraph(v.a);
}

export async function risksFor(v: AssessmentView) {
  const derived = deriveRisks(v.a);
  if (v.source.kind !== 'saved' || !v.viewer) return { risks: derived, editable: false };
  const { store } = storeResolution();
  const edits = store ? ((await readRiskEdits(store, v.viewer.ctx, v.source.record.id)) as Record<string, RiskEdit>) : {};
  return { risks: applyRiskEdits(derived, edits), editable: can(v.viewer.ctx.role, 'assessment:write') };
}

/** Whether this viewer may download this assessment's deliverables, and why not. */
export async function deliverableAccess(v: AssessmentView) {
  const { store } = storeResolution();
  if (v.source.kind !== 'saved' || !v.viewer || !store) {
    return { mayDownload: false, blueprint: null, control: null, anonymousBlueprint: !billing().enabled };
  }
  const mayDownload = can(v.viewer.ctx.role, 'export:download');
  const cfg = billing();
  return {
    mayDownload,
    blueprint: mayDownload ? await checkEntitlement(store, v.viewer.ctx, cfg, 'blueprint', v.source.record.rootId) : null,
    control: mayDownload ? await checkEntitlement(store, v.viewer.ctx, cfg, 'control-export', v.source.record.rootId) : null,
    anonymousBlueprint: false,
  };
}
