import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkIntake, type IntakeAgentOutput } from './intake.js';
import { checkPrices, comparePrices, type PriceVerifierOutput } from './price-verifier.js';
import { checkProduct, type RegistryVerifierOutput } from './registry-verifier.js';
import { loadJson } from './fixtures.js';
import { excerptAround, htmlToText, normalizeText, numbersIn, quoteAppears } from './text.js';

// The same fixtures run in tests/test_agents.py against the Python mirror.

describe('intake checks (shared fixtures)', () => {
  for (const c of loadJson<{ id: string; text: string; output: IntakeAgentOutput; expected: unknown }[]>('fixtures/intake-checks.json')) {
    test(c.id, () => assert.deepEqual(checkIntake(c.text, c.output), c.expected));
  }
});

describe('price checks (shared fixtures)', () => {
  for (const c of loadJson<{ id: string; pageText: string; output: PriceVerifierOutput; expected: Record<string, unknown> }[]>('fixtures/price-checks.json')) {
    test(c.id, () => {
      const { result, problems } = checkPrices(c.pageText, c.output);
      assert.deepEqual(
        { found: result.found, inputPer1M: result.inputPer1M, outputPer1M: result.outputPer1M, cachedInputPer1M: result.cachedInputPer1M, problems },
        c.expected,
      );
    });
  }
});

describe('registry checks (shared fixtures)', () => {
  for (const c of loadJson<{ id: string; pageText: string; output: RegistryVerifierOutput; expected: Record<string, unknown> }[]>('fixtures/registry-checks.json')) {
    test(c.id, () => {
      const { result, problems } = checkProduct(c.pageText, c.output);
      assert.deepEqual({ status: result.status, currentName: result.currentName, quoteCount: result.quotes.length, problems: problems.length }, c.expected);
    });
  }
});

describe('price comparison', () => {
  const v = { found: true, inputPer1M: 2, outputPer1M: 10, cachedInputPer1M: 0.2, quotes: [], notes: '' };
  test('match, changed, and unverified are distinct', () => {
    assert.equal(comparePrices({ inputPer1M: 2, outputPer1M: 10, cachedInputPer1M: 0.2 }, v).status, 'match');
    assert.deepEqual(comparePrices({ inputPer1M: 3, outputPer1M: 15 }, v), { status: 'changed', diffs: ['input: catalog 3, page 2', 'output: catalog 15, page 10'] });
    assert.equal(comparePrices({ inputPer1M: 2, outputPer1M: 10 }, null).status, 'unverified');
    assert.equal(comparePrices({ inputPer1M: 2, outputPer1M: 10 }, { ...v, found: false }).status, 'unverified');
  });
});

describe('text helpers', () => {
  test('normalisation and quote matching', () => {
    assert.equal(normalizeText('  “It’s  Fine”  '), "it's fine");
    assert.equal(quoteAppears('ab', 'abc'), false, 'too short to count as evidence');
    assert.equal(quoteAppears('Every   WEEK', 'every week I write'), true);
  });
  test('numbers', () => assert.deepEqual(numbersIn('$1,250.00 or .5 or 3'), [1250, 0.5, 3]));
  test('html to text drops scripts and tags', () => {
    assert.equal(htmlToText('<p>Price</p><script>steal()</script><b>$2</b>&nbsp;/&amp;'), 'Price $2 /&');
  });
  test('excerpts stay near the model name and under the cap', () => {
    const page = 'x'.repeat(5000) + ' Claude Sonnet 5 costs $2 ' + 'y'.repeat(5000);
    const e = excerptAround(page, 'claude sonnet 5', 100);
    assert.ok(e.includes('costs $2') && e.length < 400);
  });
});
