"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ScoreResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function labelMetric(name: string) {
  return name.replaceAll("_", " ");
}

export default function ResultsPage() {
  const params = useParams<{ sessionId: string }>();
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportNote, setExportNote] = useState<string | null>(null);

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

  async function download(target: string) {
    if (!result) return;
    setExportNote(null);
    try {
      const artifact = await api.exportPersona(target, result.persona);
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

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-muted-foreground">Scoring this session…</div>;
  }

  if (error || !result) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">Results unavailable</h1>
        <p className="text-muted-foreground">{error ?? "This session has no stored events."}</p>
        <Button asChild>
          <Link href="/assessment">Run the assessment</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Interaction signature</p>
        <h1 className="text-3xl font-semibold tracking-tight">{result.persona.label}</h1>
        <p className="max-w-3xl text-muted-foreground">{result.persona.purpose}</p>
        <p className="text-sm text-muted-foreground">{result.disclaimer}</p>
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
          {result.metrics.map((metric) => (
            <Card key={metric.name}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base capitalize">{labelMetric(metric.name)}</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {pct(metric.score)} fit · {pct(metric.confidence)} confidence
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={metric.score * 100} />
                {metric.evidence[0] ? (
                  <p className="text-sm text-muted-foreground">{metric.evidence[0]}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="stack" className="grid gap-4 md:grid-cols-2">
          {[result.primary_stack, result.alternative_stack].map((stack) => (
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
        <TabsContent value="products" className="grid gap-4 md:grid-cols-2">
          {result.products.map((product) => (
            <Card key={product.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{product.name}</CardTitle>
                    <p className="text-sm capitalize text-muted-foreground">{labelMetric(product.category ?? "")}</p>
                  </div>
                  <Badge>{pct(product.fit)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Confidence {pct(product.confidence)} · evaluated {product.last_evaluated_at}</p>
                <p>Helps: {product.positive_factors.join(", ") || "n/a"}</p>
                {product.negative_factors.length ? <p>Watch: {product.negative_factors.join(", ")}</p> : null}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="models" className="space-y-4">
          {Object.entries(result.models).map(([workload, recs]) => (
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
              <CardTitle>{result.persona.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {(["interaction_rules", "response_rules", "decision_rules", "tool_rules"] as const).map((key) => (
                <div key={key}>
                  <p className="mb-1 font-medium capitalize">{labelMetric(key)}</p>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {result.persona[key].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-muted-foreground">{result.persona.disclaimer}</p>
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
          {result.metrics.map((metric) => (
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
    </div>
  );
}
