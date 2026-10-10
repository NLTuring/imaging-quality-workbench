import test from 'node:test';
import assert from 'node:assert/strict';
import { createScanTimeline } from '../animation/scanTimeline.ts';
import { MOTION } from '../motion.config.ts';
import type { MotionValues } from '../types.ts';

test('timeline crosses stages in order and finishes all uniforms when fast-forwarded', () => {
  const values: MotionValues = { ingest: 0, scan: 0, reveal: 0, shock: 1, warning: 0 };
  const stages: number[] = [];
  const tl = createScanTimeline(values, next => stages.push(next), false);
  assert.equal(tl.paused(), true);
  assert.equal(tl.duration(), MOTION.ingest.duration + MOTION.scan.duration + MOTION.reveal.duration);
  tl.totalTime(MOTION.ingest.duration + 0.001, false);
  assert.deepEqual(stages, [2]);
  tl.totalProgress(1, false);
  assert.deepEqual(stages, [2, 3, 4]);
  assert.equal(values.reveal, 1);
  tl.kill();
});
