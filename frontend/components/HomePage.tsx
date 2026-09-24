'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Settings2, CheckCircle, Globe, ListOrdered, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { Popover } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Feedback';
import { PROMPT_EXAMPLES } from '@/config/examples';
import {
  STYLES,
  VIDEO_RATIOS,
  VIDEO_RESOLUTIONS,
  VIDEO_GENERATION_MODES,
  type ProviderGroup,
  type VideoGenerationMode,
} from '@/config/models';
import { fetchModelGroupsByType, fetchVideoModelGroupsByAbility } from '@/lib/modelRegistry';
export interface ProjectParams {
  idea: string;
  file_path?: string; // 上传的文件路径 (由后端返回的文件名)
  style: string;
  video_ratio: string;
  video_resolution: string;
  llm_model: string;
  vlm_model: string;
  image_t2i_model: string;
  image_it2i_model: string;
  video_model: string;
  video_first_frame_model: string;
  video_start_end_model: string;
  video_reference_model: string;
  video_generation_mode: VideoGenerationMode;
  expand_idea?: boolean;
  enable_concurrency?: boolean;
  web_search?: boolean;
  episodes?: number;
}
interface HomePageProps {
  onStartProject: (params: ProjectParams, autoMode?: boolean) => void;
}
const INSPIRATION_IMAGES = [
  '/ui/inspiration-space.png',
  '/ui/inspiration-ink.png',
  '/ui/inspiration-detective.png',
  '/ui/inspiration-cat.png',
  '/ui/inspiration-mars.png',
  '/ui/inspiration-wuxia.png',
];
export default function HomePage({ onStartProject }: HomePageProps) {
  const toast = useToast();
  const episodesTriggerRef = useRef<HTMLButtonElement>(null);
  const [idea, setIdea] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('realistic');
  const [selectedLLM, setSelectedLLM] = useState('');
  const [selectedVLM, setSelectedVLM] = useState('');
  const [selectedT2I, setSelectedT2I] = useState('');
  const [selectedI2I, setSelectedI2I] = useState('');
  const [selectedFirstFrameVideo, setSelectedFirstFrameVideo] = useState('');
  const [selectedStartEndVideo, setSelectedStartEndVideo] = useState('');
  const [selectedReferenceVideo, setSelectedReferenceVideo] = useState('');
  const [selectedVideoMode, setSelectedVideoMode] = useState<VideoGenerationMode>('first_frame');
  const [selectedRatio, setSelectedRatio] = useState('');
  const [selectedResolution, setSelectedResolution] = useState('720P');
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [enableConcurrency, setEnableConcurrency] = useState(true);
  const [webSearch, setWebSearch] = useState(false);
  const [episodes, setEpisodes] = useState(4);
  const [showEpisodesPanel, setShowEpisodesPanel] = useState(false);
  // 上传相关状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{name: string, path: string} | null>(null);
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
  const activeVideoModel =
    selectedVideoMode === 'start_end_frame'
      ? selectedStartEndVideo
      : selectedVideoMode === 'reference'
        ? selectedReferenceVideo
        : selectedFirstFrameVideo;
  const modelConfigReady = Boolean(selectedLLM && selectedVLM && selectedT2I && selectedI2I && activeVideoModel && selectedRatio && selectedResolution);
  const canStart = Boolean((idea.trim() || uploadedFile) && modelConfigReady && !configLoading);
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
  useEffect(() => {
    let cancelled = false;
    const loadDefaultConfig = async () => {
      setConfigLoading(true);
      setConfigError('');
      try {
        const resp = await fetch('/api/config');
        if (!resp.ok) throw new Error('读取默认模型配置失败');
        const data = await resp.json();
        const models = data.config?.models || {};
        const generation = data.config?.generation || {};
        // Legacy config compatibility: older config.yaml only has models.video, so treat it as first-frame video.
        const firstFrameModel = models.video_first_frame || models.video;
        const startEndModel = models.video_start_end || 'wan2.7-i2v';
        const referenceModel = models.video_reference || 'wan2.7-r2v';
        const videoMode = (generation.video_generation_mode || 'first_frame') as VideoGenerationMode;
        const selectedModel = videoMode === 'start_end_frame' ? startEndModel : videoMode === 'reference' ? referenceModel : firstFrameModel;
        if (!models.llm || !models.vlm || !models.image_t2i || !models.image_it2i || !selectedModel) {
          throw new Error('backend/config.yaml 缺少主流程默认模型');
        }
        if (cancelled) return;
        setSelectedStyle(generation.style || 'realistic');
        setSelectedLLM(models.llm);
        setSelectedVLM(models.vlm);
        setSelectedT2I(models.image_t2i);
        setSelectedI2I(models.image_it2i);
        setSelectedVideoMode(videoMode);
        setSelectedFirstFrameVideo(firstFrameModel);
        setSelectedStartEndVideo(startEndModel);
        setSelectedReferenceVideo(referenceModel);
        setSelectedRatio(generation.video_ratio || '16:9');
        setSelectedResolution(generation.video_resolution || '720P');
      } catch (error: unknown) {
        if (!cancelled) setConfigError(error instanceof Error ? error.message : '读取默认模型配置失败');
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    };
    loadDefaultConfig();
    return () => { cancelled = true; };
  }, []);
  const activeVideoProviders =
    selectedVideoMode === 'start_end_frame'
      ? startEndVideoProviders
      : selectedVideoMode === 'reference'
        ? referenceVideoProviders
        : firstFrameVideoProviders;
  const setActiveVideoModel = (value: string) => {
    if (selectedVideoMode === 'start_end_frame') {
      setSelectedStartEndVideo(value);
    } else if (selectedVideoMode === 'reference') {
      setSelectedReferenceVideo(value);
    } else {
      setSelectedFirstFrameVideo(value);
    }
  };
  const selectedVideoModeLabel = VIDEO_GENERATION_MODES.find(item => item.id === selectedVideoMode)?.label || '首帧生视频';
  const handleStart = (auto?: boolean) => {
    if (!canStart) return;
    onStartProject({
      idea,
      file_path: uploadedFile?.path, // 如果上传了文件，传给后端
      style: selectedStyle,
      video_ratio: selectedRatio,
      video_resolution: selectedResolution,
      llm_model: selectedLLM,
      vlm_model: selectedVLM,
      image_t2i_model: selectedT2I,
      image_it2i_model: selectedI2I,
      video_generation_mode: selectedVideoMode,
      video_first_frame_model: selectedFirstFrameVideo,
      video_start_end_model: selectedStartEndVideo,
      video_reference_model: selectedReferenceVideo,
      video_model: activeVideoModel,
      enable_concurrency: enableConcurrency,
      web_search: webSearch,
      episodes,
    }, auto);
  };
  const handleExampleClick = (text: string) => {
    setIdea(text);
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedExtensions = ['.doc', '.docx', '.txt', '.md', '.pdf'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      toast(`仅支持 ${allowedExtensions.join(', ')} 格式的文件`, 'error');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/upload_file', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('文件上传失败');
      }
      const data = await response.json();
      if (data.file_path) {
        // 记录已上传的文件信息，不修改输入框
        setUploadedFile({
          name: file.name,
          path: data.file_path
        });
      }
    } catch (error) {
      console.error('上传错误:', error);
      toast('上传提取内容失败，请重试', 'error');
    } finally {
      setUploading(false);
      // 清空 input 方便下次选择同一文件
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  return (
    <div className="xyq-home">
      {/* 主区域 - 居中 */}
      <div className="xyq-home-main flex-shrink-0">
        {/* 标题 */}
        <div className="xyq-hero-title text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <h1 className=" font-medium text-white text-2xl leading-8">Hi，和DramaCoo一起聊聊创作想法</h1>
          </div>
          <p className="text-sm leading-[22px] text-white/75">
            从一句灵感开始，让 AI 陪你完成整部短片
          </p>
        </div>
        {/* 输入区域 */}
        <div className="xyq-composer bg-surface rounded-3xl border border-line p-4 mb-6">
          <textarea
            aria-label="创作想法"
            value={idea}
            onChange={e => setIdea(e.target.value)}
            placeholder="描述你的想法，输入一段故事、一个画面或一句灵感……"
            className="xyq-prompt-input w-full bg-transparent text-sm leading-[22px] text-ink placeholder-subtle resize-none outline-none min-h-[100px]"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && (idea.trim() || uploadedFile)) {
                e.preventDefault();
                handleStart(false);
              }
            }}
          />
          <div className="xyq-composer-toolbar flex items-center justify-between mt-3 pt-3 border-t border-line">
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  ref={episodesTriggerRef}
                  aria-expanded={showEpisodesPanel}
                  onClick={() => setShowEpisodesPanel(!showEpisodesPanel)}
                  className={clsx(
                    'xyq-tool-button flex items-center gap-2 px-3 py-0 rounded-lg text-xs leading-[18px] font-medium transition-colors h-9 ui-control',
                    showEpisodesPanel
                      ? 'bg-accent-soft text-accent'
                      : 'text-subtle hover:text-muted hover:bg-surface'
                  )}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  剧集：{episodes} 集
                </button>
                <Popover
                  open={showEpisodesPanel}
                  onClose={() => setShowEpisodesPanel(false)}
                  triggerRef={episodesTriggerRef}
                  align="start"
                  label="设置总集数"
                  className="xyq-episodes-popover w-64"
                >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs leading-[18px] font-semibold text-ink">设置总集数</span>
                          <span className="xyq-episode-count text-xs leading-[18px] text-accent font-semibold bg-accent-soft px-2 py-1 rounded-lg">
                            {episodes} 集
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            aria-label="减少剧集数"
                            onClick={(e) => { e.stopPropagation(); setEpisodes(Math.max(1, episodes - 1)); }}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface text-muted hover:bg-surface-soft active:scale-95 transition-all text-sm leading-[22px] font-semibold ui-control"
                          >
                            -
                          </button>
                          <input
                            type="range"
                            aria-label="总集数"
                            min={1}
                            max={10}
                            value={episodes}
                            onChange={(e) => setEpisodes(parseInt(e.target.value))}
                            className="flex-1 h-1.5 bg-surface-soft rounded-lg appearance-none cursor-pointer accent-action"
                          />
                          <button
                            aria-label="增加剧集数"
                            onClick={(e) => { e.stopPropagation(); setEpisodes(Math.min(10, episodes + 1)); }}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface text-muted hover:bg-surface-soft active:scale-95 transition-all text-sm leading-[22px] font-semibold ui-control"
                          >
                            +
                          </button>
                        </div>
                        <div className="space-y-1 border-t border-line pt-2">
                          <p className="text-xs leading-[18px] text-subtle ">
                            每集预估时长约 1–2 分钟
                          </p>
                          <p className="text-xs leading-[18px] text-accent/80 ">
                            推荐设置 4–6 集
                          </p>
                        </div>
                      </div>
                </Popover>
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={clsx(
                  'xyq-tool-button flex items-center gap-2 px-3 py-0 rounded-lg text-xs leading-[18px] font-medium transition-colors h-9 ui-control',
                  showSettings
                    ? 'bg-accent-soft text-accent'
                    : 'text-subtle hover:text-muted hover:bg-surface'
                )}
              >
                <Settings2 className="w-3.5 h-3.5" />
                生成配置
              </button>
              <button
                onClick={() => setWebSearch(!webSearch)}
                className={clsx(
                  'xyq-tool-button flex items-center gap-2 px-3 py-0 rounded-lg text-xs leading-[18px] font-medium transition-colors h-9 ui-control',
                  webSearch
                    ? 'bg-accent-soft text-accent'
                    : 'text-subtle hover:text-muted hover:bg-surface'
                )}
              >
                <Globe className="w-3.5 h-3.5" />
                联网搜索
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* 隐藏的文件输入框 */}
              <input
                type="file"
                aria-label="上传故事文档"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".doc,.docx,.txt,.md,.pdf"
                className="hidden"
              />
              <button
                onClick={() => {
                  if (uploadedFile) {
                    setUploadedFile(null); // 已有文件则点击取消
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                disabled={uploading}
                className={clsx(
                  'xyq-upload-button flex items-center gap-2 px-4 py-0 rounded-lg text-sm leading-[22px] font-medium transition-colors border relative h-9 ui-control',
                  uploading
                    ? 'bg-surface text-subtle cursor-not-allowed border-line'
                    : uploadedFile
                    ? 'bg-accent-soft text-accent border-accent-line hover:bg-accent-soft'
                    : 'bg-surface text-muted hover:bg-surface border-line'
                )}
                title={uploadedFile ? `已选择: ${uploadedFile.name} (点击取消)` : "上传文档 (Word/TXT/MD)"}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : uploadedFile ? (
                  <CheckCircle className="w-4 h-4" />
                ) : null}
                {uploading ? '上传中……' : uploadedFile ? `已选：${uploadedFile.name.length > 8 ? `${uploadedFile.name.substring(0, 8)}…` : uploadedFile.name}` : '上传文件'}
              </button>
              <button
                onClick={() => handleStart(false)}
                disabled={!canStart}
                className={clsx(
                  'xyq-action-secondary flex items-center gap-2 px-4 py-0 rounded-lg text-sm leading-[22px] font-medium transition-colors h-9 ui-control',
                  canStart
                    ? 'bg-surface text-ink hover:bg-surface border border-line-strong'
                    : 'bg-surface-soft text-subtle cursor-not-allowed'
                )}
              >
                逐步创作
              </button>
              <button
                onClick={() => handleStart(true)}
                disabled={!canStart}
                className={clsx(
                  'xyq-action-primary flex items-center gap-2 px-4 py-0 rounded-lg text-sm leading-[22px] font-medium transition-colors h-9 ui-control',
                  canStart
                    ? 'bg-black text-white hover:bg-subtle '
                    : 'bg-surface-soft text-subtle cursor-not-allowed'
                )}
                title="自动执行全部六个阶段，无需手动确认"
              >
                一键生成
              </button>
            </div>
          </div>
          {(configLoading || configError) && (
            <div className={clsx('mt-3 text-xs leading-[18px]', configError ? 'text-danger' : 'text-subtle')}>
              {configError || '正在读取默认模型……'}
            </div>
          )}
          {modelLoadError && (
            <div className="ui-notice mt-4" role="alert">
              <span>{modelLoadError}</span>
              <button className="ui-button ui-button-secondary shrink-0" disabled={modelsLoading} onClick={() => { setModelsLoading(true); setModelReload(value => value + 1); }}>{modelsLoading ? '重试中…' : '重试加载模型'}</button>
            </div>
          )}
          {modelsLoading && !modelLoadError && <p role="status" className="mt-3 text-xs leading-[18px] text-muted">正在加载模型列表…</p>}
          {/* 模型设置折叠面板 */}
          {showSettings && (
            <div className="xyq-generation-panel mt-4 p-4 bg-surface rounded-2xl space-y-4 text-xs leading-[18px]">
              <div className="grid grid-cols-1 gap-3">
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-muted font-medium">风格</span>
                  <select
                    value={selectedStyle}
                    onChange={e => setSelectedStyle(e.target.value)}
                    className="bg-surface border border-line rounded-lg px-3 py-0 text-ink outline-none h-9 ui-control"
                  >
                    {STYLES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-muted font-medium">视频分辨率</span>
                  <select
                    value={selectedResolution}
                    onChange={e => setSelectedResolution(e.target.value)}
                    className="bg-surface border border-line rounded-lg px-3 py-0 text-ink outline-none min-h-9 h-9 ui-control"
                  >
                    {VIDEO_RESOLUTIONS.map(item => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-muted font-medium">视频长宽比</span>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_RATIOS.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRatio(r.id)}
                        className={`flex h-9 items-center justify-center rounded-lg border px-3 text-sm leading-[22px] transition-colors ui-control ${
                          selectedRatio === r.id
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
              </div>
              <div className="space-y-3 border-t border-line/70 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted font-semibold">模型配置</span>
                  <span className="text-xs leading-[18px] text-subtle">用于主流程各阶段调用</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-muted font-medium">LLM 模型</span>
                  <select
                    value={selectedLLM}
                    onChange={e => setSelectedLLM(e.target.value)}
                    className="bg-surface border border-line rounded-lg px-3 py-0 text-ink outline-none h-9 ui-control"
                  >
                    {selectedLLM && !llmProviders.some(group => group.models.some(model => model.id === selectedLLM)) && <option value={selectedLLM}>{selectedLLM}（当前）</option>}
                    {llmProviders.map(pg => (
                      <optgroup key={pg.provider} label={pg.label}>
                        {pg.models.map(m => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-muted font-medium">VLM 评估模型</span>
                  <select
                    value={selectedVLM}
                    onChange={e => setSelectedVLM(e.target.value)}
                    className="bg-surface border border-line rounded-lg px-3 py-0 text-ink outline-none h-9 ui-control"
                  >
                    {selectedVLM && !vlmProviders.some(group => group.models.some(model => model.id === selectedVLM)) && <option value={selectedVLM}>{selectedVLM}（当前）</option>}
                    {vlmProviders.map(pg => (
                      <optgroup key={pg.provider} label={pg.label}>
                        {pg.models.map(m => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-muted font-medium">文生图</span>
                  <select
                    value={selectedT2I}
                    onChange={e => setSelectedT2I(e.target.value)}
                    className="bg-surface border border-line rounded-lg px-3 py-0 text-ink outline-none h-9 ui-control"
                  >
                    {selectedT2I && !t2iProviders.some(group => group.models.some(model => model.id === selectedT2I)) && <option value={selectedT2I}>{selectedT2I}（当前）</option>}
                    {t2iProviders.map(pg => (
                      <optgroup key={pg.provider} label={pg.label}>
                        {pg.models.map(m => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-muted font-medium">图生图</span>
                  <select
                    value={selectedI2I}
                    onChange={e => setSelectedI2I(e.target.value)}
                    className="bg-surface border border-line rounded-lg px-3 py-0 text-ink outline-none h-9 ui-control"
                  >
                    {selectedI2I && !i2iProviders.some(group => group.models.some(model => model.id === selectedI2I)) && <option value={selectedI2I}>{selectedI2I}（当前）</option>}
                    {i2iProviders.map(pg => (
                      <optgroup key={pg.provider} label={pg.label}>
                        {pg.models.map(m => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="text-muted font-medium">视频生成方式</span>
                  <select
                    value={selectedVideoMode}
                    onChange={e => setSelectedVideoMode(e.target.value as VideoGenerationMode)}
                    className="bg-surface border border-line rounded-lg px-3 py-0 text-ink outline-none h-9 ui-control"
                  >
                    {VIDEO_GENERATION_MODES.map(item => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="text-muted font-medium">{selectedVideoModeLabel}模型</span>
                  <select
                    value={activeVideoModel}
                    onChange={e => setActiveVideoModel(e.target.value)}
                    className="bg-surface border border-line rounded-lg px-3 py-0 text-ink outline-none h-9 ui-control"
                  >
                    {activeVideoModel && !activeVideoProviders.some(group => group.models.some(model => model.id === activeVideoModel)) && <option value={activeVideoModel}>{activeVideoModel}（当前）</option>}
                    {activeVideoProviders.map(pg => (
                      <optgroup key={pg.provider} label={pg.label}>
                        {pg.models.map(m => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm leading-[22px] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableConcurrency}
                    onChange={e => setEnableConcurrency(e.target.checked)}
                    className="w-4 h-4 rounded-lg border-line-strong text-accent focus:ring-accent/30"
                  />
                  <span className="text-muted">并发生成</span>
                </label>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* 示例卡片 */}
        <div className="xyq-inspiration mb-8">
          <h3 className=" font-semibold text-ink mb-3 text-base leading-6">
            灵感示例
          </h3>
          <div className="xyq-inspiration-grid grid grid-cols-2 md:grid-cols-3 gap-3">
            {PROMPT_EXAMPLES.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => handleExampleClick(ex.text)}
                className="xyq-inspiration-card text-left bg-surface rounded-2xl border border-line transition-all group"
              >
                <div
                  className="xyq-inspiration-media"
                  style={{ backgroundImage: `url(${INSPIRATION_IMAGES[idx]})` }}
                />
                <div className="xyq-inspiration-copy">
                  <div className="text-sm leading-[22px] font-medium text-white transition-colors mb-1">
                    {ex.title}
                  </div>
                  <div className="text-xs leading-[18px] text-white/70 line-clamp-2">
                    {ex.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
