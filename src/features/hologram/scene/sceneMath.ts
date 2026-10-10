import { MOTION } from '../motion.config.ts';
export function scanEnvelope(progress: number): number {
  if (!Number.isFinite(progress) || progress <= 0 || progress >= 1) return 0;
  const time = progress * MOTION.scan.duration;
  if (time < MOTION.scan.pre) return 0.16 * Math.sin(time / MOTION.scan.pre * Math.PI / 2);
  if (time < MOTION.scan.pre + MOTION.scan.peak) {
    const phase = (time - MOTION.scan.pre) / MOTION.scan.peak;
    const base = phase < 0.5 ? 0.16 : 0.4;
    return base + (1 - base) * Math.sin(phase * Math.PI);
  }
  return 0.4 * Math.pow(1 - (time - MOTION.scan.pre - MOTION.scan.peak) / MOTION.scan.settle, 3);
}
export function ingestRipple(progress: number) {
  const phase = (progress - MOTION.ingest.rippleStart) / (1 - MOTION.ingest.rippleStart);
  if (!Number.isFinite(phase) || phase <= 0 || phase >= 1) return { scale: 1, opacity: 0 };
  return { scale: 1 + phase * MOTION.ingest.rippleScale, opacity: Math.sin(phase * Math.PI) * MOTION.ingest.rippleOpacity };
}
export function visibleAtSlice(y: number, clip: number) { return clip <= 0 || y <= 2.4 * (1 - clip) + 0.003; }
export const ORGAN_Y = -0.72;
export const SCANNER_Y = 2.65;
