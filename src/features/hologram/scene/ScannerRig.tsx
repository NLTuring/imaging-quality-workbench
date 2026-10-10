import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { createNoise3D } from 'simplex-noise';
import { Color, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, SRGBColorSpace, Texture, TextureLoader, Vector3 } from 'three';
import { MOTION } from '../motion.config';
import { COLORS } from '../quality.config';
import { seededRandom } from '../imaging/seededMapping';
import { scanEnvelope, ingestRipple, SCANNER_Y } from './sceneMath';
import type { LabSceneProps } from '../types';

function IntakeImage({ asset, stage, motion }: Pick<LabSceneProps, 'asset' | 'stage' | 'motion'>) {
  const [texture, setTexture] = useState<Texture | null>(null);
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  useEffect(() => {
    if (!asset) { setTexture(null); return; }
    let active = true;
    const loaded = new TextureLoader().load(asset.objectUrl, value => { value.colorSpace = SRGBColorSpace; if (active) setTexture(value); else value.dispose(); });
    return () => { active = false; loaded.dispose(); };
  }, [asset]);
  useFrame(() => {
    if (!mesh.current || !material.current) return;
    const progress = motion.current.ingest;
    mesh.current.visible = stage === 1 && !!texture;
    mesh.current.position.set(-0.14 * (1 - progress), 0.55 * (1 - progress), 1.2 * (1 - progress));
    mesh.current.rotation.set(-0.2 * (1 - progress), 0.35 * Math.sin(progress * Math.PI), -0.12 * (1 - progress));
    mesh.current.scale.set((1 - progress * 0.98) * (1 + Math.sin(progress * Math.PI) * 0.8), 1 - progress * 0.98, 1);
    material.current.opacity = 1 - progress * progress;
  });
  return <mesh ref={mesh}><planeGeometry args={[0.8, 0.67, 12, 12]}/><meshBasicMaterial ref={material} map={texture} transparent depthWrite={false} toneMapped={false}/></mesh>;
}
export default function ScannerRig(props: LabSceneProps) {
  const group = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const ribs = useRef<InstancedMesh>(null);
  const light = useRef<MeshBasicMaterial>(null);
  const elapsed = useRef(0); const reportAt = useRef(0); const noiseClock = useRef(0);
  const intakeWave = useRef<Mesh>(null);
  const noise = useMemo(() => createNoise3D(seededRandom(851)), []);
  const { camera, gl, size } = useThree();
  const temp = useMemo(() => ({ center: new Vector3(), edge: new Vector3() }), []);
  useEffect(() => {
    if (!ribs.current) return;
    const dummy = new Object3D();
    for (let index = 0; index < 24; index++) {
      const angle = index / 24 * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * 0.65, Math.sin(angle) * 0.65, 0.055);
      dummy.rotation.z = angle; dummy.updateMatrix(); ribs.current.setMatrixAt(index, dummy.matrix);
    }
    ribs.current.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame((_, delta) => {
    if (!group.current || document.hidden) return;
    const dt = Math.min(delta, 0.05);
    if (!props.reducedMotion) elapsed.current += dt;
    const time = elapsed.current;
    const intensity = props.stage === 2 && !props.reducedMotion ? scanEnvelope(props.motion.current.scan) : 0;
    const scanTime = props.motion.current.scan * MOTION.scan.duration;
    const phase = scanTime < MOTION.scan.pre ? 0 : scanTime < MOTION.scan.pre + MOTION.scan.peak ? 1 : 2;
    if (!props.reducedMotion) noiseClock.current += dt * MOTION.scan.frequencies[phase];
    const f = noiseClock.current, amplitude = MOTION.scan.amplitudes[1] * intensity;
    const rotation = MOTION.scan.rotationDegrees[1] * Math.PI / 180 * intensity;
    group.current.position.set(noise(f, 1, 2) * amplitude, SCANNER_Y + (props.stage === 0 ? Math.sin(time * Math.PI * 2 / MOTION.idle.floatPeriod) * MOTION.idle.floatAmplitude : 0) + noise(1, f, 3) * amplitude * MOTION.scan.axisScale[1], noise(4, 5, f) * amplitude * MOTION.scan.axisScale[2]);
    group.current.rotation.set(noise(f, 3, 5) * rotation * MOTION.scan.rotationAxisScale[0], -0.12 + noise(7, f, 2) * rotation, noise(2, 7, f) * rotation * MOTION.scan.rotationAxisScale[2]);
    if (intakeWave.current) {
      const ripple = ingestRipple(props.motion.current.ingest);
      intakeWave.current.visible = props.stage === 1 && !props.reducedMotion && ripple.opacity > 0;
      intakeWave.current.scale.setScalar(ripple.scale);
      (intakeWave.current.material as MeshBasicMaterial).opacity = ripple.opacity;
    }
    if (inner.current) inner.current.rotation.z = props.reducedMotion ? 0 : time * Math.PI * 2 / MOTION.idle.ringPeriod + intensity * time * 0.8;
    if (light.current) { light.current.color.copy(new Color(COLORS.cyan)).lerp(new Color(COLORS.pink), props.motion.current.warning); light.current.color.multiplyScalar(1.4 + intensity * 0.8 + (props.stage === 1 ? 0.5 : 0)); }
    reportAt.current += dt;
    if (props.stage <= 1 && reportAt.current > 0.12) {
      reportAt.current = 0;
      group.current.updateWorldMatrix(true, false);
      temp.center.set(0, 0, 0.15); group.current.localToWorld(temp.center); temp.center.project(camera);
      temp.edge.set(0.38, 0, 0.15); group.current.localToWorld(temp.edge); temp.edge.project(camera);
      const rect = gl.domElement.getBoundingClientRect();
      props.onAperture({ x: rect.left + (temp.center.x + 1) * size.width / 2, y: rect.top + (1 - temp.center.y) * size.height / 2, radius: Math.max(25, Math.abs(temp.edge.x - temp.center.x) * size.width / 2) });
    }
  });
  return <group ref={group} position={[0, SCANNER_Y, 0]}>
    <mesh position={[0, 0, -0.12]}><torusGeometry args={[0.6, 0.17, 16, 72]}/><meshStandardMaterial color="#536b7d" metalness={0.75} roughness={0.3}/></mesh>
    <mesh position={[0, 0, 0.02]}><torusGeometry args={[0.56, 0.105, 14, 80]}/><meshStandardMaterial color="#12263c" metalness={0.6} roughness={0.24}/></mesh>
    <instancedMesh ref={ribs} args={[undefined, undefined, 24]}><boxGeometry args={[0.14, 0.085, 0.12]}/><meshStandardMaterial color="#6f8999" metalness={0.85} roughness={0.32}/></instancedMesh>
    <mesh position={[0, 0, 0.142]}><torusGeometry args={[0.446, 0.018, 8, 80]}/><meshBasicMaterial ref={light} color={COLORS.cyan} toneMapped={false}/></mesh>
    <mesh position={[0, 0, -0.01]}><torusGeometry args={[0.39, 0.048, 10, 72]}/><meshPhysicalMaterial color="#2c687a" metalness={0.2} roughness={0.08} transparent opacity={0.48} clearcoat={1}/></mesh>
    <group ref={inner} position={[0, 0, 0.166]}>{[0, 1, 2].map(index => <mesh key={index} rotation={[0, 0, index * Math.PI * 2 / 3]}><torusGeometry args={[0.49, 0.009, 5, 18, Math.PI / 4]}/><meshBasicMaterial color="#8bf6ff" toneMapped={false}/></mesh>)}</group>
    <mesh position={[0, -0.65, -0.02]}><boxGeometry args={[0.31, 0.21, 0.31]}/><meshStandardMaterial color="#294556" metalness={0.75} roughness={0.28}/></mesh>
    <mesh position={[0, -0.765, 0]}><boxGeometry args={[0.22, 0.018, 0.2]}/><meshBasicMaterial color={COLORS.cyan} toneMapped={false}/></mesh>
    <mesh ref={intakeWave} name="intake-ripple" position={[0, 0, 0.2]}><torusGeometry args={[0.45, 0.012, 6, 64]}/><meshBasicMaterial color={COLORS.cyan} transparent opacity={0} depthWrite={false} toneMapped={false}/></mesh>
    <IntakeImage asset={props.asset} stage={props.stage} motion={props.motion}/>
  </group>;
}
