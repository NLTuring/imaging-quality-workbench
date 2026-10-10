import type { ImageAnalysis, LesionSpec, OrganType } from '../types';
import { ORGAN_REGISTRY } from '../models/organRegistry.ts';

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) | 0;
    let mixed = Math.imul(value ^ value >>> 15, 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}
export function createLesions(organ: OrganType, analysis: ImageAnalysis): LesionSpec[] {
  const random = seededRandom(hashBytes(new TextEncoder().encode(`mapping-v1:${organ}`), analysis.seed));
  const parts = ORGAN_REGISTRY[organ].parts;
  const count = 1 + Math.floor(random() * 3);
  const order = [...parts].map(part => ({ part, sort: random() })).sort((a, b) => a.sort - b.sort);
  return Array.from({ length: count }, (_, index) => {
    const part = order[index % order.length].part;
    const relief = analysis.relief[Math.floor(random() * analysis.relief.length)] ?? 0.5;
    return {
      id: `${organ}-demo-${index + 1}`, name: `演示异常 ${String(index + 1).padStart(2, '0')}`,
      partId: part.id, location: part.name,
      position: [part.position[0] + (random() - 0.5) * part.scale[0] * 0.4, part.position[1] + (relief - 0.5) * part.scale[1] * 0.45, part.position[2] + part.scale[2] * (0.14 + random() * 0.12)],
      radius: 0.075 + random() * 0.055,
      demoSizeMm: Math.round((4 + random() * 9) * 10) / 10,
      demoConfidence: 0.7 + random() * 0.25,
      suggestion: '仅用于演示定位、观察与记录交互。真实发现需由有资质的医生结合完整检查资料独立判断。',
    };
  });
}
export function isLesionExposed(lesion: LesionSpec, clip: number, explode: number): boolean {
  if (!Number.isFinite(clip) || !Number.isFinite(explode) || clip < 0 || clip > 1 || explode < 0 || explode > 1) return false;
  const cutY = 2.4 * (1 - clip);
  if (clip > 0 && cutY < lesion.position[1] - lesion.radius) return false;
  return explode >= 0.55 || (clip > 0 && Math.abs(cutY - lesion.position[1]) <= lesion.radius);
}

export function hashBytes(bytes: ArrayLike<number>, start = 2166136261): number {
  let hash = start;
  for (let index = 0; index < bytes.length; index++) hash = Math.imul(hash ^ bytes[index], 16777619);
  return hash >>> 0;
}
export function analyzePixels(rgba: Uint8ClampedArray, width: number, height: number, seed = hashBytes(rgba)): ImageAnalysis {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 1048576 || rgba.length !== width * height * 4) throw new Error('像素尺寸或数据长度无效。');
  const luminance = new Float32Array(width * height);
  const histogram = Array<number>(256).fill(0);
  let total = 0, squares = 0, edges = 0;
  for (let index = 0; index < luminance.length; index++) {
    const offset = index * 4;
    const value = (0.2126 * rgba[offset] + 0.7152 * rgba[offset + 1] + 0.0722 * rgba[offset + 2]) * rgba[offset + 3] / 255;
    luminance[index] = value; total += value; squares += value * value;
    histogram[Math.max(0, Math.min(255, Math.round(value)))]++;
    if (index % width) edges += Math.abs(value - luminance[index - 1]);
    if (index >= width) edges += Math.abs(value - luminance[index - width]);
  }
  const mean = total / luminance.length;
  const sampleSize = Math.min(64, Math.max(width, height));
  const relief = new Float32Array(sampleSize * sampleSize);
  for (let y = 0; y < sampleSize; y++) for (let x = 0; x < sampleSize; x++) {
    const sx = Math.floor(x / Math.max(1, sampleSize - 1) * (width - 1));
    const sy = Math.floor(y / Math.max(1, sampleSize - 1) * (height - 1));
    relief[y * sampleSize + x] = luminance[sy * width + sx] / 255;
  }
  const points: number[] = [];
  const stride = Math.max(1, Math.ceil(Math.sqrt(luminance.length / 6000)));
  for (let y = 0; y < height; y += stride) for (let x = 0; x < width; x += stride) {
    const value = luminance[y * width + x] / 255;
    if (value < 0.04) continue;
    points.push((x / Math.max(1, width - 1) - 0.5) * 1.65, (1 - y / Math.max(1, height - 1)) * 2.2, (value - 0.5) * 0.65);
  }
  return { seed: seed >>> 0, mean: mean / 255, contrast: Math.min(1, Math.sqrt(Math.max(0, squares / luminance.length - mean * mean)) / 127.5), edgeStrength: edges / (luminance.length * 510), histogram, points: new Float32Array(points), relief, sampleSize };
}
