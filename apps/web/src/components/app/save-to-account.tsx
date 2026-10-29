"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banner, Button } from "@/design";
import { account, AccountApiError, type Status } from "@/lib/account";
import type { InteractionEvent, QuizNote } from "@/lib/types";

type Payload = { kind: "quiz"; events: InteractionEvent[]; notes?: QuizNote[] } | { kind: "check"; intake: Record<string, unknown>; label?: string };

/**
 * Keeps a quiz result or task check in the signed-in account. The server
 * re-scores the answers; nothing computed in the browser is stored.
 */
export function SaveToAccount({ payload, auto = false }: { payload: Payload | null; auto?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    account.status().then(setStatus).catch(() => setStatus(null));
  }, []);

  const save = async () => {
    if (!payload) return;
    setState("saving");
    try {
      if (payload.kind === "quiz") await account.saveQuiz(payload.events, payload.notes ?? []);
      else await account.saveCheck(payload.intake, payload.label);
      setState("saved");
    } catch (err) {
      setState("error");
      setMessage(err instanceof AccountApiError ? err.message : "Could not save.");
    }
  };

  useEffect(() => {
    if (auto && status?.signed_in && payload && state === "idle") queueMicrotask(() => void save());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, status?.signed_in, payload]);

  if (!status?.accounts.enabled || !payload) return null;
  if (!status.signed_in) {
    return (
      <Banner tone="info" title="Keep this in an account" action={<Link href="/signup" className="text-label-md text-accent underline underline-offset-2">Create account</Link>}>
        Sign up to keep your profile, save tools and download setup packages later. Then run the quiz again to save it.
      </Banner>
    );
  }
  if (state === "saved") {
    return (
      <Banner tone="success" title="Saved to your account" action={<Link href="/app" className="text-label-md underline underline-offset-2">Open your dashboard</Link>}>
        It is in your assessment history.
      </Banner>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface p-4">
      <p className="flex-1 text-body-sm text-fg-2">{state === "error" ? message : "Signed in. Save this to your account to use it in your dashboard."}</p>
      <Button variant="primary" size="sm" loading={state === "saving"} onClick={save}>Save to my account</Button>
    </div>
  );
}
