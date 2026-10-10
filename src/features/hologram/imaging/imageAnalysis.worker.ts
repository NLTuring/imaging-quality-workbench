import { analyzePixels } from './seededMapping';
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = (event: MessageEvent<{ pixels: Uint8ClampedArray; width: number; height: number; seed: number }>) => {
  try {
    const { pixels, width, height, seed } = event.data;
    const analysis = analyzePixels(pixels, width, height, seed);
    worker.postMessage({ analysis }, [analysis.points.buffer as ArrayBuffer, analysis.relief.buffer as ArrayBuffer]);
  } catch (error) { worker.postMessage({ error: error instanceof Error ? error.message : '像素分析失败。' }); }
};
