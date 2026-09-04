import type { InteractionEvent, ScoreResult } from "./types";

const SESSION_PREFIX = "aifit:session:";
const RESULT_PREFIX = "aifit:result:";

export type StoredSession = {
  session_id: string;
  events: InteractionEvent[];
};

export function saveSession(session: StoredSession) {
  sessionStorage.setItem(SESSION_PREFIX + session.session_id, JSON.stringify(session));
}

export function loadSession(sessionId: string): StoredSession | null {
  const raw = sessionStorage.getItem(SESSION_PREFIX + sessionId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function saveResult(sessionId: string, result: ScoreResult) {
  sessionStorage.setItem(RESULT_PREFIX + sessionId, JSON.stringify(result));
}

export function loadResult(sessionId: string): ScoreResult | null {
  const raw = sessionStorage.getItem(RESULT_PREFIX + sessionId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ScoreResult;
  } catch {
    return null;
  }
}

export function clearSession(sessionId: string) {
  sessionStorage.removeItem(SESSION_PREFIX + sessionId);
  sessionStorage.removeItem(RESULT_PREFIX + sessionId);
}

export async function encodeSharePayload(result: ScoreResult): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(result));
  const compressed = await new Response(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw")),
  ).arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(compressed)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function decodeSharePayload(payload: string): Promise<ScoreResult | null> {
  try {
    const padded = payload.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")),
    ).text();
    return JSON.parse(json) as ScoreResult;
  } catch {
    return null;
  }
}
