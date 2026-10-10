import { useRef, useState } from 'react';
import { ImagePlus, ArrowDown, Play, LoaderCircle } from 'lucide-react';
import type { MutableRefObject, PointerEvent } from 'react';
import type { ApertureRect, ImageAsset } from '../types';

interface Props {
  asset: ImageAsset | null; enabled: boolean; busy: boolean; reducedMotion: boolean;
  aperture: MutableRefObject<ApertureRect>; onFile: (file: File) => void; onDemo: () => void;
  onStart: () => void; onDragChange: (dragging: boolean, hot: boolean) => void;
}
export default function ImageFeeder({ asset, enabled, busy, reducedMotion, aperture, onFile, onDemo, onStart, onDragChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const trail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; started: boolean; active: boolean } | null>(null);
  const points = useRef<{ x: number; y: number }[]>([]);
  const [dragging, setDragging] = useState(false);
  function finish(event: PointerEvent<HTMLButtonElement>, start = false) {
    if (!drag.current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false); onDragChange(false, false);
    if (start) onStart();
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || !enabled || !asset) return;
    if (!current.started && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
    current.started = true;
    setDragging(true);
    if (ghost.current) ghost.current.style.transform = `translate3d(${event.clientX - 52}px,${event.clientY - 40}px,0)`;
    points.current.unshift({ x: event.clientX, y: event.clientY });
    points.current.length = Math.min(points.current.length, 12);
    if (trail.current && !reducedMotion) Array.from(trail.current.children).forEach((child, index) => {
      const point = points.current[index] || points.current[points.current.length - 1];
      (child as HTMLElement).style.transform = `translate3d(${point.x}px,${point.y}px,0) scale(${1 - index / 15})`;
    });
    const target = aperture.current;
    const hot = Math.hypot(event.clientX - target.x, event.clientY - target.y) <= target.radius;
    onDragChange(true, hot);
    if (hot) finish(event, true);
  }
  return <div className="hl-feeder" data-testid="image-feeder">
    <input ref={input} className="hl-sr-only" tabIndex={-1} aria-label="选择待投喂影像" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" disabled={!enabled || busy} onChange={event => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ''; }}/>
    {asset ? <button className="hl-image-chip" data-testid="image-chip" disabled={!enabled || busy} onPointerDown={event => { if (event.button !== 0 || !enabled) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, active: true, started: false }; points.current = []; }} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event)} onLostPointerCapture={() => { drag.current = null; setDragging(false); onDragChange(false, false); }} aria-label="拖动影像到扫描口，也可使用开始扫描按钮"><img src={asset.objectUrl} alt="待投喂的本地影像缩略图" draggable={false}/><span><b>{asset.name}</b><small>{asset.source === 'demo' ? '合成样例 · 非真实病例' : '本地图像 · 仅当前内存'}</small></span>{enabled && <ArrowDown size={15}/>}</button> : <div className="hl-feeder-empty"><ImagePlus size={22}/><span><b>影像素材托盘</b><small>PNG / JPG · 最大 20 MiB</small></span></div>}
    <div className="hl-feeder-actions">{busy ? <span role="status" className="hl-loading"><LoaderCircle size={15}/>正在本地分析…</span> : <>
      {enabled && <button onClick={() => input.current?.click()}>{asset ? '更换影像' : '选择影像'}</button>}
      {enabled && !asset && <button className="hl-demo-button" onClick={onDemo}>载入演示影像</button>}
      {enabled && asset && <button className="hl-primary" onClick={onStart}><Play size={13}/>开始扫描</button>}
    </>}</div>
    <div ref={ghost} className={`hl-image-ghost ${dragging ? 'is-visible' : ''}`} aria-hidden="true">{asset && <img src={asset.objectUrl} alt=""/>}<span>IMAGE / FEED</span></div>
    <div ref={trail} className={`hl-drag-trail ${dragging && !reducedMotion ? 'is-visible' : ''}`} aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ opacity: (1 - index / 12) * 0.8 }}/>)}</div>
  </div>;
}
