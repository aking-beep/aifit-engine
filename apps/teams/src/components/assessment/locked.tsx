import Link from 'next/link';
import { Lock } from 'lucide-react';
import { SECTION_LEVEL, can, type Section } from '@aifit/platform';
import { Panel, planById, formatPlanPrice } from '@/design';
import type { AssessmentView } from '@/server/assessment-view';
import { CheckoutButton } from '@/components/workspace/controls';
import { SECONDARY } from '@/components/workspace/ui';

const LEVEL_PLAN = { assessment: 'teams-assessment', blueprint: 'teams-blueprint' } as const;

/**
 * A section this viewer has not unlocked. Nothing of the section is sent:
 * the server renders this panel instead. Prices come from plan configuration;
 * the purchase itself is a Stripe-hosted Checkout, granted only by webhook.
 */
export function LockedSection({ view, section }: { view: AssessmentView; section: Section }) {
  const need = SECTION_LEVEL[section] as 'assessment' | 'blueprint';
  const plan = planById(LEVEL_PLAN[need])!;
  const price = formatPlanPrice(plan);
  const saved = view.source.kind === 'saved' ? view.source.record : null;
  const mayBuy = saved && view.viewer && can(view.viewer.ctx.role, 'export:download');
  return (
    <Panel className="p-6">
      <div className="flex items-start gap-3">
        <Lock size={18} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden />
        <div className="min-w-0 space-y-3">
          <h2 className="text-headline-md text-fg">Included with {plan.name}</h2>
          <p className="text-body-md text-fg-2">
            {plan.tagline} {price.amount} {price.suffix}, or every assessment with the Workspace plan.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-body-sm text-fg-2">
            {plan.features.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <p className="text-body-sm text-fg-muted">{view.levelReason}</p>
          <div className="flex flex-wrap gap-2">
            {mayBuy ? (
              <>
                <CheckoutButton product={need} assessmentId={saved!.id} label={`Buy ${plan.name.toLowerCase()} for this workload`} />
                <Link href="/workspace/billing" className={SECONDARY}>See plans</Link>
              </>
            ) : saved ? (
              <p className="text-body-sm text-fg-muted">Ask a workspace member or admin to buy it; viewers cannot make purchases.</p>
            ) : (
              <Link href={view.href('verdict')} className={SECONDARY}>Save this assessment to a workspace first</Link>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
