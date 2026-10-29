"use client";

import Link from "next/link";
import { Bookmark, Trash2 } from "lucide-react";
import { Button, EmptyState, PageHeader, useToast } from "@/design";
import { Loading, LoadError, date } from "@/components/app/bits";
import { useLoad } from "@/components/app/use-load";
import { account } from "@/lib/account";

export default function Saved() {
  const toast = useToast();
  const { data, error, loading, setData } = useLoad(() => account.saved());
  if (loading) return <Loading label="Loading saved items" />;
  if (error || !data) return <LoadError message={error ?? "No data."} />;
  const remove = async (id: string) => {
    await account.unsave(id).catch(() => toast({ title: "Could not remove", tone: "warn" }));
    setData({ ...data, items: data.items.filter((i) => i.id !== id) });
  };
  return (
    <div>
      <PageHeader title="Saved recommendations" description={`Tools you are considering.${data.limit ? ` Free plan: ${data.items.length} of ${data.limit}.` : ""}`} />
      {data.items.length === 0 ? (
        <EmptyState icon={<Bookmark size={20} strokeWidth={1.5} />} title="Nothing saved yet" description="Save tools from your recommendations to keep a shortlist." action={<Link href="/app/tools" className="text-label-md text-accent underline underline-offset-2">Recommended tools</Link>} />
      ) : (
        <ul className="overflow-hidden rounded-md border border-line bg-surface">
          {data.items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
              <div className="min-w-0">
                <p className="text-label-md text-fg">{s.label}</p>
                <p className="text-body-sm text-fg-muted">{s.kind} · saved {date(s.saved_at)}</p>
              </div>
              <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} aria-label={`Remove ${s.label}`} onClick={() => remove(s.id)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
