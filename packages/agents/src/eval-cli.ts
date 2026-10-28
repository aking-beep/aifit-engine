import { agentConfig, runContext } from './config.js';
import { runEvals } from './evals.js';

/**
 * Live evals: calls the model for every case, so it needs AIFIT_AGENTS=1 and
 * ANTHROPIC_API_KEY and costs money. Prints a pass rate per agent; results
 * are only ever reported from a real run.
 */
const cfg = agentConfig(process.env);
if (!cfg.enabled) {
  console.error(`Not running live evals: ${cfg.reason}`);
  process.exit(2);
}
const quiet = { onTrace: undefined };
const outcomes = await runEvals({
  intake: { ...runContext(cfg, 'intake'), ...quiet },
  explainer: { ...runContext(cfg, 'explainer'), ...quiet },
  price: { ...runContext(cfg, 'price-verifier'), ...quiet },
  registry: { ...runContext(cfg, 'registry-verifier'), ...quiet },
});
const byAgent = new Map<string, { pass: number; total: number }>();
for (const o of outcomes) {
  const s = byAgent.get(o.agent) ?? { pass: 0, total: 0 };
  s.total++; if (o.pass) s.pass++;
  byAgent.set(o.agent, s);
  console.log(`${o.pass ? 'PASS' : 'FAIL'} ${o.agent}/${o.id}${o.fails.length ? ` — ${o.fails.join('; ')}` : ''}`);
}
console.log(`\nModel: ${cfg.model}`);
for (const [a, s] of byAgent) console.log(`${a}: ${s.pass}/${s.total}`);
if (process.argv.includes('--json')) console.log(JSON.stringify(outcomes));
process.exit(outcomes.every((o) => o.pass) ? 0 : 1);
