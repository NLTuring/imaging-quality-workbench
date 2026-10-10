import { analyzePixels, hashBytes } from './seededMapping';
import { MAX_FILE_BYTES, readImageHeader } from './imageValidation';
import type { ImageAnalysis, ImageAsset } from '../types';

function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('已取消图像读取', 'AbortError'); }
async function analyzeInWorker(pixels: Uint8ClampedArray, width: number, height: number, seed: number, signal?: AbortSignal): Promise<ImageAnalysis> {
  checkAbort(signal);
  if (typeof Worker === 'undefined') return analyzePixels(pixels, width, height, seed);
  try {
    return await new Promise<ImageAnalysis>((resolve, reject) => {
      const worker = new Worker(new URL('./imageAnalysis.worker.ts', import.meta.url), { type: 'module' });
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', aborted); worker.terminate(); };
      const aborted = () => { cleanup(); reject(new DOMException('已取消图像分析', 'AbortError')); };
      const timer = window.setTimeout(() => { cleanup(); reject(new Error('Worker timed out')); }, 10000);
      signal?.addEventListener('abort', aborted, { once: true });
      worker.onerror = event => { event.preventDefault(); cleanup(); reject(new Error('Worker unavailable')); };
      worker.onmessage = (event: MessageEvent<{ analysis?: ImageAnalysis; error?: string }>) => {
        cleanup();
        if (event.data.analysis) resolve(event.data.analysis); else reject(new Error(event.data.error));
      };
      const transferred = pixels.slice();
      worker.postMessage({ pixels: transferred, width, height, seed }, [transferred.buffer]);
    });
  } catch {
    checkAbort(signal);
    // Small, bounded image; blocked module workers can safely fall back locally.
    return analyzePixels(pixels, width, height, seed);
  }
}
export async function decodeImage(file: File, signal?: AbortSignal): Promise<ImageAsset> {
  if (file.size < 1 || file.size > MAX_FILE_BYTES) throw new Error('影像文件不能为空，且不能超过 20 MiB。');
  if (file.type && !['image/png', 'image/jpeg'].includes(file.type)) throw new Error('请选择 PNG 或 JPG 影像。');
  checkAbort(signal);
  const bytes = new Uint8Array(await file.arrayBuffer()); checkAbort(signal);
  const header = readImageHeader(bytes);
  if (file.type && file.type !== header.mime) throw new Error('影像内容与文件类型不一致。');
  let bitmap: ImageBitmap | null = null;
  let imageUrl: string | null = null;
  try {
    let image: CanvasImageSource;
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      image = bitmap;
    } else {
      imageUrl = URL.createObjectURL(file);
      const element = new Image(); element.src = imageUrl; await element.decode(); image = element;
    }
    checkAbort(signal);
    const width = bitmap?.width ?? (image as HTMLImageElement).naturalWidth;
    const height = bitmap?.height ?? (image as HTMLImageElement).naturalHeight;
    if (width * height > 16777216 || width < 1 || height < 1) throw new Error('解码后的影像尺寸无效。');
    const ratio = Math.min(1, 256 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('浏览器不支持本地图像像素读取。');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const analysis = await analyzeInWorker(pixels, canvas.width, canvas.height, hashBytes(bytes), signal);
    checkAbort(signal);
    // Keep a bounded display texture, not a full-size decoded patient image in GPU memory.
    const textureBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法生成影像预览。')), 'image/png'));
    checkAbort(signal);
    return { name: file.name, width, height, objectUrl: URL.createObjectURL(textureBlob), source: 'upload', analysis };
  } finally { bitmap?.close(); if (imageUrl) URL.revokeObjectURL(imageUrl); }
}
export function releaseAsset(asset: ImageAsset | null) { if (asset?.objectUrl) URL.revokeObjectURL(asset.objectUrl); }
