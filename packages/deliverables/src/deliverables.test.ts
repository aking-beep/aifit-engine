import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FIXTURES, INVOICE_LOOKUP, SUPPORT_TRIAGE, Workload } from '@aifit/teams-core';
import { BlueprintSchema, DeliverableValidationError, blueprintMarkdown, buildBlueprint, renderBlueprint } from './blueprint.js';
import { buildControlExport, controlAdapterFromEnv, httpControlAdapter, renderControlExport } from './control-export.js';
import { GovernanceExport } from '@aifit/control-export-contract';

const META = { generatedAt: '2026-10-27T12:00:00.000Z', assessment: null };
const SECTIONS = ['1. Verdict', '2. Build, buy, or automate', '3. Architecture', '4. Model and infrastructure', '5. Cost and operating expense', '6. Security, privacy and governance', '7. Evaluation plan and acceptance criteria', '8. Implementation milestones', '9. What this blueprint does not know'];

describe('technical blueprint', () => {
  for (const w of FIXTURES) {
    test(`${w.name}: valid JSON and Markdown with every section`, () => {
      const { blueprint } = buildBlueprint(w, META);
      assert.ok(BlueprintSchema.safeParse(blueprint).success);
      const json = renderBlueprint(blueprint, 'json');
      assert.deepEqual(JSON.parse(json.body), blueprint);
      const md = renderBlueprint(blueprint, 'md');
      for (const s of SECTIONS) assert.ok(md.body.includes(`## ${s}`), `missing section ${s}`);
      assert.equal(blueprint.validation.status, 'not_validated');
      assert.equal(blueprint.decision.comparison.length, 5);
    });
  }

  test('the not-AI path names no model and plans deterministic tests', () => {
    const { blueprint } = buildBlueprint(INVOICE_LOOKUP, META);
    assert.equal(blueprint.verdict.verdict, 'not-ai');
    assert.equal(blueprint.model, null);
    assert.equal(blueprint.evaluation.kind, 'deterministic');
    assert.ok(!['buy_ai', 'build_ai'].includes(blueprint.decision.outcome));
    assert.match(blueprintMarkdown(blueprint), /No model is recommended/);
  });

  test('same inputs, same document', () => {
    assert.equal(renderBlueprint(buildBlueprint(SUPPORT_TRIAGE, META).blueprint, 'json').body, renderBlueprint(buildBlueprint(SUPPORT_TRIAGE, META).blueprint, 'json').body);
  });

  test('every cost figure states its basis', () => {
    const { blueprint } = buildBlueprint(SUPPORT_TRIAGE, META);
    for (const e of [blueprint.costs.perUnit, blueprint.costs.perMonth, blueprint.costs.buildCost]) assert.ok(e.basis && e.source);
    for (const l of blueprint.costs.effort) assert.ok(l.basis && l.source);
  });

  test('a credential that reaches the document blocks the download', () => {
    const poisoned = Workload.parse({ ...SUPPORT_TRIAGE, name: 'Triage using key sk-ant-api03-abcdefghijklmnopqrstuvwx' });
    const { blueprint } = buildBlueprint(poisoned, META);
    assert.throws(() => renderBlueprint(blueprint, 'md'), DeliverableValidationError);
    assert.throws(() => renderBlueprint(blueprint, 'json'), DeliverableValidationError);
  });

  test('planning answers flow into the decision comparison', () => {
    const noHosted = Workload.parse({ ...SUPPORT_TRIAGE, planning: { offTheShelfAcceptable: false, monthlyBudgetUsd: 500, timelineWeeks: 6 } });
    const { blueprint } = buildBlueprint(noHosted, META);
    const buy = blueprint.decision.comparison.find((c) => c.outcome === 'buy_ai')!;
    assert.equal(buy.eligible, false);
    assert.deepEqual(buy.excludedBy, ['HC_HOSTED_TOOLS_REFUSED']);
  });
});

describe('Control governance export', () => {
  for (const w of FIXTURES) {
    test(`${w.name}: matches the contract and never claims enforcement or results`, () => {
      const doc = buildControlExport(buildBlueprint(w, META));
      assert.ok(GovernanceExport.safeParse(doc).success);
      assert.equal(doc.enforcement, 'recommended-not-enforced');
      assert.deepEqual(doc.evaluationEvidence.observed, []);
      assert.ok(doc.governanceRequirements.every((g) => g.verification.owner === 'customer'));
      assert.ok(doc.policySuggestions.every((p) => p.status === 'suggested'));
      assert.ok(doc.agentInventory.entries.every((e) => e.owner === null));
    });
  }

  test('an agent workload is inventoried, capped and allow-listed', () => {
    const { blueprint, assessment } = buildBlueprint(SUPPORT_TRIAGE, META);
    const doc = buildControlExport({ blueprint, assessment, decision: buildBlueprint(SUPPORT_TRIAGE, META).decision });
    assert.equal(assessment.architecture.pattern, 'bounded-agent');
    assert.equal(doc.agentInventory.required, true);
    const kinds = doc.policySuggestions.map((p) => p.rule.kind);
    for (const k of ['turn_cap', 'tool_allow_list', 'monthly_spend_cap', 'redact_data_classes']) assert.ok(kinds.includes(k as never), `missing ${k}`);
    const cap = doc.policySuggestions.find((p) => p.rule.kind === 'monthly_spend_cap')!.rule;
    assert.equal(cap.kind === 'monthly_spend_cap' && cap.basis, 'heuristic');
  });

  test('the not-AI path suggests no spend cap and needs no inventory', () => {
    const doc = buildControlExport(buildBlueprint(INVOICE_LOOKUP, META));
    assert.ok(!doc.policySuggestions.some((p) => p.rule.kind === 'monthly_spend_cap'));
    assert.equal(doc.agentInventory.required, false);
  });
});

describe('Control adapter boundary', () => {
  const doc = buildControlExport(buildBlueprint(SUPPORT_TRIAGE, META));

  test('no adapter unless CONTROL_EXPORT_URL is set to https (or localhost)', () => {
    assert.equal(controlAdapterFromEnv({}), null);
    assert.equal(controlAdapterFromEnv({ CONTROL_EXPORT_URL: 'http://control.example.com/x' }), null);
    assert.equal(controlAdapterFromEnv({ CONTROL_EXPORT_URL: 'not a url' }), null);
    assert.equal(controlAdapterFromEnv({ CONTROL_EXPORT_URL: 'https://control.example.com/api/import' })?.name, 'http');
    assert.equal(controlAdapterFromEnv({ CONTROL_EXPORT_URL: 'http://localhost:3002/import' })?.name, 'http');
  });

  test('a 202 is delivered, with the contract media type and a content-hash idempotency key', async () => {
    let seen: Headers | null = null;
    const adapter = httpControlAdapter('https://control.example.com/import', 'tok', (async (_u: unknown, init?: RequestInit) => {
      seen = new Headers(init!.headers);
      return new Response(null, { status: 202 });
    }) as typeof fetch);
    const r = await adapter.deliver(doc);
    assert.equal(r.delivered, true);
    assert.equal(seen!.get('content-type'), 'application/vnd.aifit.governance-export+json; version=1');
    assert.equal(seen!.get('authorization'), 'Bearer tok');
    assert.equal(seen!.get('idempotency-key'), createHash('sha256').update(renderControlExport(doc).body).digest('hex'));
  });

  test('anything else is reported as not delivered, never thrown', async () => {
    for (const status of [404, 422, 500]) {
      const r = await httpControlAdapter('https://c.example', undefined, (async () => new Response(null, { status })) as typeof fetch).deliver(doc);
      assert.equal(r.delivered, false);
    }
    const down = await httpControlAdapter('https://c.example', undefined, (async () => { throw new Error('ECONNREFUSED'); }) as typeof fetch).deliver(doc);
    assert.equal(down.delivered, false);
  });
});
