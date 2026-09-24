'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Dialog } from '@/components/ui/Overlay';
import { assetUrl } from './utils';

interface ImageLightboxProps { images: string[]; initialIndex: number; onClose: () => void }

export default function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps) {
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, images.length - 1)));
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const current = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  const resetView = useCallback(() => { setScale(1); setTranslate({ x: 0, y: 0 }); setDragging(false); }, []);
  const goPrev = useCallback(() => { if (hasPrev) { setIndex(value => value - 1); resetView(); } }, [hasPrev, resetView]);
  const goNext = useCallback(() => { if (hasNext) { setIndex(value => value + 1); resetView(); } }, [hasNext, resetView]);
  const zoomIn = useCallback(() => setScale(value => Math.min(value * 1.5, 5)), []);
  const zoomOut = useCallback(() => {
    setScale(value => Math.max(value / 1.5, 1));
    setTranslate({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      switch (event.key) {
        case 'ArrowLeft': event.preventDefault(); goPrev(); break;
        case 'ArrowRight': event.preventDefault(); goNext(); break;
        case '+': case '=': event.preventDefault(); zoomIn(); break;
        case '-': event.preventDefault(); zoomOut(); break;
        case '0': event.preventDefault(); resetView(); break;
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [goPrev, goNext, zoomIn, zoomOut, resetView]);

  const viewport = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setScale(value => Math.max(1, Math.min(event.deltaY < 0 ? value * 1.15 : value / 1.15, 5)));
      if (event.deltaY > 0) setTranslate({ x: 0, y: 0 });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);

  return (
    <Dialog open onClose={onClose} title={`图片预览${images.length > 1 ? ` · ${index + 1} / ${images.length}` : ''}`} className="ui-lightbox" footer={<div className="w-full flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={zoomOut} disabled={scale <= 1} className="ui-icon-button" aria-label="缩小图片" title="缩小 (-)"><ZoomOut size={17} /></button>
        <span className="w-12 text-center text-xs text-muted" aria-live="polite">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={zoomIn} disabled={scale >= 5} className="ui-icon-button" aria-label="放大图片" title="放大 (+)"><ZoomIn size={17} /></button>
        <button type="button" onClick={resetView} className="ui-icon-button" aria-label="重置缩放和位置" title="重置 (0)"><RotateCcw size={17} /></button>
      </div>
      {images.length > 1 && <div className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain p-2" aria-label="切换预览图片">
        {images.map((path, imageIndex) => <button type="button" key={`${path}-${imageIndex}`} onClick={() => { setIndex(imageIndex); resetView(); }} aria-label={`查看第 ${imageIndex + 1} 张图片`} aria-pressed={imageIndex === index} className={`w-10 h-10 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${imageIndex === index ? 'border-accent-line' : 'border-transparent opacity-60 hover:opacity-100'}`}><img src={assetUrl(path)} alt="" className="w-full h-full object-cover" /></button>)}
      </div>}
    </div>}>
      <div className="ui-lightbox-stage relative flex items-center justify-center overflow-hidden">
        {hasPrev && <button type="button" onClick={goPrev} className="ui-icon-button absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-canvas/80" aria-label="上一张图片"><ChevronLeft size={24} /></button>}
        {hasNext && <button type="button" onClick={goNext} className="ui-icon-button absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-canvas/80" aria-label="下一张图片"><ChevronRight size={24} /></button>}
        <div ref={viewport} className="w-full h-full flex items-center justify-center select-none touch-none" style={{ cursor: scale > 1 ? dragging ? 'grabbing' : 'grab' : 'zoom-in' }}
          onPointerDown={event => { if (scale <= 1) return; setDragging(true); setDragStart({ x: event.clientX - translate.x, y: event.clientY - translate.y }); event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={event => { if (dragging) setTranslate({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y }); }}
          onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
          {current ? <img src={assetUrl(current)} alt={`预览图片 ${index + 1}`} className="max-w-full max-h-full object-contain" style={{ transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`, transition: dragging ? 'none' : 'transform 0.2s ease' }} draggable={false} onClick={() => { if (scale === 1) zoomIn(); }} /> : <p className="text-sm text-muted">没有可预览的图片</p>}
        </div>
      </div>
    </Dialog>
  );
}
