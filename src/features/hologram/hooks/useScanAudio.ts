import { useCallback, useEffect, useRef, useState } from 'react';
import { MOTION } from '../motion.config';
import type { Stage } from '../types';

interface AudioGraph { context: AudioContext; oscillator: OscillatorNode; gain: GainNode }
export function useScanAudio(stage: Stage) {
  const [muted, setMuted] = useState(true);
  const [audioError, setAudioError] = useState('');
  const graph = useRef<AudioGraph | null>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const dispose = useCallback(() => {
    generation.current++;
    const audio = graph.current; graph.current = null;
    if (audio) { audio.oscillator.stop(); audio.oscillator.disconnect(); audio.gain.disconnect(); void audio.context.close().catch(() => {}); }
  }, []);
  const resetAudio = useCallback(() => { dispose(); setMuted(true); setAudioError(''); }, [dispose]);
  const toggle = useCallback(async () => {
    const token = generation.current;
    try {
      if (!graph.current) {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = MOTION.audio.baseHz;
        filter.type = 'lowpass'; filter.frequency.value = 180;
        gain.gain.value = 0;
        oscillator.connect(filter); filter.connect(gain); gain.connect(context.destination);
        oscillator.start();
        graph.current = { context, oscillator, gain };
      }
      if (muted) await graph.current.context.resume();
      if (alive.current && token === generation.current) { setMuted(value => !value); setAudioError(''); }
    } catch { if (alive.current && token === generation.current) { dispose(); setMuted(true); setAudioError('此浏览器无法启用音频，已保持静音。'); } }
  }, [muted, dispose]);
  useEffect(() => {
    const audio = graph.current;
    if (!audio) return;
    const now = audio.context.currentTime;
    audio.gain.gain.cancelScheduledValues(now);
    audio.gain.gain.setTargetAtTime(!muted && stage === 2 ? MOTION.audio.maxGain : 0, now, MOTION.audio.fadeSeconds);
    audio.oscillator.frequency.cancelScheduledValues(now);
    audio.oscillator.frequency.setValueAtTime(MOTION.audio.baseHz, now);
    if (stage === 2 && !muted) audio.oscillator.frequency.linearRampToValueAtTime(MOTION.audio.peakHz, now + MOTION.scan.pre + MOTION.scan.peak);
    if (stage === 3 && !muted) {
      const click = audio.context.createOscillator(); const envelope = audio.context.createGain();
      click.frequency.value = 950; envelope.gain.setValueAtTime(0.018, now); envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      click.connect(envelope); envelope.connect(audio.context.destination); click.start(now); click.stop(now + 0.06);
      click.onended = () => { click.disconnect(); envelope.disconnect(); };
    }
  }, [stage, muted]);
  useEffect(() => {
    alive.current = true;
    const visibility = () => {
      const audio = graph.current;
      if (!audio) return;
      if (document.hidden) void audio.context.suspend().catch(() => {});
      else if (!muted) void audio.context.resume().catch(() => {});
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [muted]);
  useEffect(() => () => {
    alive.current = false;
    dispose();
  }, [dispose]);
  return { muted, toggle, audioError, resetAudio };
}
