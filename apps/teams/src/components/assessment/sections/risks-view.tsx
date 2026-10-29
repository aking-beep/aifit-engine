'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RiskEntry } from '@aifit/deliverables';
import type { RiskItem } from '@/design';
import { Button, Drawer, EvidenceLabel, KeyValue, RiskBadge, RiskMatrix, Select, Tabs, TextArea, TextInput, riskLevelOf, useToast } from '@/design';
import { api } from '@/components/workspace/ui';

type Filter = 'all' | RiskEntry['status'];

/** Matrix filter, status tabs, sorted table and an edit drawer. Edits are saved for saved assessments only. */
export function RisksView({ risks, editable, assessmentId }: { risks: RiskEntry[]; editable: boolean; assessmentId: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [cell, setCell] = useState<[number, number] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<RiskEntry | null>(null);
  const [draft, setDraft] = useState<RiskEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => risks
    .filter((r) => filter === 'all' || r.status === filter)
    .filter((r) => !cell || (r.likelihood === cell[0] && r.impact === cell[1]))
    .sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact), [risks, filter, cell]);

  const count = (s: Filter) => (s === 'all' ? risks.length : risks.filter((r) => r.status === s).length);

  async function save() {
    if (!draft || !assessmentId) return;
    setBusy(true);
    setError(null);
    const res = await api(`/api/assessments/${assessmentId}/risks`, {
      method: 'PATCH',
      body: { riskId: draft.id, edit: { likelihood: draft.likelihood, impact: draft.impact, owner: draft.owner, mitigation: draft.mitigation, status: draft.status } },
    });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? 'Could not save.');
    toast({ title: 'Risk updated', tone: 'success' });
    setOpen(null);
    router.refresh();
  }

  const levelOpts = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        <RiskMatrix risks={risks as unknown as RiskItem[]} selected={cell} onSelect={setCell} />
        <p className="text-body-sm text-fg-muted">Select a cell to filter. Likelihood across, impact up.</p>
      </div>
      <div className="space-y-4">
        <Tabs<Filter>
          variant="segmented"
          value={filter}
          onChange={setFilter}
          tabs={(['all', 'open', 'mitigating', 'accepted', 'closed'] as Filter[]).map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1), count: count(v) }))}
        />
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[640px] text-body-sm">
            <caption className="sr-only">Risks, highest first</caption>
            <thead>
              <tr className="border-b border-line text-left text-label-sm text-fg-muted">
                <th scope="col" className="px-4 py-2 font-medium">Risk</th>
                <th scope="col" className="px-3 py-2 font-medium">Level</th>
                <th scope="col" className="px-3 py-2 font-medium">L × I</th>
                <th scope="col" className="px-3 py-2 font-medium">Owner</th>
                <th scope="col" className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">
                    <button type="button" className="text-left text-fg underline-offset-2 hover:underline" onClick={() => { setOpen(r); setDraft(r); setError(null); }}>
                      <span className="mr-2 font-mono text-label-sm text-fg-muted">{r.id}</span>{r.title}
                    </button>
                  </td>
                  <td className="px-3 py-2"><RiskBadge level={riskLevelOf(r as unknown as RiskItem)} /></td>
                  <td className="px-3 py-2 font-mono tabular text-fg-2">{r.likelihood} × {r.impact}</td>
                  <td className="px-3 py-2 text-fg-2">{r.owner || <span className="text-fg-muted">unassigned</span>}</td>
                  <td className="px-4 py-2 text-fg-2">{r.status}</td>
                </tr>
              ))}
              {shown.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-fg-muted">No risks match this filter.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `${open.id} · ${open.category}` : ''}
        footer={editable && assessmentId ? <Button variant="primary" onClick={save} loading={busy}>Save</Button> : undefined}
      >
        {open && draft ? (
          <div className="space-y-4">
            <p className="text-body-md text-fg">{open.title}</p>
            <dl>
              <KeyValue label="Evidence"><EvidenceLabel kind={open.evidence} /></KeyValue>
              <KeyValue label="Why it is here">{open.source}</KeyValue>
            </dl>
            {editable && assessmentId ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Likelihood" value={String(draft.likelihood)} options={levelOpts} onChange={(e) => setDraft({ ...draft, likelihood: Number(e.target.value) })} />
                  <Select label="Impact" value={String(draft.impact)} options={levelOpts} onChange={(e) => setDraft({ ...draft, impact: Number(e.target.value) })} />
                </div>
                <Select label="Status" value={draft.status} options={['open', 'mitigating', 'accepted', 'closed'].map((s) => ({ value: s, label: s }))} onChange={(e) => setDraft({ ...draft, status: e.target.value as RiskEntry['status'] })} />
                <TextInput label="Owner" value={draft.owner} maxLength={120} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} />
                <TextArea label="Mitigation" value={draft.mitigation} maxLength={1000} rows={4} onChange={(e) => setDraft({ ...draft, mitigation: e.target.value })} />
                {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
              </div>
            ) : (
              <p className="text-body-sm text-fg-muted">{assessmentId ? 'Viewers can read the register but not edit it.' : 'Save this assessment to a workspace to assign owners and track status.'} Mitigation: {open.mitigation}</p>
            )}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
