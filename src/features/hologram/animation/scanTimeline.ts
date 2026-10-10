import { gsap } from 'gsap';
import { MOTION } from '../motion.config.ts';
import type { MotionValues } from '../types';

/** Paused by default so construction is deterministic and StrictMode-safe. */
export function createScanTimeline(values: MotionValues, onStage: (stage: 2 | 3 | 4) => void, reduced = false) {
  const ingest = reduced ? MOTION.reduced.stepDuration : MOTION.ingest.duration;
  const scan = reduced ? MOTION.reduced.stepDuration : MOTION.scan.duration;
  const reveal = reduced ? MOTION.reduced.stepDuration : MOTION.reveal.duration;
  const tl = gsap.timeline({ paused: true });
  tl.to(values, { ingest: 1, duration: ingest, ease: reduced ? 'none' : MOTION.ingest.ease })
    .call(() => onStage(2))
    .to(values, { scan: 1, duration: scan, ease: 'none' })
    .call(() => onStage(3))
    .set(values, { shock: 0 })
    .to(values, { reveal: 1, duration: reveal, ease: MOTION.reveal.ease })
    .to(values, { shock: 1, duration: reduced ? reveal : MOTION.shock.duration, ease: MOTION.shock.ease }, ingest + scan)
    .call(() => onStage(4), [], ingest + scan + reveal);
  return tl;
}
