/**
 * Every agent AI Fit runs, as data. This is the inventory a governance tool
 * (ARC Control) would hold for this product: what each agent may read, what
 * it may change (nothing), and who reviews its output.
 */
export interface AgentInventoryEntry {
  name: string;
  version: string;
  purpose: string;
  surface: 'consumer' | 'teams' | 'background';
  trigger: string;
  autonomy: 'suggest';
  tools: string[];
  reads: string[];
  changes: string;
  humanGate: string;
  checks: string[];
  evals: string;
}

export const AGENT_INVENTORY: AgentInventoryEntry[] = [
  {
    name: 'intake-interpreter', version: '1.0.0', surface: 'consumer',
    purpose: 'Suggest form answers from the person\'s own description of a task.',
    trigger: 'The person clicks "Suggest answers" (Consumer /check, Teams intake).',
    autonomy: 'suggest', tools: [], reads: ['the description the person typed'],
    changes: 'Nothing. Suggestions are shown with their evidence; the person applies or ignores each one.',
    humanGate: 'Every suggestion is applied by the person. The engine scores only confirmed fields.',
    checks: ['output schema', 'evidence quote must appear in the description', 'values must be valid options', 'one suggestion per field'],
    evals: 'evals/intake.json',
  },
  {
    name: 'decision-explainer', version: '1.0.0', surface: 'consumer',
    purpose: 'Explain a rule-made decision in plain language.',
    trigger: 'The person clicks "Explain in plain language" on a result.',
    autonomy: 'suggest', tools: [], reads: ['the structured decision (never the free-text description)'],
    changes: 'Nothing. The explanation is labelled as AI-written.',
    humanGate: 'The decision itself is made by fixed rules; this text cannot change it.',
    checks: ['output schema', 'discarded if it names a different outcome', 'falls back to the rule-written explanation'],
    evals: 'evals/explainer.json',
  },
  {
    name: 'price-verifier', version: '1.0.0', surface: 'background',
    purpose: 'Check the Teams model catalog\'s list prices against vendor pricing pages.',
    trigger: 'Weekly GitHub Actions run, or manual dispatch.',
    autonomy: 'suggest', tools: [], reads: ['public vendor pricing pages fetched by the job'],
    changes: 'Nothing. Writes a report; a person edits the catalog.',
    humanGate: 'Price changes are applied by a maintainer in a reviewed PR.',
    checks: ['output schema', 'every price needs a quote from the page containing that number', 'unverified is never reported as a match'],
    evals: 'evals/price-verifier.json',
  },
  {
    name: 'registry-verifier', version: '1.0.0', surface: 'background',
    purpose: 'Check that catalogued products still exist under their names.',
    trigger: 'Weekly GitHub Actions run, or manual dispatch.',
    autonomy: 'suggest', tools: [], reads: ['public product homepages fetched by the job'],
    changes: 'Nothing. Writes a report; a person edits the registry.',
    humanGate: 'Registry changes are applied by a maintainer in a reviewed PR.',
    checks: ['output schema', 'a non-"unclear" status needs a quote from the page', 'a new name must appear in the page'],
    evals: 'evals/registry-verifier.json',
  },
];
