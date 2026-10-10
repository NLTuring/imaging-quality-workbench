import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, LineBasicMaterial, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { COLORS } from '../quality.config';
import { createBeamMaterial } from '../materials/HologramMaterial';
import type { LabSceneProps } from '../types';

export default function ProjectionStage({ stage, motion, reducedMotion }: LabSceneProps) {
  const rings = useRef<Group>(null); const dna = useRef<Group>(null);
  const ticks = useRef<InstancedMesh>(null); const sweep = useRef<Mesh>(null); const shock = useRef<Mesh>(null);
  const dnaMaterial = useRef<LineBasicMaterial>(null); const rim = useRef<MeshBasicMaterial>(null);
  const time = useRef(0);
  const beam = useMemo(createBeamMaterial, []);
  const helix = useMemo(() => {
    const points: number[] = [];
    for (let strand = 0; strand < 2; strand++) for (let index = 0; index < 100; index++) {
      for (const step of [index, index + 1]) { const t = step / 100, a = t * Math.PI * 6 + strand * Math.PI; points.push(Math.cos(a) * 0.36, t * 2.15, Math.sin(a) * 0.36); }
    }
    for (let index = 0; index < 23; index++) { const t = index / 22, a = t * Math.PI * 6; points.push(Math.cos(a) * 0.36, t * 2.15, Math.sin(a) * 0.36, -Math.cos(a) * 0.36, t * 2.15, -Math.sin(a) * 0.36); }
    return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3));
  }, []);
  useEffect(() => {
    if (!ticks.current) return;
    const dummy = new Object3D();
    for (let index = 0; index < 72; index++) {
      const angle = index / 72 * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * 1.4, 0, Math.sin(angle) * 1.4);
      dummy.rotation.set(0, -angle, 0); dummy.scale.set(index % 6 === 0 ? 1.8 : 1, 1, 1); dummy.updateMatrix();
      ticks.current.setMatrixAt(index, dummy.matrix);
    }
    ticks.current.instanceMatrix.needsUpdate = true;
  }, []);
  useEffect(() => () => { beam.dispose(); helix.dispose(); }, [beam, helix]);
  useFrame((_, delta) => {
    if (document.hidden) return;
    if (!reducedMotion) time.current += Math.min(delta, 0.05);
    const active = stage === 2 ? 1 : stage === 3 ? 1 - motion.current.reveal * 0.65 : stage >= 4 ? 0.14 : 0;
    beam.uniforms.uStrength.value = active;
    beam.uniforms.uTime.value = time.current;
    beam.uniforms.uScan.value = motion.current.scan;
    if (rings.current) rings.current.rotation.y = time.current * 0.11;
    if (rim.current) { rim.current.color.set(stage === 0 ? '#153946' : '#00b7cc'); rim.current.color.lerpColors(rim.current.color, rim.current.color.clone().set(COLORS.pink), motion.current.warning); }
    if (dna.current) { dna.current.visible = stage === 2 || stage === 3; dna.current.rotation.y = time.current * 0.8; }
    if (dnaMaterial.current) dnaMaterial.current.opacity = stage === 2 ? Math.min(0.6, motion.current.scan * 2) : (1 - motion.current.reveal) * 0.6;
    if (sweep.current) { sweep.current.visible = stage === 2 && !reducedMotion; sweep.current.position.y = -0.68 + (motion.current.scan * 2 % 1) * 2.3; }
    if (shock.current) {
      const progress = motion.current.shock;
      shock.current.visible = progress < 1 && stage >= 3 && !reducedMotion;
      shock.current.scale.setScalar(1 + progress * 2.2);
      (shock.current.material as MeshBasicMaterial).opacity = (1 - progress) * 0.48;
    }
  });
  return <group>
    <gridHelper args={[16, 64, '#102c3c', '#0a1a29']} position={[0, -1.04, 0]}/>
    <mesh position={[0, -0.97, 0]}><cylinderGeometry args={[1.52, 1.65, 0.13, 80]}/><meshStandardMaterial color="#152b3d" metalness={0.72} roughness={0.32}/></mesh>
    <mesh position={[0, -0.85, 0]}><cylinderGeometry args={[1.38, 1.49, 0.12, 80]}/><meshStandardMaterial color="#0a1b29" metalness={0.48} roughness={0.22}/></mesh>
    <mesh position={[0, -0.782, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.36, 80]}/><meshBasicMaterial color="#06232b" transparent opacity={0.58}/></mesh>
    <mesh position={[0, -0.77, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.4, 0.012, 6, 100]}/><meshBasicMaterial ref={rim} color="#155363" toneMapped={false}/></mesh>
    <mesh position={[0, -0.9, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.57, 0.014, 6, 100]}/><meshBasicMaterial color="#26788b" transparent opacity={0.8}/></mesh>
    <group ref={rings} position={[0, -0.755, 0]}>
      <instancedMesh ref={ticks} args={[undefined, undefined, 72]}><boxGeometry args={[0.065, 0.009, 0.008]}/><meshBasicMaterial color={stage === 0 ? '#235363' : '#40b6c8'} transparent opacity={0.65}/></instancedMesh>
      {[0.38, 0.78, 1.06, 1.29].map((radius, index) => <mesh key={radius} rotation={[Math.PI / 2, 0, index * 0.4]}><torusGeometry args={[radius, 0.003, 4, 80, Math.PI * 1.65]}/><meshBasicMaterial color="#287c90" transparent opacity={stage === 0 ? 0.3 : 0.55}/></mesh>)}
    </group>
    <mesh position={[0, 0.56, 0]}><cylinderGeometry args={[0.16, 1.35, 2.75, 48, 1, true]}/><primitive object={beam} attach="material"/></mesh>
    <group ref={dna} position={[0, -0.68, 0]}><lineSegments geometry={helix}><lineBasicMaterial ref={dnaMaterial} color="#44e6f3" transparent opacity={0}/></lineSegments></group>
    <mesh ref={sweep} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.18, 0.01, 5, 72]}/><meshBasicMaterial color="#77f5ff" transparent opacity={0.6}/></mesh>
    <mesh ref={shock} position={[0, -0.7, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.78, 0.023, 6, 80]}/><meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false}/></mesh>
    {stage >= 3 && <group position={[0, -0.56, 0]} rotation={[0.08, 0, 0]}>{[1.27, 1.37].map((radius, index) => <mesh key={radius} rotation={[Math.PI / 2, 0, index]}><torusGeometry args={[radius, 0.003, 4, 80, Math.PI * 1.8]}/><meshBasicMaterial color={COLORS.cyan} transparent opacity={0.3}/></mesh>)}</group>}
  </group>;
}
