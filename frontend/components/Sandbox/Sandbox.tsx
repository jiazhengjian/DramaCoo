'use client';
import { useState, useEffect, useRef, useCallback, DragEvent } from 'react';
import { Sparkles, Image, Video, MessageSquare, Zap, Loader2, Copy, Check, Trash2, X, FolderOpen, Upload, Globe, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import type { ModelOption, ProviderGroup } from '@/config/models';
import PageHeader from '@/components/PageHeader';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import { fetchSandboxTasks, uploadMedia } from '@/lib/workflowApi';
import { fetchModelGroupsByType } from '@/lib/modelRegistry';
// 辅助函数：将相对路径转换为完整 URL
const toMediaUrl = (path: string) => {
  if (!path) return '';
  // 如果已经是完整 URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // 相对路径添加 /code/ 前缀（result/xxx 格式）
  if (path.startsWith('result/')) {
    return `/code/${path}`;
  } else if (!path.startsWith('/code/')) {
    return `/code/result/${path}`;
  }
  return path;
};
async function readJsonResponse(resp: Response) {
  const text = await resp.text();
  if (!text.trim()) {
    if (!resp.ok) throw new Error(`请求失败：${resp.status}`);
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    const preview = text.replace(/\s+/g, ' ').slice(0, 160);
    throw new Error(resp.ok ? `接口返回了非 JSON 内容：${preview}` : `请求失败：${resp.status} ${preview}`);
  }
}
// 工具类型
type ToolType = 'llm' | 'vlm' | 't2i' | 'i2i' | 'video';
const EMPTY_MODEL_GROUPS: Record<ToolType, ProviderGroup[]> = {
  llm: [],
  vlm: [],
  t2i: [],
  i2i: [],
  video: [],
};
interface Tool {
  id: ToolType;
  name: string;
  description: string;
  icon: React.ReactNode;
}
const tools: Tool[] = [
  { id: 'llm', name: 'LLM 对话', description: '文字生成', icon: <MessageSquare className="w-5 h-5" /> },
  { id: 'vlm', name: '图片理解', description: '分析图片内容', icon: <Image className="w-5 h-5" /> },
  { id: 't2i', name: '文生图', description: '文字生成图片', icon: <Sparkles className="w-5 h-5" /> },
  { id: 'i2i', name: '图生图', description: '图片风格转换', icon: <Zap className="w-5 h-5" /> },
  { id: 'video', name: '视频生成', description: '图生视频/文生视频', icon: <Video className="w-5 h-5" /> },
];
// 历史记录类型
interface HistoryRecord {
  id: string;
  tool: string;
  model: string;
  input: {
    prompt?: string;
    images?: string[];
    reference_image?: string;
  };
  output?: {
    response?: string;
    images?: string[];
    video?: string;
    video_path?: string;
  };
  created_at: string;
}
function SandboxOutput({ output }: { output?: HistoryRecord['output'] | null }) {
  if (!output) return null;
  return (
    <div className="space-y-4">
      {output.response && (
        <pre className="text-sm leading-[22px] text-ink whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
          {output.response}
        </pre>
      )}
      {output.images && output.images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {output.images.map((img, i) => (
            <a key={i} href={toMediaUrl(img)} target="_blank" rel="noopener noreferrer" className="group block rounded-2xl border border-line bg-surface overflow-hidden">
              <img src={toMediaUrl(img)} alt={`output-${i}`} className="w-full h-56 object-contain bg-surface" />
              <div className="px-3 py-2 text-xs leading-[18px] text-muted group-hover:text-accent border-t border-line">查看图片</div>
            </a>
          ))}
        </div>
      )}
      {output.video_path && (
        <div className="rounded-2xl border border-line bg-surface overflow-hidden">
          <video src={toMediaUrl(output.video_path)} controls className="w-full max-h-[28rem] bg-black object-contain" />
          <div className="px-3 py-2 border-t border-line">
            <a href={toMediaUrl(output.video_path)} target="_blank" rel="noopener noreferrer" className="text-sm leading-[22px] text-accent hover:underline">
              查看视频
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
// 图片上传组件
function ImageUploader({
  value,
  onChange,
  required,
  label,
}: {
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
  label: string;
}) {
  const toast = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inputMode, setInputMode] = useState<'url' | 'file'>('file');
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  };
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  };
  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件', 'error');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadMedia(file);
      setPreviewUrl(current => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
      onChange(result.file_path);
    } catch (e) {
      toast(e instanceof Error ? e.message : '上传失败', 'error');
    } finally {
      setUploading(false);
    }
  };
  // 判断是否为 URL
  const isUrl = value.startsWith('http://') || value.startsWith('https://');
  return (
    <div className="mb-4">
      <label className="block text-sm leading-[22px] font-medium text-ink mb-2">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {/* 切换 URL / 文件上传 */}
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setInputMode('url')}
          className={`text-xs leading-[18px] px-3 py-0 rounded-lg transition-colors h-9 ui-control ${
            inputMode === 'url' ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-soft'
          }`}
        >
          URL 地址
        </button>
        <button
          type="button"
          onClick={() => setInputMode('file')}
          className={`text-xs leading-[18px] px-3 py-0 rounded-lg transition-colors h-9 ui-control ${
            inputMode === 'file' ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-soft'
          }`}
        >
          本地上传
        </button>
      </div>
      {/* URL 输入模式 */}
      {inputMode === 'url' && (
        <div className="space-y-2">
          <input
            type="text"
            aria-label={`${label}地址`}
            value={isUrl ? value : ''}
            onChange={e => {
              setPreviewUrl(current => {
                if (current) URL.revokeObjectURL(current);
                return '';
              });
              onChange(e.target.value);
            }}
            placeholder="https://example.com/image.jpg"
            className="w-full px-4 py-0 border border-line rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none h-9 ui-control"
          />
          {value && isUrl && (
            <div className="relative group">
              <img src={value} alt="预览" className="max-h-48 rounded-lg border border-line" />
              <button
                aria-label={`移除${label}`}
                onClick={() => onChange('')}
                className="absolute top-2 right-2 p-2 bg-danger text-on-action rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-9 ui-control"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
      {/* 文件上传模式 */}
      {inputMode === 'file' && (
        <>
          {value && !isUrl ? (
            <div className="relative group">
              {previewUrl ? (
                <img src={previewUrl} alt="上传的图片" className="max-h-48 rounded-lg border border-line" />
              ) : (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-[18px] text-muted break-all">
                  已上传：{value}
                </div>
              )}
              <button
                aria-label={`移除${label}`}
                onClick={() => {
                  setPreviewUrl(current => {
                    if (current) URL.revokeObjectURL(current);
                    return '';
                  });
                  onChange('');
                }}
                className="absolute top-2 right-2 p-2 bg-danger text-on-action rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-9 ui-control"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="button"
              tabIndex={uploading ? -1 : 0}
              aria-label={`上传${label}`}
              aria-disabled={uploading}
              onKeyDown={event => {
                if (!uploading && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-line-strong'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                aria-label={`选择${label}文件`}
                disabled={uploading}
                onChange={handleFileSelect}
                className="hidden"
              />
              {uploading ? (
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-accent animate-spin" />
              ) : (
                <Upload className="w-8 h-8 mx-auto mb-2 text-subtle" />
              )}
              <p className="text-sm leading-[22px] text-muted">
                拖拽图片到此处，或 <span className="text-accent">点击选择文件</span>
              </p>
              <p className="text-xs leading-[18px] text-subtle mt-1">支持 PNG、JPG、WebP 等格式</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export default function SandboxPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [activeTool, setActiveTool] = useState<ToolType>('llm');
  const [modelGroups, setModelGroups] = useState<Record<ToolType, ProviderGroup[]>>(EMPTY_MODEL_GROUPS);
  const [modelLoadError, setModelLoadError] = useState('');
  const [modelReload, setModelReload] = useState(0);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [currentOutput, setCurrentOutput] = useState<HistoryRecord['output'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // 历史记录状态
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [manageMode, setManageMode] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const searchParams = useSearchParams();
  const flattenModels = (groups: ProviderGroup[]): ModelOption[] => groups.flatMap(group => group.models);
  const getModels = () => flattenModels(modelGroups[activeTool] || []);
  const firstModelId = (groups: ProviderGroup[]) => {
    const models = flattenModels(groups);
    return models.find(model => model.default)?.id || models[0]?.id || '';
  };
  const [selectedModel, setSelectedModel] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  // 获取历史记录
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const resp = await fetch('/api/sandbox/history');
      const data = await readJsonResponse(resp);
      if (!resp.ok || !data.success) throw new Error('历史记录加载失败');
      setHistory(data.records || []);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '历史记录加载失败');
    } finally {
      setHistoryLoading(false);
    }
  }, []);
  useEffect(() => { void fetchHistory(); }, [fetchHistory]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchModelGroupsByType('llm'),
      fetchModelGroupsByType('vlm'),
      fetchModelGroupsByType('t2i'),
      fetchModelGroupsByType('i2i'),
      fetchModelGroupsByType('video'),
    ])
      .then(([llm, vlm, t2i, i2i, video]) => {
        if (cancelled) return;
        const groups = { llm, vlm, t2i, i2i, video };
        setModelGroups(groups);
        setModelLoadError('');
        setSelectedModel(current => current || firstModelId(groups[activeTool]));
      })
      .catch(() => { if (!cancelled) setModelLoadError('模型列表加载失败，请重试。当前选择已保留。'); })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, [modelReload]);
  const applyRecord = (record: HistoryRecord) => {
    setSelectedRecord(record);
    setActiveTool(record.tool as ToolType);
    setSelectedModel(record.model);
    setPrompt(record.input.prompt || '');
    setImageUrl(record.input.reference_image || record.input.images?.[0] || '');
    if (record.output?.response) {
      setResult(record.output.response);
    } else {
      setResult(null);
    }
    setCurrentOutput(record.output || null);
    setLoading(false);
    setError(null);
  };
  // 检查 URL 参数，自动加载历史记录
  useEffect(() => {
    const recordId = searchParams.get('record');
    if (recordId && history.length > 0) {
      const record = history.find(r => r.id === recordId);
      if (record) {
        applyRecord(record);
      }
    }
  }, [searchParams, history, fetchHistory]);
  useEffect(() => {
    const taskId = searchParams.get('task');
    if (!taskId) return;
    let cancelled = false;
    const loadTask = async () => {
      const historyRecord = history.find(r => r.id === taskId);
      if (historyRecord) {
        applyRecord(historyRecord);
        return;
      }
      const activeTasks = await fetchSandboxTasks();
      const activeTask = activeTasks.find(item => item.id === taskId);
      if (!activeTask || cancelled) return;
      setActiveTool(activeTask.tool as ToolType);
      setSelectedModel(activeTask.model);
      setPrompt(activeTask.input?.prompt || '');
      setImageUrl(activeTask.input?.reference_image || activeTask.input?.images?.[0] || '');
      setCurrentOutput(null);
      setResult(null);
      setError(null);
      setLoading(true);
    };
    loadTask().catch(() => {});
    const timer = window.setInterval(() => {
      fetchHistory().then(() => loadTask()).catch(() => {});
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [searchParams, history, fetchHistory]);
  // 删除历史记录
  const deleteRecord = async (id: string) => {
    if (!await confirm({ title: '删除历史记录', description: '删除后不可恢复。确定删除这条记录吗？', confirmLabel: '删除记录', danger: true })) return;
    setDeleting(id);
    try {
      const resp = await fetch(`/api/sandbox/history/${id}`, { method: 'DELETE' });
      const data = await readJsonResponse(resp);
      if (!resp.ok || !data.success) throw new Error('删除失败，请重试');
      if (data.success) {
        setHistory(previous => previous.filter(record => record.id !== id));
        toast('已删除记录', 'success');
        if (selectedRecord?.id === id) {
          setSelectedRecord(null);
          setResult(null);
          setCurrentOutput(null);
        }
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败，请重试', 'error');
    } finally {
      setDeleting(null);
    }
  };
  // 工具切换时重置模型选择
  const handleToolChange = (tool: ToolType) => {
    setActiveTool(tool);
    setSelectedModel(firstModelId(modelGroups[tool]));
    setResult(null);
    setCurrentOutput(null);
    setError(null);
    setImageUrl('');
  };
  // 监听工具变化，确保模型选择同步
  useEffect(() => {
    const models = getModels();
    if (!models.length) return;
    // 只有当前模型不在新工具的模型列表中时才更新
    const currentInList = models.some(m => m.id === selectedModel);
    if (!currentInList) {
      setSelectedModel(models.find(m => m.default)?.id || models[0]?.id || '');
    }
  }, [activeTool, modelGroups, selectedModel]);
  // 检查是否可以提交
  const canSubmit = () => {
    if (!selectedModel) return false;
    if (!prompt.trim() && activeTool !== 't2i') return false;
    if ((activeTool === 'i2i') && !imageUrl) return false;
    return true;
  };
  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setLoading(true);
    setResult(null);
    setCurrentOutput(null);
    setError(null);
    try {
      let apiUrl = '';
      let body: Record<string, unknown> = {
        model: selectedModel,
        prompt: prompt,
      };
      switch (activeTool) {
        case 'llm':
          apiUrl = '/api/sandbox/llm';
          // web_search 只对 LLM 有效
          if (webSearch) {
            body.web_search = true;
          }
          break;
        case 'vlm':
          apiUrl = '/api/sandbox/vlm';
          body.images = [imageUrl];
          break;
        case 't2i':
          apiUrl = '/api/sandbox/t2i';
          break;
        case 'i2i':
          apiUrl = '/api/sandbox/i2i';
          body.image = imageUrl;
          break;
        case 'video':
          apiUrl = '/api/sandbox/video';
          body.image = imageUrl;
          break;
      }
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await readJsonResponse(response);
      if (data.success) {
        if (activeTool === 't2i' || activeTool === 'i2i' || activeTool === 'video') {
          const output = activeTool === 'video'
            ? { video_path: data.video_path }
            : { images: Array.isArray(data.result) ? data.result : [] };
          setCurrentOutput(output);
          setResult(null);
        } else {
          const output = { response: data.result };
          setCurrentOutput(output);
          setResult(data.result);
        }
        fetchHistory();
      } else {
        setError(data.error || '未知错误');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };
  const copyResult = () => {
    const copyText = result || JSON.stringify(currentOutput, null, 2);
    if (copyText) {
      navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  // 获取工具名称
  const getToolName = (tool: string) => {
    const t = tools.find(x => x.id === tool);
    return t?.name || tool;
  };
  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  // 获取图片输入的标签
  const getImageLabel = () => {
    switch (activeTool) {
      case 'vlm': return '上传图片';
      case 'i2i': return '参考图片';
      case 'video': return '首帧图片';
      default: return '图片';
    }
  };
  return (
    <div className="xyq-route">
      <main className="xyq-page">
        <>
            <PageHeader title="临时工作台" description="从文字、图片到视频，自由探索你的创作灵感。" />
            {/* 工具选择 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
              {tools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => handleToolChange(tool.id)}
                  aria-pressed={activeTool === tool.id}
                  className={`flex h-[76px] min-w-0 items-center gap-3 rounded-3xl border p-4 text-left transition-colors hover:bg-foreground/[0.08] ${
                    activeTool === tool.id
                      ? 'border-foreground/[0.16] bg-foreground/[0.08] text-ink'
                      : 'border-line bg-surface text-muted'
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden="true">{tool.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium leading-[22px]">{tool.name}</span>
                    <span className="block truncate text-xs leading-[18px] text-muted">{tool.description}</span>
                  </span>
                </button>
              ))}
            </div>
            {modelLoadError && (
              <div className="ui-notice mb-4" role="alert">
                <span>{modelLoadError}</span>
                <button className="ui-button ui-button-secondary shrink-0" disabled={modelsLoading} onClick={() => { setModelsLoading(true); setModelReload(value => value + 1); }}>{modelsLoading ? '重试中…' : '重试加载模型'}</button>
              </div>
            )}
            {modelsLoading && !modelLoadError && <p role="status" className="mb-4 text-xs leading-[18px] text-muted">正在加载模型列表…</p>}
            {/* 输入区域 */}
            <div className="bg-surface rounded-2xl border border-line p-6 mb-6">
              {/* 模型选择 */}
              <div className="mb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <label className="block text-sm leading-[22px] font-medium text-ink mb-2">选择模型</label>
                    <select
                      aria-label="选择模型"
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                      className="w-full min-w-0 px-4 py-0 border border-line rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none h-9 ui-control"
                    >
                      {selectedModel && !getModels().some(model => model.id === selectedModel) && <option value={selectedModel}>{selectedModel}（当前）</option>}
                      {getModels().map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  {/* 联网搜索开关 */}
                  {activeTool === 'llm' && (
                    <button
                      onClick={() => setWebSearch(!webSearch)}
                      className={`self-start shrink-0 px-4 py-0 rounded-lg border-2 flex items-center gap-2 transition-colors sm:self-auto h-9 ui-control ${
                        webSearch
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line text-muted hover:border-line-strong'
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                      <span className="text-sm leading-[22px] font-medium">联网搜索</span>
                    </button>
                  )}
                </div>
              </div>
              {/* 图片上传（部分工具需要） */}
              {(activeTool === 'vlm' || activeTool === 'i2i' || activeTool === 'video') && (
                <ImageUploader
                  value={imageUrl}
                  onChange={setImageUrl}
                  required={activeTool === 'i2i'}
                  label={getImageLabel()}
                />
              )}
              {/* 提示词输入 */}
              <div className="mb-4">
                <label className="block text-sm leading-[22px] font-medium text-ink mb-2">
                  {activeTool === 'llm' ? '对话内容' :
                   activeTool === 'vlm' ? '想了解图片的什么问题？' :
                   activeTool === 't2i' ? '图片描述（英文效果更好）' :
                   activeTool === 'i2i' ? '希望生成什么样的图片？' :
                   '视频描述（希望生成什么样的视频？）'}
                </label>
                <textarea
                  aria-label="工具提示词"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder={
                    activeTool === 'llm' ? '输入你想问的问题...' :
                    activeTool === 'vlm' ? '描述这张图片的内容...' :
                    'A cute cat sitting on a couch, realistic style'
                  }
                  rows={4}
                  className="w-full px-4 py-3 border border-line rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none resize-none"
                />
              </div>
              {/* 提交按钮 */}
              <button
                onClick={handleSubmit}
                disabled={loading || !canSubmit()}
                className="w-full py-0 px-6 bg-action text-on-action font-medium rounded-lg hover:bg-action-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 h-9 ui-control"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>处理中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>生成</span>
                  </>
                )}
              </button>
            </div>
            {/* 结果展示 */}
            {(currentOutput || error) && (
              <div className={`rounded-2xl border p-6 ${error ? 'bg-danger-soft border-danger-line' : 'bg-success-soft border-success-line'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-medium text-base leading-6 ${error ? 'text-danger' : 'text-success'}`}>
                    {error ? '错误' : '结果'}
                  </h3>
                  {!error && currentOutput && (
                    <button onClick={copyResult} className="p-2 rounded-lg hover:bg-surface/50 transition-colors h-9 ui-control" title="复制结果" aria-label="复制结果">
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted" />}
                    </button>
                  )}
                </div>
                {error ? (
                  <p className="text-danger text-sm leading-[22px]">{error}</p>
                ) : (
                  <SandboxOutput output={currentOutput} />
                )}
              </div>
            )}
          <section className="mt-8" aria-label="工具历史记录" aria-busy={historyLoading}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted" />
              <h2 className="text-base font-semibold leading-6 text-ink">{getToolName(activeTool)}历史记录</h2>
              <button
                onClick={() => setManageMode(value => !value)}
                disabled={!history.some(record => record.tool === activeTool)}
                aria-pressed={manageMode}
                className="ui-control ml-auto h-9 rounded-lg border border-line bg-surface px-3 text-sm leading-[22px] text-ink hover:bg-surface-hover disabled:opacity-50"
              >
                {manageMode ? '完成' : '管理'}
              </button>
              <button onClick={() => void fetchHistory()} disabled={historyLoading} className="ui-control flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted hover:bg-surface-hover disabled:opacity-50" aria-label="刷新历史记录">
                <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {historyLoading && <p role="status" className="mb-4 flex items-center gap-2 text-sm leading-[22px] text-muted"><Loader2 className="h-4 w-4 animate-spin" />正在加载历史记录</p>}
            {historyError && (
              <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4">
                <p className="min-w-0 flex-1 text-sm leading-[22px] text-danger">{historyError}</p>
                <button onClick={() => void fetchHistory()} disabled={historyLoading} className="ui-control h-9 rounded-lg border border-line bg-surface px-3 text-sm leading-[22px] text-ink hover:bg-surface-hover disabled:opacity-50">重试</button>
              </div>
            )}
            {!historyLoading && !historyError && !history.some(record => record.tool === activeTool) && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm leading-[22px] text-muted">暂无历史记录，完成的任务会显示在这里。</p>}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {history.filter(record => record.tool === activeTool).map(record => (
                <div key={record.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
                  <button
                    onClick={() => {
                      setSelectedRecord(record);
                      setPrompt(record.input.prompt || '');
                      setImageUrl(record.input.reference_image || record.input.images?.[0] || '');
                      setCurrentOutput(record.output || null);
                      setResult(record.output?.response || null);
                      setError(null);
                    }}
                    disabled={manageMode}
                    className="min-w-0 flex-1 rounded-lg text-left outline-offset-4 disabled:cursor-default"
                    aria-label={`查看历史记录：${record.input.prompt || record.model}`}
                  >
                    <span className="block truncate text-sm font-medium leading-[22px] text-ink">{record.input.prompt || record.input.reference_image || '(无提示词)'}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-surface-soft px-2 py-1 text-xs leading-[18px] text-muted">{record.model}</span>
                      <span className="text-xs leading-[18px] text-muted">{formatDate(record.created_at)}</span>
                    </span>
                  </button>
                  {manageMode && (
                    <button onClick={() => void deleteRecord(record.id)} disabled={deleting !== null} className="ui-control flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-danger-line bg-danger-soft text-danger hover:bg-surface-hover disabled:opacity-50" aria-label={`删除历史记录：${record.input.prompt || record.model}`}>
                      {deleting === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      </main>
    </div>
  );
}
