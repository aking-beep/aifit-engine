import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AuthForm } from '@/components/workspace/auth-form';
import { WorkspacesUnavailable } from '@/components/workspace/unavailable';
import { currentViewer, storeResolution } from '@/server/platform';
import { safeNext } from '@/server/next-path';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create an account — AI Fit Teams' };

export default async function SignUp({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const { store, reason } = storeResolution();
  if (!store) return <WorkspacesUnavailable reason={reason} />;
  if (await currentViewer()) redirect(next);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-ink-100">Create a team workspace</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-300">
        Your workspace keeps saved assessments, their versions and your team. Only people you invite can see it. See{' '}
        <Link href="/privacy" className="text-signal underline underline-offset-2">what is stored</Link>.
      </p>
      <AuthForm mode="signup" next={next} />
    </div>
  );
}
