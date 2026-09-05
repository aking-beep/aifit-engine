import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Transparency</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">How scoring works</h1>
      <p className="mt-4 text-muted-foreground">
        Workprint scores what you ask, how you steer, and how much evidence you demand — then ranks a dated product
        and model registry with explicit weights. An LLM may label free text. It never picks the winner.
      </p>

      <section className="mt-10 space-y-8 text-sm leading-6">
        <div>
          <h2 className="text-lg font-semibold">1. How scoring works</h2>
          <p className="mt-2 text-muted-foreground">
            Each round logs a structured interaction event. Events become a 0–1 metric vector with confidence from
            observation count and scenario spread. The ranker is deterministic math, not a chat model.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">2. Registry</h2>
          <p className="mt-2 text-muted-foreground">
            Products and models are separate catalogs. Every public row has a last-evaluated date and evidence. Stale
            rows lose confidence; they are not marked “bad.”
          </p>
          <p className="mt-2">
            <Link href="/registry" className="underline underline-offset-4">
              Open the seed registry
            </Link>
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">3. Evidence</h2>
          <p className="mt-2 text-muted-foreground">
            Results quote the choices that drove each dimension and show fit as normalized similarity, not a
            probability. You can export or delete the session from the profile page.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">4. Version</h2>
          <p className="mt-2 text-muted-foreground">
            Workprint 0.3. Adaptive diagnostic, usually four scenarios (about five minutes), continuing only when a
            core dimension still lacks signal. Scoring stays server-side.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">5. Limitations</h2>
          <p className="mt-2 text-muted-foreground">
            The catalog is illustrative seed data. Fit scores are not scientifically validated. This is not a
            personality test, clinical instrument, or hiring screen. Do not use it that way.
          </p>
        </div>
      </section>

      <div className="mt-10">
        <Button render={<Link href="/assessment" />}>Build my AI profile</Button>
      </div>
    </div>
  );
}
