// Bundles prompts/*.md into src/generated/prompts.ts so the compiled package
// carries them. Python (aifit.agents) reads the same files directly.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(pkg, 'src/generated');
mkdirSync(out, { recursive: true });
const prompts = Object.fromEntries(
  readdirSync(resolve(pkg, 'prompts'))
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => [f.replace(/\.md$/, ''), readFileSync(resolve(pkg, 'prompts', f), 'utf8').trim()]),
);
writeFileSync(
  resolve(out, 'prompts.ts'),
  `// Generated from prompts/*.md by scripts/generate.mjs. Do not edit.\nexport const PROMPTS: Record<string, string> = ${JSON.stringify(prompts, null, 2)};\n`,
);
