import Link from 'next/link';
import { can } from '@aifit/platform';
import type { Verdict } from '@aifit/teams-core';
import { Banner, Panel, PanelHeader, ProgressBar, cn } from '@/design';
import { DecisionSection } from '@/components/report-decision';
import { ExplainDecision } from '@/components/agent-assist';
import { ReportWorkspaceActions } from '@/components/report-workspace';
import { MeasureSample } from '@/components/measure-sample';
import { ReportFooter } from '@/components/report-footer';
import { CheckoutButton, DeleteAssessmentButton, DownloadLink, SendToControlButton } from '@/components/workspace/controls';
import { measureEnabled } from '@/lib/measure';
import { agents } from '@/server/agents';
import { deliverableAccess, type AssessmentView } from '@/server/assessment-view';
import { storeResolution, workspacesEnabled, billing } from '@/server/platform';
import { Basis, Bullets, int, plural } from '../bits';

const VERDICT: Record<Verdict, { tone: 'neutral' | 'good' | 'warn'; label: string; line: string }> = {
  'not-ai': {
    tone: 'neutral',
    label: 'Do not use a model for this',
    line: 'As described, this workload has a computable right answer. A deterministic implementation is correct by construction, testable, and costs approximately nothing to run. A language model would be probabilistic about something that does not need to be.',
  },
  'not-yet': {
    tone: 'warn',
    label: 'Not yet',
    line: 'The workload is plausible but something in the description makes this a poor first thing to automate. The unlocks below are in priority order.',
  },
  assisted: {
    tone: 'neutral',
    label: 'Yes — with a human in the loop',
    line: 'Ship this as a drafting aid with a review queue. It is the fastest path to production, it carries the least risk, and the accept/edit/reject data it generates is what would later justify removing the human.',
  },
  'automate-bounded': {
    tone: 'neutral',
    label: 'Yes — inside hard limits',
    line: 'This can run with light supervision provided the limits below are real controls rather than intentions.',
  },
  automate: {
    tone: 'neutral',
    label: 'Yes',
    line: 'Repetitive, tolerant of a miss rate, and high enough volume that the build pays back. Automate it.',
  },
};

/**
 * The overview: the suitability verdict, the five-outcome decision, and what
 * would change either. "Do not use a model" is a first-class answer in neutral
 * colour, never a warning.
 */
export async function VerdictSection({ view }: { view: AssessmentView }) {
  const { a, workload, decision } = view;
  const v = VERDICT[a.suitability.verdict];
  const notAi = a.suitability.verdict === 'not-ai';
  const saved = view.source.kind === 'saved' ? view.source : null;
  const units = plural(workload.volume.unitLabel);
  const deliverables = saved ? await SavedDeliverables({ view }) : null;
  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-fg-muted">
          <span>{int(workload.volume.unitsPerMonth)} {units}/mo (your input)</span>
          <span aria-hidden>·</span>
          <span>{a.security.level} risk</span>
          <span aria-hidden>·</span>
          <Basis e={a.suitability.score} />
        </div>
        {saved ? (
          <>
            <h1 className="mt-3 text-headline-lg text-fg">{saved.record.title}</h1>
            <h2 className={cn('mt-4 text-display-lg', v.tone === 'warn' ? 'text-warn' : 'text-fg')}>{v.label}</h2>
          </>
        ) : (
          <h1 className={cn('mt-3 text-display-lg', v.tone === 'warn' ? 'text-warn' : 'text-fg')}>{v.label}</h1>
        )}
        <p className="mt-4 max-w-3xl text-body-lg text-fg-2">{v.line}</p>
        <p className="mt-3 max-w-3xl text-body-md text-fg-muted">{a.suitability.headline}</p>
      </section>

      {a.suitability.blockers.length > 0 ? (
        <Banner tone="danger" title="Blockers">
          <Bullets items={a.suitability.blockers} className="mt-1" />
        </Banner>
      ) : null}

      <DecisionSection d={decision} verdict={a.suitability.verdict} />
      {agents().enabled ? <ExplainDecision encoded={view.source.encoded} /> : null}

      {saved ? deliverables : (
        <ReportWorkspaceActions
          encoded={view.source.encoded}
          workspaces={workspacesEnabled()}
          signedIn={Boolean(view.viewer)}
          reassessId={view.source.kind === 'link' ? view.source.reassess : null}
          anonymousBlueprint={!billing().enabled}
        />
      )}

      {!notAi && !a.trust.calibrated ? (
        <Banner tone="info" title="This assessment is uncalibrated">
          Treat the run cost as an order of magnitude, not a budget line: turns per outcome and failure rate are rubric priors
          until ARC Control has measured this pattern. Connecting ARC Control (ARK_CONTROL_URL, ARK_CONTROL_TOKEN) lets reports
          use observed call shapes for any pattern with at least 30 traces in the last 30 days.
        </Banner>
      ) : null}

      {!notAi ? <MeasureSample workload={workload} enabled={measureEnabled()} controlUrl={process.env.ARK_CONTROL_URL ?? 'http://localhost:3002'} /> : null}

      {a.suitability.unlocks.length > 0 ? (
        <Panel>
          <PanelHeader title="What would move the verdict" description="In priority order." />
          <ol className="space-y-3 p-4">
            {a.suitability.unlocks.map((u, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sunken font-mono text-label-sm text-fg-muted">{i + 1}</span>
                <span className="text-body-md text-fg-2">{u}</span>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title="How it scored" description="Seven weighted dimensions. The weakest one usually decides the verdict." actions={<Basis e={a.suitability.score} />} />
        <ul className="divide-y divide-line">
          {a.suitability.dimensions.map((d) => (
            <li key={d.key} className="grid gap-2 p-4 sm:grid-cols-[200px_1fr_56px] sm:items-center">
              <span className="text-label-md text-fg">{d.label} <span className="font-mono text-label-sm text-fg-muted">×{d.weight}</span></span>
              <div>
                <ProgressBar value={d.score} tone="neutral" label={`${d.label} score`} />
                <p className="mt-1.5 text-body-sm text-fg-muted">{d.reasoning}</p>
              </div>
              <span className="font-mono text-data-md text-fg sm:text-right">{Math.round(d.score)}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="What this assessment does not know" description="The section most tools like this leave out." />
        <div className="p-4">
          {a.trust.unknowns.length ? <Bullets items={a.trust.unknowns} /> : <p className="text-body-sm text-fg-muted">Nothing material. Every driving figure is calibrated or measured.</p>}
          <p className="mt-4 text-body-sm text-fg-muted">{a.trust.caveat}</p>
        </div>
      </Panel>

      {saved ? <Versions view={view} /> : <ReportFooter edit={{ href: view.intakeHref, label: 'Edit answers' }} />}
    </div>
  );
}

async function SavedDeliverables({ view }: { view: AssessmentView }) {
  if (view.source.kind !== 'saved' || !view.viewer) return null;
  const rec = view.source.record;
  const history = view.source.history;
  const latest = history[history.length - 1]!;
  const d = await deliverableAccess(view);
  const cfg = billing();
  return (
    <Panel>
      <PanelHeader title="Deliverables" description="Technical blueprint (JSON and Markdown) and the governance export for ARC Control." actions={
        can(view.viewer.ctx.role, 'assessment:write') ? <Link href={view.intakeHref} className="text-label-md text-accent underline underline-offset-2">Reassess (save as version {history.length + 1})</Link> : null
      } />
      <div className="space-y-4 p-4">
        {latest.id !== rec.id ? (
          <Banner tone="info" title="A newer version exists" action={<Link href={`/workspace/assessments/${latest.id}`} className="text-label-md underline underline-offset-2">Open version {latest.version}</Link>} />
        ) : null}
        {!d.mayDownload ? (
          <p className="text-body-sm text-fg-2">Viewers can read reports but not download deliverables. Ask an admin for the member role.</p>
        ) : (
          <>
            {d.blueprint?.allowed ? (
              <div className="flex flex-wrap gap-2">
                <DownloadLink href={`/api/assessments/${rec.id}/blueprint?format=md`} label="Blueprint (Markdown)" />
                <DownloadLink href={`/api/assessments/${rec.id}/blueprint?format=json`} label="Blueprint (JSON)" />
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-body-sm text-fg-2">{d.blueprint?.reason}</p>
                {cfg.enabled && cfg.prices.blueprint ? <CheckoutButton product="blueprint" assessmentId={rec.id} label="Buy this blueprint" /> : null}
              </div>
            )}
            {d.control?.allowed ? (
              <div className="space-y-2 border-t border-line pt-4">
                <div className="flex flex-wrap gap-2">
                  <DownloadLink href={`/api/assessments/${rec.id}/control-export`} label="Governance export (JSON)" />
                  {can(view.viewer.ctx.role, 'members:manage') ? <SendToControlButton id={rec.id} /> : null}
                </div>
                <p className="text-body-sm text-fg-muted">
                  Recommendations only: requirements, suggested policies, agent inventory and the evaluation plan. Nothing in it is an
                  enforced control or a compliance attestation.
                </p>
              </div>
            ) : (
              <p className="border-t border-line pt-4 text-body-sm text-fg-2">{d.control?.reason}</p>
            )}
            <p className="text-body-sm text-fg-muted">To save as PDF, use Print on any section.</p>
          </>
        )}
      </div>
    </Panel>
  );
}

function Versions({ view }: { view: AssessmentView }) {
  if (view.source.kind !== 'saved' || !view.viewer) return null;
  const rec = view.source.record;
  const { store } = storeResolution();
  return (
    <Panel>
      <PanelHeader title="Versions" description={`Saved with decision engine ${rec.snapshot.engines.decision ?? '?'} (${rec.snapshot.engines.decisionRules ?? '?'}). Sections are recalculated with today's engines; the snapshot is what it said then.`} />
      <ol className="space-y-2 p-4 text-body-sm">
        {view.source.history.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center gap-3">
            <Link href={`/workspace/assessments/${h.id}`} aria-current={h.id === rec.id ? 'page' : undefined} className={h.id === rec.id ? 'font-medium text-fg' : 'text-fg-2 underline underline-offset-2'}>
              Version {h.version}
            </Link>
            <span className="text-fg-muted">{h.createdAt.slice(0, 10)} · {h.snapshot.verdict} · {h.snapshot.outcome}</span>
          </li>
        ))}
      </ol>
      {store && can(view.viewer.ctx.role, 'assessment:delete') ? <div className="border-t border-line p-4"><DeleteAssessmentButton id={rec.id} /></div> : null}
    </Panel>
  );
}
