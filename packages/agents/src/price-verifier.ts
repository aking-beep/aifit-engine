import * as z from 'zod/v4';
import type { AgentSpec } from './harness.js';
import { dataBlock } from './harness.js';
import { quoteAppears, quoteShowsNumber } from './text.js';

/**
 * Price verifier: reads a vendor pricing page and reports the list prices it
 * shows for one model. A price is kept only if a quote that appears word for
 * word in the page contains that number. It never edits the catalog: the
 * comparison is a report a person acts on.
 */

export const PriceVerifierInput = z.object({
  modelId: z.string(),
  displayName: z.string(),
  provider: z.string(),
  sourceUrl: z.string().url(),
  pageText: z.string().min(1).max(20_000),
});
export type PriceVerifierInput = z.infer<typeof PriceVerifierInput>;

const PriceField = z.enum(['inputPer1M', 'outputPer1M', 'cachedInputPer1M']);

export const PriceVerifierOutput = z.object({
  found: z.boolean(),
  inputPer1M: z.number().nullable(),
  outputPer1M: z.number().nullable(),
  cachedInputPer1M: z.number().nullable(),
  quotes: z.array(z.object({ field: PriceField, text: z.string() })).max(9),
  notes: z.string().max(600),
});
export type PriceVerifierOutput = z.infer<typeof PriceVerifierOutput>;

export interface VerifiedPrices {
  found: boolean;
  inputPer1M: number | null;
  outputPer1M: number | null;
  cachedInputPer1M: number | null;
  quotes: { field: string; text: string }[];
  notes: string;
}

export function checkPrices(pageText: string, o: PriceVerifierOutput): { result: VerifiedPrices; problems: string[] } {
  const problems: string[] = [];
  const keep = (field: z.infer<typeof PriceField>, n: number | null): number | null => {
    if (n === null) return null;
    if (!(n >= 0 && n < 10_000)) { problems.push(`${field}: out of range`); return null; }
    const ok = o.quotes.some((q) => q.field === field && quoteAppears(q.text, pageText) && quoteShowsNumber(q.text, n));
    if (!ok) problems.push(`${field}: no quote from the page shows ${n}`);
    return ok ? n : null;
  };
  const result: VerifiedPrices = {
    found: false,
    inputPer1M: keep('inputPer1M', o.inputPer1M),
    outputPer1M: keep('outputPer1M', o.outputPer1M),
    cachedInputPer1M: keep('cachedInputPer1M', o.cachedInputPer1M),
    quotes: o.quotes.filter((q) => quoteAppears(q.text, pageText)),
    notes: o.notes.slice(0, 300),
  };
  result.found = o.found && result.inputPer1M !== null && result.outputPer1M !== null;
  return { result, problems };
}

export const priceVerifierAgent: AgentSpec<PriceVerifierInput, PriceVerifierOutput, VerifiedPrices> = {
  name: 'price-verifier',
  version: '1.0.0',
  prompt: 'price-verifier',
  input: PriceVerifierInput,
  output: PriceVerifierOutput,
  effort: 'medium',
  maxTokens: 4000,
  timeoutMs: 60_000,
  render: (i) => `Model to check: ${i.displayName} (id ${i.modelId}, provider ${i.provider}).\nPage: ${i.sourceUrl}\n${dataBlock('page', i.pageText)}`,
  check: (i, o) => checkPrices(i.pageText, o),
};

export type PriceComparison = 'match' | 'changed' | 'unverified';

/** Compare verified prices with the catalog. Anything not verified stays "unverified", never "match". */
export function comparePrices(catalog: { inputPer1M: number; outputPer1M: number; cachedInputPer1M?: number }, v: VerifiedPrices | null): { status: PriceComparison; diffs: string[] } {
  if (!v || !v.found || v.inputPer1M === null || v.outputPer1M === null) return { status: 'unverified', diffs: [] };
  const diffs: string[] = [];
  const cmp = (label: string, a: number | undefined, b: number | null) => {
    if (a === undefined || b === null) return;
    if (Math.abs(a - b) > 1e-9) diffs.push(`${label}: catalog ${a}, page ${b}`);
  };
  cmp('input', catalog.inputPer1M, v.inputPer1M);
  cmp('output', catalog.outputPer1M, v.outputPer1M);
  cmp('cached input', catalog.cachedInputPer1M, v.cachedInputPer1M);
  return { status: diffs.length ? 'changed' : 'match', diffs };
}
