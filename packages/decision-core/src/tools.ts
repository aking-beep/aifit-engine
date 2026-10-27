import { RULES } from './generated/rules.js';
import type { DecisionResult } from './schema.js';

/** The registry fields tool matching reads. Same records `data/registry/products.json` holds. */
export interface RegistryProduct {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string;
  status: string;
  homepage: string;
  pricing_tier: string;
  technical_level: number;
  deployment: string[];
  capabilities: string[];
  evidence: { source_type: string; title: string; url: string; observed_at: string; notes?: string }[];
  last_evaluated_at: string;
  registry_version: string;
}

export interface ToolMatch {
  id: string;
  name: string;
  provider: string;
  category: string;
  homepage: string;
  why: string[];
  checks: { rule: string; passed: boolean; detail: string }[];
  pricing: { tier: string; amount: null; note: string };
  evidence: RegistryProduct['evidence'];
  lastEvaluatedAt: string;
  ageDays: number | null;
  stale: boolean;
}

export interface ToolMatchResult {
  matches: ToolMatch[];
  excluded: { id: string; name: string; reasons: string[] }[];
  note: string;
}

const FRESHNESS_DAYS = 90;

function ageDays(iso: string, asOf: string | null): number | null {
  if (!asOf) return null;
  const a = Date.parse(iso);
  const b = Date.parse(asOf);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.floor((b - a) / 86_400_000);
}

/**
 * Registry products eligible for a `buy_ai` decision.
 *
 * Deterministic filters only: category from the work types, deployment for
 * local-only work, pricing tier for a zero budget, active status. Ranking is
 * by technical-level distance from the person, then name, so it is stable.
 * Prices are never shown as numbers because the registry does not record
 * them; compliance is never asserted because the registry does not verify it.
 *
 * `asOf` is passed in, not read from the clock, so the result is reproducible.
 */
export function matchTools(
  result: DecisionResult,
  products: readonly RegistryProduct[],
  opts: { technicalLevel?: number; asOf?: string | null; limit?: number } = {},
): ToolMatchResult {
  const req = result.toolRequirements;
  const regulated = result.hardConstraints.some((h) => h.id === 'HC_REGULATED_DATA' && h.triggered);
  const empty = (note: string): ToolMatchResult => ({ matches: [], excluded: [], note });
  if (result.outcome !== 'buy_ai') {
    return empty('No tool is recommended because the decision is not to buy an AI tool.');
  }
  const categories = new Set(req.categories);
  const localDeployments = new Set<string>(RULES.localDeployments);
  const freeTiers = new Set<string>(RULES.freePricingTiers);
  const level = opts.technicalLevel ?? 0.4;
  const asOf = opts.asOf ?? null;

  const matches: ToolMatch[] = [];
  const excluded: ToolMatchResult['excluded'] = [];
  for (const p of products) {
    if (!categories.has(p.category)) continue;
    const checks: ToolMatch['checks'] = [
      { rule: 'active', passed: p.status === 'active', detail: `Registry status is "${p.status}".` },
    ];
    if (req.localOnly) {
      const ok = p.deployment.some((d) => localDeployments.has(d));
      checks.push({ rule: 'local_or_self_hosted', passed: ok, detail: `Deployment: ${p.deployment.join(', ')}.` });
    }
    if (req.freeTierOnly) {
      const ok = freeTiers.has(p.pricing_tier);
      checks.push({ rule: 'free_tier', passed: ok, detail: `Pricing tier in the registry: ${p.pricing_tier}.` });
    }
    const failed = checks.filter((c) => !c.passed);
    if (failed.length > 0) {
      excluded.push({ id: p.id, name: p.name, reasons: failed.map((c) => c.detail) });
      continue;
    }
    const age = ageDays(p.last_evaluated_at, asOf);
    const why = [`Category "${p.category}" matches the kind of work you described.`];
    if (req.localOnly) why.push('Runs locally or self-hosted, so your data can stay on your machines.');
    if (regulated) why.push('Regulated data: confirm this vendor offers an agreement covering it on your plan. AI Fit has not verified that.');
    matches.push({
      id: p.id,
      name: p.name,
      provider: p.provider,
      category: p.category,
      homepage: p.homepage,
      why,
      checks,
      pricing: {
        tier: p.pricing_tier,
        amount: null,
        note: p.pricing_tier === 'free' ? 'Listed as free in the registry.'
          : p.pricing_tier === 'mixed' ? 'Free and paid plans exist per the registry; check the vendor page for current prices and limits.'
            : 'Price not recorded in the registry; check the vendor page.',
      },
      evidence: p.evidence,
      lastEvaluatedAt: p.last_evaluated_at,
      ageDays: age,
      stale: age !== null && age > FRESHNESS_DAYS,
    });
  }

  const tech = new Map(products.map((p) => [p.id, p.technical_level]));
  matches.sort((a, b) => {
    const da = Math.abs((tech.get(a.id) ?? 0.5) - level);
    const db = Math.abs((tech.get(b.id) ?? 0.5) - level);
    return da - db || a.name.localeCompare(b.name);
  });
  return {
    matches: matches.slice(0, opts.limit ?? 5),
    excluded,
    note: 'Ranked by how closely each tool\'s technical level matches yours. Eligibility is rule-based; no vendor paid for placement.',
  };
}
