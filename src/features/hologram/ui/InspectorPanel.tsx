import { useEffect, useState } from 'react';
import { ArrowUpRight, ScanLine, Layers, Check, RotateCcw, ChevronDown } from 'lucide-react';
import type { LabState } from '../state/labMachine';
import { ORGAN_REGISTRY } from '../models/organRegistry';
import { isLesionExposed } from '../imaging/seededMapping';
interface Props {
  state: LabState; hoveredPart: string | null; reducedMotion: boolean; resetting: boolean;
  onEnter: () => void; onDiscover: (id: string) => void; onSelectPart: (id: string) => void;
  onSelectLesion: (id: string) => void; onAnatomy: (key: 'clip' | 'explode', value: number) => void;
  onReset: () => void;
}
export default function InspectorPanel({ state, hoveredPart, reducedMotion, resetting, onEnter, onDiscover, onSelectPart, onSelectLesion, onAnatomy, onReset }: Props) {
  const definition = ORGAN_REGISTRY[state.organ];
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    setTick(0);
    if (state.stage < 4 || reducedMotion) return;
    const interval = window.setInterval(() => { if (!document.hidden) setTick(value => value + 1); }, 1100);
    return () => window.clearInterval(interval);
  }, [state.runId, state.stage >= 4, reducedMotion]);
  const part = definition.parts.find(item => item.id === (hoveredPart || state.selectedPartId));
  const selected = state.lesions.find(item => item.id === state.selectedLesionId);
  const pulse = Math.round(68 + (state.asset?.analysis.seed ?? 0) % 9 + Math.sin(tick * 0.75) * 2);
  return <aside className={`hl-inspector ${expanded ? 'is-expanded' : ''}`} aria-label="器官信息与发现记录">
    <button className="hl-inspector-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>观察与发现 <ChevronDown size={16}/></button>
    <div className="hl-inspector-content">
      <section className="hl-organ-intro">
        <div className="hl-section-eyebrow"><span>ANATOMICAL SUBJECT</span><span className="hl-tag">模拟模型</span></div>
        <div className="hl-organ-name"><h2>{definition.name}</h2><span>{definition.english}</span></div>
        <p>{definition.description}</p>
        <div className="hl-organ-outline" aria-hidden="true"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div>
        <div className="hl-reading"><span>模拟节律 <small>非测量值</small></span><strong>{state.stage >= 4 ? pulse : '—'} <small>BPM</small></strong></div>
      </section>
      <section className="hl-image-metrics">
        <div className="hl-section-heading"><h3>图像统计</h3><span>本地实算</span></div>
        <dl><div><dt>像素尺寸</dt><dd>{state.asset ? `${state.asset.width} × ${state.asset.height}` : '—'}</dd></div><div><dt>对比度</dt><dd data-testid="image-contrast">{state.asset ? state.asset.analysis.contrast.toFixed(3) : '—'}</dd></div><div><dt>边缘强度</dt><dd>{state.asset ? state.asset.analysis.edgeStrength.toFixed(3) : '—'}</dd></div><div><dt>复现种子</dt><dd data-testid="scan-seed">{state.asset ? state.asset.analysis.seed.toString(16).padStart(8, '0').toUpperCase() : '—'}</dd></div></dl>
        <p className="hl-fine">像素特征只驱动演示造型，不用于识别疾病。</p>
      </section>
      {state.stage >= 4 && <section className="hl-parts">
        <div className="hl-section-heading"><h3>部位索引</h3><span>悬停 / 点击</span></div>
        <div className="hl-part-list">{definition.parts.map(item => <button key={item.id} aria-pressed={part?.id === item.id} onClick={() => onSelectPart(item.id)}><span>{item.name}</span><ArrowUpRight size={13}/></button>)}</div>
        {part && <div className="hl-part-info" role="status"><strong>{part.name}</strong><p>参数化组织分块 · 可旋转观察表面，进入解剖后查看内部。非真实患者解剖。</p></div>}
      </section>}
      {state.stage === 4 && <button className="hl-primary hl-anatomy-enter" onClick={onEnter}><ScanLine size={17}/>进入解剖模式<ArrowUpRight size={16}/></button>}
      {state.stage === 5 && <>
        <section className="hl-anatomy-controls">
          <div className="hl-section-heading"><h3><Layers size={15}/> 解剖控制</h3><span>INTERACTIVE</span></div>
          <label htmlFor="hl-clip">切片深度 <output>{Math.round(state.clip * 100)}%</output></label><input id="hl-clip" aria-label="切片深度" type="range" min="0" max="1" step="0.01" value={state.clip} onChange={event => onAnatomy('clip', Number(event.target.value))}/>
          <label htmlFor="hl-explode">器官展开 <output>{Math.round(state.explode * 100)}%</output></label><input id="hl-explode" aria-label="器官展开" type="range" min="0" max="1" step="0.01" value={state.explode} onChange={event => onAnatomy('explode', Number(event.target.value))}/>
          <p className="hl-fine">移动切面穿过异常，或展开至 55% 以上，再点击发光区域或下方入口记录发现。</p>
        </section>
        <section className="hl-findings">
          <div className="hl-section-heading"><h3>发现记录</h3><span>{state.discoveredIds.length} / {state.lesions.length}</span></div>
          {state.lesions.map((lesion, index) => {
            const found = state.discoveredIds.includes(lesion.id);
            const exposed = isLesionExposed(lesion, state.clip, state.explode);
            return <button data-testid="discover-lesion" data-lesion-id={lesion.id} className={`hl-finding ${found ? 'is-found' : ''} ${state.selectedLesionId === lesion.id ? 'is-selected' : ''}`} disabled={!found && !exposed} key={lesion.id} onClick={() => found ? onSelectLesion(lesion.id) : onDiscover(lesion.id)}><span className="hl-finding-index">{found ? <Check size={14}/> : String(index + 1).padStart(2, '0')}</span><span><strong>{found ? lesion.name : exposed ? '可见演示异常' : '未暴露的演示区域'}</strong><small>{found ? lesion.location : exposed ? '点击记录发现' : '调整切片或展开器官'}</small></span><ArrowUpRight size={14}/></button>;
          })}
          {selected && <div className="hl-lesion-card" aria-live="polite"><div className="hl-section-eyebrow">SIMULATED FINDING <span>演示信息</span></div><h4>{selected.name}</h4><dl><div><dt>模拟尺寸</dt><dd>{selected.demoSizeMm.toFixed(1)} mm</dd></div><div><dt>模拟位置</dt><dd>{selected.location}</dd></div><div><dt>模拟置信度</dt><dd>{Math.round(selected.demoConfidence * 100)}%</dd></div></dl><p>{selected.suggestion}</p><small>上述数值并非从上传影像测得。</small></div>}
        </section>
      </>}
      {state.completed && <section className="hl-completion" data-testid="completion-summary" role="status"><span className="hl-section-eyebrow">EXPLORATION COMPLETE</span><h3>扫描完成 · 发现 {state.discoveredIds.length} 处异常</h3><p>程序化演示结果，不代表上传影像的诊断结论。</p></section>}
      {state.stage >= 4 && <button className="hl-reset" onClick={onReset} disabled={resetting}><RotateCcw size={15}/>{resetting ? '正在复位…' : '重新扫描'}</button>}
      {state.stage < 4 && <section className="hl-howto"><div className="hl-section-heading"><h3>从二维，进入空间</h3><span>HOW TO</span></div><p><span>01</span>载入影像，拖入扫描口</p><p><span>02</span>等待全息模型逐层生成</p><p><span>03</span>旋转、剖开，探索内部</p></section>}
      <div className="hl-inspector-disclaimer">这是交互研究原型。单张二维影像不能用于真实三维重建、病灶检测或诊断。</div>
    </div>
  </aside>;
}
