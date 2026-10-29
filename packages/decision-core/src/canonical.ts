import { createHash } from 'node:crypto';

/**
 * Canonical JSON: sorted keys, no whitespace, numbers normalised so the same
 * intake hashes identically in TypeScript and Python. `aifit.decision`
 * implements the same function; `fixtures/golden.json` pins both to one hash.
 *
 * Numbers: integers print as integers; anything else is rounded half-up to six
 * decimals and printed in fixed notation with trailing zeros stripped. That
 * avoids the two languages' different exponent rules (`1e-06` vs `0.000001`)
 * and Python's `1.0` vs JavaScript's `1`.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return canonicalNumber(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  throw new TypeError(`Cannot canonicalise ${typeof value}`);
}

export function canonicalNumber(n: number): string {
  if (!Number.isFinite(n)) throw new TypeError('Non-finite numbers have no canonical form.');
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.floor(n * 1e6 + 0.5) / 1e6;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
