'use client';
import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Film, Clock, MapPin, Users, Edit3, Save, X,
  LayoutList, Camera, ChevronDown, ChevronRight,
  AlertCircle, Clapperboard
} from 'lucide-react';
import type { StageViewProps } from './types';
import StageActions from './StageActions';
import StageProgress from './StageProgress';
import { useToast } from '@/components/ui/Feedback';
// ─── 类型定义 ───
interface Shot {
  shot_number: number;
  shot_type: string;
  duration: number;
  content: string;
}
interface Segment {
  segment_id: string;
  segment_number: number;
  episode_number: number;
  location: string;
  characters: string[];
  total_duration: number;
  shots: Shot[];
}
interface Episode {
  episode_number: number;
  episode_title: string;
  segments: Segment[];
}
// ─── 样式常量 ───
const SHOT_TYPE_DECOR = {
  '远景': { bg: 'bg-surface-soft', text: 'text-muted', border: 'border-line' },
  '中景': { bg: 'bg-surface-soft', text: 'text-muted', border: 'border-line' },
  '近景': { bg: 'bg-surface-soft', text: 'text-muted', border: 'border-line' },
  '过肩近景': { bg: 'bg-surface-soft', text: 'text-muted', border: 'border-line' },
  '特写': { bg: 'bg-surface-soft', text: 'text-muted', border: 'border-line' },
};
// ─── 主组件 ───
export default function StoryboardStage({
  state,
  onConfirm,
  onIntervene,
  onRegenerate,
  showConfirm,
  isRunning,
  hasPendingItems,
  hasNextStageStarted
}: StageViewProps) {
  const toast = useToast();
  const artifactData = state.artifact;
  // 获取剧集数据 (新结构)
  const episodes: Episode[] = useMemo(() => {
    if (Array.isArray(artifactData?.episodes)) return artifactData.episodes;
    if (artifactData?.payload?.episodes) return artifactData.payload.episodes;
    return [];
  }, [artifactData]);
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<'structured' | 'raw'>('structured');
  const [editEpisodes, setEditEpisodes] = useState<Episode[]>([]);
  const [rawJson, setRawJson] = useState('');
  // ─── 编辑逻辑 ───
  const startEdit = useCallback(() => {
    setEditEpisodes(JSON.parse(JSON.stringify(episodes)));
    setRawJson(JSON.stringify(episodes, null, 2));
    setIsEditing(true);
    setEditMode('structured');
  }, [episodes]);
  const cancelEdit = useCallback(() => setIsEditing(false), []);
  const handleSave = useCallback(() => {
    let finalEpisodes: Episode[];
    if (editMode === 'raw') {
      try {
        finalEpisodes = JSON.parse(rawJson);
        if (!Array.isArray(finalEpisodes)) {
          toast('分镜 JSON 必须是剧集数组，请保留最外层方括号。输入内容已保留。', 'error');
          return;
        }
      } catch {
        toast('JSON 格式有误，请检查引号、逗号和括号后再保存。输入内容已保留。', 'error');
        return;
      }
    } else {
      finalEpisodes = editEpisodes;
    }
    onIntervene({ modified_storyboard: finalEpisodes });
    setIsEditing(false);
  }, [editMode, rawJson, editEpisodes, onIntervene, toast]);
  const switchEditMode = (mode: 'structured' | 'raw') => {
    if (mode === editMode) return;
    if (mode === 'raw') {
      setRawJson(JSON.stringify(editEpisodes, null, 2));
    } else {
      try {
        const parsed = JSON.parse(rawJson);
        if (!Array.isArray(parsed)) {
          toast('分镜 JSON 必须是剧集数组，请保留最外层方括号。输入内容已保留。', 'error');
          return;
        }
        setEditEpisodes(parsed);
      } catch {
        toast('JSON 格式有误，请检查引号、逗号和括号后再切换编辑模式。输入内容已保留。', 'error');
        return;
      }
    }
    setEditMode(mode);
  };
  const updateSegmentField = (epIdx: number, segIdx: number, field: keyof Segment, value: any) => {
    setEditEpisodes(prev => prev.map((ep, i) => {
      if (i !== epIdx) return ep;
      const newSegments = ep.segments.map((s, j) => j === segIdx ? { ...s, [field]: value } : s);
      return { ...ep, segments: newSegments };
    }));
  };
  const updateShotField = (epIdx: number, segIdx: number, shotIdx: number, field: keyof Shot, value: any) => {
    setEditEpisodes(prev => prev.map((ep, i) => {
      if (i !== epIdx) return ep;
      const newSegments = ep.segments.map((seg, j) => {
        if (j !== segIdx) return seg;
        const newShots = seg.shots.map((shot, k) => k === shotIdx ? { ...shot, [field]: value } : shot);
        const newTotal = newShots.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
        return { ...seg, shots: newShots, total_duration: newTotal };
      });
      return { ...ep, segments: newSegments };
    }));
  };
  const addShot = (epIdx: number, segIdx: number) => {
    setEditEpisodes(prev => prev.map((ep, i) => {
      if (i !== epIdx) return ep;
      const newSegments = ep.segments.map((seg, j) => {
        if (j !== segIdx) return seg;
        const newShot: Shot = { shot_number: seg.shots.length + 1, shot_type: '近景', duration: 5, content: '' };
        return { ...seg, shots: [...seg.shots, newShot], total_duration: seg.total_duration + 5 };
      });
      return { ...ep, segments: newSegments };
    }));
  };
  const deleteShot = (epIdx: number, segIdx: number, shotIdx: number) => {
    setEditEpisodes(prev => prev.map((ep, i) => {
      if (i !== epIdx) return ep;
      const newSegments = ep.segments.map((seg, j) => {
        if (j !== segIdx) return seg;
        const newShots = seg.shots.filter((_, k) => k !== shotIdx);
        const newTotal = newShots.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
        return { ...seg, shots: newShots.map((s, idx) => ({...s, shot_number: idx + 1})), total_duration: newTotal };
      });
      return { ...ep, segments: newSegments };
    }));
  };
  // ─── 渲染部分 ───
  const episodesToRender = isEditing ? editEpisodes : episodes;
  const hasEpisodes = episodes.length > 0;
  // 计算统计数据
  const stats = useMemo(() => {
    if (!episodesToRender.length) return { episodes: 0, segments: 0, duration: 0 };
    let totalSegments = 0;
    let totalDuration = 0;
    episodesToRender.forEach(ep => {
      const segs = ep.segments || [];
      totalSegments += segs.length;
      segs.forEach(seg => {
        totalDuration += (seg.total_duration || 0);
      });
    });
    return {
      episodes: episodesToRender.length,
      segments: totalSegments,
      duration: totalDuration
    };
  }, [episodesToRender]);
  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="xyq-stage-content flex-1 min-w-0 custom-scrollbar">
        {/* 标题栏 */}
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-6">
          <div className="flex min-w-0 flex-col">
            <h2 className=" font-semibold text-ink text-2xl leading-8">分镜脚本</h2>
            <p className="text-sm leading-[22px] text-muted">
              生成分段分镜脚本 (景别·时长·叙事内容) 以及指导性的视觉流转设计
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {hasEpisodes && !isEditing && (
              <div className="flex flex-wrap items-center min-h-12 gap-3 sm:gap-4 px-4 sm:px-4 py-2 bg-accent-soft rounded-2xl border border-accent-line ">
                <div className="flex items-center gap-2">
                  <Film className="w-3.5 h-3.5 text-accent" />
                  <span className="text-sm leading-[22px] text-accent font-semibold whitespace-nowrap">总计 {stats.episodes} 集</span>
                </div>
                <div className="w-px h-6 bg-accent-soft" />
                <div className="flex items-center gap-2">
                  <Clapperboard className="w-3.5 h-3.5 text-accent" />
                  <span className="text-sm leading-[22px] text-accent font-semibold whitespace-nowrap">{stats.segments} 段分镜</span>
                </div>
                <div className="w-px h-6 bg-accent-soft" />
                <div className="flex items-center gap-2 px-1">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  <span className="text-sm leading-[22px] text-accent font-semibold whitespace-nowrap">预计时长 {stats.duration}s</span>
                </div>
              </div>
            )}
            {isEditing && (
              <div className="flex items-center gap-2">
                <div className="bg-surface-soft p-1 rounded-lg flex items-center mr-2">
                  <button onClick={() => switchEditMode('structured')} className={`px-2 py-0 text-xs leading-[18px] font-medium rounded-lg transition-all h-9 ui-control ${editMode === 'structured' ? 'bg-surface text-accent ' : 'text-muted'}`}>可视化</button>
                  <button onClick={() => switchEditMode('raw')} className={`px-2 py-0 text-xs leading-[18px] font-medium rounded-lg transition-all h-9 ui-control ${editMode === 'raw' ? 'bg-surface text-accent ' : 'text-muted'}`}>JSON</button>
                </div>
                <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-0 rounded-lg text-xs leading-[18px] font-medium text-muted hover:bg-surface-soft h-9 ui-control">
                  <X className="w-3.5 h-3.5" />取消
                </button>
                <button onClick={handleSave} className="flex items-center gap-1 px-3 py-0 rounded-lg text-xs leading-[18px] font-medium text-on-action bg-action hover:bg-action h-9 ui-control">
                  <Save className="w-3.5 h-3.5" />保存
                </button>
              </div>
            )}
          </div>
        </div>
        {/* 进度提示 */}
        {isRunning && state.progress < 100 && (
          <StageProgress message={state.progressMessage} progress={state.progress} color="violet" />
        )}
        {/* 主体内容 */}
        {!hasEpisodes && !isRunning && !isEditing ? (
          <div className="flex flex-col items-center justify-center py-8 text-subtle">
            <Film className="w-12 h-12 text-subtle mb-4" />
            <p className="text-xs leading-[18px]">等待生成分镜剧本...</p>
          </div>
        ) : isEditing && editMode === 'raw' ? (
          <div className="h-[500px] bg-subtle rounded-2xl overflow-hidden border border-line-strong">
            <textarea
              className="w-full h-full bg-transparent text-subtle p-6 font-mono text-sm leading-[22px] resize-none focus:outline-none"
              aria-label="分镜脚本 JSON"
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="space-y-8">
            {episodesToRender.map((episode, epIdx) => {
              const segs = episode.segments || [];
              const epTotalTime = segs.reduce((sum, s) => sum + (s.total_duration || 0), 0);
              return (
                <div key={epIdx} className="space-y-4">
                  {/* 一级：剧集抬头 (参考第一阶段) */}
                  <div className="flex items-center justify-between py-2 px-1 border-b border-line">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-action rounded-lg" />
                      <h3 className=" font-semibold text-ink text-base leading-6">第 {String(episode.episode_number)} 集：{episode.episode_title}</h3>
                    </div>
                    <span className="text-xs leading-[18px] text-accent font-medium bg-accent-soft px-3 py-1 rounded-lg border border-accent-line flex items-center gap-1 ">
                      <Clock className="w-3 h-3" /> 总计 {epTotalTime}s
                    </span>
                  </div>
                  {/* 二级：拍摄分段 */}
                  <div className="space-y-8 pl-1">
                    {segs.map((segment, segIdx) => (
                      <div key={segment.segment_id} className="space-y-3">
                        <div className="flex items-center justify-between bg-surface/50 rounded-lg px-4 py-2 border border-line">
                          <div className="flex items-center gap-6">
                            <span className="text-xs leading-[18px] font-semibold text-subtle">#{segment.segment_number}</span>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-subtle" />
                              <span className="text-sm leading-[22px] font-semibold text-ink">
                                {isEditing ? (
                                  <input
                                    aria-label={`第 ${segment.segment_number} 段场景地点`}
                                    value={segment.location || ''}
                                    onChange={e => updateSegmentField(epIdx, segIdx, 'location', e.target.value)}
                                    className="bg-transparent border-b border-line focus:border-accent outline-none px-1 h-9 ui-control"
                                  />
                                ) : (segment.location || '未知地点')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-subtle" />
                              <div className="flex gap-2">
                                {(segment.characters || []).map((c, i) => (
                                  <span key={i} className="px-2 py-1 bg-surface border border-line text-xs leading-[18px] text-muted rounded-lg font-semibold">{c}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs leading-[18px] font-semibold text-accent bg-accent-soft px-3 py-1 rounded-lg">{segment.total_duration}s</span>
                        </div>
                        {/* 三级：分镜表格 */}
                        <div className="ml-8 border border-line rounded-2xl overflow-hidden bg-surface">
                          <table className="w-full text-left">
                            <thead className="bg-surface/50 border-b border-line">
                              <tr className="text-[12px] font-semibold text-muted uppercase ">
                                <th className="px-4 py-2 w-10 text-center">#</th>
                                <th className="px-4 py-2 w-24 text-center">景别</th>
                                <th className="px-4 py-2 w-20 text-center">时长</th>
                                <th className="px-4 py-2">分镜内容描述</th>
                                {isEditing && <th className="px-4 py-2 w-10"></th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {(segment.shots || []).map((shot, sIdx) => {
                                const decor = SHOT_TYPE_DECOR[shot.shot_type as keyof typeof SHOT_TYPE_DECOR] || SHOT_TYPE_DECOR['近景'];
                                return (
                                  <tr key={sIdx} className="group hover:bg-surface/30 transition-colors">
                                    <td className="px-4 py-3 text-center text-xs leading-[18px] font-mono text-subtle">{shot.shot_number}</td>
                                    <td className="px-4 py-3 text-center">
                                      {isEditing ? (
                                        <select
                                          aria-label={`第 ${shot.shot_number} 个分镜景别`}
                                          value={shot.shot_type}
                                          onChange={e => updateShotField(epIdx, segIdx, sIdx, 'shot_type', e.target.value)}
                                          className="w-full bg-surface border border-line rounded-lg text-xs leading-[18px] font-semibold py-0 px-1 outline-none focus:ring-1 focus:ring-accent-line h-9 ui-control"
                                        >
                                          {Object.keys(SHOT_TYPE_DECOR).map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                      ) : (
                                        <span className={`px-2 py-1 rounded-lg text-xs leading-[18px] font-semibold ${decor.bg} ${decor.text}`}>{shot.shot_type}</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          aria-label={`第 ${shot.shot_number} 个分镜时长（秒）`}
                                          value={shot.duration}
                                          onChange={e => updateShotField(epIdx, segIdx, sIdx, 'duration', Number(e.target.value))}
                                          className="w-12 bg-surface border border-line rounded-lg text-xs leading-[18px] font-mono py-0 px-1 text-center focus:ring-1 focus:ring-accent-line outline-none h-9 ui-control"
                                        />
                                      ) : (
                                        <span className="text-xs leading-[18px] font-mono text-muted">{shot.duration}s</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {isEditing ? (
                                        <textarea
                                          aria-label={`第 ${shot.shot_number} 个分镜内容`}
                                          value={shot.content}
                                          onChange={e => updateShotField(epIdx, segIdx, sIdx, 'content', e.target.value)}
                                          rows={1}
                                          className="w-full bg-surface border border-transparent rounded-lg px-2 py-1 text-sm leading-[22px] text-ink focus:bg-surface focus:border-accent-line outline-none resize-none"
                                        />
                                      ) : (
                                        <p className="text-sm leading-[22px] text-ink font-semibold">{shot.content}</p>
                                      )}
                                    </td>
                                    {isEditing && (
                                      <td className="px-2 py-3">
                                        <button aria-label={`删除第 ${shot.shot_number} 个分镜`} onClick={() => deleteShot(epIdx, segIdx, sIdx)} className="p-1 text-subtle hover:text-danger transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 h-9 ui-control">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                              {isEditing && (
                                <tr>
                                  <td colSpan={5} className="p-2">
                                    <button onClick={() => addShot(epIdx, segIdx)} className="w-full py-0 border border-dashed border-line rounded-lg text-subtle text-xs leading-[18px] font-semibold hover:bg-accent-soft hover:text-accent transition-all flex items-center justify-center gap-1 h-9 ui-control">
                                      <Plus className="w-3 h-3" /> 插入新分镜点
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* 底部确认操作 (参考第二阶段 StageActions 放在底部) */}
      <StageActions
        status={state.status}
        onConfirm={onConfirm}
        onEdit={!isEditing ? startEdit : undefined}
        onSave={isEditing ? handleSave : undefined}
        onRegenerate={onRegenerate}
        showConfirm={showConfirm}
        isRunning={isRunning}
        hasPendingItems={hasPendingItems}
        hasNextStageStarted={hasNextStageStarted}
        stageId="storyboard"
      />
      <style jsx global>{`
 .custom-scrollbar::-webkit-scrollbar { width: 5px; }
 .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
 .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--lp-border-strong); border-radius: 10px; }
 .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--lp-text-subtle); }
 `}</style>
    </div>
  );
}
