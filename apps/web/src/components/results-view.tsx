"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import type { ScoreResult } from "@/lib/types";
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
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackNote, setFeedbackNote] = useState<string | null>(null);
  const [localOnly, setLocalOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<string | null>(null);
  const [filterNote, setFilterNote] = useState<string | null>(null);
  const [filtering, setFiltering] = useState(false);

  async function applyFilters(nextLocal: boolean, nextPrice: string | null) {
    if (!sessionId) return;
    setFiltering(true);
    setFilterNote(null);
    try {
      const scored = await api.score(sessionId, {
        local_only: nextLocal,
        max_pricing_tier: nextPrice,
      });
      setCurrent(scored);
    } catch (err) {
      setFilterNote(err instanceof Error ? err.message : "Could not re-rank with those filters.");
    } finally {
      setFiltering(false);
    }
  }

  async function download(target: string) {
    setExportNote(null);
    try {
      const artifact = await api.exportPersona(target, current.persona);
      const blob = new Blob([artifact.content], { type: "text/plain" });
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
    const created = await api.share(sessionId);
    const url = `${window.location.origin}${created.path}`;
    setShareUrl(url);
    await navigator.clipboard.writeText(url).catch(() => undefined);
  }

  async function remove() {
    if (!sessionId) return;
    await api.deleteSession(sessionId);
    router.push("/");
  }

  async function sendFeedback() {
    if (!rating) return;
    await api.feedback({ session_id: sessionId, rating, comment, useful: rating >= 4 });
    setFeedbackNote("Saved. No name or email is attached.");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          {shareMode ? "Shared interaction signature" : "Interaction signature"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{current.persona.label}</h1>
        <p className="max-w-3xl text-muted-foreground">{current.persona.purpose}</p>
        <p className="text-sm text-muted-foreground">{current.disclaimer}</p>
        {current.privacy ? <p className="text-sm text-muted-foreground">{current.privacy.retention}</p> : null}
      </div>
      {!shareMode && sessionId ? (
        <Card>
          <CardHeader>
            <CardTitle>Rank with constraints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Filters re-run the deterministic ranker. They do not ask a model to pick a winner.
            </p>
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
      <div className="grid gap-3 md:grid-cols-2">
        {[current.primary_stack, current.alternative_stack].map((stack) => (
          <Card key={stack.name}>
            <CardHeader>
              <CardTitle>{stack.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {stack.slots.map((slot) => (
                <Badge key={`${stack.name}-${slot.category}`} variant="secondary">
                  {slot.recommendation.name} · {labelMetric(slot.category)}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <Tabs defaultValue="signature">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="signature">Signature</TabsTrigger>
          <TabsTrigger value="stack">AI stack</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="persona">Persona</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
        </TabsList>
        <TabsContent value="signature" className="space-y-4">
          {current.metrics.map((metric) => (
            <Card key={metric.name}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base capitalize">{labelMetric(metric.name)}</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {pct(metric.score)} · {pct(metric.confidence)} confidence
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={metric.score * 100} />
                {metric.evidence[0] ? <p className="text-sm text-muted-foreground">{metric.evidence[0]}</p> : null}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="stack" className="grid gap-4 md:grid-cols-2">
          {[current.primary_stack, current.alternative_stack].map((stack) => (
            <Card key={stack.name}>
              <CardHeader>
                <CardTitle>{stack.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stack.slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Not enough complementary matches yet.</p>
                ) : (
                  stack.slots.map((slot) => (
                    <div key={`${stack.name}-${slot.category}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{slot.recommendation.name}</p>
                        <Badge variant="secondary">{pct(slot.recommendation.fit)}</Badge>
                      </div>
                      <p className="text-sm capitalize text-muted-foreground">{labelMetric(slot.category)}</p>
                      <p className="text-xs text-muted-foreground">Evaluated {slot.recommendation.last_evaluated_at}</p>
                    </div>
                  ))
                )}
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {stack.rationale.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="products" className="space-y-6">
          {Object.keys(current.products_by_category).length === 0 ? (
            <p className="text-sm text-muted-foreground">No products match these filters.</p>
          ) : null}
          {Object.entries(current.products_by_category).map(([category, recs]) => (
            <div key={category} className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{labelMetric(category)}</h2>
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
                      <p>Base {pct(product.base_fit ?? product.fit)} · freshness {pct(product.freshness ?? 1)} · evaluated {product.last_evaluated_at}</p>
                      <p>Helps: {product.positive_factors.join(", ") || "n/a"}</p>
                      {product.negative_factors.length ? <p>Watch: {product.negative_factors.join(", ")}</p> : null}
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
                    <span className="text-muted-foreground">
                      {pct(model.fit)} · {model.last_evaluated_at}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="persona" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{current.persona.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
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
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => download("generic")}>persona.md</Button>
                <Button variant="outline" onClick={() => download("claude")}>CLAUDE.md</Button>
                <Button variant="outline" onClick={() => download("agents")}>AGENTS.md</Button>
                <Button variant="outline" onClick={() => download("cursor")}>Cursor rule</Button>
                <Button variant="outline" onClick={() => download("json")}>JSON</Button>
              </div>
              {exportNote ? <p className="text-sm text-muted-foreground">{exportNote}</p> : null}
            </CardContent>
          </Card>
        </TabsContent>
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
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {metric.evidence.length ? metric.evidence.map((item) => <li key={item}>{item}</li>) : <li>No quoted evidence for this metric.</li>}
                </ul>
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
              <Button variant="outline" onClick={() => download("json")}>Export JSON profile</Button>
              <Button variant="destructive" onClick={remove}>Delete this session</Button>
            </div>
            {shareUrl ? (
              <p>
                Share URL copied: <Link className="underline" href={shareUrl}>{shareUrl}</Link>
              </p>
            ) : null}
            <div className="space-y-2">
              <p className="font-medium">Was this useful?</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button key={value} variant={rating === value ? "default" : "outline"} size="sm" onClick={() => setRating(value)}>
                    {value}
                  </Button>
                ))}
              </div>
              <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional comment. Do not include your name." />
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
