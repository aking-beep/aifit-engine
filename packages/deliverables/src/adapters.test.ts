import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assess, FIXTURES, INVOICE_LOOKUP, SUPPORT_TRIAGE } from '@aifit/teams-core';
import { architectureGraph } from './architecture-graph.js';
import { applyRiskEdits, deriveRisks, parseRiskEdit, riskLevel } from './risk-register.js';

describe('architecture graph', () => {
  for (const w of FIXTURES) {
    test(`${w.name}: every edge joins two nodes, and layers flow left to right`, () => {
      const g = architectureGraph(assess(w, { depth: 'business' }));
      const ids = new Set(g.nodes.map((n) => n.id));
      assert.equal(ids.size, g.nodes.length, 'node ids are unique');
      const layer = new Map(g.nodes.map((n) => [n.id, n.layer]));
      for (const e of g.edges) {
        assert.ok(ids.has(e.from) && ids.has(e.to), `${e.from} → ${e.to}`);
        assert.ok(layer.get(e.to)! > layer.get(e.from)!, `${e.from} → ${e.to} goes right`);
      }
      assert.equal(g.nodes.filter((n) => n.kind === 'output').length, 1);
    });
  }

  test('the not-AI path draws no model and no prompt guard', () => {
    const g = architectureGraph(assess(INVOICE_LOOKUP, { depth: 'business' }));
    assert.equal(g.nodes.filter((n) => n.kind === 'model').length, 0);
    assert.ok(!g.nodes.some((n) => n.id === 'redact'));
  });

  test('sensitive data adds a guard before the model and marks the flow', () => {
    const w = { ...SUPPORT_TRIAGE, dataClasses: ['pii' as const] };
    const g = architectureGraph(assess(w, { depth: 'business' }));
    assert.ok(g.nodes.some((n) => n.id === 'redact' && n.zone === 'restricted'));
    assert.ok(g.edges.some((e) => e.pii));
    const model = g.nodes.find((n) => n.id === 'model');
    assert.ok(model?.monthly, 'run cost shown on the model');
    assert.notEqual(model!.evidence, 'verified', 'an uncalibrated estimate is never shown as verified');
  });
});

describe('risk register', () => {
  test('one risk per control and per unknown, all marked as assumptions', () => {
    const a = assess(SUPPORT_TRIAGE, { depth: 'business' });
    const r = deriveRisks(a);
    assert.equal(r.length, a.security.controls.length + a.trust.unknowns.length);
    assert.ok(r.every((x) => x.evidence === 'assumption' && x.status === 'open'));
    assert.ok(r.filter((x) => a.security.controls.find((c) => c.id === x.id)?.blocking).every((x) => x.impact === 5));
  });

  test('edits are validated and override the derived values', () => {
    assert.equal(parseRiskEdit({ likelihood: 9 }), null);
    assert.equal(parseRiskEdit('x'), null);
    assert.deepEqual(parseRiskEdit({ status: 'closed', owner: '  Priya ', evil: 1 }), { status: 'closed', owner: 'Priya' });
    const r = deriveRisks(assess(SUPPORT_TRIAGE, { depth: 'business' }));
    const [first] = applyRiskEdits(r, { [r[0]!.id]: { status: 'accepted', impact: 1 } });
    assert.equal(first!.status, 'accepted');
    assert.equal(first!.evidence, 'recommendation');
  });

  test('level thresholds', () => {
    assert.deepEqual([riskLevel(1, 4), riskLevel(1, 5), riskLevel(2, 5), riskLevel(4, 4)], ['low', 'medium', 'high', 'critical']);
  });
});
