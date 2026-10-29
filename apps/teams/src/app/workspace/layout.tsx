import { SiteHeader } from '@/components/site-header';
import { WorkspaceShell } from '@/components/workspace/shell';
import { WorkspacesUnavailable } from '@/components/workspace/unavailable';
import { currentViewer, storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';

/**
 * Signed-in workspace chrome. Each page still checks the session itself (and
 * redirects to sign-in with its own path), so this layout never decides access.
 */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { store, reason } = storeResolution();
  if (!store) {
    return (
      <>
        <SiteHeader controlUrl={process.env.ARK_CONTROL_URL ?? 'http://localhost:3002'} account={null} />
        <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 outline-none">
          <WorkspacesUnavailable reason={reason} />
        </main>
      </>
    );
  }
  const v = await currentViewer();
  if (!v) return <main id="main" className="mx-auto max-w-3xl px-4 py-10">{children}</main>;
  return (
    <WorkspaceShell user={{ name: v.user.name, email: v.user.email }} org={{ id: v.org.id, name: v.org.name, role: v.ctx.role }} orgs={v.orgs.map((o) => ({ id: o.id, name: o.name, role: o.role }))}>
      {children}
    </WorkspaceShell>
  );
}
