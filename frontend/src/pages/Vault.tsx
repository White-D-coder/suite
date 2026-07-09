import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import TabBar from '../components/TabBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import {
  KeyRound, Plus, Eye, EyeOff, Copy, Check,
  Search, Lock, Loader2, AlertTriangle, ShieldCheck,
} from 'lucide-react';

interface Project { id: string; name: string; }
interface Credential {
  id: string; platformName: string; username?: string;
  password?: string; secretKeys?: string; notes?: string;
  recoveryEmail?: string; category: string;
  projects: { project: Project }[];
}

const categories = ['all', 'Cloud', 'API', 'Database', 'Hosting', 'SSH', 'Other'];
const emptyForm = { platformName: '', username: '', password: '', secretKeys: '', notes: '', recoveryEmail: '', category: 'Cloud', projectIds: [] as string[] };
const inputCls = 't-input w-full px-3 py-2.5 text-sm font-mono';
const rSm = { borderRadius: 'var(--radius-sm)' };
const selectCls: React.CSSProperties = { ...rSm, border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-primary)', width: '100%', height: '42px', padding: '0 0.75rem', fontSize: '0.875rem' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="t-label">{label}</label>{children}</div>;
}

function CredCard({ cred, decrypted, copiedId, loadingRevealId, onReveal, onCopy }: {
  cred: Credential;
  decrypted?: { password?: string; secretKeys?: string; notes?: string };
  copiedId: string | null;
  loadingRevealId: string | null;
  onReveal: (id: string) => void;
  onCopy: (id: string, text?: string) => void;
}) {
  const isRevealed = !!decrypted;

  return (
    <div className="t-card flex flex-col" style={{ gap: 0 }}>
      {/* Card Header */}
      <div className="p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md" style={{ background: 'var(--surface-info)', border: '1px solid var(--border-strong)' }}>
            <KeyRound className="h-4 w-4" style={{ color: 'var(--text-link)' }} />
          </div>
          <span className="t-tech-pill">{cred.category}</span>
        </div>
        <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{cred.platformName}</p>
        {cred.username && (
          <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
            {cred.username}
          </p>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-3 flex-1 text-xs">
        <SecretField
          label="Password"
          value={isRevealed ? decrypted?.password : undefined}
          copyId={cred.id}
          copiedId={copiedId}
          onCopy={text => onCopy(cred.id, text)}
        />

        {(cred.secretKeys || isRevealed) && (
          <SecretField
            label="API Keys / Tokens"
            value={isRevealed ? decrypted?.secretKeys : undefined}
            copyId={cred.id + '-k'}
            copiedId={copiedId}
            onCopy={text => onCopy(cred.id + '-k', text)}
          />
        )}

        {isRevealed && decrypted?.notes && (
          <div>
            <p className="t-label mb-1">Notes</p>
            <p className="p-2 rounded text-[11px] font-mono leading-relaxed whitespace-pre-wrap"
              style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)' }}>
              {decrypted.notes}
            </p>
          </div>
        )}

        {cred.recoveryEmail && (
          <div className="flex justify-between text-xs pt-2" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
            <span>Recovery Email</span>
            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{cred.recoveryEmail}</span>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="p-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex flex-wrap gap-1 max-w-[140px]">
          {cred.projects.length > 0
            ? cred.projects.slice(0, 2).map(p => (
              <span key={p.project.id} className="t-badge-neutral" style={{ fontSize: '0.6rem' }}>{p.project.name}</span>
            ))
            : <span className="text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>No linked projects</span>
          }
        </div>

        <button
          onClick={() => onReveal(cred.id)}
          disabled={loadingRevealId === cred.id}
          className="t-btn-ghost text-xs flex items-center gap-1.5"
          style={{ minHeight: '32px', padding: '0 0.75rem', borderRadius: 'var(--radius-sm)' }}
        >
          {loadingRevealId === cred.id
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />
          }
          <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
        </button>
      </div>
    </div>
  );
}

function SecretField({ label, value, copyId, copiedId, onCopy }: { label: string; value?: string; copyId: string; copiedId: string | null; onCopy: (t: string) => void }) {
  return (
    <div>
      <p className="t-label mb-1">{label}</p>
      <div className="flex items-center justify-between px-3 py-2 font-mono text-xs"
        style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
        <span className="truncate max-w-[180px]" style={{ color: value ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
          {value ?? '••••••••'}
        </span>
        {value && (
          <button onClick={() => onCopy(value)} className="ml-2 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-label="Copy">
            {copiedId === copyId
              ? <Check className="h-3.5 w-3.5" style={{ color: 'var(--status-online)' }} />
              : <Copy className="h-3.5 w-3.5" />
            }
          </button>
        )}
      </div>
    </div>
  );
}

export default function Vault() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [decryptedSecrets, setDecryptedSecrets] = useState<Record<string, { password?: string; secretKeys?: string; notes?: string }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingRevealId, setLoadingRevealId] = useState<string | null>(null);

  const { data: credentials, isLoading } = useQuery<Credential[]>({ queryKey: ['credentials-list'], queryFn: () => api.get('/credentials').then(r => r.data) });
  const { data: projects } = useQuery<Project[]>({ queryKey: ['projects-list'], queryFn: () => api.get('/projects').then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/credentials', p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credentials-list'] }); setOpen(false); setForm(emptyForm); setFormError(''); },
    onError: (e: any) => setFormError(e.response?.data?.message || 'Failed to register credential.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!form.platformName) { setFormError('Platform name is required.'); return; }
    createMutation.mutate(form);
  };

  const toggleProject = (id: string) => {
    const ids = [...form.projectIds];
    setForm({ ...form, projectIds: ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id] });
  };

  const handleReveal = async (id: string) => {
    if (decryptedSecrets[id]) {
      const copy = { ...decryptedSecrets }; delete copy[id]; setDecryptedSecrets(copy); return;
    }
    setLoadingRevealId(id);
    try {
      const { data } = await api.get(`/credentials/${id}`);
      setDecryptedSecrets({ ...decryptedSecrets, [id]: { password: data.password, secretKeys: data.secretKeys, notes: data.notes } });
    } finally { setLoadingRevealId(null); }
  };

  const handleCopy = async (id: string, text?: string) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch { /* silent */ }
  };

  const filtered = credentials?.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = c.platformName.toLowerCase().includes(q) || c.username?.toLowerCase().includes(q);
    return selectedCategory === 'all' ? matchSearch : matchSearch && c.category.toLowerCase() === selectedCategory.toLowerCase();
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
          <h1 className="t-page-title">Credential Vault</h1>
          <p className="t-page-subtitle">AES-256-GCM encrypted storage. Secrets decrypted on-demand only.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="t-btn-primary flex items-center gap-2 text-sm"><Plus className="h-4 w-4" />Lock Secret</button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Lock className="h-5 w-5" style={{ color: 'var(--text-link)' }} />Store Secured Credential
              </DialogTitle>
            </DialogHeader>
            {formError && (
              <div className="flex items-center gap-2 text-xs p-2.5 rounded-md"
                style={{ background: 'rgba(232,160,144,0.12)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', borderRadius: 'var(--radius-sm)' }}>
                <AlertTriangle className="h-4 w-4 shrink-0" />{formError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Platform Name *"><input className={inputCls} style={rSm} placeholder="Stripe API, AWS Root…" value={form.platformName} onChange={e => setForm({ ...form, platformName: e.target.value })} required /></Field>
                <Field label="Category">
                  <select style={selectCls} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {categories.filter(c => c !== 'all').map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Username / ID"><input className={inputCls} style={rSm} placeholder="admin_account" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></Field>
                <Field label="Recovery Email"><input type="email" className={inputCls} style={rSm} placeholder="backup@agency.com" value={form.recoveryEmail} onChange={e => setForm({ ...form, recoveryEmail: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Password"><input type="password" className={inputCls} style={rSm} placeholder="Encrypted in DB" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>
                <Field label="API Key / Token"><input type="password" className={inputCls} style={rSm} placeholder="sk_live_…" value={form.secretKeys} onChange={e => setForm({ ...form, secretKeys: e.target.value })} /></Field>
              </div>
              <Field label="Secret Notes">
                <textarea className={`${inputCls} h-16 resize-none`} style={rSm} placeholder="Additional SSH config, host rules…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </Field>
              <Field label="Associated Projects">
                <div className="max-h-24 overflow-y-auto p-2.5 space-y-1.5" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  {projects && projects.length > 0
                    ? projects.map(proj => (
                      <label key={proj.id} className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                        <input type="checkbox" checked={form.projectIds.includes(proj.id)} onChange={() => toggleProject(proj.id)} className="rounded" style={{ accentColor: 'var(--accent-primary)' }} />
                        {proj.name}
                      </label>
                    ))
                    : <span className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>No projects created yet</span>
                  }
                </div>
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="t-btn-ghost text-sm" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="t-btn-primary text-sm">
                  {createMutation.isPending ? 'Encrypting…' : 'Lock Secrets'}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs + Search */}
      <div>
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
          <TabBar
            tabs={categories.map(cat => ({
              id: cat.toLowerCase(),
              label: cat,
            }))}
            activeTab={selectedCategory}
            onChange={setSelectedCategory}
          />
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
            <input className="t-input w-full pl-9 pr-4 py-2.5 text-sm" style={rSm} placeholder="Search platform, username…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(cred => (
              <CredCard
                key={cred.id}
                cred={cred}
                decrypted={decryptedSecrets[cred.id]}
                copiedId={copiedId}
                loadingRevealId={loadingRevealId}
                onReveal={handleReveal}
                onCopy={handleCopy}
              />
            ))}
          </div>
        ) : (
          <div className="t-empty">
            <ShieldCheck className="h-10 w-10" style={{ color: 'var(--border-default)' }} />
            <span className="text-sm font-semibold">No secrets match this filter</span>
          </div>
        )}
      </div>
    </div>
  );
}
