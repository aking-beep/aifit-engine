import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Methodology
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        How AI Fit Engine scores interaction
      </h1>
      <p className="mt-4 text-muted-foreground">
        This is not a personality test. We score how you actually use AI —
        what you ask, how you steer, and how much evidence you demand — then
        rank products and models against that vector.
      </p>

      <section className="mt-10 space-y-6 text-sm leading-6">
        <div>
          <h2 className="text-lg font-semibold">1. Observable events</h2>
          <p className="mt-2 text-muted-foreground">
            Each round logs a structured event: task type, revision, verification,
            source request, tool request, and more. The classifier is keyword-first.
            An optional LLM adapter can label text, but it never ranks products.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">2. Metric vector</h2>
          <p className="mt-2 text-muted-foreground">
            Events become a 0–1 vector (task diversity, revision rate, verification
            rate, tool use, source demand, and so on). Weights live in code and
            are versioned. The ranker is deterministic math, not a chat model.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">3. Registries</h2>
          <p className="mt-2 text-muted-foreground">
            Products and models are separate catalogs. Products have dated
            evidence; stale rows are penalized, not deleted. Models are tagged
            by workload (coding, research, writing, image, video, audio, data).
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">4. Stacks, not a winner</h2>
          <p className="mt-2 text-muted-foreground">
            Results are a primary stack and an alternative stack, plus ranked
            products by category and models by workload. You can filter by cost
            and local-only before ranking. Stale registry rows lose confidence;
            they are not marked “bad.”
          </p>
        </div>
      </section>

      <div className="mt-10 flex gap-3">
        <Button render={<Link href="/assessment" />}>Take the assessment</Button>
        <Button variant="outline" render={<Link href="/registry" />}>
          Open registry
        </Button>
      </div>
    </div>
  );
}
