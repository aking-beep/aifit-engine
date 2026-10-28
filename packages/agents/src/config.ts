import { AnthropicModelClient } from './anthropic.js';
import type { ModelClient, RunContext, AgentTrace } from './harness.js';
import { PROMPTS } from './generated/prompts.js';

export const DEFAULT_AGENT_MODEL = 'claude-opus-5-5';

export interface AgentConfig {
  enabled: boolean;
  reason: string;
  model: string;
  /** Model calls allowed per UTC day across the deployment's interactive agents. */
  dailyCap: number;
}

/**
 * Agents are off unless AIFIT_AGENTS=1 and an Anthropic API key is set. With
 * them off, every surface keeps its rule-based behaviour and says so.
 */
export function agentConfig(env: Record<string, string | undefined>): AgentConfig {
  const model = env.AIFIT_AGENT_MODEL?.trim() || DEFAULT_AGENT_MODEL;
  const dailyCap = Math.max(0, Math.floor(Number(env.AIFIT_AGENT_DAILY_CAP ?? 500)) || 0);
  if (env.AIFIT_AGENTS !== '1') return { enabled: false, reason: 'AI assistance is off on this deployment (AIFIT_AGENTS is not 1).', model, dailyCap };
  if (!env.ANTHROPIC_API_KEY?.trim()) return { enabled: false, reason: 'AI assistance is off: ANTHROPIC_API_KEY is not set.', model, dailyCap };
  return { enabled: true, reason: 'AI assistance is on. Suggestions are checked before they are shown, and nothing is applied without you.', model, dailyCap };
}

/** One structured log line per run: agent, status, model, timing, token counts, input hash. Never the input. */
export function logTrace(t: AgentTrace): void {
  console.info(JSON.stringify({ kind: 'agent_run', ...t }));
}

export function runContext(cfg: AgentConfig, agentPrompt: string, client?: ModelClient | null): RunContext {
  const system = PROMPTS[agentPrompt];
  if (!system) throw new Error(`No prompt named ${agentPrompt}`);
  return {
    client: client === undefined ? (cfg.enabled ? new AnthropicModelClient() : null) : client,
    model: cfg.model,
    system,
    onTrace: logTrace,
  };
}

/** Per-process daily call counter: a backstop under the per-route rate limits. */
export class DailyCap {
  private day = '';
  private count = 0;
  constructor(private readonly cap: number) {}
  take(now = new Date()): boolean {
    const d = now.toISOString().slice(0, 10);
    if (d !== this.day) { this.day = d; this.count = 0; }
    if (this.count >= this.cap) return false;
    this.count++;
    return true;
  }
}
