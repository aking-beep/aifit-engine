import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MISSING_LABEL, OUTCOME_LABEL, type DecisionResponse } from "@/lib/decision-types";

// Presentation only. Every number and sentence here comes from the decision
// engine's response; this component decides nothing.

function formatAmount(value: number | null, unit: "hours" | "usd") {
  if (value === null) return null;
  if (unit === "usd") return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} h`;
}

function range(low: number | null, high: number | null, unit: "hours" | "usd") {
  const a = formatAmount(low, unit);
  const b = formatAmount(high, unit);
  if (a === null || b === null) return "Not estimated";
  return a === b ? a : `${a} – ${b}`;
}

const BASIS_LABEL: Record<string, string> = {
  user_input: "your answer",
  heuristic: "rule of thumb",
  catalog: "dated price list",
  benchmark: "published figure",
  calibrated: "calibrated",
  measured: "measured",
};

export function DecisionView({ data, goal }: { data: DecisionResponse; goal?: string }) {
  const d = data.decision;
  const winner = d.outcomeScores.find((o) => o.outcome === d.outcome);
  const triggered = d.hardConstraints.filter((h) => h.triggered);
  const max = Math.max(...d.outcomeScores.map((o) => o.score), 1);

  return (
    <div className="space-y-6" data-testid="decision-result">
      <section aria-labelledby="decision-heading" className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Our recommendation</p>
        <h2 id="decision-heading" className="text-3xl font-semibold tracking-tight" data-outcome={d.outcome}>
          {OUTCOME_LABEL[d.outcome]}
        </h2>
        <p className="max-w-2xl text-lg text-muted-foreground">{d.summary}</p>
        {goal ? <p className="text-sm text-muted-foreground">For: “{goal}”</p> : null}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Confidence: {d.confidence}</Badge>
          <Badge variant="outline">
            AI suitability: {d.aiSuitability.score}/100 ({d.aiSuitability.band})
          </Badge>
          <Badge variant="outline">Risk: {d.risk.level}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{d.validation.note}</p>
      </section>

      {d.contradictions.length > 0 ? (
        <Card role="alert" className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Some answers do not fit together</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {d.contradictions.map((c) => (
                <li key={c.id}>{c.detail}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All five options, compared</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-3">
            {d.outcomeScores.map((o) => (
              <li key={o.outcome} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={o.outcome === d.outcome ? "font-semibold" : ""}>
                    {OUTCOME_LABEL[o.outcome]}
                    {o.outcome === d.outcome ? " — recommended" : ""}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {o.eligible ? `${o.score}` : "ruled out"}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted" aria-hidden>
                  <div
                    className={`h-2 rounded-full ${o.eligible ? "bg-primary" : "bg-muted-foreground/30"}`}
                    style={{ width: `${Math.max(2, (o.score / max) * 100)}%` }}
                  />
                </div>
                {!o.eligible ? (
                  <p className="text-xs text-muted-foreground">Ruled out by a hard rule: {o.excludedBy.join(", ")}.</p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Scores compare the five options with each other. They are not probabilities of success.
          </p>
        </CardContent>
      </Card>

      {winner ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Why {OUTCOME_LABEL[d.outcome].toLowerCase()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ul className="space-y-1">
              {winner.contributions
                .filter((c) => c.factor !== "base")
                .map((c) => (
                  <li key={c.factor} className="flex justify-between gap-3">
                    <span>{c.factor}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {c.points > 0 ? "+" : ""}
                      {c.points}
                    </span>
                  </li>
                ))}
            </ul>
            {d.whatWouldChange.length > 0 ? (
              <div className="pt-2">
                <p className="font-medium">What would change the answer</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {d.whatWouldChange.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {triggered.length > 0 || d.requiredControls.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rules that applied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {triggered.length > 0 ? (
              <ul className="space-y-2">
                {triggered.map((h) => (
                  <li key={h.id}>
                    <span className="font-mono text-xs text-muted-foreground">{h.id}</span>
                    <p>{h.detail}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {d.requiredControls.length > 0 ? (
              <div>
                <p className="font-medium">Before you start</p>
                <ul className="list-disc space-y-1 pl-5">
                  {d.requiredControls.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              These come from fixed rules, not from an AI. Fit does not check any vendor&apos;s security or compliance
              claims.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Time and cost</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Cost and effort estimates with their basis</caption>
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="py-1 pr-3 font-medium">Item</th>
                  <th scope="col" className="py-1 pr-3 font-medium">Estimate</th>
                  <th scope="col" className="py-1 font-medium">Based on</th>
                </tr>
              </thead>
              <tbody>
                {d.costs.lines.map((l) => (
                  <tr key={l.id} className="border-t border-border/60 align-top">
                    <th scope="row" className="py-2 pr-3 font-normal">
                      {l.label}
                      <span className="block text-xs text-muted-foreground">
                        {l.period === "month" ? "per month" : "one time"}
                      </span>
                    </th>
                    <td className="py-2 pr-3 tabular-nums">{range(l.low, l.high, l.unit)}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {BASIS_LABEL[l.basis] ?? l.basis} — {l.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Uncertainty: {d.costs.uncertainty}. Fit never makes up prices.</p>
        </CardContent>
      </Card>

      {data.tools.matches.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tools to compare</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="tool-comparison">
                <caption className="sr-only">Tools that pass your rules, with pricing tier and when each was last checked</caption>
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th scope="col" className="py-1 pr-3 font-medium">Tool</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Why it fits</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Price</th>
                    <th scope="col" className="py-1 font-medium">Last checked</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tools.matches.map((t) => (
                    <tr key={t.id} className="border-t border-border/60 align-top">
                      <th scope="row" className="py-2 pr-3 font-medium">
                        <a href={t.homepage} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                          {t.name}
                        </a>
                        <span className="block text-xs font-normal text-muted-foreground">{t.provider}</span>
                      </th>
                      <td className="py-2 pr-3 text-xs">
                        <ul className="space-y-1">
                          {t.why.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-2 pr-3 text-xs">{t.pricing.note}</td>
                      <td className="py-2 text-xs">
                        {t.lastEvaluatedAt}
                        {t.stale ? <span className="block text-destructive">May be out of date</span> : null}
                        {t.evidence[0] ? (
                          <a href={t.evidence[0].url} target="_blank" rel="noreferrer" className="block underline-offset-4 hover:underline">
                            Source
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{data.tools.note}</p>
            {data.tools.excluded.length > 0 ? (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Tools left out by your rules ({data.tools.excluded.length})</summary>
                <ul className="mt-2 space-y-1">
                  {data.tools.excluded.map((t) => (
                    <li key={t.id}>
                      {t.name}: {t.reasons.join(" ")}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk and effort</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium">Risk: {d.risk.level}</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {d.risk.factors.length > 0 ? d.risk.factors.map((f) => <li key={f}>{f}</li>) : <li>Nothing notable.</li>}
            </ul>
          </div>
          <div>
            <p className="font-medium">Doable with what you have: {d.feasibility.level}</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {d.feasibility.factors.length > 0 ? (
                d.feasibility.factors.map((f) => <li key={f}>{f}</li>)
              ) : (
                <li>Nothing in your answers stands in the way.</li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      <details className="rounded-xl border border-border/80 p-4 text-sm">
        <summary className="cursor-pointer font-medium">Assumptions, limits and missing answers</summary>
        <div className="mt-3 space-y-3 text-muted-foreground">
          {d.missingInputs.length > 0 ? (
            <div>
              <p className="font-medium text-foreground">Answers that would make this sharper</p>
              <ul className="list-disc pl-5">
                {d.missingInputs.map((m) => (
                  <li key={m}>{MISSING_LABEL[m] ?? m}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <ul className="list-disc pl-5">
            {[...d.assumptions, ...d.limitations].map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="font-mono text-xs">
            {d.engine.name} {d.engine.version} · {d.engine.rulesVersion} · input {d.engine.inputHash.slice(0, 12)}
          </p>
        </div>
      </details>
    </div>
  );
}
