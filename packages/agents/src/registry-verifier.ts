import * as z from 'zod/v4';
import type { AgentSpec } from './harness.js';
import { dataBlock } from './harness.js';
import { quoteAppears } from './text.js';

/** Registry verifier: does a catalogued product still exist under its name? Quotes must appear in the page. */

export const RegistryVerifierInput = z.object({
  productId: z.string(),
  name: z.string(),
  provider: z.string(),
  homepage: z.string().url(),
  pageText: z.string().min(1).max(20_000),
});
export type RegistryVerifierInput = z.infer<typeof RegistryVerifierInput>;

export const RegistryVerifierOutput = z.object({
  status: z.enum(['active', 'renamed', 'discontinued', 'unclear']),
  currentName: z.string().max(120).nullable(),
  quotes: z.array(z.string()).max(5),
  notes: z.string().max(600),
});
export type RegistryVerifierOutput = z.infer<typeof RegistryVerifierOutput>;

export interface VerifiedProduct {
  status: 'active' | 'renamed' | 'discontinued' | 'unclear';
  currentName: string | null;
  quotes: string[];
  notes: string;
}

export function checkProduct(pageText: string, o: RegistryVerifierOutput): { result: VerifiedProduct; problems: string[] } {
  const quotes = o.quotes.filter((q) => q.length <= 200 && quoteAppears(q, pageText));
  const problems: string[] = [];
  let status = o.status;
  if (status !== 'unclear' && quotes.length === 0) {
    problems.push(`"${status}" had no quote found in the page; reported as unclear`);
    status = 'unclear';
  }
  if (status === 'renamed' && (!o.currentName || !quoteAppears(o.currentName, pageText))) {
    problems.push('the new name does not appear in the page; reported as unclear');
    status = 'unclear';
  }
  return { result: { status, currentName: status === 'renamed' ? o.currentName : null, quotes, notes: o.notes.slice(0, 300) }, problems };
}

export const registryVerifierAgent: AgentSpec<RegistryVerifierInput, RegistryVerifierOutput, VerifiedProduct> = {
  name: 'registry-verifier',
  version: '1.0.0',
  prompt: 'registry-verifier',
  input: RegistryVerifierInput,
  output: RegistryVerifierOutput,
  effort: 'low',
  maxTokens: 2000,
  timeoutMs: 45_000,
  render: (i) => `Catalog entry: "${i.name}" by ${i.provider} (id ${i.productId}).\nPage: ${i.homepage}\n${dataBlock('page', i.pageText)}`,
  check: (i, o) => checkProduct(i.pageText, o),
};
