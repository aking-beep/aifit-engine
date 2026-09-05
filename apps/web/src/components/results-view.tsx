"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import type { ScoreResult } from "@/lib/types";
import { clearSession, encodeSharePayload, loadSession, saveResult } from "@/lib/session-store";
import { WorkstyleCard } from "@/components/workstyle-card";
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
  const [copied, setCopied] = useState<"instructions" | "card" | "guide" | null>(null);
  const [activeInstall, setActiveInstall] = useState(current.install_guides?.[0]?.id ?? "chatgpt");
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
  const guides = current.install_guides ?? [];
  const activeGuide = guides.find((guide) => guide.id === activeInstall) ?? guides[0];

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

  async function copy(text: string, kind: "instructions" | "card" | "guide") {
    if (!text) return;
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
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
    setFeedbackNote("Saved. The question that matters: did you install or change anything?");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
      <section className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
          {shareMode ? "A shared AI style" : "Your AI style"}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight">{workstyle?.label ?? current.persona.label}</h1>
            <p className="text-lg text-muted-foreground">{workstyle?.narrative ?? workstyle?.summary ?? current.persona.purpose}</p>
          </div>
          {maturity ? (
            <div className="rounded-xl border px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Fit score</p>
              <p className="text-3xl font-semibold">{maturity.score}</p>
              <p className="text-sm capitalize text-muted-foreground">{maturity.band}</p>
            </div>
          ) : null}
        </div>
        {!shareMode ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => download("pack")}>Save my AI setup</Button>
            <Button variant="outline" onClick={share}>
              Share this profile
            </Button>
            <Button variant="outline" onClick={() => copy(current.instructions || "", "instructions")} disabled={!current.instructions}>
              {copied === "instructions" ? "Copied instructions" : "Copy system instructions"}
            </Button>
          </div>
        ) : (
          <Button render={<Link href="/assessment" />}>Find your own fit</Button>
        )}
      </section>

      <WorkstyleCard
        result={current}
        copied={copied === "card"}
        onCopy={shareMode ? undefined : () => copy(current.share_card || "", "card")}
      />

      {workstyle?.why?.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Why we think that</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {workstyle.why.map((reason) => (
              <Card key={reason.dimension}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{reason.dimension}</CardTitle>
                    <span className="text-sm text-muted-foreground">{reason.score}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{reason.text}</p>
                  {reason.evidence?.length ? (
                    <ul className="list-disc space-y-1 pl-5">
                      {reason.evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {workstyle?.dimensions?.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">How you like to use AI</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {workstyle.dimensions.map((dimension) => (
              <Card key={dimension.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{dimension.label}</CardTitle>
                    <span className="text-sm font-medium">{dimension.display ?? Math.round(dimension.score * 100)}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={(dimension.display ?? dimension.score * 100)} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tools that fit you</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(stack ?? current.primary_stack.slots.map((slot) => ({
            role: slot.category,
            label: labelMetric(slot.category),
            handles: undefined,
            product: slot.recommendation,
          }))).map((slot) => (
            <Card key={slot.role}>
              <CardHeader>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{slot.label}</p>
                <CardTitle>{slot.product?.name ?? "No strong match yet"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {slot.handles ? <p>{slot.handles}</p> : null}
                {slot.product ? <p>Fit {pct(slot.product.fit)}</p> : <p>This role stayed empty under the current filters.</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {routing.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">What to use each model for</h2>
          <Card>
            <CardContent className="divide-y p-0">
              {routing.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{row.work}</p>
                    {row.handles ? <p className="text-muted-foreground">{row.handles}</p> : null}
                  </div>
                  <span className="text-muted-foreground">{row.model?.name ?? "n/a"}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {workflow.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">A simple way to work</h2>
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
        <h2 className="text-lg font-semibold">How your AI should talk to you</h2>
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
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Set up your apps</h2>
          <p className="text-sm text-muted-foreground">Paste into ChatGPT, Claude, Cursor, Gemini, or an agent.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {guides.map((guide) => (
            <Button key={guide.id} size="sm" variant={activeGuide?.id === guide.id ? "default" : "outline"} onClick={() => setActiveInstall(guide.id)}>
              {guide.label}
            </Button>
          ))}
        </div>
        {activeGuide ? (
          <Card>
            <CardHeader>
              <CardTitle>Set up {activeGuide.label}</CardTitle>
              <p className="text-sm text-muted-foreground">{activeGuide.where}</p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                {activeGuide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => download(activeGuide.export_target)}>Download {activeGuide.filename.split("/").pop()}</Button>
                <Button variant="outline" onClick={() => copy(current.instructions || "", "guide")} disabled={!current.instructions}>
                  {copied === "guide" ? "Copied" : "Copy instructions"}
                </Button>
                <Button variant="outline" onClick={() => download("pack")}>
                  Download all files
                </Button>
              </div>
              {exportNote ? <p className="text-muted-foreground">{exportNote}</p> : null}
            </CardContent>
          </Card>
        ) : null}
      </section>

      <details className="rounded-xl border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">How we scored this</summary>
        <div className="mt-4 space-y-6">
          {!shareMode && sessionId ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Optional filters re-rank the same answers. Nothing is guessed.</p>
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
            </div>
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
        </div>
      </details>

      {!shareMode && sessionId ? (
        <Card>
          <CardHeader>
            <CardTitle>Share or delete</CardTitle>
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
              <p className="font-medium">Did this actually help you use AI?</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button key={value} variant={rating === value ? "default" : "outline"} size="sm" onClick={() => setRating(value)}>
                    {value}
                  </Button>
                ))}
              </div>
              <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional. Did you install a file, switch a tool, or change a workflow?" />
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
