import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  CALIBRATION_MIN_SAMPLE,
  CalibrationSet,
  PatternPrior,
  parseCalibrationResponse,
  patternsAboveFloor,
  type CalibrationResponse,
} from './index.js';

const root = new URL('../', import.meta.url);
const fixture = (name: string): CalibrationResponse & { description: string } =>
  JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, root), 'utf8'));

describe('fixtures', () => {
  test('a measured 200 parses', () => {
    const set = parseCalibrationResponse(fixture('measured'));
    assert.ok(set);
    assert.equal(set.basis, 'measured');
    assert.equal(set.patterns[0]?.sampleSize, 200);
  });

  test('a calibrated (fleet) 200 parses', () => {
    const set = parseCalibrationResponse(fixture('calibrated'));
    assert.ok(set);
    assert.equal(set.basis, 'calibrated');
  });

  test('a below-floor 200 parses, but none of its patterns clear the 30-trace floor', () => {
    const set = parseCalibrationResponse(fixture('below-floor'));
    assert.ok(set);
    assert.equal(set.basis, 'measured');
    assert.ok(set.patterns.every((p) => p.sampleSize < CALIBRATION_MIN_SAMPLE));
    assert.deepEqual(patternsAboveFloor(set), []);
  });

  test('a 401 is null', () => {
    assert.equal(parseCalibrationResponse(fixture('unauthorized')), null);
  });

  test('a 200 that does not match the contract is null', () => {
    assert.equal(parseCalibrationResponse(fixture('invalid')), null);
  });

  test('every fixture says what it stands for', () => {
    const names = readdirSync(new URL('fixtures/', root)).filter((f) => f.endsWith('.json'));
    assert.deepEqual(names.sort(), ['below-floor.json', 'calibrated.json', 'invalid.json', 'measured.json', 'unauthorized.json']);
    for (const n of names) assert.ok(fixture(n.replace(/\.json$/, '')).description.length > 20, n);
  });
});

describe('null, never partial', () => {
  test('one bad pattern voids the whole set', () => {
    const good = fixture('measured');
    const body = structuredClone(good.body) as { patterns: Record<string, unknown>[] };
    body.patterns.push({ pattern: 'rag', turnsPerOutcome: 'many' });
    assert.equal(parseCalibrationResponse({ status: 200, body }), null);
  });

  test('a valid body on a non-200 status is null', () => {
    for (const status of [201, 204, 304, 404, 500, 503]) {
      assert.equal(parseCalibrationResponse({ status, body: fixture('measured').body }), null, String(status));
    }
  });

  test('non-object bodies are null', () => {
    for (const body of [null, undefined, '', 'ok', 42, [], {}]) {
      assert.equal(parseCalibrationResponse({ status: 200, body }), null, JSON.stringify(body));
    }
  });
});

describe('the sample floor', () => {
  test('is 30, inclusive', () => {
    assert.equal(CALIBRATION_MIN_SAMPLE, 30);
    const set = parseCalibrationResponse(fixture('measured'))!;
    const at = (n: number) => patternsAboveFloor({ ...set, patterns: [{ ...set.patterns[0]!, sampleSize: n }] }).length;
    assert.equal(at(29), 0);
    assert.equal(at(30), 1);
  });
});

describe('the JSON Schema matches the zod schema', () => {
  const schema = JSON.parse(readFileSync(new URL('calibration-set.schema.json', root), 'utf8')) as {
    required: string[];
    properties: Record<string, unknown>;
    $defs: { PatternPrior: { required: string[]; properties: Record<string, unknown> } };
  };

  const split = (shape: Record<string, { isOptional(): boolean }>) => ({
    all: Object.keys(shape).sort(),
    required: Object.keys(shape).filter((k) => !shape[k]!.isOptional()).sort(),
  });

  test('CalibrationSet fields and required fields agree', () => {
    const z = split(CalibrationSet.shape);
    assert.deepEqual(Object.keys(schema.properties).sort(), z.all);
    assert.deepEqual([...schema.required].sort(), z.required);
  });

  test('PatternPrior fields and required fields agree', () => {
    const z = split(PatternPrior.shape);
    assert.deepEqual(Object.keys(schema.$defs.PatternPrior.properties).sort(), z.all);
    assert.deepEqual([...schema.$defs.PatternPrior.required].sort(), z.required);
  });
});
