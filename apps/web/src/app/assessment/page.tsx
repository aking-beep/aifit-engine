"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Scenario } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function AssessmentPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loaded, session] = await Promise.all([api.scenarios(), api.createSession()]);
        if (cancelled) return;
        setScenarios(loaded);
        setSessionId(session.session_id);
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
      await api.addEvents(sessionId, {
        scenario_id: scenario.id,
        turn_id: turn.id,
        events: choice.events.map((event) => ({
          ...event,
          scenario_id: scenario.id,
          turn_id: turn.id,
          evidence: event.evidence || choice.label,
        })),
        free_text: note.trim() || undefined,
      });
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
        await api.score(sessionId);
        router.push(`/results/${sessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that response.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-muted-foreground">
        Loading scenarios…
      </div>
    );
  }

  if (error && !scenario) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">Assessment unavailable</h1>
        <p className="text-muted-foreground">{error}</p>
        <p className="text-sm text-muted-foreground">
          The scoring API needs to be running so the game can load scenarios without duplicating engine logic in the browser.
        </p>
      </div>
    );
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
                selected === choice.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              {choice.label}
            </button>
          ))}
          {turn.allow_free_text ? (
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional: add a note. Keywords like compare, sources, automate, or local are scored as extra evidence."
            />
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full sm:w-auto" onClick={advance} disabled={!selected || submitting}>
            {submitting ? "Saving…" : scenarioIndex === scenarios.length - 1 && turnIndex === scenario.turns.length - 1 ? "See results" : "Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
