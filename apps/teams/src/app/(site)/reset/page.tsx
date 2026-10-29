import { ResetForm } from '@/components/workspace/reset-form';
import { WorkspacesUnavailable } from '@/components/workspace/unavailable';
import { email } from '@/server/email';
import { storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset password — AI Fit Teams', robots: { index: false } };

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const raw = (await searchParams).token;
  const token = raw && /^[A-Za-z0-9_-]{20,200}$/.test(raw) ? raw : null;
  const { store, reason } = storeResolution();
  if (!store) return <WorkspacesUnavailable reason={reason} />;
  const mail = email();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-fg">{token ? 'Choose a new password' : 'Reset your password'}</h1>
      {!token && !mail.enabled ? (
        <p className="max-w-2xl text-sm text-fg-2">Password reset by email is not set up on this deployment yet. Contact the workspace owner or support.</p>
      ) : (
        <>
          {!token ? <p className="max-w-2xl text-sm text-fg-2">We email a link that works once, for 30 minutes.</p> : null}
          <ResetForm token={token} />
        </>
      )}
    </div>
  );
}
