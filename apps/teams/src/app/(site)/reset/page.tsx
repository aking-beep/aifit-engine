import { ResetForm } from '@/components/workspace/reset-form';
import { WorkspacesUnavailable } from '@/components/workspace/unavailable';
import { email } from '@/server/email';
import { storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset password — AI Fit Teams', robots: { index: false } };

/** The reset token rides in the URL fragment (#token=), so it never reaches this server or its logs. */
export default function Reset() {
  const { store, reason } = storeResolution();
  if (!store) return <WorkspacesUnavailable reason={reason} />;
  return <ResetForm emailEnabled={email().enabled} />;
}
