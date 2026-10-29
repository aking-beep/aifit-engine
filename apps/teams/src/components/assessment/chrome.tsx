import Link from 'next/link';
import { Lock } from 'lucide-react';
import { OUTCOME_LABEL } from '@aifit/decision-core';
import { Chip, VerdictChip, verdictFromOutcome, cn, type StageId } from '@/design';
import type { Section } from '@aifit/platform';
import { SECTIONS, allows, type AssessmentView } from '@/server/assessment-view';
import { StageNav } from './stage-nav';

const STAGE_HOME: Record<Exclude<StageId, 'understand'>, Section> = {
  decide: 'verdict',
  configure: 'architecture',
  validate: 'governance',
  improve: 'roadmap',
};

/** Header, stage rail and section navigation shared by every assessment screen. */
export function AssessmentChrome({ view, section, children }: { view: AssessmentView; section: Section; children: React.ReactNode }) {
  const current = SECTIONS.find((s) => s.id === section)!;
  const saved = view.source.kind === 'saved' ? view.source.record : null;
  const hrefs: Record<StageId, string> = {
    understand: view.intakeHref,
    decide: view.href(STAGE_HOME.decide),
    configure: view.href(STAGE_HOME.configure),
    validate: view.href(STAGE_HOME.validate),
    improve: view.href(STAGE_HOME.improve),
  };
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-body-sm text-fg-muted">
          {saved ? (
            <>
              <Link href="/workspace/portfolio" className="underline underline-offset-2">Portfolio</Link> / saved assessment
            </>
          ) : (
            <>Assessment from a link · nothing is stored</>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <VerdictChip verdict={verdictFromOutcome(view.decision.outcome)} size="md" />
          <Chip>{OUTCOME_LABEL[view.decision.outcome]}</Chip>
          {saved ? <Chip>Version {saved.version}</Chip> : null}
          <Chip>{view.a.trust.calibrated ? 'Calibrated against telemetry' : 'Uncalibrated'}</Chip>
        </div>
        <p className="text-title-md text-fg">{view.workload.name}</p>
      </div>
      <StageNav current={current.stage} hrefs={hrefs} />
      <nav aria-label="Assessment sections" className="-mx-1 overflow-x-auto print:hidden">
        <ul className="flex min-w-max gap-1 border-b border-line px-1">
          {SECTIONS.map((s) => {
            const open = allows(view, s.id);
            const active = s.id === section;
            return (
              <li key={s.id}>
                <Link
                  href={view.href(s.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    '-mb-px inline-flex min-h-10 items-center gap-1.5 border-b-2 px-2.5 text-label-md transition-colors',
                    active ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
                  )}
                >
                  {s.label}
                  {!open ? (
                    <>
                      <Lock size={12} aria-hidden />
                      <span className="sr-only">(locked)</span>
                    </>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div>{children}</div>
    </div>
  );
}
