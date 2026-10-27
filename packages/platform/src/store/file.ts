import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { checkKey, type KvStore } from './types.js';

interface Snapshot {
  data: Record<string, { value: string; expiresAt: number | null }>;
  sets: Record<string, string[]>;
  lists: Record<string, string[]>;
}

/**
 * Single-file JSON store for local development and the browser test suite.
 * Durable across restarts of one process; not shared between instances, so it
 * is never used on Vercel. Writes are serialised in-process and atomic on disk
 * (write to a temp file, then rename).
 */
export class FileStore implements KvStore {
  readonly kind = 'file' as const;
  readonly durable = true;
  private readonly path: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.path = join(dir, 'teams-store.json');
    mkdirSync(dirname(this.path), { recursive: true });
  }

  private read(): Snapshot {
    if (!existsSync(this.path)) return { data: {}, sets: {}, lists: {} };
    try {
      return JSON.parse(readFileSync(this.path, 'utf8')) as Snapshot;
    } catch {
      return { data: {}, sets: {}, lists: {} };
    }
  }

  private write(s: Snapshot) {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(s));
    renameSync(tmp, this.path);
  }

  private run<T>(fn: (s: Snapshot) => { result: T; dirty: boolean }): Promise<T> {
    const next = this.queue.then(() => {
      const s = this.read();
      const now = Date.now();
      for (const [k, v] of Object.entries(s.data)) if (v.expiresAt !== null && v.expiresAt <= now) delete s.data[k];
      const { result, dirty } = fn(s);
      if (dirty) this.write(s);
      return result;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  async get<T>(key: string): Promise<T | null> {
    checkKey(key);
    return this.run((s) => ({ result: s.data[key] ? (JSON.parse(s.data[key]!.value) as T) : null, dirty: false }));
  }

  async set(key: string, value: unknown, opts: { ttlSeconds?: number; nx?: boolean } = {}): Promise<boolean> {
    checkKey(key);
    return this.run((s) => {
      if (opts.nx && s.data[key]) return { result: false, dirty: false };
      s.data[key] = { value: JSON.stringify(value), expiresAt: opts.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : null };
      return { result: true, dirty: true };
    });
  }

  async del(key: string): Promise<void> {
    checkKey(key);
    return this.run((s) => {
      delete s.data[key];
      delete s.sets[key];
      delete s.lists[key];
      return { result: undefined, dirty: true };
    });
  }

  async incr(key: string): Promise<number> {
    checkKey(key);
    return this.run((s) => {
      const n = (s.data[key] ? (JSON.parse(s.data[key]!.value) as number) : 0) + 1;
      s.data[key] = { value: JSON.stringify(n), expiresAt: null };
      return { result: n, dirty: true };
    });
  }

  async sadd(key: string, member: string): Promise<void> {
    checkKey(key);
    return this.run((s) => {
      const set = new Set(s.sets[key] ?? []);
      set.add(member);
      s.sets[key] = Array.from(set);
      return { result: undefined, dirty: true };
    });
  }

  async srem(key: string, member: string): Promise<void> {
    checkKey(key);
    return this.run((s) => {
      s.sets[key] = (s.sets[key] ?? []).filter((m) => m !== member);
      return { result: undefined, dirty: true };
    });
  }

  async smembers(key: string): Promise<string[]> {
    checkKey(key);
    return this.run((s) => ({ result: [...(s.sets[key] ?? [])].sort(), dirty: false }));
  }

  async lpush(key: string, value: unknown, cap: number): Promise<void> {
    checkKey(key);
    return this.run((s) => {
      s.lists[key] = [JSON.stringify(value), ...(s.lists[key] ?? [])].slice(0, cap);
      return { result: undefined, dirty: true };
    });
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    checkKey(key);
    return this.run((s) => ({
      result: (s.lists[key] ?? []).slice(start, stop < 0 ? undefined : stop + 1).map((v) => JSON.parse(v) as T),
      dirty: false,
    }));
  }
}
