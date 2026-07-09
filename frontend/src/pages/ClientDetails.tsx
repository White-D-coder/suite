import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import {
  Building, User, Mail, Phone, Globe, Plus, ArrowLeft,
  Loader2, AlertTriangle, Send, MessageSquare, FileDown,
} from 'lucide-react';

interface Project { id: string; name: string; status: string; techStack: string[]; liveUrl?: string; }
interface Invoice { id: string; invoiceNumber: string; total: number; status: string; issueDate: string; pdfUrl?: string; }
interface Communication { id: string; type: string; subject?: string; content: string; sentAt: string; }
interface ClientDetail {
  id: string; name: string; company?: string; email?: string; phone?: string;
  country?: string; currency?: string; billingAddress?: string; paymentTerms?: string; notes?: string;
  projects: Project[]; invoices: Invoice[]; communications: Communication[];
}

const inputCls = 't-input w-full px-3 py-2.5 text-sm';
const rSm = { borderRadius: 'var(--radius-sm)' };
const dialogStyle = { background: 'var(--surface-card)', border: '1px solid var(--border-default)' };
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><label className="t-label">{label}</label>{children}</div>; }
function ErrBanner({ msg }: { msg: string }) { return msg ? <div className="flex items-center gap-2 text-xs p-2.5 rounded-md" style={{ background: 'rgba(243,195,178,0.2)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', ...rSm }}><AlertTriangle className="h-4 w-4 shrink-0" />{msg}</div> : null; }

function InvBadge({ status }: { status: string }) {
  if (status === 'paid') return <span className="t-badge-online">{status}</span>;
  if (status === 'sent') return <span className="t-badge-idle">{status}</span>;
  return <span className="t-badge-neutral">{status}</span>;
}
function ProjBadge({ status }: { status: string }) {
  if (status === 'active') return <span className="t-badge-online">{status}</span>;
  return <span className="t-badge-neutral">{status}</span>;
}

export default function ClientDetails() {
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [projOpen, setProjOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);

  const [projectForm, setProjectForm] = useState({ name: '', description: '', techStackRaw: '', githubRepoUrl: '', liveUrl: '', stagingUrl: '', hostingPlatform: '', databasePlatform: '', deploymentPlatform: '' });
  const [projError, setProjError] = useState('');
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', content: '' });
  const [emailError, setEmailError] = useState('');
  const [waForm, setWaForm] = useState({ to: '', content: '' });
  const [waError, setWaError] = useState('');

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

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent-primary)' }} /></div>;
  if (isError || !client) return (
    <div className="text-center py-20">
      <AlertTriangle className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--status-offline)' }} />
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Could not load client details.</p>
      <button onClick={() => navigate('/dashboard/clients')} className="t-btn-ghost text-sm mt-4">Go Back</button>
    </div>
  );

  return (
    <div className="space-y-6 py-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard/clients')} className="flex items-center justify-center w-9 h-9 rounded-md t-btn-ghost" style={{ minHeight: '36px', padding: 0 }} aria-label="Go back"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="t-page-title" style={{ fontSize: '1.5rem' }}>{client.name}</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{client.company || 'Private Client'}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left — profile + quick actions */}
        <div className="space-y-5">
          {/* Profile */}
          <div className="t-card p-5 space-y-3 text-sm">
            <p className="t-label">Client Profile</p>
            <div className="space-y-2.5 pt-1" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              {client.company && <div className="flex items-center gap-2"><Building className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} /><span style={{ color: 'var(--text-primary)' }}>{client.company}</span></div>}
              {client.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} /><a href={`mailto:${client.email}`} className="t-link truncate">{client.email}</a></div>}
              {client.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} /><span style={{ color: 'var(--text-primary)' }}>{client.phone}</span></div>}
              {client.country && <div className="flex items-center gap-2"><Globe className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} /><span style={{ color: 'var(--text-primary)' }}>{client.country}</span></div>}
            </div>
            <div className="space-y-1 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <p className="t-label">Billing Preferences</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Currency: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{client.currency || 'USD'}</span></p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Terms: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{client.paymentTerms || 'Net 30'}</span></p>
            </div>
            {client.notes && (
              <div className="pt-3 space-y-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <p className="t-label">Notes</p>
                <p className="text-xs leading-relaxed whitespace-pre-wrap mt-1" style={{ color: 'var(--text-secondary)' }}>{client.notes}</p>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="t-card p-5 space-y-3">
            <p className="t-label">Quick Actions</p>
            <div className="flex gap-2 pt-1">
              <Dialog open={mailOpen} onOpenChange={setMailOpen}>
                <DialogTrigger asChild>
                  <button className="t-btn-ghost text-xs flex-1 flex items-center justify-center gap-2" onClick={() => setEmailForm(f => ({ ...f, to: client.email || '' }))}>
                    <Send className="h-3.5 w-3.5" />Email
                  </button>
                </DialogTrigger>
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

              <Dialog open={waOpen} onOpenChange={setWaOpen}>
                <DialogTrigger asChild>
                  <button className="t-btn-ghost text-xs flex-1 flex items-center justify-center gap-2" onClick={() => setWaForm(f => ({ ...f, to: client.phone || '' }))}>
                    <MessageSquare className="h-3.5 w-3.5" />WhatsApp
                  </button>
                </DialogTrigger>
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
            </div>
          </div>
        </div>

        {/* Right — projects, invoices, comms */}
        <div className="md:col-span-2 space-y-5">
          {/* Projects */}
          <div className="t-card overflow-hidden">
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Active Projects</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Development instances for this client</p>
              </div>
              <Dialog open={projOpen} onOpenChange={setProjOpen}>
                <DialogTrigger asChild>
                  <button className="t-btn-ghost text-xs flex items-center gap-1.5" style={{ minHeight: '32px', padding: '0 0.75rem', borderRadius: 'var(--radius-sm)' }}><Plus className="h-3.5 w-3.5" />Project</button>
                </DialogTrigger>
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
            </div>
            {client.projects.length > 0 ? (
              <table className="t-table">
                <thead><tr><th>Name</th><th>Status</th><th>Tech Stack</th></tr></thead>
                <tbody>
                  {client.projects.map(p => (
                    <tr key={p.id} className="cursor-pointer" onClick={() => navigate(`/dashboard/projects/${p.id}`)}>
                      <td><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</span></td>
                      <td><ProjBadge status={p.status} /></td>
                      <td><span className="text-xs truncate max-w-[150px] block" style={{ color: 'var(--text-tertiary)' }}>{p.techStack.join(', ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-center py-8 text-xs" style={{ color: 'var(--text-tertiary)' }}>No projects created for this client yet.</p>}
          </div>

          {/* Invoices */}
          <div className="t-card overflow-hidden">
            <div className="p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Invoice History</p>
            </div>
            {client.invoices.length > 0 ? (
              <table className="t-table">
                <thead><tr><th>Invoice No.</th><th>Total</th><th>Issue Date</th><th>Status</th><th className="text-right pr-4">PDF</th></tr></thead>
                <tbody>
                  {client.invoices.map(inv => (
                    <tr key={inv.id}>
                      <td><span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{inv.invoiceNumber}</span></td>
                      <td><span className="font-bold font-mono" style={{ color: 'var(--text-link)' }}>${Number(inv.total).toFixed(2)}</span></td>
                      <td><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(inv.issueDate).toLocaleDateString()}</span></td>
                      <td><InvBadge status={inv.status} /></td>
                      <td className="text-right">
                        {inv.pdfUrl
                          ? <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="flex items-center justify-end gap-1 t-link text-xs no-underline hover:underline"><FileDown className="h-3.5 w-3.5" />PDF</a>
                          : <span className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-center py-8 text-xs" style={{ color: 'var(--text-tertiary)' }}>No invoice records found.</p>}
          </div>

          {/* Communications timeline */}
          <div className="t-card p-5">
            <p className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Communications Feed</p>
            {client.communications.length > 0 ? (
              <div className="relative pl-6 space-y-5" style={{ borderLeft: '2px solid var(--border-subtle)' }}>
                {client.communications.map(comm => (
                  <div key={comm.id} className="relative">
                    <span
                      className="absolute -left-[25px] top-1 h-3 w-3 rounded-full"
                      style={{ background: comm.type === 'email' ? 'var(--accent-primary)' : 'var(--status-online)', border: '2px solid var(--surface-card)' }}
                    />
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold capitalize" style={{ color: 'var(--text-primary)' }}>{comm.type} Message Sent</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{new Date(comm.sentAt).toLocaleString()}</span>
                    </div>
                    {comm.subject && <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Subject: {comm.subject}</p>}
                    <p className="text-xs leading-relaxed whitespace-pre-wrap p-2.5 rounded-md" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      {comm.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : <p className="text-center py-6 text-xs" style={{ color: 'var(--text-tertiary)' }}>No communications recorded yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
