import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GovernanceExport } from './index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const example = JSON.parse(readFileSync(resolve(root, 'fixtures/support-triage.json'), 'utf8'));
const schema = JSON.parse(readFileSync(resolve(root, 'governance-export.schema.json'), 'utf8'));

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('GovernanceExport v1', () => {
  test('the example export matches the contract', () => {
    const r = GovernanceExport.safeParse(example);
    assert.ok(r.success, JSON.stringify(!r.success && r.error.issues.slice(0, 3)));
  });

  const violations: [string, (d: Record<string, any>) => void][] = [
    ['an export claiming enforcement', (d) => { d.enforcement = 'enforced'; }],
    ['observed evaluation results from AI Fit', (d) => { d.evaluationEvidence.observed = [{ metric: 'accuracy', value: 0.97 }]; }],
    ['an evaluation status of passed', (d) => { d.evaluationEvidence.status = 'passed'; }],
    ['verification owned by anyone but the customer', (d) => { d.governanceRequirements[0].verification.owner = 'aifit'; }],
    ['a policy marked active', (d) => { d.policySuggestions[0].status = 'active'; }],
    ['an inventory entry with an owner filled in by AI Fit', (d) => { d.agentInventory.entries[0].owner = 'alice'; }],
    ['unknown top-level keys', (d) => { d.certified = true; }],
    ['an unknown policy kind', (d) => { d.policySuggestions[0].rule = { kind: 'disable_logging' }; }],
    ['a wrong contract version', (d) => { d.version = '2.0.0'; }],
  ];
  for (const [name, mutate] of violations) {
    test(`rejects ${name}`, () => {
      const d = clone(example);
      mutate(d);
      assert.equal(GovernanceExport.safeParse(d).success, false);
    });
  }

  test('the JSON Schema and the zod schema agree on required keys and literals', () => {
    const zodTop = Object.keys(GovernanceExport.shape).sort();
    assert.deepEqual([...schema.required].sort(), zodTop);
    assert.deepEqual(Object.keys(schema.properties).sort(), zodTop);
    assert.equal(schema.properties.enforcement.const, 'recommended-not-enforced');
    assert.equal(schema.properties.contract.const, 'aifit.control-export');
    assert.equal(schema.properties.evaluationEvidence.properties.observed.maxItems, 0);
    assert.equal(schema.properties.governanceRequirements.items.properties.verification.properties.owner.const, 'customer');
    for (const key of ['source', 'workload', 'agentInventory', 'evaluationEvidence'] as const) {
      const zodKeys = Object.keys((GovernanceExport.shape[key] as any).shape ?? (GovernanceExport.shape[key] as any).unwrap?.().shape).sort();
      assert.deepEqual([...schema.properties[key].required].sort(), zodKeys, key);
    }
  });
});
