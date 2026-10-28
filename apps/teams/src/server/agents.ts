import { agentConfig, DailyCap, runContext, type AgentConfig, type RunContext } from '@aifit/agents';
import { rateLimit, PlatformError } from '@aifit/platform';
import { RateLimiter } from '@/lib/request-guard';
import { clientKey, requireStore, workspacesEnabled } from './platform';

/**
 * Agent wiring for the Teams routes. Off unless AIFIT_AGENTS=1 and
 * ANTHROPIC_API_KEY are set. Limits: a per-client window (in the durable
 * store when workspaces are on, in-process otherwise) under a per-process
 * daily cap that bounds cost even if the store is unavailable.
 */

let cfg: AgentConfig | null = null;
let cap: DailyCap | null = null;
const local = new RateLimiter(6, 60_000);

export function agents(): AgentConfig {
  cfg ??= agentConfig(process.env);
  return cfg;
}

export function agentContext(prompt: string): RunContext {
  return runContext(agents(), prompt);
}

export async function agentGate(req: Request): Promise<void> {
  const key = clientKey(req);
  if (workspacesEnabled()) await rateLimit(requireStore(), 'agents', key, 6, 60);
  else if (local.take(key) > 0) throw new PlatformError('rate_limited', 'Too many requests. Try again in a minute.');
  cap ??= new DailyCap(agents().dailyCap);
  if (!cap.take()) throw new PlatformError('rate_limited', "Today's AI assistance limit for this site is used up. The rule-based report still works.");
}
