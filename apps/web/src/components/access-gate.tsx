"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import {
  type AccessMode,
  parseAccessMode,
  pathBypassesGate,
  readStoredUnlock,
  writeStoredUnlock,
} from "@/lib/access-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  children: React.ReactNode;
  initialMode?: string;
  initialNote?: string;
};

export function AccessGate({ children, initialMode, initialNote }: Props) {
  const pathname = usePathname();
  const [mode, setMode] = useState<AccessMode>(() => parseAccessMode(initialMode));
  const [note, setNote] = useState(initialNote ?? "");
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(() => parseAccessMode(initialMode) === "off");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [listed, setListed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUnlocked(readStoredUnlock());
    try {
      setListed(window.localStorage.getItem("aifit.waitlist.v1") === "1");
    } catch {
      // Ignore.
    }
    let cancelled = false;
    api
      .access()
      .then((status) => {
        if (cancelled) return;
        setMode(parseAccessMode(status.mode));
        setNote(status.note || "");
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-muted-foreground">Loading Fit…</div>;
  }
  if (mode === "off" || unlocked || pathBypassesGate(pathname)) {
    return children;
  }

  async function onWaitlist(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.joinWaitlist(email.trim(), "gate");
      try {
        window.localStorage.setItem("aifit.waitlist.v1", "1");
      } catch {
        // Ignore storage failures; the confirmation still shows this visit.
      }
      setListed(true);
      setMessage("You are on the list. We will open slots as we watch whether people finish and use the setup files.");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the waitlist.");
    } finally {
      setBusy(false);
    }
  }

  async function onUnlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.unlock(code.trim());
      writeStoredUnlock();
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Invite first</p>
      <h1 className="text-3xl font-semibold tracking-tight">
        {mode === "code" ? "Enter your access code" : "Fit is opening in waves"}
      </h1>
      <p className="text-muted-foreground">
        {note ||
          (mode === "code"
            ? "This week is invite-only so we can watch finish rate and whether the setup files get used."
            : "Leave an email if you want a slot. How it works, the registry, and shared results stay public.")}
      </p>
      <Card>
        <CardHeader>
          <CardTitle>{mode === "code" ? "Access code" : "Join the waitlist"}</CardTitle>
        </CardHeader>
        <CardContent>
          {mode === "code" ? (
            <form onSubmit={onUnlock} className="space-y-3">
              <label className="block text-sm text-muted-foreground" htmlFor="access-code">
                Code
              </label>
              <input
                id="access-code"
                name="code"
                type="text"
                autoComplete="off"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                required
              />
              <Button type="submit" size="lg" className="min-h-11" disabled={busy || !code.trim()}>
                {busy ? "Checking…" : "Open Fit"}
              </Button>
            </form>
          ) : (
            <form onSubmit={onWaitlist} className="space-y-3">
              <label className="block text-sm text-muted-foreground" htmlFor="waitlist-email">
                Email
              </label>
              <input
                id="waitlist-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                required
              />
              <Button type="submit" size="lg" className="min-h-11" disabled={busy || !email.trim()}>
                {busy ? "Saving…" : "Save my spot"}
              </Button>
            </form>
          )}
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          {message || listed ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {message ||
                "You are on the list. We will open slots as we watch whether people finish and use the setup files."}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
