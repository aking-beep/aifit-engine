import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './engine.js';
import { matchTools } from './tools.js';
import { PRODUCTS } from './generated/registry.js';

describe('tool matching', () => {
  test('a buy decision lists registry tools with evidence and dates, never a price', () => {
    const r = decide({ workTypes: ['generate', 'summarize'], technicalAbility: 'none' });
    assert.equal(r.outcome, 'buy_ai');
    const m = matchTools(r, PRODUCTS, { asOf: '2026-10-27' });
    assert.ok(m.matches.length > 0);
    for (const t of m.matches) {
      assert.ok(r.toolRequirements.categories.includes(t.category));
      assert.equal(t.pricing.amount, null);
      assert.ok(t.evidence.length > 0);
      assert.match(t.lastEvaluatedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(typeof t.ageDays, 'number');
    }
  });

  test('local-only work only matches local or self-hosted tools', () => {
    const r = decide({ workTypes: ['summarize'], technicalAbility: 'intermediate', constraints: { localOnly: true } });
    const m = matchTools(r, PRODUCTS);
    assert.ok(m.matches.length > 0);
    for (const t of m.matches) {
      const p = PRODUCTS.find((x) => x.id === t.id)!;
      assert.ok(p.deployment.some((d) => d === 'local' || d === 'self_hosted'), `${t.id} is not local`);
    }
    assert.ok(m.excluded.length > 0, 'cloud-only tools in the same categories are listed as excluded, with reasons');
  });

  test('a zero budget excludes tools without a free tier', () => {
    const r = decide({ workTypes: ['search'], constraints: { monthlyBudgetUsd: 0 } });
    const m = matchTools(r, PRODUCTS);
    for (const t of m.matches) assert.ok(['free', 'mixed'].includes(t.pricing.tier));
  });

  test('regulated data adds a verify-it-yourself note, not a compliance claim', () => {
    const r = decide({ workTypes: ['summarize'], constraints: { dataClasses: ['phi'], regulated: ['hipaa'] } });
    const m = matchTools(r, PRODUCTS);
    for (const t of m.matches) {
      assert.ok(t.why.some((w) => /AI Fit has not verified/.test(w)));
      assert.ok(!t.why.some((w) => /certified|compliant/i.test(w)));
    }
  });

  test('no tools for a non-buy decision', () => {
    const r = decide({ workTypes: ['lookup'] });
    assert.equal(matchTools(r, PRODUCTS).matches.length, 0);
  });
});
