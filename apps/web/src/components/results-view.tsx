"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import type { ScoreResult } from "@/lib/types";
import { clearSession, encodeSharePayload, loadSession, saveResult } from "@/lib/session-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function labelMetric(name: string) {
  return name.replaceAll("_", " ");
}

export function ResultsView({
  result,
  sessionId,
  shareMode = false,
}: {
  result: ScoreResult;
  sessionId?: string;
  shareMode?: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(result);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackNote, setFeedbackNote] = useState<string | null>(null);
  const [localOnly, setLocalOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<string | null>(null);
  const [filterNote, setFilterNote] = useState<string | null>(null);
  const [filtering, setFiltering] = useState(false);

  const workstyle = current.workstyle;
  const maturity = workstyle?.maturity;
  const stack = current.operating_stack?.length ? current.operating_stack : null;
  const routing = current.model_routing ?? [];
  const workflow = current.workflow ?? [];

  async function applyFilters(nextLocal: boolean, nextPrice: string | null) {
    if (!sessionId) return;
    setFiltering(true);
    setFilterNote(null);
    try {
      const stored = loadSession(sessionId);
      const scored = stored
        ? await api.scoreFull(stored, { local_only: nextLocal, max_pricing_tier: nextPrice })
        : await api.score(sessionId, { local_only: nextLocal, max_pricing_tier: nextPrice });
      setCurrent(scored);
      saveResult(sessionId, scored);
    } catch (err) {
      setFilterNote(err instanceof Error ? err.message : "Could not re-rank with those filters.");
    } finally {
      setFiltering(false);
    }
  }

  async function download(target: string) {
    setExportNote(null);
    try {
      const artifact = await api.exportPersona(target, current);
      const binary = artifact.encoding === "base64";
      const blob = binary
        ? new Blob([Uint8Array.from(atob(artifact.content), (char) => char.charCodeAt(0))])
        : new Blob([artifact.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = artifact.filename.split("/").pop() || artifact.filename;
      link.click();
      URL.revokeObjectURL(url);
      setExportNote(`Downloaded ${artifact.filename}`);
    } catch (err) {
      setExportNote(err instanceof Error ? err.message : "Export failed.");
    }
  }

  async function share() {
    if (!sessionId) return;
    let path = `/share/${sessionId}`;
    try {
      const created = await api.share(sessionId);
      path = created.path;
    } catch {
      // Serverless share storage is best-effort. The compressed hash still works.
    }
    const encoded = await encodeSharePayload(current);
    const url = `${window.location.origin}${path}#${encoded}`;
    setShareUrl(url);
    await navigator.clipboard.writeText(url).catch(() => undefined);
  }

  async function copyInstructions() {
    if (!current.instructions) return;
    await navigator.clipboard.writeText(current.instructions).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function remove() {
    if (!sessionId) return;
    clearSession(sessionId);
    await api.deleteSession(sessionId).catch(() => undefined);
    router.push("/");
  }

  async function sendFeedback() {
    if (!rating) return;
    await api.feedback({ session_id: sessionId, rating, comment, useful: rating >= 4 });
    setFeedbackNote("Saved. No name or email is attached.");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <Card>
        <CardHeader className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {shareMode ? "Shared AI operating profile" : "Your AI operating profile"}
          </p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">{workstyle?.label ?? current.persona.label}</h1>
              <p className="max-w-2xl text-muted-foreground">{workstyle?.summary ?? current.persona.purpose}</p>
            </div>
            {maturity ? (
              <div className="rounded-xl border px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">AI Fit Score</p>
                <p className="text-3xl font-semibold">{maturity.score}</p>
                <p className="text-sm capitalize text-muted-foreground">{maturity.band}</p>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {!shareMode ? (
            <>
              <Button onClick={() => download("pack")}>Export my AI setup</Button>
              <Button variant="outline" onClick={share}>
                Copy share card
              </Button>
              <Button variant="outline" onClick={copyInstructions} disabled={!current.instructions}>
                {copied ? "Copied instructions" : "Copy system instructions"}
              </Button>
            </>
          ) : (
            <Button render={<Link href="/assessment" />}>Run your own diagnostic</Button>
          )}
        </CardContent>
      </Card>

      {workstyle?.dimensions?.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Workstyle</h2>
          <p className="text-sm text-muted-foreground">{workstyle.disclaimer}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {workstyle.dimensions.map((dimension) => (
              <Card key={dimension.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{dimension.label}</CardTitle>
                    <span className="text-sm text-muted-foreground">{pct(dimension.score)}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={dimension.score * 100} />
                </CardContent>
              </Card>
            ))}
          </div>
          {maturity?.note ? <p className="text-xs text-muted-foreground">{maturity.note} Retest in a few months as products and your usage change.</p> : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">AI stack</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(stack ?? current.primary_stack.slots.map((slot) => ({
            role: slot.category,
            label: labelMetric(slot.category),
            product: slot.recommendation,
          }))).map((slot) => (
            <Card key={slot.role}>
              <CardHeader>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{slot.label}</p>
                <CardTitle>{slot.product?.name ?? "No strong match yet"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {slot.product ? `Fit ${pct(slot.product.fit)} · evaluated ${slot.product.last_evaluated_at}` : "This role stayed empty under the current filters."}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {routing.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Model router</h2>
          <Card>
            <CardContent className="divide-y p-0">
              {routing.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{row.work}</span>
                  <span className="text-muted-foreground">{row.model?.name ?? "n/a"}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {workflow.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Recommended workflow</h2>
          <div className="grid gap-3 md:grid-cols-5">
            {workflow.map((step) => (
              <Card key={step.id} className={step.emphasis ? "border-primary/50" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{step.label}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{step.instruction}</CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your recommended AI working persona</h2>
        <p className="text-sm text-muted-foreground">How AI should interact with you — not a personality type.</p>
        <Card>
          <CardHeader>
            <CardTitle>{current.persona.label}</CardTitle>
            <p className="text-sm text-muted-foreground">{current.persona.purpose}</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {current.persona.traits?.length ? (
              <div className="flex flex-wrap gap-2">
                {current.persona.traits.map((trait) => (
                  <Badge key={trait} variant="secondary">
                    {trait}
                  </Badge>
                ))}
              </div>
            ) : null}
            {(["interaction_rules", "response_rules", "decision_rules", "tool_rules"] as const).map((key) => (
              <div key={key}>
                <p className="mb-1 font-medium capitalize">{labelMetric(key)}</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {current.persona[key].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-muted-foreground">{current.persona.disclaimer}</p>
            <div className="space-y-2">
              <p className="font-medium">Install this configuration</p>
              <p className="text-muted-foreground">Download the files and paste them into the matching product. Edit anything that does not fit.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => download("pack")}>
                ai-profile.zip
              </Button>
              <Button variant="outline" onClick={() => download("profile")}>
                PROFILE.md
              </Button>
              <Button variant="outline" onClick={() => download("chatgpt")}>
                ChatGPT
              </Button>
              <Button variant="outline" onClick={() => download("claude")}>
                CLAUDE.md
              </Button>
              <Button variant="outline" onClick={() => download("gemini")}>
                Gemini
              </Button>
              <Button variant="outline" onClick={() => download("cursor")}>
                Cursor rule
              </Button>
              <Button variant="outline" onClick={() => download("agents")}>
                AGENTS.md
              </Button>
              <Button variant="outline" onClick={() => download("routing")}>
                model-routing.json
              </Button>
            </div>
            {exportNote ? <p className="text-muted-foreground">{exportNote}</p> : null}
          </CardContent>
        </Card>
      </section>

      {!shareMode && sessionId ? (
        <Card>
          <CardHeader>
            <CardTitle>Rank with constraints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">Filters re-run the deterministic ranker. They do not ask a model to pick a winner.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={localOnly ? "default" : "outline"}
                disabled={filtering}
                onClick={() => {
                  const next = !localOnly;
                  setLocalOnly(next);
                  void applyFilters(next, maxPrice);
                }}
              >
                Local only
              </Button>
              {(["low", "mixed", "high"] as const).map((tier) => (
                <Button
                  key={tier}
                  size="sm"
                  variant={maxPrice === tier ? "default" : "outline"}
                  disabled={filtering}
                  onClick={() => {
                    const next = maxPrice === tier ? null : tier;
                    setMaxPrice(next);
                    void applyFilters(localOnly, next);
                  }}
                >
                  Max {tier} cost
                </Button>
              ))}
            </div>
            {filtering ? <p className="text-muted-foreground">Re-ranking…</p> : null}
            {filterNote ? <p className="text-destructive">{filterNote}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="evidence">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="products">All products</TabsTrigger>
          <TabsTrigger value="models">All models</TabsTrigger>
        </TabsList>
        <TabsContent value="evidence" className="space-y-4">
          {current.metrics.map((metric) => (
            <Card key={`ev-${metric.name}`}>
              <CardHeader>
                <CardTitle className="capitalize">{labelMetric(metric.name)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>
                  {metric.observations} observations across {metric.scenario_ids.join(", ") || "no scenarios"}.
                </p>
                <Progress className="my-2" value={metric.score * 100} />
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {metric.evidence.length ? metric.evidence.map((item) => <li key={item}>{item}</li>) : <li>No quoted evidence for this metric.</li>}
                </ul>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="products" className="space-y-6">
          {Object.entries(current.products_by_category).map(([category, recs]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{labelMetric(category)}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {recs.map((product) => (
                  <Card key={product.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle>{product.name}</CardTitle>
                        <Badge>{pct(product.fit)}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>Evaluated {product.last_evaluated_at}</p>
                      <p>Helps: {product.positive_factors.join(", ") || "n/a"}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="models" className="space-y-4">
          {Object.entries(current.models).map(([workload, recs]) => (
            <Card key={workload}>
              <CardHeader>
                <CardTitle className="capitalize">{labelMetric(workload)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recs.slice(0, 3).map((model) => (
                  <div key={model.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{model.name}</span>
                    <span className="text-muted-foreground">{pct(model.fit)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {!shareMode && sessionId ? (
        <Card>
          <CardHeader>
            <CardTitle>Save, share, or delete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Button onClick={share}>Copy share link</Button>
              <Button variant="outline" onClick={() => download("pack")}>
                Export zip
              </Button>
              <Button variant="destructive" onClick={remove}>
                Delete this session
              </Button>
            </div>
            {shareUrl ? (
              <p>
                Share URL copied:{" "}
                <Link className="underline" href={shareUrl}>
                  {shareUrl}
                </Link>
              </p>
            ) : null}
            <div className="space-y-2">
              <p className="font-medium">Did you install or change anything because of this?</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button key={value} variant={rating === value ? "default" : "outline"} size="sm" onClick={() => setRating(value)}>
                    {value}
                  </Button>
                ))}
              </div>
              <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional. Do not include your name." />
              <Button variant="outline" onClick={sendFeedback} disabled={!rating}>
                Send feedback
              </Button>
              {feedbackNote ? <p className="text-muted-foreground">{feedbackNote}</p> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
