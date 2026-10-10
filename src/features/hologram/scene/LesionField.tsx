import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { gsap } from 'gsap';
import { BufferGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, Mesh, Plane, Points, PointsMaterial, Vector3, WireframeGeometry } from 'three';
import type { Intersection, Raycaster } from 'three';
import { seededRandom, isLesionExposed } from '../imaging/seededMapping';
import { ORGAN_REGISTRY } from '../models/organRegistry';
import { MOTION } from '../motion.config';
import { ORGAN_Y } from './sceneMath';
import type { LabSceneProps, LesionSpec, OrganPart } from '../types';

function Lesion({ lesion, part, props }: { lesion: LesionSpec; part: OrganPart; props: LabSceneProps }) {
  const group = useRef<Group>(null), body = useRef<Mesh>(null), dust = useRef<Points>(null);
  const progress = useRef({ explode: props.explode }); const time = useRef(0);
  const clip = useMemo(() => new Plane(new Vector3(0, -1, 0), 3), []);
  const resources = useMemo(() => {
    const geometry = new IcosahedronGeometry(lesion.radius, 3);
    const positions = geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
      const factor = 1 + Math.sin(x * 56 + y * 20) * Math.cos(z * 46 - y * 31) * 0.16;
      positions.setXYZ(index, x * factor, y * factor, z * factor);
    }
    geometry.computeVertexNormals();
    const random = seededRandom(lesion.id.length * 731 + Math.floor(lesion.demoSizeMm * 100));
    const particles = new Float32Array(30 * 3);
    for (let index = 0; index < 30; index++) {
      const point = new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize().multiplyScalar(lesion.radius * (1.2 + random() * 1.5));
      particles.set(point.toArray(), index * 3);
    }
    return { geometry, edges: new WireframeGeometry(geometry), dust: new BufferGeometry().setAttribute('position', new Float32BufferAttribute(particles, 3)) };
  }, [lesion]);
  useEffect(() => {
    const tween = gsap.to(progress.current, { explode: props.explode, duration: props.reducedMotion ? 0 : MOTION.anatomy.explodeDuration, ease: MOTION.anatomy.ease });
    return () => { tween.kill(); };
  }, [props.explode, props.reducedMotion]);
  useEffect(() => {
    if (!body.current) return;
    body.current.raycast = function(raycaster: Raycaster, intersections: Intersection[]) {
      const hits: Intersection[] = []; Mesh.prototype.raycast.call(this, raycaster, hits);
      hits.forEach(hit => { if (clip.distanceToPoint(hit.point) >= -0.001) intersections.push(hit); });
    };
  }, [clip]);
  useEffect(() => () => { resources.geometry.dispose(); resources.edges.dispose(); resources.dust.dispose(); }, [resources]);
  useFrame((_, delta) => {
    if (!group.current || document.hidden) return;
    if (!props.reducedMotion) time.current += Math.min(delta, 0.05);
    const t = time.current;
    const amount = progress.current.explode;
    group.current.position.set(lesion.position[0] + part.explodeDirection[0] * amount, lesion.position[1] + part.explodeDirection[1] * amount, lesion.position[2] + part.explodeDirection[2] * amount);
    group.current.scale.setScalar(props.reducedMotion ? 1 : 1 + Math.sin(t * 3.6) * 0.055);
    clip.constant = (props.clip > 0 ? 2.4 * (1 - props.clip) : 5) + ORGAN_Y + part.explodeDirection[1] * amount;
    if (dust.current) { dust.current.rotation.y = t * 0.25; dust.current.scale.setScalar(1 + (t * 0.35 % 1) * 0.4); (dust.current.material as PointsMaterial).opacity = props.reducedMotion ? 0.25 : 0.45 * (1 - (t * 0.35 % 1)); }
  });
  const selected = props.selectedLesionId === lesion.id, found = props.discoveredIds.includes(lesion.id);
  return <group ref={group} position={lesion.position}>
    <mesh ref={body} geometry={resources.geometry} onClick={event => { event.stopPropagation(); if (isLesionExposed(lesion, props.clip, props.explode)) props.onDiscover(lesion.id); }} onPointerOver={event => { event.stopPropagation(); }}>
      <meshStandardMaterial color={selected ? '#ffbeab' : '#ff487d'} emissive="#ff245e" emissiveIntensity={selected ? 0.8 : 0.5} roughness={0.65} clippingPlanes={[clip]}/>
    </mesh>
    <lineSegments geometry={resources.edges} scale={1.008}><lineBasicMaterial color="#ffa2bf" transparent opacity={0.18} clippingPlanes={[clip]}/></lineSegments>
    <points ref={dust} geometry={resources.dust}><pointsMaterial color="#ff487f" transparent opacity={0.4} size={0.018} depthWrite={false} clippingPlanes={[clip]}/></points>
    {selected && <Html position={[0.23, 0.16, 0.08]} zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}><div className="hl-lesion-marker">{found ? '已记录' : '可见区域'}<span>{lesion.name}</span></div></Html>}
  </group>;
}
export default function LesionField(props: LabSceneProps) {
  if (props.stage !== 5) return null;
  const parts = ORGAN_REGISTRY[props.organ].parts;
  return <group>{props.lesions.filter(lesion => isLesionExposed(lesion, props.clip, props.explode)).map(lesion => {
    const part = parts.find(item => item.id === lesion.partId);
    return part ? <Lesion key={lesion.id} lesion={lesion} part={part} props={props}/> : null;
  })}</group>;
}
