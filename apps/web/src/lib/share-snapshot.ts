import type {
  InstallGuide,
  Metric,
  ModelRoute,
  OperatingSlot,
  Persona,
  Recommendation,
  ScoreResult,
  Stack,
  WorkflowStep,
  Workstyle,
} from "./types";

// Share snapshots and stored results are untrusted input: a share hash can be
// edited by anyone and localStorage can hold an older shape. Everything that
// renders a ScoreResult from those sources goes through normalizeResult first.

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function objList(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function optionalNum(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function recommendation(value: unknown): Recommendation | null {
  if (!isObject(value)) return null;
  const id = str(value.id);
  const name = str(value.name, id);
  if (!id && !name) return null;
  return {
    id: id || name,
    name,
    fit: num(value.fit),
    confidence: num(value.confidence),
    positive_factors: strList(value.positive_factors),
    negative_factors: strList(value.negative_factors),
    last_evaluated_at: str(value.last_evaluated_at),
    category: typeof value.category === "string" ? value.category : null,
    base_fit: optionalNum(value.base_fit),
    freshness: optionalNum(value.freshness),
    coverage: optionalNum(value.coverage),
  };
}

function recList(value: unknown): Recommendation[] {
  return Array.isArray(value) ? value.map(recommendation).filter((item): item is Recommendation => item !== null) : [];
}

function recMap(value: unknown): Record<string, Recommendation[]> {
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, list]) => [key, recList(list)]));
}

function stack(value: unknown): Stack {
  const raw = isObject(value) ? value : {};
  const slots = objList(raw.slots)
    .map((slot) => ({ category: str(slot.category), recommendation: recommendation(slot.recommendation) }))
    .filter((slot): slot is Stack["slots"][number] => slot.recommendation !== null);
  return { name: str(raw.name), slots, rationale: strList(raw.rationale) };
}

function persona(value: unknown): Persona | null {
  if (!isObject(value)) return null;
  const label = str(value.label);
  if (!label) return null;
  return {
    label,
    purpose: str(value.purpose),
    traits: strList(value.traits),
    interaction_rules: strList(value.interaction_rules),
    response_rules: strList(value.response_rules),
    decision_rules: strList(value.decision_rules),
    tool_rules: strList(value.tool_rules),
    avoid: strList(value.avoid),
    disclaimer: str(value.disclaimer),
  };
}

function metric(value: Json): Metric {
  return {
    name: str(value.name),
    score: num(value.score),
    confidence: num(value.confidence),
    observations: num(value.observations),
    scenario_ids: strList(value.scenario_ids),
    evidence: strList(value.evidence),
  };
}

function workstyle(value: unknown): Workstyle | undefined {
  if (!isObject(value)) return undefined;
  const maturity = isObject(value.maturity) ? value.maturity : {};
  return {
    label: str(value.label),
    summary: str(value.summary),
    narrative: typeof value.narrative === "string" ? value.narrative : undefined,
    why: objList(value.why).map((item) => ({
      dimension: str(item.dimension),
      score: num(item.score),
      text: str(item.text),
      evidence: strList(item.evidence),
    })),
    dimensions: objList(value.dimensions).map((item) => ({
      id: str(item.id),
      label: str(item.label),
      score: num(item.score),
      display: optionalNum(item.display) ?? undefined,
      confidence: num(item.confidence),
    })),
    maturity: {
      score: num(maturity.score),
      band: str(maturity.band),
      coverage: num(maturity.coverage),
      note: str(maturity.note),
    },
    disclaimer: str(value.disclaimer),
  };
}

function operatingStack(value: unknown): OperatingSlot[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return objList(value).map((slot) => ({
    role: str(slot.role),
    label: str(slot.label),
    handles: typeof slot.handles === "string" ? slot.handles : undefined,
    product: recommendation(slot.product),
  }));
}

function modelRouting(value: unknown): ModelRoute[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return objList(value).map((row) => ({
    id: str(row.id),
    work: str(row.work),
    workload: str(row.workload),
    handles: typeof row.handles === "string" ? row.handles : undefined,
    model: recommendation(row.model),
  }));
}

function workflow(value: unknown): WorkflowStep[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return objList(value).map((step) => ({
    id: str(step.id),
    label: str(step.label),
    emphasis: step.emphasis === true,
    instruction: str(step.instruction),
  }));
}

function installGuides(value: unknown): InstallGuide[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return objList(value)
    .map((guide) => ({
      id: str(guide.id),
      label: str(guide.label),
      export_target: str(guide.export_target),
      filename: str(guide.filename),
      where: str(guide.where),
      steps: strList(guide.steps),
    }))
    .filter((guide) => guide.id && guide.export_target);
}

/** Validate an untrusted ScoreResult-shaped value. Returns null when it cannot be rendered. */
export function normalizeResult(raw: unknown): ScoreResult | null {
  if (!isObject(raw)) return null;
  const parsedPersona = persona(raw.persona);
  if (!parsedPersona) return null;
  const vector = isObject(raw.user_vector) ? raw.user_vector : {};
  const privacy = isObject(raw.privacy) ? raw.privacy : null;
  const freshness = isObject(raw.freshness) ? raw.freshness : null;
  return {
    metrics: objList(raw.metrics).map(metric),
    user_vector: {
      values: (isObject(vector.values) ? vector.values : {}) as Record<string, number>,
      confidence: (isObject(vector.confidence) ? vector.confidence : {}) as Record<string, number>,
    },
    products: recList(raw.products),
    products_by_category: recMap(raw.products_by_category),
    models: recMap(raw.models),
    primary_stack: stack(raw.primary_stack),
    alternative_stack: stack(raw.alternative_stack),
    operating_stack: operatingStack(raw.operating_stack),
    model_routing: modelRouting(raw.model_routing),
    workflow: workflow(raw.workflow),
    workstyle: workstyle(raw.workstyle),
    instructions: typeof raw.instructions === "string" ? raw.instructions : undefined,
    install_guides: installGuides(raw.install_guides),
    share_card: typeof raw.share_card === "string" ? raw.share_card : undefined,
    persona: parsedPersona,
    freshness: freshness
      ? {
          needs_review: objList(freshness.needs_review).map((item) => ({
            id: str(item.id),
            name: str(item.name),
            band: str(item.band),
          })),
        }
      : undefined,
    privacy: privacy ? { mode: str(privacy.mode), retention: str(privacy.retention) } : undefined,
    disclaimer: str(raw.disclaimer),
    share_id: typeof raw.share_id === "string" ? raw.share_id : undefined,
  };
}

/**
 * The public part of a result: what someone opening a share link may see.
 * Leaves out the raw user vector, diagnostics and quoted evidence from answers.
 */
export function trimForShare(result: ScoreResult): ScoreResult {
  return {
    persona: result.persona,
    metrics: result.metrics.map((item) => ({ ...item, evidence: [] })),
    user_vector: { values: {}, confidence: {} },
    products: result.products.slice(0, 8),
    products_by_category: result.products_by_category,
    models: Object.fromEntries(Object.entries(result.models).map(([key, list]) => [key, list.slice(0, 2)])),
    primary_stack: result.primary_stack,
    alternative_stack: result.alternative_stack,
    workstyle: result.workstyle
      ? { ...result.workstyle, why: result.workstyle.why?.map((item) => ({ ...item, evidence: [] })) }
      : undefined,
    operating_stack: result.operating_stack,
    model_routing: result.model_routing,
    workflow: result.workflow,
    instructions: result.instructions,
    install_guides: result.install_guides,
    share_card: result.share_card,
    disclaimer: result.disclaimer,
    privacy: result.privacy,
  };
}

export function canCompressShare(): boolean {
  return typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** Compress a trimmed snapshot into a URL hash. Returns null when this browser cannot. */
export async function encodeSharePayload(result: ScoreResult): Promise<string | null> {
  if (!canCompressShare()) return null;
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(trimForShare(result)));
    const compressed = await new Response(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw")),
    ).arrayBuffer();
    return bytesToBase64Url(new Uint8Array(compressed));
  } catch {
    return null;
  }
}

export async function decodeSharePayload(payload: string): Promise<ScoreResult | null> {
  if (!canCompressShare()) return null;
  try {
    const padded = payload.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")),
    ).text();
    return normalizeResult(JSON.parse(json));
  } catch {
    return null;
  }
}
