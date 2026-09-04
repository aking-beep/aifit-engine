import type { InteractionEvent, Scenario, ScoreResult } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>("/health"),
  scenarios: () => request<Scenario[]>("/v1/scenarios"),
  createSession: () => request<{ session_id: string }>("/v1/sessions", { method: "POST" }),
  addEvents: (
    sessionId: string,
    body: {
      events: InteractionEvent[];
      free_text?: string;
      scenario_id: string;
      turn_id: string;
    },
  ) => request<{ event_count: number }>(`/v1/sessions/${sessionId}/events`, { method: "POST", body: JSON.stringify(body) }),
  score: (sessionId: string) =>
    request<ScoreResult>(`/v1/sessions/${sessionId}/score`, { method: "POST" }),
  exportPersona: (target: string, persona: ScoreResult["persona"]) =>
    request<{ filename: string; content: string }>(`/v1/export/${target}`, {
      method: "POST",
      body: JSON.stringify({ persona }),
    }),
};
