import { Badge, Callout, Panel } from '@aifit/ui';
import { OUTCOME_LABEL, type DecisionResult } from '@aifit/decision-core';
import type { Verdict } from '@aifit/teams-core';

/**
 * Build, buy, automate — or leave it. Rendered from @aifit/decision-core; this
 * component decides nothing. It also says when the option comparison and the
 * suitability verdict disagree, rather than hiding one of them.
 */
export function DecisionSection({ d, verdict }: { d: DecisionResult; verdict: Verdict }) {
  const ai = d.outcome === 'buy_ai' || d.outcome === 'build_ai';
  const disagree = (verdict === 'not-ai' && ai) || ((verdict === 'automate' || verdict === 'automate-bounded') && !ai);
  const max = Math.max(...d.outcomeScores.map((o) => o.score), 1);
  const triggered = d.hardConstraints.filter((h) => h.triggered);
  const missing = d.missingInputs.filter((m) => m !== 'hourlyValueUsd');
  return (
    <Panel
      title="Build, buy, or automate?"
      subtitle="Five options compared with fixed, published rules (decision-rules.v1). Scores compare the options with each other; they are not probabilities."
      right={<span className="font-mono">{d.engine.rulesVersion}</span>}
    >
      <div className="space-y-5" data-testid="decision-section">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold text-ink-100" data-outcome={d.outcome}>{OUTCOME_LABEL[d.outcome]}</p>
          <Badge tone="neutral">confidence {d.confidence}</Badge>
        </div>
        <p className="text-sm leading-relaxed text-ink-300">{d.summary}</p>
        {disagree ? (
          <Callout tone="warn" title="The option comparison and the verdict disagree">
            {verdict === 'not-ai'
              ? 'The suitability rubric says not to use a model, but the option comparison favours an AI option. The rubric weighs task shape and correctness more heavily; resolve the blockers before buying or building.'
              : 'The suitability rubric rates this a strong AI candidate, but the comparison favours a non-AI option, usually because of budget, capacity or volume. Read both before committing.'}
          </Callout>
        ) : null}
        <ul className="space-y-2" aria-label="Options compared">
          {d.outcomeScores.map((o) => (
            <li key={o.outcome}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={o.outcome === d.outcome ? 'font-medium text-ink-100' : 'text-ink-300'}>{OUTCOME_LABEL[o.outcome]}</span>
                <span className="font-mono text-xs text-ink-400">{o.eligible ? o.score : `ruled out: ${o.excludedBy.join(', ')}`}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-ink-800" aria-hidden>
                <div className={'h-1.5 rounded-full ' + (o.eligible ? (o.outcome === d.outcome ? 'bg-signal' : 'bg-ink-500') : 'bg-ink-700')} style={{ width: `${Math.max(2, (o.score / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
        {triggered.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-ink-200">Hard rules that applied</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink-300">
              {triggered.map((h) => (
                <li key={h.id}><span className="font-mono text-ink-400">{h.id}</span> {h.detail}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {d.whatWouldChange.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-ink-200">What would change the answer</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink-300">
              {d.whatWouldChange.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        ) : null}
        {missing.length > 0 ? (
          <p className="text-xs text-ink-400">
            Not supplied, so not weighed: {missing.map((m) => ({ monthlyBudgetUsd: 'monthly budget', timelineWeeks: 'timeline', minutesPerOccurrence: 'minutes per unit today', frequencyPerMonth: 'volume' }[m] ?? m)).join(', ')}.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
