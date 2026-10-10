import { ArrowLeft, Volume2, VolumeX, SkipForward, RotateCcw } from 'lucide-react';
import type { OrganType, QualityTier, Stage } from '../types';

export const STAGE_LABELS = ['待机', '投喂影像', '高能扫描', '全息生成', '空间观察', '解剖发现'];
export const STAGE_COPY = ['将医学影像拖入相机', '影像就绪，正在建立扫描场', '正在扫描 · 连续多轴采样', '正在逐层绘制全息器官', '拖拽旋转，探索器官的每个部位', '剖开表面，发现隐藏的演示异常'];
interface Props {
  stage: Stage; organ: OrganType; muted: boolean; reducedMotion: boolean; progress: number;
  quality: QualityTier; completed: boolean; onBack: () => void; onMute: () => void;
  onSkip: () => void; onOrgan: (organ: OrganType) => void; onResetView: () => void;
  onQuality: (tier: QualityTier) => void;
}
export default function LabHUD(props: Props) {
  return <>
    <header className="hl-header">
      <button className="hl-back" onClick={props.onBack} aria-label="返回工作台"><ArrowLeft size={16}/><span>工作台</span></button>
      <div className="hl-wordmark"><span className="hl-logo" aria-hidden="true">✳</span><span>影序<span className="hl-wordmark-sub">HOLOGRAPHIC LAB</span></span></div>
      <div className="hl-header-title"><h1>全息医学影像解剖台</h1><span>程序化演示 · 非临床使用</span></div>
      <div className="hl-header-actions hl:flex hl:items-center hl:gap-2">
        {props.reducedMotion && <span className="hl-motion-label">减弱动态已启用</span>}
        <button className="hl-icon-button" onClick={props.onMute} aria-label={props.muted ? '开启声音' : '关闭声音'} aria-pressed={!props.muted}>{props.muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button>
        <label className="hl-quality-select"><span className="hl-sr-only">渲染质量</span><select aria-label="渲染质量" value={props.quality} onChange={event => props.onQuality(event.target.value as QualityTier)}><option value="high">高画质</option><option value="balanced">均衡</option><option value="low">轻量</option></select></label>
      </div>
    </header>
    <div className="hl-toolbar">
      <div className="hl-module-label"><span className="hl-status-dot"/>实验室 <span className="hl-mono">/ 01</span></div>
      <label className="hl-organ-select">观察器官<select aria-label="观察器官" value={props.organ} disabled={props.stage !== 0} onChange={event => props.onOrgan(event.target.value as OrganType)}><option value="lungs">肺部 · LUNGS</option><option value="heart">心脏 · HEART</option><option value="liver">肝脏 · LIVER</option><option value="brain">大脑 · BRAIN</option></select></label>
      <div className="hl-toolbar-right">
        {props.stage >= 1 && props.stage <= 3 ? <button onClick={props.onSkip}><SkipForward size={15}/>跳过动画</button> : props.stage >= 4 ? <button onClick={props.onResetView}><RotateCcw size={14}/>重置视角</button> : <span className="hl-mono">LOCAL PROCESSING</span>}
      </div>
    </div>
    <ol className="hl-stages" aria-label="扫描流程">
      {STAGE_LABELS.map((label, index) => <li key={label} className={index === props.stage ? 'is-current' : index < props.stage ? 'is-passed' : ''} aria-current={index === props.stage ? 'step' : undefined}><span className="hl-stage-index">{String(index).padStart(2, '0')}</span><span>{label}</span><i aria-hidden="true"/></li>)}
    </ol>
  </>;
}
