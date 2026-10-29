// Generates src/generated/*.ts from the repository's JSON sources so the
// compiled package carries them without JSON import attributes (which the
// Next.js bundler and `tsc` disagree about). Python reads the same JSON files
// directly. Run by `npm run build`; the outputs are gitignored.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '..');
const repo = resolve(pkg, '../..');
const out = resolve(pkg, 'src/generated');
mkdirSync(out, { recursive: true });

const rules = JSON.parse(readFileSync(resolve(pkg, 'rules/decision-rules.v1.json'), 'utf8'));
writeFileSync(
  resolve(out, 'rules.ts'),
  `// Generated from rules/decision-rules.v1.json by scripts/generate.mjs. Do not edit.\n` +
    `export const RULES = ${JSON.stringify(rules, null, 2)} as const;\n`,
);

const products = JSON.parse(readFileSync(resolve(repo, 'data/registry/products.json'), 'utf8'));
const keep = products.map((p) => ({
  id: p.id,
  name: p.name,
  provider: p.provider,
  category: p.category,
  description: p.description,
  status: p.status,
  homepage: p.homepage,
  pricing_tier: p.pricing_tier,
  technical_level: p.technical_level,
  deployment: p.deployment,
  capabilities: p.capabilities,
  evidence: p.evidence,
  last_evaluated_at: p.last_evaluated_at,
  registry_version: p.registry_version,
}));
writeFileSync(
  resolve(out, 'registry.ts'),
  `// Generated from data/registry/products.json by scripts/generate.mjs. Do not edit.\n` +
    `import type { RegistryProduct } from '../tools.js';\n` +
    `export const PRODUCTS: RegistryProduct[] = ${JSON.stringify(keep, null, 2)};\n`,
);
