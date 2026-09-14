export type AccessMode = "off" | "waitlist" | "code";

export const GATE_STORAGE_KEY = "aifit.access.v1";

const OPEN_PREFIXES = ["/privacy", "/share", "/methodology", "/registry"];

export function parseAccessMode(raw: string | undefined | null): AccessMode {
  const value = (raw ?? "off").trim().toLowerCase();
  if (value === "waitlist" || value === "code" || value === "off") return value;
  return "off";
}

export function previewGateFromSearch(search: string | null | undefined): AccessMode {
  if (!search) return "off";
  const value = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("preview_gate");
  const preview = parseAccessMode(value);
  // Preview can only turn a gate on, so a public quiz can be demoed as invite-first.
  return preview === "off" ? "off" : preview;
}

export function effectiveAccessMode(mode: AccessMode, preview: AccessMode): AccessMode {
  if (mode !== "off") return mode;
  return preview;
}

export function pathBypassesGate(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return OPEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function readStoredUnlock(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GATE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStoredUnlock(): void {
  try {
    window.localStorage.setItem(GATE_STORAGE_KEY, "1");
  } catch {
    // Private mode can block storage; the current tab still proceeds via React state.
  }
}
