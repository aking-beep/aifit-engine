import { checkKey, type KvStore } from './types.js';

interface Entry { value: string; expiresAt: number | null }

/** Process-local store. Tests and `next dev` only: never durable. */
export class MemoryStore implements KvStore {
  readonly kind = 'memory' as const;
  readonly durable = false;
  private readonly data = new Map<string, Entry>();
  private readonly sets = new Map<string, Set<string>>();
  private readonly lists = new Map<string, string[]>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  private live(key: string): Entry | null {
    const e = this.data.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && e.expiresAt <= this.now()) {
      this.data.delete(key);
      return null;
    }
    return e;
  }

  async get<T>(key: string): Promise<T | null> {
    const e = this.live(checkKey(key));
    return e ? (JSON.parse(e.value) as T) : null;
  }

  async set(key: string, value: unknown, opts: { ttlSeconds?: number; nx?: boolean } = {}): Promise<boolean> {
    checkKey(key);
    if (opts.nx && this.live(key)) return false;
    this.data.set(key, { value: JSON.stringify(value), expiresAt: opts.ttlSeconds ? this.now() + opts.ttlSeconds * 1000 : null });
    return true;
  }

  async del(key: string): Promise<void> {
    checkKey(key);
    this.data.delete(key);
    this.sets.delete(key);
    this.lists.delete(key);
  }

  /** Like Redis INCR: keeps the key's existing expiry. */
  async incr(key: string): Promise<number> {
    const e = this.live(checkKey(key));
    const next = (e ? (JSON.parse(e.value) as number) : 0) + 1;
    this.data.set(key, { value: JSON.stringify(next), expiresAt: e?.expiresAt ?? null });
    return next;
  }

  async sadd(key: string, member: string): Promise<void> {
    const s = this.sets.get(checkKey(key)) ?? new Set<string>();
    s.add(member);
    this.sets.set(key, s);
  }

  async srem(key: string, member: string): Promise<void> {
    this.sets.get(checkKey(key))?.delete(member);
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(checkKey(key)) ?? []).sort();
  }

  async lpush(key: string, value: unknown, cap: number): Promise<void> {
    const l = this.lists.get(checkKey(key)) ?? [];
    l.unshift(JSON.stringify(value));
    this.lists.set(key, l.slice(0, cap));
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const l = this.lists.get(checkKey(key)) ?? [];
    return l.slice(start, stop < 0 ? undefined : stop + 1).map((v) => JSON.parse(v) as T);
  }
}
