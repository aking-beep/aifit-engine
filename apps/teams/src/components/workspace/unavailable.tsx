import Link from 'next/link';
import { Panel } from '@/design';

/** Shown wherever a workspace feature is requested on a deployment without a durable store. */
export function WorkspacesUnavailable({ reason }: { reason: string }) {
  return (
    <Panel className="p-6">
      <h1 className="text-headline-md text-fg">Workspaces are switched off on this deployment</h1>
      <p className="mt-2 text-body-md text-fg-2">
        Saving assessments, team members and billing need a durable, shared store, and this deployment has none.
        The assessment itself works without an account:{' '}
        <Link href="/assess" className="text-accent underline underline-offset-2">run one now</Link>.
      </p>
      <p className="mt-3 text-body-sm text-fg-muted">For the operator: {reason}</p>
    </Panel>
  );
}
