"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, trackActivation } from "@/lib/api";
import type { InteractionEvent, QuizNote, Scenario } from "@/lib/types";
import { saveResult, saveSession } from "@/lib/session-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const NOTE_LIMIT = 2000;
const POST_CHOICE_LOCK_MS = 280;

export default function AssessmentPage() {
  const router = useRouter();
  const choicesRef = useRef<HTMLDivElement | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Briefly blocks a second tap right after a choice advances the quiz. Rendered
  // as disabled buttons so the lock is visible, not just an ignored click.
  const [locked, setLocked] = useState(false);
  const busyRef = useRef(false);
  const [events, setEvents] = useState<InteractionEvent[]>([]);
  const [completed, setCompleted] = useState(0);
  const [signalNote, setSignalNote] = useState<string | null>(null);
  const eventsRef = useRef<InteractionEvent[]>([]);
  const notesRef = useRef<QuizNote[]>([]);
  const tokenRef = useRef<string | null>(null);
  const turnIndexRef = useRef(0);
  const completedRef = useRef(0);
  // Turns already recorded, keyed by scene number + scenario + turn, so a retry
  // after a failed finish never appends the same answer twice.
  const recordedRef = useRef<Set<string>>(new Set());
  const pendingSavesRef = useRef<Set<Promise<unknown>>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await api.scenarios();
        if (cancelled) return;
        setScenarios(loaded);
        if (loaded[0]) setScenarioId(loaded[0].id);
        try {
          const session = await api.createSession();
          if (cancelled) return;
          tokenRef.current = session.token;
          setSessionId(session.session_id);
        } catch {
          // The events endpoint adopts a client-made id + token on first write.
          if (cancelled) return;
          tokenRef.current = crypto.randomUUID();
          setSessionId(crypto.randomUUID());
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not start. Try again in a moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const turn = scenario?.turns[turnIndex];
  const typicalScenes = 4;
  const typicalTurns = 12;
  const maxScenes = 8;
  const completedTurns = useMemo(() => {
    return events.filter((event, index, all) => all.findIndex((row) => row.turn_id === event.turn_id && row.scenario_id === event.scenario_id) === index).length;
  }, [events]);
  const questionNumber = completedTurns + 1;
  const sceneNumber = completed + 1;
  const turnsInScene = scenario?.turns.length ?? 0;
  const expectedTotal = typicalTurns;
  const progress = Math.min(100, Math.round((completedTurns / expectedTotal) * 100));
  const choicesDisabled = submitting || locked;

  function storeLocally(id: string) {
    saveSession({ session_id: id, token: tokenRef.current, events: eventsRef.current, notes: notesRef.current });
  }

  function trackSave(promise: Promise<unknown>) {
    const tracked = promise.catch(() => {
      // Serverless instances may not share memory. The local buffer is enough to score.
    });
    pendingSavesRef.current.add(tracked);
    void tracked.finally(() => pendingSavesRef.current.delete(tracked));
  }

  async function flushSaves() {
    await Promise.all(Array.from(pendingSavesRef.current));
  }

  function recordAnswer(id: string, currentScenario: Scenario, currentTurn: Scenario["turns"][number], choiceId: string) {
    const key = `${completedRef.current}:${currentScenario.id}:${currentTurn.id}`;
    if (recordedRef.current.has(key)) return;
    const choice = currentTurn.choices.find((item) => item.id === choiceId);
    if (!choice) return;
    recordedRef.current.add(key);
    const freeText = note.trim().slice(0, NOTE_LIMIT);
    const mapped = choice.events.map((event) => ({
      ...event,
      scenario_id: currentScenario.id,
      turn_id: currentTurn.id,
      evidence: event.evidence || choice.label,
    }));
    eventsRef.current = [...eventsRef.current, ...mapped];
    if (freeText) {
      notesRef.current = [...notesRef.current, { text: freeText, scenario_id: currentScenario.id, turn_id: currentTurn.id }];
    }
    setEvents(eventsRef.current);
    storeLocally(id);
    setNote("");
    trackSave(
      api.addEvents(id, tokenRef.current, {
        scenario_id: currentScenario.id,
        turn_id: currentTurn.id,
        events: mapped,
        free_text: freeText || undefined,
      }),
    );
  }

  async function finish(id: string) {
    const scored = await api.scoreFull({ session_id: id, events: eventsRef.current, notes: notesRef.current });
    saveResult(id, scored);
    trackActivation("quiz_completed");
    router.push(`/results/${id}`);
  }

  // Ends the current scene: wait for saves, ask the server whether to continue,
  // then either load the next scene or score. Safe to call again after a failure.
  async function endScene(id: string) {
    setSubmitting(true);
    setError(null);
    try {
      await flushSaves();
      const signal = await api.signal({ session_id: id, events: eventsRef.current }).catch(() => null);
      if (!signal || signal.ready || !signal.next_scenario_id) {
        await finish(id);
        return;
      }
      completedRef.current += 1;
      setCompleted(completedRef.current);
      setSignalNote(signal.note);
      setScenarioId(signal.next_scenario_id);
      turnIndexRef.current = 0;
      setTurnIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not score your answers. Try again.");
    } finally {
      busyRef.current = false;
      setSubmitting(false);
    }
  }

  function handleChoiceKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!turn) return;
    if (event.key === "Enter" || event.key === " ") {
      const focused = (event.target as HTMLElement).closest("[data-choice]")?.getAttribute("data-choice");
      const choiceId = focused || selected;
      if (!choiceId) return;
      event.preventDefault();
      void pickChoice(choiceId);
      return;
    }
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const ids = turn.choices.map((choice) => choice.id);
    if (!ids.length) return;
    const currentIndex = selected ? ids.indexOf(selected) : -1;
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = ids.length - 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowRight")
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % ids.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      nextIndex = currentIndex <= 0 ? ids.length - 1 : currentIndex - 1;
    const nextId = ids[nextIndex];
    setSelected(nextId);
    const node = choicesRef.current?.querySelector<HTMLButtonElement>(`[data-choice="${nextId}"]`);
    node?.focus();
  }

  async function pickChoice(choiceId: string) {
    if (busyRef.current || locked || !sessionId || !scenario) return;
    const currentTurnIndex = turnIndexRef.current;
    const currentTurn = scenario.turns[currentTurnIndex];
    if (!currentTurn || !currentTurn.choices.some((item) => item.id === choiceId)) return;
    busyRef.current = true;
    setError(null);
    recordAnswer(sessionId, scenario, currentTurn, choiceId);
    setSelected(null);

    if (currentTurnIndex < scenario.turns.length - 1) {
      const nextIndex = currentTurnIndex + 1;
      turnIndexRef.current = nextIndex;
      setTurnIndex(nextIndex);
      setLocked(true);
      window.setTimeout(() => {
        busyRef.current = false;
        setLocked(false);
      }, POST_CHOICE_LOCK_MS);
      return;
    }

    await endScene(sessionId);
  }

  function retry() {
    if (busyRef.current || !sessionId) return;
    busyRef.current = true;
    void endScene(sessionId);
  }

  if (error && !scenario) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">This quiz is unavailable</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">About five minutes</p>
        <h1 className="text-3xl font-semibold tracking-tight">Find your AI fit</h1>
        <p className="text-muted-foreground">
          Four short scenes, about twelve questions — usually five minutes. You leave with a profile, suggested tools,
          and files you can paste into the apps you already use.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>For homework, a shop, a studio, a side hustle, or a team.</li>
          <li>Anonymous: no name, job title, or personal details.</li>
          <li>You can delete the session from your results page.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          We do not ask for an email. Read the{" "}
          <a href="/privacy" className="underline underline-offset-2">
            privacy note
          </a>{" "}
          anytime.
        </p>
        <Button className="min-h-11 w-full sm:w-auto" onClick={() => {
            setStarted(true);
            trackActivation("quiz_started");
          }} disabled={!sessionId || loading}>
          {loading ? "Getting ready…" : "Let's go"}
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
        <div className="flex items-center justify-between text-sm text-muted-foreground" role="status" aria-live="polite">
          <span>
            Scene {sceneNumber} of {typicalScenes}
            {sceneNumber > typicalScenes ? ` · extra scene, never more than ${maxScenes}` : ""}
          </span>
          <span>
            Question {questionNumber} of about {expectedTotal}
          </span>
        </div>
        <Progress
          aria-label="Quiz progress"
          value={Math.max(progress, Math.round(((completed + turnIndex / Math.max(turnsInScene, 1)) / typicalScenes) * 100))}
        />
        <p className="text-xs text-muted-foreground">
          {turnsInScene} questions in this scene
          {sceneNumber > typicalScenes ? ` · wrapping up, never more than ${maxScenes} scenes.` : ""}
        </p>
        {signalNote ? <p className="text-xs text-muted-foreground">{signalNote}</p> : null}
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
          <div
            ref={choicesRef}
            role="radiogroup"
            aria-label={turn.prompt}
            aria-busy={choicesDisabled}
            onKeyDown={handleChoiceKeys}
            className="space-y-3"
          >
            {turn.choices.map((choice, index) => {
              const isSelected = selected === choice.id;
              const isTabStop = isSelected || (!selected && index === 0);
              return (
                <button
                  key={choice.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isTabStop ? 0 : -1}
                  data-choice={choice.id}
                  onClick={() => void pickChoice(choice.id)}
                  disabled={choicesDisabled}
                  aria-disabled={choicesDisabled}
                  className={`block min-h-11 w-full rounded-xl border px-4 py-3 text-left text-sm transition disabled:opacity-70 ${
                    isSelected ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                  }`}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
          {turn.allow_free_text ? (
            <div className="space-y-1">
              <label htmlFor="free-text-note" className="text-sm font-medium">
                Add a note (optional)
              </label>
              <Textarea
                id="free-text-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={NOTE_LIMIT}
                placeholder="Optional — anything you want to add."
              />
            </div>
          ) : null}
          {error ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
              {turnIndex === turnsInScene - 1 ? (
                <Button variant="outline" className="min-h-11" onClick={retry} disabled={submitting}>
                  Try again
                </Button>
              ) : null}
            </div>
          ) : null}
          {submitting ? (
            <p className="text-sm text-muted-foreground" role="status">
              Saving…
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
