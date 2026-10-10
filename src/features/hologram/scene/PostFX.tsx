import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import type { QualityTier } from '../types';
import { QUALITY } from '../quality.config';
export default function PostFX({ quality }: { quality: QualityTier }) {
  if (quality === 'low') return null;
  const config = QUALITY[quality];
  return <EffectComposer multisampling={0} enableNormalPass={false}>
    <Bloom intensity={quality === 'high' ? 0.55 : 0.4} luminanceThreshold={0.75} luminanceSmoothing={0.4} mipmapBlur resolutionY={quality === 'high' ? 360 : 220}/>
    <ChromaticAberration offset={[0.00032, 0.00042]} radialModulation modulationOffset={0.35}/>
    <Vignette eskil={false} offset={0.14} darkness={0.42}/>
    <Noise opacity={config.grain} blendFunction={BlendFunction.SOFT_LIGHT}/>
  </EffectComposer>;
}
