import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MethodologyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Methodology and limits</h1>
        <p className="text-muted-foreground">
          AI Fit Engine is a workflow preference system. It is not a clinical assessment, intelligence test,
          or hiring screen.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What is observed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Each scenario choice emits typed interaction events such as requested_evidence or delegated_action.</p>
          <p>Optional free text is classified with keyword heuristics. The original wording is kept as evidence.</p>
          <p>Timing is captured in later versions only; fast clicks are not treated as a decision style in v0.1.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>How fit is computed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Metrics are averages of event strengths on a 0–1 scale. Confidence grows with observations and distinct scenarios.</p>
          <p>
            Product fit is one minus a weighted distance between your vector and the product preference vector,
            then adjusted for registry freshness and metric confidence.
          </p>
          <p>
            UI percentages are rounded for readability. Internally this is a normalized fit score, not a validated probability.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>What we do not infer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>No race, religion, health, politics, or other protected attributes. No MBTI, Enneagram, or IQ labels.</p>
          <p>Vendor winners are not hard-coded into assessment logic. Adding a product is a registry change.</p>
          <p>v0.1 sessions are in-memory. Delete is available on the API; no identifiable profile is stored by default.</p>
        </CardContent>
      </Card>
      <Button asChild className="w-fit">
        <Link href="/assessment">Start the assessment</Link>
      </Button>
    </div>
  );
}
