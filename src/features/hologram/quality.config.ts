import type { QualityTier } from './types';
export const QUALITY: Record<QualityTier, { dpr: number; particles: number; segments: number; bloom: boolean; aberration: boolean; grain: number }> = {
  high: { dpr: 2, particles: 18000, segments: 40, bloom: true, aberration: true, grain: 0.018 },
  balanced: { dpr: 1.5, particles: 8000, segments: 28, bloom: true, aberration: true, grain: 0.012 },
  low: { dpr: 1, particles: 2500, segments: 18, bloom: false, aberration: false, grain: 0.006 },
};
export const COLORS = { background: '#030a14', cyan: '#00E5FF', pink: '#FF3D7F', orange: '#ff8058', ink: '#d8f3fa' } as const;
