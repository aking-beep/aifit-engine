import type { InteractionEvent, QuizNote, Scenario, ScoreResult } from "./types";
import type { DecisionResponse } from "./decision-types";

export type FitFilterInput = { local_only?: boolean; max_pricing_tier?: string | null };

export type ScoreInput = {
  session_id?: string;
  events: InteractionEvent[];
  notes?: QuizNote[];
};

type ShareCreated = { share_id: string; path: string; durable?: boolean };

async function request<T>(path: string, init?: RequestInit & { token?: string | null }): Promise<T> {
  const { token, ...rest } = init ?? {};
  const response = await fetch(path, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Session-Token": token } : {}),
      ...(rest.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  scenarios: () => request<Scenario[]>("/v1/scenarios"),
  createSession: () => request<{ session_id: string; token: string }>("/v1/sessions", { method: "POST" }),
  demoSession: () =>
    request<{
      session_id: string;
      token: string;
      session: { session_id: string; events: InteractionEvent[] };
      result: ScoreResult;
    }>("/v1/sessions/demo", { method: "POST" }),
  addEvents: (
    sessionId: string,
    token: string | null,
    body: {
      events: InteractionEvent[];
      free_text?: string;
      scenario_id: string;
      turn_id: string;
    },
  ) =>
    request<{ event_count: number }>(`/v1/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  /** Stateless scoring: the server classifies notes and returns a result without storing anything. */
  scoreFull: (input: ScoreInput, filters?: FitFilterInput) =>
    request<ScoreResult>("/v1/score", {
      method: "POST",
      body: JSON.stringify({ ...input, notes: input.notes ?? [], filters: filters ?? null }),
    }),
  signal: (session: { session_id: string; events: InteractionEvent[] }) =>
    request<{
      ready: boolean;
      next_scenario_id: string | null;
      confidence: number;
      scenarios_completed: number;
      note: string;
    }>("/v1/signal", { method: "POST", body: JSON.stringify(session) }),
  /** Publish a snapshot. With a session id + token the share is deleted along with the session. */
  publishShare: (result: ScoreResult, sessionId?: string, token?: string | null) =>
    request<ShareCreated>("/v1/share", {
      method: "POST",
      body: JSON.stringify(sessionId ? { result, session_id: sessionId } : { result }),
      token: sessionId ? token : null,
    }),
  getShare: (shareId: string) => request<unknown>(`/v1/share/${shareId}`),
  exportSession: (sessionId: string, token: string | null) =>
    request<{ session: unknown; result: ScoreResult | null }>(`/v1/sessions/${sessionId}/export`, { token }),
  deleteSession: (sessionId: string, token: string | null) =>
    request<{ deleted: boolean }>(`/v1/sessions/${sessionId}`, { method: "DELETE", token }),
  exportPersona: (target: string, result: ScoreResult) =>
    request<{ filename: string; content: string; encoding?: string }>(`/v1/export/${target}`, {
      method: "POST",
      body: JSON.stringify({ persona: result.persona, result }),
    }),
  products: () => request<Record<string, unknown>[]>("/v1/registry/products"),
  models: () => request<Record<string, unknown>[]>("/v1/registry/models"),
  freshness: () => request<{ needs_review: unknown[]; products: unknown[]; models: unknown[] }>("/v1/registry/freshness"),
  decision: (intake: Record<string, unknown>) =>
    request<DecisionResponse>("/v1/decision", { method: "POST", body: JSON.stringify(intake) }),
  feedback: (body: { session_id?: string; rating: number; comment: string; useful?: boolean }) =>
    request<{ ok: boolean }>("/v1/feedback", { method: "POST", body: JSON.stringify(body) }),
};

export type ActivationEvent =
  | "quiz_started"
  | "quiz_completed"
  | "results_viewed"
  | "persona_copied"
  | "persona_opened"
  | "export_downloaded"
  | "bundle_downloaded"
  | "check_started"
  | "check_completed"
  | "history_viewed"
  | "share_created";

/** Anonymous activation counter. Fire-and-forget: never blocks or breaks the page. */
export function trackActivation(event: ActivationEvent) {
  try {
    void fetch("/v1/activation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Ignore.
  }
}
