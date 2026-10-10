import test from 'node:test';
import assert from 'node:assert/strict';
import { ORGAN_REGISTRY } from '../models/organRegistry.ts';
import { analyzePixels, createLesions, isLesionExposed } from '../imaging/seededMapping.ts';
import type { OrganType } from '../types.ts';

test('four organs have valid unique parts and reproducible internal demo lesions', () => {
  assert.deepEqual(Object.keys(ORGAN_REGISTRY).sort(), ['brain', 'heart', 'liver', 'lungs']);
  const pixels = new Uint8ClampedArray(64).fill(170);
  const analysis = analyzePixels(pixels, 4, 4, 199);
  for (const organ of Object.keys(ORGAN_REGISTRY) as OrganType[]) {
    const parts = ORGAN_REGISTRY[organ].parts;
    assert.ok(parts.length >= 2);
    assert.equal(new Set(parts.map(part => part.id)).size, parts.length);
    const lesions = createLesions(organ, analysis);
    assert.ok(lesions.length >= 1 && lesions.length <= 3);
    assert.deepEqual(lesions, createLesions(organ, analysis));
    for (const lesion of lesions) {
      const part = parts.find(item => item.id === lesion.partId);
      assert.ok(part);
      assert.ok(lesion.position.every(Number.isFinite));
      assert.ok(lesion.radius > 0 && lesion.radius < 0.2);
      assert.match(lesion.name, /演示/);
      assert.equal(isLesionExposed(lesion, 0, 0), false);
      assert.equal(isLesionExposed(lesion, 0, 0.54), false);
      assert.equal(isLesionExposed(lesion, 0, 0.55), true);
      assert.equal(isLesionExposed(lesion, 1 - lesion.position[1] / 2.4, 0), true);
      assert.equal(isLesionExposed(lesion, 1, 1), false, 'fully sliced-away lesions are not exposed by explosion');
      assert.equal(isLesionExposed(lesion, NaN, 0), false);
    }
  }
});
