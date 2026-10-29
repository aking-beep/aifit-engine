import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(PACKAGE_DIR, rel), 'utf8')) as T;
}
