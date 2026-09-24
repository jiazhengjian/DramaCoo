'use client';
import React from 'react';
import { Download, Film } from 'lucide-react';
import type { StageViewProps } from './types';
import { assetUrl } from './utils';
import StageProgress from './StageProgress';
import StageActions from './StageActions';
export default function PostProductionStage({ state, onConfirm, onRegenerate, showConfirm, isRunning, hasPendingItems, hasNextStageStarted, artifacts, scriptArtifact }: StageViewProps) {
  // 提取最终视频列表
  const finalVideos: any[] = state.artifact?.final_videos || [];
  // 兼容旧格式及其变形
  const legacyVideo = state.artifact?.final_video;
  // 从剧本或分镜数据中提取剧集名称映射
  const episodeTitleMap = React.useMemo(() => {
    // 优先从 scriptArtifact 获取
    const episodes = scriptArtifact?.episodes || artifacts?.storyboard?.episodes || artifacts?.script?.episodes || [];
    const map: Record<number, string> = {};
    episodes.forEach((ep: any) => {
      const epNum = ep.episode_number || ep.episode;
      if (epNum) {
        map[Number(epNum)] = ep.act_title || ep.title || '';
      }
    });
    return map;
  }, [artifacts, scriptArtifact]);
  // 确保能拿到展示数据
  const videosToDisplay = React.useMemo(() => {
    if (finalVideos && finalVideos.length > 0) return finalVideos;
    if (legacyVideo) return [{ name: '最终成片', path: legacyVideo, episode: 1 }];
    return [];
  }, [finalVideos, legacyVideo]);
  return (
    <div className="flex flex-col h-full">
      <div className="xyq-stage-content flex-1 min-w-0">
        <h2 className=" font-semibold text-ink mb-1 text-2xl leading-8">视频合成</h2>
        <p className="text-sm leading-[22px] text-muted mb-6">按剧集拼接视频，生成各集独立成片</p>
        {/* 运行中 */}
        {state.status === 'running' && (
          <StageProgress message={state.progressMessage} fallback="正在合成视频..." progress={state.progress} color="cyan" />
        )}
        {state.error && (
          <div className="text-sm leading-[22px] text-danger bg-danger-soft border border-danger-line p-4 rounded-2xl mb-4">{state.error}</div>
        )}
        {/* 最终视频列表 */}
        {videosToDisplay.length > 0 && (
          <div className="space-y-8 pb-8">
            {videosToDisplay.map((video, idx) => {
              const epNum = video.episode || (idx + 1);
              const scriptTitle = episodeTitleMap[epNum];
              const epTitle = scriptTitle ? `第 ${epNum} 集：${scriptTitle}` : (video.name || `第 ${epNum} 集`);
              return (
                <div key={idx} className="space-y-4">
                  {/* 剧集分割行 - 完全同步 S4/S5 格式 */}
                  <div className="flex flex-wrap items-center justify-between gap-3 py-2 px-1 border-b border-line">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="w-1.5 h-6 bg-info rounded-lg" />
                      <h3 className="min-w-0 font-semibold text-ink text-base leading-6">{epTitle}</h3>
                    </div>
                  </div>
                  <div className="bg-black rounded-2xl overflow-hidden border border-line-strong">
                    <video
                      src={assetUrl(video.path)}
                      controls
                      className="w-full max-h-[60vh] object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-end">
                    <a
                      href={assetUrl(video.path)}
                      download={`${epTitle}.mp4`}
                      className="flex items-center gap-2 px-4 py-2 bg-action text-on-action rounded-lg text-xs leading-[18px] font-medium hover:bg-action-hover transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      下载本集
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {state.status === 'completed' && videosToDisplay.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-subtle">
            <Film className="w-12 h-12 mb-3" />
            <div className="text-sm leading-[22px]">视频合成完成</div>
          </div>
        )}
        {state.status === 'pending' && (
          <div className="text-center text-subtle text-sm leading-[22px] py-8">等待上一阶段完成...</div>
        )}
      </div>
      <StageActions
        status={state.status}
        onConfirm={onConfirm}
        showConfirm={false}
        onRegenerate={onRegenerate}
        stageId="post_production"
        hasPendingItems={hasPendingItems}
        hasNextStageStarted={hasNextStageStarted}
        isRunning={isRunning}
      />
    </div>
  );
}
