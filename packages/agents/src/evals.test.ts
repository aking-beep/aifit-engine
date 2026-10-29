import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DecisionIntake } from '@aifit/decision-core';
import { IntakeAgentInput } from './intake.js';
import { PriceVerifierInput } from './price-verifier.js';
import { RegistryVerifierInput } from './registry-verifier.js';
import { EVAL_FILES, gradeIntake, gradePrice, gradeRegistry, loadCases, runEvals, type ExplainerCase, type IntakeCase, type PriceCase, type RegistryCase } from './evals.js';
import { ScriptedModelClient } from './scripted.js';
import { runContext } from './config.js';

// Offline: every eval input must be valid, and the graders must grade. The
// live run (npm run eval) needs a key and is never part of the unit suite.

const cfg = { enabled: true, reason: '', model: 'claude-opus-5-5', dailyCap: 10 };

describe('eval files', () => {
  test('at least ten intake cases, including injection attempts', () => {
    const cases = loadCases<IntakeCase>(EVAL_FILES.intake);
    assert.ok(cases.length >= 10);
    assert.ok(cases.filter((c) => c.id.startsWith('injection')).length >= 2);
    for (const c of cases) assert.ok(IntakeAgentInput.safeParse({ text: c.text }).success, c.id);
  });
  test('synthetic personas: at least twenty, across industries, with injection attempts, and every expectation is a known field', () => {
    const cases = loadCases<IntakeCase & { persona?: string }>(EVAL_FILES.intakePersonas);
    assert.ok(cases.length >= 20);
    assert.ok(cases.filter((c) => c.id.includes('injection')).length >= 2);
    const fields = new Set(['workTypes', 'frequencyPerMonth', 'minutesPerOccurrence', 'correctness', 'errorImpact', 'dataClasses', 'localOnly', 'integrations']);
    const ids = new Set<string>();
    for (const c of cases) {
      assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
      ids.add(c.id);
      assert.ok(c.persona, `${c.id} names its persona`);
      assert.ok(IntakeAgentInput.safeParse({ text: c.text }).success, c.id);
      for (const f of [...Object.keys(c.expect), ...c.forbid]) assert.ok(fields.has(f), `${c.id}: unknown field ${f}`);
      for (const [f, v] of Object.entries(c.expect)) {
        if (Array.isArray(v) && typeof v[0] === 'number') assert.ok(v.length === 2 && (v[0] as number) <= (v[1] as number), `${c.id}: bad range for ${f}`);
      }
    }
  });
  test('explainer, price and registry inputs validate', () => {
    for (const c of loadCases<ExplainerCase>(EVAL_FILES.explainer)) assert.ok(DecisionIntake.safeParse(c.input).success, c.id);
    for (const c of loadCases<PriceCase>(EVAL_FILES.price)) assert.ok(PriceVerifierInput.safeParse(c.input).success, c.id);
    for (const c of loadCases<RegistryCase>(EVAL_FILES.registry)) assert.ok(RegistryVerifierInput.safeParse(c.input).success, c.id);
  });
});

describe('graders', () => {
  const c: IntakeCase = { id: 'x', text: '', expect: { workTypes: ['generate'], frequencyPerMonth: [20, 30] }, forbid: ['dataClasses'] };
  test('intake ranges, lists and forbidden fields', () => {
    const base = { questions: [], dropped: [] };
    assert.deepEqual(gradeIntake(c, { ...base, suggestions: [
      { field: 'workTypes', value: ['generate', 'summarize'], evidence: '', confidence: 'high' },
      { field: 'frequencyPerMonth', value: 24, evidence: '', confidence: 'high' },
    ] }), []);
    assert.deepEqual(gradeIntake(c, { ...base, suggestions: [
      { field: 'frequencyPerMonth', value: 40, evidence: '', confidence: 'high' },
      { field: 'dataClasses', value: ['public'], evidence: '', confidence: 'high' },
    ] }), ['workTypes: not suggested', 'frequencyPerMonth: got 40, want [20,30]', 'dataClasses: should not be suggested']);
  });
  test('price and registry', () => {
    assert.deepEqual(gradePrice({ id: 'p', input: {}, expect: { found: false } }, { found: false, inputPer1M: null, outputPer1M: null, cachedInputPer1M: null, quotes: [], notes: '' }), []);
    assert.equal(gradeRegistry({ id: 'r', input: {}, expect: { status: 'renamed', currentName: 'B' } }, { status: 'renamed', currentName: 'C', quotes: [], notes: '' }).length, 1);
  });
});

describe('eval runner with a scripted model', () => {
  test('a model that says nothing fails the cases that expect something', async () => {
    const empty = (reply: unknown) => runContext(cfg, 'intake', new ScriptedModelClient(() => reply));
    const outcomes = await runEvals({
      intake: { ...empty({ suggestions: [], questions: [] }), onTrace: undefined },
      explainer: { ...runContext(cfg, 'explainer', new ScriptedModelClient(() => ({ summary: 'This is the recommended path.', keyPoints: [] }))), onTrace: undefined },
      price: { ...runContext(cfg, 'price-verifier', new ScriptedModelClient(() => ({ found: false, inputPer1M: null, outputPer1M: null, cachedInputPer1M: null, quotes: [], notes: '' }))), onTrace: undefined },
      registry: { ...runContext(cfg, 'registry-verifier', new ScriptedModelClient(() => ({ status: 'unclear', currentName: null, quotes: [], notes: '' }))), onTrace: undefined },
    });
    const intake = outcomes.filter((o) => o.agent === 'intake-interpreter');
    assert.equal(intake.filter((o) => o.pass).length, 0, 'every intake case expects something (fields or questions)');
    assert.ok(outcomes.filter((o) => o.agent === 'price-verifier' && o.pass).length >= 2, 'found:false cases pass');
    assert.ok(outcomes.some((o) => o.agent === 'registry-verifier' && o.id === 'parked-domain' && o.pass));
  });
});
