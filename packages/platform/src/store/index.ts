import { FileStore } from './file.js';
import { MemoryStore } from './memory.js';
import { UpstashStore } from './upstash.js';
import type { KvStore } from './types.js';

export * from './types.js';
export { FileStore, MemoryStore, UpstashStore };

export type StoreResolution =
  | { store: KvStore; reason: string }
  | { store: null; reason: string };

/**
 * Pick the store for this deployment. On Vercel only a shared durable store is
 * acceptable: without one, workspaces are switched off rather than silently
 * backed by per-instance memory that would lose accounts between requests.
 */
export function resolveStore(env: Record<string, string | undefined>): StoreResolution {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (url && token) return { store: new UpstashStore(url, token), reason: 'Upstash Redis (REST)' };
  if (env.VERCEL) {
    return { store: null, reason: 'No durable store is configured on this deployment (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN).' };
  }
  if (env.AIFIT_TEAMS_STORE === 'memory') return { store: new MemoryStore(), reason: 'In-memory store (development only)' };
  return { store: new FileStore(env.AIFIT_TEAMS_STORE || '.data'), reason: 'Local file store (development only)' };
}
