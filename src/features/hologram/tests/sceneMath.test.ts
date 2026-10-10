import test from 'node:test';
import assert from 'node:assert/strict';
import { scanEnvelope, visibleAtSlice, ingestRipple } from '../scene/sceneMath.ts';
import { createOrganGeometry, createSliceCap } from '../models/proceduralOrgans.ts';
import { ORGAN_REGISTRY } from '../models/organRegistry.ts';
import { analyzePixels } from '../imaging/seededMapping.ts';
import { MOTION } from '../motion.config.ts';

test('scan envelope is bounded, peaks after pre-scan and settles exactly to zero', () => {
  assert.equal(scanEnvelope(0), 0);
  assert.equal(scanEnvelope(1), 0);
  assert.ok(scanEnvelope(0.5) > scanEnvelope(0.1));
  for (let i=0; i<=100; i++) assert.ok(scanEnvelope(i/100)>=0 && scanEnvelope(i/100)<=1);
  assert.equal(visibleAtSlice(2,0),true);
  assert.equal(visibleAtSlice(2,0.5),false);
  assert.equal(visibleAtSlice(0.5,0.5),true);
});
test('scan envelope is continuous across pre-scan and settle boundaries', () => {
  for(const time of [MOTION.scan.pre, MOTION.scan.pre+MOTION.scan.peak]) {
    const progress=time/MOTION.scan.duration;
    assert.ok(Math.abs(scanEnvelope(progress-0.000001)-scanEnvelope(progress+0.000001))<0.0001);
  }
});

test('ingest ripple expands and fades only near the camera intake', () => {
  assert.equal(ingestRipple(0).opacity, 0);
  assert.equal(ingestRipple(1).opacity, 0);
  assert.equal(ingestRipple(NaN).opacity, 0);
  assert.ok(ingestRipple(0.65).opacity > 0);
  assert.ok(ingestRipple(0.65).scale > ingestRipple(0.4).scale);
});

test('slicing a real mesh produces a finite closed planar cap', () => {
  const part = ORGAN_REGISTRY.heart.parts[0];
  const geometry = createOrganGeometry('heart', part, 16);
  const cap = createSliceCap(geometry, part.position[1]);
  assert.ok(cap);
  assert.ok(cap.getAttribute('position').count > 3);
  const positions = cap.getAttribute('position');
  for(let i=0;i<positions.count;i++) assert.ok(Math.abs(positions.getY(i)-part.position[1])<0.00001);
  assert.equal(createSliceCap(geometry, 10), null);
  cap.dispose(); geometry.dispose();
});

test('procedural geometry is deterministic, finite, and responds to real image relief', () => {
  const part = ORGAN_REGISTRY.lungs.parts[0];
  const dark = analyzePixels(new Uint8ClampedArray(64),4,4,42);
  const bright = analyzePixels(new Uint8ClampedArray(64).fill(255),4,4,42);
  const a = createOrganGeometry('lungs',part,16,dark);
  const b = createOrganGeometry('lungs',part,16,dark);
  const c = createOrganGeometry('lungs',part,16,bright);
  const positions = a.getAttribute('position').array;
  assert.ok(Array.from(positions).every(Number.isFinite));
  assert.deepEqual(positions,b.getAttribute('position').array);
  assert.notDeepEqual(positions,c.getAttribute('position').array);
  for(const geometry of [a,b,c]) geometry.dispose();
});
