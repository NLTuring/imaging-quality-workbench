import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, ShaderMaterial } from 'three';
import { seededRandom } from '../imaging/seededMapping';
import { QUALITY } from '../quality.config';
import { ORGAN_Y, SCANNER_Y } from './sceneMath';
import type { LabSceneProps } from '../types';

export default function ParticleSystems({ asset, stage, quality, motion, reducedMotion }: LabSceneProps) {
  const dpr = useThree(state => state.viewport.dpr);
  const time = useRef(0);
  const geometry = useMemo(() => {
    const count = QUALITY[quality].particles;
    const positions = new Float32Array(count * 3), targets = new Float32Array(count * 3), seeds = new Float32Array(count);
    const random = seededRandom(asset?.analysis.seed ?? 8493);
    const cloud = asset?.analysis.points;
    for (let index = 0; index < count; index++) {
      const angle = random() * Math.PI * 2, radius = 1.4 + random() * 1.4;
      const offset = index * 3; seeds[index] = random();
      if (index < 350) { positions.set([(random() - 0.5) * 17, random() * 8 - 2, -2 - random() * 6], offset); }
      else positions.set([Math.cos(angle) * radius, ORGAN_Y + random() * 0.4, Math.sin(angle) * radius], offset);
      if (cloud?.length) { const source = Math.floor(random() * cloud.length / 3) * 3; targets.set([cloud[source], cloud[source + 1] + ORGAN_Y, cloud[source + 2]], offset); }
      else targets.set([Math.cos(angle) * random(), ORGAN_Y + random() * 2.1, Math.sin(angle) * random() * 0.5], offset);
    }
    return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3)).setAttribute('aTarget', new Float32BufferAttribute(targets, 3)).setAttribute('aSeed', new Float32BufferAttribute(seeds, 1));
  }, [quality, asset?.analysis]);
  const material = useMemo(() => new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uStage: { value: 0 }, uReveal: { value: 0 }, uDpr: { value: 1 }, uWarning: { value: 0 }, uReduced: { value: 0 } },
    vertexShader: `attribute vec3 aTarget;attribute float aSeed;uniform float uTime,uStage,uReveal,uDpr,uReduced;varying float vSeed,vAlpha;
      void main(){vec3 p=position;vSeed=aSeed;vAlpha=0.2;
        bool star=position.z < -2.0;
        if(star){p.y+=sin(uTime*0.04+aSeed*7.0)*0.1;vAlpha=0.35;}
        else if(uStage>=2.0){float a=aSeed*62.83+uTime*0.24;
          vec3 swirl=vec3(cos(a)*(0.35+aSeed*1.0),fract(aSeed*11.0+uTime*0.07)*2.2-0.72,sin(a)*(0.35+aSeed*1.0));
          p=mix(swirl,aTarget,smoothstep(0.0,1.0,uReveal));vAlpha=uStage<4.0?0.3:0.045;
        }else{p.y+=sin(uTime*0.4+aSeed*15.0)*0.035;vAlpha=0.10;}
        vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((1.1+aSeed*1.4)*uDpr*6.0/max(1.0,-mv.z),0.5,4.0);
      }`,
    fragmentShader: `uniform float uWarning;varying float vSeed,vAlpha;void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;vec3 color=mix(vec3(0.05,0.65,0.9),vec3(1.0,0.16,0.38),uWarning*0.7);gl_FragColor=vec4(color,(1.0-smoothstep(0.1,0.5,d))*vAlpha);#include <colorspace_fragment>}`.replace(';#include', ';\n#include'),
  }), []);
  const sparks = useMemo(() => {
    const positions: number[] = []; const random = seededRandom(721);
    for (let index = 0; index < 24; index++) {
      const angle = random() * Math.PI * 2;
      for (let segment = 0; segment < 3; segment++) for (const part of [segment, segment + 1]) { const radius = 0.55 + part * 0.07; positions.push(Math.cos(angle) * radius + (random() - 0.5) * 0.045, SCANNER_Y + Math.sin(angle) * radius + (random() - 0.5) * 0.045, 0.11); }
    }
    return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3));
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => { material.dispose(); sparks.dispose(); }, [material, sparks]);
  useFrame((_, delta) => {
    if (document.hidden) return;
    if (!reducedMotion) time.current += Math.min(delta, 0.05);
    material.uniforms.uTime.value = time.current;
    material.uniforms.uStage.value = stage;
    material.uniforms.uReveal.value = motion.current.reveal;
    material.uniforms.uDpr.value = dpr;
    material.uniforms.uWarning.value = motion.current.warning;
  });
  return <group>
    <points geometry={geometry} material={material} frustumCulled={false}/>
    {stage === 2 && !reducedMotion && <lineSegments geometry={sparks}><lineBasicMaterial color="#82f7ff" transparent opacity={0.55}/></lineSegments>}
  </group>;
}
