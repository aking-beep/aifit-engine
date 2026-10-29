import { assess, Workload } from '@aifit/teams-core';
import { getUser, listAssessments, type AuthContext, type KvStore } from '@aifit/platform';
import { decisionFor } from './assessments';

export interface PortfolioRow {
  id: string;
  title: string;
  version: number;
  versions: number;
  createdAt: string;
  createdBy: string;
  outcome: ReturnType<typeof decisionFor>['outcome'];
  suitability: number;
  verdict: string;
  riskLevel: string;
  monthly: { low: number; high: number; basis: string } | null;
  blockingControls: number;
  evalChecks: number;
  units: number;
  unitLabel: string;
}

/**
 * The latest version of every saved assessment, recomputed with today's
 * engines from its saved answers. Figures keep their basis; nothing is
 * summed across bases that would hide an estimate behind a total.
 */
export async function portfolio(store: KvStore, ctx: AuthContext): Promise<PortfolioRow[]> {
  const list = await listAssessments(store, ctx);
  const names = new Map<string, string>();
  const rows: PortfolioRow[] = [];
  for (const rec of list) {
    const parsed = Workload.safeParse(rec.workload);
    if (!parsed.success) continue;
    const a = assess(parsed.data, { depth: 'business' });
    const d = decisionFor(a);
    if (!names.has(rec.createdBy)) names.set(rec.createdBy, (await getUser(store, rec.createdBy))?.name ?? 'Former member');
    const pm = a.cost.perMonth;
    rows.push({
      id: rec.id, title: rec.title, version: rec.version, versions: rec.versions, createdAt: rec.createdAt,
      createdBy: names.get(rec.createdBy)!,
      outcome: d.outcome,
      suitability: Math.round(a.suitability.score.value),
      verdict: a.suitability.verdict,
      riskLevel: a.security.level,
      monthly: a.model ? { low: pm.low ?? pm.value, high: pm.high ?? pm.value, basis: pm.basis } : { low: 0, high: 0, basis: 'heuristic' },
      blockingControls: a.security.controls.filter((c) => c.blocking).length,
      evalChecks: a.evaluation.metrics.length,
      units: parsed.data.volume.unitsPerMonth,
      unitLabel: parsed.data.volume.unitLabel,
    });
  }
  return rows;
}
