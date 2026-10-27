"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { trackActivation } from "@/lib/api";
import {
  clearHistory,
  getHistoryServerSnapshot,
  getHistorySnapshot,
  removeHistory,
  subscribeHistory,
} from "@/lib/history";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function HistoryPage() {
  const entries = useSyncExternalStore(subscribeHistory, getHistorySnapshot, getHistoryServerSnapshot);

  useEffect(() => {
    trackActivation("history_viewed");
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Your history</h1>
        <p className="text-muted-foreground">
          Quiz results and task checks saved in this browser only. Fit has no accounts, so this list does not follow you
          to another device, and clearing your browser data clears it.
        </p>
      </header>
      {entries === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-6 text-sm">
            <p>Nothing saved yet.</p>
            <div className="flex flex-wrap gap-4">
              <Link href="/assessment" className="underline underline-offset-4">
                Take the quiz
              </Link>
              <Link href="/check" className="underline underline-offset-4">
                Check a task
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="space-y-3" aria-label="Saved results">
            {entries.map((e) => (
              <li key={`${e.kind}:${e.id}`}>
                <Card>
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link
                        href={e.kind === "check" ? `/check?id=${encodeURIComponent(e.id)}` : `/results/${encodeURIComponent(e.id)}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {e.label}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {e.kind === "check" ? "Task check" : "AI style quiz"}
                        {e.detail && e.kind === "check" ? ` · ${e.detail}` : ""} ·{" "}
                        <time dateTime={e.savedAt}>{new Date(e.savedAt).toLocaleString()}</time>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      aria-label={`Delete ${e.label}`}
                      onClick={() => {
                        removeHistory(e);
                      }}
                    >
                      Delete
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            onClick={() => {
              clearHistory();
            }}
          >
            Delete everything saved in this browser
          </Button>
          <p className="text-xs text-muted-foreground">
            Deleting here removes this browser&apos;s copy. To delete the server copy of a quiz session, use Delete on its
            results page.
          </p>
        </>
      )}
    </div>
  );
}
