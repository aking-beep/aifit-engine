import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { ModelEntry } from '@aifit/teams-core';
import { verifyPrices, verifyProducts, renderMarkdown, type Fetcher } from './verify-catalog.js';
import { ScriptedModelClient } from './scripted.js';
import { runContext } from './config.js';

const cfg = { enabled: true, reason: '', model: 'claude-opus-5-5', dailyCap: 10 };
const entry = (over: Partial<ModelEntry>): ModelEntry => ({
  id: 'claude-sonnet-5', provider: 'anthropic', displayName: 'Claude Sonnet 5', tier: 'mid', inputPer1M: 2, outputPer1M: 10, cachedInputPer1M: 0.2,
  contextWindow: 200_000, capabilities: ['text'], latencyClass: 'standard', asOf: '2026-09-14', ...over,
});
const page = '<html><body><h2>Claude Sonnet 5</h2><p>Input $3 / MTok</p><p>Output $15 / MTok</p><script>x</script></body></html>';
const fetcher: Fetcher = async (url) => (url.includes('claude') ? { ok: true, status: 200, text: page } : { ok: false, status: 403, text: '' });

describe('catalog verifier', () => {
  test('a quoted price change is reported, never applied; local models and unreadable pages stay unverified', async () => {
    const client = new ScriptedModelClient(() => ({
      found: true, inputPer1M: 3, outputPer1M: 15, cachedInputPer1M: null,
      quotes: [{ field: 'inputPer1M', text: 'Input $3 / MTok' }, { field: 'outputPer1M', text: 'Output $15 / MTok' }], notes: '',
    }));
    const catalog = [entry({}), entry({ id: 'local-8b', provider: 'local', displayName: 'Local 8B' }), entry({ id: 'gpt-x', provider: 'openai', displayName: 'GPT X' })];
    const before = JSON.stringify(catalog);
    const rows = await verifyPrices(fetcher, { ...runContext(cfg, 'price-verifier', client), onTrace: undefined }, catalog);
    assert.deepEqual(rows.map((r) => [r.id, r.status, r.run]), [
      ['claude-sonnet-5', 'changed', 'ok'], ['local-8b', 'unverified', 'skipped'], ['gpt-x', 'unverified', 'fetch_failed'],
    ]);
    assert.deepEqual(rows[0]!.diffs, ['input: catalog 2, page 3', 'output: catalog 10, page 15']);
    assert.ok(!client.requests[0]!.user.includes('<script>'), 'page HTML is reduced to text');
    assert.equal(JSON.stringify(catalog), before, 'the catalog is never modified');
  });

  test('an invented price does not survive the check', async () => {
    const client = new ScriptedModelClient(() => ({
      found: true, inputPer1M: 2, outputPer1M: 10, cachedInputPer1M: null,
      quotes: [{ field: 'inputPer1M', text: 'Input $2 / MTok' }, { field: 'outputPer1M', text: 'Output $10 / MTok' }], notes: '',
    }));
    const [row] = await verifyPrices(fetcher, { ...runContext(cfg, 'price-verifier', client), onTrace: undefined }, [entry({})]);
    assert.equal(row!.status, 'unverified', 'quotes not on the page mean nothing is confirmed, not a match');
  });

  test('registry products: renamed is a change, unclear is unverified', async () => {
    const products = [
      { id: 'a', name: 'Bard', provider: 'G', homepage: 'https://claude.example/a', status: 'active' },
      { id: 'b', name: 'Thing', provider: 'T', homepage: 'https://claude.example/b', status: 'active' },
    ];
    const pageFor: Fetcher = async (url) => ({ ok: true, status: 200, text: url.endsWith('/a') ? 'Bard is now Gemini.' : 'Welcome.' });
    const client = new ScriptedModelClient((req) => req.user.includes('Bard')
      ? { status: 'renamed', currentName: 'Gemini', quotes: ['Bard is now Gemini'], notes: '' }
      : { status: 'discontinued', currentName: null, quotes: ['Thing was shut down'], notes: '' });
    const rows = await verifyProducts(pageFor, { ...runContext(cfg, 'registry-verifier', client), onTrace: undefined }, products);
    assert.deepEqual(rows.map((r) => r.status), ['changed', 'unverified']);
    const md = renderMarkdown({ generatedAt: '2026-10-28T00:00:00Z', model: 'm', prices: [], products: rows, changes: 1 });
    assert.match(md, /1 change\(s\) need a person to review/);
    assert.match(md, /renamed → Gemini/);
  });
});
