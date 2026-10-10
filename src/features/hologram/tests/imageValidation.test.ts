import test from 'node:test';
import assert from 'node:assert/strict';
import { readImageHeader } from '../imaging/imageValidation.ts';
function png(width: number, height: number) {
  const bytes = new Uint8Array(33);
  bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
  const view = new DataView(bytes.buffer); view.setUint32(16,width); view.setUint32(20,height);
  return bytes;
}
test('rejects forged, oversized and malformed images before browser decode', () => {
  assert.deepEqual(readImageHeader(png(256,128)), { width:256, height:128, mime:'image/png' });
  assert.throws(() => readImageHeader(png(100000,100000)), /尺寸/);
  assert.throws(() => readImageHeader(png(0,5)), /尺寸/);
  assert.throws(() => readImageHeader(new TextEncoder().encode('<svg></svg>')), /PNG|JPEG/);
  assert.throws(() => readImageHeader(new Uint8Array([255,216,255,224,0,1])), /JPEG/);
});
