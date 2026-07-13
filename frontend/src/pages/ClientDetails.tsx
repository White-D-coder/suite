import React, { useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import {
  Building, User, Mail, Phone, Globe, Plus, ArrowLeft,
  Loader2, AlertTriangle, Send, MessageSquare, FileDown,
  Trash2, Layers, ShieldAlert, Award
} from 'lucide-react';

interface Project { id: string; name: string; status: string; techStack: string[]; liveUrl?: string; }
interface Invoice {
  id: string; invoiceNumber: string; total: number; status: string; issueDate: string; pdfUrl?: string;
  currency: string; fxRate?: number; project?: { name: string };
  lineItems?: { id: string; description: string; quantity: number; unitPrice: number; total: number }[];
  schedules?: { id: string; milestoneName: string; amountDue: number; paymentStatus: string; dueDate?: string }[];
}
interface Communication { id: string; type: string; subject?: string; content: string; sentAt: string; }
interface ContactChannel { id: string; channelType: string; value: string; isPrimary: boolean }
interface ClientContact { id: string; name: string; email?: string; title?: string; channels: ContactChannel[] }

interface ClientDetail {
  id: string; name: string; company?: string; email?: string; phone?: string;
  country?: string; currency?: string; billingAddress?: string; paymentTerms?: string; notes?: string;
  projects: Project[]; invoices: Invoice[]; communications: Communication[];
  contacts: ClientContact[];
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

export default function ClientDetails() {
  const { user } = useOutletContext<{ user: any }>();
  const role = user?.role || 'employee';
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [projOpen, setProjOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);

  // CRM Contacts Dialog States
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', title: '' });
  const [contactError, setContactError] = useState('');

  const [channelOpen, setChannelOpen] = useState(false);
  const [targetContactId, setTargetContactId] = useState<string | null>(null);
  const [channelForm, setChannelForm] = useState({ channelType: 'whatsapp', value: '', isPrimary: false });

  const [projectForm, setProjectForm] = useState({ name: '', description: '', techStackRaw: '', githubRepoUrl: '', liveUrl: '', stagingUrl: '', hostingPlatform: '', databasePlatform: '', deploymentPlatform: '' });
  const [projError, setProjError] = useState('');
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', content: '' });
  const [emailError, setEmailError] = useState('');
  const [waForm, setWaForm] = useState({ to: '', content: '' });
  const [waError, setWaError] = useState('');

  // Invoice Details Drawer States
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(false);

  const { data: client, isLoading, isError } = useQuery<ClientDetail>({
    queryKey: ['client-detail', clientId],
    queryFn: () => api.get(`/clients/${clientId}`).then(r => r.data),
    enabled: !!clientId,
  });

  const createProjectMutation = useMutation({
    mutationFn: (p: any) => api.post('/projects', p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client-detail', clientId] }); setProjOpen(false); setProjectForm({ name: '', description: '', techStackRaw: '', githubRepoUrl: '', liveUrl: '', stagingUrl: '', hostingPlatform: '', databasePlatform: '', deploymentPlatform: '' }); setProjError(''); },
    onError: (e: any) => setProjError(e.response?.data?.message || 'Failed to create project.'),
  });

  const sendEmailMutation = useMutation({
    mutationFn: (p: any) => api.post('/comms/email', p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client-detail', clientId] }); setMailOpen(false); setEmailForm({ to: '', subject: '', content: '' }); setEmailError(''); },
    onError: (e: any) => setEmailError(e.response?.data?.message || 'Failed to send email.'),
  });

  const sendWaMutation = useMutation({
    mutationFn: (p: any) => api.post('/comms/whatsapp', p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client-detail', clientId] }); setWaOpen(false); setWaForm({ to: '', content: '' }); setWaError(''); },
    onError: (e: any) => setWaError(e.response?.data?.message || 'Failed to send WhatsApp message.'),
  });

  // Contact Persons mutations
  const addContactMutation = useMutation({
    mutationFn: (p: any) => api.post(`/clients/${clientId}/contacts`, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-detail', clientId] });
      setContactOpen(false);
      setContactForm({ name: '', email: '', title: '' });
      setContactError('');
    },
    onError: (e: any) => setContactError(e.response?.data?.message || 'Failed to add contact.'),
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => api.delete(`/clients/contacts/${contactId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-detail', clientId] }),
  });

  const addChannelMutation = useMutation({
    mutationFn: (p: any) => api.post(`/clients/contacts/${targetContactId}/channels`, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-detail', clientId] });
      setChannelOpen(false);
      setChannelForm({ channelType: 'whatsapp', value: '', isPrimary: false });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (channelId: string) => api.delete(`/clients/channels/${channelId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-detail', clientId] }),
  });

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} /></div>;
  if (isError || !client) return (
    <div className="text-center py-20">
      <AlertTriangle className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--status-offline)' }} />
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Could not load client details.</p>
      <button onClick={() => navigate('/dashboard/clients')} className="t-btn-ghost text-sm mt-4">Go Back</button>
    </div>
  );

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-5">
        <button onClick={() => navigate('/dashboard/clients')} className="flex items-center justify-center w-9 h-9 rounded-md t-btn-ghost" style={{ minHeight: '36px', padding: 0 }} aria-label="Go back"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="t-page-title" style={{ fontSize: '1.4rem' }}>{client.name}</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{client.company || 'Private Client'}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column — profile + contacts */}
        <div className="space-y-5">
          {/* Profile */}
          <div className="t-card p-5 space-y-3 text-xs">
            <p className="t-label">Client Profile</p>
            <div className="space-y-2.5 pt-1" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              {client.company && <div className="flex items-center gap-2"><Building className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} /><span style={{ color: 'var(--text-primary)' }}>{client.company}</span></div>}
              {client.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} /><a href={`mailto:${client.email}`} className="t-link truncate">{client.email}</a></div>}
              {client.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} /><span style={{ color: 'var(--text-primary)' }}>{client.phone}</span></div>}
              {client.country && <div className="flex items-center gap-2"><Globe className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} /><span style={{ color: 'var(--text-primary)' }}>{client.country}</span></div>}
            </div>
            <div className="space-y-1 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <p className="t-label">Billing Preferences</p>
              <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Currency: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{client.currency || 'USD'}</span></p>
              <p>Terms: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{client.paymentTerms || 'Net 30'}</span></p>
            </div>
            {client.notes && (
              <div className="pt-3 space-y-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <p className="t-label">Notes</p>
                <p className="leading-relaxed whitespace-pre-wrap mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{client.notes}</p>
              </div>
            )}
          </div>

          {/* CRM Multiple POCs Card */}
          <div className="t-card p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
              <p className="t-label">Associated Contact Persons</p>
              {role !== 'employee' && (
                <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                  <DialogTrigger asChild>
                    <button className="flex items-center justify-center w-7 h-7 rounded t-btn-ghost" style={{ padding: 0 }}><Plus size={14} /></button>
                  </DialogTrigger>
                  <DialogContent style={dialogStyle}>
                    <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Add Contact Person</DialogTitle></DialogHeader>
                    <ErrBanner msg={contactError} />
                    <form onSubmit={e => { e.preventDefault(); addContactMutation.mutate(contactForm); }} className="space-y-4 pt-2">
                      <Field label="POC Full Name *"><input className={inputCls} placeholder="John Doe" value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} required /></Field>
                      <Field label="Email Address"><input className={inputCls} type="email" placeholder="john@company.com" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} /></Field>
                      <Field label="Title / Role"><input className={inputCls} placeholder="Tech Director, Product Owner" value={contactForm.title} onChange={e => setContactForm({ ...contactForm, title: e.target.value })} /></Field>
                      <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setContactOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Add Person</button></div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {client.contacts?.length > 0 ? (
              <div className="space-y-3">
                {client.contacts.map(poc => (
                  <div key={poc.id} className="p-3 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-[var(--text-primary)]">{poc.name}</p>
                        <p className="text-[10px] text-[var(--text-tertiary)]">{poc.title || 'Point of Contact'}</p>
                      </div>
                      {role !== 'employee' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setTargetContactId(poc.id);
                              setChannelOpen(true);
                            }}
                            className="text-[10px] text-[var(--accent)] hover:underline"
                          >
                            + Channel
                          </button>
                          <button onClick={() => deleteContactMutation.mutate(poc.id)} className="text-red-400 hover:text-red-300 ml-1.5"><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>

                    {poc.channels?.length > 0 ? (
                      <div className="space-y-1 text-[10px] border-t border-[var(--border-subtle)] pt-1.5">
                        {poc.channels.map(ch => (
                          <div key={ch.id} className="flex justify-between items-center text-[var(--text-secondary)]">
                            <span className="capitalize font-semibold">{ch.channelType}:</span>
                            <div className="flex items-center gap-2">
                              <span>{ch.value}</span>
                              {role !== 'employee' && (
                                <button onClick={() => deleteChannelMutation.mutate(ch.id)} className="text-red-400 hover:text-red-300"><Trash2 size={10} /></button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-[10px] italic text-[var(--text-tertiary)] pt-1.5">No alternate communication channels</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-xs italic text-[var(--text-tertiary)]">No POCs registered</p>}
          </div>

          {/* Quick Dispatch Updates */}
          {role !== 'employee' && (
            <div className="t-card p-5 space-y-3 text-xs">
              <p className="t-label">Quick Escalation Communications</p>
              <div className="flex gap-2 pt-1">
                <button className="t-btn-ghost py-2 text-[10px] flex-1 flex items-center justify-center gap-1" onClick={() => { setEmailForm({ to: client.email || '', subject: 'Urgent Update', content: '' }); setMailOpen(true); }}><Send size={12} /> Email</button>
                <button className="t-btn-ghost py-2 text-[10px] flex-1 flex items-center justify-center gap-1" onClick={() => { setWaForm({ to: client.phone || '', content: '' }); setWaOpen(true); }}><MessageSquare size={12} /> WhatsApp</button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column — projects, invoices, timeline comms */}
        <div className="md:col-span-2 space-y-5">
          {/* Projects */}
          <div className="t-card overflow-hidden">
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Active Projects</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Linked developer instances</p>
              </div>
              {['owner', 'admin'].includes(role) && (
                <button onClick={() => setProjOpen(true)} className="t-btn-ghost text-xs flex items-center gap-1.5" style={{ minHeight: '32px', padding: '0 0.75rem', borderRadius: 'var(--radius-sm)' }}><Plus className="h-3.5 w-3.5" />Project</button>
              )}
            </div>

            {client.projects.length > 0 ? (
              <table className="t-table text-xs">
                <thead><tr><th>Name</th><th>Status</th><th>Tech Stack</th></tr></thead>
                <tbody>
                  {client.projects.map(p => (
                    <tr key={p.id} className="cursor-pointer" onClick={() => navigate(`/dashboard/projects/${p.id}`)}>
                      <td><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</span></td>
                      <td>
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          p.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>{p.status}</span>
                      </td>
                      <td><span className="truncate max-w-[150px] block text-[var(--text-tertiary)]">{p.techStack.join(', ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-center py-8 text-xs text-[var(--text-tertiary)]">No active projects linked</p>}
          </div>

          {/* Invoices */}
          <div className="t-card overflow-hidden">
            <div className="p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Invoice ledger</p>
            </div>
            {client.invoices.length > 0 ? (
              <table className="t-table text-xs">
                <thead><tr><th>Invoice No.</th><th>Total Billed</th><th>Issue Date</th><th>Status</th><th className="text-right pr-4">PDF</th></tr></thead>
                <tbody>
                  {client.invoices.map(inv => (
                    <tr
                      key={inv.id}
                      className="cursor-pointer hover:bg-[var(--surface-sunken)] transition-colors"
                      onClick={() => { setSelectedInvoice(inv); setInvoiceDetailOpen(true); }}
                    >
                      <td><span className="font-mono font-bold">{inv.invoiceNumber}</span></td>
                      <td><span className="font-bold font-mono text-[var(--text-link)]">${Number(inv.total).toFixed(2)}</span></td>
                      <td><span className="text-[var(--text-secondary)]">{new Date(inv.issueDate).toLocaleDateString()}</span></td>
                      <td>
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>{inv.status}</span>
                      </td>
                      <td className="text-right">
                        {inv.pdfUrl
                          ? <a href={inv.pdfUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center justify-end gap-1 t-link text-xs no-underline hover:underline"><FileDown className="h-3.5 w-3.5" />PDF</a>
                          : <span className="text-xs italic text-[var(--text-tertiary)]">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-center py-8 text-xs text-[var(--text-tertiary)]">No billing history found</p>}
          </div>

          {/* Communications timeline */}
          <div className="t-card p-5">
            <p className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Dispatch Communications Feed</p>
            {client.communications.length > 0 ? (
              <div className="relative pl-6 space-y-5" style={{ borderLeft: '2px solid var(--border-subtle)' }}>
                {client.communications.map(comm => (
                  <div key={comm.id} className="relative">
                    <span
                      className="absolute -left-[25px] top-1 h-3 w-3 rounded-full"
                      style={{ background: comm.type === 'email' ? 'var(--accent)' : 'var(--status-online)', border: '2px solid var(--surface-card)' }}
                    />
                    <div className="flex items-center gap-2 mb-1 text-xs">
                      <span className="font-bold capitalize">{comm.type} message sent</span>
                      <span className="text-[10px] text-[var(--text-tertiary)]">{new Date(comm.sentAt).toLocaleString()}</span>
                    </div>
                    {comm.subject && <p className="text-xs font-semibold mb-1 text-[var(--text-secondary)]">Subject: {comm.subject}</p>}
                    <p className="text-[11px] leading-relaxed whitespace-pre-wrap p-2.5 rounded bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      {comm.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : <p className="text-center py-6 text-xs text-[var(--text-tertiary)]">No communication history</p>}
          </div>
        </div>
      </div>

      {/* Dialog for adding Contact Channel */}
      <Dialog open={channelOpen} onOpenChange={setChannelOpen}>
        <DialogContent style={dialogStyle}>
          <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Add Communication Channel</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); addChannelMutation.mutate(channelForm); }} className="space-y-4 pt-2">
            <Field label="Channel Type">
              <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={channelForm.channelType} onChange={e => setChannelForm({ ...channelForm, channelType: e.target.value })}>
                <option value="whatsapp">WhatsApp Phone</option>
                <option value="slack">Slack Channel ID</option>
                <option value="skype">Skype ID</option>
                <option value="telegram">Telegram Username</option>
              </select>
            </Field>
            <Field label="Channel Destination Value *">
              <input className={inputCls} placeholder="+15550099, @john_direct" value={channelForm.value} onChange={e => setChannelForm({ ...channelForm, value: e.target.value })} required />
            </Field>
            <Field label="Priority Designation">
              <label className="flex items-center gap-2 text-xs cursor-pointer py-1">
                <input type="checkbox" checked={channelForm.isPrimary} onChange={e => setChannelForm({ ...channelForm, isPrimary: e.target.checked })} style={{ accentColor: 'var(--accent-primary)' }} />
                Set as Primary Channel
              </label>
            </Field>
            <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setChannelOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Add Channel</button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for adding Project */}
      <Dialog open={projOpen} onOpenChange={setProjOpen}>
        <DialogContent className="max-w-lg" style={dialogStyle}>
          <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Add Client Project</DialogTitle></DialogHeader>
          <ErrBanner msg={projError} />
          <form onSubmit={e => { e.preventDefault(); setProjError(''); if (!projectForm.name) { setProjError('Project name is required.'); return; } createProjectMutation.mutate({ ...projectForm, clientId, techStack: projectForm.techStackRaw.split(',').map(s => s.trim()).filter(Boolean) }); }} className="space-y-4 pt-2">
            <Field label="Project Name *"><input className={inputCls} style={rSm} placeholder="Mobile App Rewrite" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} required /></Field>
            <Field label="Description"><textarea className={`${inputCls} h-16 resize-none`} style={rSm} value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Live URL"><input className={inputCls} style={rSm} placeholder="https://…" value={projectForm.liveUrl} onChange={e => setProjectForm(f => ({ ...f, liveUrl: e.target.value }))} /></Field>
              <Field label="GitHub Repo"><input className={inputCls} style={rSm} placeholder="https://github.com/…" value={projectForm.githubRepoUrl} onChange={e => setProjectForm(f => ({ ...f, githubRepoUrl: e.target.value }))} /></Field>
            </div>
            <Field label="Tech Stack (comma separated)"><input className={inputCls} style={rSm} placeholder="React, NestJS, Tailwind" value={projectForm.techStackRaw} onChange={e => setProjectForm(f => ({ ...f, techStackRaw: e.target.value }))} /></Field>
            <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setProjOpen(false)}>Cancel</button><button type="submit" disabled={createProjectMutation.isPending} className="t-btn-primary text-sm">{createProjectMutation.isPending ? 'Saving…' : 'Create'}</button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Email Update */}
      <Dialog open={mailOpen} onOpenChange={setMailOpen}>
        <DialogContent style={dialogStyle}>
          <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Send Email Update</DialogTitle></DialogHeader>
          <ErrBanner msg={emailError} />
          <form onSubmit={e => { e.preventDefault(); setEmailError(''); sendEmailMutation.mutate({ ...emailForm, clientId }); }} className="space-y-4 pt-2">
            <Field label="To"><input type="email" className={inputCls} style={rSm} value={emailForm.to} onChange={e => setEmailForm(f => ({ ...f, to: e.target.value }))} required /></Field>
            <Field label="Subject"><input className={inputCls} style={rSm} placeholder="Project Progress Report" value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} required /></Field>
            <Field label="Message Body"><textarea className={`${inputCls} h-32 resize-none`} style={rSm} value={emailForm.content} onChange={e => setEmailForm(f => ({ ...f, content: e.target.value }))} required /></Field>
            <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setMailOpen(false)}>Cancel</button><button type="submit" disabled={sendEmailMutation.isPending} className="t-btn-primary text-sm">{sendEmailMutation.isPending ? 'Sending…' : 'Send Email'}</button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for WhatsApp Update */}
      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent style={dialogStyle}>
          <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Send WhatsApp Message</DialogTitle></DialogHeader>
          <ErrBanner msg={waError} />
          <form onSubmit={e => { e.preventDefault(); setWaError(''); sendWaMutation.mutate({ ...waForm, clientId }); }} className="space-y-4 pt-2">
            <Field label="Phone Number"><input className={inputCls} style={rSm} placeholder="+15550199" value={waForm.to} onChange={e => setWaForm(f => ({ ...f, to: e.target.value }))} required /></Field>
            <Field label="Message Body"><textarea className={`${inputCls} h-32 resize-none`} style={rSm} value={waForm.content} onChange={e => setWaForm(f => ({ ...f, content: e.target.value }))} required /></Field>
            <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setWaOpen(false)}>Cancel</button><button type="submit" disabled={sendWaMutation.isPending} className="t-btn-primary text-sm">{sendWaMutation.isPending ? 'Sending…' : 'Send WhatsApp'}</button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice Details Modal */}
      <Dialog open={invoiceDetailOpen} onOpenChange={setInvoiceDetailOpen}>
        <DialogContent style={dialogStyle} className="max-w-2xl">
          <DialogHeader>
            <div className="flex justify-between items-center pr-6">
              <DialogTitle style={{ color: 'var(--text-primary)' }}>
                Invoice Details: {selectedInvoice?.invoiceNumber}
              </DialogTitle>
              {selectedInvoice && (
                <span className={`px-2 py-0.5 rounded font-bold text-xs capitalize ${
                  selectedInvoice.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {selectedInvoice.status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4 pt-2 text-xs leading-relaxed">
              <div className="grid grid-cols-2 gap-4 border-b border-[var(--border-subtle)] pb-3">
                <div>
                  <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-1">Issue Date</p>
                  <p className="font-medium text-[var(--text-primary)]">{new Date(selectedInvoice.issueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-1">Project Associated</p>
                  <p className="font-medium text-[var(--text-primary)]">{selectedInvoice.project?.name || 'General Invoicing (No project)'}</p>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-2">Scope of Work & Line Items</p>
                <div className="space-y-1.5">
                  {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 ? (
                    selectedInvoice.lineItems.map(item => (
                      <div key={item.id} className="p-2.5 rounded bg-[var(--surface-sunken)] border border-[var(--border-subtle)] flex items-center justify-between gap-4">
                        <span className="font-semibold text-[var(--text-primary)]">{item.description}</span>
                        <span className="font-mono text-[var(--text-secondary)] shrink-0">
                          {item.quantity} x ${Number(item.unitPrice).toFixed(2)} = <strong className="text-[var(--text-link)]">${Number(item.total).toFixed(2)}</strong>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="italic text-[var(--text-tertiary)]">No line items specified</p>
                  )}
                </div>
              </div>

              {/* Milestones if progressive billing */}
              {selectedInvoice.schedules && selectedInvoice.schedules.length > 0 && (
                <div>
                  <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-2">Billing Milestones</p>
                  <div className="space-y-1.5">
                    {selectedInvoice.schedules.map(sch => (
                      <div key={sch.id} className="p-2.5 rounded bg-[var(--surface-sunken)] border border-[var(--border-subtle)] flex items-center justify-between gap-4">
                        <span className="font-semibold text-[var(--text-primary)]">{sch.milestoneName}</span>
                        <div className="flex items-center gap-2 font-mono shrink-0">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            sch.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>{sch.paymentStatus}</span>
                          <strong className="text-[var(--text-primary)]">${Number(sch.amountDue).toFixed(2)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Multi-currency exchange rate & totals */}
              <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg space-y-1 text-right">
                <p style={{ color: 'var(--text-primary)' }}>Total Base USD: <span className="font-mono font-bold text-[var(--text-primary)]">${Number(selectedInvoice.total).toFixed(2)}</span></p>
                {selectedInvoice.currency !== 'USD' && selectedInvoice.fxRate && (
                  <>
                    <p style={{ color: 'var(--text-secondary)' }} className="text-xs">
                      Local Billed Amount: <strong className="font-mono text-[var(--accent)] text-sm">{selectedInvoice.currency} {(Number(selectedInvoice.total) * Number(selectedInvoice.fxRate)).toFixed(2)}</strong>
                    </p>
                    <p style={{ color: 'var(--text-tertiary)' }} className="text-[10px] italic">
                      FX Rate: 1 USD = {Number(selectedInvoice.fxRate).toFixed(4)} {selectedInvoice.currency}
                    </p>
                  </>
                )}
              </div>

              {/* Footer downloads */}
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button type="button" className="t-btn-ghost text-xs" onClick={() => setInvoiceDetailOpen(false)}>Close Details</button>
                {selectedInvoice.pdfUrl && (
                  <a href={selectedInvoice.pdfUrl} target="_blank" rel="noreferrer" className="t-btn-primary text-xs flex items-center gap-1.5">
                    <FileDown size={14} /> Download Invoice PDF
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
