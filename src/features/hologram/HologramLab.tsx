import { Component, Suspense, lazy, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { gsap } from 'gsap';
import { MousePointer2, Move, ZoomIn, Upload, X, ShieldCheck } from 'lucide-react';
import { createLabState, labReducer } from './state/labMachine';
import { useScanTimeline } from './hooks/useScanTimeline';
import { useScanAudio } from './hooks/useScanAudio';
import { useReducedMotion } from './hooks/useReducedMotion';
import { decodeImage, releaseAsset } from './imaging/decodeImage';
import { createLesions, isLesionExposed } from './imaging/seededMapping';
import { MOTION } from './motion.config';
import LabHUD, { STAGE_COPY } from './ui/LabHUD';
import ImageFeeder from './ui/ImageFeeder';
import InspectorPanel from './ui/InspectorPanel';
import type { ApertureRect, ImageAsset, QualityTier, SceneStats } from './types';
import demoChestUrl from '../../assets/demo-chest.png';
import './hologram.css';

const LabScene = lazy(() => import('./scene/LabScene'));
class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function StaticFallback() {
  return <div className="hl-webgl-fallback" data-testid="webgl-fallback"><svg viewBox="0 0 360 260" aria-hidden="true"><ellipse cx="180" cy="220" rx="124" ry="25"/><ellipse cx="180" cy="220" rx="96" ry="17"/><circle cx="180" cy="66" r="43"/><circle cx="180" cy="66" r="30"/><path d="M180 110v28m-8-10-28 26m44-26 28 26M150 133c-22 9-32 40-30 62 10 13 37 4 43-7l-2-49m48-6c22 9 32 40 30 62-10 13-37 4-43-7l2-49"/><path d="m144 110-64 108m136-108 64 108" strokeDasharray="3 7"/></svg><h3>已切换到二维信息模式</h3><p>WebGL 暂不可用，三维场景未运行。仍可载入影像查看本地统计与演示说明。</p></div>;
}

export default function HologramLab({ onBack }: { onBack: () => void }) {
  const [state, dispatch] = useReducer(labReducer, undefined, () => createLabState());
  const stateRef = useRef(state); stateRef.current = state;
  const [prepared, setPrepared] = useState<ImageAsset | null>(null);
  const assetRef = useRef<ImageAsset | null>(null);
  const requestRef = useRef<{ id: number; controller: AbortController | null }>({ id: 0, controller: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const launchLock = useRef(false);
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);
  const [resetViewToken, setResetViewToken] = useState(0);
  const [quality, setQuality] = useState<QualityTier>(() => window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high');
  const [stats, setStats] = useState<SceneStats | null>(null);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [dragStatus, setDragStatus] = useState({ dragging: false, hot: false });
  const [fileOver, setFileOver] = useState(false);
  const stageElement = useRef<HTMLDivElement>(null);
  const cameraButton = useRef<HTMLButtonElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const aperture = useRef<ApertureRect>({ x: 0, y: 0, radius: 64 });
  const resetTween = useRef<gsap.core.Tween | null>(null);
  const reducedMotion = useReducedMotion();
  const { motion, progress, skip, cancel } = useScanTimeline(state, dispatch, reducedMotion);
  const { muted, toggle, audioError, resetAudio } = useScanAudio(state.stage);
  const start = useCallback((asset: ImageAsset | null = assetRef.current) => {
    if (!asset || stateRef.current.stage !== 0 || launchLock.current) return;
    launchLock.current = true;
    dispatch({ type: 'LOAD', asset, lesions: createLesions(stateRef.current.organ, asset.analysis) });
  }, []);
  async function prepare(file: File, autoStart = false, source: 'upload' | 'demo' = 'upload') {
    if (stateRef.current.stage !== 0 || launchLock.current) return;
    requestRef.current.controller?.abort();
    const id = ++requestRef.current.id;
    const controller = new AbortController(); requestRef.current.controller = controller;
    setError(''); setBusy(true);
    try {
      const asset = await decodeImage(file, controller.signal);
      if (controller.signal.aborted || id !== requestRef.current.id) { releaseAsset(asset); return; }
      const next = { ...asset, source };
      releaseAsset(assetRef.current); assetRef.current = next; setPrepared(next);
      if (autoStart) start(next);
    } catch (cause) {
      if (!controller.signal.aborted && id === requestRef.current.id) setError(cause instanceof Error ? cause.message : '无法读取影像，请选择有效的 PNG 或 JPG。');
    } finally { if (id === requestRef.current.id) setBusy(false); }
  }
  async function prepareDemo() {
    if (busy || stateRef.current.stage !== 0) return;
    setBusy(true); setError('');
    const id = ++requestRef.current.id;
    requestRef.current.controller?.abort();
    const controller = new AbortController(); requestRef.current.controller = controller;
    try {
      const response = await fetch(demoChestUrl, { signal: controller.signal });
      if (!response.ok) throw new Error('无法读取内置合成样例。');
      const blob = await response.blob();
      if (id !== requestRef.current.id || controller.signal.aborted) return;
      await prepare(new File([blob], '合成胸部影像.png', { type: 'image/png' }), false, 'demo');
    } catch (cause) { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : '合成样例加载失败。'); setBusy(false); } }
  }
  function reset() {
    if (resetting) return;
    setResetting(true); cancel(); resetAudio(); requestRef.current.controller?.abort(); requestRef.current.id++;
    resetTween.current = gsap.to(motion.current, { reveal: 0, warning: 0, duration: reducedMotion ? 0 : MOTION.reset.duration, ease: MOTION.reset.ease, onComplete: () => {
      dispatch({ type: 'RESET' }); releaseAsset(assetRef.current); assetRef.current = null; setPrepared(null); launchLock.current = false;
      setHoveredPart(null); setError(''); setBusy(false); setResetting(false); setResetViewToken(value => value + 1);
    } });
  }
  const discover = useCallback((id: string) => {
    const current = stateRef.current;
    const lesion = current.lesions.find(item => item.id === id);
    dispatch({ type: 'DISCOVER', id, runId: current.runId, exposed: !!lesion && isLesionExposed(lesion, current.clip, current.explode) });
  }, []);
  const updateAperture = useCallback((rect: ApertureRect) => {
    aperture.current = rect;
    const button = cameraButton.current; const wrapper = stageElement.current;
    if (!button || !wrapper) return;
    const bounds = wrapper.getBoundingClientRect();
    button.style.left = `${rect.x - bounds.left}px`; button.style.top = `${rect.y - bounds.top}px`;
    button.style.width = `${Math.max(48, rect.radius * 2)}px`; button.style.height = `${Math.max(48, rect.radius * 2)}px`;
  }, []);
  const dragChange = useCallback((dragging: boolean, hot: boolean) => setDragStatus(previous => previous.dragging === dragging && previous.hot === hot ? previous : { dragging, hot }), []);
  const failed = useCallback(() => setSceneFailed(true), []);
  const selectPart = useCallback((id: string) => dispatch({ type: 'SELECT_PART', id }), []);
  useEffect(() => {
    const title = document.title; document.title = '全息解剖台 · 影序';
    return () => { document.title = title; requestRef.current.controller?.abort(); requestRef.current.id++; resetTween.current?.kill(); releaseAsset(assetRef.current); assetRef.current = null; };
  }, []);
  const statusText = state.completed ? `扫描完成 · 发现 ${state.discoveredIds.length} 处演示异常` : STAGE_COPY[state.stage];
  return <main className={`hl-lab ${state.completed ? 'hl-warning' : ''} ${dragStatus.hot ? 'hl-aperture-hot' : ''}`} data-testid="hologram-lab" data-stage={state.stage} data-quality={quality} data-reduced-motion={reducedMotion} data-audio={muted ? 'off' : 'on'}>
    <LabHUD stage={state.stage} organ={state.organ} muted={muted} reducedMotion={reducedMotion} progress={progress} quality={quality} completed={state.completed} onBack={onBack} onMute={() => void toggle()} onSkip={skip} onOrgan={organ => dispatch({ type: 'ORGAN', organ })} onResetView={() => setResetViewToken(value => value + 1)} onQuality={setQuality}/>
    <div className="hl-body">
      <section className="hl-stage-column" aria-label="全息实验场">
        <ImageFeeder asset={prepared} enabled={state.stage === 0} busy={busy} reducedMotion={reducedMotion} aperture={aperture} onFile={file => void prepare(file)} onDemo={() => void prepareDemo()} onStart={() => start()} onDragChange={dragChange}/>
        {(error || audioError) && <div role="alert" className="hl-error"><span>{error || audioError}</span>{error && <button onClick={() => setError('')} aria-label="关闭错误提示"><X size={15}/></button>}</div>}
        <div className={`hl-scene-wrap ${fileOver || dragStatus.dragging ? 'hl-drag-active' : ''}`} ref={stageElement} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = state.stage === 0 ? 'copy' : 'none'; setFileOver(state.stage === 0); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFileOver(false); }} onDrop={event => { event.preventDefault(); setFileOver(false); if (state.stage !== 0) return; const files = event.dataTransfer.files; if (files.length !== 1) { setError('每次请选择一张 PNG 或 JPG 影像。'); return; } void prepare(files[0], true); }}>
          <div className="hl-scene-caption"><span className="hl-mono">VOLUME / {state.organ.toUpperCase()}</span><span>{sceneFailed ? '2D FALLBACK' : 'REAL-TIME VIEWPORT'}</span></div>
          <SceneBoundary onFailure={failed} fallback={<StaticFallback/>}><Suspense fallback={<div className="hl-scene-loading" role="status">正在初始化全息场景…</div>}>
            {sceneFailed ? <StaticFallback/> : <LabScene stage={state.stage} organ={state.organ} asset={state.asset} lesions={state.lesions} discoveredIds={state.discoveredIds} selectedLesionId={state.selectedLesionId} selectedPartId={hoveredPart || state.selectedPartId} clip={state.clip} explode={state.explode} completed={state.completed} reducedMotion={reducedMotion} quality={quality} resetViewToken={resetViewToken} motion={motion} onDiscover={discover} onHoverPart={setHoveredPart} onSelectPart={selectPart} onAperture={updateAperture} onStats={setStats} onQualityChange={setQuality} onContextLost={failed}/>}
          </Suspense></SceneBoundary>
          <input ref={upload} className="hl-sr-only" tabIndex={-1} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" aria-label="上传影像并扫描" disabled={state.stage !== 0 || busy} onChange={event => { const file = event.target.files?.[0]; if (file) void prepare(file, true); event.target.value = ''; }}/>
          {state.stage === 0 && !sceneFailed && <button ref={cameraButton} className="hl-camera-upload" data-testid="scanner-upload" aria-label="点击相机上传影像" disabled={busy} onClick={() => upload.current?.click()}><Upload size={21}/><span>{busy ? '正在读取' : '点击上传'}</span></button>}
          {fileOver && <div className="hl-file-drop" aria-hidden="true"><Upload size={28}/><strong>松开，投喂影像</strong><span>仅在本机分析 · PNG / JPG</span></div>}
          <div className="hl-stage-status" role="status"><span className="hl-status-dot"/><h2>{busy ? '正在读取图像与像素特征…' : statusText}</h2>{state.stage >= 1 && state.stage <= 3 && <div className="hl-progress"><div style={{ width: `${progress}%` }}/><span>{progress}%</span></div>}{state.stage === 0 && <p>从上方拖入，或点击相机选择影像</p>}</div>
          <div className="hl-axis-mark" aria-hidden="true"><i>X</i><i>Y</i><i>Z</i></div>
          <div className="hl-render-stats hl-mono" data-testid="render-stats">{stats && !sceneFailed ? `${stats.fps.toFixed(0)} FPS · ${stats.drawCalls} DRAWS` : sceneFailed ? '3D UNAVAILABLE' : 'INITIALIZING'}</div>
        </div>
        <div className="hl-viewport-footer"><span><MousePointer2 size={13}/>拖拽旋转</span><span><ZoomIn size={13}/>滚轮缩放</span><span><Move size={13}/>右键 / 双指平移</span>{state.stage >= 1 && state.stage <= 3 && <button onClick={reset}>取消扫描</button>}<span className="hl-local-badge"><ShieldCheck size={13}/>仅本机处理</span></div>
      </section>
      <InspectorPanel state={state} hoveredPart={hoveredPart} reducedMotion={reducedMotion} resetting={resetting} onEnter={() => dispatch({ type: 'DISSECT' })} onDiscover={discover} onSelectPart={selectPart} onSelectLesion={id => dispatch({ type: 'SELECT_LESION', id })} onAnatomy={(key, value) => dispatch({ type: 'ANATOMY', key, value })} onReset={reset}/>
    </div>
    <footer className="hl-footer"><span>请选择已脱敏且获授权的影像。图像不上传、不写入报告，不保存在浏览器存储。</span><span className="hl-mono">EXPERIMENTAL / NON-CLINICAL</span></footer>
  </main>;
}
