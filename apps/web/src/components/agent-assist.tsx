"use client";

import { useEffect, useState, type RefObject } from "react";
import { api, type ExplainResponse, type IntakeSuggestion } from "@/lib/api";
import { Button } from "@/components/ui/button";

/**
 * Optional AI assistance on the task check. Shown only when the API reports
 * agents on. Suggestions are never applied on their own: each one shows the
 * words it was based on, and the person clicks Apply (which only fills the
 * form; the rules still decide when the form is submitted).
 */

let statusPromise: Promise<boolean> | null = null;
function agentsEnabled(): Promise<boolean> {
  statusPromise ??= api.agentsStatus().then((s) => s.enabled, () => false);
  return statusPromise;
}

export function useAgentsEnabled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void agentsEnabled().then((v) => live && setOn(v));
    return () => {
      live = false;
    };
  }, []);
  return on;
}

const FIELD_LABEL: Record<IntakeSuggestion["field"], string> = {
  workTypes: "Kind of work",
  frequencyPerMonth: "Times a month",
  minutesPerOccurrence: "Minutes each time",
  correctness: "One exact right answer?",
  errorImpact: "How bad if wrong",
  dataClasses: "Sensitive information",
  localOnly: "Must stay on my device",
  integrations: "Apps to connect",
};

function display(value: IntakeSuggestion["value"]): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/** Fill the matching form controls. Returns false if nothing on the form matched. */
function applyToForm(form: HTMLFormElement, s: IntakeSuggestion): boolean {
  const setChecks = (name: string, values: string[]) => {
    let hit = false;
    form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((el) => {
      if (values.includes(el.value)) {
        el.checked = true;
        hit = true;
      }
    });
    return hit;
  };
  const setInput = (name: string, value: string) => {
    const el = form.elements.namedItem(name);
    if (!(el instanceof HTMLInputElement)) return false;
    el.value = value;
    return true;
  };
  switch (s.field) {
    case "workTypes":
      return setChecks("work", s.value as string[]);
    case "dataClasses":
      return setChecks("data", s.value as string[]);
    case "frequencyPerMonth":
      return setInput("frequency", String(s.value));
    case "minutesPerOccurrence":
      return setInput("minutes", String(s.value));
    case "correctness":
      return setChecks("correctness", [String(s.value)]);
    case "errorImpact":
      return setChecks("impact", [String(s.value)]);
    case "localOnly": {
      const el = form.elements.namedItem("localOnly");
      if (!(el instanceof HTMLInputElement)) return false;
      el.checked = s.value === true;
      return true;
    }
    case "integrations": {
      const details = form.querySelector("details");
      if (details) details.open = true;
      return setInput("integrations", (s.value as string[]).join(", "));
    }
  }
}

export function SuggestAnswers({ formRef }: { formRef: RefObject<HTMLFormElement | null> }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "done"; suggestions: IntakeSuggestion[]; questions: string[] }
    | { kind: "message"; text: string }
  >({ kind: "idle" });
  const [applied, setApplied] = useState<Set<string>>(new Set());

  async function run() {
    const goal = formRef.current?.elements.namedItem("goal");
    const text = goal instanceof HTMLTextAreaElement ? goal.value.trim() : "";
    if (text.length < 10) {
      setState({ kind: "message", text: "Write a sentence or two about the task first." });
      return;
    }
    setState({ kind: "loading" });
    setApplied(new Set());
    try {
      const r = await api.suggestAnswers(text.slice(0, 4000));
      if (r.status !== "ok") {
        setState({ kind: "message", text: "No suggestions this time. Fill in the form yourself; the result works the same." });
      } else if (r.suggestions.length === 0 && r.questions.length === 0) {
        setState({ kind: "message", text: "Your description didn't clearly answer any of the questions below." });
      } else {
        setState({ kind: "done", suggestions: r.suggestions, questions: r.questions });
      }
    } catch {
      setState({ kind: "message", text: "Suggestions aren't available right now. The form works without them." });
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={run} disabled={state.kind === "loading"}>
          {state.kind === "loading" ? "Reading…" : "Suggest answers from my description"}
        </Button>
        <span className="text-xs text-muted-foreground">
          AI-written suggestions. Your description is sent to Anthropic&apos;s API to make them and is not stored by Fit.
        </span>
      </div>
      <div aria-live="polite">
        {state.kind === "message" ? <p>{state.text}</p> : null}
        {state.kind === "done" ? (
          <div className="space-y-3">
            {state.suggestions.length ? (
              <ul className="space-y-2" aria-label="Suggested answers">
                {state.suggestions.map((s) => (
                  <li key={s.field} className="flex flex-col gap-2 rounded-md bg-muted/50 p-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p>
                        <span className="font-medium">{FIELD_LABEL[s.field]}:</span> {display(s.value)}
                      </p>
                      <p className="text-xs text-muted-foreground">Because you wrote “{s.evidence}”</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={applied.has(s.field) ? "outline" : "default"}
                      className="min-h-11"
                      disabled={applied.has(s.field)}
                      aria-label={`${applied.has(s.field) ? "Applied" : "Apply"} ${FIELD_LABEL[s.field]}: ${display(s.value)}`}
                      onClick={() => {
                        if (formRef.current && applyToForm(formRef.current, s)) setApplied((a) => new Set(a).add(s.field));
                      }}
                    >
                      {applied.has(s.field) ? "Applied" : "Apply"}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            {state.questions.length ? (
              <div>
                <p className="font-medium">Worth thinking about</p>
                <ul className="list-disc pl-5">
                  {state.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Check each answer below before you submit. The rules decide, not the AI.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ExplainInPlainLanguage({ intake }: { intake: Record<string, unknown> }) {
  const [state, setState] = useState<{ kind: "idle" } | { kind: "loading" } | { kind: "done"; r: ExplainResponse } | { kind: "failed" }>({
    kind: "idle",
  });
  return (
    <section className="space-y-3 rounded-lg border border-border p-4 text-sm" aria-labelledby="plain-language">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="plain-language" className="font-medium">
          In plain language
        </h2>
        {state.kind !== "done" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={state.kind === "loading"}
            onClick={async () => {
              setState({ kind: "loading" });
              try {
                setState({ kind: "done", r: await api.explainDecision(intake) });
              } catch {
                setState({ kind: "failed" });
              }
            }}
          >
            {state.kind === "loading" ? "Writing…" : "Explain this result"}
          </Button>
        ) : null}
      </div>
      <div aria-live="polite">
        {state.kind === "failed" ? <p>The explanation isn&apos;t available right now. The result above is complete without it.</p> : null}
        {state.kind === "done" ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {state.r.explanation.source === "model"
                ? "AI-written from the result above. It cannot change the result."
                : "Written by the rules (the AI explanation was not used)."}
            </p>
            <p>{state.r.explanation.summary}</p>
            {state.r.explanation.keyPoints.length ? (
              <ul className="list-disc pl-5">
                {state.r.explanation.keyPoints.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
