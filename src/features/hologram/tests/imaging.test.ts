import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePixels, hashBytes } from '../imaging/seededMapping.ts';

test('actual pixel statistics distinguish uniform and high-contrast input deterministically', () => {
  const blank = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 3; i < blank.length; i += 4) blank[i] = 255;
  const flat = analyzePixels(blank, 4, 4, 31);
  assert.equal(flat.mean, 0);
  assert.equal(flat.contrast, 0);
  assert.equal(flat.histogram.reduce((sum, value) => sum + value, 0), 16);
  const pattern = blank.slice();
  for (let i = 0; i < pattern.length; i += 8) pattern.set([255, 255, 255, 255], i);
  const actual = analyzePixels(pattern, 4, 4, hashBytes(pattern));
  assert.ok(actual.contrast > 0.9);
  assert.ok(actual.edgeStrength > 0);
  assert.ok(Math.abs(actual.mean - 0.5) < 0.001);
  assert.ok(actual.points.every(Number.isFinite));
  assert.deepEqual(actual, analyzePixels(pattern, 4, 4, hashBytes(pattern)));
  assert.throws(() => analyzePixels(pattern, 0, 4));
});
