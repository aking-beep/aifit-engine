import Link from 'next/link';
import { redirect } from 'next/navigation';
import { can, readOrgProfile } from '@aifit/platform';
import { PageHeader, Panel, PanelHeader } from '@/design';
import { EMPTY_PROFILE, OrgProfileForm } from '@/components/workspace/org-profile-form';
import { ThemeChoice } from '@/components/workspace/theme-choice';
import { currentViewer, storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings — AI Fit Teams' };

export default async function SettingsPage() {
  const { store } = storeResolution();
  if (!store) return null;
  const v = await currentViewer();
  if (!v) redirect('/signin?next=/workspace/settings');
  const profile = await readOrgProfile(store, v.ctx);
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Workspace profile, your account and display." />
      <Panel>
        <PanelHeader title="Workspace profile" description="Defaults for every new intake in this workspace: data classes, regimes, residency and engineering capacity." />
        <div className="p-4">
          <OrgProfileForm name={v.org.name} initial={profile ? { ...EMPTY_PROFILE, ...profile } : EMPTY_PROFILE} canEdit={can(v.ctx.role, 'members:manage')} />
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Your account" />
        <div className="space-y-2 p-4 text-body-sm text-fg-2">
          <p>{v.user.name} · {v.user.email}</p>
          <p><Link href="/account" className="text-accent underline underline-offset-2">Export your data or delete your account</Link></p>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Display" />
        <div className="p-4"><ThemeChoice /></div>
      </Panel>
      <p className="text-body-sm text-fg-muted">Single sign-on and MFA are not available yet.</p>
    </div>
  );
}
