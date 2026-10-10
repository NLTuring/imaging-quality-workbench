import test from 'node:test';
import assert from 'node:assert/strict';
import { createLabState, labReducer } from '../state/labMachine.ts';
import type { ImageAsset, LesionSpec } from '../types.ts';

const asset: ImageAsset = {
  name: 'fixture.png', width: 2, height: 2, objectUrl: 'blob:fixture', source: 'demo',
  analysis: { seed: 7, mean: 0.5, contrast: 0.3, edgeStrength: 0.2, histogram: [4], points: new Float32Array(3), relief: new Float32Array(4), sampleSize: 2 },
};
const lesions: LesionSpec[] = [{ id: 'demo-1', name: '演示异常', partId: 'left', location: '左侧模型', position: [0, 1, 0], radius: 0.1, demoSizeMm: 8, demoConfidence: 0.8, suggestion: '仅用于交互演示' }];

test('scan transitions must follow 0 → 1 → 2 → 3 → 4 before dissection', () => {
  let state = createLabState();
  assert.equal(state.stage, 0);
  state = labReducer(state, { type: 'LOAD', asset, lesions });
  assert.equal(state.stage, 1);
  assert.equal(labReducer(state, { type: 'ADVANCE', next: 3, runId: state.runId }), state);
  assert.equal(labReducer(state, { type: 'DISSECT' }), state);
  for (const next of [2, 3, 4] as const) {
    state = labReducer(state, { type: 'ADVANCE', next, runId: state.runId });
    assert.equal(state.stage, next);
  }
  state = labReducer(state, { type: 'DISSECT' });
  assert.equal(state.stage, 5);
});

test('only exposed known lesions can be discovered, counted once, and completed', () => {
  let state = labReducer(createLabState(), { type: 'LOAD', asset, lesions });
  const discover = { type: 'DISCOVER', id: 'demo-1', exposed: true, runId: state.runId } as const;
  assert.equal(labReducer(state, discover), state);
  state = labReducer(state, { type: 'SKIP', runId: state.runId });
  state = labReducer(state, { type: 'DISSECT' });
  assert.equal(labReducer(state, { ...discover, exposed: false }), state);
  assert.equal(labReducer(state, { ...discover, id: 'unknown' }), state);
  assert.equal(labReducer(state, { ...discover, runId: -1 }), state);
  state = labReducer(state, discover);
  assert.deepEqual(state.discoveredIds, ['demo-1']);
  assert.equal(state.completed, true);
  assert.equal(labReducer(state, discover), state);
  const reset = labReducer(state, { type: 'RESET' });
  assert.deepEqual(reset.discoveredIds, []);
  assert.equal(reset.completed, false);
});

test('organ and anatomy controls are gated and numeric values are bounded', () => {
  let state = createLabState();
  state = labReducer(state, { type: 'ORGAN', organ: 'heart' });
  assert.equal(state.organ, 'heart');
  assert.equal(labReducer(state, { type: 'ANATOMY', key: 'clip', value: 0.4 }), state);
  state = labReducer(state, { type: 'LOAD', asset, lesions });
  assert.equal(labReducer(state, { type: 'ORGAN', organ: 'brain' }), state);
  state = labReducer(state, { type: 'SKIP', runId: state.runId });
  state = labReducer(state, { type: 'DISSECT' });
  assert.equal(labReducer(state, { type: 'ANATOMY', key: 'clip', value: NaN }), state);
  state = labReducer(state, { type: 'ANATOMY', key: 'clip', value: 5 });
  assert.equal(state.clip, 1);
  state = labReducer(state, { type: 'ANATOMY', key: 'explode', value: -1 });
  assert.equal(state.explode, 0);
  assert.equal(labReducer(state, { type: 'SELECT_LESION', id: 'unknown' }), state);
  state = labReducer(state, { type: 'SELECT_PART', id: 'left' });
  assert.equal(state.selectedPartId, 'left');
});

test('skip preserves the validated asset; reset rejects stale callbacks and clears discoveries', () => {
  let state = labReducer(createLabState(), { type: 'LOAD', asset, lesions });
  const oldRun = state.runId;
  state = labReducer(state, { type: 'SKIP', runId: oldRun });
  assert.equal(state.stage, 4);
  assert.equal(state.asset, asset);
  assert.deepEqual(state.discoveredIds, []);
  state = labReducer(state, { type: 'RESET' });
  assert.equal(state.stage, 0);
  assert.equal(state.asset, null);
  assert.ok(state.runId > oldRun);
  assert.equal(labReducer(state, { type: 'ADVANCE', runId: oldRun, next: 2 }), state);
  assert.equal(labReducer(state, { type: 'SKIP', runId: oldRun }), state);
});
