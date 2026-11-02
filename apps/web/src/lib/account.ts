// Client for the Consumer account API (services/api/main.py, /v1/account/*).
// The session is an HttpOnly cookie the browser sends on its own; every
// state-changing call adds X-AIFit-Request so the API can refuse cross-site
// requests. Plan limits are decided on the server; this file only reports them.

import type { InteractionEvent, QuizNote, ScoreResult } from "./types";
import type { DecisionResponse } from "./decision-types";

export type Limits = {
  recommendations: number | null;
  config_packages_per_month: number | null;
  compare_tools: number | null;
  history_days: number | null;
  saved_items: number | null;
};

export type BillingPublic = { mode: "off" | "test" | "live"; enabled: boolean; reason: string; pro_available: boolean };
export type SubState = "none" | "active" | "canceling" | "past_due" | "canceled" | "expired" | "refunded";

export type AccountSummary = {
  billing: BillingPublic;
  plan: "free" | "pro" | "all-features";
  state: SubState;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  limits: Limits;
  usage: { config_packages_this_month: number };
};

export type Role = "individual" | "student" | "creator" | "freelancer" | "small_business_owner" | "engineer" | "manager" | "executive" | "other";
export type User = { id: string; email: string; name: string; role: Role | null; created_at: string };
export type Me = { user: User; account: AccountSummary };

export type QuizResult = ScoreResult & { locked_products?: number };
export type CheckResult = DecisionResponse & { intake: Record<string, unknown> };
export type HistoryItem =
  | { id: string; source: "quiz"; label: string; saved_at: string; result: QuizResult }
  | { id: string; source: "check"; label: string; saved_at: string; result: CheckResult };

export type SavedItem = { id: string; kind: "tool" | "workflow" | "config" | "comparison"; ref: string; label: string; note: string; saved_at: string };
export type Payment = { id: string; kind: "checkout" | "invoice" | "refund"; product: string; status: string; amount: number | null; currency: string | null; at: string };

export type Status = {
  accounts: { enabled: boolean; reason: string };
  billing: BillingPublic;
  free_limits: Record<keyof Limits, number>;
  signed_in: boolean;
};

export class AccountApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const mutating = init.method && init.method !== "GET";
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(mutating ? { "X-AIFit-Request": "1" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let code = "error";
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      const d = body?.detail;
      if (d && typeof d === "object" && !Array.isArray(d)) {
        code = d.code ?? code;
        message = d.message ?? message;
      } else if (Array.isArray(d)) {
        code = "invalid";
        message = d.map((e: { msg?: string }) => e.msg?.replace(/^Value error, /, "")).filter(Boolean).join(" ") || message;
      } else if (typeof d === "string") {
        message = d;
      }
    } catch {
      // Non-JSON error body: keep the status message.
    }
    throw new AccountApiError(res.status, code, message);
  }
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) => call<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const account = {
  status: () => call<Status>("/v1/account/status"),
  signup: (email: string, password: string, name: string) => post<Me>("/v1/account/signup", { email, password, name }),
  login: (email: string, password: string) => post<Me>("/v1/account/login", { email, password }),
  logout: () => post<{ signed_out: boolean }>("/v1/account/logout"),
  me: () => call<Me>("/v1/account/me"),
  requestReset: (email: string) => post<{ sent: boolean; message: string }>("/v1/account/password/reset", { email }),
  completeReset: (token: string, password: string) => post<{ reset: boolean }>("/v1/account/password/reset/complete", { token, password }),
  update: (fields: { name?: string; role?: Role }) => call<Me>("/v1/account/me", { method: "PATCH", body: JSON.stringify(fields) }),
  changePassword: (current: string, next: string) => post<{ changed: boolean }>("/v1/account/password", { current, new: next }),
  saveQuiz: (events: InteractionEvent[], notes: QuizNote[] = [], label = "") =>
    post<HistoryItem>("/v1/account/assessments", { kind: "quiz", events, notes, label }),
  saveCheck: (intake: Record<string, unknown>, label = "") => post<HistoryItem>("/v1/account/assessments", { kind: "check", intake, label }),
  profile: () => call<{ entry: Extract<HistoryItem, { source: "quiz" }> | null; limits: Limits }>("/v1/account/profile"),
  history: () => call<{ items: HistoryItem[]; hidden_older: number; limits: Limits }>("/v1/account/history"),
  deleteHistory: (id: string) => call<{ deleted: boolean }>(`/v1/account/history/${encodeURIComponent(id)}`, { method: "DELETE" }),
  saved: () => call<{ items: SavedItem[]; limit: number | null }>("/v1/account/saved"),
  save: (item: { kind: SavedItem["kind"]; ref: string; label: string; note?: string }) => post<SavedItem>("/v1/account/saved", item),
  unsave: (id: string) => call<{ deleted: boolean }>(`/v1/account/saved/${encodeURIComponent(id)}`, { method: "DELETE" }),
  compare: (ids: string[]) => call<{ items: Record<string, unknown>[]; unknown: string[] }>(`/v1/account/compare?ids=${encodeURIComponent(ids.join(","))}`),
  package: () => post<{ filename: string; content: string; encoding: "base64"; manifest: { files: { path: string; bytes?: number }[]; secretsRedacted: number } }>("/v1/account/package"),
  exportAll: () => call<Record<string, unknown>>("/v1/account/export"),
  deleteAccount: () => call<{ deleted: boolean }>("/v1/account", { method: "DELETE" }),
  billing: () => call<AccountSummary & { payments: Payment[] }>("/v1/account/billing"),
  checkout: () => post<{ url: string; id: string }>("/v1/account/billing/checkout"),
  portal: () => post<{ url: string }>("/v1/account/billing/portal"),
  checkoutStatus: (id: string) => call<{ status: string }>(`/v1/account/billing/checkout/${encodeURIComponent(id)}`),
};

export function planLabel(a: AccountSummary): string {
  if (a.plan === "all-features") return "All features";
  return a.plan === "pro" ? "Pro" : "Free";
}

/** Saves a base64 file the API built. */
export function downloadBase64(filename: string, content: string, type = "application/zip") {
  const bytes = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
