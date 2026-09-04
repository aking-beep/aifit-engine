"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ScoreResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ResultsView } from "@/components/results-view";

export default function ResultsPage() {
  const params = useParams<{ sessionId: string }>();
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const scored = await api.score(params.sessionId);
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
        <Button render={<Link href="/assessment" />}>Run the assessment</Button>
      </div>
    );
  }
  return <ResultsView result={result} sessionId={params.sessionId} />;
}
