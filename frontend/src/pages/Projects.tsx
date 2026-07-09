import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Search, Plus, Briefcase, ExternalLink, Globe, AlertTriangle, Loader2, CircleDot } from 'lucide-react';

interface Project {
  id: string; name: string; clientId: string;
  client: { name: string; company?: string };
  status: string; liveUrl?: string;
  hostingPlatform?: string; techStack: string[];
  websiteMonitors?: { lastStatus: string }[];
}
interface Client { id: string; name: string; company?: string; }

const emptyForm = {
  clientId: '', name: '', description: '', techStackRaw: '',
  githubRepoUrl: '', liveUrl: '', stagingUrl: '',
  hostingPlatform: '', databasePlatform: '', deploymentPlatform: '',
};

/* Reusable field wrapper */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="t-label">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 't-input w-full px-3 py-2 text-sm';

export default function Projects() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects-list'],
    queryFn: () => api.get('/projects').then(r => r.data),
  });
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/projects', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects-list'] });
      setOpen(false); setForm(emptyForm); setFormError('');
    },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to create project.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!form.clientId) { setFormError('Please select a client.'); return; }
    if (!form.name)     { setFormError('Project name is required.'); return; }
    createMutation.mutate({ ...form, techStack: form.techStackRaw.split(',').map(s => s.trim()).filter(Boolean) });
  };

  const filtered = projects?.filter(p => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q)
      || p.client.name.toLowerCase().includes(q)
      || p.hostingPlatform?.toLowerCase().includes(q);
  }) ?? [];

  if (isLoading) {
    return <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent-primary)' }} />
    </div>;
  }

  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="t-page-title">Projects Directory</h1>
          <p className="t-page-subtitle">Track deployments, infrastructure, and active milestones.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="t-btn-primary flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> New Project
            </button>
          </DialogTrigger>
          <DialogContent
            className="max-w-lg"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)' }}
          >
            <DialogHeader>
              <DialogTitle style={{ color: 'var(--text-primary)' }}>Add New Project</DialogTitle>
            </DialogHeader>

            {formError && (
              <div className="flex items-center gap-2 text-xs p-2.5 rounded-md"
                style={{ background: 'rgba(243,195,178,0.2)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', borderRadius: 'var(--radius-sm)' }}>
                <AlertTriangle className="h-4 w-4 shrink-0" />{formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <Field label="Client *">
                <select
                  className={inputCls}
                  style={{ borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-primary)' }}
                  value={form.clientId}
                  onChange={e => setForm({ ...form, clientId: e.target.value })}
                  required
                >
                  <option value="">Select a client</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                </select>
              </Field>
              <Field label="Project Name *">
                <input className={inputCls} style={{ borderRadius: 'var(--radius-sm)' }} placeholder="E-Commerce API" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field label="Description">
                <textarea className={`${inputCls} h-16 resize-none`} style={{ borderRadius: 'var(--radius-sm)' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Live URL">
                  <input className={inputCls} style={{ borderRadius: 'var(--radius-sm)' }} placeholder="https://example.com" value={form.liveUrl} onChange={e => setForm({ ...form, liveUrl: e.target.value })} />
                </Field>
                <Field label="GitHub Repo URL">
                  <input className={inputCls} style={{ borderRadius: 'var(--radius-sm)' }} placeholder="https://github.com/..." value={form.githubRepoUrl} onChange={e => setForm({ ...form, githubRepoUrl: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Hosting Platform">
                  <input className={inputCls} style={{ borderRadius: 'var(--radius-sm)' }} placeholder="Vercel, AWS…" value={form.hostingPlatform} onChange={e => setForm({ ...form, hostingPlatform: e.target.value })} />
                </Field>
                <Field label="Tech Stack (comma separated)">
                  <input className={inputCls} style={{ borderRadius: 'var(--radius-sm)' }} placeholder="React, NestJS…" value={form.techStackRaw} onChange={e => setForm({ ...form, techStackRaw: e.target.value })} />
                </Field>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="t-btn-ghost text-sm" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="t-btn-primary text-sm">
                  {createMutation.isPending ? 'Saving…' : 'Add Project'}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
        <input
          className="t-input w-full pl-9 pr-4 py-2.5 text-sm"
          style={{ borderRadius: 'var(--radius-sm)' }}
          placeholder="Search by name, client, hosting…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(proj => {
            const mon = proj.websiteMonitors?.[0];
            const online = mon?.lastStatus === 'online';
            const offline = mon?.lastStatus === 'offline';
            return (
              <button
                key={proj.id}
                onClick={() => navigate(`/dashboard/projects/${proj.id}`)}
                className="t-card p-5 text-left flex flex-col gap-4 hover:shadow-t-md transition-shadow cursor-pointer w-full"
                style={{ borderRadius: 'var(--radius-md)' }}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center justify-center w-9 h-9 rounded-md shrink-0" style={{ background: 'var(--surface-info)', border: '1px solid var(--border-strong)' }}>
                    <Briefcase className="h-4 w-4" style={{ color: 'var(--text-link)' }} />
                  </div>
                  <div>
                    {online  && <span className="t-badge-online"><CircleDot className="h-2.5 w-2.5" />Online</span>}
                    {offline && <span className="t-badge-offline"><CircleDot className="h-2.5 w-2.5" />Offline</span>}
                    {!mon    && <span className="t-badge-neutral">No monitor</span>}
                  </div>
                </div>

                <div className="flex-1">
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{proj.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {proj.client.name}{proj.client.company ? ` · ${proj.client.company}` : ''}
                  </p>
                </div>

                {/* Tech pills */}
                {proj.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {proj.techStack.slice(0, 4).map(t => (
                      <span key={t} className="t-tech-pill">{t}</span>
                    ))}
                    {proj.techStack.length > 4 && (
                      <span className="t-tech-pill">+{proj.techStack.length - 4}</span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>
                    {proj.hostingPlatform || 'Unspecified'}
                  </span>
                  {proj.liveUrl && (
                    <a
                      href={proj.liveUrl}
                      target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 t-link text-[10px] font-semibold no-underline hover:underline"
                    >
                      <Globe className="h-3 w-3" /><span>Live</span><ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="t-empty">
          <Briefcase className="h-10 w-10" style={{ color: 'var(--border-default)' }} />
          <span className="text-sm font-semibold">No projects match your search</span>
        </div>
      )}
    </div>
  );
}
