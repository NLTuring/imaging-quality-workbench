import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { gsap } from 'gsap';
import { BufferGeometry, CatmullRomCurve3, DoubleSide, EdgesGeometry, Group, Mesh, TubeGeometry, Vector3 } from 'three';
import type { Intersection, Raycaster } from 'three';
import { useOrganModel } from '../hooks/useOrganModel';
import { createHologramMaterial } from '../materials/HologramMaterial';
import { createSliceCap } from '../models/proceduralOrgans';
import { MOTION } from '../motion.config';
import { ORGAN_Y } from './sceneMath';
import LesionField from './LesionField';
import type { LabSceneProps, OrganPart, Vec3 } from '../types';

function OrganPiece({ part, props }: { part: OrganPart & { geometry: BufferGeometry }; props: LabSceneProps }) {
  const group = useRef<Group>(null); const mesh = useRef<Mesh>(null);
  const movement = useRef({ amount: 0 }); const elapsed = useRef(0);
  const materials = useMemo(() => [createHologramMaterial(), createHologramMaterial(true)], []);
  const cutY = props.stage === 5 && props.clip > 0 ? 2.4 * (1 - props.clip) : 3;
  const cap = useMemo(() => cutY < 3 ? createSliceCap(part.geometry, cutY) : null, [part.geometry, cutY]);
  const capEdge = useMemo(() => cap ? new EdgesGeometry(cap) : null, [cap]);
  const guide = useMemo(() => new BufferGeometry().setFromPoints([new Vector3(...part.position), new Vector3(...part.position)]), [part]);
  useEffect(() => {
    const tween = gsap.to(movement.current, { amount: props.explode, duration: props.reducedMotion ? 0 : MOTION.anatomy.explodeDuration, ease: MOTION.anatomy.ease });
    return () => { tween.kill(); };
  }, [props.explode, props.reducedMotion]);
  useEffect(() => {
    const tweens = materials.map(material => gsap.to(material.uniforms.uClip, { value: cutY, duration: props.reducedMotion ? 0 : MOTION.anatomy.clipSmoothing, ease: 'power2.out' }));
    return () => tweens.forEach(tween => tween.kill());
  }, [cutY, materials, props.reducedMotion]);
  useEffect(() => {
    const object = mesh.current;
    if (!object) return;
    object.raycast = function(raycaster: Raycaster, intersections: Intersection[]) {
      const hits: Intersection[] = []; Mesh.prototype.raycast.call(this, raycaster, hits);
      for (const hit of hits) {
        const local = this.worldToLocal(hit.point.clone());
        if (local.y <= materials[0].uniforms.uClip.value && local.y <= materials[0].uniforms.uReveal.value * 2.65 - 0.12) intersections.push(hit);
      }
    };
  }, [materials]);
  useEffect(() => () => { cap?.dispose(); capEdge?.dispose(); }, [cap, capEdge]);
  useEffect(() => () => { materials.forEach(material => material.dispose()); guide.dispose(); }, [materials, guide]);
  useFrame((_, delta) => {
    if (document.hidden) return;
    if (!props.reducedMotion) elapsed.current += Math.min(delta, 0.05);
    const offset = part.explodeDirection.map(value => value * movement.current.amount) as Vec3;
    if (group.current) group.current.position.set(...offset);
    const attribute = guide.getAttribute('position');
    attribute.setXYZ(1, part.position[0] + offset[0], part.position[1] + offset[1], part.position[2] + offset[2]); attribute.needsUpdate = true;
    for (const material of materials) {
      material.uniforms.uTime.value = elapsed.current;
      material.uniforms.uReveal.value = props.motion.current.reveal;
      material.uniforms.uWarning.value = props.motion.current.warning;
      const hover = props.selectedPartId === part.id ? 1 : 0;
      material.uniforms.uHover.value += (hover - material.uniforms.uHover.value) * (props.reducedMotion ? 1 : 1 - Math.exp(-delta * 3 / MOTION.inspect.hoverDuration));
    }
  });
  const hover = (event: ThreeEvent<PointerEvent>) => { if (props.stage >= 4) { event.stopPropagation(); props.onHoverPart(part.id); } };
  return <>
    <group ref={group}>
      <mesh ref={mesh} geometry={part.geometry} material={materials[0]} onPointerOver={hover} onPointerOut={() => props.onHoverPart(null)} onClick={event => { if (props.stage >= 4) { if (props.stage !== 5) event.stopPropagation(); props.onSelectPart(part.id); } }}/>
      <mesh geometry={part.geometry} material={materials[1]} raycast={() => {}}/>
      {cap && <mesh geometry={cap} raycast={() => {}}><meshBasicMaterial color="#21a9b8" transparent opacity={0.35} side={DoubleSide} depthWrite={false}/></mesh>}
      {capEdge && <lineSegments geometry={capEdge}><lineBasicMaterial color="#a1ffff" transparent opacity={0.7}/></lineSegments>}
      {props.stage >= 4 && props.selectedPartId === part.id && <Html position={[part.position[0] + (part.position[0] < 0 ? -0.65 : 0.65), part.position[1] + 0.15, 0.45]} center zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}><div className="hl-organ-tooltip"><strong>{part.name}</strong><span>参数化组织 · 演示结构</span></div></Html>}
    </group>
    {props.explode > 0.02 && <lineSegments geometry={guide} frustumCulled={false}><lineDashedMaterial color="#5dd6e4" transparent opacity={0.4} dashSize={0.05} gapSize={0.035}/></lineSegments>}
  </>;
}
function InternalVessels(props: LabSceneProps) {
  const material = useMemo(() => createHologramMaterial(), []);
  const geometries = useMemo(() => {
    const paths: { points: Vec3[]; radius: number }[] = [];
    if (props.organ === 'lungs') {
      paths.push({ points: [[0,2.31,0],[0,1.98,0],[0,1.67,0.05]], radius: 0.052 });
      for (const direction of [-1,1]) {
        paths.push({ points: [[0,1.69,0.05],[direction*0.26,1.38,0.05],[direction*0.53,0.55,0.04]], radius: 0.034 });
        for(let index=0;index<4;index++) paths.push({ points: [[direction*0.27,1.4-index*0.18,0.05],[direction*0.47,1.52-index*0.24,0.08],[direction*0.7,1.57-index*0.26,0.06]], radius: 0.011 });
      }
    } else if(props.organ==='heart') {
      paths.push({ points:[[0.05,1.7,0],[0.16,2.12,0],[-0.1,2.34,0],[-0.35,2.02,-0.04]],radius:0.09 },{ points:[[0.37,1.48,0.1],[0.42,2.09,0.04],[0.72,2.19,0]],radius:0.06 },{ points:[[-0.16,1.57,0.42],[-0.25,1.15,0.48],[0.02,0.64,0.35]],radius:0.016 });
    } else if(props.organ==='liver') {
      paths.push({points:[[0,0.65,0.35],[0.04,1.08,0.37],[0.55,1.35,0.25]],radius:0.03},{points:[[0.04,1.08,0.37],[-0.32,1.17,0.25],[-0.8,1.24,0.1]],radius:0.024});
    } else paths.push({points:[[0,0.15,-0.1],[0,0.51,0],[0,0.9,0]],radius:0.07});
    return paths.map(path=>new TubeGeometry(new CatmullRomCurve3(path.points.map(point=>new Vector3(...point))),24,path.radius,7,false));
  },[props.organ]);
  useEffect(()=>()=>{geometries.forEach(geometry=>geometry.dispose());},[geometries]);
  useEffect(()=>()=>material.dispose(),[material]);
  useFrame(()=>{material.uniforms.uReveal.value=props.motion.current.reveal;material.uniforms.uClip.value=props.clip>0?2.4*(1-props.clip):3;material.uniforms.uWarning.value=props.motion.current.warning;});
  return <group>{geometries.map((geometry,index)=><mesh key={index} geometry={geometry} material={material} raycast={()=>{}}/>)}</group>;
}
export default function OrganAssembly(props: LabSceneProps) {
  const model = useOrganModel(props.organ, props.quality, props.asset?.analysis);
  const compact = useThree(state => state.size.width < 500);
  const labelX = compact ? 0.85 : 1.57;
  return <group position={[0, ORGAN_Y, 0]}>
    {model.parts.map(part => <OrganPiece key={part.id} part={part} props={props}/>)}
    <InternalVessels {...props}/>
    <LesionField {...props}/>
    {props.stage >= 4 && !props.selectedPartId && <group>
      <Line points={[[0.82,1.7,0],[0.9,1.95,0],[labelX,1.95,0]]} color="#4ba8b9" transparent opacity={0.55} lineWidth={1}/>
      <Html position={[labelX,1.95,0]} zIndexRange={[2,0]} style={{pointerEvents:'none'}}><div className="hl-organ-label" style={{ minWidth: compact ? 78 : 120 }}><b>{model.name}</b><span>{model.english}{!compact && ' / SIMULATION'}</span></div></Html>
    </group>}
  </group>;
}
