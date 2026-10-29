import { redirect } from 'next/navigation';
import { can, readOrgProfile } from '@aifit/platform';
import { PageHeader, Panel } from '@/design';
import { EMPTY_PROFILE, OrgProfileForm } from '@/components/workspace/org-profile-form';
import { currentViewer, storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set up your workspace — AI Fit Teams' };

export default async function OnboardingPage() {
  const { store } = storeResolution();
  if (!store) return null;
  const v = await currentViewer();
  if (!v) redirect('/signin?next=/workspace/onboarding');
  const profile = await readOrgProfile(store, v.ctx);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Set up your workspace" description="About three minutes. Every new intake starts from these answers; you can change any of them per workload." />
      <Panel className="p-6">
        <OrgProfileForm name={v.org.name} initial={profile ? { ...EMPTY_PROFILE, ...profile } : EMPTY_PROFILE} canEdit={can(v.ctx.role, 'members:manage')} step={0} onDoneHref="/assess" />
      </Panel>
    </div>
  );
}
