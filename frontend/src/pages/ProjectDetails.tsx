import React, { useState, useEffect } from 'react';
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
  Lock, Eye, EyeOff, Check, Copy, CheckSquare, Clock,
  MessageSquare, Mic, Mail, Phone, Video, FileText as FileTextIcon,
  Zap, CheckCircle2, XCircle, Edit3, Layers, Server, Database, Code
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
  hostingPlatform?: string;
  system?: string; databasePlatform?: string; deploymentPlatform?: string;
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
  const [envForm, setEnvForm] = useState({ name: 'production', url: '' });
  const [envWizardStep, setEnvWizardStep] = useState<1|2|3>(1);
  const [envCatalogueSearch, setEnvCatalogueSearch] = useState('');
  const [envCatalogue, setEnvCatalogue] = useState<any[]>([]);
  const [envSelectedTechs, setEnvSelectedTechs] = useState<any[]>([]);
  const [envFieldValues, setEnvFieldValues] = useState<Record<string, Record<string, string>>>({});
  const [envFieldNotes, setEnvFieldNotes] = useState<Record<string, Record<string, string>>>({});
  const [envFieldExpiry, setEnvFieldExpiry] = useState<Record<string, Record<string, string>>>({});
  const [envFieldLifetime, setEnvFieldLifetime] = useState<Record<string, Record<string, boolean>>>({});
  const [envFieldRevealed, setEnvFieldRevealed] = useState<Record<string, boolean>>({});
  const [envSaving, setEnvSaving] = useState(false);
  const [envError, setEnvError] = useState('');

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
                                <Dialog open={envOpen} onOpenChange={open => {
                  setEnvOpen(open);
                  if (!open) {
                    setEnvWizardStep(1);
                    setEnvForm({ name: 'production', url: '' });
                    setEnvSelectedTechs([]);
                    setEnvFieldValues({});
                    setEnvFieldNotes({});
                    setEnvFieldExpiry({});
                    setEnvFieldLifetime({});
                    setEnvCatalogueSearch('');
                    setEnvError('');
                  }
                }}>
                  <DialogTrigger asChild>
                    <button onClick={() => { setEnvOpen(true); setEnvWizardStep(1); if (envCatalogue.length === 0) api.get('/technologies').then(r => setEnvCatalogue(r.data || [])); }} className="flex items-center justify-center w-7 h-7 rounded t-btn-ghost" style={{ padding: 0 }}><Plus size={14} /></button>
                  </DialogTrigger>
                  <DialogContent style={{ ...dialogStyle, maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
                    <DialogHeader>
                      <DialogTitle style={{ color: 'var(--text-primary)' }}>
                        {envWizardStep === 1 && 'New Environment — Basic Info'}
                        {envWizardStep === 2 && 'New Environment — Select Tech Stacks'}
                        {envWizardStep === 3 && 'New Environment — Configure Credentials'}
                      </DialogTitle>
                      {/* Step progress */}
                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        {[1,2,3].map(s => (
                          <div key={s} style={{ flex: 1, height: 3, borderRadius: 99, background: envWizardStep >= s ? 'var(--accent)' : 'var(--border-subtle)' }} />
                        ))}
                      </div>
                    </DialogHeader>

                    {envError && <div style={{ fontSize: '0.72rem', color: '#ef4444', background: '#ef444415', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #ef444430', marginTop: 8 }}>{envError}</div>}

                    {/* ── Step 1: Basic Info ── */}
                    {envWizardStep === 1 && (
                      <form onSubmit={e => { e.preventDefault(); setEnvWizardStep(2); }} className="space-y-4 pt-2">
                        <Field label="Environment Name *">
                          <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={envForm.name} onChange={e => setEnvForm({ ...envForm, name: e.target.value })} required>
                            <option value="production">Production</option>
                            <option value="staging">Staging</option>
                            <option value="development">Development</option>
                            <option value="sandbox">Sandbox</option>
                            <option value="qa">QA / Testing</option>
                          </select>
                        </Field>
                        <Field label="Environment URL">
                          <input className={inputCls} placeholder="https://app.example.com" value={envForm.url} onChange={e => setEnvForm({ ...envForm, url: e.target.value })} />
                        </Field>
                        <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <button type="button" className="t-btn-ghost text-sm" onClick={() => setEnvOpen(false)}>Cancel</button>
                          <button type="submit" className="t-btn-primary text-sm px-5">Next: Add Tech Stacks →</button>
                        </div>
                      </form>
                    )}

                    {/* ── Step 2: Tech Stack Search & Select ── */}
                    {envWizardStep === 2 && (() => {
                      const filtered = envCatalogue.filter(t =>
                        !envCatalogueSearch ||
                        t.name.toLowerCase().includes(envCatalogueSearch.toLowerCase()) ||
                        t.category.toLowerCase().includes(envCatalogueSearch.toLowerCase())
                      );
                      const catGroups: Record<string, any[]> = {};
                      filtered.forEach(t => { catGroups[t.category] = [...(catGroups[t.category] || []), t]; });
                      const selectedIds = new Set(envSelectedTechs.map(t => t.id));

                      return (
                        <div className="space-y-4 pt-2">
                          {/* Selected tags */}
                          {envSelectedTechs.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0.5rem 0.75rem', background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                              {envSelectedTechs.map(t => (
                                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent)', color: '#fff', padding: '2px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600 }}>
                                  {t.name}
                                  <button type="button" onClick={() => { setEnvSelectedTechs(s => s.filter(x => x.id !== t.id)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', lineHeight: 1, padding: 0, marginLeft: 2, fontSize: '0.8rem' }}>×</button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Search */}
                          <div style={{ position: 'relative' }}>
                            <input
                              className={inputCls}
                              placeholder="Search AWS, GitHub, Stripe, Supabase…"
                              value={envCatalogueSearch}
                              onChange={e => setEnvCatalogueSearch(e.target.value)}
                              autoFocus
                            />
                          </div>

                          {/* Category-grouped results */}
                          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {Object.entries(catGroups).map(([cat, techs]) => (
                              <div key={cat}>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{cat}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {techs.map(t => {
                                    const sel = selectedIds.has(t.id);
                                    return (
                                      <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => {
                                          if (sel) setEnvSelectedTechs(s => s.filter(x => x.id !== t.id));
                                          else setEnvSelectedTechs(s => [...s, t]);
                                        }}
                                        style={{
                                          padding: '4px 12px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                                          border: sel ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                                          background: sel ? 'var(--accent)' : 'var(--surface-card)',
                                          color: sel ? '#fff' : 'var(--text-primary)',
                                          transition: 'all 120ms',
                                        }}
                                      >
                                        {sel && <span style={{ marginRight: 4 }}>✓</span>}{t.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            {filtered.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.75rem', padding: '1rem' }}>No technologies found for "{envCatalogueSearch}"</div>}
                          </div>

                          <div className="flex justify-between gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <button type="button" className="t-btn-ghost text-sm" onClick={() => setEnvWizardStep(1)}>← Back</button>
                            <div className="flex gap-2">
                              <button type="button" className="t-btn-ghost text-sm" onClick={() => setEnvWizardStep(3)} style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>Skip credentials</button>
                              <button type="button" className="t-btn-primary text-sm px-5" disabled={envSelectedTechs.length === 0} onClick={() => setEnvWizardStep(3)}>
                                Configure Credentials ({envSelectedTechs.length}) →
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Step 3: Credential Entry Panels ── */}
                    {envWizardStep === 3 && (
                      <div className="space-y-4 pt-2">
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          Fill in credential values for <strong>{envForm.name}</strong>. Secret fields are AES-256-GCM encrypted on save.
                        </p>
                        {envSelectedTechs.length === 0 && (
                          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.75rem', padding: '1.5rem' }}>No tech stacks selected — this will create the environment only.</div>
                        )}
                        <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {envSelectedTechs.map(tech => (
                            <div key={tech.id} style={{ background: 'var(--surface-sunken)', borderRadius: 10, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                              <div style={{ padding: '0.6rem 1rem', background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>{tech.name.charAt(0)}</div>
                                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{tech.name}</span>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginLeft: 'auto', background: 'var(--surface-card)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border-subtle)' }}>{tech.category}</span>
                              </div>
                              <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {(tech.fieldDefinitions || []).map((fd: any) => (
                                  <div key={fd.fieldKey}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>
                                      {fd.fieldLabel}
                                      {fd.isRequired && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                                      {fd.isSecret && <span style={{ color: '#f59e0b', fontSize: '0.6rem', marginLeft: 4 }}>🔒 Secret</span>}
                                    </label>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      {fd.fieldType === 'textarea' ? (
                                        <textarea
                                          rows={2} className={inputCls} style={{ flex: 1, fontFamily: fd.isSecret ? 'monospace' : undefined }}
                                          placeholder={`Enter ${fd.fieldLabel}…`}
                                          value={envFieldValues[tech.id]?.[fd.fieldKey] || ''}
                                          onChange={e => setEnvFieldValues(prev => ({ ...prev, [tech.id]: { ...prev[tech.id], [fd.fieldKey]: e.target.value } }))}
                                          required={fd.isRequired}
                                        />
                                      ) : (
                                        <input
                                          type={fd.isSecret && !envFieldRevealed[`${tech.id}:${fd.fieldKey}`] ? 'password' : 'text'}
                                          className={inputCls} style={{ flex: 1, fontFamily: fd.isSecret ? 'monospace' : undefined }}
                                          placeholder={`Enter ${fd.fieldLabel}…`}
                                          value={envFieldValues[tech.id]?.[fd.fieldKey] || ''}
                                          onChange={e => setEnvFieldValues(prev => ({ ...prev, [tech.id]: { ...prev[tech.id], [fd.fieldKey]: e.target.value } }))}
                                          required={fd.isRequired}
                                        />
                                      )}
                                      {fd.isSecret && (
                                        <button type="button" onClick={() => setEnvFieldRevealed(prev => ({ ...prev, [`${tech.id}:${fd.fieldKey}`]: !prev[`${tech.id}:${fd.fieldKey}`] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, flexShrink: 0 }}>
                                          {envFieldRevealed[`${tech.id}:${fd.fieldKey}`] ? <EyeOff size={13} /> : <Eye size={13} />}
                                        </button>
                                      )}
                                    </div>
                                    {/* Notes & Expiry */}
                                    <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'end' }}>
                                      <textarea
                                        rows={1} className={inputCls} style={{ fontSize: '0.65rem', resize: 'none' }}
                                        placeholder="Add a note about this credential…"
                                        value={envFieldNotes[tech.id]?.[fd.fieldKey] || ''}
                                        onChange={e => setEnvFieldNotes(prev => ({ ...prev, [tech.id]: { ...prev[tech.id], [fd.fieldKey]: e.target.value } }))}
                                      />
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <input
                                            type="checkbox" id={`lifetime-${tech.id}-${fd.fieldKey}`}
                                            checked={envFieldLifetime[tech.id]?.[fd.fieldKey] ?? true}
                                            onChange={e => setEnvFieldLifetime(prev => ({ ...prev, [tech.id]: { ...prev[tech.id], [fd.fieldKey]: e.target.checked } }))}
                                            style={{ accentColor: 'var(--accent)' }}
                                          />
                                          <label htmlFor={`lifetime-${tech.id}-${fd.fieldKey}`} style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>∞ Lifetime</label>
                                        </div>
                                        {!(envFieldLifetime[tech.id]?.[fd.fieldKey] ?? true) && (
                                          <input
                                            type="date" className={inputCls} style={{ fontSize: '0.65rem', padding: '2px 6px', width: 130 }}
                                            value={envFieldExpiry[tech.id]?.[fd.fieldKey] || ''}
                                            min={new Date().toISOString().split('T')[0]}
                                            onChange={e => setEnvFieldExpiry(prev => ({ ...prev, [tech.id]: { ...prev[tech.id], [fd.fieldKey]: e.target.value } }))}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {(tech.fieldDefinitions || []).length === 0 && <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No credential fields defined for this technology.</p>}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <button type="button" className="t-btn-ghost text-sm" onClick={() => setEnvWizardStep(2)}>← Back</button>
                          <button
                            type="button"
                            disabled={envSaving}
                            className="t-btn-primary text-sm px-5"
                            onClick={async () => {
                              setEnvSaving(true);
                              setEnvError('');
                              try {
                                // 1. Create the ProjectEnvironment record
                                await api.post(`/projects/${projectId}/environments`, { name: envForm.name, url: envForm.url });

                                // 2. For each selected tech: create account + env + fields + link
                                for (const tech of envSelectedTechs) {
                                  const { data: acct } = await api.post(`/technologies/${tech.id}/accounts`, {
                                    accountName: `${tech.name} — ${project?.name || 'Project'} (${envForm.name})`,
                                    ownerType: 'agency',
                                    status: 'active',
                                    billingCycle: 'monthly',
                                  });
                                  const { data: techEnv } = await api.post(`/technology-accounts/${acct.id}/environments`, {
                                    environmentName: envForm.name.charAt(0).toUpperCase() + envForm.name.slice(1),
                                    environmentType: envForm.name,
                                    url: envForm.url || undefined,
                                    active: true,
                                  });
                                  const fieldDefs = tech.fieldDefinitions || [];
                                  for (const fd of fieldDefs) {
                                    const val = envFieldValues[tech.id]?.[fd.fieldKey];
                                    if (val) {
                                      const note = envFieldNotes[tech.id]?.[fd.fieldKey];
                                      const lifetime = envFieldLifetime[tech.id]?.[fd.fieldKey] ?? true;
                                      const expiry = envFieldExpiry[tech.id]?.[fd.fieldKey];
                                      await api.post(`/technology-accounts/${acct.id}/fields`, {
                                        fieldKey: fd.fieldKey,
                                        fieldLabel: fd.fieldLabel,
                                        isSecret: fd.isSecret,
                                        environmentId: techEnv.id,
                                        value: val,
                                        notes: note || undefined,
                                        isLifetime: lifetime,
                                        expiresAt: !lifetime && expiry ? new Date(expiry).toISOString() : undefined,
                                      });
                                    }
                                  }
                                  await api.post(`/projects/${projectId}/technologies`, {
                                    technologyAccountId: acct.id,
                                    connectionType: 'primary',
                                  });
                                }

                                // 3. Dispatch audit log entry
                                await api.post(`/projects/${projectId}/dispatch`, {
                                  projectId,
                                  title: `Environment created: ${envForm.name}`,
                                  communicationType: 'system',
                                  source: 'manual',
                                  rawContent: `Owner created a new ${envForm.name} environment with ${envSelectedTechs.length} tech stack(s): ${envSelectedTechs.map(t => t.name).join(', ') || 'none'}.`,
                                  verificationStatus: 'verified',
                                  sentiment: 'positive',
                                  priority: 'normal',
                                }).catch(() => {/* non-critical */});

                                setEnvOpen(false);
                                setEnvWizardStep(1);
                                setEnvSelectedTechs([]);
                                setEnvFieldValues({});
                                setEnvFieldNotes({});
                                setEnvFieldExpiry({});
                                setEnvFieldLifetime({});
                                setEnvCatalogueSearch('');
                                setEnvForm({ name: 'production', url: '' });
                                qc.invalidateQueries({ queryKey: ['project-detail', projectId] });
                              } catch (err: any) {
                                setEnvError(err.response?.data?.message || 'Save failed. Check all required fields.');
                              } finally {
                                setEnvSaving(false);
                              }
                            }}
                          >
                            {envSaving ? <><Loader2 size={13} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />Saving…</> : '✓ Create Environment & Save Credentials'}
                          </button>
                        </div>
                      </div>
                    )}
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
                {['owner', 'admin'].includes(role) && (
                  <button
                    onClick={async () => {
                      let colId = project.vaultCollections?.[0]?.id;
                      if (!colId) {
                        try {
                          const { data: newCol } = await api.post('/credentials/collections', {
                            projectId,
                            provider: 'default',
                            rotationPolicy: 'every 90 days',
                          });
                          colId = newCol.id;
                          qc.invalidateQueries({ queryKey: ['project-detail', projectId] });
                        } catch (err: any) {
                          alert('Failed to initialize vault collection');
                          return;
                        }
                      }
                      setSecretForm({ ...secretForm, collectionId: colId });
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* ── Dispatch Feed ─────────────────────────────────────── */}
      <DispatchSection projectId={projectId!} role={role} />

      {/* ── Technology Stack ──────────────────────────────────── */}
      <TechStackSection projectId={projectId!} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Dispatch Section Component                                  */
/* ─────────────────────────────────────────────────────────── */
const COMM_ICONS: Record<string, React.ReactNode> = {
  meeting: <Video size={14} />,
  call: <Phone size={14} />,
  email: <Mail size={14} />,
  whatsapp: <MessageSquare size={14} />,
  slack: <Zap size={14} />,
  internal_note: <FileTextIcon size={14} />,
  transcript: <Mic size={14} />,
  status_update: <CheckCircle2 size={14} />,
};

const COMM_COLORS: Record<string, string> = {
  meeting: '#6366f1', call: '#22c55e', email: '#3b82f6', whatsapp: '#25d366',
  slack: '#4a154b', internal_note: '#94a3b8', transcript: '#f59e0b', status_update: '#06b6d4',
};

function DispatchSection({ projectId, role }: { projectId: string; role: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', communicationType: 'meeting', source: 'manual', occurredAt: new Date().toISOString().slice(0, 16), rawContent: '', priority: 'normal' });
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState<string | null>(null);
  const [editingSummary, setEditingSummary] = useState<string | null>(null);
  const [editedSummaryText, setEditedSummaryText] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const isPriv = ['owner', 'admin'].includes(role);

  const load = () => {
    const params: string[] = [];
    if (filterType) params.push(`communicationType=${filterType}`);
    if (filterStatus) params.push(`verificationStatus=${filterStatus}`);
    api.get(`/projects/${projectId}/dispatch${params.length ? '?' + params.join('&') : ''}`).then(r => setEntries(r.data || []));
  };

  useEffect(() => { load(); }, [projectId, filterType, filterStatus]);

  const createEntry = async () => {
    setLoading(true);
    try {
      await api.post(`/projects/${projectId}/dispatch`, { ...form, occurredAt: new Date(form.occurredAt).toISOString() });
      setShowCreate(false);
      setForm({ title: '', communicationType: 'meeting', source: 'manual', occurredAt: new Date().toISOString().slice(0, 16), rawContent: '', priority: 'normal' });
      load();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const generateSummary = async (id: string) => {
    setSummaryLoading(id);
    try {
      await api.post(`/dispatch/${id}/generate-summary`);
      load();
    } finally { setSummaryLoading(null); }
  };

  const verifySummary = async (id: string) => {
    try {
      await api.post(`/dispatch/${id}/verify-summary`, { editedSummary: editedSummaryText || undefined });
      setEditingSummary(null);
      load();
    } catch {}
  };

  const createTask = async (entryId: string, actionItemId: string) => {
    try {
      await api.post(`/dispatch/${entryId}/create-task`, { actionItemId });
      alert('Task created successfully!');
      load();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
  };

  const sentimentColor = (s?: string) => ({ positive: '#22c55e', negative: '#ef4444', neutral: '#94a3b8', mixed: '#f59e0b' })[s || 'neutral'] || '#94a3b8';
  const verificationColor = (s: string) => ({ verified: '#22c55e', unverified: '#f59e0b', needs_review: '#ef4444', inaccurate: '#ef4444' })[s] || '#94a3b8';

  return (
    <div style={{ marginTop: '1.5rem', background: 'var(--surface-card)', borderRadius: 14, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageSquare size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Dispatch Feed</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', background: 'var(--surface-base)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border-subtle)' }}>
            {entries.length} entries
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '0.35rem 0.6rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
            <option value=''>All types</option>
            {['meeting', 'call', 'email', 'whatsapp', 'slack', 'internal_note', 'transcript', 'status_update'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '0.35rem 0.6rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
            <option value=''>All statuses</option>
            <option value='verified'>Verified</option>
            <option value='unverified'>Unverified</option>
            <option value='needs_review'>Needs Review</option>
          </select>
          <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.35rem 0.75rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={12} /> Add Entry
          </button>
        </div>
      </div>

      {/* Entries */}
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {entries.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
            <MessageSquare size={36} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
            No dispatch entries yet. Add meeting notes, call summaries or internal updates.
          </div>
        ) : entries.map(entry => {
          const isExpanded = expanded === entry.id;
          const typeColor = COMM_COLORS[entry.communicationType] || '#6366f1';
          return (
            <div key={entry.id} style={{ background: 'var(--surface-base)', borderRadius: 10, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              {/* Entry header */}
              <div
                onClick={() => setExpanded(isExpanded ? null : entry.id)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0.9rem', cursor: 'pointer', transition: 'background 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Type icon */}
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${typeColor}18`, color: typeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  {COMM_ICONS[entry.communicationType] || <MessageSquare size={14} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{entry.title}</span>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 99, background: `${verificationColor(entry.verificationStatus)}15`, color: verificationColor(entry.verificationStatus), fontWeight: 600 }}>
                      {entry.verificationStatus === 'verified' ? '✓ Verified' : entry.verificationStatus === 'unverified' ? 'Review Needed' : entry.verificationStatus.replace(/_/g, ' ')}
                    </span>
                    {entry.sentiment && <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 99, background: `${sentimentColor(entry.sentiment)}15`, color: sentimentColor(entry.sentiment), fontWeight: 600, textTransform: 'capitalize' }}>{entry.sentiment}</span>}
                    {entry.priority !== 'normal' && <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 99, background: entry.priority === 'high' ? '#ef444415' : '#f59e0b15', color: entry.priority === 'high' ? '#ef4444' : '#f59e0b', fontWeight: 600, textTransform: 'capitalize' }}>{entry.priority}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={10} /> {new Date(entry.occurredAt).toLocaleDateString()}</span>
                    <span style={{ textTransform: 'capitalize' }}>{entry.communicationType.replace(/_/g, ' ')}</span>
                    {entry.durationMinutes && <span><Clock size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />{entry.durationMinutes}m</span>}
                    {entry.participants?.length > 0 && <span><Users size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />{entry.participants.length} participants</span>}
                  </div>
                  {entry.aiSummary && !isExpanded && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {entry.aiSummary}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {!entry.aiSummary && (
                    <button onClick={() => generateSummary(entry.id)} disabled={summaryLoading === entry.id} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--accent)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                      {summaryLoading === entry.id ? '…' : '✨ Summarize'}
                    </button>
                  )}
                  {entry.aiSummary && entry.verificationStatus !== 'verified' && isPriv && (
                    <button onClick={() => { setEditingSummary(entry.id); setEditedSummaryText(entry.aiSummary || ''); }} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #22c55e40', background: 'transparent', color: '#22c55e', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                      <CheckCircle2 size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} /> Verify
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: '0 0.9rem 0.9rem', borderTop: '1px solid var(--border-subtle)' }}>
                  {/* AI Summary */}
                  {entry.aiSummary && (
                    <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: '0.85rem', margin: '0.75rem 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Zap size={13} style={{ color: 'var(--accent)' }} />
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Summary</span>
                          {entry.aiConfidence && <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>{Math.round(Number(entry.aiConfidence))}% confidence</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {entry.verificationStatus !== 'verified' && (
                            <button onClick={() => generateSummary(entry.id)} style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>↻ Regenerate</button>
                          )}
                        </div>
                      </div>
                      {editingSummary === entry.id ? (
                        <div>
                          <textarea value={editedSummaryText} onChange={e => setEditedSummaryText(e.target.value)} rows={6} style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-primary)', fontSize: '0.78rem', resize: 'vertical', marginBottom: 8 }} />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => verifySummary(entry.id)} style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>Verify & Save</button>
                            <button onClick={() => setEditingSummary(null)} style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.72rem', cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>{entry.aiSummary}</p>
                      )}
                    </div>
                  )}

                  {/* Decisions */}
                  {entry.decisions?.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Decisions</div>
                      {entry.decisions.map((d: any) => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0' }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366f1', marginTop: 6, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{d.decisionText}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action items */}
                  {entry.actionItems?.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Action Items</div>
                      {entry.actionItems.map((ai: any) => (
                        <div key={ai.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{ai.actionText}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', gap: 10 }}>
                              {ai.assignedUserId && <span>Assigned to: {ai.assignedUserId}</span>}
                              {ai.dueDate && <span>Due: {new Date(ai.dueDate).toLocaleDateString()}</span>}
                              <span style={{ textTransform: 'capitalize', color: ai.status === 'done' ? '#22c55e' : ai.status === 'in_progress' ? '#f59e0b' : 'var(--text-tertiary)' }}>{ai.status}</span>
                            </div>
                          </div>
                          {!ai.linkedTaskId && isPriv && (
                            <button onClick={() => createTask(entry.id, ai.id)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--accent)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                              + Task
                            </button>
                          )}
                          {ai.linkedTaskId && <span style={{ fontSize: '0.65rem', color: '#22c55e', fontWeight: 600, flexShrink: 0 }}>✓ Task created</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Raw content */}
                  {entry.rawContent && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', cursor: 'pointer', userSelect: 'none' }}>Show raw notes</summary>
                      <pre style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8, padding: '0.75rem', background: 'var(--surface-sunken)', borderRadius: 8, whiteSpace: 'pre-wrap', overflow: 'auto' }}>{entry.rawContent}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Entry Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowCreate(false)}>
          <div style={{ width: 520, background: 'var(--surface-base)', borderRadius: 16, padding: '1.5rem', border: '1px solid var(--border-subtle)', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>New Dispatch Entry</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Client Review Meeting — July 16" style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Type</label>
                  <select value={form.communicationType} onChange={e => setForm(f => ({ ...f, communicationType: e.target.value }))} style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                    {['meeting', 'call', 'email', 'whatsapp', 'slack', 'internal_note', 'transcript', 'status_update'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Date & Time</label>
                  <input type="datetime-local" value={form.occurredAt} onChange={e => setForm(f => ({ ...f, occurredAt: e.target.value }))} style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.78rem' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Meeting Notes / Raw Content</label>
                <textarea value={form.rawContent} onChange={e => setForm(f => ({ ...f, rawContent: e.target.value }))} rows={8} placeholder="Paste meeting notes, email thread, or call summary here. AI will generate a structured summary." style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.78rem', resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                    <option value='low'>Low</option>
                    <option value='normal'>Normal</option>
                    <option value='high'>High</option>
                    <option value='critical'>Critical</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Source</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                    {['manual', 'google_meet', 'zoom', 'teams', 'phone', 'email', 'whatsapp'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
              <button onClick={createEntry} disabled={loading || !form.title} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                {loading ? 'Saving…' : 'Save Entry'}
              </button>
              {form.rawContent && !loading && (
                <button onClick={async () => { await createEntry(); }} disabled={loading} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                  ✨ Save & Summarize
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Technology Stack Section                                    */
/* ─────────────────────────────────────────────────────────── */
const TECH_CAT_COLORS: Record<string, string> = {
  'Source Control': '#6366f1',
  'Cloud Infrastructure': '#f59e0b',
  'Hosting': '#06b6d4',
  'Domain and DNS': '#10b981',
  'Database': '#8b5cf6',
  'Email': '#ec4899',
  'Communication': '#3b82f6',
  'Design': '#f97316',
  'Project Management': '#14b8a6',
  'Payment Gateway': '#22c55e',
  'Artificial Intelligence': '#a78bfa',
  'Marketing': '#fb923c',
  'CRM': '#38bdf8',
  'Security': '#ef4444',
};

function TechStackSection({ projectId }: { projectId: string }) {
  const [techLinks, setTechLinks] = useState<any[]>([]);
  const [catalogue, setCatalogue] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState<any | null>(null);
  const [accountForm, setAccountForm] = useState({ accountName: '', accountIdentifier: '', environmentName: 'Production', environmentType: 'production', ownerType: 'agency', isLifetime: false, billingCycle: 'monthly', billingAmount: '0.00' });
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [techSearch, setTechSearch] = useState('');
  const [creatingTech, setCreatingTech] = useState(false);

  const load = () => {
    api.get(`/vault/project/${projectId}`).then(r => setTechLinks(r.data || []));
  };

  useEffect(() => {
    load();
    api.get('/technologies').then(r => setCatalogue(r.data || []));
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTech) return;
    setLoading(true);
    setError('');
    try {
      // 1. Create Technology Account
      const { data: acct } = await api.post(`/technologies/${selectedTech.id}/accounts`, {
        accountName: accountForm.accountName,
        accountIdentifier: accountForm.accountIdentifier || undefined,
        ownerType: accountForm.ownerType,
        subscriptionPlan: 'Developer / Pro',
        billingCycle: accountForm.billingCycle,
        billingAmount: accountForm.billingAmount ? parseFloat(accountForm.billingAmount) : 0,
        isLifetime: accountForm.isLifetime,
        status: 'active',
      });

      // 2. Create Environment
      const { data: env } = await api.post(`/technology-accounts/${acct.id}/environments`, {
        environmentName: accountForm.environmentName,
        environmentType: accountForm.environmentType,
        url: `https://${accountForm.environmentType}.${accountForm.accountIdentifier || 'service'}.com`,
        active: true,
      });

      // 3. Create Fields
      const fieldDefs = (selectedTech.fieldDefinitions && selectedTech.fieldDefinitions.length > 0)
        ? selectedTech.fieldDefinitions
        : [
            { fieldKey: 'username', fieldLabel: 'Username / ID', isSecret: false },
            { fieldKey: 'password', fieldLabel: 'Password / Key', isSecret: true }
          ];
      for (const def of fieldDefs) {
        const val = fieldValues[def.fieldKey];
        if (val !== undefined && val !== '') {
          await api.post(`/technology-accounts/${acct.id}/fields`, {
            fieldKey: def.fieldKey,
            fieldLabel: def.fieldLabel,
            isSecret: def.isSecret,
            environmentId: env.id,
            value: val,
          });
        }
      }

      // 4. Link to Project
      await api.post(`/projects/${projectId}/technologies`, {
        technologyAccountId: acct.id,
        connectionType: 'primary',
      });

      // Reset
      setOpen(false);
      setSelectedTech(null);
      setAccountForm({ accountName: '', accountIdentifier: '', environmentName: 'Production', environmentType: 'production', ownerType: 'agency', isLifetime: false, billingCycle: 'monthly', billingAmount: '0.00' });
      setFieldValues({});
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save and link technology');
    } finally {
      setLoading(false);
    }
  };

  const filteredCatalogue = catalogue.filter((tech: any) =>
    tech.name.toLowerCase().includes(techSearch.toLowerCase()) ||
    tech.category.toLowerCase().includes(techSearch.toLowerCase())
  );

  return (
    <div style={{ marginTop: '1rem', background: 'var(--surface-card)', borderRadius: 14, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Layers size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Technology Stack</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', background: 'var(--surface-base)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border-subtle)' }}>{techLinks.length} linked</span>
        </div>

        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if(!o) { setSelectedTech(null); setTechSearch(''); setError(''); } }}>
          <DialogTrigger asChild>
            <button onClick={() => setOpen(true)} className="flex items-center justify-center w-7 h-7 rounded t-btn-ghost" style={{ padding: 0 }} aria-label="Add Technology Stack">
              <Plus size={14} />
            </button>
          </DialogTrigger>
          <DialogContent style={{ background: 'var(--surface-base)', border: '1px solid var(--border-default)', maxWidth: 540, maxHeight: '85vh', overflowY: 'auto' }}>
            <DialogHeader>
              <DialogTitle style={{ color: 'var(--text-primary)' }}>
                {selectedTech ? `Configure ${selectedTech.name}` : 'Add Project Technology'}
              </DialogTitle>
            </DialogHeader>

            {error && <div className="text-xs text-red-500 bg-red-500/10 p-2.5 rounded border border-red-500/20">{error}</div>}

            {!selectedTech ? (
              <div className="space-y-4 pt-2">
                <div>
                  <input
                    type="text"
                    placeholder="Search technology..."
                    className="t-input w-full p-2.5 text-xs"
                    style={{ borderRadius: 'var(--radius-sm)' }}
                    value={techSearch}
                    onChange={e => setTechSearch(e.target.value)}
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Select a technology stack item to configure and store its credentials:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                  {filteredCatalogue.map((tech: any) => {
                    const color = TECH_CAT_COLORS[tech.category] || '#6366f1';
                    return (
                      <button
                        key={tech.id}
                        onClick={() => {
                          setSelectedTech(tech);
                          setAccountForm(f => ({ ...f, accountName: `${tech.name} - Project Main` }));
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.75rem',
                          background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
                          borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                          color: 'var(--text-primary)', transition: 'all 150ms',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-card)')}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: `${color}18`, color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.7rem', fontWeight: 700, flexShrink: 0
                        }}>
                          {tech.name.charAt(0)}
                        </div>
                        <div className="truncate">
                          <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{tech.name}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{tech.category}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {filteredCatalogue.length === 0 && techSearch.trim() && (
                  <button
                    type="button"
                    disabled={creatingTech}
                    onClick={async () => {
                      setCreatingTech(true);
                      setError('');
                      try {
                        const { data: newTech } = await api.post('/technologies', {
                          name: techSearch.trim(),
                          category: 'Other'
                        });
                        setCatalogue(prev => [...prev, newTech]);
                        setSelectedTech(newTech);
                        setAccountForm(f => ({ ...f, accountName: `${newTech.name} - Project Main` }));
                        setTechSearch('');
                      } catch (err: any) {
                        setError(err.response?.data?.message || 'Failed to create new technology');
                      } finally {
                        setCreatingTech(false);
                      }
                    }}
                    style={{
                      width: '100%', textAlign: 'center', padding: '10px 12px',
                      fontSize: '12px', color: 'var(--accent)', fontWeight: 600,
                      background: 'none', border: '1px dashed var(--border-strong)', cursor: 'pointer',
                      borderRadius: 8, transition: 'all 150ms'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {creatingTech ? 'Creating…' : `+ Create "${techSearch}" as new technology`}
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.75rem', background: 'var(--surface-sunken)', borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)', flex: 1 }}>
                    Selected: {selectedTech.name} ({selectedTech.category})
                  </div>
                  <button type="button" onClick={() => setSelectedTech(null)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>Change</button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Account Name *">
                    <input className={inputCls} value={accountForm.accountName} onChange={e => setAccountForm({ ...accountForm, accountName: e.target.value })} placeholder="e.g. Stripe Live Dashboard" required />
                  </Field>
                  <Field label="Account ID / Username">
                    <input className={inputCls} value={accountForm.accountIdentifier} onChange={e => setAccountForm({ ...accountForm, accountIdentifier: e.target.value })} placeholder="e.g. account-id-123" />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Environment Type">
                    <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={accountForm.environmentType} onChange={e => setAccountForm({ ...accountForm, environmentType: e.target.value, environmentName: e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1) })}>
                      <option value="production">Production</option>
                      <option value="staging">Staging</option>
                      <option value="development">Development</option>
                    </select>
                  </Field>
                  <Field label="Owner Type">
                    <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={accountForm.ownerType} onChange={e => setAccountForm({ ...accountForm, ownerType: e.target.value })}>
                      <option value="agency">Agency-owned</option>
                      <option value="client">Client-owned</option>
                    </select>
                  </Field>
                </div>

                {/* Fields definition inputs */}
                <div style={{ background: 'var(--surface-sunken)', borderRadius: 10, padding: '1rem', border: '1px solid var(--border-subtle)' }} className="space-y-3">
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Credential Values</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {((selectedTech.fieldDefinitions && selectedTech.fieldDefinitions.length > 0)
                      ? selectedTech.fieldDefinitions
                      : [
                          { fieldKey: 'username', fieldLabel: 'Username / ID', isSecret: false, isRequired: true },
                          { fieldKey: 'password', fieldLabel: 'Password / Key', isSecret: true, isRequired: true }
                        ]).map((fd: any) => (
                      <div key={fd.fieldKey}>
                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>
                          {fd.fieldLabel} {fd.isRequired && <span className="text-red-500">*</span>} {fd.isSecret && <span style={{ color: '#f59e0b', fontSize: '0.6rem' }}>(Secret)</span>}
                        </label>
                        {fd.fieldType === 'textarea' ? (
                          <textarea
                            className={inputCls}
                            rows={2}
                            value={fieldValues[fd.fieldKey] || ''}
                            onChange={e => setFieldValues({ ...fieldValues, [fd.fieldKey]: e.target.value })}
                            placeholder={`Enter ${fd.fieldLabel}...`}
                            required={fd.isRequired}
                          />
                        ) : (
                          <input
                            type={fd.isSecret ? 'password' : 'text'}
                            className={inputCls}
                            value={fieldValues[fd.fieldKey] || ''}
                            onChange={e => setFieldValues({ ...fieldValues, [fd.fieldKey]: e.target.value })}
                            placeholder={`Enter ${fd.fieldLabel}...`}
                            required={fd.isRequired}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <button type="button" className="t-btn-ghost text-sm" onClick={() => setOpen(false)}>Cancel</button>
                  <button type="submit" disabled={loading} className="t-btn-primary text-sm px-6">
                    {loading ? 'Saving...' : 'Save & Link'}
                  </button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div style={{ padding: '1rem' }}>
        {techLinks.length === 0 ? (
          <div className="t-empty py-4 text-xs italic text-[var(--text-tertiary)]" style={{ textAlign: 'center' }}>
            No linked technology accounts. Click '+' to add one.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {techLinks.map((link: any) => {
              const acc = link.technologyAccount;
              return (
                <div key={link.id} style={{ background: 'var(--surface-sunken)', borderRadius: 10, border: '1px solid var(--border-subtle)', padding: '0.75rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: 4 }}>{acc.technology.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>{acc.accountName}</div>
                  {acc.environments.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {acc.environments.map((env: any) => (
                        <span key={env.id} style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 6, background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', textTransform: 'capitalize' }}>
                          {env.environmentType}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 6, background: acc.status === 'active' ? '#22c55e15' : '#ef444415', color: acc.status === 'active' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{acc.status}</span>
                    {acc.isLifetime && <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 6, background: '#6366f115', color: '#6366f1', fontWeight: 600 }}>∞ Lifetime</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

