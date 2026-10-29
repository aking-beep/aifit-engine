"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EvidenceLabel, PageHeader, Panel, PanelHeader, ProgressBar, StageRail, type StageId } from "@/design";
import { useAccount } from "@/components/app/account-context";
import { Loading, LoadError, NoProfile, category, date, pct } from "@/components/app/bits";
import { useLoad } from "@/components/app/use-load";
import { account } from "@/lib/account";
import { OUTCOME_LABEL } from "@/lib/decision-types";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const { me } = useAccount();
  const { data, error, loading } = useLoad(() => Promise.all([account.history(), account.saved()]));
  if (loading) return <Loading label="Loading your dashboard" />;
  if (error || !data) return <LoadError message={error ?? "No data."} />;
  const [hist, saved] = data;
  const quiz = hist.items.find((i) => i.source === "quiz");
  const checks = hist.items.filter((i) => i.source === "check");
  const packagesUsed = me.account.usage.config_packages_this_month;
  const stage: StageId = !quiz ? "understand" : packagesUsed === 0 ? "configure" : "validate";
  const completed: StageId[] = !quiz ? [] : packagesUsed === 0 ? ["understand", "decide"] : ["understand", "decide", "configure"];
  const first = (me.user.name || "").split(" ")[0];

  return (
    <div>
      <PageHeader
        title={`${greeting()}${first ? `, ${first}` : ""}`}
        description={!quiz ? "Start with the quiz. Everything else here is built from it." : packagesUsed === 0 ? "Your profile is ready. Next: download a setup package for your top tool." : "Setup package downloaded. Check each item in it works as described."}
      />
      <StageRail current={stage} completed={completed} />

      {!quiz ? (
        <div className="mt-8"><NoProfile /></div>
      ) : (
        <>
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Panel>
              <div className="p-6">
                <p className="text-label-sm text-fg-muted">Next recommended action</p>
                {packagesUsed === 0 ? (
                  <>
                    <h2 className="mt-1 text-headline-md text-fg">Set up {quiz.result.primary_stack?.slots?.[0]?.recommendation.name ?? "your top tool"}</h2>
                    <p className="mt-1 text-body-md text-fg-muted">The setup package has instructions and config files written from your profile. Review every file before you use it.</p>
                    <Link href="/app/configure" className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-sm bg-accent px-3.5 text-label-md text-on-accent">Open the generator <ArrowRight size={14} aria-hidden /></Link>
                  </>
                ) : (
                  <>
                    <h2 className="mt-1 text-headline-md text-fg">Check one real task</h2>
                    <p className="mt-1 text-body-md text-fg-muted">Run the task check on something you do every week. Sometimes the honest answer is not AI.</p>
                    <Link href="/check" className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-sm bg-accent px-3.5 text-label-md text-on-accent">Run a task check <ArrowRight size={14} aria-hidden /></Link>
                  </>
                )}
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Your AI profile" actions={<Link href="/app/profile" className="text-label-md text-accent underline underline-offset-2">View</Link>} />
              <div className="p-4">
                <p className="text-headline-md text-fg">{quiz.result.workstyle?.label ?? quiz.result.persona.label}</p>
                <p className="mt-1 text-body-sm text-fg-muted">{quiz.result.workstyle?.summary ?? quiz.result.persona.purpose}</p>
                <dl className="mt-4 flex flex-col gap-2.5">
                  {(quiz.result.workstyle?.dimensions ?? []).slice(0, 4).map((d) => (
                    <div key={d.id} className="grid grid-cols-[1fr_auto] gap-x-2 text-body-sm">
                      <dt className="text-fg-2">{d.label}</dt>
                      <dd className="font-mono text-fg">{Math.round(d.display ?? d.score * 100)}</dd>
                      <dd className="col-span-2"><ProgressBar value={d.display ?? d.score * 100} tone="neutral" label={d.label} className="mt-1 h-1" /></dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-label-sm text-fg-muted">Saved <time dateTime={quiz.saved_at}>{date(quiz.saved_at)}</time></p>
              </div>
            </Panel>
          </div>

          <section className="mt-10" aria-labelledby="tools-h">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="tools-h" className="text-headline-md text-fg">Recommended tools</h2>
              <Link href="/app/tools" className="text-label-md text-accent underline underline-offset-2">All recommendations</Link>
            </div>
            <ul className="overflow-hidden rounded-md border border-line bg-surface">
              {quiz.result.products.slice(0, 3).map((t, i) => (
                <li key={t.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-line px-4 py-3.5 last:border-0">
                  <span className="font-mono text-label-sm text-fg-muted">#{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-label-md text-fg">{t.name}</p>
                    <p className="truncate text-body-sm text-fg-muted">{category(t)} · {t.positive_factors[0] ?? "Matches your profile"}</p>
                  </div>
                  <span className="text-right"><span className="block font-mono text-label-md text-fg">fit {pct(t.fit)}</span><EvidenceLabel kind="recommendation" compact /></span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="checks-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="checks-h" className="text-headline-md text-fg">Task checks</h2>
            <Link href="/app/workflows" className="text-label-md text-accent underline underline-offset-2">View</Link>
          </div>
          {checks.length === 0 ? <p className="text-body-sm text-fg-muted">None saved yet. <Link href="/check" className="underline">Check a task</Link>.</p> : (
            <ul>
              {checks.slice(0, 4).map((c) => c.source === "check" ? (
                <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                  <span className="min-w-0 truncate text-label-md text-fg">{c.label}</span>
                  <span className="shrink-0 text-body-sm text-fg-2">{OUTCOME_LABEL[c.result.decision.outcome]}</span>
                </li>
              ) : null)}
            </ul>
          )}
        </section>
        <section aria-labelledby="saved-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="saved-h" className="text-headline-md text-fg">Saved</h2>
            <Link href="/app/saved" className="text-label-md text-accent underline underline-offset-2">View</Link>
          </div>
          {saved.items.length === 0 ? <p className="text-body-sm text-fg-muted">Save tools from your recommendations to keep a shortlist.</p> : (
            <ul>
              {saved.items.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                  <span className="text-label-md text-fg">{s.label}</span>
                  <span className="text-label-sm text-fg-muted">{s.kind} · {date(s.saved_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
