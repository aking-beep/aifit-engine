#!/usr/bin/env node
// Copies packages/design into each app (see packages/design/README.md).
// --check: exit 1 if any copy differs from the source, without writing.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'packages/design');
const targets = ['apps/web/src/design', 'apps/teams/src/design'].map((t) => join(root, t));
const BANNER = '// GENERATED from packages/design by scripts/sync-design.mjs. Do not edit here.\n';
const CSS_BANNER = '/* GENERATED from packages/design by scripts/sync-design.mjs. Do not edit here. */\n';

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

function expected() {
  const out = new Map();
  for (const f of files(join(src, 'src'))) {
    const body = readFileSync(f, 'utf8');
    // Keep 'use client' first: the banner goes after it.
    const withBanner = body.startsWith("'use client'") ? body.replace("'use client'\n", `'use client'\n${BANNER}`) : BANNER + body;
    out.set(relative(join(src, 'src'), f), withBanner);
  }
  out.set('tokens.css', CSS_BANNER + readFileSync(join(src, 'tokens.css'), 'utf8'));
  return out;
}

const check = process.argv.includes('--check');
const want = expected();
let drift = 0;
for (const t of targets) {
  const have = existsSync(t) ? new Set(files(t).map((f) => relative(t, f))) : new Set();
  for (const [rel, body] of want) {
    const p = join(t, rel);
    const cur = existsSync(p) ? readFileSync(p, 'utf8') : null;
    if (cur !== body) {
      drift++;
      if (check) console.error(`drift: ${relative(root, p)}`);
      else { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); }
    }
    have.delete(rel);
  }
  for (const extra of have) {
    drift++;
    if (check) console.error(`extra: ${relative(root, join(t, extra))}`);
    else rmSync(join(t, extra));
  }
}
if (check && drift) { console.error(`${drift} design file(s) out of sync. Run: node scripts/sync-design.mjs`); process.exit(1); }
console.log(check ? 'design copies in sync' : `design synced (${drift} file(s) written or removed)`);
