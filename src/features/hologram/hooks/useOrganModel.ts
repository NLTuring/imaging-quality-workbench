import { useEffect, useMemo } from 'react';
import { ORGAN_REGISTRY } from '../models/organRegistry';
import { createOrganGeometry } from '../models/proceduralOrgans';
import { QUALITY } from '../quality.config';
import type { ImageAnalysis, OrganType, QualityTier } from '../types';

/** Swap this adapter for segmented GLTF/volume geometry without changing the lab flow. */
export function useOrganModel(type: OrganType, quality: QualityTier = 'high', analysis?: ImageAnalysis | null) {
  const model = useMemo(() => ({ ...ORGAN_REGISTRY[type], parts: ORGAN_REGISTRY[type].parts.map(part => ({ ...part, geometry: createOrganGeometry(type, part, QUALITY[quality].segments, analysis) })) }), [type, quality, analysis]);
  useEffect(() => () => model.parts.forEach(part => part.geometry.dispose()), [model]);
  return model;
}
