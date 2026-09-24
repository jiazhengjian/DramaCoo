'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Save } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useToast } from '@/components/ui/Feedback';
import { fetchModelGroupsByType, fetchVideoModelGroupsByAbility } from '@/lib/modelRegistry';
import {
  VIDEO_RATIOS,
  VIDEO_RESOLUTIONS,
  VIDEO_GENERATION_MODES,
  STYLES,
  type ProviderGroup,
} from '@/config/models';

type ConfigValue = string | number | boolean | null | ConfigTree;
interface ConfigTree { [key: string]: ConfigValue }

type Field = {
  path: string;
  label: string;
  type?: 'text' | 'number' | 'boolean' | 'password' | 'select';
  options?: Array<{ id: string; label: string }> | ProviderGroup[];
};

type ModelSelectKey = 'llm' | 'vlm' | 'image_it2i' | 'image_t2i' | 'video_first_frame' | 'video_start_end' | 'video_reference';

const EMPTY_MODEL_SELECTS: Record<ModelSelectKey, ProviderGroup[]> = {
  llm: [],
  vlm: [],
  image_it2i: [],
  image_t2i: [],
  video_first_frame: [],
  video_start_end: [],
  video_reference: [],
};

const LOG_LEVEL_OPTIONS = [
  { id: 'DEBUG', label: 'DEBUG - 最详细' },
  { id: 'INFO', label: 'INFO - 常规' },
  { id: 'WARNING', label: 'WARNING - 仅警告及错误' },
  { id: 'ERROR', label: 'ERROR - 仅错误' },
  { id: 'CRITICAL', label: 'CRITICAL - 严重错误' },
];

const GROUPS: Array<{ title: string; description: string; fields: Field[] }> = [
  {
    title: '服务与日志',
    description: '服务启动与日志配置。host / port 保存后需要重启后端完全生效。',
    fields: [
      { path: 'server.host', label: 'host 主机地址' },
      { path: 'server.port', label: 'port 端口', type: 'number' },
      { path: 'server.log_level', label: 'log_level 日志层级', type: 'select', options: LOG_LEVEL_OPTIONS },
      { path: 'server.access_log', label: 'access_log 请求访问日志', type: 'boolean' },
    ],
  },
  {
    title: '通用设置',
    description: '模型调用公共配置和代理设置。',
    fields: [
      { path: 'api_providers.common.print_model_input', label: 'print_model_input 打印模型输入', type: 'boolean' },
      { path: 'api_providers.common.proxy', label: 'proxy 代理地址' },
    ],
  },
  {
    title: 'OpenAI',
    description: 'OpenAI / 兼容 OpenAI 接口配置。',
    fields: [
      { path: 'api_providers.openai.api_key', label: 'api_key API 密钥', type: 'password' },
      { path: 'api_providers.openai.base_url', label: 'base_url 接口地址' },
      { path: 'api_providers.openai.enable_proxy', label: 'enable_proxy 启用代理', type: 'boolean' },
    ],
  },
  {
    title: 'Gemini',
    description: 'Gemini 及兼容接口配置。',
    fields: [
      { path: 'api_providers.gemini.api_key', label: 'api_key API 密钥', type: 'password' },
      { path: 'api_providers.gemini.base_url', label: 'base_url 接口地址' },
      { path: 'api_providers.gemini.enable_proxy', label: 'enable_proxy 启用代理', type: 'boolean' },
    ],
  },
  {
    title: 'DeepSeek',
    description: 'DeepSeek 接口配置。',
    fields: [
      { path: 'api_providers.deepseek.api_key', label: 'api_key API 密钥', type: 'password' },
      { path: 'api_providers.deepseek.base_url', label: 'base_url 接口地址' },
      { path: 'api_providers.deepseek.enable_proxy', label: 'enable_proxy 启用代理', type: 'boolean' },
    ],
  },
  {
    title: 'DashScope',
    description: '通义千问、通义万相等 DashScope 服务配置。',
    fields: [
      { path: 'api_providers.dashscope.api_key', label: 'api_key API 密钥', type: 'password' },
      { path: 'api_providers.dashscope.base_url', label: 'base_url 接口地址' },
      { path: 'api_providers.dashscope.enable_proxy', label: 'enable_proxy 启用代理', type: 'boolean' },
    ],
  },
  {
    title: 'ARK',
    description: 'Seedream / Seedance 使用的火山方舟配置。',
    fields: [
      { path: 'api_providers.ark.api_key', label: 'api_key API 密钥', type: 'password' },
      { path: 'api_providers.ark.base_url', label: 'base_url 接口地址' },
      { path: 'api_providers.ark.enable_proxy', label: 'enable_proxy 启用代理', type: 'boolean' },
    ],
  },
  {
    title: 'Kling',
    description: '可灵视频生成接口配置。',
    fields: [
      { path: 'api_providers.kling.base_url', label: 'base_url 接口地址' },
      { path: 'api_providers.kling.access_key', label: 'access_key 访问密钥', type: 'password' },
      { path: 'api_providers.kling.secret_key', label: 'secret_key 私密密钥', type: 'password' },
      { path: 'api_providers.kling.enable_proxy', label: 'enable_proxy 启用代理', type: 'boolean' },
    ],
  },
  {
    title: '默认模型',
    description: '主流程和 Pipeline 使用的默认模型。',
    fields: [
      { path: 'models.llm', label: 'llm 文本模型', type: 'select', options: [] },
      { path: 'models.vlm', label: 'vlm 视觉语言模型', type: 'select', options: [] },
      { path: 'models.image_it2i', label: 'image_it2i 图生图模型', type: 'select', options: [] },
      { path: 'models.image_t2i', label: 'image_t2i 文生图模型', type: 'select', options: [] },
      { path: 'models.video_first_frame', label: 'video_first_frame 首帧生视频模型', type: 'select', options: [] },
      { path: 'models.video_start_end', label: 'video_start_end 首尾帧生视频模型', type: 'select', options: [] },
      { path: 'models.video_reference', label: 'video_reference 参考图生视频模型', type: 'select', options: [] },
    ],
  },
  {
    title: '视频生成配置',
    description: '只对主流程生效：选择视频生成方式、风格、画幅比例和视频分辨率。',
    fields: [
      { path: 'generation.video_generation_mode', label: 'video_generation_mode 视频生成方式', type: 'select', options: VIDEO_GENERATION_MODES },
      { path: 'generation.style', label: 'style 风格', type: 'select', options: STYLES },
      { path: 'generation.video_ratio', label: 'video_ratio 视频长宽比', type: 'select', options: VIDEO_RATIOS },
      { path: 'generation.video_resolution', label: 'video_resolution 视频分辨率', type: 'select', options: VIDEO_RESOLUTIONS },
    ],
  },
];

function getValue(config: ConfigTree, path: string): ConfigValue | undefined {
  let current: ConfigValue | undefined = config;
  for (const key of path.split('.')) current = current && typeof current === 'object' ? current[key] : undefined;
  return current;
}

function setValue(config: ConfigTree, path: string, value: ConfigValue): ConfigTree {
  const next = structuredClone(config);
  const parts = path.split('.');
  let current = next;
  for (const part of parts.slice(0, -1)) {
    const nested = current[part];
    if (!nested || typeof nested !== 'object') current[part] = {};
    current = current[part] as ConfigTree;
  }
  current[parts[parts.length - 1]] = value;
  return next;
}

function maskSecret(value: unknown) {
  return String(value ?? '') ? '********' : '';
}

function isProviderOptions(options: Field['options']): options is ProviderGroup[] {
  return Array.isArray(options) && options.some(option => 'models' in option);
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigTree>({});
  const toast = useToast();
  const [attempt, setAttempt] = useState(0);
  const [modelAttempt, setModelAttempt] = useState(0);
  const [modelError, setModelError] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({});
  const [modelSelects, setModelSelects] = useState<Record<ModelSelectKey, ProviderGroup[]>>(EMPTY_MODEL_SELECTS);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('读取配置失败'); return response.json(); })
      .then(data => { if (!controller.signal.aborted) { setConfig(data.config || {}); setSecretDrafts({}); setDirty(false); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '读取配置失败'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchModelGroupsByType('llm'),
      fetchModelGroupsByType('vlm'),
      fetchModelGroupsByType('i2i'),
      fetchModelGroupsByType('t2i'),
      fetchVideoModelGroupsByAbility('first_frame_i2v'),
      fetchVideoModelGroupsByAbility('start_end_frame_i2v'),
      fetchVideoModelGroupsByAbility('reference_to_video'),
    ])
      .then(([llm, vlm, imageIt2i, imageT2i, firstFrameVideo, startEndVideo, referenceVideo]) => {
        if (cancelled) return;
        setModelSelects({
          llm,
          vlm,
          image_it2i: imageIt2i,
          image_t2i: imageT2i,
          video_first_frame: firstFrameVideo,
          video_start_end: startEndVideo,
          video_reference: referenceVideo,
        });
      })
      .catch(() => { if (!cancelled) setModelError(true); });
    return () => { cancelled = true; };
  }, [modelAttempt]);

  const groups = GROUPS.map(group => {
    if (group.title !== '默认模型') return group;
    return {
      ...group,
      fields: group.fields.map(field => {
        if (field.path === 'models.llm') return { ...field, options: modelSelects.llm };
        if (field.path === 'models.vlm') return { ...field, options: modelSelects.vlm };
        if (field.path === 'models.image_it2i') return { ...field, options: modelSelects.image_it2i };
        if (field.path === 'models.image_t2i') return { ...field, options: modelSelects.image_t2i };
        if (field.path === 'models.video_first_frame') return { ...field, options: modelSelects.video_first_frame };
        if (field.path === 'models.video_start_end') return { ...field, options: modelSelects.video_start_end };
        if (field.path === 'models.video_reference') return { ...field, options: modelSelects.video_reference };
        return field;
      }),
    };
  });

  const updateField = (field: Field, raw: string | boolean) => {
    const value = field.type === 'number' ? Number(raw) || 0 : raw;
    setConfig(current => setValue(current, field.path, value));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const resp = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: config }),
      });
      if (!resp.ok) throw new Error('保存配置失败');
      const data = await resp.json();
      setConfig(data.config || {});
      setSecretDrafts({});
      setDirty(false);
      toast('配置已保存', 'success');
    } catch {
      toast('保存配置失败，请重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateSecretField = (field: Field, raw: string) => {
    setSecretDrafts(current => ({ ...current, [field.path]: raw }));
    setConfig(current => setValue(current, field.path, raw));
    setDirty(true);
  };

  return (
    <div className="xyq-route">
      <main className="xyq-page">
        <PageHeader
          title="设置"
          description="管理模型连接与生成偏好，让创作更顺手。"
        />

        {loading ? (
          <div className="ui-state" role="status">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            正在读取配置
          </div>
        ) : error ? (
          <div className="ui-state" role="alert"><h2>暂时无法读取设置</h2><p>{error}</p><button type="button" className="ui-button" onClick={() => { setError(''); setLoading(true); setAttempt(value => value + 1); }}><RefreshCw size={15} />重新加载</button></div>
        ) : (
          <div className="space-y-6">
            {modelError && <div className="ui-notice" role="alert"><span>模型列表暂时不可用，已保存的模型配置会保留。</span><button type="button" className="ui-button" onClick={() => { setModelError(false); setModelAttempt(value => value + 1); }}><RefreshCw size={14} />重试</button></div>}
            {groups.map(group => (
              <section key={group.title} className="ui-settings-section rounded-2xl border border-line bg-surface p-6">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-ink">{group.title}</h2>
                  <p className="mt-2 text-xs text-muted">{group.description}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.fields.map(field => {
                    const value = getValue(config, field.path);
                    return (
                      <label key={field.path} className="flex flex-col gap-2 min-w-0">
                        <span className="text-xs font-medium text-muted">{field.label.replace(/^\S+\s/, '')}</span>
                        {field.type === 'boolean' ? (
                          <button type="button" role="switch" aria-checked={Boolean(value)} aria-label={field.label.replace(/^\S+\s/, '')} disabled={saving} onClick={() => updateField(field, !value)} className="ui-switch"><span /></button>
                        ) : field.type === 'select' ? (
                          <select
                            value={String(value ?? '')}
                            onChange={event => updateField(field, event.target.value)}
                            className="ui-input" disabled={saving}
                          >
                            {field.path.startsWith('models.') && (!field.options?.length || (isProviderOptions(field.options) && !field.options.some(group => group.models.some(model => model.id === value)))) && <option value={String(value ?? '')}>{String(value || '暂无可用模型')}</option>}
                            {isProviderOptions(field.options) ? (
                              field.options.map(group => (
                                <optgroup key={group.provider} label={group.label}>
                                  {group.models.map(model => (
                                    <option key={model.id} value={model.id}>{model.label}</option>
                                  ))}
                                </optgroup>
                              ))
                            ) : (
                              (field.options || []).map(option => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                              ))
                            )}
                          </select>
                        ) : field.type === 'password' ? (
                          <input
                            type="password"
                            value={secretDrafts[field.path] ?? maskSecret(value)}
                            onFocus={event => event.currentTarget.select()}
                            onChange={event => updateSecretField(field, event.target.value)}
                            placeholder="输入新密钥覆盖"
                            className="ui-input font-mono" disabled={saving} autoComplete="new-password"
                          />
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={String(value ?? '')}
                            onChange={event => updateField(field, event.target.value)}
                            className="ui-input" disabled={saving}
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}

            <div className="ui-settings-save sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur">
              <span className="text-xs text-muted">{dirty ? '有未保存的更改' : '设置已同步'}</span>
              <button type="button" onClick={save} disabled={saving || !dirty} className="ui-button ui-button-primary ml-auto">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? '正在保存' : '保存配置'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
