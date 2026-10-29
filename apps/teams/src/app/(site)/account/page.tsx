import { redirect } from 'next/navigation';
import { Panel } from '@aifit/ui';
import { AccountActions } from '@/components/workspace/account-actions';
import { WorkspacesUnavailable } from '@/components/workspace/unavailable';
import { currentViewer, storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Account — AI Fit Teams' };

export default async function Account() {
  const { store, reason } = storeResolution();
  if (!store) return <WorkspacesUnavailable reason={reason} />;
  const v = await currentViewer();
  if (!v) redirect('/signin?next=/account');
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-ink-100">Your account</h1>
      <Panel title={v.user.name} subtitle={v.user.email}>
        <AccountActions email={v.user.email} />
      </Panel>
    </div>
  );
}
