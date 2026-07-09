import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import {
  ArrowLeft, Loader2, AlertTriangle, GitBranch, Globe,
  RefreshCw, Plus, Calendar, AlertCircle, FileCode, User,
} from 'lucide-react';

interface Task { id: string; name: string; assignedTo?: string; deadline?: string; progress: number; status: string; comments?: string; }
interface Monitor { id: string; url: string; lastStatus: string; sslExpiryDate?: string; domainExpiryDate?: string; lastCheckedAt?: string; }
interface ProjectDetail {
  id: string; name: string; description?: string; status: string; startDate?: string; deadline?: string;
  githubRepoUrl?: string; liveUrl?: string; stagingUrl?: string; techStack: string[];
  hostingPlatform?: string; databasePlatform?: string; deploymentPlatform?: string;
  client: { id: string; name: string; company?: string };
  tasks: Task[]; websiteMonitors: Monitor[];
}

const inputCls = 't-input w-full px-3 py-2.5 text-sm';
const rSm = { borderRadius: 'var(--radius-sm)' };
const dialogStyle = { background: 'var(--surface-card)', border: '1px solid var(--border-default)' };
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><label className="t-label">{label}</label>{children}</div>; }
function ErrBanner({ msg }: { msg: string }) { return msg ? <div className="flex items-center gap-2 text-xs p-2.5 rounded-md" style={{ background: 'rgba(243,195,178,0.2)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', ...rSm }}><AlertTriangle className="h-4 w-4 shrink-0" />{msg}</div> : null; }

function TaskBadge({ status }: { status: string }) {
  if (status === 'done')        return <span className="t-badge-online">{status}</span>;
  if (status === 'in_progress') return <span className="t-badge-idle">in progress</span>;
  return <span className="t-badge-neutral">{status}</span>;
}

export default function ProjectDetails() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [taskForm, setTaskForm] = useState({ name: '', assignedTo: '', deadline: '', progress: 0, comments: '' });

  const { data: project, isLoading, isError } = useQuery<ProjectDetail>({
    queryKey: ['project-detail', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then(r => r.data),
    enabled: !!projectId,
  });

  const { data: github, isLoading: githubLoading, refetch: refetchGithub } = useQuery<any>({
    queryKey: ['project-github', projectId],
    queryFn: () => api.get(`/projects/${projectId}/github`).then(r => r.data),
    enabled: !!projectId && !!project?.githubRepoUrl,
  });

  const triggerCheckMutation = useMutation({
    mutationFn: () => api.post('/monitoring/trigger', { projectId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-detail', projectId] }),
  });

  const createTaskMutation = useMutation({
    mutationFn: (p: any) => api.post('/tasks', p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-detail', projectId] }); setTaskOpen(false); setTaskForm({ name: '', assignedTo: '', deadline: '', progress: 0, comments: '' }); setTaskError(''); },
    onError: (e: any) => setTaskError(e.response?.data?.message || 'Failed to create task.'),
  });

  const updateTaskProgressMutation = useMutation({
    mutationFn: ({ taskId, progress }: { taskId: string; progress: number }) => api.patch(`/tasks/${taskId}/progress`, { progress }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-detail', projectId] }),
  });

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent-primary)' }} /></div>;
  if (isError || !project) return (
    <div className="text-center py-20">
      <AlertTriangle className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--status-offline)' }} />
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Failed to load project details.</p>
      <button onClick={() => navigate('/dashboard/projects')} className="t-btn-ghost text-sm mt-4">Go Back</button>
    </div>
  );

  const monitor = project.websiteMonitors[0];
  const monitorStatus = monitor?.lastStatus ?? 'unknown';
  const monitorColor = monitorStatus === 'online' ? 'var(--status-online)' : monitorStatus === 'offline' ? 'var(--status-offline)' : 'var(--status-neutral)';

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard/projects')} className="flex items-center justify-center w-9 h-9 rounded-md t-btn-ghost" style={{ minHeight: '36px', padding: 0 }} aria-label="Go back"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="t-page-title" style={{ fontSize: '1.5rem' }}>{project.name}</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Client:{' '}
            <span onClick={() => navigate(`/dashboard/clients/${project.client.id}`)} className="t-link cursor-pointer" style={{ textDecoration: 'underline' }}>
              {project.client.name}
            </span>
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column */}
        <div className="space-y-5 md:col-span-1">
          {/* Live Status */}
          <div className="t-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="t-label">Live Status</p>
              {project.liveUrl && (
                <button onClick={() => triggerCheckMutation.mutate()} disabled={triggerCheckMutation.isPending}
                  className="flex items-center justify-center w-8 h-8 rounded-md t-btn-ghost" style={{ minHeight: '32px', padding: 0 }} title="Trigger check">
                  <RefreshCw className={`h-4 w-4 ${triggerCheckMutation.isPending ? 'animate-spin' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              )}
            </div>
            {project.liveUrl ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Ping Monitor</span>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: monitorColor, boxShadow: monitorStatus === 'online' ? '0 0 8px var(--status-online)' : 'none' }} />
                    <span className="text-xs font-bold capitalize" style={{ color: 'var(--text-primary)' }}>{monitorStatus}</span>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-tertiary)' }}>Live URL</span>
                    <a href={project.liveUrl} target="_blank" rel="noreferrer" className="t-link truncate max-w-[150px]">{project.liveUrl}</a>
                  </div>
                  {monitor?.sslExpiryDate && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-tertiary)' }}>SSL Expiry</span>
                      <span className="font-semibold" style={{ color: new Date(monitor.sslExpiryDate).getTime() - Date.now() < 30 * 86400000 ? 'var(--status-idle)' : 'var(--text-primary)' }}>
                        {new Date(monitor.sslExpiryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {monitor?.domainExpiryDate && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-tertiary)' }}>Domain Expiry</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{new Date(monitor.domainExpiryDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {monitor?.lastCheckedAt && (
                    <div className="flex justify-between pt-1" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>
                      <span>Last audited</span>
                      <span>{new Date(monitor.lastCheckedAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="t-empty py-6">
                <Globe className="h-6 w-6" style={{ color: 'var(--border-default)' }} />
                <span className="text-xs">No live URL configured</span>
              </div>
            )}
          </div>

          {/* Specs */}
          <div className="t-card p-5 space-y-3">
            <p className="t-label">Specifications</p>
            <div className="space-y-2 text-xs pt-1" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              {[
                ['Hosting', project.hostingPlatform],
                ['Database', project.databasePlatform],
                ['CI/CD', project.deploymentPlatform],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span style={{ color: 'var(--text-tertiary)' }}>{k}</span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{v || '—'}</span>
                </div>
              ))}
            </div>
            {project.techStack.length > 0 && (
              <div className="pt-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <p className="t-label">Technology Stack</p>
                <div className="flex flex-wrap gap-1">
                  {project.techStack.map(t => <span key={t} className="t-tech-pill">{t}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5 md:col-span-2">
          {/* GitHub */}
          {project.githubRepoUrl && (
            <div className="t-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>GitHub Repository</p>
              </div>
              {githubLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent-primary)' }} /></div>
              ) : github ? (
                <div className="space-y-4">
                  {/* Latest commit */}
                  <div className="p-3 rounded-md" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="t-label">Latest Commit</p>
                      {github.latestCommit && (
                        <a href={`${project.githubRepoUrl}/commit/${github.latestCommit.sha}`} target="_blank" rel="noreferrer" className="t-link text-[10px] font-mono font-bold">
                          {github.latestCommit.sha.slice(0, 7)}
                        </a>
                      )}
                    </div>
                    {github.latestCommit ? (
                      <div>
                        <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>{github.latestCommit.message}</p>
                        <div className="flex items-center gap-1.5 mt-1" style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>
                          <User className="h-3 w-3" /><span>{github.latestCommit.author}</span><span>·</span><span>{new Date(github.latestCommit.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ) : <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>No commits returned.</p>}
                  </div>

                  {/* Deployments */}
                  <div className="space-y-2">
                    <p className="t-label">Deployments</p>
                    {github.deployments?.length > 0 ? (
                      <div className="space-y-2">
                        {github.deployments.map((dep: any) => (
                          <div key={dep.id} className="flex items-center justify-between p-2.5 text-xs rounded-md"
                            style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                            <span className="font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>{dep.environment}</span>
                            <div className="flex items-center gap-2">
                              {dep.status === 'success' ? <span className="t-badge-online">{dep.status}</span> : <span className="t-badge-offline">{dep.status}</span>}
                              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>{new Date(dep.updatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 text-xs rounded-md" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                        <AlertCircle className="h-4 w-4 shrink-0" />No environment deployments found.
                      </div>
                    )}
                  </div>
                </div>
              ) : <p className="text-xs text-center py-6" style={{ color: 'var(--text-tertiary)' }}>Could not load GitHub data.</p>}
            </div>
          )}

          {/* Tasks */}
          <div className="t-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Milestones &amp; Tasks</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Drag sliders to update completion</p>
              </div>
              <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
                <DialogTrigger asChild>
                  <button className="t-btn-ghost text-xs flex items-center gap-1.5" style={{ minHeight: '32px', padding: '0 0.75rem', borderRadius: 'var(--radius-sm)' }}><Plus className="h-3.5 w-3.5" />Task</button>
                </DialogTrigger>
                <DialogContent style={dialogStyle}>
                  <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Add Project Task</DialogTitle></DialogHeader>
                  <ErrBanner msg={taskError} />
                  <form onSubmit={e => { e.preventDefault(); setTaskError(''); if (!taskForm.name) { setTaskError('Task name is required.'); return; } createTaskMutation.mutate({ ...taskForm, projectId, progress: Number(taskForm.progress) }); }} className="space-y-4 pt-2">
                    <Field label="Task Name *"><input className={inputCls} style={rSm} placeholder="Setup database schema migrations" value={taskForm.name} onChange={e => setTaskForm(f => ({ ...f, name: e.target.value }))} required /></Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Assigned To"><input className={inputCls} style={rSm} placeholder="Dev lead" value={taskForm.assignedTo} onChange={e => setTaskForm(f => ({ ...f, assignedTo: e.target.value }))} /></Field>
                      <Field label="Deadline"><input type="date" className={inputCls} style={rSm} value={taskForm.deadline} onChange={e => setTaskForm(f => ({ ...f, deadline: e.target.value }))} /></Field>
                    </div>
                    <div className="space-y-1.5">
                      <label className="t-label">Initial Progress ({taskForm.progress}%)</label>
                      <input type="range" min="0" max="100" className="w-full h-1.5 rounded-full cursor-pointer" style={{ accentColor: 'var(--accent-primary)' }} value={taskForm.progress} onChange={e => setTaskForm(f => ({ ...f, progress: Number(e.target.value) }))} />
                    </div>
                    <Field label="Comments"><textarea className={`${inputCls} h-16 resize-none`} style={rSm} value={taskForm.comments} onChange={e => setTaskForm(f => ({ ...f, comments: e.target.value }))} /></Field>
                    <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setTaskOpen(false)}>Cancel</button><button type="submit" disabled={createTaskMutation.isPending} className="t-btn-primary text-sm">{createTaskMutation.isPending ? 'Saving…' : 'Add Task'}</button></div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {project.tasks.length > 0 ? (
              <div className="space-y-4">
                {project.tasks.map(task => (
                  <div key={task.id} className="p-4 rounded-md space-y-3"
                    style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{task.name}</p>
                        {task.assignedTo && <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Assigned: {task.assignedTo}</span>}
                      </div>
                      <TaskBadge status={task.status} />
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="range" min="0" max="100" className="flex-1 h-1.5 rounded-full cursor-pointer" style={{ accentColor: 'var(--accent-primary)' }} value={task.progress} onChange={e => updateTaskProgressMutation.mutate({ taskId: task.id, progress: Number(e.target.value) })} />
                      <span className="text-xs font-bold font-mono w-9 text-right" style={{ color: 'var(--text-primary)' }}>{task.progress}%</span>
                    </div>
                    <Progress value={task.progress} className="h-1.5" />
                    {task.deadline && (
                      <div className="flex items-center gap-1 justify-end" style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>
                        <Calendar className="h-3 w-3" /><span>Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="t-empty py-8">
                <span className="text-xs">No tasks allocated to this project.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
