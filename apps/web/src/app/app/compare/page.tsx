"use client";

import { useState } from "react";
import { Button, ChoiceGroup, PageHeader } from "@/design";
import { useAccount } from "@/components/app/account-context";
import { Loading, LoadError, NoProfile, UpgradeNote } from "@/components/app/bits";
import { useLoad } from "@/components/app/use-load";
import { account, AccountApiError } from "@/lib/account";

type Rec = Record<string, unknown> & { id: string; name: string };
const list = (v: unknown) => (Array.isArray(v) && v.length ? v.join(", ").replace(/_/g, " ") : "—");
const ROWS: { label: string; get: (r: Rec) => React.ReactNode }[] = [
  { label: "Provider", get: (r) => String(r.provider ?? "—") },
  { label: "Category", get: (r) => String(r.category ?? "—").replace(/_/g, " ") },
  { label: "Pricing tier", get: (r) => String(r.pricing_tier ?? "—") },
  { label: "Runs", get: (r) => list(r.deployment) },
  { label: "Inputs", get: (r) => list(r.modalities) },
  { label: "Good at", get: (r) => list(r.capabilities) },
  { label: "Integrations", get: (r) => list(r.integrations) },
  { label: "Last reviewed", get: (r) => <span className="font-mono">{String(r.last_evaluated_at ?? "—")}</span> },
  {
    label: "Sources",
    get: (r) => {
      const ev = Array.isArray(r.evidence) ? (r.evidence as { title?: string; url?: string }[]) : [];
      return ev.length ? (
        <ul className="space-y-1">{ev.slice(0, 2).map((e) => <li key={e.url}><a href={e.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{e.title ?? e.url}</a></li>)}</ul>
      ) : "—";
    },
  },
];

/** Registry facts side by side. Prices are tiers from the registry, never invented amounts. */
export default function Compare() {
  const { me } = useAccount();
  const cap = me.account.limits.compare_tools;
  const { data, error, loading } = useLoad(() => account.profile());
  const [picked, setPicked] = useState<string[]>([]);
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading label="Loading tools" />;
  if (error || !data) return <LoadError message={error ?? "No data."} />;
  if (!data.entry) return <><PageHeader title="Compare tools" /><NoProfile /></>;
  const products = data.entry.result.products;

  const run = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setRows((await account.compare(picked)).items as Rec[]);
    } catch (err) {
      setProblem(err instanceof AccountApiError ? err.message : "Could not compare.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Compare tools" description="Facts from the tool registry, each with its source and review date." />
      <ChoiceGroup
        label="Tools to compare"
        multiple
        columns={2}
        value={picked}
        onChange={(v) => setPicked(cap ? v.slice(-cap) : v)}
        options={products.map((p) => ({ value: p.id, label: p.name }))}
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={picked.length < 2} loading={busy} onClick={run}>Compare {picked.length || ""}</Button>
        {cap ? <span className="text-body-sm text-fg-muted">Free plan: {cap} at a time.</span> : null}
      </div>
      {problem ? <div className="mt-4"><UpgradeNote>{problem}</UpgradeNote></div> : null}
      {rows ? (
        <div className="mt-8 overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[560px] text-left text-body-sm">
            <caption className="sr-only">Tool comparison</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="p-3 text-label-sm text-fg-muted">Fact</th>
                {rows.map((r) => <th key={r.id} scope="col" className="p-3 text-label-md text-fg">{r.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-line last:border-0 align-top">
                  <th scope="row" className="p-3 text-label-sm font-normal text-fg-muted">{row.label}</th>
                  {rows.map((r) => <td key={r.id} className="p-3 text-fg-2">{row.get(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line p-3 text-label-sm text-fg-muted">Each registry entry cites the dated sources above. Check current pricing on the vendor’s site before you buy.</p>
        </div>
      ) : null}
    </div>
  );
}
