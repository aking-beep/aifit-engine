import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OUTCOME_LABEL } from '@aifit/decision-core';
import { listAssessments, versions } from '@aifit/platform';
import { EmptyState, PageHeader, Panel, VerdictChip, verdictFromOutcome, type EngineOutcome } from '@/design';
import { currentViewer, storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'History — AI Fit Teams' };

/** Every version of every saved assessment, newest first, with what the engines said at the time. */
export default async function HistoryPage() {
  const { store } = storeResolution();
  if (!store) return null;
  const v = await currentViewer();
  if (!v) redirect('/signin?next=/workspace/history');
  const latest = await listAssessments(store, v.ctx);
  const all = (await Promise.all(latest.map((a) => versions(store, v.ctx, a.rootId)))).flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestIds = new Set(latest.map((a) => a.id));
  return (
    <div>
      <PageHeader title="Assessment history" description="Each version keeps the snapshot of what the engines said when it was saved, so a later rules change never rewrites history." />
      {all.length === 0 ? <EmptyState title="No history yet" description="Saved assessments and their versions appear here." /> : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-body-sm">
              <caption className="sr-only">Assessment versions</caption>
              <thead>
                <tr className="border-b border-line text-left text-label-sm text-fg-muted">
                  <th scope="col" className="px-4 py-2 font-medium">Assessment</th>
                  <th scope="col" className="px-3 py-2 font-medium">Version</th>
                  <th scope="col" className="px-3 py-2 font-medium">Recommendation then</th>
                  <th scope="col" className="px-3 py-2 font-medium">Engine</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 font-medium">Saved</th>
                </tr>
              </thead>
              <tbody>
                {all.map((h) => (
                  <tr key={h.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2"><Link href={`/workspace/assessments/${h.id}`} className="text-fg underline-offset-2 hover:underline">{h.title}</Link></td>
                    <td className="px-3 py-2 font-mono text-fg-2">v{h.version}</td>
                    <td className="px-3 py-2"><span className="inline-flex items-center gap-2"><VerdictChip verdict={verdictFromOutcome(h.snapshot.outcome as EngineOutcome)} />{OUTCOME_LABEL[h.snapshot.outcome as EngineOutcome] ?? h.snapshot.outcome}</span></td>
                    <td className="px-3 py-2 font-mono text-label-sm text-fg-muted">{h.snapshot.engines.decisionRules ?? '?'}</td>
                    <td className="px-3 py-2 text-fg-2">{latestIds.has(h.id) ? 'Current' : 'Superseded'}</td>
                    <td className="px-4 py-2 text-fg-muted"><time dateTime={h.createdAt}>{h.createdAt.slice(0, 10)}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
