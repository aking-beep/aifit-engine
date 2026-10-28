import { createHash } from 'node:crypto';
import type * as z from 'zod/v4';

/**
 * The agent harness.
 *
 * An agent here is one structured model call with a fixed system prompt, a
 * typed input, a typed output, and a deterministic `check` that runs after
 * the schema. There are no tools and no loop: each agent's job is narrow
 * enough that one call does it, and anything an agent produces is a
 * suggestion a person or the deterministic engine acts on.
 */

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ModelRequest<T> {
  agent: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  model: string;
  effort: Effort;
  maxTokens: number;
  timeoutMs: number;
}

export interface ModelResponse<T> {
  /** Null when the model's reply did not parse against the schema. */
  output: T | null;
  stopReason: string | null;
  /** The model that actually answered (differs from the request after a server-side fallback). */
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
  requestId?: string;
}

/** Anything that can answer a ModelRequest: the Anthropic API, or a scripted fake in tests. */
export interface ModelClient {
  readonly name: string;
  complete<T>(req: ModelRequest<T>): Promise<ModelResponse<T>>;
}

export interface AgentSpec<I, O, R> {
  name: string;
  version: string;
  /** Key into PROMPTS (prompts/<name>.md). */
  prompt: string;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  effort: Effort;
  maxTokens: number;
  timeoutMs: number;
  /** The user turn. Untrusted text goes inside clearly delimited data tags. */
  render(input: I): string;
  /** Deterministic post-check: returns the usable result and every problem found. */
  check(input: I, output: O): { result: R | null; problems: string[] };
}

export type RunStatus = 'ok' | 'disabled' | 'invalid_input' | 'refused' | 'rejected' | 'error' | 'timeout';

export interface AgentTrace {
  agent: string;
  version: string;
  status: RunStatus;
  model: string | null;
  client: string | null;
  /** SHA-256 of the input. The input itself is never logged. */
  inputHash: string;
  durationMs: number;
  usage?: { inputTokens: number; outputTokens: number };
  problems: string[];
  at: string;
}

export interface AgentRun<R> {
  status: RunStatus;
  result: R | null;
  problems: string[];
  trace: AgentTrace;
}

export interface RunContext {
  client: ModelClient | null;
  model: string;
  system: string;
  onTrace?: (t: AgentTrace) => void;
  now?: () => number;
}

export function hashInput(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

/** Wrap untrusted text so the model can see where data starts and ends. */
export function dataBlock(tag: string, text: string): string {
  // A closing tag inside the data would let it "escape"; neutralise it.
  const safe = text.replaceAll(`</${tag}>`, `</ ${tag}>`);
  return `<${tag}>\n${safe}\n</${tag}>`;
}

export async function runAgent<I, O, R>(spec: AgentSpec<I, O, R>, rawInput: unknown, ctx: RunContext): Promise<AgentRun<R>> {
  const now = ctx.now ?? Date.now;
  const started = now();
  const inputHash = hashInput(rawInput);
  const finish = (status: RunStatus, result: R | null, problems: string[], extra: Partial<AgentTrace> = {}): AgentRun<R> => {
    const trace: AgentTrace = {
      agent: spec.name,
      version: spec.version,
      status,
      model: extra.model ?? null,
      client: ctx.client?.name ?? null,
      inputHash,
      durationMs: now() - started,
      usage: extra.usage,
      problems,
      at: new Date(started).toISOString(),
    };
    ctx.onTrace?.(trace);
    return { status, result, problems, trace };
  };

  if (!ctx.client) return finish('disabled', null, ['Agents are not enabled on this deployment.']);
  const parsed = spec.input.safeParse(rawInput);
  if (!parsed.success) return finish('invalid_input', null, ['The request did not match this agent\'s input schema.']);

  let res: ModelResponse<O>;
  try {
    res = await withTimeout(
      ctx.client.complete({
        agent: spec.name,
        system: ctx.system,
        user: spec.render(parsed.data),
        schema: spec.output,
        model: ctx.model,
        effort: spec.effort,
        maxTokens: spec.maxTokens,
        timeoutMs: spec.timeoutMs,
      }),
      spec.timeoutMs,
    );
  } catch (e) {
    const timedOut = e instanceof Error && e.message === 'agent timeout';
    return finish(timedOut ? 'timeout' : 'error', null, [timedOut ? 'The model did not answer in time.' : 'The model call failed.']);
  }
  if (res.stopReason === 'refusal') return finish('refused', null, ['The model declined this request.'], res);
  // Belt and braces: the SDK parsed against the schema; parse again here so a
  // client implementation can never hand back an unchecked object.
  const out = res.output === null ? null : spec.output.safeParse(res.output);
  if (!out || !out.success) return finish('rejected', null, ['The model\'s reply did not match the expected format.'], res);
  const { result, problems } = spec.check(parsed.data, out.data);
  if (!result) return finish('rejected', null, problems.length ? problems : ['Nothing in the reply passed the checks.'], res);
  return finish('ok', result, problems, res);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('agent timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
