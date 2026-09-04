export type InteractionEvent = {
  event_type: string;
  scenario_id: string;
  turn_id?: string | null;
  strength?: number;
  evidence?: string | null;
};

export type Choice = {
  id: string;
  label: string;
  events: InteractionEvent[];
};

export type ScenarioTurn = {
  id: string;
  prompt: string;
  hidden_information?: string | null;
  choices: Choice[];
  allow_free_text: boolean;
};

export type Scenario = {
  id: string;
  title: string;
  domain: string;
  setup: string;
  initial_ambiguity?: string | null;
  dimensions: string[];
  turns: ScenarioTurn[];
};

export type Metric = {
  name: string;
  score: number;
  confidence: number;
  observations: number;
  scenario_ids: string[];
  evidence: string[];
};

export type Recommendation = {
  id: string;
  name: string;
  fit: number;
  confidence: number;
  positive_factors: string[];
  negative_factors: string[];
  last_evaluated_at: string;
  category?: string | null;
  base_fit?: number | null;
  freshness?: number | null;
};

export type Stack = {
  name: string;
  slots: { category: string; recommendation: Recommendation }[];
  rationale: string[];
};

export type Persona = {
  label: string;
  purpose: string;
  interaction_rules: string[];
  response_rules: string[];
  decision_rules: string[];
  tool_rules: string[];
  avoid: string[];
  disclaimer: string;
};

export type ScoreResult = {
  metrics: Metric[];
  user_vector: { values: Record<string, number>; confidence: Record<string, number> };
  products: Recommendation[];
  products_by_category: Record<string, Recommendation[]>;
  models: Record<string, Recommendation[]>;
  primary_stack: Stack;
  alternative_stack: Stack;
  persona: Persona;
  disclaimer: string;
};
