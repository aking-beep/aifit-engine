import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/workspace/auth-form';
import { WorkspacesUnavailable } from '@/components/workspace/unavailable';
import { currentViewer, storeResolution } from '@/server/platform';
import { safeNext } from '@/server/next-path';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in — AI Fit Teams' };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const { store, reason } = storeResolution();
  if (!store) return <WorkspacesUnavailable reason={reason} />;
  if (await currentViewer()) redirect(next);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-fg">Sign in</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-fg-2">
        An account is only needed to save assessments, work with your team, and download blueprints. Running an
        assessment never needs one.
      </p>
      <AuthForm mode="signin" next={next} />
    </div>
  );
}
