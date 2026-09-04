"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { InteractionEvent, Scenario } from "@/lib/types";
import { saveResult, saveSession } from "@/lib/session-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function AssessmentPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [events, setEvents] = useState<InteractionEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await api.scenarios();
        if (cancelled) return;
        setScenarios(loaded);
        try {
          const session = await api.createSession();
          if (!cancelled) setSessionId(session.session_id);
        } catch {
          if (!cancelled) setSessionId(crypto.randomUUID());
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not start the assessment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scenario = scenarios[scenarioIndex];
  const turn = scenario?.turns[turnIndex];
  const totalTurns = useMemo(
    () => scenarios.reduce((sum, item) => sum + item.turns.length, 0),
    [scenarios],
  );
  const completedTurns = useMemo(() => {
    return scenarios.slice(0, scenarioIndex).reduce((sum, item) => sum + item.turns.length, 0) + turnIndex;
  }, [scenarios, scenarioIndex, turnIndex]);
  const progress = totalTurns === 0 ? 0 : Math.round((completedTurns / totalTurns) * 100);

  async function advance() {
    if (!sessionId || !scenario || !turn || !selected) return;
    const choice = turn.choices.find((item) => item.id === selected);
    if (!choice) return;
    setSubmitting(true);
    setError(null);
    try {
      const mapped = choice.events.map((event) => ({
        ...event,
        scenario_id: scenario.id,
        turn_id: turn.id,
        evidence: event.evidence || choice.label,
      }));
      const nextEvents = [...events, ...mapped];
      setEvents(nextEvents);
      saveSession({ session_id: sessionId, events: nextEvents });
      try {
        await api.addEvents(sessionId, {
          scenario_id: scenario.id,
          turn_id: turn.id,
          events: mapped,
          free_text: note.trim() || undefined,
        });
      } catch {
        // Serverless instances may not share memory. The local buffer is enough to score.
      }
      const lastTurn = turnIndex >= scenario.turns.length - 1;
      const lastScenario = scenarioIndex >= scenarios.length - 1;
      setSelected(null);
      setNote("");
      if (!lastTurn) {
        setTurnIndex((value) => value + 1);
      } else if (!lastScenario) {
        setScenarioIndex((value) => value + 1);
        setTurnIndex(0);
      } else {
        const scored = await api.scoreFull({ session_id: sessionId, events: nextEvents });
        saveResult(sessionId, scored);
        router.push(`/results/${sessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that response.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !scenario) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">Assessment unavailable</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Before you start</h1>
        <p className="text-muted-foreground">
          This measures how you interact with AI, not your personality. Eight scenarios, three rounds each.
          There are no right answers. You leave with a workstyle, a recommended stack, and a configuration you can install.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>No name, employer, or demographic questions.</li>
          <li>You can delete the session from the results page.</li>
          <li>Recommendations come from dated product and model registries, not one model vote.</li>
        </ul>
        <Button onClick={() => setStarted(true)} disabled={!sessionId || loading}>
          {loading ? "Preparing…" : "Begin scenario 1"}
        </Button>
      </div>
    );
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-muted-foreground">Loading scenarios…</div>;
  }

  if (!scenario || !turn) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-semibold">No scenarios found</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Scenario {scenarioIndex + 1} of {scenarios.length}
          </span>
          <span>
            Round {turnIndex + 1} of {scenario.turns.length}
          </span>
        </div>
        <Progress value={progress} />
      </div>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{scenario.domain}</Badge>
            <Badge variant="outline">{scenario.title}</Badge>
          </div>
          <CardTitle className="text-2xl text-balance">{turn.prompt}</CardTitle>
          <p className="text-sm text-muted-foreground">{scenario.setup}</p>
          {scenario.initial_ambiguity ? (
            <p className="text-sm text-muted-foreground">{scenario.initial_ambiguity}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {turn.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => setSelected(choice.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                selected === choice.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
              }`}
            >
              {choice.label}
            </button>
          ))}
          {turn.allow_free_text ? (
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note. Words like compare, sources, automate, or local can add evidence."
            />
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full sm:w-auto" onClick={advance} disabled={!selected || submitting}>
            {submitting
              ? "Saving…"
              : scenarioIndex === scenarios.length - 1 && turnIndex === scenario.turns.length - 1
                ? "See results"
                : "Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
