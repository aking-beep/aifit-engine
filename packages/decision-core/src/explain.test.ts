import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './engine.js';
import { explain, buildExplainRequest } from './explain.js';

const r = decide({ goal: 'my secret project codename BLUEFIN', workTypes: ['generate'], technicalAbility: 'none' });

describe('schema-validated model explanations', () => {
  test('no adapter: the rules explanation is used', async () => {
    const e = await explain(r, null);
    assert.equal(e.source, 'rules');
    assert.ok(e.summary.length > 0);
  });

  test('a valid reply is used and labelled as model-written', async () => {
    const e = await explain(r, async () => ({ summary: 'An off-the-shelf writing tool fits this.', keyPoints: ['Low setup effort.'] }));
    assert.equal(e.source, 'model');
  });

  test('a reply with extra fields (an attempt to set the outcome) is rejected', async () => {
    const e = await explain(r, async () => ({ summary: 'ok', keyPoints: [], outcome: 'build_ai' }));
    assert.equal(e.source, 'rules');
    assert.equal(e.rejected, 'reply did not match the schema');
  });

  test('a reply that recommends a different outcome is rejected', async () => {
    const e = await explain(r, async () => ({ summary: 'You should Build an AI system instead.', keyPoints: [] }));
    assert.equal(e.source, 'rules');
    assert.equal(e.rejected, 'reply named a different outcome');
  });

  test('a slow or failing adapter falls back', async () => {
    const slow = await explain(r, () => new Promise((resolve) => setTimeout(() => resolve({ summary: 'x', keyPoints: [] }), 200)), 20);
    assert.equal(slow.rejected, 'timed out');
    const failing = await explain(r, async () => { throw new Error('boom'); });
    assert.equal(failing.rejected, 'adapter failed');
  });

  test('the request never carries the person\'s free text', () => {
    assert.ok(!JSON.stringify(buildExplainRequest(r)).includes('BLUEFIN'));
  });
});
