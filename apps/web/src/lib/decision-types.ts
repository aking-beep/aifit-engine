// Response shape of POST /v1/decision. The decision itself is computed by the
// Python engine (aifit.decision), which mirrors @aifit/decision-core; this file
// only describes it so the page can render it. No scoring happens here.

export type Outcome = "no_change" | "conventional_software" | "conventional_automation" | "buy_ai" | "build_ai";

export type DecisionResult = {
  engine: { name: string; version: string; rulesVersion: string; inputHash: string };
  surface: "consumer" | "teams";
  outcome: Outcome;
  runnerUp: Outcome | null;
  confidence: "low" | "medium" | "high";
  summary: string;
  aiSuitability: {
    score: number;
    band: string;
    dimensions: { key: string; score: number; weight: number; known: boolean; reasoning: string }[];
  };
  outcomeScores: {
    outcome: Outcome;
    score: number;
    eligible: boolean;
    excludedBy: string[];
    contributions: { factor: string; points: number }[];
  }[];
  hardConstraints: { id: string; triggered: boolean; effect: string; excludes: Outcome[]; detail: string }[];
  requiredControls: string[];
  toolRequirements: { categories: string[]; localOnly: boolean; freeTierOnly: boolean };
  costs: {
    lines: {
      id: string;
      label: string;
      low: number | null;
      high: number | null;
      unit: "hours" | "usd";
      period: "one_time" | "month";
      basis: string;
      source: string;
    }[];
    hoursSavedPerMonth: number | null;
    uncertainty: "low" | "medium" | "high";
  };
  risk: { level: "low" | "medium" | "high"; score: number; factors: string[] };
  feasibility: { level: "low" | "medium" | "high"; factors: string[] };
  missingInputs: string[];
  contradictions: { id: string; detail: string }[];
  whatWouldChange: string[];
  assumptions: string[];
  limitations: string[];
  validation: { status: "not_validated"; note: string };
};

export type ToolMatch = {
  id: string;
  name: string;
  provider: string;
  category: string;
  homepage: string;
  why: string[];
  checks: { rule: string; passed: boolean; detail: string }[];
  pricing: { tier: string; amount: null; note: string };
  evidence: { source_type: string; title: string; url: string; observed_at: string }[];
  lastEvaluatedAt: string;
  ageDays: number | null;
  stale: boolean;
};

export type DecisionResponse = {
  decision: DecisionResult;
  tools: { matches: ToolMatch[]; excluded: { id: string; name: string; reasons: string[] }[]; note: string };
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  no_change: "No change",
  conventional_software: "Ordinary software",
  conventional_automation: "Rules-based automation",
  buy_ai: "Use an AI tool",
  build_ai: "Build something with AI",
};

export const MISSING_LABEL: Record<string, string> = {
  frequencyPerMonth: "How often it happens",
  minutesPerOccurrence: "How long it takes each time",
  monthlyBudgetUsd: "Monthly budget",
  timelineWeeks: "Timeline",
  hourlyValueUsd: "What an hour of your time is worth (only needed for dollar figures)",
};
