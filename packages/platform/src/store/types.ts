/**
 * The storage contract every platform module uses. Deliberately small, so the
 * same code runs on an in-memory map (tests), a local directory (development)
 * and Upstash Redis over REST (Vercel). Values are JSON.
 */
export interface KvStore {
  readonly kind: 'memory' | 'file' | 'upstash';
  /** True when data survives a restart and is shared across instances. */
  readonly durable: boolean;
  get<T = unknown>(key: string): Promise<T | null>;
  /** Returns false when `nx` is set and the key already exists. */
  set(key: string, value: unknown, opts?: { ttlSeconds?: number; nx?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
  /** Push to the front of a list and keep at most `cap` items. */
  lpush(key: string, value: unknown, cap: number): Promise<void>;
  lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]>;
}

const KEY = /^[A-Za-z0-9:_\-.@]{1,200}$/;

export function checkKey(key: string): string {
  if (!KEY.test(key)) throw new Error(`Invalid store key: ${key}`);
  return key;
}
