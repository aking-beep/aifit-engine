import type { InteractionEvent, QuizNote, ScoreResult } from "./types";
import { normalizeResult } from "./share-snapshot";
import { recordHistory } from "./history";

const SESSION_PREFIX = "aifit:session:";
const RESULT_PREFIX = "aifit:result:";

export type StoredSession = {
  session_id: string;
  /** Proves this browser owns the server copy. Sent as X-Session-Token. */
  token?: string | null;
  events: InteractionEvent[];
  notes?: QuizNote[];
};

function browserStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
}

function readJson(key: string): unknown {
  const store = browserStore();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  const store = browserStore();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or privacy mode: the in-memory copy still works for this visit.
  }
}

function removeKey(key: string) {
  try {
    browserStore()?.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

export function saveSession(session: StoredSession) {
  writeJson(SESSION_PREFIX + session.session_id, session);
}

export function loadSession(sessionId: string): StoredSession | null {
  const raw = readJson(SESSION_PREFIX + sessionId);
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Partial<StoredSession>;
  if (typeof value.session_id !== "string" || !Array.isArray(value.events)) return null;
  return {
    session_id: value.session_id,
    token: typeof value.token === "string" ? value.token : null,
    events: value.events,
    notes: Array.isArray(value.notes) ? value.notes : [],
  };
}

export function saveResult(sessionId: string, result: ScoreResult) {
  writeJson(RESULT_PREFIX + sessionId, result);
  recordHistory({
    kind: "quiz",
    id: sessionId,
    label: result.workstyle?.label || result.persona?.label || "AI style quiz",
    detail: "Quiz result",
  });
}

export function loadResult(sessionId: string): ScoreResult | null {
  return normalizeResult(readJson(RESULT_PREFIX + sessionId));
}

export function clearSession(sessionId: string) {
  removeKey(SESSION_PREFIX + sessionId);
  removeKey(RESULT_PREFIX + sessionId);
}
