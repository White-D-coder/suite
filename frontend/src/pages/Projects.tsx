import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Search, Plus, Briefcase, ExternalLink, Globe, AlertTriangle, Loader2, CircleDot, Filter, RefreshCw, Lock, ChevronDown, X, Check } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  clientId: string;
  client: { name: string; company?: string };
  status: string;
  liveUrl?: string;
  hostingPlatform?: string;
  techStack: string[];
  country?: string;
  state?: string;
  projectCategory?: string;
  serviceType?: string;
  contractStatus?: string;
  progressStatus?: string;
  assignments: { employee: { id: string; name: string } }[];
  websiteMonitors?: { lastStatus: string }[];
}

interface Client {
  id: string;
  name: string;
  company?: string;
}

const emptyForm = {
  clientId: '',
  name: '',
  description: '',
  techStackRaw: '',
  githubRepoUrl: '',
  liveUrl: '',
  stagingUrl: '',
  hostingPlatform: '',
  databasePlatform: '',
  deploymentPlatform: '',
  country: '',
  state: '',
  projectCategory: 'web',
  serviceType: 'development',
  contractStatus: 'active',
  progressStatus: 'scoping',
  currency: 'USD',
};

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
  const { user } = useOutletContext<{ user: any }>();
  const role = user?.role || 'employee';
  const qc = useQueryClient();
  const navigate = useNavigate();
  
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  // Client searchable combobox state
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientComboRef = useRef<HTMLDivElement>(null);

  // Close client dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientComboRef.current && !clientComboRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedClient = clients?.find(c => c.id === form.clientId);
  const filteredClients = clients?.filter(c => {
    const q = clientSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q);
  }) ?? [];
  
  // Access Request states for Employees
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestProjId, setRequestProjId] = useState('');
  const [requestScope, setRequestScope] = useState('collection');
  const [requestDuration, setRequestDuration] = useState('24');
  const [requestError, setRequestError] = useState('');

  // Search-enabled Advanced Filters State
  const [filters, setFilters] = useState({
    country: '',
    state: '',
    company: '',
    category: '',
    serviceType: '',
    contractStatus: '',
    tech: '',
    assignee: '',
  });

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects-list'],
    queryFn: () => api.get('/projects').then(r => r.data),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients').then(r => r.data),
    enabled: role !== 'employee',
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/projects', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects-list'] });
      setOpen(false);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to create project.'),
  });

  const createClientMutation = useMutation({
    mutationFn: (name: string) => api.post('/clients', { name }).then(r => r.data),
    onSuccess: (newClient: any) => {
      qc.invalidateQueries({ queryKey: ['clients-list'] });
      setForm(prev => ({ ...prev, clientId: newClient.id }));
      setClientSearch('');
      setClientDropdownOpen(false);
    },
  });

  const requestAccessMutation = useMutation({
    mutationFn: (p: any) => api.post('/credentials/requests', p),
    onSuccess: () => {
      alert('Access request submitted successfully.');
      setRequestOpen(false);
      setRequestError('');
    },
    onError: (e: any) => setRequestError(e.response?.data?.message || 'Access request failed.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.clientId) {
      setFormError('Please select a client.');
      return;
    }
    if (!form.name) {
      setFormError('Project name is required.');
      return;
    }
    createMutation.mutate({
      ...form,
      techStack: form.techStackRaw.split(',').map(s => s.trim()).filter(Boolean),
    });
  };

  const clearFilters = () => {
    setFilters({
      country: '',
      state: '',
      company: '',
      category: '',
      serviceType: '',
      contractStatus: '',
      tech: '',
      assignee: '',
    });
    setSearch('');
  };

  // Client-side execution of advanced matching rules
  const filtered = projects?.filter(p => {
    // 1. General search
    const q = search.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) ||
      p.client.name.toLowerCase().includes(q) ||
      p.hostingPlatform?.toLowerCase().includes(q);

    // 2. Advanced filters
    const matchesCountry = !filters.country || (p.country && p.country.toLowerCase().includes(filters.country.toLowerCase()));
    const matchesState = !filters.state || (p.state && p.state.toLowerCase().includes(filters.state.toLowerCase()));
    const matchesCompany = !filters.company || (p.client.company && p.client.company.toLowerCase().includes(filters.company.toLowerCase()));
    const matchesCategory = !filters.category || p.projectCategory === filters.category;
    const matchesService = !filters.serviceType || p.serviceType === filters.serviceType;
    const matchesContract = !filters.contractStatus || p.contractStatus === filters.contractStatus;
    const matchesTech = !filters.tech || p.techStack.some(t => t.toLowerCase().includes(filters.tech.toLowerCase()));
    const matchesAssignee = !filters.assignee || p.assignments.some(a => a.employee.name.toLowerCase().includes(filters.assignee.toLowerCase()));

    return matchesSearch && matchesCountry && matchesState && matchesCompany && matchesCategory && matchesService && matchesContract && matchesTech && matchesAssignee;
  }) ?? [];

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="t-page-title">Projects Command Center</h1>
          <p className="t-page-subtitle">Track deployments, staffing assignments, and secure vaults.</p>
        </div>

        {['owner', 'admin'].includes(role) && (
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

              {formError && <ErrBanner msg={formError} />}

              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <Field label="Client *">
                  <div ref={clientComboRef} style={{ position: 'relative' }}>
                    {/* Trigger input */}
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        border: `1px solid ${clientDropdownOpen ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-card)',
                        padding: '0 10px',
                        height: '36px',
                        cursor: 'text',
                        transition: 'border-color 0.15s',
                        boxShadow: clientDropdownOpen ? '0 0 0 2px rgba(var(--accent-primary-rgb, 99,102,241),0.15)' : 'none',
                      }}
                      onClick={() => { setClientDropdownOpen(true); }}
                    >
                      <Search style={{ width: 13, height: 13, color: 'var(--text-tertiary)', flexShrink: 0 }} />
                      <input
                        type="text"
                        placeholder={selectedClient ? '' : 'Type to search client…'}
                        value={clientDropdownOpen ? clientSearch : (selectedClient ? '' : '')}
                        onChange={e => { setClientSearch(e.target.value); setClientDropdownOpen(true); }}
                        onFocus={() => setClientDropdownOpen(true)}
                        style={{
                          flex: 1, background: 'transparent', border: 'none', outline: 'none',
                          fontSize: '13px', color: 'var(--text-primary)',
                          display: clientDropdownOpen ? 'block' : (selectedClient ? 'none' : 'block'),
                        }}
                      />
                      {selectedClient && !clientDropdownOpen && (
                        <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedClient.name}{selectedClient.company ? ` (${selectedClient.company})` : ''}
                        </span>
                      )}
                      {selectedClient ? (
                        <button type="button" onClick={e => { e.stopPropagation(); setForm({ ...form, clientId: '' }); setClientSearch(''); setClientDropdownOpen(false); }}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <X style={{ width: 13, height: 13, color: 'var(--text-tertiary)' }} />
                        </button>
                      ) : (
                        <ChevronDown style={{ width: 13, height: 13, color: 'var(--text-tertiary)', flexShrink: 0, transform: clientDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                      )}
                    </div>

                    {/* Dropdown list */}
                    {clientDropdownOpen && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                        background: 'var(--surface-card)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                        marginTop: '4px',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                      }}>
                        {filteredClients.length === 0 && !clientSearch.trim() ? (
                          <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                            No clients yet
                          </div>
                        ) : filteredClients.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setForm({ ...form, clientId: c.id });
                              setClientSearch('');
                              setClientDropdownOpen(false);
                            }}
                            style={{
                              width: '100%', textAlign: 'left', padding: '8px 12px',
                              background: form.clientId === c.id ? 'var(--surface-sunken)' : 'transparent',
                              border: 'none', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                              fontSize: '13px', color: 'var(--text-primary)',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
                            onMouseLeave={e => (e.currentTarget.style.background = form.clientId === c.id ? 'var(--surface-sunken)' : 'transparent')}
                          >
                            <span>
                              <span style={{ fontWeight: 600 }}>{c.name}</span>
                              {c.company && <span style={{ marginLeft: 6, fontSize: '11px', color: 'var(--text-tertiary)' }}>{c.company}</span>}
                            </span>
                            {form.clientId === c.id && <Check style={{ width: 12, height: 12, color: 'var(--accent-primary)' }} />}
                          </button>
                        ))}

                        {clientSearch.trim() && (
                          <>
                            {filteredClients.length > 0 && (
                              <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />
                            )}
                            <button
                              type="button"
                              disabled={createClientMutation.isPending}
                              onClick={() => createClientMutation.mutate(clientSearch.trim())}
                              style={{
                                width: '100%', textAlign: 'left', padding: '9px 12px',
                                background: 'transparent',
                                border: 'none', cursor: createClientMutation.isPending ? 'wait' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '7px',
                                fontSize: '13px',
                                color: 'var(--accent-primary, #6366f1)',
                                fontWeight: 600,
                                transition: 'background 0.1s',
                                opacity: createClientMutation.isPending ? 0.6 : 1,
                              }}
                              onMouseEnter={e => { if (!createClientMutation.isPending) e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; }}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <Plus style={{ width: 13, height: 13, flexShrink: 0 }} />
                              <span>
                                {createClientMutation.isPending ? 'Creating…' : <>
                                  Create &nbsp;<em style={{ fontStyle: 'normal', background: 'rgba(99,102,241,0.12)', borderRadius: '3px', padding: '1px 5px' }}>"{clientSearch.trim()}"</em>&nbsp; as new client
                                </>}
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </Field>
                <Field label="Project Name *">
                  <input className={inputCls} style={{ borderRadius: 'var(--radius-sm)' }} placeholder="Acme E-Commerce" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </Field>
                <Field label="Description">
                  <textarea className={`${inputCls} h-14 resize-none`} style={{ borderRadius: 'var(--radius-sm)' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </Field>
                
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Category">
                    <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={form.projectCategory} onChange={e => setForm({ ...form, projectCategory: e.target.value })}>
                      <option value="web">Web App</option>
                      <option value="AI">AI Integration</option>
                      <option value="mobile">Mobile App</option>
                      <option value="automation">Workflow Automation</option>
                      <option value="marketing">Marketing Platform</option>
                    </select>
                  </Field>
                  <Field label="Service Type">
                    <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value })}>
                      <option value="development">Development</option>
                      <option value="consulting">Consulting</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Country">
                    <input className={inputCls} style={{ borderRadius: 'var(--radius-sm)' }} placeholder="United States" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
                  </Field>
                  <Field label="State">
                    <input className={inputCls} style={{ borderRadius: 'var(--radius-sm)' }} placeholder="California" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
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
        )}
      </div>

      {/* Advanced Typing Filters Section */}
      <div className="t-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={15} style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Searchable Filters</span>
          </div>
          {(Object.values(filters).some(Boolean) || search) && (
            <button onClick={clearFilters} className="t-btn-secondary py-1 px-2.5 text-xs flex items-center gap-1">
              <RefreshCw size={11} /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-tertiary)' }}>General Search</label>
            <input
              type="text"
              placeholder="Search name, client..."
              className="t-input w-full p-2 text-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-tertiary)' }}>Client Company</label>
            <input
              type="text"
              placeholder="Type company..."
              className="t-input w-full p-2 text-xs"
              value={filters.company}
              onChange={e => setFilters({ ...filters, company: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-tertiary)' }}>Country</label>
            <input
              type="text"
              placeholder="Type country..."
              className="t-input w-full p-2 text-xs"
              value={filters.country}
              onChange={e => setFilters({ ...filters, country: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-tertiary)' }}>State</label>
            <input
              type="text"
              placeholder="Type state..."
              className="t-input w-full p-2 text-xs"
              value={filters.state}
              onChange={e => setFilters({ ...filters, state: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-tertiary)' }}>Tech Stack</label>
            <input
              type="text"
              placeholder="Type tech (e.g. React)..."
              className="t-input w-full p-2 text-xs"
              value={filters.tech}
              onChange={e => setFilters({ ...filters, tech: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-tertiary)' }}>Assignee Name</label>
            <input
              type="text"
              placeholder="Type developer name..."
              className="t-input w-full p-2 text-xs"
              value={filters.assignee}
              onChange={e => setFilters({ ...filters, assignee: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-tertiary)' }}>Category</label>
            <select
              className="t-input w-full p-2 text-xs"
              value={filters.category}
              onChange={e => setFilters({ ...filters, category: e.target.value })}
              style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }}
            >
              <option value="">All Categories</option>
              <option value="web">Web App</option>
              <option value="AI">AI Integration</option>
              <option value="mobile">Mobile App</option>
              <option value="automation">Workflow Automation</option>
              <option value="marketing">Marketing Platform</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-tertiary)' }}>Contract Status</label>
            <select
              className="t-input w-full p-2 text-xs"
              value={filters.contractStatus}
              onChange={e => setFilters({ ...filters, contractStatus: e.target.value })}
              style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
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
                  <div className="flex flex-col items-end gap-1.5">
                    {online  && <span className="t-badge-online"><CircleDot className="h-2.5 w-2.5" />Online</span>}
                    {offline && <span className="t-badge-offline"><CircleDot className="h-2.5 w-2.5" />Offline</span>}
                    {!mon    && <span className="t-badge-neutral">No monitor</span>}
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      {proj.projectCategory || 'web'}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{proj.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {proj.client.name}{proj.client.company ? ` · ${proj.client.company}` : ''}
                  </p>
                  {proj.country && (
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      📍 {proj.country}{proj.state ? `, ${proj.state}` : ''}
                    </p>
                  )}
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

                  {role === 'employee' && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setRequestProjId(proj.id);
                        setRequestOpen(true);
                      }}
                      className="t-btn-secondary py-0.5 px-2 text-[10px] flex items-center gap-1 font-semibold hover:bg-[var(--surface-sunken)]"
                      style={{ minHeight: 'auto' }}
                    >
                      <Lock size={10} /> Request Access
                    </button>
                  )}

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
      {/* Employee Access Request Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)' }}>
          <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Request Project Secrets Access</DialogTitle></DialogHeader>
          <ErrBanner msg={requestError} />
          <form onSubmit={e => { e.preventDefault(); requestAccessMutation.mutate({ projectId: requestProjId, secretScope: requestScope, durationHours: Number(requestDuration) }); }} className="space-y-4 pt-2">
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
    </div>
  );
}

function ErrBanner({ msg }: { msg: string }) {
  return msg ? (
    <div className="flex items-center gap-2 text-xs p-2.5 rounded-md"
      style={{ background: 'rgba(243,195,178,0.2)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', borderRadius: 'var(--radius-sm)' }}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {msg}
    </div>
  ) : null;
}
