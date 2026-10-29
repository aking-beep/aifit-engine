import { redirect } from 'next/navigation';
import { can, listMembers, readAudit } from '@aifit/platform';
import { PageHeader, Panel, PanelHeader } from '@/design';
import { MembersPanel } from '@/components/workspace/members';
import { currentViewer, storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Members — AI Fit Teams' };

export default async function AdminPage() {
  const { store } = storeResolution();
  if (!store) return null;
  const v = await currentViewer();
  if (!v) redirect('/signin?next=/workspace/admin');
  const members = await listMembers(store, v.ctx);
  const auditRows = can(v.ctx.role, 'audit:read') ? await readAudit(store, v.ctx, 100) : null;
  return (
    <div className="space-y-8">
      <PageHeader title="Members and roles" description={`${members.length} member${members.length === 1 ? '' : 's'}. Only members of this workspace can see its assessments.`} />
      <Panel>
        <PanelHeader title="Team" description="Owners and admins manage members. Viewers read; members assess and download; admins also manage billing." />
        <div className="p-4">
          <MembersPanel members={members} canManage={can(v.ctx.role, 'members:manage')} selfId={v.user.id} />
        </div>
      </Panel>
      {auditRows ? (
        <Panel>
          <PanelHeader title="Audit log" description="Saves, exports, membership and billing changes. Visible to admins and owners." />
          {auditRows.length === 0 ? <p className="p-4 text-body-sm text-fg-2">No activity yet.</p> : (
            <ul className="divide-y divide-line">
              {auditRows.map((r, i) => (
                <li key={i} className="flex flex-wrap gap-x-3 px-4 py-2 text-body-sm">
                  <time dateTime={r.at} className="font-mono text-label-sm text-fg-muted">{r.at.slice(0, 16).replace('T', ' ')}</time>
                  <span className="text-fg">{r.event}</span>
                  <span className="text-fg-muted">{r.actor === 'stripe' ? 'Stripe' : 'member'}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : <p className="text-body-sm text-fg-muted">The audit log is visible to admins and owners.</p>}
    </div>
  );
}
