import { redirect } from 'next/navigation';
import Link from 'next/link';
import { can } from '@aifit/platform';
import { EmptyState, PageHeader } from '@/design';
import { PortfolioTable } from '@/components/workspace/portfolio-table';
import { currentViewer, storeResolution } from '@/server/platform';
import { portfolio } from '@/server/portfolio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Portfolio — AI Fit Teams' };

export default async function PortfolioPage() {
  const { store } = storeResolution();
  if (!store) return null;
  const v = await currentViewer();
  if (!v) redirect('/signin?next=/workspace/portfolio');
  const rows = await portfolio(store, v.ctx);
  return (
    <div>
      <PageHeader title="Portfolio" description="The latest version of every saved workload. Select one for its summary." actions={can(v.ctx.role, 'assessment:write') ? <Link href="/assess" className="inline-flex h-9 items-center rounded-sm border border-line-strong px-3.5 text-label-md text-fg hover:bg-sunken">New intake</Link> : undefined} />
      {rows.length ? <PortfolioTable rows={rows} /> : <EmptyState title="No workloads yet" description="Assess a workload and save it to this workspace." />}
    </div>
  );
}
