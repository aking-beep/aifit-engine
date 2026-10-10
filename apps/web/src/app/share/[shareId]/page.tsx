"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ScoreResult } from "@/lib/types";
import { decodeSharePayload, normalizeResult } from "@/lib/share-snapshot";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ResultsView } from "@/components/results-view";

export default function SharePage() {
  const params = useParams<{ shareId: string }>();
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const damaged = {
      title: "This link is damaged",
      detail: "The share link looks cut off or edited, so we could not read the profile. Ask for a fresh link.",
    };
    (async () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const decoded = await decodeSharePayload(hash);
        if (cancelled) return;
        if (decoded) {
          setResult(decoded);
          return;
        }
        if (params.shareId === "profile") {
          setError(damaged);
          return;
        }
      }
      try {
        const snapshot = normalizeResult(await api.getShare(params.shareId));
        if (cancelled) return;
        if (snapshot) setResult(snapshot);
        else setError(damaged);
      } catch {
        if (!cancelled) {
          setError({
            title: "Share unavailable",
            detail: "This share link has expired or was deleted. Share links last 30 days.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.shareId]);

  if (error || !result) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">{error ? error.title : "Loading share…"}</h1>
        {error ? (
          <>
            <p className="text-muted-foreground">{error.detail}</p>
            <Link href="/assessment" className={cn(buttonVariants(), "inline-flex min-h-11")}>
              Build your own profile
            </Link>
          </>
        ) : null}
      </div>
    );
  }
  return <ResultsView result={result} shareMode />;
}
