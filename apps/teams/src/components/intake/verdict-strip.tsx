'use client';

import type { ProvisionalVerdict } from '@/lib/intake-verdict';

/**
 * The provisional verdict, above the form from "The job" onwards.
 *
 * Neutral colours on purpose: this is a statement about the shape of the work,
 * not a figure, and it must not look like a result the later sections earned.
 * The only decided case offers the report straight away; "Continue the full assessment"
 * shrinks the strip but never hides it, because the verdict does not change.
 */
export function VerdictStrip({
  verdict, compact, canShortCircuit, onReportNow, onContinue,
}: {
  verdict: ProvisionalVerdict;
  compact: boolean;
  /** False until the job has a name; the report needs one to title itself. */
  canShortCircuit: boolean;
  onReportNow: () => void;
  onContinue: () => void;
}) {
  const decided = verdict.kind === 'not-ai';
  return (
    <section
      aria-label="Provisional verdict"
      aria-live="polite"
      className={
        'mb-8 rounded-xl border bg-raised ' +
        (decided ? 'border-line-strong' : 'border-line') +
        (compact ? ' px-4 py-3' : ' p-5')
      }
    >
      <p className="font-mono text-2xs uppercase tracking-widest text-fg-muted">
        {decided ? 'Verdict · decided by the shape of the work' : 'Provisional verdict · not decided yet'}
      </p>
      <p className={'mt-1 font-medium text-fg ' + (compact ? 'text-sm' : 'text-base')}>{verdict.title}</p>
      {!compact && <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-fg-2">{verdict.body}</p>}
      {decided && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={onReportNow}
            aria-disabled={!canShortCircuit}
            aria-describedby={canShortCircuit ? undefined : 'verdict-needs-name'}
            className={
              'inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-medium transition ' +
              (canShortCircuit
                ? 'bg-accent text-on-accent hover:bg-accent/90'
                : 'cursor-not-allowed bg-line text-fg-2')
            }
          >
            See the report now
          </button>
          {!compact && (
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex min-h-10 items-center px-1 text-sm text-fg-2 transition hover:text-fg"
            >
              Continue the full assessment
            </button>
          )}
          {!canShortCircuit && (
            <p id="verdict-needs-name" className="text-2xs text-fg-2">
              Name the job first; the report is titled with it.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
