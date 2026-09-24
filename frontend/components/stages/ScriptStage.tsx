'use client';
import React, { useState, useCallback } from 'react';
import { Save, X, Code, LayoutList, Users, MapPin, Film, Sparkles, BookOpen, Lightbulb, Target, User, Crosshair, RefreshCw, Palette } from 'lucide-react';
import type { StageViewProps } from './types';
import StageActions from './StageActions';
import StageProgress from './StageProgress';
import { Dialog } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Feedback';
/* ─── 类型 ─── */
interface LoglineData {
  logline: string;
  who: string;
  goal: string;
  conflict: string;
  twist: string;
  theme: string;
}
interface ScriptCharacter {
  name: string;
  character_id?: string;
  description: string;
  personality: string[];
  motivation?: string;
  arc_description?: string;
  role: string;
  age?: string;
  species?: string;
  occupation?: string;
}
interface ScriptSetting {
  name: string;
  description: string;
}
interface ScriptScene {
  scene_number: number;
  act?: number;
  location: string;
  characters: string[];
  plot: string;
}
interface ActCompleteData {
  act: number;
  act_name: string;
  characters: ScriptCharacter[];
  settings: ScriptSetting[];
  scenes: ScriptScene[];
}
interface ScriptEpisode {
  act_number: number;
  act_title: string;
  content: string;
}
interface ScriptData {
  title?: string;
  logline?: string;
  genre?: string[];
  characters?: ScriptCharacter[];
  settings?: ScriptSetting[];
  scenes?: ScriptScene[];
  episodes?: ScriptEpisode[];
  overall_style?: string;
  mood?: string;
  session_id?: string;
  [key: string]: any;
}
/* ─── 角色色彩 ─── */
const ROLE_COLORS: Record<string, string> = {
  '主角': 'bg-surface-soft text-muted',
  'protagonist': 'bg-surface-soft text-muted',
  '配角': 'bg-surface-soft text-muted',
  'supporting': 'bg-surface-soft text-muted',
  '背景': 'bg-surface-soft text-muted',
  'background': 'bg-surface-soft text-muted',
};
/* ─── Logline 六要素展示卡 ─── */
function LoglineSummaryBar({ logline }: { logline: LoglineData }) {
  const items = [
    { icon: Lightbulb, label: 'Logline', value: logline.logline, color: 'text-muted' },
    { icon: User, label: '主角', value: logline.who, color: 'text-muted' },
    { icon: Target, label: '目标', value: logline.goal, color: 'text-muted' },
    { icon: Crosshair, label: '障碍', value: logline.conflict, color: 'text-muted' },
    { icon: RefreshCw, label: '反转', value: logline.twist, color: 'text-muted' },
    { icon: Palette, label: '主题', value: logline.theme, color: 'text-muted' },
  ];
  return (
    <div className="bg-surface border border-line rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-muted" />
        <span className="text-xs leading-[18px] font-semibold text-muted">Logline 核心</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
        {items.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="min-w-0">
            <div className={`flex items-center gap-1 mb-1 ${color}`}>
              <Icon className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs leading-[18px] font-semibold">{label}</span>
            </div>
            <p className="text-xs leading-[18px] text-muted break-words">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
export default function ScriptStage({ state, onConfirm, onIntervene, onRegenerate, onSaveSelections, showConfirm, isRunning, hasPendingItems, hasNextStageStarted }: StageViewProps) {
  const toast = useToast();
  const data: ScriptData = state.artifact || {};
  const isLoglinePhase = data.phase === 'logline_selection' || data.phase === 'logline_confirm' || data.phase === 'mode_selection';
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<'structured' | 'raw'>('structured');
  const [editData, setEditData] = useState<ScriptData>({});
  const [rawText, setRawText] = useState('');
  const [showSmartContinueDialog, setShowSmartContinueDialog] = useState(false);
  const [smartContinueEpisodes, setSmartContinueEpisodes] = useState<number>(1);
  const [smartContinueIdea, setSmartContinueIdea] = useState<string>('');
  const handleSmartContinueConfirm = useCallback(() => {
    onIntervene({
      action: 'smart_continue',
      episodes_to_add: smartContinueEpisodes,
      sequel_idea: smartContinueIdea
    });
    setShowSmartContinueDialog(false);
    setSmartContinueIdea('');
    setSmartContinueEpisodes(1);
  }, [smartContinueEpisodes, smartContinueIdea, onIntervene]);
  const hasContent = Boolean(data.title || data.characters?.length || data.scenes?.length);
  const startEdit = useCallback(() => {
    setEditData(JSON.parse(JSON.stringify(data)));
    setRawText(JSON.stringify(data, null, 2));
    setIsEditing(true);
    setEditMode('structured');
  }, [data]);
  const switchEditMode = useCallback((mode: 'structured' | 'raw') => {
    if (mode === editMode) return;
    if (mode === 'raw') {
      setRawText(JSON.stringify(editData, null, 2));
    } else {
      try {
        const parsed = JSON.parse(rawText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          toast('剧本 JSON 必须是一个对象，请保留原有字段结构。输入内容已保留。', 'error');
          return;
        }
        setEditData(parsed);
      } catch {
        toast('JSON 格式有误，请检查引号、逗号和括号后再切换编辑模式。输入内容已保留。', 'error');
        return;
      }
    }
    setEditMode(mode);
  }, [editMode, editData, rawText, toast]);
  const handleSave = useCallback(() => {
    let finalData: ScriptData;
    if (editMode === 'raw') {
      try {
        finalData = JSON.parse(rawText);
        if (!finalData || typeof finalData !== 'object' || Array.isArray(finalData)) {
          toast('剧本 JSON 必须是一个对象，请保留原有字段结构。输入内容已保留。', 'error');
          return;
        }
      } catch {
        toast('JSON 格式有误，请检查引号、逗号和括号后再保存。输入内容已保留。', 'error');
        return;
      }
    } else {
      finalData = editData;
    }
    onIntervene({ modified_script: finalData });
    setIsEditing(false);
  }, [editMode, rawText, editData, onIntervene, toast]);
  const cancelEdit = useCallback(() => setIsEditing(false), []);
  /* ─── 编辑辅助 ─── */
  const updateField = (field: string, value: any) => setEditData(prev => ({ ...prev, [field]: value }));
  const updateCharacter = (idx: number, patch: Partial<ScriptCharacter>) => {
    setEditData(prev => ({
      ...prev,
      characters: prev.characters?.map((c, i) => i === idx ? { ...c, ...patch } : c),
    }));
  };
  const updateSetting = (idx: number, patch: Partial<ScriptSetting>) => {
    setEditData(prev => ({
      ...prev,
      settings: prev.settings?.map((s, i) => i === idx ? { ...s, ...patch } : s),
    }));
  };
  const updateScene = (idx: number, patch: Partial<ScriptScene>) => {
    setEditData(prev => ({
      ...prev,
      scenes: prev.scenes?.map((s, i) => i === idx ? { ...s, ...patch } : s),
    }));
  };
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="xyq-stage-content flex-1 min-w-0">
        {/* 标题栏 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className=" font-semibold text-ink text-2xl leading-8">剧本</h2>
          {isEditing && (
            <div className="flex gap-1 bg-surface-soft rounded-lg p-1 text-xs leading-[18px]">
              <button onClick={() => switchEditMode('structured')}
                className={`flex items-center gap-2 px-3 py-0 rounded-lg transition-colors h-9 ui-control ${editMode === 'structured' ? 'bg-surface text-muted ' : 'text-muted hover:text-ink'}`}>
                <LayoutList className="w-3.5 h-3.5" />结构编辑
              </button>
              <button onClick={() => switchEditMode('raw')}
                className={`flex items-center gap-2 px-3 py-0 rounded-lg transition-colors h-9 ui-control ${editMode === 'raw' ? 'bg-surface text-muted ' : 'text-muted hover:text-ink'}`}>
                <Code className="w-3.5 h-3.5" />JSON编辑
              </button>
            </div>
          )}
        </div>
        <p className="text-sm leading-[22px] text-muted mb-6">多轮 LLM 交互，生成结构化剧本数据</p>
        {/* 运行中 - 进度条 & 已选 Logline & 增量生成结果 */}
        {state.status === 'running' && (
          <>
            {data.selected_logline && (
              <div className="mb-4">
                <LoglineSummaryBar logline={data.selected_logline as LoglineData} />
              </div>
            )}
            {/* 节拍表展示 */}
            {data.beat_sheet && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-muted" />
                  <h3 className=" font-semibold text-ink text-base leading-6">节拍表 (Beat Sheet)</h3>
                </div>
                <div className="bg-surface border border-line rounded-2xl p-4">
                  <pre className="text-sm leading-[22px] text-muted whitespace-pre-wrap font-sans">{data.beat_sheet as string}</pre>
                </div>
              </div>
            )}
            {/* 逐幕完成的分场结果 */}
            {data.completed_acts && (data.completed_acts as ActCompleteData[]).length > 0 && (
              <div className="mb-4 space-y-4">
                {(data.completed_acts as ActCompleteData[]).map((actData) => (
                  <div key={actData.act}>
                    {/* 幕分隔线 */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-px bg-surface" />
                      <span className="px-3 py-1 bg-surface-soft text-muted text-xs leading-[18px] font-semibold rounded-lg whitespace-nowrap">
                        第{actData.act}幕 — {actData.act_name}
                      </span>
                      <div className="flex-1 h-px bg-surface" />
                    </div>
                    {/* 本幕场景 */}
                    <div className="space-y-2">
                      {actData.scenes.map((sc, i) => (
                        <div key={i} className="bg-surface border border-line rounded-2xl p-4 transition-shadow">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-surface-soft text-muted text-xs leading-[18px] font-semibold flex-shrink-0">{sc.scene_number}</span>
                            <span className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">{sc.location}</span>
                            <div className="flex flex-wrap gap-1">
                              {(sc.characters || []).map((c: any, ci: number) => (
                                <span key={ci} className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">{c}</span>
                              ))}
                            </div>
                          </div>
                          <p className="text-sm leading-[22px] text-muted pl-8">{sc.plot}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <StageProgress message={state.progressMessage} fallback="正在生成剧本..." progress={state.progress} color="blue" />
          </>
        )}
        {/* 错误 */}
        {state.error && (
          <div className="text-sm leading-[22px] text-danger bg-danger-soft border border-danger-line p-4 rounded-2xl mb-4">{state.error}</div>
        )}
        {/* ===== Logline 选择/确认阶段 ===== */}
        {isLoglinePhase && state.status === 'waiting' && (
          <div className="space-y-4">
            {/* 3 个 Logline 选项卡 */}
            {data.phase === 'logline_selection' && data.logline_options && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-muted" />
                  <h3 className=" font-semibold text-ink text-base leading-6">选择一个 Logline 方案</h3>
                  <span className="text-xs leading-[18px] text-subtle">点击卡片以选择</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(data.logline_options as LoglineData[]).map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => onIntervene({ selected_logline: opt })}
                      className="text-left p-4 bg-surface border border-line rounded-2xl hover:border-accent transition-all group cursor-pointer"
                    >
                      <p className="text-sm leading-[22px] font-medium text-ink group-hover:text-muted mb-3 ">
                        {opt.logline}
                      </p>
                      <div className="space-y-2 text-xs leading-[18px] text-muted">
                        <p><span className="text-muted font-medium">主角:</span> {opt.who}</p>
                        <p><span className="text-muted font-medium">目标:</span> {opt.goal}</p>
                        <p><span className="text-muted font-medium">障碍:</span> {opt.conflict}</p>
                        <p><span className="text-muted font-medium">反转:</span> {opt.twist}</p>
                        <p><span className="text-muted font-medium">主题:</span> {opt.theme}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
            {/* 单个 Logline 确认 */}
            {data.phase === 'logline_confirm' && data.logline_summary && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-muted" />
                  <h3 className=" font-semibold text-ink text-base leading-6">Logline 提取结果</h3>
                </div>
                <LoglineSummaryBar logline={data.logline_summary as LoglineData} />
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => onIntervene({ selected_logline: data.logline_summary })}
                    className="flex items-center gap-2 px-4 py-0 bg-action text-on-action rounded-lg text-sm leading-[22px] font-medium hover:bg-action transition-colors h-9 ui-control"
                  >
                    <Sparkles className="w-4 h-4" />
                    确认 Logline 并生成剧本
                  </button>
                </div>
              </>
            )}
            {/* 创作模式选择 */}
            {data.phase === 'mode_selection' && (
              <>
                {data.selected_logline && (
                  <div className="mb-4">
                    <LoglineSummaryBar logline={data.selected_logline as LoglineData} />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <Film className="w-4 h-4 text-muted" />
                  <h3 className=" font-semibold text-ink text-base leading-6">选择创作模式</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <button
                    onClick={() => onIntervene({ selected_mode: 'movie' })}
                    className="text-left p-4 bg-surface border-2 border-line rounded-2xl hover:border-accent transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-surface-soft text-muted text-base leading-6">🎬</span>
                      <span className="text-base leading-6 font-semibold text-ink group-hover:text-muted">电影模式</span>
                    </div>
                    <p className="text-sm leading-[22px] text-muted mb-3">
                      按照四幕结构生成完整情节，叙事连贯丰富，有完整的起承转合。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">四幕结构</span>
                      <span className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">叙事完整</span>
                      <span className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">情节丰富</span>
                    </div>
                  </button>
                  <button
                    onClick={() => onIntervene({ selected_mode: 'micro' })}
                    className="text-left p-4 bg-surface border-2 border-line rounded-2xl hover:border-info transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-surface-soft text-muted text-base leading-6">🎞️</span>
                      <span className="text-base leading-6 font-semibold text-ink group-hover:text-muted">微电影模式</span>
                    </div>
                    <p className="text-sm leading-[22px] text-muted mb-3">
                      所有内容生成在一幕内，叙事节奏快，情节紧凑，适合短片创作。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">单幕结构</span>
                      <span className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">节奏紧凑</span>
                      <span className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">3-6场景</span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {/* ===== 查看模式 ===== */}
        {hasContent && !isEditing && (
          <div className="space-y-8">
            {/* Logline 六要素摘要 */}
            {data.logline_data && (
              <LoglineSummaryBar logline={data.logline_data as LoglineData} />
            )}
            {/* 标题 / Logline / 标签 */}
            {data.title && (
              <section className="bg-surface border border-line rounded-2xl p-4">
                <h3 className=" font-semibold text-ink mb-2 text-base leading-6">{data.title}</h3>
                {data.logline && <p className="text-sm leading-[22px] text-muted mb-3">{data.logline}</p>}
                <div className="flex flex-wrap gap-2">
                  {data.genre?.map((g, i) => (
                    <span key={i} className="px-3 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg font-medium">{g}</span>
                  ))}
                  {data.mood && <span className="px-3 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg font-medium">{data.mood}</span>}
                  {data.overall_style && <span className="px-3 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg font-medium">{data.overall_style}</span>}
                </div>
              </section>
            )}
            {/* 故事梗概 */}
            {data.logline && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-muted" />
                  <h3 className=" font-semibold text-ink text-base leading-6">故事梗概</h3>
                </div>
                <div className="bg-surface border border-line rounded-2xl p-4">
                  <p className="text-sm leading-[22px] text-muted ">{data.logline}</p>
                </div>
              </section>
            )}
            {/* 角色 */}
            {data.characters && data.characters.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-muted" />
                  <h3 className=" font-semibold text-ink text-base leading-6">角色 ({data.characters.length})</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.characters.map((c, i) => (
                    <div key={i} className="bg-surface border border-line rounded-2xl p-4 transition-shadow">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-ink">{c.name}</span>
                        <span className={`px-2 py-1 text-xs leading-[18px] rounded-lg ${ROLE_COLORS[c.role] || 'bg-surface-soft text-muted'}`}>{c.role}</span>
                        {c.species && c.species !== '人类' && c.species !== 'human' && (
                          <span className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">{c.species}</span>
                        )}
                      </div>
                      <p className="text-sm leading-[22px] text-muted mb-2">{c.description}</p>
                      {c.personality && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(Array.isArray(c.personality) ? c.personality : String(c.personality).split(/[,，]/)).map((p: string, pi: number) => (
                            <span key={pi} className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">{p.trim()}</span>
                          ))}
                        </div>
                      )}
                      {c.motivation && <p className="text-xs leading-[18px] text-subtle"><span className="text-muted font-medium">动机:</span> {c.motivation}</p>}
                      {c.arc_description && <p className="text-xs leading-[18px] text-subtle"><span className="text-muted font-medium">成长:</span> {c.arc_description}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* 场景设置 */}
            {data.settings && data.settings.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-muted" />
                  <h3 className=" font-semibold text-ink text-base leading-6">场景 ({data.settings.length})</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.settings.map((s, i) => (
                    <div key={i} className="bg-surface border border-line rounded-2xl p-4 transition-shadow">
                      <div className="font-medium text-ink mb-1">{s.name}</div>
                      <p className="text-sm leading-[22px] text-muted ">{s.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* 故事线 */}
            {data.episodes && data.episodes.length > 0 ? (
          <section className="bg-surface p-4 rounded-2xl border border-line">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-muted" />
                <h3 className=" font-semibold text-ink text-base leading-6">分集剧本</h3>
              </div>
            </div>
            <div className="space-y-6">
              {data.episodes.map((ep, i) => (
                <div key={i} className="bg-surface border border-line rounded-2xl overflow-hidden transition-shadow">
                  <div className="bg-surface px-4 py-3 border-b border-line flex items-center justify-between">
                    <h4 className="font-semibold text-ink text-base leading-6">第 {ep.act_number || (i + 1)} 集：{ep.act_title}</h4>
                    <span className="text-xs leading-[18px] font-semibold text-muted bg-surface-soft px-2 py-1 rounded-lg uppercase ">Episode {ep.act_number || (i + 1)}</span>
                  </div>
                  <div className="p-4 text-ink whitespace-pre-wrap text-sm leading-[22px]">
                    {ep.content}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : data.scenes && data.scenes.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Film className="w-4 h-4 text-muted" />
                  <h3 className=" font-semibold text-ink text-base leading-6">故事线 ({data.scenes.length} 场)</h3>
                </div>
                <div className="space-y-3">
                  {data.scenes.map((sc, i) => {
                    // 幕分隔线：当场景有 act 字段，且是第一场或与上一场不同幕时显示
                    const showActSep = sc.act != null && (i === 0 || data.scenes![i - 1].act !== sc.act);
                    const actNames: Record<number, string> = { 1: '激励事件', 2: '进入新世界', 3: '灵魂黑夜', 4: '高潮决战' };
                    return (
                      <React.Fragment key={i}>
                        {showActSep && (
                          <div className="flex items-center gap-3 pt-2">
                            <div className="flex-1 h-px bg-surface" />
                            <span className="px-3 py-1 bg-surface-soft text-muted text-xs leading-[18px] font-semibold rounded-lg whitespace-nowrap">
                              第{sc.act}幕 — {actNames[sc.act!] || ''}
                            </span>
                            <div className="flex-1 h-px bg-surface" />
                          </div>
                        )}
                        <div className="bg-surface border border-line rounded-2xl p-4 transition-shadow">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-surface-soft text-muted text-xs leading-[18px] font-semibold flex-shrink-0">{sc.scene_number}</span>
                            <span className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">{sc.location}</span>
                            <div className="flex flex-wrap gap-1">
                              {(sc.characters || []).map((c: any, ci: number) => (
                                <span key={ci} className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">{c}</span>
                              ))}
                            </div>
                          </div>
                          <p className="text-sm leading-[22px] text-muted pl-8">{sc.plot}</p>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </section>
            )}
            {/* ===== 智能续写 UI ===== */}
            {!data.new_episodes || data.new_episodes.length === 0 ? (
              data.episodes && data.episodes.length > 0 && state.status !== 'running' && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => setShowSmartContinueDialog(true)}
                    className="flex items-center gap-2 px-6 py-0 bg-action text-on-action rounded-lg hover:bg-action-hover transition-all font-medium text-sm leading-[22px] h-9 ui-control"
                  >
                    <Sparkles className="w-4 h-4" />
                    智能续写
                  </button>
                </div>
              )
            ) : (
              <div className="mt-8 space-y-6">
                <div className="relative flex py-4 items-center">
                  <div className="flex-grow border-t border-line border-dashed"></div>
                  <span className="flex-shrink-0 mx-4 text-muted font-semibold text-sm leading-[22px] bg-surface-soft px-4 py-1 rounded-lg ">续集</span>
                  <div className="flex-grow border-t border-line border-dashed"></div>
                </div>
                {data.new_characters && data.new_characters.length > 0 && (
                  <div className="bg-surface-soft p-4 rounded-2xl border border-line flex flex-col gap-3">
                    <h4 className=" font-semibold text-ink flex items-center gap-2 text-base leading-6">
                      <Users className="w-4 h-4" /> 新增角色
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {data.new_characters.map((c: any, i: number) => (
                        <div key={i} className="bg-surface p-3 rounded-lg border border-line flex flex-col gap-1">
                          <div className="font-semibold text-muted text-sm leading-[22px]">{c.name} <span className="text-xs leading-[18px] text-muted font-normal bg-surface-soft px-2 py-1 rounded-lg ml-1">{c.role || '配角'}</span></div>
                          <p className="text-xs leading-[18px] text-muted line-clamp-2 md:line-clamp-none">{c.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.new_settings && data.new_settings.length > 0 && (
                  <div className="bg-surface-soft p-4 rounded-2xl border border-line flex flex-col gap-3">
                    <h4 className=" font-semibold text-ink flex items-center gap-2 text-base leading-6">
                      <MapPin className="w-4 h-4" /> 新增场景
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {data.new_settings.map((s: any, i: number) => (
                        <div key={i} className="bg-surface p-3 rounded-lg border border-line flex flex-col gap-1">
                          <div className="font-semibold text-muted text-sm leading-[22px]">{s.name}</div>
                          <p className="text-xs leading-[18px] text-muted line-clamp-2 md:line-clamp-none">{s.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-6">
                  {data.new_episodes.map((ep: any, i: number) => (
                    <div key={`new-${i}`} className="bg-surface-soft border-2 border-line rounded-2xl overflow-hidden ">
                      <div className="bg-surface px-4 py-3 flex items-center justify-between border-b border-line/50">
                        <h4 className="font-semibold text-ink text-base leading-6">第 {ep.episode_number || (data.episodes ? data.episodes.length + i + 1 : i + 1)} 集：{ep.act_title}</h4>
                        <span className="text-xs leading-[18px] font-semibold text-muted bg-surface-soft/50 px-2 py-1 rounded-lg ">NEW EPISODE</span>
                      </div>
                      <div className="p-4 text-ink whitespace-pre-wrap text-sm leading-[22px] bg-surface/80">
                        {ep.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={() => onIntervene({ action: 'delete_continue' })}
                    className="px-4 py-0 text-danger bg-danger-soft hover:bg-danger-soft rounded-lg text-sm leading-[22px] font-medium transition-colors border border-danger-line h-9 ui-control"
                  >
                    删除新剧集
                  </button>
                  <button
                    onClick={() => onIntervene({ action: 'confirm_continue' })}
                    className="flex items-center gap-2 px-4 py-0 bg-action text-on-action rounded-lg text-sm leading-[22px] font-medium hover:bg-action-hover transition-colors h-9 ui-control"
                  >
                    <Save className="w-4 h-4" />
                    保存新剧集
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* ===== 结构编辑模式 ===== */}
        {isEditing && editMode === 'structured' && (
          <div className="space-y-6">
            {/* 基础信息 */}
            <section className="bg-surface border border-line rounded-2xl p-4 space-y-3">
              <h4 className=" font-semibold text-ink flex items-center gap-2 text-base leading-6"><Sparkles className="w-3.5 h-3.5 text-muted" />基本信息</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs leading-[18px]">
                  <span className="text-muted font-medium">标题</span>
                  <input type="text" value={editData.title || ''} onChange={e => updateField('title', e.target.value)}
                    className="border border-line rounded-lg px-3 py-0 text-sm leading-[22px] text-ink focus:ring-2 focus:ring-accent/30 outline-none h-9 ui-control" />
                </label>
                <label className="flex flex-col gap-1 text-xs leading-[18px]">
                  <span className="text-muted font-medium">情绪基调</span>
                  <input type="text" value={editData.mood || ''} onChange={e => updateField('mood', e.target.value)}
                    className="border border-line rounded-lg px-3 py-0 text-sm leading-[22px] text-ink focus:ring-2 focus:ring-accent/30 outline-none h-9 ui-control" />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-xs leading-[18px]">
                <span className="text-muted font-medium">Logline (故事大纲)</span>
                <textarea value={editData.logline || ''} onChange={e => updateField('logline', e.target.value)} rows={4}
                  className="border border-line rounded-lg px-3 py-2 text-sm leading-[22px] text-ink focus:ring-2 focus:ring-accent/30 outline-none resize-none" />
              </label>
            </section>
            {/* 角色编辑 */}
            {editData.characters && editData.characters.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-muted" /><h4 className=" font-semibold text-ink text-base leading-6">角色</h4></div>
                <div className="space-y-3">
                  {editData.characters.map((c, i) => (
                    <div key={i} className="bg-surface border border-line rounded-2xl p-4 space-y-2">
                      <div className="flex gap-3">
                        <label className="flex flex-col gap-1 text-xs leading-[18px] flex-1"><span className="text-muted font-medium">名字</span>
                          <input type="text" value={c.name} onChange={e => updateCharacter(i, { name: e.target.value })}
                            className="border border-line rounded-lg px-3 py-0 text-sm leading-[22px] text-ink focus:ring-2 focus:ring-accent/30 outline-none h-9 ui-control" /></label>
                        <label className="flex flex-col gap-1 text-xs leading-[18px] w-24"><span className="text-muted font-medium">角色</span>
                          <select value={c.role} onChange={e => updateCharacter(i, { role: e.target.value })}
                            className="border border-line rounded-lg px-2 py-0 text-sm leading-[22px] text-ink outline-none h-9 ui-control">
                            <option value="主角">主角</option><option value="配角">配角</option><option value="背景">背景</option>
                          </select></label>
                      </div>
                      <label className="flex flex-col gap-1 text-xs leading-[18px]"><span className="text-muted font-medium">外貌描述</span>
                        <textarea value={c.description} onChange={e => updateCharacter(i, { description: e.target.value })} rows={2}
                          className="border border-line rounded-lg px-3 py-2 text-sm leading-[22px] text-ink focus:ring-2 focus:ring-accent/30 outline-none resize-none" /></label>
                      <label className="flex flex-col gap-1 text-xs leading-[18px]"><span className="text-muted font-medium">动机</span>
                        <input type="text" value={c.motivation || ''} onChange={e => updateCharacter(i, { motivation: e.target.value })}
                          className="border border-line rounded-lg px-3 py-0 text-sm leading-[22px] text-ink focus:ring-2 focus:ring-accent/30 outline-none h-9 ui-control" /></label>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* 场景编辑 */}
            {editData.settings && editData.settings.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3"><MapPin className="w-4 h-4 text-muted" /><h4 className=" font-semibold text-ink text-base leading-6">场景</h4></div>
                <div className="space-y-3">
                  {editData.settings.map((s, i) => (
                    <div key={i} className="bg-surface border border-line rounded-2xl p-4">
                      <label className="block text-xs leading-[18px] text-muted font-medium mb-2">{s.name}</label>
                      <textarea aria-label={`${s.name}场景描述`} value={s.description} onChange={e => updateSetting(i, { description: e.target.value })} rows={2}
                        className="w-full border border-line rounded-lg px-3 py-2 text-sm leading-[22px] text-ink focus:ring-2 focus:ring-accent/30 outline-none resize-none" />
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* 故事线编辑 */}
            {editData.scenes && editData.scenes.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3"><Film className="w-4 h-4 text-muted" /><h4 className=" font-semibold text-ink text-base leading-6">故事线</h4></div>
                <div className="space-y-3">
                  {editData.scenes.map((sc, i) => (
                    <div key={i} className="bg-surface border border-line rounded-2xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-surface-soft text-muted text-xs leading-[18px] font-semibold flex-shrink-0">{sc.scene_number}</span>
                        <span className="text-xs leading-[18px] text-muted">{sc.location}</span>
                        <div className="flex flex-wrap gap-1">
                          {sc.characters.map((c, ci) => <span key={ci} className="px-2 py-1 bg-surface-soft text-muted text-xs leading-[18px] rounded-lg">{c}</span>)}
                        </div>
                      </div>
                      <textarea aria-label={`第 ${sc.scene_number} 场剧情`} value={sc.plot} onChange={e => updateScene(i, { plot: e.target.value })} rows={3}
                        className="w-full border border-line rounded-lg px-3 py-2 text-sm leading-[22px] text-ink focus:ring-2 focus:ring-accent/30 outline-none resize-none" />
                    </div>
                  ))}
                </div>
              </section>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-0 bg-action text-on-action rounded-lg text-sm leading-[22px] font-medium hover:bg-action transition-colors h-9 ui-control">
                <Save className="w-4 h-4" />保存修改</button>
              <button onClick={cancelEdit} className="flex items-center gap-2 px-4 py-0 bg-surface-soft text-muted rounded-lg text-sm leading-[22px] hover:bg-surface-hover transition-colors h-9 ui-control">
                <X className="w-4 h-4" />取消</button>
            </div>
          </div>
        )}
        {/* ===== JSON编辑模式 ===== */}
        {isEditing && editMode === 'raw' && (
          <div className="space-y-3">
            <textarea aria-label="剧本 JSON" value={rawText} onChange={e => setRawText(e.target.value)}
              className="w-full bg-surface border border-line rounded-lg p-4 text-sm leading-[22px] text-ink font-mono resize-none outline-none min-h-[400px] focus:ring-2 focus:ring-accent/30" />
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-0 bg-action text-on-action rounded-lg text-sm leading-[22px] font-medium hover:bg-action transition-colors h-9 ui-control">
                <Save className="w-4 h-4" />保存修改</button>
              <button onClick={cancelEdit} className="flex items-center gap-2 px-4 py-0 bg-surface-soft text-muted rounded-lg text-sm leading-[22px] hover:bg-surface-hover transition-colors h-9 ui-control">
                <X className="w-4 h-4" />取消</button>
            </div>
          </div>
        )}
        {/* 等待状态 */}
        {state.status === 'pending' && (
          <div className="text-center text-subtle text-sm leading-[22px] py-8">等待生成...</div>
        )}
      </div>
      {!isEditing && !isLoglinePhase && (
        <StageActions
          status={state.status}
          onConfirm={onConfirm}
          showConfirm={showConfirm}
          onEdit={startEdit}
          onRegenerate={onRegenerate}
          stageId="script_generation"
          hasPendingItems={hasPendingItems}
          hasNextStageStarted={hasNextStageStarted}
          isRunning={isRunning}
        />
      )}
      {isEditing && (
        <StageActions
          status={state.status}
          onConfirm={onConfirm}
          showConfirm={showConfirm}
          onSave={handleSave}
          onRegenerate={onRegenerate}
          stageId="script_generation"
          hasPendingItems={hasPendingItems}
          hasNextStageStarted={hasNextStageStarted}
          isRunning={isRunning}
        />
      )}
      <Dialog
        open={showSmartContinueDialog}
        onClose={() => setShowSmartContinueDialog(false)}
        title="智能续写设置"
        description="选择续写集数，并补充后续剧情方向。"
        footer={
          <>
            <button
              onClick={() => setShowSmartContinueDialog(false)}
              className="h-9 rounded-lg border border-line bg-surface px-4 text-sm leading-[22px] text-ink hover:bg-surface-hover ui-control"
            >
              取消
            </button>
            <button
              onClick={handleSmartContinueConfirm}
              className="flex h-9 items-center justify-center gap-2 rounded-lg bg-action px-4 text-sm leading-[22px] font-medium text-on-action hover:bg-action-hover ui-control"
            >
              <Sparkles className="h-4 w-4" />
              确认生成
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm leading-[22px] font-medium text-ink">一次续写剧集数</legend>
            <div className="flex gap-3">
              {[1, 2, 3].map(num => (
                <button
                  key={num}
                  onClick={() => setSmartContinueEpisodes(num)}
                  aria-pressed={smartContinueEpisodes === num}
                  className={`h-9 flex-1 rounded-lg border px-4 text-sm leading-[22px] transition-colors ui-control ${
                    smartContinueEpisodes === num
                      ? 'border-line-strong bg-surface-hover text-ink'
                      : 'border-line bg-surface text-muted hover:bg-surface-hover'
                  }`}
                >
                  {num} 集
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="mb-2 block text-sm leading-[22px] font-medium text-ink">后续剧情想法主线 <span className="text-xs leading-[18px] font-normal text-muted">（可选）</span></span>
            <textarea
              value={smartContinueIdea}
              onChange={event => setSmartContinueIdea(event.target.value)}
              placeholder="留空时，AI 将自动生成后续剧情方向。"
              className="h-32 w-full resize-none rounded-lg border border-line bg-surface p-3 text-sm leading-[22px] text-ink placeholder:text-subtle focus:border-line-strong focus:outline-none"
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
