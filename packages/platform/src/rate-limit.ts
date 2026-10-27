import type { KvStore } from './store/types.js';
import { PlatformError } from './errors.js';
import { sha256 } from './crypto.js';

/**
 * Fixed-window limit kept in the store, so it holds across serverless
 * instances when the store is Upstash. Keys are hashed: no email or IP is
 * stored in clear.
 */
export async function rateLimit(store: KvStore, bucket: string, subject: string, limit: number, windowSeconds: number): Promise<void> {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rl:${bucket}:${sha256(subject).slice(0, 32)}:${window}`;
  const n = await store.incr(key);
  if (n === 1) await store.set(key, 1, { ttlSeconds: windowSeconds * 2 });
  if (n > limit) throw new PlatformError('rate_limited', 'Too many attempts. Wait a few minutes and try again.');
}
