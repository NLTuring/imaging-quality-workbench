import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePixels,windowPixels,sortSlices,parseDicomFile} from './dicom.js';
import {makeSyntheticDicom} from './dicom-fixture.js';
test('parse full synthetic Part10 native CT file',()=>{const r=parseDicomFile(makeSyntheticDicom());assert.equal(r.rows,32);assert.equal(r.pixels[0],-1024);assert.equal(r.seriesUID,'1.2.3.4');});
test('signed rescale and little endian pixels',()=>{const b=new Uint8Array([255,255,0,0,1,0]);const r=decodePixels(b,{rows:1,columns:3,bitsAllocated:16,bitsStored:16,highBit:15,pixelRepresentation:1,slope:2,intercept:-1000});assert.deepEqual([...r.pixels],[-1002,-1000,-998]);});
test('window inversion and bounds',()=>{const p=new Float32Array([-1000,0,1000]);assert.deepEqual([...windowPixels(p,400,0)].filter((_,i)=>i%4===0),[0,128,255]);assert.equal(windowPixels(p,400,0,true)[0],255);assert.throws(()=>windowPixels(p,0,0));});
test('reject truncated and non-DICOM data',()=>{assert.throws(()=>parseDicomFile(new Uint8Array(200)));assert.throws(()=>decodePixels(new Uint8Array(1),{rows:2,columns:2,bitsAllocated:16,bitsStored:16,highBit:15,pixelRepresentation:0}));});
test('sort slices by spatial position before instance',()=>{const orientation=[1,0,0,0,1,0];const a={orientation,position:[0,0,2],instanceNumber:1,filename:'a'},b={orientation,position:[0,0,1],instanceNumber:2,filename:'b'};assert.deepEqual(sortSlices([a,b]),[b,a]);});
