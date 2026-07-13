import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import {
  ArrowLeft, Loader2, AlertTriangle, GitBranch, Globe,
  RefreshCw, Plus, Calendar, AlertCircle, FileCode, User,
  KeyRound, Users, ShieldAlert, DollarSign, Send, Trash2,
  Lock, Eye, EyeOff, Check, Copy, CheckSquare, Clock
} from 'lucide-react';

interface Task { id: string; name: string; assignedTo?: string; deadline?: string; progress: number; status: string; comments?: string; }
interface Monitor { id: string; url: string; lastStatus: string; sslExpiryDate?: string; domainExpiryDate?: string; lastCheckedAt?: string; }
interface Assignment { id: string; roleOnProject?: string; accessLevel: string; dueDate?: string; employee: { id: string; name: string; email: string } }
interface Contract { id: string; title: string; contractStatus: string; startDate: string; endDate?: string; billingModel: string; fileUrl?: string }
interface Account { id: string; provider: string; username: string; env: string }
interface Tool { id: string; vendor: string; cost: number; billingCycle: string; renewalDate: string }
interface ProgressUpdate { id: string; updateText: string; progress: number; createdAt: string }
interface Env { id: string; name: string; url?: string }
interface Secret { id: string; secretType: string; username?: string; encryptedValue: string; tool?: string; environment?: string; owner?: string }
interface Collection { id: string; provider?: string; rotationPolicy?: string; lastRotationDate?: string; secrets: Secret[] }

interface ProjectDetail {
  id: string; name: string; description?: string; status: string; startDate?: string; deadline?: string;
  githubRepoUrl?: string; liveUrl?: string; stagingUrl?: string; techStack: string[];
  hostingPlatform?: string; databasePlatform?: string; deploymentPlatform?: string;
  client: { id: string; name: string; company?: string };
  tasks: Task[]; websiteMonitors: Monitor[];
  assignments: Assignment[];
  contracts: Contract[];
  accounts: Account[];
  tools: Tool[];
  progressUpdates: ProgressUpdate[];
  environments: Env[];
  vaultCollections: Collection[];
}

const inputCls = 't-input w-full px-3 py-2 text-sm';
const rSm = { borderRadius: 'var(--radius-sm)' };
const dialogStyle = { background: 'var(--surface-card)', border: '1px solid var(--border-default)' };

function Field({ label, children }: { label: string; children: React.ReactNode }) { 
  return <div className="space-y-1"><label className="t-label">{label}</label>{children}</div>; 
}

function ErrBanner({ msg }: { msg: string }) { 
  return msg ? (
    <div className="flex items-center gap-2 text-xs p-2.5 rounded-md" style={{ background: 'rgba(243,195,178,0.2)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', ...rSm }}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {msg}
    </div>
  ) : null; 
}

export default function ProjectDetails() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  
  // Retrieve current user role from outlet context
  const { user } = useOutletContext<{ user: any }>();
  const role = user?.role || 'employee';

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [taskForm, setTaskForm] = useState({ name: '', assignedTo: '', deadline: '', progress: 0, comments: '' });

  // CRUD Dialog States
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ employeeId: '', roleOnProject: 'Developer', accessLevel: 'view', dueDate: '' });
  const [assignError, setAssignError] = useState('');

  const [contractOpen, setContractOpen] = useState(false);
  const [contractForm, setContractForm] = useState({ title: '', startDate: '', endDate: '', billingModel: 'fixed_price', fileUrl: '' });
  const [contractError, setContractError] = useState('');

  const [envOpen, setEnvOpen] = useState(false);
  const [envForm, setEnvForm] = useState({ name: 'development', url: '' });

  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ provider: '', username: '', env: 'development' });

  const [toolOpen, setToolOpen] = useState(false);
  const [toolForm, setToolForm] = useState({ vendor: '', cost: '', billingCycle: 'monthly', renewalDate: '' });

  const [updateText, setUpdateText] = useState('');
  const [updateProgress, setUpdateProgress] = useState(0);

  // Vault / Secrets Reveal States
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealPassword, setRevealPassword] = useState('');
  const [revealError, setRevealError] = useState('');
  const [revealingSecretId, setRevealingSecretId] = useState<string | null>(null);
  const [decryptedSecrets, setDecryptedSecrets] = useState<Record<string, string>>({});
  const [confirmedPassword, setConfirmedPassword] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Request Access State
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestScope, setRequestScope] = useState('collection');
  const [requestDuration, setRequestDuration] = useState('24');
  const [requestError, setRequestError] = useState('');

  // Lock Secret State
  const [secretOpen, setSecretOpen] = useState(false);
  const [secretForm, setSecretForm] = useState({ collectionId: '', secretType: 'password', username: '', secretValue: '', tool: '', environment: 'development', owner: 'Owner' });
  const [secretError, setSecretError] = useState('');

  // Queries
  const { data: project, isLoading, isError } = useQuery<ProjectDetail>({
    queryKey: ['project-detail', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then(r => r.data),
    enabled: !!projectId,
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ['users-list'],
    queryFn: () => api.get('/auth/users').then(r => r.data),
    enabled: ['owner', 'admin'].includes(role),
  });

  const { data: github, refetch: refetchGithub } = useQuery<any>({
    queryKey: ['project-github', projectId],
    queryFn: () => api.get(`/projects/${projectId}/github`).then(r => r.data),
    enabled: !!projectId && !!project?.githubRepoUrl,
  });

  // Mutations
  const triggerCheckMutation = useMutation({
    mutationFn: () => api.post('/monitoring/trigger', { projectId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-detail', projectId] }),
  });

  const completeProjectMutation = useMutation({
    mutationFn: () => api.put(`/projects/${projectId}`, { status: 'completed' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-detail', projectId] }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, progress }: { taskId: string; progress: number }) => 
      api.patch(`/tasks/${taskId}/progress`, { progress }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-detail', projectId] }),
  });

  const createTaskMutation = useMutation({
    mutationFn: (p: any) => api.post('/tasks', p),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['project-detail', projectId] }); 
      setTaskOpen(false); 
      setTaskForm({ name: '', assignedTo: '', deadline: '', progress: 0, comments: '' }); 
      setTaskError(''); 
    },
    onError: (e: any) => setTaskError(e.response?.data?.message || 'Failed to create task.'),
  });

  const assignMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/projects/${projectId}/assign`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-detail', projectId] });
      setAssignOpen(false);
      setAssignForm({ employeeId: '', roleOnProject: 'Developer', accessLevel: 'view', dueDate: '' });
      setAssignError('');
    },
    onError: (e: any) => setAssignError(e.response?.data?.message || 'Assignment failed.'),
  });

  const removeAssignMutation = useMutation({
    mutationFn: (assignId: string) => api.delete(`/projects/assignments/${assignId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-detail', projectId] }),
  });

  const addContractMutation = useMutation({
    mutationFn: (p: any) => api.post(`/projects/${projectId}/contracts`, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-detail', projectId] });
      setContractOpen(false);
      setContractForm({ title: '', startDate: '', endDate: '', billingModel: 'fixed_price', fileUrl: '' });
      setContractError('');
    },
  });

  const addEnvMutation = useMutation({
    mutationFn: (p: any) => api.post(`/projects/${projectId}/environments`, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-detail', projectId] });
      setEnvOpen(false);
      setEnvForm({ name: 'development', url: '' });
    },
  });

  const addAccountMutation = useMutation({
    mutationFn: (p: any) => api.post(`/projects/${projectId}/accounts`, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-detail', projectId] });
      setAccountOpen(false);
      setAccountForm({ provider: '', username: '', env: 'development' });
    },
  });

  const addToolMutation = useMutation({
    mutationFn: (p: any) => api.post(`/projects/${projectId}/tools`, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-detail', projectId] });
      setToolOpen(false);
      setToolForm({ vendor: '', cost: '', billingCycle: 'monthly', renewalDate: '' });
    },
  });

  const addUpdateMutation = useMutation({
    mutationFn: (p: any) => api.post(`/projects/${projectId}/updates`, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-detail', projectId] });
      setUpdateText('');
    },
  });

  const deleteSubMutation = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) => api.delete(`/projects/${type}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-detail', projectId] }),
  });

  const requestAccessMutation = useMutation({
    mutationFn: (p: any) => api.post('/credentials/requests', p),
    onSuccess: () => {
      setRequestOpen(false);
      setRequestError('');
      alert('Access request submitted successfully.');
    },
    onError: (e: any) => setRequestError(e.response?.data?.message || 'Access request failed.'),
  });

  const lockSecretMutation = useMutation({
    mutationFn: (p: any) => api.post(`/credentials/collections/${p.collectionId}/secrets`, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-detail', projectId] });
      setSecretOpen(false);
      setSecretError('');
    },
    onError: (e: any) => setSecretError(e.response?.data?.message || 'Failed to encrypt secret.'),
  });

  const removeSecretMutation = useMutation({
    mutationFn: (secretId: string) => api.delete(`/credentials/secrets/${secretId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-detail', projectId] }),
  });

  // Decryption Reveal Submit
  const handleRevealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRevealError('');
    try {
      const { data } = await api.post(`/credentials/secrets/${revealingSecretId}/reveal`, {
        confirmPassword: revealPassword,
      });
      setDecryptedSecrets({ ...decryptedSecrets, [revealingSecretId!]: data.decryptedValue });
      setConfirmedPassword(revealPassword);
      setRevealOpen(false);
      setRevealPassword('');
    } catch (err: any) {
      setRevealError(err.response?.data?.message || 'Incorrect password.');
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignored */ }
  };

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} /></div>;
  if (isError || !project) return (
    <div className="text-center py-20">
      <AlertTriangle className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--status-offline)' }} />
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Failed to load project details.</p>
      <button onClick={() => navigate('/dashboard/projects')} className="t-btn-ghost text-sm mt-4">Go Back</button>
    </div>
  );

  const monitor = project.websiteMonitors?.[0];
  const monitorStatus = monitor?.lastStatus ?? 'unknown';
  const monitorColor = monitorStatus === 'online' ? 'var(--status-online)' : monitorStatus === 'offline' ? 'var(--status-offline)' : 'var(--status-neutral)';

  return (
    <div className="space-y-6 py-4">
      {/* Top Warning Banner if project complete but credentials need rotation */}
      {project.status === 'completed_pending_rotation' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
          <ShieldAlert className="h-5 w-5 shrink-0 text-orange-500 animate-pulse" />
          <div className="text-xs">
            <span className="font-bold">Credential Rotation Required:</span> This project was marked completed. Standard security protocols require immediately rotating all project credentials listed in the Vault below.
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard/projects')} className="flex items-center justify-center w-9 h-9 rounded-md t-btn-ghost" style={{ minHeight: '36px', padding: 0 }} aria-label="Go back"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="t-page-title" style={{ fontSize: '1.4rem' }}>{project.name}</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Client: <span className="font-bold text-[var(--text-primary)]">{project.client.name}</span>
              {project.client.company && <span className="text-[var(--text-tertiary)]"> · {project.client.company}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Gated project completion trigger */}
          {['owner', 'admin'].includes(role) && project.status === 'active' && (
            <button
              onClick={() => {
                if (confirm('Mark this project as completed? This will trigger automated credential rotation reminders.')) {
                  completeProjectMutation.mutate();
                }
              }}
              disabled={completeProjectMutation.isPending}
              className="t-btn-primary flex items-center gap-1.5 text-xs py-2 px-3"
            >
              <CheckSquare size={14} /> Complete Project
            </button>
          )}
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
            project.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {project.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column (Infrastructure, metadata, environments) */}
        <div className="space-y-5 md:col-span-1">
          {/* Live Monitor */}
          <div className="t-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="t-label">Live Monitor</p>
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
                </div>
              </div>
            ) : (
              <div className="t-empty py-4 text-xs">No live URL configured</div>
            )}
          </div>

          {/* Connected Environments */}
          <div className="t-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="t-label">Environments</p>
              {['owner', 'admin'].includes(role) && (
                <Dialog open={envOpen} onOpenChange={setEnvOpen}>
                  <DialogTrigger asChild>
                    <button onClick={() => setEnvOpen(true)} className="flex items-center justify-center w-7 h-7 rounded t-btn-ghost" style={{ padding: 0 }}><Plus size={14} /></button>
                  </DialogTrigger>
                  <DialogContent style={dialogStyle}>
                    <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Add Environment</DialogTitle></DialogHeader>
                    <form onSubmit={e => { e.preventDefault(); addEnvMutation.mutate({ ...envForm, projectId }); }} className="space-y-4 pt-2">
                      <Field label="Environment Name"><input className={inputCls} placeholder="staging, production" value={envForm.name} onChange={e => setEnvForm({ ...envForm, name: e.target.value })} /></Field>
                      <Field label="URL"><input className={inputCls} placeholder="https://staging.acme.com" value={envForm.url} onChange={e => setEnvForm({ ...envForm, url: e.target.value })} /></Field>
                      <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setEnvOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Add</button></div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {project.environments.length > 0 ? (
              <div className="space-y-2 text-xs">
                {project.environments.map(env => (
                  <div key={env.id} className="flex justify-between items-center p-2 rounded bg-[var(--surface-sunken)] border border-[var(--border-subtle)]">
                    <div>
                      <span className="font-bold text-[var(--text-primary)] capitalize">{env.name}</span>
                      {env.url && <a href={env.url} target="_blank" rel="noreferrer" className="t-link block text-[10px] mt-0.5 truncate max-w-[170px]">{env.url}</a>}
                    </div>
                    {['owner', 'admin'].includes(role) && (
                      <button onClick={() => deleteSubMutation.mutate({ type: 'environments', id: env.id })} className="text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="text-xs italic text-[var(--text-tertiary)]">No environments configured</p>}
          </div>

          {/* Infrastructure Accounts */}
          <div className="t-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="t-label">Infrustructure Accounts</p>
              {['owner', 'admin'].includes(role) && (
                <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
                  <DialogTrigger asChild>
                    <button onClick={() => setAccountOpen(true)} className="flex items-center justify-center w-7 h-7 rounded t-btn-ghost" style={{ padding: 0 }}><Plus size={14} /></button>
                  </DialogTrigger>
                  <DialogContent style={dialogStyle}>
                    <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Add Connected Account</DialogTitle></DialogHeader>
                    <form onSubmit={e => { e.preventDefault(); addAccountMutation.mutate({ ...accountForm, projectId }); }} className="space-y-4 pt-2">
                      <Field label="Provider"><input className={inputCls} placeholder="AWS, Vercel, Heroku" value={accountForm.provider} onChange={e => setAccountForm({ ...accountForm, provider: e.target.value })} /></Field>
                      <Field label="Username / Resource ID"><input className={inputCls} placeholder="admin@acme" value={accountForm.username} onChange={e => setAccountForm({ ...accountForm, username: e.target.value })} /></Field>
                      <Field label="Environment">
                        <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={accountForm.env} onChange={e => setAccountForm({ ...accountForm, env: e.target.value })}>
                          <option value="development">Development</option>
                          <option value="staging">Staging</option>
                          <option value="production">Production</option>
                        </select>
                      </Field>
                      <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setAccountOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Add</button></div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {project.accounts.length > 0 ? (
              <div className="space-y-2 text-xs">
                {project.accounts.map(acc => (
                  <div key={acc.id} className="flex justify-between items-center p-2.5 rounded bg-[var(--surface-sunken)] border border-[var(--border-subtle)]">
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">{acc.provider}</p>
                      <p className="text-[10px] text-[var(--text-tertiary)]">{acc.username} ({acc.env})</p>
                    </div>
                    {['owner', 'admin'].includes(role) && (
                      <button onClick={() => deleteSubMutation.mutate({ type: 'accounts', id: acc.id })} className="text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="text-xs italic text-[var(--text-tertiary)]">No accounts connected</p>}
          </div>
        </div>

        {/* Right Column (Tasks, Vault Secrets, Assignments, Progress) */}
        <div className="space-y-5 md:col-span-2">
          {/* PROJECT VAULT & GRANULAR DECRYPTION SECTIONS */}
          <div className="t-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <KeyRound size={15} style={{ color: 'var(--accent)' }} /> Scoped Project Vault
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>AES-256-GCM application level encrypted credentials</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Employee: Request access button */}
                {role === 'employee' && (
                  <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
                    <DialogTrigger asChild>
                      <button className="t-btn-secondary py-1 px-3 text-xs flex items-center gap-1">
                        <Lock size={12} /> Request Reveal Approval
                      </button>
                    </DialogTrigger>
                    <DialogContent style={dialogStyle}>
                      <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Submit Secret Access Request</DialogTitle></DialogHeader>
                      <ErrBanner msg={requestError} />
                      <form onSubmit={e => { e.preventDefault(); requestAccessMutation.mutate({ projectId, secretScope: requestScope, durationHours: Number(requestDuration) }); }} className="space-y-4 pt-2">
                        <Field label="Request Scope">
                          <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={requestScope} onChange={e => setRequestScope(e.target.value)}>
                            <option value="collection">Full Vault Collection</option>
                            <option value="api_keys">API Keys Only</option>
                          </select>
                        </Field>
                        <Field label="Desired Access Duration (Hours)">
                          <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={requestDuration} onChange={e => setRequestDuration(e.target.value)}>
                            <option value="1">1 Hour</option>
                            <option value="4">4 Hours</option>
                            <option value="12">12 Hours</option>
                            <option value="24">24 Hours (Default)</option>
                          </select>
                        </Field>
                        <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setRequestOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Submit Request</button></div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}

                {/* Owner/Admin: Lock secret button */}
                {['owner', 'admin'].includes(role) && project.vaultCollections?.[0] && (
                  <button
                    onClick={() => {
                      setSecretForm({ ...secretForm, collectionId: project.vaultCollections[0].id });
                      setSecretOpen(true);
                    }}
                    className="t-btn-ghost py-1 px-2.5 text-xs flex items-center gap-1"
                  >
                    <Plus size={13} /> Lock Secret
                  </button>
                )}
              </div>
            </div>

            {/* Lock secret modal */}
            <Dialog open={secretOpen} onOpenChange={setSecretOpen}>
              <DialogContent style={dialogStyle}>
                <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Lock Secured Credential</DialogTitle></DialogHeader>
                <ErrBanner msg={secretError} />
                <form onSubmit={e => { e.preventDefault(); lockSecretMutation.mutate(secretForm); }} className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Username / ID"><input className={inputCls} placeholder="aws-user" value={secretForm.username} onChange={e => setSecretForm({ ...secretForm, username: e.target.value })} /></Field>
                    <Field label="Secret Type">
                      <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={secretForm.secretType} onChange={e => setSecretForm({ ...secretForm, secretType: e.target.value })}>
                        <option value="password">Password</option>
                        <option value="api_key">API Key / Token</option>
                        <option value="ssh_key">SSH Key</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Plaintext Secret Value"><input type="password" className={inputCls} placeholder="Enter secret..." value={secretForm.secretValue} onChange={e => setSecretForm({ ...secretForm, secretValue: e.target.value })} required /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tool / Provider"><input className={inputCls} placeholder="Vercel, AWS" value={secretForm.tool} onChange={e => setSecretForm({ ...secretForm, tool: e.target.value })} /></Field>
                    <Field label="Environment">
                      <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={secretForm.environment} onChange={e => setSecretForm({ ...secretForm, environment: e.target.value })}>
                        <option value="development">Development</option>
                        <option value="staging">Staging</option>
                        <option value="production">Production</option>
                      </select>
                    </Field>
                  </div>
                  <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setSecretOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Encrypt &amp; Lock</button></div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Decrypt Password Confirmation Modal */}
            <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
              <DialogContent style={dialogStyle}>
                <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Re-authenticate Reveal Action</DialogTitle></DialogHeader>
                <p className="text-xs text-[var(--text-secondary)]">For security audit safety, please confirm your login password before revealing plaintext credentials.</p>
                <ErrBanner msg={revealError} />
                <form onSubmit={handleRevealSubmit} className="space-y-4 pt-2">
                  <Field label="Confirm Password *">
                    <input type="password" className={inputCls} placeholder="••••••••" value={revealPassword} onChange={e => setRevealPassword(e.target.value)} required />
                  </Field>
                  <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setRevealOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Decrypted Reveal</button></div>
                </form>
              </DialogContent>
            </Dialog>

            {role === 'finance' ? (
              <div className="flex items-center gap-2 p-3 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-md">
                <AlertCircle className="h-4 w-4 shrink-0" /> Financial roles are restricted from inspecting project credentials.
              </div>
            ) : project.vaultCollections?.[0]?.secrets?.length > 0 ? (
              <div className="space-y-3">
                {project.vaultCollections[0].secrets.map(sec => {
                  const val = decryptedSecrets[sec.id];
                  return (
                    <div key={sec.id} className="p-3 bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-md text-xs flex items-center justify-between gap-3">
                      <div className="truncate">
                        <span className="font-bold text-[var(--text-primary)] uppercase mr-2 text-[9px] px-1 py-0.5 rounded bg-[var(--surface-body)] border border-[var(--border-subtle)]">
                          {sec.secretType}
                        </span>
                        <span className="font-mono text-[var(--text-secondary)]">{sec.username || 'API Key'}</span>
                        <span className="text-[var(--text-tertiary)] block text-[10px] mt-0.5">{sec.tool || 'Infrastructure'} ({sec.environment})</span>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {val ? (
                          <div className="flex items-center gap-1 bg-[var(--surface-body)] border border-[var(--border-subtle)] py-1 px-2 rounded font-mono">
                            <span className="text-[var(--accent)] font-semibold select-all text-xs">{val}</span>
                            <button onClick={() => handleCopy(sec.id, val)} className="text-[var(--text-tertiary)] ml-1 hover:text-[var(--text-primary)]">
                              {copiedId === sec.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-[var(--text-tertiary)] select-none">••••••••</span>
                        )}

                        <button
                          onClick={async () => {
                            if (val) {
                              const copy = { ...decryptedSecrets };
                              delete copy[sec.id];
                              setDecryptedSecrets(copy);
                            } else {
                              if (confirmedPassword) {
                                try {
                                  const { data } = await api.post(`/credentials/secrets/${sec.id}/reveal`, {
                                    confirmPassword: confirmedPassword,
                                  });
                                  setDecryptedSecrets({ ...decryptedSecrets, [sec.id]: data.decryptedValue });
                                } catch (err) {
                                  setConfirmedPassword(null);
                                  setRevealingSecretId(sec.id);
                                  setRevealOpen(true);
                                }
                              } else {
                                setRevealingSecretId(sec.id);
                                setRevealOpen(true);
                              }
                            }
                          }}
                          className="t-btn-ghost py-1 px-2 text-xs flex items-center gap-1"
                        >
                          {val ? <EyeOff size={13} /> : <Eye size={13} />}
                          <span>{val ? 'Hide' : 'Reveal'}</span>
                        </button>

                        {['owner', 'admin'].includes(role) && (
                          <button onClick={() => removeSecretMutation.mutate(sec.id)} className="text-red-400 hover:text-red-300 ml-1"><Trash2 size={13} /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="t-empty py-6 text-xs flex flex-col gap-2">
                <Lock size={20} className="text-[var(--border-default)]" />
                <span>No secrets locked for this project.</span>
              </div>
            )}
          </div>

          {/* STAFFING & ASSIGNMENTS TABLE */}
          <div className="t-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <Users size={15} style={{ color: 'var(--accent)' }} /> Active Assignees &amp; Staffing
              </p>

              {['owner', 'admin'].includes(role) && (
                <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                  <DialogTrigger asChild>
                    <button className="t-btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"><Plus size={13} /> Assign Staff</button>
                  </DialogTrigger>
                  <DialogContent style={dialogStyle}>
                    <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Assign Staff member</DialogTitle></DialogHeader>
                    <ErrBanner msg={assignError} />
                    <form onSubmit={e => { e.preventDefault(); assignMutation.mutate(assignForm); }} className="space-y-4 pt-2">
                      <Field label="Employee">
                        <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={assignForm.employeeId} onChange={e => setAssignForm({ ...assignForm, employeeId: e.target.value })} required>
                          <option value="">Select a user</option>
                          {users?.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                        </select>
                      </Field>
                      <Field label="Role on Project"><input className={inputCls} placeholder="Developer, Analyst" value={assignForm.roleOnProject} onChange={e => setAssignForm({ ...assignForm, roleOnProject: e.target.value })} /></Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Access level">
                          <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={assignForm.accessLevel} onChange={e => setAssignForm({ ...assignForm, accessLevel: e.target.value })}>
                            <option value="view">Read / View</option>
                            <option value="edit">Edit Details</option>
                            <option value="admin">Project Admin</option>
                          </select>
                        </Field>
                        <Field label="Assignment Deadline"><input type="date" className={inputCls} value={assignForm.dueDate} onChange={e => setAssignForm({ ...assignForm, dueDate: e.target.value })} /></Field>
                      </div>
                      <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setAssignOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Assign</button></div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {project.assignments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[var(--text-tertiary)] font-bold">
                      <th className="py-2">Employee</th>
                      <th className="py-2">Project Role</th>
                      <th className="py-2">Permissions</th>
                      <th className="py-2">Due Date</th>
                      {['owner', 'admin'].includes(role) && <th className="py-2 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {project.assignments.map(assign => (
                      <tr key={assign.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)]">
                        <td className="py-2 font-semibold text-[var(--text-primary)]">{assign.employee.name}</td>
                        <td className="py-2 text-[var(--text-secondary)]">{assign.roleOnProject || 'Team Member'}</td>
                        <td className="py-2 capitalize">{assign.accessLevel}</td>
                        <td className="py-2 text-[var(--text-tertiary)]">{assign.dueDate ? new Date(assign.dueDate).toLocaleDateString() : 'Continuous'}</td>
                        {['owner', 'admin'].includes(role) && (
                          <td className="py-2 text-right">
                            <button onClick={() => removeAssignMutation.mutate(assign.id)} className="text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-xs italic text-[var(--text-tertiary)]">No staff members currently assigned.</p>}
          </div>

          {/* Project Contracts */}
          <div className="t-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <FileCode size={15} style={{ color: 'var(--accent)' }} /> Project SOW / Contracts
              </p>
              {['owner', 'admin'].includes(role) && (
                <Dialog open={contractOpen} onOpenChange={setContractOpen}>
                  <DialogTrigger asChild>
                    <button onClick={() => setContractOpen(true)} className="flex items-center justify-center w-7 h-7 rounded t-btn-ghost" style={{ padding: 0 }}><Plus size={14} /></button>
                  </DialogTrigger>
                  <DialogContent style={dialogStyle}>
                    <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Add Project SOW / Contract</DialogTitle></DialogHeader>
                    <form onSubmit={e => { e.preventDefault(); addContractMutation.mutate({ ...contractForm, projectId }); }} className="space-y-4 pt-2">
                      <Field label="Contract Title"><input className={inputCls} placeholder="SOW Phase 1, NDA" value={contractForm.title} onChange={e => setContractForm({ ...contractForm, title: e.target.value })} required /></Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Start Date"><input type="date" className={inputCls} value={contractForm.startDate} onChange={e => setContractForm({ ...contractForm, startDate: e.target.value })} required /></Field>
                        <Field label="End Date"><input type="date" className={inputCls} value={contractForm.endDate} onChange={e => setContractForm({ ...contractForm, endDate: e.target.value })} /></Field>
                      </div>
                      <Field label="Billing Model">
                        <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={contractForm.billingModel} onChange={e => setContractForm({ ...contractForm, billingModel: e.target.value })}>
                          <option value="fixed_price">Fixed Price</option>
                          <option value="time_and_materials">Time and Materials</option>
                          <option value="retainer">Retainer</option>
                        </select>
                      </Field>
                      <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setContractOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Add</button></div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {project.contracts.length > 0 ? (
              <div className="space-y-2 text-xs">
                {project.contracts.map(con => (
                  <div key={con.id} className="flex justify-between items-center p-2.5 rounded bg-[var(--surface-sunken)] border border-[var(--border-subtle)]">
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">{con.title}</p>
                      <p className="text-[10px] text-[var(--text-tertiary)]">Model: {con.billingModel.replace(/_/g, ' ')} ({new Date(con.startDate).toLocaleDateString()})</p>
                    </div>
                    {['owner', 'admin'].includes(role) && (
                      <button onClick={() => deleteSubMutation.mutate({ type: 'contracts', id: con.id })} className="text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="text-xs italic text-[var(--text-tertiary)]">No contracts uploaded</p>}
          </div>

          {/* Progress Updates Log */}
          <div className="t-card p-5 space-y-4">
            <p className="font-semibold text-sm flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              <Clock size={15} style={{ color: 'var(--accent)' }} /> Operational Updates Log
            </p>
            
            {/* Add progress update form */}
            <form onSubmit={e => { e.preventDefault(); if (updateText) addUpdateMutation.mutate({ updateText, progress: Number(updateProgress), updaterId: user.id }); }} className="space-y-3">
              <textarea
                value={updateText}
                onChange={e => setUpdateText(e.target.value)}
                placeholder="Log operational update..."
                className="t-input w-full p-2.5 text-xs h-14 resize-none"
                style={{ borderRadius: 'var(--radius-sm)' }}
                required
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-tertiary)]">Progress:</span>
                  <input type="range" min="0" max="100" className="h-1 rounded-full w-24" style={{ accentColor: 'var(--accent-primary)' }} value={updateProgress} onChange={e => setUpdateProgress(Number(e.target.value))} />
                  <span className="text-[10px] font-bold">{updateProgress}%</span>
                </div>
                <button type="submit" className="t-btn-primary py-1 px-3 text-[10px] flex items-center gap-1">
                  <Send size={10} /> Log Update
                </button>
              </div>
            </form>

            {project.progressUpdates.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                {project.progressUpdates.map(upd => (
                  <div key={upd.id} className="p-2.5 rounded bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[11px] leading-relaxed">
                    <p style={{ color: 'var(--text-primary)' }}>{upd.updateText}</p>
                    <div className="flex justify-between items-center mt-1 text-[9px] text-[var(--text-tertiary)]">
                      <span>{new Date(upd.createdAt).toLocaleString()}</span>
                      <span className="font-bold">Progress: {upd.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs italic text-[var(--text-tertiary)]">No updates logged yet</p>}
          </div>

          {/* Milestones & Tasks */}
          <div className="t-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Milestones &amp; Tasks</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Set task progress</p>
              </div>
              <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
                <DialogTrigger asChild>
                  <button className="t-btn-ghost text-xs flex items-center gap-1.5" style={{ minHeight: '32px', padding: '0 0.75rem', borderRadius: 'var(--radius-sm)' }}><Plus className="h-3.5 w-3.5" />Task</button>
                </DialogTrigger>
                <DialogContent style={dialogStyle}>
                  <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Add Project Task</DialogTitle></DialogHeader>
                  <ErrBanner msg={taskError} />
                  <form onSubmit={e => { e.preventDefault(); setTaskError(''); if (!taskForm.name) { setTaskError('Task name is required.'); return; } createTaskMutation.mutate({ ...taskForm, projectId, progress: Number(taskForm.progress) }); }} className="space-y-4 pt-2">
                    <Field label="Task Name *"><input className={inputCls} style={rSm} placeholder="Setup schema migrations" value={taskForm.name} onChange={e => setTaskForm(f => ({ ...f, name: e.target.value }))} required /></Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Assigned To"><input className={inputCls} style={rSm} placeholder="Dev lead" value={taskForm.assignedTo} onChange={e => setTaskForm(f => ({ ...f, assignedTo: e.target.value }))} /></Field>
                      <Field label="Deadline"><input type="date" className={inputCls} style={rSm} value={taskForm.deadline} onChange={e => setTaskForm(f => ({ ...f, deadline: e.target.value }))} /></Field>
                    </div>
                    <div className="space-y-1.5">
                      <label className="t-label">Initial Progress ({taskForm.progress}%)</label>
                      <input type="range" min="0" max="100" className="w-full h-1.5 rounded-full cursor-pointer" style={{ accentColor: 'var(--accent)' }} value={taskForm.progress} onChange={e => setTaskForm(f => ({ ...f, progress: Number(e.target.value) }))} />
                    </div>
                    <Field label="Comments"><textarea className={`${inputCls} h-16 resize-none`} style={rSm} value={taskForm.comments} onChange={e => setTaskForm(f => ({ ...f, comments: e.target.value }))} /></Field>
                    <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setTaskOpen(false)}>Cancel</button><button type="submit" disabled={createTaskMutation.isPending} className="t-btn-primary text-sm">{createTaskMutation.isPending ? 'Saving…' : 'Add Task'}</button></div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {project.tasks.length > 0 ? (
              <div className="space-y-3">
                {project.tasks.map(task => (
                  <div key={task.id} className="p-3.5 rounded bg-[var(--surface-sunken)] border border-[var(--border-subtle)] space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{task.name}</p>
                        {task.assignedTo && <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Assigned: {task.assignedTo}</span>}
                      </div>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        task.status === 'done' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>{task.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="range" min="0" max="100" className="flex-1 h-1 rounded-full cursor-pointer" style={{ accentColor: 'var(--accent-primary)' }} value={task.progress} onChange={e => updateTaskMutation.mutate({ taskId: task.id, progress: Number(e.target.value) })} />
                      <span className="text-xs font-bold font-mono w-9 text-right" style={{ color: 'var(--text-primary)' }}>{task.progress}%</span>
                    </div>
                    {task.deadline && (
                      <div className="flex items-center gap-1 justify-end" style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>
                        <Calendar className="h-3 w-3" /><span>Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="t-empty py-6 text-xs">No tasks allocated</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
