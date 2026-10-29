"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button, EvidenceLabel, PageHeader, Tabs, useToast } from "@/design";
import { Loading, LoadError, NoProfile, UpgradeNote, category, pct } from "@/components/app/bits";
import { useLoad } from "@/components/app/use-load";
import { account, AccountApiError } from "@/lib/account";

export default function Tools() {
  const toast = useToast();
  const { data, error, loading, setData } = useLoad(() => Promise.all([account.profile(), account.saved()]));
  const [cat, setCat] = useState("all");
  if (loading) return <Loading label="Loading recommendations" />;
  if (error || !data) return <LoadError message={error ?? "No data."} />;
  const [profile, saved] = data;
  if (!profile.entry) return <><PageHeader title="Recommended tools" /><NoProfile /></>;
  const products = profile.entry.result.products;
  const cats = Array.from(new Set(products.map((p) => category(p))));
  const shown = cat === "all" ? products : products.filter((p) => category(p) === cat);
  const savedFor = (id: string) => saved.items.find((s) => s.kind === "tool" && s.ref === id);

  const toggle = async (id: string, name: string) => {
    const existing = savedFor(id);
    try {
      if (existing) {
        await account.unsave(existing.id);
        setData([profile, { ...saved, items: saved.items.filter((s) => s.id !== existing.id) }]);
      } else {
        const row = await account.save({ kind: "tool", ref: id, label: name });
        setData([profile, { ...saved, items: [row, ...saved.items] }]);
        toast({ title: `Saved ${name}`, tone: "success" });
      }
    } catch (err) {
      toast({ title: "Could not save", body: err instanceof AccountApiError ? err.message : undefined, tone: "warn" });
    }
  };

  return (
    <div>
      <PageHeader title="Recommended tools" description="Ranked by how well each tool's registry profile matches your quiz answers. Fit is a recommendation, not a measurement." />
      <Tabs className="mb-6" value={cat} onChange={setCat} tabs={[{ value: "all", label: "All", count: products.length }, ...cats.map((c) => ({ value: c, label: c, count: products.filter((p) => category(p) === c).length }))]} />
      <ul className="flex flex-col gap-3">
        {shown.map((t, i) => {
          const isSaved = Boolean(savedFor(t.id));
          return (
            <li key={t.id} className="rounded-md border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-label-sm text-fg-muted">#{products.indexOf(t) + 1} · {category(t)}</p>
                  <h2 className="mt-0.5 text-title-md text-fg">{t.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-data-md text-fg">fit {pct(t.fit)}</span>
                  <Button size="sm" variant="ghost" aria-pressed={isSaved} icon={isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} onClick={() => toggle(t.id, t.name)}>
                    {isSaved ? "Saved" : "Save"}
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-label-sm text-fg-muted">Why it fits</p>
                  <ul className="mt-1 list-disc pl-4 text-body-sm text-fg-2">{(t.positive_factors.length ? t.positive_factors : ["Close match on your strongest dimensions"]).slice(0, 3).map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
                {t.negative_factors.length ? (
                  <div>
                    <p className="text-label-sm text-fg-muted">Watch out for</p>
                    <ul className="mt-1 list-disc pl-4 text-body-sm text-fg-2">{t.negative_factors.slice(0, 3).map((f) => <li key={f}>{f}</li>)}</ul>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-label-sm text-fg-muted">
                <EvidenceLabel kind="recommendation" asOf={t.last_evaluated_at} />
                <span>confidence {pct(t.confidence)}</span>
                {i === 0 && cat === "all" ? <Link href="/app/configure" className="text-accent underline underline-offset-2">Generate setup package</Link> : null}
              </div>
            </li>
          );
        })}
      </ul>
      {profile.entry.result.locked_products ? (
        <div className="mt-6"><UpgradeNote>{profile.entry.result.locked_products} more matches are available on Pro.</UpgradeNote></div>
      ) : null}
    </div>
  );
}
