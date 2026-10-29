"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { THEME_BOOT_SCRIPT, THEME_STORAGE_KEY } from "@/design";

// One theme choice across the site and the /app workspace: the same storage
// key and boot script as the design system's ThemeProvider.
const STORAGE_KEY = THEME_STORAGE_KEY;
export const themeInitScript = THEME_BOOT_SCRIPT;

const listeners = new Set<() => void>();

function isDarkNow(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return isDarkNow();
}

function getServerSnapshot(): boolean {
  return false;
}

export function setDark(dark: boolean) {
  try {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // Ignore storage failures; the class toggle still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <button
      type="button"
      onClick={() => setDark(!dark)}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex size-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground ${className ?? ""}`}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
