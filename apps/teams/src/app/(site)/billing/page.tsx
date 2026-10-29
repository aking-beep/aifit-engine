import { redirect } from 'next/navigation';
import { BillingStatus } from '@/components/workspace/billing-status';
import { WorkspacesUnavailable } from '@/components/workspace/unavailable';
import { currentViewer, storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Billing — AI Fit Teams' };

export default async function Billing({ searchParams }: { searchParams: Promise<{ status?: string; session_id?: string }> }) {
  const { store, reason } = storeResolution();
  if (!store) return <WorkspacesUnavailable reason={reason} />;
  if (!(await currentViewer())) redirect('/signin?next=/workspace');
  const { status, session_id } = await searchParams;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-fg">Billing</h1>
      <BillingStatus status={status ?? null} sessionId={typeof session_id === 'string' && /^cs_[A-Za-z0-9_]+$/.test(session_id) ? session_id : null} />
    </div>
  );
}
