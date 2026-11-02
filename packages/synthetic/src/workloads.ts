import { Workload, type Verdict } from '@aifit/teams-core';
import type { Outcome } from '@aifit/decision-core';

/**
 * Synthetic workloads: realistic jobs from many industries, each written with
 * the answer a careful practitioner would expect BEFORE running the engine.
 *
 * These are synthetic. They prove the engines are consistent and say "no" where
 * they should; they do not prove customers agree with the answers. That needs
 * real pilots. Expectations are sets, not single values, because two honest
 * experts can land on neighbouring verdicts.
 *
 * Where the engine and the expectation disagree after review, the case keeps
 * its expectation and records the disagreement in `knownDisagreement`, so it
 * stays visible in the report instead of the test being bent to fit.
 */

export interface Expectation {
  verdict: readonly Verdict[];
  /** Outcomes that are acceptable. Omitted = no view on the outcome. */
  outcome?: readonly Outcome[];
  /** Outcomes that would be a wrong answer. */
  notOutcome?: readonly Outcome[];
  /** Compliance flags that must appear (prefix match on the flag text). */
  flags?: readonly ('HIPAA' | 'PCI DSS' | 'GDPR' | 'Data concerning minors')[];
  /** Security level must be at least this. */
  minRisk?: 'low' | 'moderate' | 'high' | 'severe';
}

export interface SyntheticCase {
  id: string;
  industry: string;
  workload: Workload;
  expect: Expectation;
  /** Why a practitioner expects this. */
  rationale: string;
  /** Set only after review, when the engine reasonably disagrees. States what and why. */
  knownDisagreement?: string;
}

type Input = Partial<Omit<Workload, 'volume' | 'input' | 'output' | 'current' | 'team' | 'planning'>> & {
  name: string;
  task: Workload['task'];
  units: number;
  minutes?: number;
  rate?: number;
  sources?: string[];
  retrieval?: boolean;
  structured?: boolean;
  tokensIn?: number;
  tokensOut?: number;
  errorRate?: number;
  team?: Partial<Workload['team']>;
  planning?: Workload['planning'];
};

function wl(id: string, i: Input): Workload {
  const { units, minutes, rate, sources, retrieval, structured, tokensIn, tokensOut, errorRate, team, planning, ...rest } = i;
  return Workload.parse({
    id: `syn_${id}`,
    actor: 'employee',
    ...rest,
    volume: { unitsPerMonth: units, unitLabel: 'task' },
    input: { modality: ['text'], avgTokens: tokensIn ?? 800, sourceSystems: sources ?? [], requiresExternalKnowledge: retrieval ?? false },
    output: { modality: [structured ? 'structured' : 'text'], avgTokens: tokensOut ?? 300, mustBeStructured: structured ?? false },
    current: { minutesPerUnit: minutes, fullyLoadedHourlyUsd: rate ?? (minutes === undefined ? undefined : 40), humanErrorRate: errorRate },
    team: { engineers: 0, hasMlExperience: false, hasSecurityReview: false, canOperate247: false, ...team },
    planning: planning ?? {},
  });
}

const AI_HELPS: Verdict[] = ['assisted', 'automate-bounded', 'automate'];
const NOT_AI_OUTCOMES: Outcome[] = ['no_change', 'conventional_software', 'conventional_automation'];

export const CASES: SyntheticCase[] = [
  // --- Deterministic work: the engine must say "don't use AI" -------------------
  {
    id: 'invoice-total-lookup', industry: 'Finance',
    workload: wl('invoice', { name: 'Read back invoice totals', task: ['lookup'], units: 3000, minutes: 3, determinism: 'exact', errorTolerance: 'none', dataClasses: ['financial'], sources: ['NetSuite'], retrieval: true, structured: true }),
    expect: { verdict: ['not-ai'], outcome: NOT_AI_OUTCOMES },
    rationale: 'A keyed lookup with one right answer. A query or report does this exactly.',
  },
  {
    id: 'payroll-tax', industry: 'Payroll',
    workload: wl('payroll', { name: 'Calculate payroll withholding', task: ['calculate'], units: 1200, minutes: 4, determinism: 'exact', errorTolerance: 'none', dataClasses: ['financial', 'pii'], regulated: ['sox'] }),
    expect: { verdict: ['not-ai'], outcome: NOT_AI_OUTCOMES },
    rationale: 'Tax tables are rules. A model adds error to arithmetic that must be exact.',
  },
  {
    id: 'order-status', industry: 'Retail',
    workload: wl('orders', { name: 'Tell callers where their order is', task: ['lookup'], units: 500, minutes: 3, determinism: 'exact', errorTolerance: 'low', dataClasses: ['pii'], sources: ['OMS'], retrieval: true }),
    expect: { verdict: ['not-ai'], outcome: NOT_AI_OUTCOMES },
    rationale: 'Order number in, delivery date out. A tracking page or IVR lookup is the answer.',
  },
  {
    id: 'reorder-par', industry: 'Hospitality',
    workload: wl('reorder', { name: 'Work out ingredient reorders from par levels', task: ['calculate'], units: 4, minutes: 60, determinism: 'exact', errorTolerance: 'medium' }),
    expect: { verdict: ['not-ai'], notOutcome: ['build_ai', 'buy_ai'] },
    rationale: 'Par minus count is subtraction. A spreadsheet does it.',
  },
  {
    id: 'bank-rec', industry: 'Bookkeeping',
    workload: wl('bankrec', { name: 'Reconcile bank statement to ledger', task: ['calculate', 'lookup'], units: 30, minutes: 120, determinism: 'exact', errorTolerance: 'none', dataClasses: ['financial'] }),
    expect: { verdict: ['not-ai'], notOutcome: ['build_ai', 'buy_ai'] },
    rationale: 'Matching to the cent is what accounting software bank-feed rules do.',
  },
  {
    id: 'shipping-rate', industry: 'Logistics',
    workload: wl('shiprate', { name: 'Quote shipping rates from the carrier table', task: ['lookup', 'calculate'], units: 8000, minutes: 2, determinism: 'exact', errorTolerance: 'low', sources: ['Rate table'], retrieval: true }),
    expect: { verdict: ['not-ai'], outcome: NOT_AI_OUTCOMES },
    rationale: 'Weight and zone into a table. Deterministic and auditable.',
  },
  {
    id: 'timesheet-totals', industry: 'Professional services',
    workload: wl('timesheet', { name: 'Total weekly timesheets per project', task: ['calculate'], units: 600, minutes: 5, determinism: 'exact', errorTolerance: 'low', dataClasses: ['internal'] }),
    expect: { verdict: ['not-ai'], outcome: NOT_AI_OUTCOMES },
    rationale: 'Sums by key. A report in the time-tracking tool.',
  },
  {
    id: 'personal-budget', industry: 'Consumer',
    workload: wl('budget', { actor: 'self', name: 'Add up my monthly spending by category', task: ['calculate'], units: 1, minutes: 30, determinism: 'exact', errorTolerance: 'low', dataClasses: ['financial'] }),
    expect: { verdict: ['not-ai'], notOutcome: ['build_ai'] },
    rationale: 'A budgeting app or spreadsheet categorises and sums exactly.',
  },

  // --- Too little volume to justify a build ------------------------------------
  {
    id: 'board-memo', industry: 'Corporate',
    workload: wl('boardmemo', { name: 'Draft the quarterly board memo', task: ['generate', 'summarize'], units: 1, minutes: 480, rate: 150, determinism: 'subjective', dataClasses: ['trade_secret'] }),
    expect: { verdict: ['not-yet', 'assisted'], notOutcome: ['build_ai'] },
    rationale: 'Once a quarter. A general assistant at most; never a custom build.',
  },
  {
    id: 'grant-apps', industry: 'Nonprofit',
    workload: wl('grants', { name: 'Write grant applications', task: ['generate', 'summarize'], units: 4, minutes: 420, rate: 45, determinism: 'subjective' }),
    expect: { verdict: ['not-yet', 'assisted'], notOutcome: ['build_ai'] },
    rationale: 'Four a month. Buy a writing assistant or keep doing it by hand.',
  },
  {
    id: 'listing-copy', industry: 'Real estate',
    workload: wl('listings', { name: 'Write home listing descriptions', task: ['generate'], units: 5, minutes: 45, determinism: 'tolerant', errorTolerance: 'low' }),
    expect: { verdict: ['not-yet', 'assisted'], notOutcome: ['build_ai'] },
    rationale: 'Five a month, and facts (bedrooms, square footage) must be right.',
  },
  {
    id: 'candle-copy', industry: 'E-commerce',
    workload: wl('candles', { name: 'Write product descriptions for new scents', task: ['generate'], units: 10, minutes: 30, determinism: 'subjective', errorTolerance: 'high', planning: { offTheShelfAcceptable: true } }),
    expect: { verdict: ['not-yet', 'assisted'], notOutcome: ['build_ai'] },
    rationale: 'Ten a month: an off-the-shelf assistant, not a project.',
  },
  {
    id: 'report-cards', industry: 'Education',
    workload: wl('reportcards', { name: 'Write report card comments', task: ['generate'], units: 28, minutes: 15, determinism: 'subjective', errorTolerance: 'low', dataClasses: ['minors', 'pii'], regulated: ['ferpa'] }),
    expect: { verdict: ['not-yet', 'assisted'], notOutcome: ['build_ai'], flags: ['Data concerning minors'] },
    rationale: '28 a term, about children. Teacher writes; at most a reviewed draft.',
  },

  // --- Sensitive or consequential: AI assists, a person decides ----------------
  {
    id: 'clinic-coding', industry: 'Healthcare',
    workload: wl('coding', { name: 'Assign billing codes to visit notes', task: ['classify', 'extract'], units: 1200, minutes: 2, rate: 35, errorTolerance: 'low', dataClasses: ['phi'], regulated: ['hipaa'], dataResidency: 'on_prem', structured: true, team: { engineers: 2, hasSecurityReview: true } }),
    expect: { verdict: ['assisted', 'not-yet'], flags: ['HIPAA'], minRisk: 'moderate' },
    rationale: 'PHI, audited codes, on-prem only. Suggest codes for a coder to confirm.',
    knownDisagreement: 'Low error tolerance does not cap the verdict: suitability.ts decideVerdict caps at assisted only when errorTolerance is none, so a low-tolerance job with suggest autonomy still reads automate-bounded. Regulated data alone rates low security risk: security.ts adds 10 points per sensitive class and low runs to 21. The HIPAA/PCI flags and blocking controls are still present; the headline level understates.',
  },
  {
    id: 'fnol-triage', industry: 'Insurance',
    workload: wl('fnol', { name: 'Decide fast-track vs adjuster for claims', task: ['classify', 'decide'], units: 400, minutes: 10, rate: 42, errorTolerance: 'low', dataClasses: ['pii', 'phi', 'financial'], sources: ['Claims system'], retrieval: true, autonomy: 'approve' }),
    expect: { verdict: ['assisted', 'not-yet'], flags: ['HIPAA'], minRisk: 'moderate' },
    rationale: 'Mistakes cost money and injury claims carry health data. Recommend; handler decides.',
  },
  {
    id: 'cv-screening', industry: 'HR',
    workload: wl('cvs', { name: 'First-pass CV screening', task: ['classify'], units: 450, minutes: 4, errorTolerance: 'low', dataClasses: ['pii'], regulated: ['gdpr', 'eu_ai_act'], dataResidency: 'eu' }),
    expect: { verdict: ['assisted', 'not-yet'], flags: ['GDPR'] },
    rationale: 'Employment decisions are high-risk under the EU AI Act. A person must decide.',
    knownDisagreement: 'Low error tolerance does not cap the verdict: suitability.ts decideVerdict caps at assisted only when errorTolerance is none, so a low-tolerance job with suggest autonomy still reads automate-bounded.',
  },
  {
    id: 'family-law-intake', industry: 'Legal',
    workload: wl('familylaw', { name: 'Route new family-law enquiries to an attorney', task: ['classify'], units: 63, minutes: 8, rate: 60, errorTolerance: 'low', dataClasses: ['pii', 'minors'] }),
    expect: { verdict: ['assisted', 'not-yet'], flags: ['Data concerning minors'] },
    rationale: 'Confidential and about children; modest volume. A suggestion at most.',
  },
  {
    id: 'contract-clauses', industry: 'Legal',
    workload: wl('clauses', { name: 'Extract key clauses from supplier contracts', task: ['extract', 'summarize'], units: 300, minutes: 25, rate: 90, tokensIn: 12000, errorTolerance: 'low', dataClasses: ['trade_secret'], structured: true, team: { engineers: 1 } }),
    expect: { verdict: ['assisted', 'automate-bounded'] },
    rationale: 'Long reading, structured output, lawyer checks. Classic assist.',
  },
  {
    id: 'prior-auth', industry: 'Healthcare',
    workload: wl('priorauth', { name: 'Draft prior-authorisation letters', task: ['generate', 'summarize'], units: 500, minutes: 20, rate: 38, errorTolerance: 'low', dataClasses: ['phi'], regulated: ['hipaa'], sources: ['EHR'], retrieval: true, team: { engineers: 2, hasSecurityReview: true } }),
    expect: { verdict: ['assisted', 'not-yet'], flags: ['HIPAA'], minRisk: 'moderate' },
    rationale: 'Clinician signs every letter; PHI needs a BAA.',
    knownDisagreement: 'Low error tolerance does not cap the verdict: suitability.ts decideVerdict caps at assisted only when errorTolerance is none, so a low-tolerance job with suggest autonomy still reads automate-bounded. Regulated data alone rates low security risk: security.ts adds 10 points per sensitive class and low runs to 21. The HIPAA/PCI flags and blocking controls are still present; the headline level understates.',
  },
  {
    id: 'kyc-extract', industry: 'Banking',
    workload: wl('kyc', { name: 'Extract fields from ID documents for KYC', task: ['extract'], units: 2000, minutes: 6, errorTolerance: 'low', dataClasses: ['sensitive_pii'], regulated: ['glba'], structured: true, autonomy: 'approve', team: { engineers: 4, hasSecurityReview: true } }),
    expect: { verdict: ['assisted', 'automate-bounded', 'not-yet'], minRisk: 'moderate' },
    rationale: 'Government IDs: tightly controlled extraction with review.',
    knownDisagreement: 'Regulated data alone rates low security risk: security.ts adds 10 points per sensitive class and low runs to 21. The HIPAA/PCI flags and blocking controls are still present; the headline level understates.',
  },
  {
    id: 'ap-invoices', industry: 'Logistics',
    workload: wl('apinv', { name: 'Key carrier invoice PDFs into accounting', task: ['extract'], units: 600, minutes: 3, rate: 30, errorTolerance: 'low', dataClasses: ['financial'], structured: true, autonomy: 'approve', actions: [{ name: 'Create bill', system: 'QuickBooks', write: true, blastRadius: 'costly' }] }),
    expect: { verdict: ['assisted', 'automate-bounded'] },
    rationale: 'Extraction is a good fit; a wrong amount overpays, so a person approves.',
  },
  {
    id: 'card-disputes', industry: 'Payments',
    workload: wl('disputes', { name: 'Triage card chargeback disputes', task: ['classify', 'extract'], units: 3000, minutes: 7, errorTolerance: 'low', dataClasses: ['pci', 'financial'], regulated: ['pci'], team: { engineers: 3, hasSecurityReview: true } }),
    expect: { verdict: ['assisted', 'not-yet', 'automate-bounded'], flags: ['PCI DSS'], minRisk: 'moderate' },
    rationale: 'Cardholder data must stay out of prompts; triage with review is plausible.',
    knownDisagreement: 'Regulated data alone rates low security risk: security.ts adds 10 points per sensitive class and low runs to 21. The HIPAA/PCI flags and blocking controls are still present; the headline level understates.',
  },
  {
    id: 'patient-messages', industry: 'Healthcare',
    workload: wl('ptmsg', { name: 'Triage patient portal messages by urgency', task: ['classify'], units: 6000, minutes: 3, rate: 45, errorTolerance: 'low', dataClasses: ['phi'], regulated: ['hipaa'], team: { engineers: 3, hasSecurityReview: true } }),
    expect: { verdict: ['assisted', 'not-yet'], flags: ['HIPAA'], minRisk: 'moderate' },
    rationale: 'A missed urgent message is a safety event. Nurse confirms every routing.',
    knownDisagreement: 'Low error tolerance does not cap the verdict: suitability.ts decideVerdict caps at assisted only when errorTolerance is none, so a low-tolerance job with suggest autonomy still reads automate-bounded. Regulated data alone rates low security risk: security.ts adds 10 points per sensitive class and low runs to 21. The HIPAA/PCI flags and blocking controls are still present; the headline level understates.',
  },

  // --- Good automation candidates ----------------------------------------------
  {
    id: 'product-tagging', industry: 'E-commerce',
    workload: wl('tagging', { name: 'Tag catalogue items with attributes', task: ['classify', 'extract'], units: 20000, minutes: 2, rate: 25, errorTolerance: 'high', dataClasses: ['public'], structured: true, team: { engineers: 3 } }),
    expect: { verdict: ['automate', 'automate-bounded'], outcome: ['build_ai', 'buy_ai'] },
    rationale: 'High volume, public data, wrong tags are cheap to fix.',
  },
  {
    id: 'review-sentiment', industry: 'Hospitality',
    workload: wl('sentiment', { name: 'Tag guest reviews by topic and sentiment', task: ['classify'], units: 15000, minutes: 1, rate: 25, errorTolerance: 'high', dataClasses: ['public'], structured: true, planning: { offTheShelfAcceptable: true } }),
    expect: { verdict: ['automate', 'automate-bounded', 'assisted'], notOutcome: ['no_change'] },
    rationale: 'Bulk text tagging is a mature, cheap AI job.',
  },
  {
    id: 'supplier-translation', industry: 'Import/export',
    workload: wl('translate', { name: 'Translate supplier emails to English', task: ['generate'], units: 3000, minutes: 5, rate: 30, errorTolerance: 'high', planning: { offTheShelfAcceptable: true } }),
    expect: { verdict: AI_HELPS, outcome: ['buy_ai', 'build_ai'] },
    rationale: 'Gist translation at volume; rough meaning is acceptable.',
  },
  {
    id: 'sales-call-notes', industry: 'SaaS',
    workload: wl('callnotes', { name: 'Summarise sales calls into CRM notes', task: ['summarize', 'extract'], units: 4000, minutes: 8, rate: 55, tokensIn: 6000, sources: ['Gong', 'Salesforce'], dataClasses: ['pii'], planning: { offTheShelfAcceptable: true }, team: { engineers: 2, hasSecurityReview: true } }),
    expect: { verdict: AI_HELPS, outcome: ['buy_ai', 'build_ai'] },
    rationale: 'Summarisation of long transcripts is a strong fit; reps skim the output.',
  },
  {
    id: 'internal-kb', industry: 'SaaS',
    workload: wl('kb', { name: 'Answer staff questions from the wiki', task: ['search', 'summarize'], units: 3000, minutes: 6, rate: 60, sources: ['Confluence'], retrieval: true, team: { engineers: 2 } }),
    expect: { verdict: AI_HELPS, outcome: ['buy_ai', 'build_ai'] },
    rationale: 'Retrieval over one source, tolerant answers, staff can check the citation.',
  },
  {
    id: 'ad-variants', industry: 'Marketing',
    workload: wl('adcopy', { name: 'Generate ad copy variants for testing', task: ['generate'], units: 800, minutes: 10, rate: 50, determinism: 'subjective', errorTolerance: 'high', dataClasses: ['public'], planning: { offTheShelfAcceptable: true } }),
    expect: { verdict: AI_HELPS, outcome: ['buy_ai', 'build_ai'] },
    rationale: 'Subjective generation where volume of options is the point.',
  },
  {
    id: 'alert-summaries', industry: 'IT operations',
    workload: wl('alerts', { name: 'Summarise noisy monitoring alerts', task: ['summarize', 'classify'], units: 5000, minutes: 3, rate: 70, errorTolerance: 'high', sources: ['Datadog'], team: { engineers: 6, hasMlExperience: true } }),
    expect: { verdict: ['automate', 'automate-bounded'], outcome: ['build_ai', 'buy_ai'] },
    rationale: 'Read-only, internal, engineers on call can read the raw alert.',
  },
  {
    id: 'content-moderation', industry: 'Online community',
    workload: wl('moderation', { name: 'Hide spam posts pending review', task: ['classify', 'act'], units: 50000, minutes: 0.5, rate: 22, errorTolerance: 'medium', dataClasses: ['pii'], autonomy: 'bounded', actions: [{ name: 'Hide post', system: 'Forum', write: true, blastRadius: 'reversible' }], team: { engineers: 4, hasSecurityReview: true } }),
    expect: { verdict: ['automate-bounded', 'assisted'] },
    rationale: 'Huge volume, reversible action (hide, not delete), human review queue.',
  },
  {
    id: 'support-faq', industry: 'SaaS',
    workload: wl('faq', { name: 'Draft replies to how-do-I tickets', task: ['search', 'generate'], units: 900, minutes: 6, rate: 35, sources: ['Zendesk', 'Help Center'], retrieval: true, dataClasses: ['pii'], autonomy: 'approve', planning: { offTheShelfAcceptable: true } }),
    expect: { verdict: AI_HELPS, outcome: ['buy_ai', 'build_ai'] },
    rationale: 'Answers already exist in the help centre; agent approves the draft.',
  },
  {
    id: 'construction-dailies', industry: 'Construction',
    workload: wl('dailies', { name: 'Turn dictated notes into daily site reports', task: ['summarize'], units: 520, minutes: 25, rate: 55, errorTolerance: 'medium', planning: { offTheShelfAcceptable: true } }),
    expect: { verdict: AI_HELPS, notOutcome: ['no_change'] },
    rationale: '20 supervisors x 26 days. Dictation to a structured report is a good assist.',
  },

  // --- Blockers: the engine must say "not yet" ---------------------------------
  {
    id: 'auto-wire', industry: 'Treasury',
    workload: wl('wire', { name: 'Release vendor wire payments automatically', task: ['decide', 'act'], units: 800, minutes: 6, rate: 60, errorTolerance: 'low', dataClasses: ['financial'], autonomy: 'full', actions: [{ name: 'Send wire', system: 'Bank portal', write: true, blastRadius: 'irreversible', valueCeilingUsd: 250000 }] }),
    expect: { verdict: ['not-yet'], minRisk: 'high' },
    rationale: 'Wires cannot be recalled. Full autonomy over them is a blocker.',
  },
  {
    id: 'password-resets', industry: 'IT helpdesk',
    workload: wl('pwreset', { name: 'Handle password reset tickets', task: ['classify', 'act'], units: 300, minutes: 5, dataClasses: ['credentials', 'pii'], autonomy: 'approve', actions: [{ name: 'Reset password', system: 'Active Directory', write: true, blastRadius: 'costly' }] }),
    expect: { verdict: ['not-yet', 'not-ai'], minRisk: 'moderate' },
    rationale: 'Credentials must never reach a prompt; self-service reset is the real fix.',
  },
  {
    id: 'account-deletion', industry: 'SaaS',
    workload: wl('deletion', { name: 'Delete customer accounts on request', task: ['classify', 'act'], units: 200, minutes: 10, dataClasses: ['pii'], autonomy: 'bounded', actions: [{ name: 'Delete account', system: 'Production DB', write: true, blastRadius: 'irreversible' }] }),
    expect: { verdict: ['not-yet'], minRisk: 'high' },
    rationale: 'Irreversible deletion without a human gate.',
  },
  {
    id: 'dose-adjust', industry: 'Healthcare',
    workload: wl('dosing', { name: 'Adjust medication doses from lab results', task: ['decide', 'act'], units: 900, minutes: 5, rate: 80, errorTolerance: 'none', dataClasses: ['phi'], regulated: ['hipaa'], autonomy: 'bounded', actions: [{ name: 'Update order', system: 'EHR', write: true, blastRadius: 'costly' }] }),
    expect: { verdict: ['not-yet'], flags: ['HIPAA'], minRisk: 'high' },
    rationale: 'Zero tolerance with autonomous action is contradictory; clinical decisions stay human.',
  },
  {
    id: 'legal-notices', industry: 'Legal',
    workload: wl('notices', { name: 'Send statutory notices to tenants', task: ['generate', 'act'], units: 150, minutes: 20, rate: 70, errorTolerance: 'low', dataClasses: ['pii'], autonomy: 'full', actions: [{ name: 'Send notice', system: 'Postal API', write: true, blastRadius: 'irreversible' }] }),
    expect: { verdict: ['not-yet'], minRisk: 'high' },
    rationale: 'A sent legal notice cannot be unsent.',
  },
  {
    id: 'refund-autonomy', industry: 'Retail',
    workload: wl('refunds', { name: 'Issue refunds on complaint emails', task: ['classify', 'decide', 'act'], units: 5000, minutes: 6, rate: 30, errorTolerance: 'low', dataClasses: ['pii', 'financial'], autonomy: 'full', actions: [{ name: 'Refund', system: 'Shopify', write: true, blastRadius: 'irreversible', valueCeilingUsd: 500 }] }),
    expect: { verdict: ['not-yet'], minRisk: 'high' },
    rationale: 'Money out the door with no human gate.',
  },

  // --- Decision outcomes driven by planning constraints ------------------------
  {
    id: 'works-fine', industry: 'Operations',
    workload: wl('worksfine', { name: 'Route shared-inbox emails to teams', task: ['classify'], units: 120, minutes: 0.2, rate: 30, planning: { currentWorksWell: true } }),
    expect: { verdict: ['not-ai', 'not-yet', 'assisted'], outcome: ['no_change', 'conventional_automation', 'conventional_software'] },
    rationale: 'Under half an hour a month and the current rules work. Leave it.',
    knownDisagreement: 'A trivial job (about 24 minutes a month) still scores 72+ on suitability because value and volume are two of seven dimensions. The decision engine correctly picks no_change; the verdict line reads automate-bounded.',
  },
  {
    id: 'no-hosted-no-team', industry: 'Government',
    workload: wl('nohosted', { name: 'Summarise public consultation responses', task: ['summarize', 'classify'], units: 2000, minutes: 10, rate: 45, planning: { offTheShelfAcceptable: false }, team: { engineers: 0 } }),
    expect: { verdict: AI_HELPS, notOutcome: ['buy_ai'] },
    rationale: 'Hosted tools are ruled out, so buying cannot be the answer.',
  },
  {
    id: 'buy-writing', industry: 'Professional services',
    workload: wl('buywriting', { name: 'Tidy up client emails before sending', task: ['generate'], units: 2000, minutes: 4, rate: 50, determinism: 'subjective', errorTolerance: 'high', planning: { offTheShelfAcceptable: true }, team: { engineers: 0 } }),
    expect: { verdict: AI_HELPS, outcome: ['buy_ai'] },
    rationale: 'Generic writing help, no engineers: buy a tool.',
  },
  {
    id: 'build-classifier', industry: 'Fintech',
    workload: wl('buildcls', { name: 'Classify transaction descriptions into merchant categories', task: ['classify'], units: 2000000, minutes: 0.3, rate: 30, errorTolerance: 'medium', dataClasses: ['financial'], structured: true, planning: { offTheShelfAcceptable: false }, team: { engineers: 8, hasMlExperience: true, hasSecurityReview: true } }),
    expect: { verdict: ['automate-bounded', 'automate', 'assisted'], notOutcome: ['buy_ai', 'no_change'] },
    rationale: 'Huge volume, a strong ML team, hosted tools refused.',
  },

  // --- Consumer (actor = self) ------------------------------------------------
  {
    id: 'self-email-drafts', industry: 'Consumer',
    workload: wl('selfemail', { actor: 'self', name: 'Draft replies to my personal email', task: ['generate'], units: 60, minutes: 5, determinism: 'subjective', errorTolerance: 'medium' }),
    expect: { verdict: AI_HELPS, notOutcome: ['build_ai'] },
    rationale: 'A person drafting their own emails: a chat assistant, never a build.',
  },
  {
    id: 'self-study-notes', industry: 'Consumer',
    workload: wl('selfstudy', { actor: 'self', name: 'Summarise papers for my thesis', task: ['summarize', 'extract'], units: 12, minutes: 60, tokensIn: 10000, errorTolerance: 'medium' }),
    expect: { verdict: AI_HELPS, notOutcome: ['build_ai'] },
    rationale: 'Personal reading help; the student checks against the paper.',
  },

  // --- Edge cases -------------------------------------------------------------
  {
    id: 'zero-volume', industry: 'Edge',
    workload: wl('zero', { name: 'Idea with no current volume', task: ['generate'], units: 0 }),
    expect: { verdict: ['not-yet', 'not-ai'], notOutcome: ['build_ai'] },
    rationale: 'Nothing happens today, so there is nothing to automate.',
  },
  {
    id: 'no-baseline', industry: 'Edge',
    workload: wl('nobaseline', { name: 'Classify inbound leads by intent', task: ['classify'], units: 1500 }),
    expect: { verdict: ['assisted', 'automate-bounded', 'not-yet'] },
    rationale: 'Plausible job but no time measured: the report must flag the unknown, not invent savings.',
  },
  {
    id: 'tiny-value', industry: 'Edge',
    workload: wl('tiny', { name: 'Tag a field on a form', task: ['classify'], units: 500, minutes: 0.2, rate: 20, errorTolerance: 'medium' }),
    expect: { verdict: ['assisted', 'not-yet', 'not-ai', 'automate-bounded'], notOutcome: ['build_ai'] },
    rationale: 'Twelve seconds each, under two hours a month: not worth a build.',
  },
  {
    id: 'mixed-shapes', industry: 'Edge',
    workload: wl('mixed', { name: 'Look up an account then explain the bill', task: ['lookup', 'summarize'], units: 4000, minutes: 6, rate: 35, sources: ['Billing'], retrieval: true, dataClasses: ['pii', 'financial'] }),
    expect: { verdict: ['assisted', 'automate-bounded', 'not-yet'] },
    rationale: 'A deterministic step plus a language step is not pure not-ai.',
  },
  {
    id: 'eu-residency', industry: 'Retail (EU)',
    workload: wl('eu', { name: 'Categorise customer complaints', task: ['classify'], units: 5000, minutes: 3, rate: 35, dataClasses: ['pii'], dataResidency: 'eu', regulated: ['gdpr'], team: { engineers: 2, hasSecurityReview: true } }),
    expect: { verdict: AI_HELPS, flags: ['GDPR'] },
    rationale: 'Fine to do, but residency and GDPR must be called out.',
  },
];
