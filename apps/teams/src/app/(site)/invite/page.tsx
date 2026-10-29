import { InviteAccept } from '@/components/workspace/invite-accept';
import { WorkspacesUnavailable } from '@/components/workspace/unavailable';
import { currentViewer, storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Join a workspace — AI Fit Teams', referrer: 'no-referrer' };

export default async function Invite() {
  const { store, reason } = storeResolution();
  if (!store) return <WorkspacesUnavailable reason={reason} />;
  const v = await currentViewer();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-ink-100">You have been invited to a workspace</h1>
      <InviteAccept signedIn={Boolean(v)} />
    </div>
  );
}
