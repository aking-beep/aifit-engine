import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12">
      <section className="space-y-5">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Interactive diagnostic</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Which AI products fit how you actually work?
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          This measures how you interact with AI, not your personality. Eight short scenarios observe
          evidence-seeking, collaboration, and workflow preferences, then match you to products, models,
          and a portable working configuration.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/assessment">Start the assessment</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/methodology">How scoring works</Link>
          </Button>
        </div>
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
            Products and models stay distinct. Every recommendation carries a last-evaluated date.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Explainable fit</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Scores are normalized similarity, not probabilities. You can inspect evidence and export the persona.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
