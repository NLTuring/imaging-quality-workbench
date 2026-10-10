import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ACESFilmicToneMapping, MOUSE, TOUCH } from 'three';
import { QUALITY } from '../quality.config';
import { MOTION } from '../motion.config';
import type { LabSceneProps } from '../types';
import ScannerRig from './ScannerRig';
import ProjectionStage from './ProjectionStage';
import OrganAssembly from './OrganAssembly';
import ParticleSystems from './ParticleSystems';
import PostFX from './PostFX';
import { scanEnvelope } from './sceneMath';

function CameraRig(props: LabSceneProps) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, size } = useThree();
  const distance = size.width / size.height < 0.9 ? 8.4 : 7.1;
  const reset = useCallback(() => {
    camera.position.set(0, 1.45, distance); camera.lookAt(0, 0.85, 0);
    controls.current?.target.set(0, 0.85, 0); controls.current?.update();
  }, [camera, distance]);
  useEffect(reset, [reset, props.resetViewToken]);
  useFrame(() => {
    if (props.stage >= 4 || document.hidden) return;
    const progress = props.motion.current.scan;
    const shake = props.stage === 2 && !props.reducedMotion ? scanEnvelope(progress) * MOTION.scan.cameraAmplitude : 0;
    camera.position.set(Math.sin(progress * 235) * shake, 1.45 + Math.cos(progress * 183) * shake * 0.6, distance);
    camera.lookAt(0, 0.85, 0);
  });
  return <OrbitControls ref={controls} makeDefault enabled={props.stage >= 4} enableDamping={!props.reducedMotion} dampingFactor={MOTION.inspect.damping} minDistance={3.8} maxDistance={11} minPolarAngle={0.06} maxPolarAngle={Math.PI - 0.06} mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }} touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }} target={[0, 0.85, 0]}/>;
}
function SceneMonitor(props: LabSceneProps) {
  const { gl } = useThree();
  const monitor = useRef({ frames: 0, duration: 0, slow: 0, warmup: 0 });
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); props.onContextLost(); };
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => gl.domElement.removeEventListener('webglcontextlost', lost);
  }, [gl, props.onContextLost]);
  useEffect(() => { monitor.current.slow = 0; monitor.current.warmup = 0; }, [props.quality]);
  useFrame((_, delta) => {
    const drawCalls = gl.info.render.calls, triangles = gl.info.render.triangles;
    gl.info.reset();
    if (document.hidden || delta > 0.5) { monitor.current.frames = 0; monitor.current.duration = 0; return; }
    const sample = monitor.current;
    sample.frames++; sample.duration += delta; sample.warmup += delta;
    if (sample.duration >= 1) {
      const fps = sample.frames / sample.duration;
      props.onStats({ fps, drawCalls, triangles });
      if (sample.warmup > 3 && fps < 45) sample.slow++; else sample.slow = 0;
      if (sample.slow >= 3 && props.quality !== 'low') { sample.slow = 0; props.onQualityChange(props.quality === 'high' ? 'balanced' : 'low'); }
      sample.frames = 0; sample.duration = 0;
    }
  }, -100);
  return null;
}
function Scene(props: LabSceneProps) {
  return <>
    <CameraRig {...props}/><SceneMonitor {...props}/>
    <ambientLight intensity={0.75}/><hemisphereLight args={['#b9e5ff', '#07101e', 1.1]}/>
    <directionalLight position={[3, 5, 4]} color="#d6edff" intensity={3.2}/>
    <directionalLight position={[-4, 2, -1]} color="#198ba6" intensity={2}/>
    <pointLight position={[0, 1.6, 2.5]} intensity={9} color="#4cdfff" distance={8} decay={2}/>
    <ScannerRig {...props}/><ProjectionStage {...props}/><ParticleSystems {...props}/>
    {props.stage >= 3 && <OrganAssembly {...props}/>}
    <PostFX quality={props.quality}/>
  </>;
}
export default function LabScene(props: LabSceneProps) {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => { const change = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', change); return () => document.removeEventListener('visibilitychange', change); }, []);
  return <Canvas aria-label="三维全息器官场景" data-testid="hologram-canvas" camera={{ position: [0, 1.45, 7.1], fov: 43, near: 0.1, far: 50 }} dpr={[1, QUALITY[props.quality].dpr]} gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }} frameloop={visible ? 'always' : 'never'} onCreated={({ gl }) => { gl.localClippingEnabled = true; gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1; gl.info.autoReset = false; }} style={{ position: 'absolute', inset: 0 }} onContextMenu={event => event.preventDefault()}>
    <Scene {...props}/>
  </Canvas>;
}
