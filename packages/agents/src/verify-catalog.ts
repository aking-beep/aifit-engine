import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATALOG, type ModelEntry } from '@aifit/teams-core';
import { runAgent, type RunContext, type RunStatus } from './harness.js';
import { comparePrices, priceVerifierAgent, type PriceComparison, type VerifiedPrices } from './price-verifier.js';
import { registryVerifierAgent, type VerifiedProduct } from './registry-verifier.js';
import { excerptAround, htmlToText } from './text.js';
import { PACKAGE_DIR } from './fixtures.js';

/**
 * Background check of the facts AI Fit shows that go stale: model list prices
 * (Teams catalog) and whether registry products still exist under their name.
 * It reads public pages, asks the verifier agents, keeps only what a quote
 * from the page supports, and writes a report. It never edits the catalog or
 * the registry: a person reads the report and makes the change.
 */

export const PRICING_PAGES: Partial<Record<ModelEntry['provider'], string>> = {
  anthropic: 'https://platform.claude.com/docs/en/about-claude/pricing',
  openai: 'https://openai.com/api/pricing/',
  google: 'https://ai.google.dev/gemini-api/docs/pricing',
};

export type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; text: string }>;

export const httpFetcher: Fetcher = async (url) => {
  const res = await fetch(url, {
    headers: { 'user-agent': 'aifit-catalog-verifier/1.0 (+https://github.com/aking-beep/aifit-engine)', accept: 'text/html,text/plain' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: res.ok, status: res.status, text: res.ok ? (await res.text()).slice(0, 3_000_000) : '' };
};

export interface PriceRow {
  id: string;
  displayName: string;
  provider: string;
  catalog: { inputPer1M: number; outputPer1M: number; cachedInputPer1M?: number; asOf: string };
  source: string | null;
  status: PriceComparison;
  run: RunStatus | 'skipped' | 'fetch_failed';
  diffs: string[];
  verified: VerifiedPrices | null;
  note: string;
}

export interface ProductRow {
  id: string;
  name: string;
  homepage: string;
  registryStatus: string;
  status: 'match' | 'changed' | 'unverified';
  run: RunStatus | 'fetch_failed';
  verified: VerifiedProduct | null;
  note: string;
}

export interface VerifyReport {
  generatedAt: string;
  model: string;
  prices: PriceRow[];
  products: ProductRow[];
  changes: number;
}

interface RegistryProduct { id: string; name: string; provider: string; homepage?: string; status: string }

export function loadProducts(): RegistryProduct[] {
  return JSON.parse(readFileSync(resolve(PACKAGE_DIR, '../../data/registry/products.json'), 'utf8')) as RegistryProduct[];
}

async function pageText(fetcher: Fetcher, url: string): Promise<{ text: string } | { error: string }> {
  try {
    const r = await fetcher(url);
    if (!r.ok) return { error: `HTTP ${r.status}` };
    return { text: htmlToText(r.text) };
  } catch (e) {
    return { error: e instanceof Error ? e.name : 'fetch failed' };
  }
}

export async function verifyPrices(fetcher: Fetcher, ctx: RunContext, catalog: ModelEntry[] = CATALOG): Promise<PriceRow[]> {
  const pages = new Map<string, Awaited<ReturnType<typeof pageText>>>();
  const rows: PriceRow[] = [];
  for (const m of catalog) {
    const base = {
      id: m.id, displayName: m.displayName, provider: m.provider,
      catalog: { inputPer1M: m.inputPer1M, outputPer1M: m.outputPer1M, cachedInputPer1M: m.cachedInputPer1M, asOf: m.asOf },
      diffs: [], verified: null,
    };
    const url = PRICING_PAGES[m.provider];
    if (!url) {
      rows.push({ ...base, source: null, status: 'unverified', run: 'skipped', note: 'No public list price to check (local or provider-specific pricing).' });
      continue;
    }
    if (!pages.has(url)) pages.set(url, await pageText(fetcher, url));
    const page = pages.get(url)!;
    if ('error' in page) {
      rows.push({ ...base, source: url, status: 'unverified', run: 'fetch_failed', note: `Could not read the pricing page (${page.error}).` });
      continue;
    }
    const excerpt = excerptAround(page.text, m.displayName);
    const run = await runAgent(priceVerifierAgent, { modelId: m.id, displayName: m.displayName, provider: m.provider, sourceUrl: url, pageText: excerpt }, ctx);
    const cmp = comparePrices(m, run.result);
    rows.push({
      ...base, source: url, status: cmp.status, run: run.status, diffs: cmp.diffs, verified: run.result,
      note: run.status !== 'ok' ? run.problems.join(' ') : cmp.status === 'unverified' ? 'The page did not show both prices with a supporting quote.' : '',
    });
  }
  return rows;
}

export async function verifyProducts(fetcher: Fetcher, ctx: RunContext, products: RegistryProduct[] = loadProducts()): Promise<ProductRow[]> {
  const rows: ProductRow[] = [];
  for (const p of products) {
    if (!p.homepage) continue;
    const base = { id: p.id, name: p.name, homepage: p.homepage, registryStatus: p.status };
    const page = await pageText(fetcher, p.homepage);
    if ('error' in page) {
      rows.push({ ...base, status: 'unverified', run: 'fetch_failed', verified: null, note: `Could not read the homepage (${page.error}).` });
      continue;
    }
    const run = await runAgent(registryVerifierAgent, { productId: p.id, name: p.name, provider: p.provider, homepage: p.homepage, pageText: excerptAround(page.text, p.name) }, ctx);
    const v = run.result;
    const status: ProductRow['status'] = !v || v.status === 'unclear'
      ? 'unverified'
      : (v.status === 'active' && p.status === 'active') ? 'match' : 'changed';
    rows.push({ ...base, status, run: run.status, verified: v, note: run.status !== 'ok' ? run.problems.join(' ') : '' });
  }
  return rows;
}

export function renderMarkdown(r: VerifyReport): string {
  const lines = [
    `# Catalog and registry check — ${r.generatedAt.slice(0, 10)}`,
    '',
    `Automated, suggest-only. Agent model: \`${r.model}\`. A price or status below is reported only when a quote from the page supports it; nothing has been changed in the repository. **${r.changes} change(s) need a person to review.**`,
    '',
    '## Model prices (USD per 1M tokens)',
    '',
    '| Model | Catalog (as of) | Page | Status | Notes |',
    '|---|---|---|---|---|',
    ...r.prices.map((p) => {
      const cat = `${p.catalog.inputPer1M} / ${p.catalog.outputPer1M} (${p.catalog.asOf})`;
      const page = p.verified?.found ? `${p.verified.inputPer1M} / ${p.verified.outputPer1M}` : '—';
      return `| ${p.displayName} | ${cat} | ${page} | ${p.status} | ${[...p.diffs, p.note].filter(Boolean).join('; ').replace(/\|/g, '\\|')} |`;
    }),
    '',
    '## Registry products',
    '',
    '| Product | Registry | Page | Status | Evidence |',
    '|---|---|---|---|---|',
    ...r.products.map((p) => {
      const ev = p.verified?.quotes[0] ? `“${p.verified.quotes[0].slice(0, 120)}”` : p.note;
      const page = p.verified ? `${p.verified.status}${p.verified.currentName ? ` → ${p.verified.currentName}` : ''}` : '—';
      return `| ${p.name} | ${p.registryStatus} | ${page} | ${p.status} | ${ev.replace(/\|/g, '\\|')} |`;
    }),
    '',
    '"unverified" means the check could not confirm the fact either way (page unreadable, rendered by script, or no supporting quote). It is not a pass.',
    '',
  ];
  return lines.join('\n');
}

export async function buildReport(fetcher: Fetcher, priceCtx: RunContext, registryCtx: RunContext, now = new Date()): Promise<VerifyReport> {
  const prices = await verifyPrices(fetcher, priceCtx);
  const products = await verifyProducts(fetcher, registryCtx);
  const changes = prices.filter((p) => p.status === 'changed').length + products.filter((p) => p.status === 'changed').length;
  return { generatedAt: now.toISOString(), model: priceCtx.model, prices, products, changes };
}
