'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSessions, deleteSession, archiveSession } from '@/lib/workflowApi';
import { assetUrl } from '@/components/stages/utils';
import { Film, Search, Trash2, Archive, Loader2, Plus, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useConfirm, useToast } from '@/components/ui/Feedback';

interface ProjectItem {
  id: string; title: string; idea: string; style: string; status: string;
  cover_image: string | null; updated_at: string | null; archived: boolean;
}
const STATUS_LABELS: Record<string, string> = { completed: '已完成', running: '生成中', waiting: '待确认', draft: '草稿' };

export default function ProjectsPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    fetchSessions().then(list => { if (active) setProjects(list as ProjectItem[]); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '项目加载失败'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const retry = () => { setError(''); setLoading(true); setAttempt(value => value + 1); };
  const markBusy = (id: string, pending: boolean) => setBusy(current => { const next = new Set(current); if (pending) next.add(id); else next.delete(id); return next; });

  const onDelete = async (project: ProjectItem) => {
    if (busy.has(project.id)) return;
    if (!await confirm({ title: '删除项目', description: `确定删除「${project.title || project.idea || '未命名项目'}」？项目和关联内容删除后无法恢复。`, confirmLabel: '删除项目', danger: true })) return;
    markBusy(project.id, true);
    try {
      await deleteSession(project.id);
      setProjects(current => current.filter(item => item.id !== project.id));
      toast('项目已删除', 'success');
    } catch { toast('删除失败，请重试', 'error'); }
    finally { markBusy(project.id, false); }
  };
  const onArchive = async (project: ProjectItem) => {
    if (busy.has(project.id)) return;
    markBusy(project.id, true);
    try {
      await archiveSession(project.id, !project.archived);
      setProjects(current => current.map(item => item.id === project.id ? { ...item, archived: !project.archived } : item));
      toast(project.archived ? '项目已取消归档' : '项目已归档', 'success');
    } catch { toast('归档操作失败，请重试', 'error'); }
    finally { markBusy(project.id, false); }
  };
  const filtered = projects.filter(project => Boolean(project.archived) === showArchived && (!search.trim() || (project.title || project.idea || '').toLowerCase().includes(search.trim().toLowerCase())));

  return (
    <div className="xyq-route">
      <main className="xyq-page">
        <PageHeader title="项目库" description="珍藏每一个灵感，继续你的创作。" actions={<button type="button" className="ui-button ui-button-primary" onClick={() => router.push('/')}><Plus size={16} />新建项目</button>} />
        <div className="ui-page-toolbar">
          <div className="ui-segmented" aria-label="项目范围">
            <button type="button" onClick={() => setShowArchived(false)} aria-pressed={!showArchived}>全部项目</button>
            <button type="button" onClick={() => setShowArchived(true)} aria-pressed={showArchived}>已归档</button>
          </div>
          <label className="ui-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索项目" aria-label="搜索项目" /></label>
        </div>
        {loading ? <><div className="sr-only" role="status">正在加载项目</div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div key={index} className="ui-skeleton aspect-[4/3] rounded-2xl" />)}</div></>
          : error ? <div className="ui-state" role="alert"><Film size={30} /><h2>暂时无法加载项目</h2><p>{error}</p><button type="button" className="ui-button" onClick={retry}><RefreshCw size={15} />重新加载</button></div>
          : filtered.length === 0 ? <div className="ui-state"><Film size={34} /><h2>{search ? '没有找到相关项目' : showArchived ? '暂无归档项目' : '开始你的第一个项目'}</h2><p>{search ? '试试其他名称或关键词。' : showArchived ? '归档后的项目会保留在这里，随时可以继续创作。' : '从一句灵感开始，将故事变成短片。'}</p>{!search && !showArchived && <button type="button" className="ui-button ui-button-primary" onClick={() => router.push('/')}><Plus size={16} />前往工作室</button>}</div>
          : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(project => <article key={project.id} className="ui-project-card group bg-surface rounded-2xl border border-line overflow-hidden">
              <button type="button" onClick={() => router.push(`/?session=${encodeURIComponent(project.id)}`)} className="block w-full text-left" aria-label={`打开项目 ${project.title || project.idea || '未命名项目'}`}>
                <div className="aspect-video bg-surface-soft overflow-hidden">
                  {project.cover_image ? <img src={assetUrl(project.cover_image)} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]" /> : <div className="w-full h-full flex items-center justify-center text-subtle"><Film className="w-9 h-9" /></div>}
                </div>
                <div className="p-4"><h2 className="text-sm font-medium text-ink truncate">{project.title || project.idea || '未命名项目'}</h2><div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-subtle">
                  {project.style && <span className="ui-badge">{project.style}</span>}<span>{STATUS_LABELS[project.status] || project.status}</span>{project.updated_at && <time dateTime={project.updated_at}>{new Date(project.updated_at).toLocaleDateString('zh-CN')}</time>}
                </div></div>
              </button>
              <div className="flex items-center justify-end gap-2 px-4 pb-3">
                {busy.has(project.id) && <Loader2 className="animate-spin text-subtle" size={15} aria-label="正在处理" />}
                <button type="button" onClick={() => onArchive(project)} disabled={busy.has(project.id)} className="ui-button ui-button-compact"><Archive size={13} />{project.archived ? '取消归档' : '归档'}</button>
                <button type="button" onClick={() => onDelete(project)} disabled={busy.has(project.id)} className="ui-icon-button text-danger" aria-label={`删除项目 ${project.title || project.idea || '未命名项目'}`}><Trash2 size={15} /></button>
              </div>
            </article>)}
          </div>}
      </main>
    </div>
  );
}
