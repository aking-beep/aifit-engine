"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { api, trackActivation } from "@/lib/api";
import type { DecisionResponse } from "@/lib/decision-types";
import { OUTCOME_LABEL } from "@/lib/decision-types";
import { noopSubscribe, recordHistory, saveCheck, savedCheckFromUrl } from "@/lib/history";
import { DecisionView } from "@/components/decision-view";
import { SaveToAccount } from "@/components/app/save-to-account";
import { ExplainInPlainLanguage, SuggestAnswers, useAgentsEnabled } from "@/components/agent-assist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArcCta } from "@/design";
import { ARC_LINKS } from "@/lib/arc";

const WORK = [
  { id: "generate", label: "Writing or drafting" },
  { id: "summarize", label: "Summarising long things" },
  { id: "search", label: "Looking things up" },
  { id: "extract", label: "Pulling details out of documents" },
  { id: "classify", label: "Sorting or labelling" },
  { id: "converse", label: "Talking something through" },
  { id: "decide", label: "Making a judgement call" },
  { id: "act", label: "Doing something in another app" },
  { id: "transfer", label: "Moving information between apps" },
  { id: "record", label: "Keeping records or lists" },
  { id: "lookup", label: "Finding a record I already have" },
  { id: "calculate", label: "Totals and arithmetic" },
] as const;

const DATA = [
  { id: "pii", label: "Other people's names, emails or addresses" },
  { id: "financial", label: "Money or bank details" },
  { id: "phi", label: "Health information" },
  { id: "sensitive_pii", label: "ID numbers or very private details" },
  { id: "minors", label: "Information about children" },
  { id: "credentials", label: "Passwords or API keys" },
] as const;

type Radio = { value: string; label: string };
const CORRECTNESS: Radio[] = [
  { value: "exact", label: "Yes — one exact right answer" },
  { value: "tolerant", label: "A few answers would be fine" },
  { value: "subjective", label: "It's a matter of taste" },
];
const IMPACT: Radio[] = [
  { value: "low", label: "Not much" },
  { value: "medium", label: "Annoying — I'd redo it" },
  { value: "high", label: "Costly or embarrassing" },
  { value: "critical", label: "Serious harm" },
];
const ABILITY: Radio[] = [
  { value: "none", label: "I avoid tech setup" },
  { value: "basic", label: "I can follow instructions" },
  { value: "intermediate", label: "I tinker and automate" },
  { value: "advanced", label: "I write code" },
];

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function RadioGroup({ name, legend, options, defaultValue }: { name: string; legend: string; options: Radio[]; defaultValue: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} className="size-4" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function CheckPage() {
  const [fresh, setFresh] = useState<{ response: DecisionResponse; goal: string; intake?: Record<string, unknown> } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const agentsOn = useAgentsEnabled();
  // A check opened from history (?id=…) is read from this browser's storage.
  const saved = useSyncExternalStore(noopSubscribe, savedCheckFromUrl, () => null);
  const shown = fresh ?? (dismissed ? null : saved);
  const result = shown?.response ?? null;
  const goal = shown?.goal ?? "";

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const workTypes = form.getAll("work").map(String);
    if (workTypes.length === 0) {
      setError("Pick at least one kind of work.");
      return;
    }
    const dataClasses = ["internal", ...form.getAll("data").map(String)];
    const integrations = String(form.get("integrations") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    const engineers = numberOrNull(form.get("engineers"));
    const goalText = String(form.get("goal") ?? "").slice(0, 2000);
    const intake = {
      goal: goalText,
      workTypes,
      frequencyPerMonth: numberOrNull(form.get("frequency")),
      minutesPerOccurrence: numberOrNull(form.get("minutes")),
      currentApproach: String(form.get("current") ?? "manual"),
      currentWorksWell: form.get("worksWell") === "on",
      correctness: String(form.get("correctness") ?? "tolerant"),
      errorImpact: String(form.get("impact") ?? "medium"),
      technicalAbility: String(form.get("ability") ?? "basic"),
      org: { size: "solo", engineers: engineers === null ? 0 : Math.floor(engineers) },
      constraints: {
        dataClasses,
        localOnly: form.get("localOnly") === "on",
        offTheShelfAcceptable: form.get("hostedOk") === "on",
        monthlyBudgetUsd: numberOrNull(form.get("budget")),
        timelineWeeks: numberOrNull(form.get("timeline")),
        integrations,
        autonomy: String(form.get("autonomy") ?? "suggest"),
        irreversibleActions: form.get("irreversible") === "on",
      },
      hourlyValueUsd: numberOrNull(form.get("hourly")),
    };
    setSubmitting(true);
    setError(null);
    trackActivation("check_started");
    try {
      const response = await api.decision(intake);
      const id = response.decision.engine.inputHash.slice(0, 16);
      saveCheck(id, response, goalText);
      recordHistory({
        kind: "check",
        id,
        label: goalText.trim() ? goalText.trim().slice(0, 80) : "Task check",
        detail: OUTCOME_LABEL[response.decision.outcome],
      });
      window.history.replaceState(null, "", `/check?id=${id}`);
      setFresh({ response, goal: goalText, intake });
      trackActivation("check_completed");
    } catch {
      setError("We could not check that right now. Your answers are still here — try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Task check · about 2 minutes</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Should you use AI for this?</h1>
        <p className="text-muted-foreground">
          Describe one job. Fit compares five options — leave it alone, ordinary software, rules-based automation, an
          AI tool, or building something — using fixed, published rules. Sometimes the honest answer is “not AI”.
        </p>
      </header>

      {result ? (
        <div ref={resultRef} tabIndex={-1} className="space-y-6 outline-none">
          <DecisionView data={result} goal={goal} />
          <ArcCta links={ARC_LINKS} app="ai-fit" placement="check-result" title="Is this a business decision?" body="ARC Transformation Group can check this answer against your systems and costs, and help with the build, the automation or the decision not to." />
          {fresh?.intake ? (
            <SaveToAccount payload={{ kind: "check", intake: fresh.intake, label: goal.trim().slice(0, 80) || "Task check" }} />
          ) : null}
          {agentsOn && fresh?.intake ? <ExplainInPlainLanguage intake={{ ...fresh.intake, goal: "" }} /> : null}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setFresh(null);
                setDismissed(true);
                window.history.replaceState(null, "", "/check");
              }}
            >
              Check another task
            </Button>
            <Link href="/assessment" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm underline-offset-4 hover:underline">
              Find the AI style that fits you →
            </Link>
            <Link href="/history" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm underline-offset-4 hover:underline">
              Your history
            </Link>
          </div>
        </div>
      ) : (
        <form ref={formRef} onSubmit={onSubmit} className="space-y-6" aria-describedby="check-privacy" noValidate>
          <p id="check-privacy" className="text-sm text-muted-foreground">
            Nothing you type here is stored on our server. The result is kept in this browser so you can come back to it.
          </p>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">The job</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="goal" className="font-medium">
                  What do you want help with? <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id="goal"
                  name="goal"
                  maxLength={2000}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  aria-describedby="goal-hint"
                />
                <p id="goal-hint" className="text-xs text-muted-foreground">
                  Shown back to you. It is not used to score — your choices below are.
                </p>
                {agentsOn ? <SuggestAnswers formRef={formRef} /> : null}
              </div>
              <fieldset className="space-y-2">
                <legend className="font-medium">What kind of work is it? Pick all that apply.</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {WORK.map((w) => (
                    <label key={w.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <input type="checkbox" name="work" value={w.id} className="size-4" />
                      {w.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="frequency" className="font-medium">Times a month</label>
                  <input id="frequency" name="frequency" type="number" min={0} inputMode="numeric" className="min-h-11 w-full rounded-lg border border-border bg-background px-3" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="minutes" className="font-medium">Minutes each time</label>
                  <input id="minutes" name="minutes" type="number" min={0} inputMode="numeric" className="min-h-11 w-full rounded-lg border border-border bg-background px-3" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="current" className="font-medium">How do you do it today?</label>
                  <select id="current" name="current" defaultValue="manual" className="min-h-11 w-full rounded-lg border border-border bg-background px-3">
                    <option value="manual">By hand</option>
                    <option value="spreadsheet">In a spreadsheet</option>
                    <option value="existing_software">With an app or software</option>
                    <option value="existing_ai">With an AI tool already</option>
                    <option value="none">I don&apos;t do it yet</option>
                  </select>
                </div>
                <label className="flex min-h-11 items-center gap-2 self-end text-sm">
                  <input type="checkbox" name="worksWell" className="size-4" />
                  Today&apos;s way works fine
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Getting it right</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <RadioGroup name="correctness" legend="Is there one exact right answer?" options={CORRECTNESS} defaultValue="tolerant" />
              <RadioGroup name="impact" legend="If it comes out wrong, how bad is that?" options={IMPACT} defaultValue="medium" />
              <RadioGroup name="ability" legend="How comfortable are you with tech?" options={ABILITY} defaultValue="basic" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Privacy and limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <fieldset className="space-y-2">
                <legend className="font-medium">Does it involve any of these?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DATA.map((d) => (
                    <label key={d.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <input type="checkbox" name="data" value={d.id} className="size-4" />
                      {d.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2 text-sm">
                <label className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" name="localOnly" className="size-4" />
                  It must stay on my own device
                </label>
                <label className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" name="hostedOk" defaultChecked className="size-4" />
                  Online tools from other companies are OK
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="budget" className="font-medium">Monthly budget in $ <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <input id="budget" name="budget" type="number" min={0} inputMode="decimal" className="min-h-11 w-full rounded-lg border border-border bg-background px-3" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="hourly" className="font-medium">An hour of your time is worth $ <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <input id="hourly" name="hourly" type="number" min={0} inputMode="decimal" className="min-h-11 w-full rounded-lg border border-border bg-background px-3" />
                </div>
              </div>
              <details className="space-y-4 text-sm">
                <summary className="min-h-11 cursor-pointer py-2 font-medium">More detail (optional)</summary>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label htmlFor="integrations" className="font-medium">Apps it needs to connect to, separated by commas</label>
                    <input id="integrations" name="integrations" maxLength={1000} className="min-h-11 w-full rounded-lg border border-border bg-background px-3" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="timeline" className="font-medium">Weeks until you need it</label>
                      <input id="timeline" name="timeline" type="number" min={0} className="min-h-11 w-full rounded-lg border border-border bg-background px-3" />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="engineers" className="font-medium">People who could build software for this</label>
                      <input id="engineers" name="engineers" type="number" min={0} step={1} className="min-h-11 w-full rounded-lg border border-border bg-background px-3" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="autonomy" className="font-medium">How much should it do on its own?</label>
                    <select id="autonomy" name="autonomy" defaultValue="suggest" className="min-h-11 w-full rounded-lg border border-border bg-background px-3">
                      <option value="suggest">Suggest — I do the work</option>
                      <option value="approve">Prepare — I approve</option>
                      <option value="bounded">Act within limits</option>
                      <option value="full">Act on its own</option>
                    </select>
                  </div>
                  <label className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" name="irreversible" className="size-4" />
                    Some actions can&apos;t be undone (sending money, deleting, publishing)
                  </label>
                </div>
              </details>
            </CardContent>
          </Card>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="min-h-11" disabled={submitting}>
            {submitting ? "Checking…" : "Check this task"}
          </Button>
        </form>
      )}
    </div>
  );
}
