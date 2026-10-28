import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { agentConfig, runContext } from './config.js';
import { buildReport, httpFetcher, renderMarkdown } from './verify-catalog.js';

/**
 * `npm run verify-catalog -w @aifit/agents -- --out <dir>`
 * Needs AIFIT_AGENTS=1 and ANTHROPIC_API_KEY. Writes report.json and
 * report.md, prints the number of changes, and never edits the repository.
 * Exit codes: 0 report written, 2 agents not configured.
 */
const cfg = agentConfig(process.env);
if (!cfg.enabled) {
  console.error(`Not running the catalog check: ${cfg.reason}`);
  process.exit(2);
}
const i = process.argv.indexOf('--out');
const out = resolve(i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : 'verify-report');
const quiet = { onTrace: undefined };
const report = await buildReport(httpFetcher, { ...runContext(cfg, 'price-verifier'), ...quiet }, { ...runContext(cfg, 'registry-verifier'), ...quiet });
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(resolve(out, 'report.md'), renderMarkdown(report));
console.log(`changes=${report.changes}`);
console.log(`Report written to ${out}`);
