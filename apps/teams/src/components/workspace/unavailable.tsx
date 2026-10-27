import { Panel } from '@aifit/ui';
import Link from 'next/link';

/** Shown wherever a workspace feature is requested on a deployment without a durable store. */
export function WorkspacesUnavailable({ reason }: { reason: string }) {
  return (
    <Panel title="Workspaces are switched off on this deployment">
      <p className="text-sm leading-relaxed text-ink-300">
        Saving assessments, team members and billing need a durable, shared store, and this deployment has none.
        The assessment itself works without an account:{' '}
        <Link href="/assess" className="text-signal underline underline-offset-2">
          run one now
        </Link>
        .
      </p>
      <p className="mt-3 text-xs leading-relaxed text-ink-400">For the operator: {reason}</p>
    </Panel>
  );
}
