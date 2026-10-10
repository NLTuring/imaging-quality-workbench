/** Seconds / stylized world units. These are not clinical units. */
export const MOTION = {
  idle: { floatAmplitude: 0.025, floatPeriod: 3.6, ringPeriod: 18 },
  ingest: { duration: 0.65, ease: 'power3.in', hoverDuration: 0.16, rippleStart: 0.35, rippleScale: 1.8, rippleOpacity: 0.55 },
  scan: {
    duration: 3.2, pre: 0.7, peak: 1.7, settle: 0.8,
    amplitudes: [0.012, 0.075, 0] as const,
    rotationDegrees: [0.4, 3.5, 0] as const,
    axisScale: [1, 0.6, 0.37] as const,
    rotationAxisScale: [0.67, 1, 0.67] as const,
    frequencies: [6, 22, 9] as const,
    cameraAmplitude: 0.009,
    settleEase: 'expo.out',
  },
  reveal: { duration: 1.6, ease: 'none', labelDelay: 0.2 },
  shock: { duration: 0.45, ease: 'expo.out' },
  inspect: { damping: 0.08, hoverDuration: 0.15 },
  anatomy: { clipSmoothing: 0.12, explodeDuration: 0.7, ease: 'power3.inOut' },
  complete: { duration: 0.6, ease: 'power2.inOut' },
  reset: { duration: 0.45, ease: 'power2.inOut' },
  reduced: { stepDuration: 0.08 },
  audio: { baseHz: 48, peakHz: 82, maxGain: 0.035, fadeSeconds: 0.08 },
} as const;
