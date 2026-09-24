'use client';

import { useEffect, useState } from 'react';
import { Check, ImagePlus, Loader2, RefreshCw } from 'lucide-react';
import { fetchLibrary, type AssetItem } from '@/lib/workflowApi';
import { assetUrl } from '@/components/stages/utils';
import { Dialog } from '@/components/ui/Overlay';

/** 从全局素材库选图，选择后仍由调用方处理关闭。 */
export default function LibraryPicker({ onSelect, onClose }: { onSelect: (asset: AssetItem) => void; onClose: () => void }) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchLibrary('', 'image')
      .then(items => { if (active) setAssets(items); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '素材加载失败，请稍后重试'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const retry = () => { setError(''); setLoading(true); setAttempt(value => value + 1); };

  return (
    <Dialog open onClose={onClose} title="从素材库选择" description="选择一张图片，将它添加到当前创作。" className="ui-library-picker">
      {loading ? <div className="ui-state" role="status"><Loader2 className="animate-spin" size={22} /><p>正在加载素材</p></div>
        : error ? <div className="ui-state" role="alert"><p>{error}</p><button type="button" className="ui-button" onClick={retry}><RefreshCw size={15} />重新加载</button></div>
        : assets.length === 0 ? <div className="ui-state"><ImagePlus size={30} /><h3>还没有可用的图片</h3><p>在素材库上传图片，或从项目中收藏素材后，即可在这里选择。</p></div>
        : <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {assets.map(asset => <button key={asset.id} type="button" onClick={() => { setSelected(asset.id); onSelect(asset); }} className="ui-asset-option group text-left min-w-0 rounded-2xl border border-line p-2" aria-label={`选择素材 ${asset.name}`} aria-pressed={selected === asset.id}>
            <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-soft">
              <img src={assetUrl(asset.thumb_path || asset.file_path)} alt={asset.name} className="w-full h-full object-cover" onError={event => {
                const image = event.currentTarget;
                if (!image.dataset.fallback) { image.dataset.fallback = '1'; image.src = assetUrl(asset.file_path); }
              }} />
              {selected === asset.id && <span className="absolute bottom-0 inset-x-0 inline-flex items-center gap-2 bg-canvas/90 p-2 text-xs text-ink"><Check size={12} />已选择</span>}
            </div>
            <span className="block text-xs text-muted truncate mt-2">{asset.name}</span>
          </button>)}
        </div>}
    </Dialog>
  );
}
