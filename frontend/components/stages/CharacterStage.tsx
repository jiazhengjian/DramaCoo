'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Users, MapPin, Package, RefreshCw, Save, X, ChevronLeft, ChevronRight, Loader, AlertCircle, ZoomIn, ImagePlus, Edit2, Upload, BookmarkPlus } from 'lucide-react';
import type { StageViewProps } from './types';
import { assetUrl, assetVersionLabel, assetThumbUrl } from './utils';
import { uploadArtifactImage, collectToLibrary, attachLibraryAsset, deleteArtifactVersion } from '@/lib/workflowApi';
import LibraryPicker from '../LibraryPicker';
import StageActions from './StageActions';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import StageProgress from './StageProgress';
import ImageLightbox from './ImageLightbox';
/* ─── 类型 ─── */
interface AssetVersion {
  id: string;             // 唯一标识 (character_id / setting_id)
  name: string;
  description: string;
  selected: string;       // 当前选中的文件路径
  versions: string[];     // 所有历史版本路径
  status?: 'pending' | 'done' | 'failed' | 'running';  // 生成状态
}
/* ─── 水平滚动图片画廊 ─── */
function ImageGallery({
  versions,
  selected,
  onSelect,
  onDeleteVersion,
  showPlaceholder,
}: {
  versions: string[];
  selected: string;
  onSelect: (path: string) => void;
  onDeleteVersion?: (path: string) => void;
  showPlaceholder?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 260;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
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
                  className="absolute top-1 right-12 w-9 h-9 rounded-lg bg-black/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity hover:bg-black/60 ui-control"
                  title="放大查看" aria-label="放大查看图片"
                >
                  <ZoomIn className="w-3 h-3 text-white" />
                </button>
                {onDeleteVersion && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteVersion(path); }}
                    className="absolute top-1 right-1 w-9 h-9 rounded-lg bg-black/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity hover:bg-danger ui-control"
                    title="删除" aria-label="删除图片版本"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
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
/* ─── 素材行 ─── */
function AssetRow({
  asset,
  type,
  isEditing,
  editDesc,
  onDescChange,
  onRegenerate,
  onSelectVersion,
  onDeleteVersion,
  onSaveEdit,
  onCancelEdit,
  onToggleEdit,
  onUploadImage,
  onPickFromLibrary,
  isStageRunning,
  isRegenerating,
  isUploading,
}: {
  asset: AssetVersion;
  type: 'character' | 'setting' | 'prop';
  isEditing: boolean;
  editDesc: string;
  onDescChange: (val: string) => void;
  onRegenerate: () => void;
  onSelectVersion: (path: string) => void;
  onDeleteVersion?: (path: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleEdit: () => void;
  onUploadImage: (file: File) => void;
  onPickFromLibrary: () => void;
  isStageRunning?: boolean;
  isRegenerating?: boolean;
  isUploading?: boolean;
}) {
  const toast = useToast();
  const isRunning = asset.status === 'running' || isRegenerating;
  const isPending = asset.status === 'pending';
  const isFailed = asset.status === 'failed' && !isRegenerating;
  const hasImage = Boolean(asset.selected) || asset.versions.length > 0;
  const canGenerateMissing = !hasImage && !isPending && !isRunning;
  const canShowRegenerate = !isRunning && !isPending && (hasImage || isFailed || canGenerateMissing);
  return (
    <div className={`flex flex-col xl:flex-row border rounded-2xl overflow-hidden bg-surface ${
      isFailed ? 'border-danger-line' : 'border-line'
    }`}>
      {/* 左侧: 描述 */}
      <div className="w-full xl:w-80 xl:flex-shrink-0 p-4 border-b xl:border-b-0 xl:border-r border-line flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          {type === 'character'
            ? <Users className="w-3.5 h-3.5 text-muted" />
            : type === 'setting'
              ? <MapPin className="w-3.5 h-3.5 text-muted" />
              : <Package className="w-3.5 h-3.5 text-muted" />
          }
          <span className="text-sm leading-[22px] font-semibold text-ink truncate">{asset.name}</span>
          {(isPending || isRunning) && (
            <span className="inline-flex items-center gap-1 text-xs leading-[18px] bg-warning-soft text-warning px-2 py-1 rounded-lg">
              {isRunning && <Loader className="w-2.5 h-2.5 animate-spin" />}
              {isRunning ? '生成中' : '等待中'}
            </span>
          )}
          {isFailed && (
            <span className="text-xs leading-[18px] bg-danger-soft text-danger px-2 py-1 rounded-lg">失败</span>
          )}
          {!isStageRunning && (
            isEditing ? (
              <div className="ml-auto flex gap-1">
                <button
                  onClick={onCancelEdit}
                  className="flex items-center gap-1 px-2 py-0 rounded-lg text-xs leading-[18px] font-medium text-muted hover:bg-surface-hover hover:text-ink h-9 ui-control"
                >
                  <X className="w-3 h-3" />取消
                </button>
                <button
                  onClick={onSaveEdit}
                  className="flex items-center gap-1 px-2 py-0 rounded-lg text-xs leading-[18px] font-medium text-on-action bg-action hover:bg-action h-9 ui-control"
                >
                  <Save className="w-3 h-3" />保存
                </button>
              </div>
            ) : (
              <div className="ml-auto flex items-center gap-1">
                {asset.selected && (
                  <button
                    onClick={async () => {
                      try {
                        await collectToLibrary(asset.selected, type === 'character' ? 'character' : type === 'setting' ? 'setting' : 'prop', asset.name, 'image');
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
                  className="flex items-center gap-1 px-2 py-0 rounded-lg text-xs leading-[18px] font-medium text-muted bg-surface-soft hover:bg-surface-hover hover:text-ink transition-colors h-9 ui-control"
                >
                  <Edit2 className="w-3 h-3" />修改
                </button>
              </div>
            )
          )}
        </div>
        {isEditing ? (
          <textarea
            aria-label={`${asset.name}的描述`}
            value={editDesc}
            onChange={e => onDescChange(e.target.value)}
            rows={5}
            className="h-[120px] text-xs leading-[18px] text-muted bg-surface border border-line rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent-line"
          />
        ) : (
          <div className="h-[120px] overflow-y-auto pr-1 custom-scrollbar">
            <p className="text-xs leading-[18px] text-muted ">{asset.description}</p>
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
        {isPending && !hasImage ? (
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
                  <span>暂无图片</span>
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
              versions={asset.versions}
              selected={asset.selected}
              onSelect={onSelectVersion}
              onDeleteVersion={onDeleteVersion}
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
export default function CharacterStage({ state, sessionId, onConfirm, onIntervene, onRegenerate, onRetryFailed, onUpdateArtifact, onSaveSelections, showConfirm, isRunning, hasPendingItems, hasNextStageStarted }: StageViewProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const characters: AssetVersion[] = state.artifact?.characters || [];
  const settingsData: AssetVersion[] = state.artifact?.settings || [];
  const propsData: AssetVersion[] = state.artifact?.props || [];
  const [editChars, setEditChars] = useState<Record<string, string>>({});
  const [editSets, setEditSets] = useState<Record<string, string>>({});
  const [editProps, setEditProps] = useState<Record<string, string>>({});
  // 素材库选图目标
  const [libraryTarget, setLibraryTarget] = useState<{ type: 'characters' | 'settings' | 'props'; id: string } | null>(null);
  // 跟踪前端选择的版本（覆盖后端返回的 selected）
  const [selectedChars, setSelectedChars] = useState<Record<string, string>>({});
  const [selectedSets, setSelectedSets] = useState<Record<string, string>>({});
  const [selectedProps, setSelectedProps] = useState<Record<string, string>>({});
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const regenerationStartCounts = useRef<Record<string, number>>({});
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const allAssets = React.useMemo(() => [...characters, ...settingsData], [characters, settingsData]);
  // 当对应素材新增版本或失败时，仅清除该素材的重新生成状态，支持多个任务并行。
  useEffect(() => {
    if (regeneratingIds.size === 0) return;
    setRegeneratingIds(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        const asset = allAssets.find(item => item.id === id);
        if (!asset) continue;
        const startCount = regenerationStartCounts.current[id] ?? 0;
        if ((asset.versions?.length || 0) > startCount || asset.status === 'failed') {
          next.delete(id);
          delete regenerationStartCounts.current[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allAssets, regeneratingIds.size]);
  const hasChars = characters.length > 0;
  const hasSets = settingsData.length > 0;
  const hasProps = propsData.length > 0;
  const startEdit = useCallback((id: string) => {
    const cd: Record<string, string> = {};
    characters.forEach(c => { cd[c.id] = c.description; });
    setEditChars(cd);
    const sd: Record<string, string> = {};
    settingsData.forEach(s => { sd[s.id] = s.description; });
    setEditSets(sd);
    const pd: Record<string, string> = {};
    propsData.forEach(p => { pd[p.id] = p.description; });
    setEditProps(pd);
    setEditingIds(prev => new Set(prev).add(id));
  }, [characters, settingsData, propsData]);
  const cancelEdit = (id: string) => {
    setEditingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  const saveEdit = (id: string) => {
    const selections: Record<string, any> = {};
    characters.forEach(c => { selections[c.id] = selectedChars[c.id] || c.selected; });
    settingsData.forEach(s => { selections[s.id] = selectedSets[s.id] || s.selected; });
    propsData.forEach(p => { selections[p.id] = selectedProps[p.id] || p.selected; });
    selections._editDescs = {
      characters: id in editChars ? { [id]: editChars[id] } : {},
      settings: id in editSets ? { [id]: editSets[id] } : {},
      props: id in editProps ? { [id]: editProps[id] } : {},
    };
    onSaveSelections?.(selections);
    cancelEdit(id);
  };
  const handleUploadImage = async (type: 'characters' | 'settings' | 'props', id: string, file: File) => {
    setUploadingIds(prev => new Set(prev).add(id));
    try {
      const result = await uploadArtifactImage(sessionId, 'character_design', type, id, file);
      const artifact = result.artifact;
      if (artifact) {
        onUpdateArtifact?.({
          characters: artifact.characters || [],
          settings: artifact.settings || [],
          props: artifact.props || [],
        });
      }
      if (artifact?.characters) {
        const char = artifact.characters.find((item: AssetVersion) => item.id === id);
        if (char?.selected) setSelectedChars(prev => ({ ...prev, [id]: char.selected }));
      }
      if (artifact?.settings) {
        const setting = artifact.settings.find((item: AssetVersion) => item.id === id);
        if (setting?.selected) setSelectedSets(prev => ({ ...prev, [id]: setting.selected }));
      }
      if (artifact?.props) {
        const prop = artifact.props.find((item: AssetVersion) => item.id === id);
        if (prop?.selected) setSelectedProps(prev => ({ ...prev, [id]: prop.selected }));
      }
    } catch (error) {
      console.error('上传图片失败:', error);
    } finally {
      setUploadingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };
  const handleAttachLibrary = async (assetId: number) => {
    if (!libraryTarget) return;
    const { type, id } = libraryTarget;
    try {
      const result = await attachLibraryAsset(sessionId, 'character_design', type, id, assetId);
      const artifact = result.artifact;
      if (artifact) {
        onUpdateArtifact?.({
          characters: artifact.characters || [],
          settings: artifact.settings || [],
          props: artifact.props || [],
        });
      }
      if (artifact?.characters) {
        const char = artifact.characters.find((item: AssetVersion) => item.id === id);
        if (char?.selected) setSelectedChars(prev => ({ ...prev, [id]: char.selected }));
      }
      if (artifact?.settings) {
        const setting = artifact.settings.find((item: AssetVersion) => item.id === id);
        if (setting?.selected) setSelectedSets(prev => ({ ...prev, [id]: setting.selected }));
      }
      if (artifact?.props) {
        const prop = artifact.props.find((item: AssetVersion) => item.id === id);
        if (prop?.selected) setSelectedProps(prev => ({ ...prev, [id]: prop.selected }));
      }
      setLibraryTarget(null);
    } catch (error) {
      console.error('从素材库选择失败:', error);
      toast('从素材库选择失败', 'error');
    }
  };
  const handleDeleteVersion = async (type: 'characters' | 'settings' | 'props', id: string, path: string) => {
    if (!await confirm({ title: '删除图片版本', description: '删除后不可恢复。确定删除这张图吗？', confirmLabel: '删除图片', danger: true })) return;
    try {
      const result = await deleteArtifactVersion(sessionId, 'character_design', type, id, path);
      if (result.artifact) {
        onUpdateArtifact?.({
          characters: result.artifact.characters || [],
          settings: result.artifact.settings || [],
          props: result.artifact.props || [],
        });
      }
      const listKey = type === 'characters' ? 'characters' : type === 'settings' ? 'settings' : 'props';
      const item = (result.artifact?.[listKey] || []).find((x: AssetVersion) => x.id === id);
      const newSelected = item?.selected || '';
      if (type === 'characters') setSelectedChars(prev => ({ ...prev, [id]: newSelected }));
      else if (type === 'settings') setSelectedSets(prev => ({ ...prev, [id]: newSelected }));
      else setSelectedProps(prev => ({ ...prev, [id]: newSelected }));
    } catch (error: any) {
      console.error('删除版本失败:', error);
      toast(error.message || '删除失败', 'error');
    }
  };
  const handleRegenerate = (type: 'characters' | 'settings' | 'props', id: string) => {
    const source = type === 'characters' ? characters : type === 'settings' ? settingsData : propsData;
    const asset = source.find(item => item.id === id);
    regenerationStartCounts.current[id] = asset?.versions?.length || 0;
    setRegeneratingIds(prev => new Set(prev).add(id));
    if (type === 'characters') {
      onIntervene({ regenerate_characters: [id] });
    } else if (type === 'settings') {
      onIntervene({ regenerate_settings: [id] });
    } else {
      onIntervene({ regenerate_props: [id] });
    }
  };
  const handleSelectCharVersion = async (id: string, path: string) => {
    setSelectedChars(prev => ({ ...prev, [id]: path }));
    // 自动保存选择
    const selections: Record<string, string> = {};
    characters.forEach(c => { selections[c.id] = selectedChars[c.id] || c.selected; });
    selections[id] = path;
    settingsData.forEach(s => { selections[s.id] = selectedSets[s.id] || s.selected; });
    if (onSaveSelections) {
      await onSaveSelections(selections);
    }
  };
  const handleSelectSetVersion = async (id: string, path: string) => {
    setSelectedSets(prev => ({ ...prev, [id]: path }));
    // 自动保存选择
    const selections: Record<string, string> = {};
    characters.forEach(c => { selections[c.id] = selectedChars[c.id] || c.selected; });
    settingsData.forEach(s => { selections[s.id] = selectedSets[s.id] || s.selected; });
    selections[id] = path;
    if (onSaveSelections) {
      await onSaveSelections(selections);
    }
  };
  const getCharSelected = (asset: AssetVersion) => selectedChars[asset.id] || asset.selected;
  const getSetSelected = (asset: AssetVersion) => selectedSets[asset.id] || asset.selected;
  const handleSelectPropVersion = async (id: string, path: string) => {
    setSelectedProps(prev => ({ ...prev, [id]: path }));
    const selections: Record<string, string> = {};
    characters.forEach(c => { selections[c.id] = selectedChars[c.id] || c.selected; });
    settingsData.forEach(s => { selections[s.id] = selectedSets[s.id] || s.selected; });
    propsData.forEach(p => { selections[p.id] = selectedProps[p.id] || p.selected; });
    selections[id] = path;
    if (onSaveSelections) await onSaveSelections(selections);
  };
  const getPropSelected = (asset: AssetVersion) => selectedProps[asset.id] || asset.selected;
  return (
    <div className="flex flex-col h-full">
      <div className="xyq-stage-content flex-1 min-w-0">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-1">
          <h2 className=" font-semibold text-ink text-2xl leading-8">资产图</h2>
        </div>
        <p className="text-sm leading-[22px] text-muted mb-6">
          生成角色4视图 (正面特写·正面全身·侧面全身·背面全身) 和场景全景图
        </p>
        {/* 运行中 */}
        {state.status === 'running' && (
          <StageProgress message={state.progressMessage} fallback="正在生成角色与场景..." progress={state.progress} color="violet" />
        )}
        {state.error && (
          <div className="text-sm leading-[22px] text-danger bg-danger-soft border border-danger-line p-4 rounded-2xl mb-4">{state.error}</div>
        )}
        {/* ═══ 角色列表 ═══ */}
        {hasChars && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-muted" />
              <h3 className=" font-semibold text-ink text-base leading-6">角色 ({characters.length})</h3>
            </div>
            <div className="space-y-3">
              {characters.map(asset => (
                <AssetRow
                  key={asset.id}
                  asset={{ ...asset, selected: getCharSelected(asset) }}
                  type="character"
                  isEditing={editingIds.has(asset.id)}
                  editDesc={editChars[asset.id] || asset.description}
                  onDescChange={val => setEditChars(prev => ({ ...prev, [asset.id]: val }))}
                  onRegenerate={() => handleRegenerate('characters', asset.id)}
                  onSelectVersion={path => handleSelectCharVersion(asset.id, path)}
                  onDeleteVersion={path => handleDeleteVersion('characters', asset.id, path)}
                  onToggleEdit={() => startEdit(asset.id)}
                  onSaveEdit={() => saveEdit(asset.id)}
                  onCancelEdit={() => cancelEdit(asset.id)}
                  onUploadImage={file => handleUploadImage('characters', asset.id, file)}
                  onPickFromLibrary={() => setLibraryTarget({ type: 'characters', id: asset.id })}
                  isStageRunning={state.status === 'running'}
                  isRegenerating={regeneratingIds.has(asset.id)}
                  isUploading={uploadingIds.has(asset.id)}
                />
              ))}
            </div>
          </section>
        )}
        {/* ═══ 场景列表 ═══ */}
        {hasSets && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-muted" />
              <h3 className=" font-semibold text-ink text-base leading-6">场景 ({settingsData.length})</h3>
            </div>
            <div className="space-y-3">
              {settingsData.map(asset => (
                <AssetRow
                  key={asset.id}
                  asset={{ ...asset, selected: getSetSelected(asset) }}
                  type="setting"
                  isEditing={editingIds.has(asset.id)}
                  editDesc={editSets[asset.id] || asset.description}
                  onDescChange={val => setEditSets(prev => ({ ...prev, [asset.id]: val }))}
                  onRegenerate={() => handleRegenerate('settings', asset.id)}
                  onSelectVersion={path => handleSelectSetVersion(asset.id, path)}
                  onDeleteVersion={path => handleDeleteVersion('settings', asset.id, path)}
                  onToggleEdit={() => startEdit(asset.id)}
                  onSaveEdit={() => saveEdit(asset.id)}
                  onCancelEdit={() => cancelEdit(asset.id)}
                  onUploadImage={file => handleUploadImage('settings', asset.id, file)}
                  onPickFromLibrary={() => setLibraryTarget({ type: 'settings', id: asset.id })}
                  isStageRunning={state.status === 'running'}
                  isRegenerating={regeneratingIds.has(asset.id)}
                  isUploading={uploadingIds.has(asset.id)}
                />
              ))}
            </div>
          </section>
        )}
        {/* ═══ 道具列表 ═══ */}
        {hasProps && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-muted" />
              <h3 className=" font-semibold text-ink text-base leading-6">道具 ({propsData.length})</h3>
            </div>
            <div className="space-y-3">
              {propsData.map(asset => (
                <AssetRow
                  key={asset.id}
                  asset={{ ...asset, selected: getPropSelected(asset) }}
                  type="prop"
                  isEditing={editingIds.has(asset.id)}
                  editDesc={editProps[asset.id] || asset.description}
                  onDescChange={val => setEditProps(prev => ({ ...prev, [asset.id]: val }))}
                  onRegenerate={() => handleRegenerate('props', asset.id)}
                  onSelectVersion={path => handleSelectPropVersion(asset.id, path)}
                  onDeleteVersion={path => handleDeleteVersion('props', asset.id, path)}
                  onToggleEdit={() => startEdit(asset.id)}
                  onSaveEdit={() => saveEdit(asset.id)}
                  onCancelEdit={() => cancelEdit(asset.id)}
                  onUploadImage={file => handleUploadImage('props', asset.id, file)}
                  onPickFromLibrary={() => setLibraryTarget({ type: 'props', id: asset.id })}
                  isStageRunning={state.status === 'running'}
                  isRegenerating={regeneratingIds.has(asset.id)}
                  isUploading={uploadingIds.has(asset.id)}
                />
              ))}
            </div>
          </section>
        )}
        {state.status === 'pending' && (
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
        stageId="character_design"
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
