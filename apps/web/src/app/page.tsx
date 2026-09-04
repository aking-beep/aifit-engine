"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveResult, saveSession } from "@/lib/session-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      setDemoError(err instanceof Error ? err.message : "Demo failed.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12">
      <section className="space-y-5">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Interactive diagnostic</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Which AI products fit how you actually work?
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          This measures how you interact with AI, not your personality. Eight scenarios observe evidence-seeking,
          collaboration, and workflow preferences, then match you to products, models, and a portable working configuration.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button render={<Link href="/assessment" />} size="lg">
            Start the assessment
          </Button>
          <Button size="lg" variant="outline" onClick={runDemo} disabled={demoLoading}>
            {demoLoading ? "Scoring sample…" : "See a scored sample"}
          </Button>
          <Button render={<Link href="/methodology" />} variant="ghost" size="lg">
            How scoring works
          </Button>
        </div>
        {demoError ? <p className="text-sm text-destructive">{demoError}</p> : null}
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Observable behavior</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Choices and optional free text become interaction events. No MBTI, IQ, or clinical labels.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Separate registries</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Products and models stay distinct across every launch category. Each entry carries a last-evaluated date.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Explainable fit</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Scores are normalized similarity, not probabilities. Inspect evidence, share anonymously, or delete the session.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
