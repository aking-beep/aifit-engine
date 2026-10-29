import Link from 'next/link';
import { assess, FIXTURES } from '@aifit/teams-core';
import { OUTCOME_LABEL } from '@aifit/decision-core';
import { EvidenceLabel, Panel, VERDICT_META, VerdictChip, verdictFromOutcome, type Verdict } from '@/design';
import { PublicPlanCards } from '@/components/plan-cards';
import { decisionFor } from '@/server/assessments';
import { encodeWorkload } from '@/lib/encode';
import { currentViewer } from '@/server/platform';
import { compactUsd } from '@/components/assessment/bits';

export const dynamic = 'force-dynamic';

const REPORT = [
  ['Verdict', 'Including “don’t use AI”, with the reason written down'],
  ['Build vs buy vs automate', 'Five options scored by published rules'],
  ['Cost and ROI', 'Cost per successful outcome, every figure labelled with its basis'],
  ['Architecture and models', 'The pattern, the rejected ones, a priced shortlist across providers'],
  ['Governance, security, risks', 'Controls with how each is verified, exportable to ARC Control'],
  ['Evaluation and roadmap', 'Acceptance criteria and phases that each carry a kill criterion'],
] as const;

const ORDER: Verdict[] = ['no-ai', 'software', 'automation', 'buy', 'build'];

export default async function Landing() {
  const viewer = await currentViewer().catch(() => null);
  // The bundled example workloads, assessed live by the same engines as yours.
  const examples = FIXTURES.map((w) => {
    const a = assess(w, { depth: 'business' });
    const d = decisionFor(a);
    return { w, a, d, href: `/report?w=${encodeURIComponent(encodeWorkload(w))}` };
  });
  return (
    <div className="space-y-20">
      <section className="max-w-3xl">
        <p className="text-label-md text-accent">AI Fit Teams</p>
        <h1 className="mt-3 text-display-xl text-fg">Know what to automate, what to build, and what to avoid.</h1>
        <p className="mt-5 text-body-lg text-fg-2">
          Describe one repeating job. AI Fit compares five answers (leave it, ordinary software, rules-based automation, buy an AI tool,
          build one) with fixed, published rules, and is built to say no. Only one of the five is “build custom AI”.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/assess" className="inline-flex h-11 items-center rounded-sm bg-accent px-5 text-body-md font-medium text-on-accent hover:bg-accent/90">Assess a workload</Link>
          <Link href={viewer ? '/workspace' : '/signup'} className="inline-flex h-11 items-center rounded-sm border border-line-strong px-5 text-body-md text-fg hover:bg-sunken">{viewer ? 'Open your workspace' : 'Create a workspace'}</Link>
          <Link href="/methodology" className="text-body-md text-fg-2 underline underline-offset-4 hover:text-fg">How the scoring works</Link>
        </div>
        <p className="mt-4 text-body-sm text-fg-muted">The assessment is free and needs no account. Nothing you enter is stored unless you save it.</p>
      </section>

      <section aria-labelledby="examples">
        <h2 id="examples" className="text-headline-md text-fg">Three example workloads, assessed live</h2>
        <p className="mt-1 text-body-md text-fg-muted">The documented examples that ship with the engine, run through it now. Open one to see every section.</p>
        <Panel className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-body-sm">
            <caption className="sr-only">Example workloads and their recommendations</caption>
            <thead>
              <tr className="border-b border-line text-left text-label-sm text-fg-muted">
                <th scope="col" className="px-4 py-2 font-medium">Workload</th>
                <th scope="col" className="px-3 py-2 font-medium">Recommendation</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Run cost / mo</th>
                <th scope="col" className="px-4 py-2 font-medium">Basis</th>
              </tr>
            </thead>
            <tbody>
              {examples.map(({ w, a, d, href }) => (
                <tr key={w.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2"><Link href={href} className="text-fg underline-offset-2 hover:underline">{w.name}</Link><span className="ml-2 text-label-sm text-fg-muted">Example</span></td>
                  <td className="px-3 py-2"><span className="inline-flex items-center gap-2"><VerdictChip verdict={verdictFromOutcome(d.outcome)} />{OUTCOME_LABEL[d.outcome]}</span></td>
                  <td className="px-3 py-2 text-right font-mono tabular text-fg">{a.model ? compactUsd(a.cost.perMonth.value) : '≈ $0'}</td>
                  <td className="px-4 py-2"><EvidenceLabel kind={a.trust.calibrated ? 'verified' : 'estimated'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </section>

      <section aria-labelledby="verdicts-heading" id="verdicts">
        <h2 id="verdicts-heading" className="text-headline-md text-fg">Five possible answers</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ORDER.map((v) => (
            <li key={v} className="rounded-md border border-line bg-surface p-4">
              <VerdictChip verdict={v} />
              <p className="mt-2 text-body-sm text-fg-2">{VERDICT_META[v].sentence}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="deliverables-heading" id="deliverables">
        <h2 id="deliverables-heading" className="text-headline-md text-fg">What you can defend in the meeting</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {REPORT.map(([t, d]) => (
            <li key={t} className="rounded-md border border-line bg-surface p-4">
              <p className="text-title-md text-fg">{t}</p>
              <p className="mt-1 text-body-sm text-fg-2">{d}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-body-sm text-fg-muted">Plus a technical blueprint (Markdown and JSON) and a governance export for ARC Control, marked recommended-not-enforced.</p>
      </section>

      <section aria-labelledby="pricing-heading" id="pricing">
        <h2 id="pricing-heading" className="text-headline-md text-fg">Pricing</h2>
        <p className="mt-1 text-body-md text-fg-muted">Prices shown from plan configuration. Payment is on Stripe’s hosted checkout.</p>
        <div className="mt-4"><PublicPlanCards signedIn={Boolean(viewer)} /></div>
      </section>
    </div>
  );
}
