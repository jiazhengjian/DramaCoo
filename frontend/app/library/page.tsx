'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import { deleteLibraryAsset, fetchLibrary, uploadToLibrary, type AssetItem } from '@/lib/workflowApi';
import { assetUrl } from '@/components/stages/utils';
import PageHeader from '@/components/PageHeader';
import { useConfirm, useToast } from '@/components/ui/Feedback';

const TYPE_LABELS: Record<string, string> = { character: '角色', setting: '场景', scene: '参考图', prop: '道具', video_clip: '视频片段', final_video: '成片', upload: '手动上传' };

export default function LibraryPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [mediaType, setMediaType] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetchLibrary().then(items => { if (active) setAssets(items); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '素材加载失败'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const retry = () => { setError(''); setLoading(true); setAttempt(value => value + 1); };

  const onUpload = async (files: FileList | null) => {
    if (!files?.length || uploading) return;
    setUploading(true);
    let succeeded = 0;
    let failed = 0;
    for (const file of Array.from(files)) {
      try { await uploadToLibrary(file); succeeded += 1; }
      catch { failed += 1; }
    }
    if (succeeded) {
      toast(`${succeeded} 个素材已上传`, 'success');
      retry();
    }
    if (failed) toast(`${failed} 个素材上传失败，请检查文件格式后重试`, 'error');
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };
  const onDelete = async (asset: AssetItem) => {
    if (deleting.has(asset.id)) return;
    if (!await confirm({ title: '删除素材', description: `确定从素材库删除「${asset.name}」？删除后无法恢复。`, confirmLabel: '删除素材', danger: true })) return;
    setDeleting(current => new Set(current).add(asset.id));
    try {
      await deleteLibraryAsset(asset.id);
      setAssets(current => current.filter(item => item.id !== asset.id));
      toast('素材已删除', 'success');
    } catch { toast('删除失败，请重试', 'error'); }
    finally { setDeleting(current => { const next = new Set(current); next.delete(asset.id); return next; }); }
  };
  const filtered = assets.filter(asset => (!mediaType || asset.media_type === mediaType) && (!search.trim() || asset.name.toLowerCase().includes(search.trim().toLowerCase())));
  const groups: Record<string, AssetItem[]> = {};
  for (const asset of filtered) (groups[asset.asset_type] ||= []).push(asset);

  return (
    <div className="xyq-route">
      <main className="xyq-page">
        <PageHeader title="素材库" description="汇集创作素材，在不同项目间轻松复用。" actions={<button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="ui-button ui-button-primary">{uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}{uploading ? '正在上传' : '上传素材'}</button>} />
        <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/bmp,video/mp4,video/quicktime,video/webm" className="hidden" onChange={event => onUpload(event.target.files)} />
        <div className="ui-page-toolbar">
          <div className="ui-segmented" aria-label="素材类型">{[['', '全部素材'], ['image', '图片'], ['video', '视频']].map(([value, label]) => <button type="button" key={value} onClick={() => setMediaType(value)} aria-pressed={mediaType === value}>{label}</button>)}</div>
          <label className="ui-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索素材" aria-label="搜索素材" /></label>
        </div>
        {loading ? <><div className="sr-only" role="status">正在加载素材</div><div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <div key={index} className="ui-skeleton aspect-square rounded-xl" />)}</div></>
          : error ? <div className="ui-state" role="alert"><ImagePlus size={32} /><h2>暂时无法加载素材</h2><p>{error}</p><button type="button" className="ui-button" onClick={retry}><RefreshCw size={15} />重新加载</button></div>
          : filtered.length === 0 ? <div className="ui-state"><ImagePlus size={34} /><h2>{search || mediaType ? '暂无匹配的素材' : '收藏你的创作素材'}</h2><p>{search || mediaType ? '调整筛选条件，或上传新的素材。' : '上传图片或视频，也可以在创作时将喜欢的内容添加到素材库。'}</p><button type="button" className="ui-button ui-button-primary" disabled={uploading} onClick={() => fileRef.current?.click()}><Upload size={16} />上传素材</button></div>
          : Object.entries(groups).map(([type, items]) => <section key={type} className="mb-6">
            <h2 className="text-sm font-medium text-muted mb-4">{TYPE_LABELS[type] || type}<span className="ml-2 text-subtle">{items.length}</span></h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {items.map(asset => <article key={asset.id} className="group min-w-0 rounded-2xl border border-line bg-surface p-2">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-soft">
                  {asset.media_type === 'image' ? <img src={assetUrl(asset.thumb_path || asset.file_path)} alt={asset.name} className="w-full h-full object-cover" onError={event => {
                    const image = event.currentTarget;
                    if (!image.dataset.fallback) { image.dataset.fallback = '1'; image.src = assetUrl(asset.file_path); }
                  }} /> : <video src={assetUrl(asset.file_path)} poster={assetUrl(asset.thumb_path || '')} className="w-full h-full object-cover" preload="metadata" controls aria-label={asset.name} />}
                  <button type="button" onClick={() => onDelete(asset)} disabled={deleting.has(asset.id)} className="ui-icon-button absolute top-2 right-2 bg-canvas/80 text-ink" aria-label={`删除素材 ${asset.name}`}>{deleting.has(asset.id) ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}</button>
                </div>
                <h3 className="text-xs text-muted truncate mt-2" title={asset.name}>{asset.name}</h3>
              </article>)}
            </div>
          </section>)}
      </main>
    </div>
  );
}
