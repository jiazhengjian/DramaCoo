'use client';
import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle, Circle, Loader, Edit3, AlertCircle, Square, Zap, Settings2, ChevronDown, Images } from 'lucide-react';
import clsx from 'clsx';
import { Popover } from '@/components/ui/Overlay';
import {
  VIDEO_RATIOS,
  VIDEO_RESOLUTIONS,
  VIDEO_GENERATION_MODES,
  type ProviderGroup,
  type VideoGenerationMode,
} from '@/config/models';
import { fetchModelGroupsByType, fetchVideoModelGroupsByAbility } from '@/lib/modelRegistry';
export type StageStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'error' | 'stopped';
export const STAGES = [
  { id: 'script_generation', name: '剧本', shortName: '剧本' },
  { id: 'character_design', name: '资产图', shortName: '资产图' },
  { id: 'storyboard', name: '分镜脚本', shortName: '分镜脚本' },
  { id: 'reference_generation', name: '分镜图', shortName: '分镜图' },
  { id: 'video_generation', name: '分镜视频', shortName: '分镜视频' },
  { id: 'post_production', name: '视频合成', shortName: '视频合成' },
] as const;
export type StageId = typeof STAGES[number]['id'];
export interface ModelConfig {
  llm_model: string;
  vlm_model: string;
  image_t2i_model: string;
  image_it2i_model: string;
  video_model: string;
  video_first_frame_model: string;
  video_start_end_model: string;
  video_reference_model: string;
  video_generation_mode: VideoGenerationMode;
  video_ratio: string;
  video_resolution: string;
  enable_concurrency: boolean;
}
interface TopBarProps {
  /** null = 首页 */
  activeStage: string | null;
  stageStatuses: Record<string, StageStatus>;
  onStageClick: (stageId: string) => void;
  onHomeClick: () => void;
  /** 是否处于工作流中（有 sessionId） */
  hasSession: boolean;
  /** 是否正在执行 */
  isRunning: boolean;
  /** 停止执行 */
  onStop: () => void;
  /** 代理模式（自动执行全流程） */
  autoMode: boolean;
  onAutoModeChange: (auto: boolean) => void;
  /** 当前模型配置 */
  modelConfig?: ModelConfig;
  /** 模型配置变更 */
  onModelConfigChange?: (config: ModelConfig) => void;
  /** 项目状态（如 running, waiting, completed, stopped, idle, error 等） */
  projectStatus?: string;
  /** 当前会话 ID（用于跳转素材库） */
  sessionId?: string;
}
/* ─── 带 Provider 分组的 <select> ─── */
function ProviderSelect({
  value,
  providers,
  onChange,
}: {
  value: string;
  providers: ProviderGroup[];
  onChange: (val: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-surface border border-line rounded-lg px-2 py-0 text-xs leading-[18px] text-ink outline-none w-full h-9 ui-control"
    >
      {value && !providers.some(group => group.models.some(model => model.id === value)) && <option value={value}>{value}（当前）</option>}
      {providers.map(pg => (
        <optgroup key={pg.provider} label={pg.label}>
          {pg.models.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
/* ─── 模型选择下拉面板 ─── */
function ModelSelector({
  config,
  onChange,
}: {
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [modelLoadError, setModelLoadError] = useState('');
  const [modelReload, setModelReload] = useState(0);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [llmProviders, setLlmProviders] = useState<ProviderGroup[]>([]);
  const [vlmProviders, setVlmProviders] = useState<ProviderGroup[]>([]);
  const [t2iProviders, setT2iProviders] = useState<ProviderGroup[]>([]);
  const [i2iProviders, setI2iProviders] = useState<ProviderGroup[]>([]);
  const [firstFrameVideoProviders, setFirstFrameVideoProviders] = useState<ProviderGroup[]>([]);
  const [startEndVideoProviders, setStartEndVideoProviders] = useState<ProviderGroup[]>([]);
  const [referenceVideoProviders, setReferenceVideoProviders] = useState<ProviderGroup[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetchModelGroupsByType('llm').then(groups => { if (!cancelled) setLlmProviders(groups); }),
      fetchModelGroupsByType('vlm').then(groups => { if (!cancelled) setVlmProviders(groups); }),
      fetchModelGroupsByType('t2i').then(groups => { if (!cancelled) setT2iProviders(groups); }),
      fetchModelGroupsByType('i2i').then(groups => { if (!cancelled) setI2iProviders(groups); }),
      fetchVideoModelGroupsByAbility('first_frame_i2v').then(groups => { if (!cancelled) setFirstFrameVideoProviders(groups); }),
      fetchVideoModelGroupsByAbility('start_end_frame_i2v').then(groups => { if (!cancelled) setStartEndVideoProviders(groups); }),
      fetchVideoModelGroupsByAbility('reference_to_video').then(groups => { if (!cancelled) setReferenceVideoProviders(groups); })
    ]).then(results => {
      if (cancelled) return;
      setModelsLoading(false);
      setModelLoadError(results.some(result => result.status === 'rejected') ? '部分模型列表加载失败，请重试。当前选择已保留。' : '');
    });
    return () => { cancelled = true; };
  }, [modelReload]);
  const update = (key: keyof ModelConfig, val: string | boolean) => {
    onChange({ ...config, [key]: val });
  };
  const activeVideoModel =
    config.video_generation_mode === 'start_end_frame'
      ? config.video_start_end_model
      : config.video_generation_mode === 'reference'
        ? config.video_reference_model
        : config.video_first_frame_model;
  const activeVideoProviders =
    config.video_generation_mode === 'start_end_frame'
      ? startEndVideoProviders
      : config.video_generation_mode === 'reference'
        ? referenceVideoProviders
        : firstFrameVideoProviders;
  const activeVideoLabel = VIDEO_GENERATION_MODES.find(item => item.id === config.video_generation_mode)?.label || '首帧生视频';
  const updateVideoMode = (mode: VideoGenerationMode) => {
    const nextModel =
      mode === 'start_end_frame'
        ? config.video_start_end_model
        : mode === 'reference'
          ? config.video_reference_model
          : config.video_first_frame_model;
    onChange({ ...config, video_generation_mode: mode, video_model: nextModel });
  };
  const updateActiveVideoModel = (model: string) => {
    if (config.video_generation_mode === 'start_end_frame') {
      onChange({ ...config, video_start_end_model: model, video_model: model });
    } else if (config.video_generation_mode === 'reference') {
      onChange({ ...config, video_reference_model: model, video_model: model });
    } else {
      onChange({ ...config, video_first_frame_model: model, video_model: model });
    }
  };
  return (
    <div className="relative">
      <button
        ref={triggerRef}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={clsx(
          'flex items-center gap-1 px-2 py-0 rounded-lg text-xs leading-[18px] font-medium whitespace-nowrap transition-all sm:gap-2 sm:px-3 h-9 ui-control',
          open
            ? 'bg-surface-soft text-ink ring-1 ring-line-strong'
            : 'text-muted hover:bg-surface'
        )}
        title="生成配置"
      >
        <Settings2 className="w-3.5 h-3.5" />
        <span>生成配置</span>
        <ChevronDown className={clsx('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        align="end"
        label="生成配置"
        className="xyq-model-popover w-80 space-y-3"
      >
          {modelLoadError && (
            <div className="ui-notice mt-4" role="alert">
              <span>{modelLoadError}</span>
              <button className="ui-button ui-button-secondary shrink-0" disabled={modelsLoading} onClick={() => { setModelsLoading(true); setModelReload(value => value + 1); }}>{modelsLoading ? '重试中…' : '重试加载模型'}</button>
            </div>
          )}
          {modelsLoading && !modelLoadError && <p role="status" className="mt-3 text-xs leading-[18px] text-muted">正在加载模型列表…</p>}
          <label className="flex flex-col gap-1">
            <span className="text-xs leading-[18px] text-subtle font-medium">LLM 模型</span>
            <ProviderSelect value={config.llm_model} providers={llmProviders} onChange={v => update('llm_model', v)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs leading-[18px] text-subtle font-medium">VLM 评估模型</span>
            <ProviderSelect value={config.vlm_model} providers={vlmProviders} onChange={v => update('vlm_model', v)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs leading-[18px] text-subtle font-medium">文生图</span>
            <ProviderSelect value={config.image_t2i_model} providers={t2iProviders} onChange={v => update('image_t2i_model', v)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs leading-[18px] text-subtle font-medium">图生图</span>
            <ProviderSelect value={config.image_it2i_model} providers={i2iProviders} onChange={v => update('image_it2i_model', v)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs leading-[18px] text-subtle font-medium">视频生成方式</span>
            <select
              value={config.video_generation_mode}
              onChange={e => updateVideoMode(e.target.value as VideoGenerationMode)}
              className="bg-surface border border-line rounded-lg px-2 py-0 text-xs leading-[18px] text-ink outline-none w-full h-9 ui-control"
            >
              {VIDEO_GENERATION_MODES.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs leading-[18px] text-subtle font-medium">{activeVideoLabel}模型</span>
            <ProviderSelect value={activeVideoModel} providers={activeVideoProviders} onChange={updateActiveVideoModel} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs leading-[18px] text-subtle font-medium">视频比例</span>
            <div className="flex flex-wrap gap-2">
              {VIDEO_RATIOS.map(r => (
                <button
                  key={r.id}
                  onClick={() => update('video_ratio', r.id)}
                  className={`flex h-9 items-center justify-center rounded-lg border px-3 text-sm leading-[22px] transition-colors ui-control ${
                    config.video_ratio === r.id
                      ? 'border-accent bg-accent-soft'
                      : 'border-line hover:border-line-strong'
                  }`}
                  title={r.label}
                >
                  <span className="text-xs leading-[18px] text-muted">{r.label}</span>
                </button>
              ))}
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs leading-[18px] text-subtle font-medium">视频分辨率</span>
            <select
              value={config.video_resolution}
              onChange={e => update('video_resolution', e.target.value)}
              className="bg-surface border border-line rounded-lg px-2 py-0 text-xs leading-[18px] text-ink outline-none w-full h-9 ui-control"
            >
              {VIDEO_RESOLUTIONS.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs leading-[18px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!config.enable_concurrency}
              onChange={e => update('enable_concurrency', e.target.checked)}
              className="w-3.5 h-3.5 rounded-lg border-line-strong text-accent focus:ring-accent/30"
            />
            <span className="text-muted">并发生成</span>
          </label>
      </Popover>
    </div>
  );
}
export default function TopBar({
  activeStage,
  stageStatuses,
  onStageClick,
  onHomeClick,
  hasSession,
  isRunning,
  onStop,
  autoMode,
  onAutoModeChange,
  modelConfig,
  onModelConfigChange,
  projectStatus,
  sessionId,
}: TopBarProps) {
  const getStageIcon = (status: StageStatus, isActive: boolean) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'running':
        return <Loader className="w-4 h-4 text-accent animate-spin" />;
      case 'waiting':
        return <Edit3 className="w-4 h-4 text-warning" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-danger" />;
      default:
        return (
          <Circle
            className={clsx('w-4 h-4', isActive ? 'text-ink' : 'text-subtle')}
          />
        );
    }
  };
  return (
    <>
    <header
      className={clsx(
        'xyq-topbar',
        !hasSession && 'xyq-topbar-home'
      )}
    >
      {/* 阶段进度条 */}
      {hasSession && (
        <nav className="xyq-stage-nav" aria-label="创作阶段">
          {STAGES.map((stage, idx) => {
            const status = stageStatuses[stage.id] || 'pending';
            const isActive = activeStage === stage.id;
            return (
              <React.Fragment key={stage.id}>
                {idx > 0 && (
                  <div
                    className={clsx(
                      'w-6 h-px flex-shrink-0',
                      stageStatuses[STAGES[idx - 1].id] === 'completed'
                        ? 'bg-success'
                        : 'bg-surface-hover'
                    )}
                  />
                )}
                <button
                  onClick={() => onStageClick(stage.id)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-0 rounded-lg text-xs leading-[18px] font-medium transition-all whitespace-nowrap flex-shrink-0 h-9 ui-control',
                    isActive
                      ? 'bg-surface-soft text-ink ring-1 ring-line-strong'
                      : status === 'completed'
                        ? 'text-success hover:bg-success-soft'
                        : status === 'error'
                          ? 'text-danger hover:bg-danger-soft'
                          : 'text-muted hover:bg-surface'
                  )}
                >
                  {getStageIcon(status, isActive)}
                  <span>{stage.shortName}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>
      )}
      {/* 右侧控制区 */}
      <div className="xyq-topbar-controls">
        {/* 模型选择 */}
        {hasSession && modelConfig && onModelConfigChange && (
          <ModelSelector config={modelConfig} onChange={onModelConfigChange} />
        )}
        {/* 代理模式切换 */}
        {hasSession && (
          <button
            onClick={() => onAutoModeChange(!autoMode)}
            className={clsx(
              'flex items-center gap-1 px-2 py-0 rounded-lg text-xs leading-[18px] font-medium whitespace-nowrap transition-all sm:gap-2 sm:px-3 h-9 ui-control',
              autoMode
                ? 'bg-surface-soft text-ink ring-1 ring-line-strong'
                : 'text-muted hover:bg-surface'
            )}
            title={autoMode ? '代理模式：自动执行全流程' : '手动模式：每阶段需确认'}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{autoMode ? '自动' : '手动'}</span>
          </button>
        )}
        {/* 停止按钮 */}
        {isRunning && (
          <button
            onClick={onStop}
            className="flex items-center gap-1 px-2 py-0 bg-danger-soft text-danger hover:bg-danger-soft rounded-lg text-xs leading-[18px] font-medium whitespace-nowrap transition-colors ring-1 ring-danger-line sm:gap-2 sm:px-3 h-9 ui-control"
            title="停止执行"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>停止</span>
          </button>
        )}
        {/* 项目状态 */}
        {hasSession && projectStatus && (
          <div
            className={clsx(
              'px-2 py-1 rounded-lg text-xs leading-[18px] font-medium whitespace-nowrap flex items-center gap-1 sm:px-2',
              projectStatus === 'running' && 'bg-accent-soft text-accent',
              projectStatus === 'waiting' && 'bg-warning-soft text-warning',
              projectStatus === 'completed' && 'bg-success-soft text-success',
              projectStatus === 'pending' && 'bg-surface text-muted',
              projectStatus === 'error' && 'bg-danger-soft text-danger',
              projectStatus === 'stopped' && 'bg-surface-soft text-muted'
            )}
            title="项目状态"
          >
            {projectStatus === 'running' && <Loader className="w-3 h-3 animate-spin" />}
            {projectStatus === 'waiting' && <Edit3 className="w-3 h-3" />}
            {projectStatus === 'error' && <AlertCircle className="w-3 h-3" />}
            <span>
              {projectStatus === 'running' ? '执行中' :
               projectStatus === 'waiting' ? '等待确认' :
               projectStatus === 'completed' ? '已完成' :
               projectStatus === 'pending' ? '空闲' :
               projectStatus === 'stopped' ? '已停止' :
               projectStatus === 'error' ? '出错' : projectStatus}
            </span>
          </div>
        )}
      </div>
    </header>
    </>
  );
}
