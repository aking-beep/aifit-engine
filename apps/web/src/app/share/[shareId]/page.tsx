"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ScoreResult } from "@/lib/types";
import { decodeSharePayload } from "@/lib/session-store";
import { Button } from "@/components/ui/button";
import { ResultsView } from "@/components/results-view";

export default function SharePage() {
  const params = useParams<{ shareId: string }>();
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hash = window.location.hash.replace(/^#/, "");
        if (hash) {
          const decoded = await decodeSharePayload(hash);
          if (decoded && !cancelled) {
            setResult(decoded);
            return;
          }
        }
        const snapshot = await api.getShare(params.shareId);
        if (!cancelled) setResult(snapshot);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Share not found.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.shareId]);

  if (error || !result) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">{error ? "Share unavailable" : "Loading share…"}</h1>
        {error ? (
          <Button render={<Link href="/assessment" />}>Build your own profile</Button>
        ) : null}
      </div>
    );
  }
  return <ResultsView result={result} shareMode />;
}
