import type { Assessment } from '@aifit/teams-core';

/**
 * Risk register derived from the assessment: one risk per security control
 * (the risk is that the control is not in place) and one per unknown the
 * engine reported. Likelihood and impact are rules, not judgements, so every
 * derived risk is marked "assumption" and is meant to be edited by the owner.
 */

export type RiskCategory = 'security' | 'governance' | 'operational' | 'financial' | 'vendor' | 'quality';
export type RiskStatus = 'open' | 'mitigating' | 'accepted' | 'closed';

export interface RiskEntry {
  id: string;
  title: string;
  category: RiskCategory;
  likelihood: number;
  impact: number;
  owner: string;
  mitigation: string;
  status: RiskStatus;
  evidence: 'assumption' | 'recommendation';
  source: string;
}

/** What a person changed about one derived risk. */
export interface RiskEdit {
  likelihood?: number;
  impact?: number;
  owner?: string;
  mitigation?: string;
  status?: RiskStatus;
}

export const RISK_RULE =
  'Derived: likelihood from the assessment risk level (low 2, moderate 3, high 4, severe 4); impact 5 when the control blocks launch, else 3. Edit to your judgement.';

const LIKELIHOOD = { low: 2, moderate: 3, high: 4, severe: 4 } as const;

function category(id: string): RiskCategory {
  if (/^(SEC|DATA|PII|INJ|ACC)/i.test(id)) return 'security';
  if (/^(GOV|AUD|REG|DISC)/i.test(id)) return 'governance';
  if (/^(COST|SPEND)/i.test(id)) return 'financial';
  if (/^(VEND|PROV)/i.test(id)) return 'vendor';
  if (/^(EVAL|QUAL)/i.test(id)) return 'quality';
  return 'operational';
}

export function deriveRisks(a: Assessment): RiskEntry[] {
  const l = LIKELIHOOD[a.security.level];
  const fromControls: RiskEntry[] = a.security.controls.map((c) => ({
    id: c.id,
    title: `Not in place: ${c.requirement}`,
    category: category(c.id),
    likelihood: l,
    impact: c.blocking ? 5 : 3,
    owner: '',
    mitigation: c.requirement,
    status: 'open',
    evidence: 'assumption',
    source: c.why,
  }));
  const fromUnknowns: RiskEntry[] = a.trust.unknowns.map((u, i) => ({
    id: `UNK-${String(i + 1).padStart(2, '0')}`,
    title: u,
    category: 'quality',
    likelihood: 3,
    impact: 3,
    owner: '',
    mitigation: 'Measure or supply the missing input, then re-assess.',
    status: 'open',
    evidence: 'assumption',
    source: 'Reported by the engine as something this assessment does not know.',
  }));
  return [...fromControls, ...fromUnknowns];
}

const clamp = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined);
const STATUS: RiskStatus[] = ['open', 'mitigating', 'accepted', 'closed'];

/** Validates and normalises an edit from a request body. Unknown keys are dropped. */
export function parseRiskEdit(raw: unknown): RiskEdit | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const e: RiskEdit = {};
  const li = clamp(r.likelihood); if (li) e.likelihood = li;
  const im = clamp(r.impact); if (im) e.impact = im;
  if (typeof r.owner === 'string') e.owner = r.owner.trim().slice(0, 120);
  if (typeof r.mitigation === 'string') e.mitigation = r.mitigation.trim().slice(0, 1000);
  if (typeof r.status === 'string' && (STATUS as string[]).includes(r.status)) e.status = r.status as RiskStatus;
  return Object.keys(e).length ? e : null;
}

/** A derived risk with the person's edits on top. An edited risk is no longer an assumption. */
export function applyRiskEdits(risks: RiskEntry[], edits: Record<string, RiskEdit>): RiskEntry[] {
  return risks.map((r) => {
    const e = edits[r.id];
    return e ? { ...r, ...e, evidence: 'recommendation' as const } : r;
  });
}

export function riskLevel(likelihood: number, impact: number): 'low' | 'medium' | 'high' | 'critical' {
  const s = likelihood * impact;
  return s >= 16 ? 'critical' : s >= 10 ? 'high' : s >= 5 ? 'medium' : 'low';
}
