import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcLinks, arcUtm, parseAttribution, withUtm } from '../design/marketing.ts';

test('campaign parameters are read, cleaned and kept only when present', () => {
  const a = parseAttribution('https://x.example/for/ops?utm_source=linkedin&utm_campaign=q4%20ops&gclid=abc<script>&other=1', 'https://news.example/post', new Date('2026-10-29T00:00:00Z'));
  assert.deepEqual(a?.utm, { utm_source: 'linkedin', utm_campaign: 'q4 ops' });
  assert.equal(a?.clickIds.gclid, 'abcscript');
  assert.equal(a?.referrerHost, 'news.example');
  assert.equal(a?.landingPath, '/for/ops');
  assert.equal(parseAttribution('https://x.example/', 'https://x.example/other'), null, 'same-site referrer and no campaign');
  assert.equal(parseAttribution('not a url', null), null);
});

test('outbound links carry our source and the original campaign, without overwriting existing parameters', () => {
  const utm = arcUtm('ai-fit-teams', 'report', parseAttribution('https://x.example/?utm_campaign=q4', null));
  assert.deepEqual(utm, { utm_source: 'ai-fit-teams', utm_medium: 'product', utm_campaign: 'q4', utm_content: 'report' });
  assert.equal(arcUtm('ai-fit', 'landing', null).utm_campaign, 'organic');
  const href = withUtm('https://calendly.com/x/30min?utm_source=keep', utm);
  assert.match(href, /utm_source=keep/);
  assert.match(href, /utm_campaign=q4/);
  assert.equal(withUtm('not a url', utm), 'not a url');
});

test('ARC links default to the public site and accept overrides', () => {
  assert.equal(arcLinks().booking, 'https://calendly.com/aking-arctransformationgroup/30min');
  assert.equal(arcLinks({ site: 'https://arc.example/' }).aiFitPage, 'https://arc.example/ai-fit');
});
