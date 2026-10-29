import { checkKey, type KvStore } from './types.js';

/**
 * Upstash Redis (or Vercel KV, which speaks the same REST protocol). Each call
 * is one HTTPS request: POST {url} with a JSON array command. Keys are
 * namespaced so this can share a database with the Consumer API.
 */
export class UpstashStore implements KvStore {
  readonly kind = 'upstash' as const;
  readonly durable = true;
  private readonly url: string;
  private readonly token: string;
  private readonly prefix: string;
  private readonly fetchImpl: typeof fetch;

  constructor(url: string, token: string, opts: { prefix?: string; fetchImpl?: typeof fetch } = {}) {
    this.url = url.replace(/\/+$/, '');
    this.token = token;
    this.prefix = opts.prefix ?? 'aifit-teams:';
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async cmd<T = unknown>(...parts: (string | number)[]): Promise<T> {
    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(parts.map(String)),
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const body = (await res.json()) as { result?: T; error?: string };
    if (body.error) throw new Error(`Upstash error: ${body.error}`);
    return body.result as T;
  }

  private k(key: string) {
    return this.prefix + checkKey(key);
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.cmd<string | null>('GET', this.k(key));
    return raw === null || raw === undefined ? null : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown, opts: { ttlSeconds?: number; nx?: boolean } = {}): Promise<boolean> {
    const parts: (string | number)[] = ['SET', this.k(key), JSON.stringify(value)];
    if (opts.ttlSeconds) parts.push('EX', Math.ceil(opts.ttlSeconds));
    if (opts.nx) parts.push('NX');
    const result = await this.cmd<string | null>(...parts);
    return result === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.cmd('DEL', this.k(key));
  }

  async incr(key: string): Promise<number> {
    return Number(await this.cmd('INCR', this.k(key)));
  }

  async sadd(key: string, member: string): Promise<void> {
    await this.cmd('SADD', this.k(key), member);
  }

  async srem(key: string, member: string): Promise<void> {
    await this.cmd('SREM', this.k(key), member);
  }

  async smembers(key: string): Promise<string[]> {
    return ((await this.cmd<string[]>('SMEMBERS', this.k(key))) ?? []).sort();
  }

  async lpush(key: string, value: unknown, cap: number): Promise<void> {
    await this.cmd('LPUSH', this.k(key), JSON.stringify(value));
    await this.cmd('LTRIM', this.k(key), 0, cap - 1);
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    return ((await this.cmd<string[]>('LRANGE', this.k(key), start, stop)) ?? []).map((v) => JSON.parse(v) as T);
  }
}
