import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { ARC_LINKS } from '@/lib/arc';
import { currentViewer, workspacesEnabled } from '@/server/platform';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const viewer = workspacesEnabled() ? await currentViewer().catch(() => null) : null;
  return (
    <>
      <SiteHeader controlUrl={process.env.ARK_CONTROL_URL ?? 'http://localhost:3002'} account={workspacesEnabled() ? (viewer ? 'workspace' : 'signin') : null} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10 outline-none sm:px-6">
        {children}
      </main>
      <footer className="mx-auto max-w-6xl border-t border-line px-4 py-8 text-body-sm text-fg-muted sm:px-6">
        <p>
          Without an account nothing you enter is stored: the intake is encoded into the report link and the
          assessment is recalculated each time it is opened. Saving to a workspace stores it for your team; see{' '}
          <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>. Every figure carries a tag saying what it rests on.
        </p>
        <nav aria-label="Footer" className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/for/operations" className="underline-offset-2 hover:underline">For operations</Link>
          <Link href="/for/it-security" className="underline-offset-2 hover:underline">For IT and security</Link>
          <Link href="/for/small-business" className="underline-offset-2 hover:underline">For small businesses</Link>
          <Link href="/terms" className="underline-offset-2 hover:underline">Terms</Link>
          <Link href="/refunds" className="underline-offset-2 hover:underline">Refunds</Link>
          <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
          <a href={ARC_LINKS.site} className="underline-offset-2 hover:underline">ARC Transformation Group</a>
        </nav>
        <p className="mt-3">From AI uncertainty to a validated implementation plan · ARC Transformation Group</p>
      </footer>
    </>
  );
}
