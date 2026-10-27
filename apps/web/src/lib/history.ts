// Assessment history, kept only in this browser. Fit has no accounts, so the
// list is an index over results already stored locally; clearing it removes
// those copies too. Nothing here is sent to the server.

import type { DecisionResponse } from "./decision-types";

const INDEX_KEY = "aifit:history";
const CHECK_PREFIX = "aifit:check:";
const RESULT_PREFIX = "aifit:result:";
const SESSION_PREFIX = "aifit:session:";
const MAX_ENTRIES = 50;

export type HistoryEntry = {
  kind: "quiz" | "check";
  id: string;
  label: string;
  detail?: string;
  savedAt: string;
};

function store(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function read<T>(key: string): T | null {
  try {
    const raw = store()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode: history is a convenience, not a guarantee.
  }
  if (key === INDEX_KEY) notify();
}

function valid(e: unknown): e is HistoryEntry {
  if (typeof e !== "object" || e === null) return false;
  const v = e as Record<string, unknown>;
  return (v.kind === "quiz" || v.kind === "check") && typeof v.id === "string" && typeof v.label === "string" && typeof v.savedAt === "string";
}

export function listHistory(): HistoryEntry[] {
  const raw = read<unknown[]>(INDEX_KEY);
  return Array.isArray(raw) ? raw.filter(valid).sort((a, b) => b.savedAt.localeCompare(a.savedAt)) : [];
}

export function recordHistory(entry: Omit<HistoryEntry, "savedAt"> & { savedAt?: string }) {
  const rest = listHistory().filter((e) => !(e.kind === entry.kind && e.id === entry.id));
  const next = [{ ...entry, savedAt: entry.savedAt ?? new Date().toISOString() }, ...rest].slice(0, MAX_ENTRIES);
  write(INDEX_KEY, next);
}

export function saveCheck(id: string, response: DecisionResponse, goal: string) {
  write(CHECK_PREFIX + id, { response, goal });
}

export function loadCheck(id: string): { response: DecisionResponse; goal: string } | null {
  const raw = read<{ response: DecisionResponse; goal: string }>(CHECK_PREFIX + id);
  return raw && typeof raw === "object" && raw.response?.decision ? raw : null;
}

export function removeHistory(entry: HistoryEntry) {
  try {
    const s = store();
    if (entry.kind === "check") s?.removeItem(CHECK_PREFIX + entry.id);
    else {
      s?.removeItem(RESULT_PREFIX + entry.id);
      s?.removeItem(SESSION_PREFIX + entry.id);
    }
  } catch {
    // Ignore storage failures.
  }
  write(INDEX_KEY, listHistory().filter((e) => !(e.kind === entry.kind && e.id === entry.id)));
}

export function clearHistory() {
  for (const e of listHistory()) removeHistory(e);
  try {
    store()?.removeItem(INDEX_KEY);
  } catch {
    // Ignore storage failures.
  }
  notify();
}

// useSyncExternalStore plumbing, the same pattern theme.tsx and
// reading-level.tsx use for localStorage-backed state. Snapshots are cached so
// React sees a stable reference until the list actually changes.

const listeners = new Set<() => void>();
let snapshot: HistoryEntry[] | null = null;

function notify() {
  snapshot = null;
  for (const l of listeners) l();
}

export function subscribeHistory(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === INDEX_KEY) notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getHistorySnapshot(): HistoryEntry[] {
  if (snapshot === null) snapshot = listHistory();
  return snapshot;
}

export function getHistoryServerSnapshot(): HistoryEntry[] | null {
  return null;
}

let savedCheckCache: { id: string; value: ReturnType<typeof loadCheck> } | null = null;

/** The saved check named by `?id=` in the current URL, or null. Cached per id. */
export function savedCheckFromUrl(): ReturnType<typeof loadCheck> {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return null;
  if (savedCheckCache?.id !== id) savedCheckCache = { id, value: loadCheck(id) };
  return savedCheckCache.value;
}

export function noopSubscribe() {
  return () => {};
}
