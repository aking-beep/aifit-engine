"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button, EmptyState, PageHeader, VerdictChip, useToast } from "@/design";
import { Loading, LoadError, UpgradeNote, date } from "@/components/app/bits";
import { useLoad } from "@/components/app/use-load";
import { account } from "@/lib/account";
import { OUTCOME_LABEL } from "@/lib/decision-types";

export default function History() {
  const toast = useToast();
  const { data, error, loading, setData } = useLoad(() => account.history());
  if (loading) return <Loading label="Loading history" />;
  if (error || !data) return <LoadError message={error ?? "No data."} />;
  const remove = async (id: string) => {
    await account.deleteHistory(id).catch(() => toast({ title: "Could not delete", tone: "warn" }));
    setData({ ...data, items: data.items.filter((i) => i.id !== id) });
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Assessment history" description="Every quiz and task check saved to this account, newest first." />
      {data.hidden_older ? <UpgradeNote>{data.hidden_older} older {data.hidden_older === 1 ? "entry is" : "entries are"} kept but hidden on the Free plan ({data.limits.history_days} days).</UpgradeNote> : null}
      {data.items.length === 0 ? (
        <EmptyState title="Nothing saved yet" description="Take the quiz or check a task, then choose Save to my account." action={<Link href="/assessment?save=account" className="text-label-md text-accent underline underline-offset-2">Take the quiz</Link>} />
      ) : (
        <ul className="overflow-hidden rounded-md border border-line bg-surface">
          {data.items.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
              <div className="min-w-0">
                <p className="text-label-md text-fg">{h.label}</p>
                <p className="text-body-sm text-fg-muted">{h.source === "quiz" ? "Quiz" : "Task check"} · <time dateTime={h.saved_at}>{date(h.saved_at)}</time></p>
              </div>
              <div className="flex items-center gap-3">
                {h.source === "check" ? <span className="flex items-center gap-2"><VerdictChip verdict={h.result.decision.outcome === "no_change" ? "no-ai" : h.result.decision.outcome === "conventional_software" ? "software" : h.result.decision.outcome === "conventional_automation" ? "automation" : h.result.decision.outcome === "buy_ai" ? "buy" : "build"} /><span className="text-body-sm text-fg-2">{OUTCOME_LABEL[h.result.decision.outcome]}</span></span> : <span className="text-body-sm text-fg-2">{h.result.workstyle?.label ?? h.result.persona.label}</span>}
                <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} aria-label={`Delete ${h.label}`} onClick={() => remove(h.id)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-body-sm text-fg-muted">Results you ran without signing in stay in this browser only: <Link href="/history" className="underline underline-offset-2">browser history</Link>.</p>
    </div>
  );
}
