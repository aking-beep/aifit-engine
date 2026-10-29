"use client";

import Link from "next/link";
import { Banner, EvidenceLabel, PageHeader, Panel, PanelHeader, VerdictChip, type Verdict } from "@/design";
import { Loading, LoadError, date } from "@/components/app/bits";
import { useLoad } from "@/components/app/use-load";
import { account, type HistoryItem } from "@/lib/account";
import { OUTCOME_LABEL, type Outcome } from "@/lib/decision-types";

const VERDICT: Record<Outcome, Verdict> = {
  no_change: "no-ai",
  conventional_software: "software",
  conventional_automation: "automation",
  buy_ai: "buy",
  build_ai: "build",
};

/** How you work with AI (from the quiz) and each task you checked, including the ones where AI is not the answer. */
export default function Workflows() {
  const { data, error, loading } = useLoad(() => account.history());
  if (loading) return <Loading label="Loading workflows" />;
  if (error || !data) return <LoadError message={error ?? "No data."} />;
  const quiz = data.items.find((i) => i.source === "quiz");
  const checks = data.items.filter((i): i is Extract<HistoryItem, { source: "check" }> => i.source === "check");
  const steps = quiz?.source === "quiz" ? quiz.result.workflow ?? [] : [];
  return (
    <div className="space-y-8">
      <PageHeader
        title="Workflow recommendations"
        description="How your tools fit together, and a decision for each task you checked — including where no AI is the better call."
        actions={<Link href="/check" className="inline-flex h-9 items-center rounded-sm bg-accent px-3.5 text-label-md text-on-accent">Check a task</Link>}
      />
      {steps.length ? (
        <Panel>
          <PanelHeader title="A simple way to work" description="From your quiz profile." actions={<EvidenceLabel kind="recommendation" />} />
          <ol className="divide-y divide-line">
            {steps.map((s, i) => (
              <li key={s.id} className="flex gap-3 p-4">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sunken font-mono text-label-sm text-fg-muted">{i + 1}</span>
                <div>
                  <p className={s.emphasis ? "text-label-md text-fg" : "text-label-md text-fg-2"}>{s.label}</p>
                  <p className="text-body-sm text-fg-muted">{s.instruction}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      ) : (
        <Banner tone="info" title="No quiz profile yet" action={<Link href="/assessment?save=account" className="text-label-md underline">Take the quiz</Link>}>Your working pattern comes from the quiz.</Banner>
      )}

      <section aria-labelledby="checked-h">
        <h2 id="checked-h" className="mb-3 text-headline-md text-fg">Tasks you checked</h2>
        {checks.length === 0 ? (
          <p className="text-body-sm text-fg-muted">Run the task check and choose “Save to my account”. Each one gets a decision from fixed, published rules.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {checks.map((c) => {
              const d = c.result.decision;
              return (
                <li key={c.id} className="rounded-md border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-title-md text-fg">{c.label}</h3>
                    <span className="flex items-center gap-2"><VerdictChip verdict={VERDICT[d.outcome]} /><span className="text-body-sm text-fg-2">{OUTCOME_LABEL[d.outcome]}</span></span>
                  </div>
                  <p className="mt-2 text-body-sm text-fg-2">{d.summary}</p>
                  {c.result.tools.matches.length ? (
                    <p className="mt-2 text-body-sm text-fg-muted">Tools that fit: {c.result.tools.matches.slice(0, 3).map((m) => m.name).join(", ")}</p>
                  ) : null}
                  <p className="mt-2 text-label-sm text-fg-muted">Checked {date(c.saved_at)} · rules {d.engine.rulesVersion}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
