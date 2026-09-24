'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, PanelLeftClose, PanelLeftOpen, Menu, Clock, FolderOpen, Hexagon, Home, Images, Loader2, Repeat2, Settings, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { Popover } from '@/components/ui/Overlay';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { clearTempCache, fetchPipelineTasks, fetchSandboxTasks, fetchSessions, type PipelineTask, type SandboxTask } from '@/lib/workflowApi';

const NAV_ITEMS = [
  { href: '/', label: '工作室', icon: Home },
  { href: '/projects', label: '项目库', icon: FolderOpen },
  { href: '/library', label: '素材库', icon: Images },
  { href: '/sandbox', label: '临时工作台', icon: Hexagon },
  { href: '/pipelines/action-transfer', label: '动作迁移', icon: Repeat2 },
];

const SETTINGS_ITEM = { href: '/settings', label: '设置', icon: Settings };

const PIPELINE_ROUTES: Record<string, { href: string; label: string }> = {
  standard: { href: '/pipelines/standard', label: '文艺短视频' },
  action_transfer: { href: '/pipelines/action-transfer', label: '动作迁移' },
  digital_human: { href: '/pipelines/digital-human', label: '数字人口播' },
};

const TASK_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-surface-soft text-muted',
  running: 'bg-accent-soft text-accent',
  waiting: 'bg-warning-soft text-warning',
  completed: 'bg-success-soft text-success',
  failed: 'bg-danger-soft text-danger',
};

function statusText(status?: string) {
  if (status === 'pending') return '等待中';
  if (status === 'running') return '生成中';
  if (status === 'waiting') return '待确认';
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '失败';
  return status || '未知';
}

function taskTitle(task: PipelineTask) {
  const input = task.input || {};
  const output = task.output || {};
  return output.title || input.title || input.goods_title || input.text || input.prompt_text || input.goods_text || task.task_id;
}

type RunningTaskItem = {
  id: string;
  href: string;
  title: string;
  scope: string;
  status: string;
  progress: number;
};

const WORKFLOW_STAGE_COUNT = 6;
const COMPLETED_TASK_DISMISS_KEY = 'DramaCoo.dismissed-completed-tasks';
const SIDEBAR_OPEN_KEY = 'DramaCoo.sidebar-open';

type SessionSummary = { id: string; idea?: string; title?: string; status?: Record<string, string> };

function projectTaskFromSession(session: SessionSummary): RunningTaskItem | null {
  const statusMap = session.status || {};
  const values = Object.values(statusMap);
  if (!values.includes('running')) return null;
  const completed = values.filter(value => ['completed', 'session_completed'].includes(String(value))).length;
  const runningStage = Object.keys(statusMap).find(key => statusMap[key] === 'running');
  return {
    id: `project-${session.id}`,
    href: `/?session=${encodeURIComponent(session.id)}`,
    title: session.idea || session.id,
    scope: runningStage ? `主流程 · ${runningStage}` : '主流程',
    status: 'running',
    progress: Math.round((completed / WORKFLOW_STAGE_COUNT) * 100),
  };
}

function projectReviewTaskFromSession(session: SessionSummary): RunningTaskItem | null {
  const statusMap = session.status || {};
  const waitingStage = Object.keys(statusMap).find(key => statusMap[key] === 'waiting');
  const completed = Object.values(statusMap).filter(value => ['completed', 'session_completed'].includes(String(value))).length;
  const allDone = completed >= WORKFLOW_STAGE_COUNT || statusMap.completed === 'completed';
  if (!waitingStage && !allDone) return null;
  const targetStage = waitingStage || Object.keys(statusMap).reverse().find(key => ['completed', 'session_completed'].includes(String(statusMap[key]))) || '';
  return {
    id: `project-review-${session.id}-${waitingStage || 'completed'}`,
    href: `/?session=${encodeURIComponent(session.id)}${targetStage ? `&stage=${encodeURIComponent(targetStage)}` : ''}`,
    title: session.idea || session.title || session.id,
    scope: waitingStage ? `主流程 · ${waitingStage}` : '主流程',
    status: waitingStage ? 'waiting' : 'completed',
    progress: waitingStage ? Math.round((completed / WORKFLOW_STAGE_COUNT) * 100) : 100,
  };
}

function pipelineTaskItem(task: PipelineTask): RunningTaskItem | null {
  const route = PIPELINE_ROUTES[task.pipeline];
  if (!route || !['pending', 'running'].includes(task.status)) return null;
  return {
    id: `pipeline-${task.task_id}`,
    href: `${route.href}?task=${encodeURIComponent(task.task_id)}`,
    title: String(taskTitle(task)),
    scope: route.label,
    status: task.status,
    progress: task.progress || 0,
  };
}

function pipelineCompletedTaskItem(task: PipelineTask): RunningTaskItem | null {
  const route = PIPELINE_ROUTES[task.pipeline];
  if (!route || task.status !== 'completed') return null;
  return {
    id: `pipeline-completed-${task.task_id}`,
    href: `${route.href}?task=${encodeURIComponent(task.task_id)}`,
    title: String(taskTitle(task)),
    scope: route.label,
    status: 'completed',
    progress: 100,
  };
}

const SANDBOX_TOOL_LABELS: Record<string, string> = {
  llm: 'LLM',
  vlm: 'VLM',
  t2i: '文生图',
  i2i: '图生图',
  video: '视频生成',
};

function sandboxTaskItem(task: SandboxTask): RunningTaskItem {
  const input = task.input || {};
  return {
    id: `sandbox-${task.id}`,
    href: `/sandbox?task=${encodeURIComponent(task.id)}`,
    title: input.prompt || input.reference_image || task.id,
    scope: `临时工作台 · ${SANDBOX_TOOL_LABELS[task.tool] || task.tool}`,
    status: task.status || 'running',
    progress: task.progress || 1,
  };
}

function loadDismissedCompletedTasks(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(COMPLETED_TASK_DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveDismissedCompletedTasks(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COMPLETED_TASK_DISMISS_KEY, JSON.stringify(Array.from(ids)));
}

function loadSidebarOpen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (window.innerWidth < 768) return false;
    const stored = window.localStorage.getItem(SIDEBAR_OPEN_KEY);
    return stored === null ? true : stored === 'true';
  } catch { return window.innerWidth >= 768; }
}

function saveSidebarOpen(open: boolean) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(SIDEBAR_OPEN_KEY, open ? 'true' : 'false'); document.cookie = `dramacoo-sidebar-open=${open ? 'true' : 'false'}; path=/; max-age=31536000; samesite=lax`; } catch { /* private browsing */ }
}

function TaskPanel({
  title,
  icon,
  loading,
  tasks,
  currentPath,
  emptyText,
  onTaskClick,
}: {
  title: string;
  icon: React.ReactNode;
  loading?: boolean;
  tasks: RunningTaskItem[];
  currentPath: string;
  emptyText: string;
  onTaskClick: (task: RunningTaskItem) => void;
}) {
  return (
    <section className="xyq-task-panel h-[20vh] min-h-32 border-t border-line p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        {icon}
        <span className="text-xs font-medium text-muted">{title}</span>
        {loading && <Loader2 className="ml-auto h-3 w-3 animate-spin text-subtle" />}
      </div>
      <div className="h-[calc(100%-26px)] overflow-y-auto pr-1">
        {tasks.length ? (
          <div className="space-y-2">
            {tasks.map(task => {
              const active = currentPath === task.href.split('?')[0];
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onTaskClick(task)}
                  className={clsx(
                    'xyq-task-item w-full rounded-lg border px-2 py-2 text-left transition-colors',
                    active ? 'border-accent-line bg-accent-soft/60' : 'border-line bg-surface hover:border-accent-line hover:bg-accent-soft/40'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
                      {task.title.slice(0, 36)}
                    </span>
                    <span className={clsx('flex-shrink-0 rounded px-1.5 py-0.5 text-xs', TASK_STATUS_STYLE[task.status] || TASK_STATUS_STYLE.pending)}>
                      {statusText(task.status)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="truncate text-xs text-subtle">{task.scope}</span>
                    <div className="h-1 min-w-10 flex-1 overflow-hidden rounded-full bg-surface-soft">
                      <div className="h-full rounded-full bg-action" style={{ width: `${task.progress || 0}%` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="xyq-task-empty">
            {emptyText}
          </div>
        )}
      </div>
    </section>
  );
}

function SidebarTaskPanels({ currentPath, onNavigate }: { currentPath: string; onNavigate?: () => void }) {
  const router = useRouter();
  const [runningTasks, setRunningTasks] = useState<RunningTaskItem[]>([]);
  const [completedTasks, setCompletedTasks] = useState<RunningTaskItem[]>([]);
  const [dismissedCompleted, setDismissedCompleted] = useState<Set<string>>(() => loadDismissedCompletedTasks());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([fetchPipelineTasks(100), fetchSessions(), fetchSandboxTasks()]);
      setLoadError(results.some(result => result.status === 'rejected'));
      const pipelineRecords = results[0].status === 'fulfilled' ? results[0].value : [];
      const sessions = results[1].status === 'fulfilled' ? results[1].value : [];
      const sandboxRecords = results[2].status === 'fulfilled' ? results[2].value : [];
      setRunningTasks([
        ...sandboxRecords.map(sandboxTaskItem),
        ...pipelineRecords.map(pipelineTaskItem).filter((task): task is RunningTaskItem => Boolean(task)),
        ...sessions.map(projectTaskFromSession).filter((task): task is RunningTaskItem => Boolean(task)),
      ]);
      setCompletedTasks([
        ...pipelineRecords.map(pipelineCompletedTaskItem).filter((task): task is RunningTaskItem => Boolean(task)),
        ...sessions.map(projectReviewTaskFromSession).filter((task): task is RunningTaskItem => Boolean(task)),
      ].filter(task => !dismissedCompleted.has(task.id)));
    } finally {
      setLoading(false);
    }
  }, [dismissedCompleted]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { load().catch(() => {}); });
    const timer = window.setInterval(() => load().catch(() => {}), 3000);
    return () => { cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, [load]);

  const handleRunningClick = (task: RunningTaskItem) => {
    router.push(task.href);
    onNavigate?.();
  };

  const handleCompletedClick = (task: RunningTaskItem) => {
    const next = new Set(dismissedCompleted);
    next.add(task.id);
    saveDismissedCompletedTasks(next);
    setDismissedCompleted(next);
    setCompletedTasks(current => current.filter(item => item.id !== task.id));
    router.push(task.href);
    onNavigate?.();
  };

  return (
    <>
      {loadError && <div className="flex items-center justify-between gap-2 px-2 pt-2 text-xs text-muted" role="status"><span>部分任务暂时无法加载</span><button type="button" onClick={() => load()} className="text-accent underline">重试</button></div>}
      <TaskPanel
        title="进行中任务"
        icon={<Clock className="h-3.5 w-3.5 text-subtle" />}
        loading={loading}
        tasks={runningTasks}
        currentPath={currentPath}
        emptyText="还没有进行中的任务"
        onTaskClick={handleRunningClick}
      />
      <TaskPanel
        title="已完成/等待确认"
        icon={<CheckCircle2 className="h-3.5 w-3.5 text-subtle" />}
        tasks={completedTasks}
        currentPath={currentPath}
        emptyText="还没有已完成或待确认的任务"
        onTaskClick={handleCompletedClick}
      />
    </>
  );
}

export default function AppShell({ children, initialOpen = true }: { children: React.ReactNode; initialOpen?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inWorkflow = searchParams.get('session') !== null;
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const mainRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(initialOpen);
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const tasksRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [routeKey]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => { const next = media.matches ? false : loadSidebarOpen(); setMobile(media.matches); setOpen(next); setReady(true); if (!media.matches) saveSidebarOpen(next); };
    const frame = requestAnimationFrame(update);
    media.addEventListener('change', update);
    return () => { cancelAnimationFrame(frame); media.removeEventListener('change', update); };
  }, []);

  useEffect(() => {
    if (!mobile || !open) return;
    const sidebar = sidebarRef.current;
    const previousOverflow = document.body.style.overflow;
    const mobileToggle = mobileToggleRef.current;
    document.body.style.overflow = 'hidden';
    sidebar?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('.ui-popover, .ui-dialog')) return;
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key === 'Tab') {
        const items = Array.from(sidebar?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') || []).filter(item => item.getClientRects().length);
        const first = items[0]; const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      mobileToggle?.focus();
    };
  }, [mobile, open]);

  const setSidebarOpen = (next: boolean) => {
    setOpen(next);
    setTasksOpen(false);
    setSettingsMenuOpen(false);
    if (!mobile) saveSidebarOpen(next);
  };
  const handleNavigate = () => { if (mobile) setSidebarOpen(false); };
  const handleClearCache = async () => {
    setSettingsMenuOpen(false);
    if (!await confirm({ title: '清空临时缓存？', description: '将清理临时生成与上传缓存，此操作无法撤销。', confirmLabel: '清空缓存', danger: true })) return;
    setClearingCache(true);
    try {
      const result = await clearTempCache();
      toast(`缓存已清空，释放 ${Number(result.freed_mb || 0).toFixed(2)} MB`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : '清空缓存失败，请重试', 'error');
    } finally { setClearingCache(false); }
  };

  return (
    <div className="xyq-shell" data-sidebar-open={open} data-sidebar-ready={ready} style={{ '--app-sidebar-width': open ? '240px' : '64px' } as CSSProperties}>
      <div className="xyq-mobile-menu" inert={mobile && open}>
        <button ref={mobileToggleRef} type="button" className="ui-icon-button" aria-label="展开侧边栏" aria-expanded={open} aria-controls="app-sidebar" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        <span className="font-medium">DramaCoo</span>
      </div>
      <aside ref={sidebarRef} id="app-sidebar" aria-label="主导航" className="xyq-sidebar" inert={mobile && !open} data-tooltip-dismissed={tooltipDismissed} onKeyDown={event => { if (event.key === "Escape") setTooltipDismissed(true); }} onMouseOver={() => setTooltipDismissed(false)} onFocus={() => setTooltipDismissed(false)}>
        <div className="xyq-sidebar-brand">
          <Link href="/" onClick={handleNavigate} aria-label="DramaCoo 工作室"><Image src="/logo.jpg" alt="" width={32} height={32} unoptimized /><span>DramaCoo</span></Link>
          <button type="button" className={open ? "ui-icon-button xyq-sidebar-toggle" : "xyq-sidebar-expand"} aria-label={open ? '收起侧边栏' : '展开侧边栏'} title={open ? '收起侧边栏' : '展开侧边栏'} aria-expanded={open} aria-controls="app-sidebar" onClick={() => setSidebarOpen(!open)}>
            {open ? <PanelLeftClose size={16} /> : <><Image src="/logo.jpg" alt="" width={32} height={32} unoptimized /><PanelLeftOpen size={16} /></>}
          </button>
        </div>
        <nav aria-label="创作功能" className="xyq-sidebar-nav">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = item.href === '/' ? pathname === '/' && !inWorkflow : item.href === '/projects' ? pathname.startsWith('/projects') || (pathname === '/' && inWorkflow) : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} aria-label={item.label} aria-current={active ? 'page' : undefined} onClick={handleNavigate} className="xyq-sidebar-link">
              <Icon aria-hidden="true" /><span className="xyq-nav-label">{item.label}</span><span className="xyq-nav-tooltip" aria-hidden="true">{item.label}</span>
            </Link>;
          })}
        </nav>
        <div className="xyq-sidebar-spacer" />
        {open ? <div className="xyq-sidebar-tasks"><SidebarTaskPanels currentPath={pathname} onNavigate={handleNavigate} /></div> : <>
          <button ref={tasksRef} className="xyq-sidebar-link" aria-label="任务中心" aria-haspopup="dialog" aria-expanded={tasksOpen} onClick={() => setTasksOpen(value => !value)}>
            <Clock aria-hidden="true" /><span className="xyq-nav-tooltip" aria-hidden="true">任务中心</span>
          </button>
          <Popover open={tasksOpen} onClose={() => setTasksOpen(false)} triggerRef={tasksRef} className="xyq-task-popover" label="任务中心"><SidebarTaskPanels currentPath={pathname} onNavigate={() => setTasksOpen(false)} /></Popover>
        </>}
        <div className="xyq-sidebar-footer">
          <button ref={settingsRef} type="button" onClick={() => setSettingsMenuOpen(value => !value)} className="xyq-sidebar-link" aria-label="设置" aria-expanded={settingsMenuOpen} aria-haspopup="dialog" aria-current={pathname.startsWith('/settings') ? 'page' : undefined}>
            <Settings aria-hidden="true" /><span className="xyq-nav-label">设置</span><span className="xyq-nav-tooltip" aria-hidden="true">设置</span>
          </button>
          <Popover open={settingsMenuOpen} onClose={() => setSettingsMenuOpen(false)} triggerRef={settingsRef} className="xyq-settings-menu" label="设置菜单">
            <button type="button" onClick={() => { setSettingsMenuOpen(false); handleNavigate(); router.push(SETTINGS_ITEM.href); }} className="ui-menu-item"><Settings size={16} />修改配置</button>
            <button type="button" onClick={handleClearCache} disabled={clearingCache} className="ui-menu-item text-danger">{clearingCache ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}清空缓存</button>
          </Popover>
        </div>
      </aside>
      {open && <button type="button" tabIndex={-1} className="xyq-sidebar-backdrop" aria-label="关闭导航菜单" onClick={() => setSidebarOpen(false)} />}
      <main ref={mainRef} className="xyq-main" inert={mobile && open}>{children}</main>
    </div>
  );
}
