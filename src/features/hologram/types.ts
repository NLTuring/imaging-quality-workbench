import type { MutableRefObject } from 'react';

export type OrganType = 'lungs' | 'heart' | 'liver' | 'brain';
export type Stage = 0 | 1 | 2 | 3 | 4 | 5;
export type QualityTier = 'high' | 'balanced' | 'low';
export type Vec3 = [number, number, number];
export interface OrganPart {
  id: string;
  name: string;
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  explodeDirection: Vec3;
}
export interface OrganDefinition {
  name: string;
  english: string;
  description: string;
  parts: OrganPart[];
}
export interface ImageAnalysis {
  seed: number;
  mean: number;
  contrast: number;
  edgeStrength: number;
  histogram: number[];
  points: Float32Array;
  relief: Float32Array;
  sampleSize: number;
}
export interface ImageAsset {
  name: string;
  width: number;
  height: number;
  objectUrl: string;
  source: 'upload' | 'demo';
  analysis: ImageAnalysis;
}
export interface LesionSpec {
  id: string;
  name: string;
  partId: string;
  location: string;
  position: Vec3;
  radius: number;
  demoSizeMm: number;
  demoConfidence: number;
  suggestion: string;
}
export interface MotionValues {
  ingest: number;
  scan: number;
  reveal: number;
  shock: number;
  warning: number;
}
export interface ApertureRect { x: number; y: number; radius: number }
export interface SceneStats { fps: number; drawCalls: number; triangles: number }
export interface LabSceneProps {
  stage: Stage;
  organ: OrganType;
  asset: ImageAsset | null;
  lesions: LesionSpec[];
  discoveredIds: string[];
  selectedLesionId: string | null;
  selectedPartId: string | null;
  clip: number;
  explode: number;
  completed: boolean;
  reducedMotion: boolean;
  quality: QualityTier;
  resetViewToken: number;
  motion: MutableRefObject<MotionValues>;
  onDiscover: (id: string) => void;
  onHoverPart: (id: string | null) => void;
  onSelectPart: (id: string) => void;
  onAperture: (rect: ApertureRect) => void;
  onStats: (stats: SceneStats) => void;
  onQualityChange: (tier: QualityTier) => void;
  onContextLost: () => void;
}
