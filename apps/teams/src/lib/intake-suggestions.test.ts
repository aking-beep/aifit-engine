import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyIntake } from './intake-state.ts';
import { describePatch, patchFromSuggestion, type AgentSuggestion } from './intake-suggestions.ts';

const s = (field: AgentSuggestion['field'], value: AgentSuggestion['value']): AgentSuggestion => ({ field, value, evidence: 'x', confidence: 'high' });

test('suggestions map onto the Teams intake, merging rather than replacing lists', () => {
  const state = { ...emptyIntake(), task: ['classify' as const], dataClasses: ['pii' as const], sourceSystems: 'Zendesk' };
  assert.deepEqual(patchFromSuggestion(s('workTypes', ['summarize', 'transfer']), state), { task: ['classify', 'summarize'] });
  assert.deepEqual(patchFromSuggestion(s('dataClasses', ['phi']), state), { dataClasses: ['pii', 'phi'] });
  assert.deepEqual(patchFromSuggestion(s('integrations', ['Slack', 'Zendesk']), state), { sourceSystems: 'Zendesk, Slack' });
  assert.deepEqual(patchFromSuggestion(s('frequencyPerMonth', 4000), state), { unitsPerMonth: 4000 });
  assert.deepEqual(patchFromSuggestion(s('minutesPerOccurrence', 3), state), { minutesPerUnit: 3 });
  assert.deepEqual(patchFromSuggestion(s('correctness', 'exact'), state), { determinism: 'exact' });
});

test('error impact is inverted into error tolerance', () => {
  const e = emptyIntake();
  assert.deepEqual(['critical', 'high', 'medium', 'low'].map((v) => patchFromSuggestion(s('errorImpact', v), e)),
    [{ errorTolerance: 'none' }, { errorTolerance: 'low' }, { errorTolerance: 'medium' }, { errorTolerance: 'high' }]);
});

test('suggestions with no place in this form are not offered', () => {
  const e = emptyIntake();
  assert.equal(patchFromSuggestion(s('workTypes', ['record', 'transfer']), e), null);
  assert.equal(patchFromSuggestion(s('localOnly', false), e), null);
  assert.equal(patchFromSuggestion(s('frequencyPerMonth', 0), e), null);
  assert.equal(patchFromSuggestion(s('correctness', 'mostly'), e), null);
  assert.deepEqual(patchFromSuggestion(s('localOnly', true), e), { dataResidency: 'on_prem' });
  assert.equal(describePatch({ dataResidency: 'on_prem' }), 'on our own systems only');
});
