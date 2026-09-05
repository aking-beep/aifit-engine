"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveResult, saveSession } from "@/lib/session-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const audiences = ["Homework", "Home life", "Shop or studio", "Side hustle", "Small team"];

export default function HomePage() {
  const router = useRouter();
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  async function runDemo() {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const demo = await api.demoSession();
      saveSession(demo.session);
      saveResult(demo.session_id, demo.result);
      router.push(`/results/${demo.session_id}`);
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Could not load the example.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-8rem] h-80 w-80 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-48 -left-24 h-72 w-72 rounded-full bg-accent blur-3xl"
      />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-12">
        <section className="space-y-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">For everyday people</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Find the AI that fits you.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Five lively minutes. No résumé, no corporate jargon, no wrong answers. Fit watches how you ask, check, and
            decide — then gives you a setup you can paste into ChatGPT, Claude, Gemini, Cursor, or an agent.
          </p>
          <div className="flex flex-wrap gap-2">
            {audiences.map((label) => (
              <span
                key={label}
                className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button render={<Link href="/assessment" />} size="lg">
              Find my fit
            </Button>
            <Button size="lg" variant="outline" onClick={runDemo} disabled={demoLoading}>
              {demoLoading ? "Loading example…" : "See an example"}
            </Button>
          </div>
          {demoError ? <p className="text-sm text-destructive">{demoError}</p> : null}
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Your style, not a type</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Two neighbors can use the same app and still need different settings. Fit notices whether you want
              sources, a quick answer, or something you can tweak.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tools that match real life</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Homework, a shop, a studio, or a small team all count. You get a helper for everyday questions, looking
              things up, making stuff, and keeping private work on your device.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Leave with something you can use</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Copy-paste instructions for ChatGPT, Claude, Gemini, Cursor, and agents — written in plain language, ready
              today.
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
