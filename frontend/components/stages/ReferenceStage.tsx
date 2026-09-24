'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, RefreshCw, ChevronLeft, ChevronRight, Loader, AlertCircle, ZoomIn, ImagePlus, Edit2, Save, X, Upload, BookmarkPlus } from 'lucide-react';
import type { StageViewProps } from './types';
import { assetUrl, assetVersionLabel, assetThumbUrl } from './utils';
import { uploadArtifactImage, collectToLibrary, attachLibraryAsset } from '@/lib/workflowApi';
import LibraryPicker from '../LibraryPicker';
import StageActions from './StageActions';
import { useToast } from '@/components/ui/Feedback';
import StageProgress from './StageProgress';
import ImageLightbox from './ImageLightbox';
/* ─── 类型 ─── */
interface SceneItem {
  id: string;             // shot_001_01, shot_001_02, ...
  name: string;           // 场景1-镜头1
  index?: number;         // 全局编号
  description: string;    // 视觉提示词
  selected: string;       // 当前选中的文件路径
  versions: string[];     // 所有历史版本路径
  status?: 'pending' | 'done' | 'failed' | 'running';
}
/* ─── 水平滚动图片画廊 ─── */
function ImageGallery({
  versions,
  selected,
  onSelect,
  showPlaceholder,
}: {
  versions: string[];
  selected: string;
  onSelect: (path: string) => void;
  showPlaceholder?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -260 : 260, behavior: 'smooth' });
  };
  if (!versions.length) {
    return (
      <div className="flex items-center justify-center h-full text-subtle text-xs leading-[18px]">
        暂无图片
      </div>
    );
  }
  return (
    <div className="relative group">
      {versions.length > 1 && (
        <>
          <button
            aria-label="向左查看更多图片版本"
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-lg bg-surface/90 shadow border border-line flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ui-control"
          >
            <ChevronLeft className="w-4 h-4 text-muted" />
          </button>
          <button
            aria-label="向右查看更多图片版本"
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-lg bg-surface/90 shadow border border-line flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ui-control"
          >
            <ChevronRight className="w-4 h-4 text-muted" />
          </button>
        </>
      )}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide py-1 px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {versions.map((path, i) => {
          const isSelected = path === selected;
          return (
            <div
              key={path}
              onClick={() => onSelect(path)}
              className={`flex-shrink-0 cursor-pointer rounded-lg overflow-hidden transition-all ${
                isSelected
                  ? 'ring-2 ring-line-strong '
                  : 'ring-1 ring-line hover:ring-line-strong '
              }`}
            >
              <div className="relative group/img">
                <img
                  src={assetThumbUrl(path)}
                  alt={`v${i + 1}`}
                  className="h-32 w-auto object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (!img.dataset.fallback) {
                      img.dataset.fallback = '1';
                      img.src = assetUrl(path);
                    } else {
                      img.style.display = 'none';
                    }
                  }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className="absolute top-1 right-1 w-9 h-9 rounded-lg bg-black/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity hover:bg-black/60 ui-control"
                  title="放大查看" aria-label="放大查看图片"
                >
                  <ZoomIn className="w-3 h-3 text-white" />
                </button>
              </div>
              <div className={`text-center text-xs leading-[18px] py-1 ${
                isSelected ? 'bg-action text-on-action font-medium' : 'bg-surface text-subtle'
              }`}>
                {assetVersionLabel(path, i)}
              </div>
            </div>
          );
        })}
        {showPlaceholder && (
          <div className="flex-shrink-0 flex items-center justify-center h-32 aspect-video bg-surface rounded-lg border border-dashed border-line">
            <div className="flex items-center gap-2 text-subtle text-xs leading-[18px]">
              <Loader className="w-4 h-4 animate-spin" />
              <span>生成中...</span>
            </div>
          </div>
        )}
      </div>
      {lightboxIndex !== null && (
        <ImageLightbox
          images={versions}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
/* ─── 场景行 ─── */
function SceneRow({
  scene,
  canEdit,
  editDesc,
  onDescChange,
  onRegenerate,
  onSelectVersion,
  onSavePrompt,
  isStageRunning,
  isRegenerating,
  isEditing,
  onToggleEdit,
  getSelected,
  allowMissingGenerate,
  onCancelEdit,
  onUploadImage,
  onPickFromLibrary,
  isUploading,
}: {
  scene: SceneItem;
  canEdit: boolean;
  editDesc: string;
  onDescChange: (val: string) => void;
  onRegenerate: () => void;
  onSelectVersion: (path: string) => void;
  onSavePrompt: () => void;
  isStageRunning?: boolean;
  isRegenerating?: boolean;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  getSelected: (scene: SceneItem) => string;
  allowMissingGenerate?: boolean;
  onCancelEdit?: () => void;
  onUploadImage: (file: File) => void;
  onPickFromLibrary: () => void;
  isUploading?: boolean;
}) {
  const toast = useToast();
  const isRunning = scene.status === 'running' || isRegenerating;
  const isPending = scene.status === 'pending';
  const isFailed = scene.status === 'failed' && !isRegenerating;
  const hasImage = Boolean(getSelected(scene)) || scene.versions.length > 0;
  const canGenerateMissing = Boolean(allowMissingGenerate) && !hasImage && !isRunning && !isRegenerating;
  const canShowRegenerate = !isRunning && !isPending && (hasImage || isFailed || canGenerateMissing);
  const hasChanges = editDesc !== scene.description;
  return (
    <div className={`flex flex-col xl:flex-row border rounded-2xl overflow-hidden bg-surface ${
      isFailed ? 'border-danger-line' : 'border-line'
    }`}>
      {/* 左侧: 提示词 */}
      <div className="w-full xl:w-80 xl:flex-shrink-0 p-4 border-b xl:border-b-0 xl:border-r border-line flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center justify-center h-6 px-2 rounded-lg bg-surface-soft text-muted text-xs leading-[18px] font-semibold flex-shrink-0 whitespace-nowrap">
            {scene.index ?? scene.id.replace('Scene_', '')}
          </span>
          <span className="text-sm leading-[22px] font-semibold text-ink truncate">{scene.name || (scene as any).title || `片段 ${scene.index}`}</span>
          {isPending && (
            <span className="text-xs leading-[18px] bg-surface text-muted px-2 py-1 rounded-lg">等待中</span>
          )}
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-xs leading-[18px] bg-warning-soft text-warning px-2 py-1 rounded-lg">
              <Loader className="w-2.5 h-2.5 animate-spin" />生成中
            </span>
          )}
          {isFailed && (
            <span className="text-xs leading-[18px] bg-danger-soft text-danger px-2 py-1 rounded-lg">失败</span>
          )}
          {/* 编辑/保存按钮 */}
          {canEdit && !isStageRunning && (
            isEditing ? (
              <div className="ml-auto flex gap-1">
                <button
                  onClick={onCancelEdit}
                  className="flex items-center gap-1 px-2 py-0 rounded-lg text-xs leading-[18px] font-medium text-muted hover:bg-surface-hover hover:text-ink h-9 ui-control"
                >
                  <X className="w-3 h-3" />取消
                </button>
                <button
                  onClick={onSavePrompt}
                  disabled={!hasChanges}
                  className={`flex items-center gap-1 px-2 py-0 rounded-lg text-xs leading-[18px] font-medium transition-colors h-9 ui-control ${
                    hasChanges
                      ? 'text-on-action bg-action hover:bg-action-hover'
                      : 'text-subtle bg-surface-soft cursor-not-allowed'
                  }`}
                >
                  <Save className="w-3 h-3" />
                  保存
                </button>
              </div>
            ) : (
              <div className="ml-auto flex items-center gap-1">
                {getSelected(scene) && (
                  <button
                    onClick={async () => {
                      try {
                        await collectToLibrary(getSelected(scene), 'scene', scene.name, 'image');
                        toast('已添加到素材库', 'success');
                      } catch (e: any) {
                        toast(e.message || '添加失败', 'error');
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-0 rounded-lg text-xs leading-[18px] font-medium text-muted bg-surface-soft hover:bg-surface-hover hover:text-ink transition-colors h-9 ui-control"
                    title="添加到素材库"
                  >
                    <BookmarkPlus className="w-3 h-3" />素材
                  </button>
                )}
                <button
                  onClick={onToggleEdit}
                  className="ml-auto flex items-center gap-1 px-2 py-0 rounded-lg text-xs leading-[18px] font-medium text-muted bg-surface-soft hover:bg-surface-hover hover:text-ink transition-colors h-9 ui-control"
                >
                  <Edit2 className="w-3 h-3" />
                  编辑
                </button>
              </div>
            )
          )}
        </div>
        {isEditing ? (
          <textarea
            aria-label={`分镜 ${scene.index ?? scene.id} 的提示词`}
            value={editDesc}
            onChange={e => onDescChange(e.target.value)}
            rows={5}
            className="h-[120px] text-xs leading-[18px] text-muted bg-surface border border-line rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent-line"
          />
        ) : (
          <div className="h-[120px] overflow-y-auto pr-1 custom-scrollbar">
            <p className="text-xs leading-[18px] text-muted whitespace-pre-wrap">{scene.description}</p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canShowRegenerate && (
            <button
              onClick={onRegenerate}
              className={`inline-flex items-center gap-2 px-3 py-0 rounded-lg text-xs leading-[18px] font-medium transition-colors h-9 ui-control ${
                isFailed
                  ? 'text-danger bg-danger-soft hover:bg-danger-soft'
                  : 'text-muted bg-surface-soft hover:bg-surface-hover hover:text-ink'
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              {isFailed ? '点击重试' : hasImage ? '重新生成' : '生成'}
            </button>
          )}
          <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs leading-[18px] font-medium transition-colors ${
            isUploading
              ? 'text-subtle bg-surface-soft cursor-wait'
              : 'text-muted bg-surface-soft hover:bg-surface-hover cursor-pointer'
          }`}>
            {isUploading ? <Loader className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {isUploading ? '上传中...' : '上传照片'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploading}
              onChange={e => {
                const file = e.target.files?.[0];
                e.currentTarget.value = '';
                if (file) onUploadImage(file);
              }}
            />
          </label>
          <button
            onClick={onPickFromLibrary}
            className="inline-flex items-center gap-2 px-3 py-0 rounded-lg text-xs leading-[18px] font-medium text-muted bg-surface-soft hover:bg-surface-hover hover:text-ink transition-colors h-9 ui-control"
            title="从素材库选择"
          >
            <BookmarkPlus className="w-3 h-3" />
            素材库
          </button>
        </div>
      </div>
      {/* 右侧: 图片画廊 / 占位 */}
      <div className="flex-1 min-w-0 p-3 flex items-center">
        {isRunning && !hasImage ? (
          <div className="flex items-center justify-center h-32 aspect-video bg-surface rounded-lg border border-dashed border-line">
            <div className="flex items-center gap-2 text-subtle text-xs leading-[18px]">
              <Loader className="w-4 h-4 animate-spin" />
              <span>正在生成...</span>
            </div>
          </div>
        ) : !hasImage ? (
          <div className="flex items-center justify-center h-32 aspect-video bg-surface/60 rounded-lg border border-dashed border-line">
            <div className="flex flex-col items-center gap-1 text-subtle text-xs leading-[18px]">
              {isFailed ? (
                <>
              <AlertCircle className="w-4 h-4" />
                  <span>生成失败</span>
                  {!isRunning && (
                    <button
                      onClick={onRegenerate}
                      disabled={isRegenerating}
                      className="mt-1 inline-flex items-center gap-1 px-2 py-0 rounded-lg text-xs leading-[18px] font-medium text-danger bg-danger-soft hover:bg-danger-soft transition-colors disabled:text-subtle disabled:bg-surface-soft disabled:cursor-not-allowed h-9 ui-control"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      点击重试
                    </button>
                  )}
                </>
              ) : (
                <>
                  <ImagePlus className="w-4 h-4" />
                  <span>{isPending ? '等待生成...' : '暂无图片'}</span>
                  {canGenerateMissing && (
                    <button
                      onClick={onRegenerate}
                      disabled={isRegenerating}
                      className="mt-1 inline-flex items-center gap-1 px-2 py-0 rounded-lg text-xs leading-[18px] font-medium text-muted bg-surface-soft hover:bg-surface-hover hover:text-ink transition-colors disabled:text-subtle disabled:bg-surface-soft disabled:cursor-not-allowed h-9 ui-control"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      生成
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="relative w-full">
            <ImageGallery
              versions={scene.versions}
              selected={getSelected(scene)}
              onSelect={onSelectVersion}
              showPlaceholder={isRunning}
            />
            {isFailed && (
              <button
                onClick={onRegenerate}
                className="absolute top-1 right-1 z-10 flex items-center gap-1 px-2 py-0 rounded-lg text-xs leading-[18px] font-medium text-on-action bg-danger/80 hover:bg-danger shadow transition-colors h-9 ui-control"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                重试
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
/* ─── 主组件 ─── */
export default function ReferenceStage({ state, sessionId, onConfirm, onIntervene, onRegenerate, onRetryFailed, onUpdateArtifact, onSaveSelections, showConfirm, isRunning, hasPendingItems, hasNextStageStarted, scriptArtifact }: StageViewProps) {
  const toast = useToast();
  const [editDescs, setEditDescs] = useState<Record<string, string>>({});
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({});
  // 素材库选图目标
  const [libraryTarget, setLibraryTarget] = useState<string | null>(null);
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const regenerationStartCounts = useRef<Record<string, number>>({});
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  // 提取剧集标题映射
  const episodeTitleMap = React.useMemo(() => {
    const map: Record<number, string> = {};
    if (scriptArtifact?.episodes) {
      scriptArtifact.episodes.forEach((ep: any) => {
        // 关键修复：这里的字段名应该是 episode_number 和 act_title
        const epNum = ep.episode_number || ep.episode;
        const epTitle = ep.act_title || ep.title;
        if (epNum) {
          map[Number(epNum)] = epTitle || '';
        }
      });
    }
    return map;
  }, [scriptArtifact]);
  const getSelected = (scene: SceneItem) => selectedVersions[scene.id] || scene.selected;
  // 兼容旧格式: scene_images: {Scene_1: "path"} → scenes: [{id, ...}]
  const scenes: SceneItem[] = (() => {
    if (state.artifact?.scenes?.length) return state.artifact.scenes;
    if (state.artifact?.scene_images) {
      const si = state.artifact.scene_images as Record<string, string>;
      return Object.entries(si)
        .sort(([a], [b]) => {
          const na = parseInt(a.replace(/\D/g, '')) || 0;
          const nb = parseInt(b.replace(/\D/g, '')) || 0;
          return na - nb;
        })
        .map(([id, path]) => ({
          id,
          name: `场景 ${id.replace('Scene_', '')}`,
          description: '',
          selected: path,
          versions: [path],
          status: 'done' as const,
        }));
    }
    return [];
  })();
  const canEdit = state.status === 'waiting' || state.status === 'completed';
  // 当场景数据变化时，初始化编辑描述
  useEffect(() => {
    if (scenes.length > 0) {
      setEditDescs(prev => {
        const next: Record<string, string> = {};
        scenes.forEach(s => { next[s.id] = prev[s.id] ?? s.description; });
        return next;
      });
    }
  }, [scenes]);
  // 当对应片段新增版本或失败时，仅清除该片段的重新生成状态，支持多个任务并行。
  useEffect(() => {
    if (regeneratingIds.size === 0) return;
    setRegeneratingIds(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        const scene = scenes.find(item => item.id === id);
        if (!scene) continue;
        const startCount = regenerationStartCounts.current[id] ?? 0;
        if ((scene.versions?.length || 0) > startCount || scene.status === 'failed') {
          next.delete(id);
          delete regenerationStartCounts.current[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [scenes, regeneratingIds.size]);
  const hasScenes = scenes.length > 0;
  // 保存单个提示词到后端 JSON
  const handleSavePrompt = async (sceneId: string) => {
    const newPrompt = editDescs[sceneId];
    if (!newPrompt) return;
    setSavingIds(prev => new Set(prev).add(sceneId));
    try {
      // 调用后端 API 保存提示词
      const response = await fetch(`/api/project/${sessionId}/artifact/reference_generation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: scenes.map(s => ({
            segment_id: s.id,
            visual_prompt: s.id === sceneId ? newPrompt : s.description
          }))
        })
      });
      if (response.ok) {
        // 保存成功后关闭编辑模式
        setEditingIds(prev => {
          const next = new Set(prev);
          next.delete(sceneId);
          return next;
        });
        // 更新本地状态，使用保存后的值
        setEditDescs(prev => ({ ...prev, [sceneId]: newPrompt }));
        // 同步更新 artifact 以便后续阶段能获取最新的提示词
        if (onUpdateArtifact && state.artifact?.scenes) {
          const updatedScenes = state.artifact.scenes.map((s: SceneItem) =>
            s.id === sceneId ? { ...s, description: newPrompt } : s
          );
          onUpdateArtifact({ scenes: updatedScenes });
        }
      }
    } catch (error) {
      console.error('保存提示词失败:', error);
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };
  // 切换编辑模式
  const handleToggleEdit = (sceneId: string) => {
    setEditingIds(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };
  const handleCancelEdit = (sceneId: string) => {
    const scene = scenes.find(item => item.id === sceneId);
    setEditDescs(prev => ({ ...prev, [sceneId]: scene?.description || '' }));
    setEditingIds(prev => {
      const next = new Set(prev);
      next.delete(sceneId);
      return next;
    });
  };
  const handleUploadImage = async (sceneId: string, file: File) => {
    setUploadingIds(prev => new Set(prev).add(sceneId));
    try {
      const result = await uploadArtifactImage(sessionId, 'reference_generation', 'scenes', sceneId, file);
      if (result.artifact?.scenes) {
        onUpdateArtifact?.({ scenes: result.artifact.scenes });
      }
      setSelectedVersions(prev => ({ ...prev, [sceneId]: result.path }));
    } catch (error) {
      console.error('上传图片失败:', error);
    } finally {
      setUploadingIds(prev => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };
  const handleAttachLibrary = async (assetId: number) => {
    if (!libraryTarget) return;
    const sceneId = libraryTarget;
    try {
      const result = await attachLibraryAsset(sessionId, 'reference_generation', 'scenes', sceneId, assetId);
      if (result.artifact?.scenes) {
        onUpdateArtifact?.({ scenes: result.artifact.scenes });
      }
      setSelectedVersions(prev => ({ ...prev, [sceneId]: result.path }));
      setLibraryTarget(null);
    } catch (error) {
      console.error('从素材库选择失败:', error);
      toast('从素材库选择失败', 'error');
    }
  };
  const handleRegenerate = (sceneId: string) => {
    const scene = scenes.find(item => item.id === sceneId);
    regenerationStartCounts.current[sceneId] = scene?.versions?.length || 0;
    setRegeneratingIds(prev => {
      const next = new Set(prev);
      next.add(sceneId);
      return next;
    });
    onIntervene({ regenerate_scenes: [sceneId] });
  };
  const handleSelectVersion = async (sceneId: string, path: string) => {
    setSelectedVersions(prev => ({ ...prev, [sceneId]: path }));
    // 同步更新 artifact 以便确认时能传递正确的选中图片给阶段5
    if (onUpdateArtifact && state.artifact?.scenes) {
      const updatedScenes = state.artifact.scenes.map((s: SceneItem) =>
        s.id === sceneId ? { ...s, selected: path } : s
      );
      onUpdateArtifact({ scenes: updatedScenes });
    }
    // 自动保存选择
    const selections: Record<string, string> = {};
    scenes.forEach(s => { selections[s.id] = selectedVersions[s.id] || s.selected; });
    selections[sceneId] = path;
    if (onSaveSelections) {
      await onSaveSelections(selections);
    }
  };
  return (
    <div className="flex flex-col h-full">
      <div className="xyq-stage-content flex-1 min-w-0">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-1">
          <h2 className=" font-semibold text-ink text-2xl leading-8">分镜图</h2>
        </div>
        <p className="text-sm leading-[22px] text-muted mb-6">
          基于角色/场景素材 + 分镜视觉描述，使用图生图生成场景参考图
        </p>
        {/* 运行中 */}
        {state.status === 'running' && (
          <StageProgress message={state.progressMessage} fallback="正在生成参考图..." progress={state.progress} color="emerald" />
        )}
        {state.error && (
          <div className="text-sm leading-[22px] text-danger bg-danger-soft border border-danger-line p-4 rounded-2xl mb-4">{state.error}</div>
        )}
        {/* ═══ 场景列表 ═══ */}
        {hasScenes && (
          <div className="space-y-8">
            {(() => {
              // 按剧集分组
              const episodes: Record<number, SceneItem[]> = {};
              scenes.forEach(s => {
                const ep = (s as any).episode || 1;
                if (!episodes[ep]) episodes[ep] = [];
                episodes[ep].push(s);
              });
              return Object.keys(episodes).sort((a, b) => Number(a) - Number(b)).map(epNum => {
                const epScenes = episodes[Number(epNum)];
                const fallbackTitle = (epScenes[0] as any).episode_title || `第 ${epNum} 集`;
                const scriptTitle = episodeTitleMap[Number(epNum)];
                const episodeTitle = scriptTitle ? `第 ${epNum} 集：${scriptTitle}` : fallbackTitle;
                return (
                  <div key={epNum} className="space-y-4">
                    <div className="flex items-center justify-between py-2 px-1 border-b border-line">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-line-strong rounded-lg" />
                        <h3 className=" font-semibold text-ink text-base leading-6">{episodeTitle}</h3>
                      </div>
                      <span className="text-xs leading-[18px] text-muted font-medium bg-surface-soft px-3 py-1 rounded-lg border border-success-line ">
                        {epScenes.length} 个片段
                      </span>
                    </div>
                    <div className="space-y-4">
                      {epScenes.map(scene => (
                        <div key={scene.id} className="relative">
                          <SceneRow
                            scene={scene}
                            editDesc={editDescs[scene.id] ?? scene.description}
                            onDescChange={(val) => setEditDescs(prev => ({ ...prev, [scene.id]: val }))}
                            onSavePrompt={() => handleSavePrompt(scene.id)}
                            onRegenerate={() => handleRegenerate(scene.id)}
                            onSelectVersion={(path) => handleSelectVersion(scene.id, path)}
                            isStageRunning={state.status === 'running'}
                            isRegenerating={regeneratingIds.has(scene.id)}
                            isEditing={editingIds.has(scene.id)}
                            onToggleEdit={() => handleToggleEdit(scene.id)}
                            onCancelEdit={() => handleCancelEdit(scene.id)}
                            canEdit={canEdit}
                            getSelected={getSelected}
                            allowMissingGenerate={state.status !== 'pending'}
                            onUploadImage={file => handleUploadImage(scene.id, file)}
                            onPickFromLibrary={() => setLibraryTarget(scene.id)}
                            isUploading={uploadingIds.has(scene.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
        {/* 如果有 artifact 数据（即使 status 是 pending），也显示内容 */}
        {!hasScenes && state.status === 'pending' && (
          <div className="text-center text-subtle text-sm leading-[22px] py-8">等待上一阶段完成...</div>
        )}
      </div>
      {/* 底部操作栏 */}
      <StageActions
        status={state.status}
        onConfirm={onConfirm}
        showConfirm={showConfirm}
        onRegenerate={onRegenerate}
        onRetryFailed={onRetryFailed}
        stageId="reference_generation"
        hasPendingItems={hasPendingItems}
        hasNextStageStarted={hasNextStageStarted}
        isRunning={isRunning}
      />
      {libraryTarget && (
        <LibraryPicker
          onSelect={asset => handleAttachLibrary(asset.id)}
          onClose={() => setLibraryTarget(null)}
        />
      )}
    </div>
  );
}
