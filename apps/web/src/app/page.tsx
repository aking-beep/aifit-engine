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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-12">
      <section className="space-y-6">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">AI operating profile</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Discover how you work with AI.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Complete an interactive diagnostic that observes how you research, iterate, verify, and delegate. Get
          your AI Workstyle, recommended stack, and a configuration you can install across ChatGPT, Claude, Gemini,
          Cursor, and AI agents.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button render={<Link href="/assessment" />} size="lg">
            Build my AI profile
          </Button>
          <Button size="lg" variant="outline" onClick={runDemo} disabled={demoLoading}>
            {demoLoading ? "Scoring sample…" : "See a sample profile"}
          </Button>
        </div>
        {demoError ? <p className="text-sm text-destructive">{demoError}</p> : null}
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Your AI Workstyle</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Not “what are you trying to do?” — how you actually work with intelligence. Two engineers with the same
            budget can need very different configurations.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your stack</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Products stay distinct from models. Each role gets a job: primary reasoning, research, development, IDE,
            automation, creative, local.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Configure my AI</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Leave with ChatGPT instructions, Claude and CLAUDE.md, Gemini, Cursor rules, and an agent system prompt
            you can paste today.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
