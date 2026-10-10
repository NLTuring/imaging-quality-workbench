import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { createScanTimeline } from '../animation/scanTimeline';
import { MOTION } from '../motion.config';
import type { LabAction, LabState } from '../state/labMachine';
import type { Dispatch } from 'react';
import type { MotionValues } from '../types';

export function useScanTimeline(state: LabState, dispatch: Dispatch<LabAction>, reducedMotion: boolean) {
  const motion = useRef<MotionValues>({ ingest: 0, scan: 0, reveal: 0, shock: 1, warning: 0 });
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const [progress, setProgress] = useState(0);
  const current = useRef(state);
  current.current = state;
  useEffect(() => {
    const values = motion.current;
    Object.assign(values, { ingest: 0, scan: 0, reveal: 0, shock: 1, warning: 0 });
    setProgress(0);
    if (!current.current.asset) return;
    const runId = state.runId;
    const tl = createScanTimeline(values, next => dispatch({ type: 'ADVANCE', next, runId }), reducedMotion);
    timeline.current = tl;
    let last = 0;
    tl.eventCallback('onUpdate', () => {
      const now = performance.now();
      if (now - last > 80 || tl.progress() === 1) { setProgress(Math.round(tl.progress() * 100)); last = now; }
    });
    const visibility = () => document.hidden ? tl.pause() : tl.play();
    document.addEventListener('visibilitychange', visibility);
    if (!document.hidden) tl.play();
    return () => { tl.kill(); timeline.current = null; document.removeEventListener('visibilitychange', visibility); };
  }, [state.runId, dispatch]);
  const skip = useCallback(() => {
    if (current.current.stage < 1 || current.current.stage > 3) return;
    timeline.current?.totalProgress(1, false).pause();
    Object.assign(motion.current, { ingest: 1, scan: 1, reveal: 1, shock: 1 });
    dispatch({ type: 'SKIP', runId: current.current.runId });
    setProgress(100);
  }, [dispatch]);
  useEffect(() => { if (reducedMotion) skip(); }, [reducedMotion, skip]);
  useEffect(() => {
    const tween = gsap.to(motion.current, { warning: state.completed ? 1 : 0, duration: reducedMotion ? 0 : MOTION.complete.duration, ease: MOTION.complete.ease });
    return () => { tween.kill(); };
  }, [state.completed, reducedMotion]);
  const cancel = useCallback(() => { timeline.current?.kill(); timeline.current = null; }, []);
  return { motion, progress, skip, cancel };
}
