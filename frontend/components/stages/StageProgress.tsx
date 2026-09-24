'use client';
import React from 'react';
import { Loader } from 'lucide-react';
interface StageProgressProps {
  /** progressMessage from StageState */
  message: string;
  /** fallback text when message is empty */
  fallback?: string;
  /** 0-100 */
  progress: number;
  /** Legacy callers may pass a stage color; running progress uses one shared accent. */
  color?: 'blue' | 'amber' | 'emerald' | 'violet' | 'rose' | 'cyan';
}
export default function StageProgress({
  message,
  fallback = '处理中...',
  progress,
}: StageProgressProps) {
  const p = Math.min(100, Math.max(0, Math.round(progress)));
  // Extract step description: progressMessage format is "阶段名: 步骤描述"
  const stepDesc = message?.includes(': ') ? message.split(': ').slice(1).join(': ') : (message || fallback);
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex min-w-0 items-center gap-2 text-sm leading-[22px] font-medium text-muted">
          <Loader className="w-4 h-4 animate-spin" />
          <span className="truncate">{stepDesc}</span>
        </div>
        <span className="text-xs leading-[18px] font-mono tabular-nums text-muted">{p}%</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} aria-label={stepDesc} className="h-2 w-full overflow-hidden rounded-lg bg-surface-soft">
        <div
          className="h-2 rounded-lg bg-accent transition-[width] duration-300"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}
