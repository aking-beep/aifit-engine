"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, trackActivation } from "@/lib/api";
import type { ScoreResult } from "@/lib/types";
import { loadResult, loadSession, saveResult } from "@/lib/session-store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ResultsView } from "@/components/results-view";
import { SaveToAccount } from "@/components/app/save-to-account";
import { ArcCta } from "@/design";
import { ARC_LINKS } from "@/lib/arc";

export default function ResultsPage() {
  const params = useParams<{ sessionId: string }>();
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (result) trackActivation("results_viewed");
  }, [result]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = loadResult(params.sessionId);
        if (cached) {
          if (!cancelled) setResult(cached);
          return;
        }
        const stored = loadSession(params.sessionId);
        if (!stored) throw new Error("This session is not saved in this browser. Run the assessment again.");
        const scored = await api.scoreFull({
          session_id: stored.session_id,
          events: stored.events,
          notes: stored.notes,
        });
        saveResult(params.sessionId, scored);
        if (!cancelled) setResult(scored);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load results.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-muted-foreground">Scoring this session…</div>;
  }
  if (error || !result) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">Results unavailable</h1>
        <p className="text-muted-foreground">{error ?? "This session has no stored events."}</p>
        <Link href="/assessment" className={cn(buttonVariants(), "inline-flex min-h-11")}>
          Run the assessment
        </Link>
      </div>
    );
  }
  const stored = loadSession(params.sessionId);
  const auto = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("save") === "account";
  return (
    <>
      {stored?.events.length ? (
        <div className="mx-auto w-full max-w-5xl px-4 pt-6">
          <SaveToAccount payload={{ kind: "quiz", events: stored.events, notes: stored.notes }} auto={auto} />
        </div>
      ) : null}
      <ResultsView result={result} sessionId={params.sessionId} />
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-12">
        <ArcCta links={ARC_LINKS} app="ai-fit" placement="results" title="Setting up AI for a team, not just yourself?" body="ARC Transformation Group runs the business version of this assessment: should a workload use AI at all, what would it cost to run, and how to ship it safely." />
      </div>
    </>
  );
}
