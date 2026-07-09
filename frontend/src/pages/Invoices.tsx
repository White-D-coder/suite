import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import TabBar from '../components/TabBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  FileText, Plus, Trash2, Download, Mail,
  ShieldCheck, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react';

interface Client { id: string; name: string; email?: string; company?: string; }
interface Project { id: string; name: string; clientId: string; }
interface Invoice { id: string; invoiceNumber: string; clientId: string; client: Client; total: number; status: string; issueDate: string; dueDate?: string; pdfUrl?: string; }

const inputCls = 't-input w-full px-3 py-2.5 text-sm';
const rSm = { borderRadius: 'var(--radius-sm)' };
const selectCls: React.CSSProperties = { ...rSm, border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-primary)', width: '100%', height: '42px', padding: '0 0.75rem', fontSize: '0.875rem' };
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><label className="t-label">{label}</label>{children}</div>; }

function InvoiceStatusBadge({ status }: { status: string }) {
  if (status === 'paid') return <span className="t-badge-online">{status}</span>;
  if (status === 'sent') return <span className="t-badge-idle">{status}</span>;
  return <span className="t-badge-neutral">{status}</span>;
}

export default function Invoices() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('history');
  const [templateName, setTemplateName] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [templateSuccess, setTemplateSuccess] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState(0);
  const [lineItems, setLineItems] = useState<{ description: string; quantity: number; unitPrice: number }[]>([{ description: '', quantity: 1, unitPrice: 0 }]);
  const [invoiceError, setInvoiceError] = useState('');
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<'queued' | 'active' | 'completed' | 'failed' | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [emailingInvoiceId, setEmailingInvoiceId] = useState<string | null>(null);

  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({ queryKey: ['invoices-list'], queryFn: () => api.get('/invoices').then(r => r.data) });
  const { data: clients } = useQuery<Client[]>({ queryKey: ['clients-list'], queryFn: () => api.get('/clients').then(r => r.data) });
  const { data: projects } = useQuery<Project[]>({ queryKey: ['projects-list'], queryFn: () => api.get('/projects').then(r => r.data) });

  const clientProjects = projects?.filter(p => p.clientId === selectedClientId) ?? [];

  useEffect(() => {
    if (activeTab === 'generate') setInvoiceNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  }, [activeTab]);

  useEffect(() => {
    let id: any;
    if (pollingJobId && pollingStatus !== 'completed' && pollingStatus !== 'failed') {
      id = setInterval(async () => {
        try {
          const { data } = await api.get(`/invoices/job/${pollingJobId}`);
          setPollingStatus(data.status);
          if (data.status === 'completed') { setGeneratedPdfUrl(data.pdfUrl); qc.invalidateQueries({ queryKey: ['invoices-list'] }); }
        } catch { setPollingStatus('failed'); }
      }, 2000);
    }
    return () => { if (id) clearInterval(id); };
  }, [pollingJobId, pollingStatus, qc]);

  const uploadTemplateMutation = useMutation({
    mutationFn: (p: { name: string; htmlContent: string }) => api.post('/invoices/templates', p),
    onSuccess: () => { setTemplateSuccess('Template registered!'); setTemplateName(''); setTemplateHtml(''); setTemplateError(''); },
    onError: (e: any) => setTemplateError(e.response?.data?.message || 'Failed to submit template.'),
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: (p: any) => api.post('/invoices/generate', p).then(r => r.data),
    onSuccess: (data) => { setPollingJobId(data.jobId); setPollingStatus('queued'); setGeneratedPdfUrl(null); },
    onError: (e: any) => setInvoiceError(e.response?.data?.message || 'Failed to generate invoice.'),
  });

  const emailInvoiceMutation = useMutation({
    mutationFn: (p: { invoiceId: string; clientEmail: string; pdfUrl: string; number: string }) =>
      api.post('/comms/email', { clientId: invoices?.find(i => i.id === p.invoiceId)?.clientId, to: p.clientEmail, subject: `Invoice ${p.number}`, content: `Please find invoice ${p.number} attached.`, attachmentUrl: p.pdfUrl }),
    onSuccess: () => { setEmailingInvoiceId(null); alert('Invoice emailed successfully!'); },
    onError: () => { setEmailingInvoiceId(null); alert('Failed to send email.'); },
  });

  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setInvoiceError('');
    if (!selectedClientId) { setInvoiceError('Please select a client.'); return; }
    generateInvoiceMutation.mutate({ clientId: selectedClientId, projectId: selectedProjectId || undefined, invoiceNumber, issueDate, dueDate: dueDate || undefined, currency, taxRate: Number(taxRate), lineItems: lineItems.map(i => ({ description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })) });
  };

  const handleSendEmail = (inv: Invoice) => {
    if (!inv.pdfUrl) { alert('PDF not generated yet.'); return; }
    if (!inv.client.email) { alert('Client email missing.'); return; }
    setEmailingInvoiceId(inv.id);
    emailInvoiceMutation.mutate({ invoiceId: inv.id, clientEmail: inv.client.email!, pdfUrl: inv.pdfUrl, number: inv.invoiceNumber });
  };

  return (
    <div className="space-y-8 py-6">
      <div>
        <h1 className="t-page-title">Invoice Generator</h1>
        <p className="t-page-subtitle">Template-driven PDF invoices via BullMQ background queues.</p>
      </div>

      <TabBar
        tabs={[
          { id: 'history', label: 'Billing History', icon: FileText },
          { id: 'generate', label: 'Create Invoice', icon: Plus },
          { id: 'templates', label: 'HTML Templates', icon: ShieldCheck },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ── History ── */}
      {activeTab === 'history' && (
        <div className="mt-0">
          {invoicesLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent-primary)' }} /></div>
          ) : invoices && invoices.length > 0 ? (
            <div className="t-card overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="t-table">
                  <thead><tr><th>Invoice No.</th><th>Client</th><th>Total</th><th>Issue Date</th><th>Status</th><th className="text-right pr-4">Actions</th></tr></thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id}>
                        <td><span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{inv.invoiceNumber}</span></td>
                        <td>
                          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{inv.client.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{inv.client.company || 'Private'}</p>
                        </td>
                        <td><span className="font-bold font-mono" style={{ color: 'var(--text-link)' }}>${Number(inv.total).toFixed(2)}</span></td>
                        <td><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(inv.issueDate).toLocaleDateString()}</span></td>
                        <td><InvoiceStatusBadge status={inv.status} /></td>
                        <td>
                          <div className="flex gap-2 justify-end">
                            {inv.pdfUrl && (
                              <>
                                <a href={inv.pdfUrl} target="_blank" rel="noreferrer"
                                  className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--surface-sunken)] transition-colors"
                                  style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                                  title="Download PDF">
                                  <Download className="h-4 w-4" />
                                </a>
                                <button
                                  onClick={() => handleSendEmail(inv)}
                                  disabled={emailingInvoiceId === inv.id}
                                  className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--surface-sunken)] transition-colors"
                                  style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                                  title="Email to client">
                                  {emailingInvoiceId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {invoices.map(inv => (
                  <div key={inv.id} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div><p className="font-bold font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{inv.invoiceNumber}</p><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{inv.client.name}</p></div>
                      <InvoiceStatusBadge status={inv.status} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold font-mono" style={{ color: 'var(--text-link)' }}>${Number(inv.total).toFixed(2)}</span>
                      {inv.pdfUrl && <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="t-link text-xs flex items-center gap-1"><Download className="h-3 w-3" />PDF</a>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="t-empty"><FileText className="h-10 w-10" style={{ color: 'var(--border-default)' }} /><span className="text-sm font-semibold">No invoices issued yet</span></div>
          )}
        </div>
      )}

      {/* ── Generate ── */}
      {activeTab === 'generate' && (
        <div className="t-card p-6 space-y-6">
          <p className="t-label">New Invoicing Wizard</p>
          {invoiceError && (
            <div className="flex items-center gap-2 text-xs p-2.5 rounded-md"
              style={{ background: 'rgba(232,160,144,0.12)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', ...rSm }}>
              <AlertTriangle className="h-4 w-4 shrink-0" />{invoiceError}
            </div>
          )}
          <form onSubmit={handleGenerateSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Recipient Client *">
                <select style={selectCls} value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} required>
                  <option value="">Select a Client</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                </select>
              </Field>
              <Field label="Associated Project">
                <select style={selectCls} value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} disabled={!selectedClientId}>
                  <option value="">No Project (General)</option>
                  {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Invoice Number *"><input className={inputCls} style={rSm} value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required /></Field>
              <Field label="Issue Date *"><input type="date" className={inputCls} style={rSm} value={issueDate} onChange={e => setIssueDate(e.target.value)} required /></Field>
              <Field label="Due Date"><input type="date" className={inputCls} style={rSm} value={dueDate} onChange={e => setDueDate(e.target.value)} /></Field>
              <Field label="Tax Rate (%)"><input type="number" min="0" className={inputCls} style={rSm} value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} /></Field>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <p className="t-label">Line Items</p>
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-center p-3 rounded-md" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <div className="flex-1">
                    <input className={inputCls} style={rSm} placeholder="Description / Scope of Work" value={item.description} onChange={e => { const c = [...lineItems]; c[idx] = { ...c[idx], description: e.target.value }; setLineItems(c); }} required />
                  </div>
                  <div className="w-20">
                    <input type="number" min="1" className={`${inputCls} text-center`} style={rSm} placeholder="Qty" value={item.quantity} onChange={e => { const c = [...lineItems]; c[idx] = { ...c[idx], quantity: Number(e.target.value) }; setLineItems(c); }} required />
                  </div>
                  <div className="w-28">
                    <input type="number" min="0" className={`${inputCls} font-mono`} style={rSm} placeholder="Rate" value={item.unitPrice} onChange={e => { const c = [...lineItems]; c[idx] = { ...c[idx], unitPrice: Number(e.target.value) }; setLineItems(c); }} required />
                  </div>
                  {lineItems.length > 1 && (
                    <button type="button" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))} className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--surface-muted)] transition-colors" style={{ color: 'var(--status-offline)' }} aria-label="Remove item">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0 }])} className="t-btn-ghost text-xs flex items-center gap-1.5" style={{ minHeight: '32px', padding: '0 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <Plus className="h-3.5 w-3.5" />Add Item
              </button>
            </div>

            {/* Summary */}
            <div className="flex justify-between items-end pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div className="space-y-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <p>Subtotal: <span className="font-mono">${subtotal.toFixed(2)}</span></p>
                <p>Tax ({taxRate}%): <span className="font-mono">${taxAmount.toFixed(2)}</span></p>
              </div>
              <div className="text-right">
                <p className="t-label">Total Due</p>
                <p className="text-2xl font-extrabold font-mono" style={{ color: 'var(--text-link)' }}>${total.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button type="submit" disabled={generateInvoiceMutation.isPending} className="t-btn-primary text-sm px-8">
                {generateInvoiceMutation.isPending ? 'Queuing render…' : 'Generate Invoice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Templates ── */}
      {activeTab === 'templates' && (
        <div className="t-card p-6 space-y-6">
          <p className="t-label">Template Configuration</p>
          {templateError && <div className="flex items-center gap-2 text-xs p-2.5 rounded-md" style={{ background: 'rgba(232,160,144,0.12)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', ...rSm }}><AlertTriangle className="h-4 w-4 shrink-0" />{templateError}</div>}
          {templateSuccess && <div className="flex items-center gap-2 text-xs p-2.5 rounded-md" style={{ background: 'var(--surface-info)', border: '1px solid var(--border-strong)', color: 'var(--accent-secondary-fg)', ...rSm }}><ShieldCheck className="h-4 w-4 shrink-0" />{templateSuccess}</div>}
          <form onSubmit={e => { e.preventDefault(); setTemplateError(''); setTemplateSuccess(''); if (!templateName || !templateHtml) { setTemplateError('All fields required.'); return; } uploadTemplateMutation.mutate({ name: templateName, htmlContent: templateHtml }); }} className="space-y-4">
            <Field label="Template Layout Name">
              <input className={inputCls} style={rSm} placeholder="Professional Minimalist" value={templateName} onChange={e => setTemplateName(e.target.value)} required />
            </Field>
            <Field label="HTML Content">
              <textarea className="t-input w-full h-48 px-3 py-2.5 text-sm font-mono resize-none" style={rSm} placeholder={`<div><h1>Invoice {{invoiceNumber}}</h1></div>`} value={templateHtml} onChange={e => setTemplateHtml(e.target.value)} required />
            </Field>
            <div className="flex justify-end">
              <button type="submit" disabled={uploadTemplateMutation.isPending} className="t-btn-primary text-sm">
                {uploadTemplateMutation.isPending ? 'Saving…' : 'Upload Template'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── PDF Polling Modal ── */}
      <Dialog open={!!pollingJobId} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm text-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)' }}>
          <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Invoicing Task Queue</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center py-6 gap-4">
            {pollingStatus === 'completed' ? (
              <>
                <CheckCircle2 className="h-12 w-12" style={{ color: 'var(--status-online)' }} />
                <div><p className="font-bold" style={{ color: 'var(--text-primary)' }}>PDF Render Successful!</p><p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Invoice stored and ready.</p></div>
                {generatedPdfUrl && (
                  <a href={generatedPdfUrl} target="_blank" rel="noreferrer" className="w-full" onClick={() => { setPollingJobId(null); setPollingStatus(null); setGeneratedPdfUrl(null); }}>
                    <button className="t-btn-primary w-full flex items-center justify-center gap-2 text-sm"><Download className="h-4 w-4" />Download PDF</button>
                  </a>
                )}
              </>
            ) : pollingStatus === 'failed' ? (
              <>
                <AlertTriangle className="h-12 w-12" style={{ color: 'var(--status-offline)' }} />
                <div><p className="font-bold" style={{ color: 'var(--text-primary)' }}>Render Failed</p><p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Processor encountered an issue.</p></div>
                <button onClick={() => setPollingJobId(null)} className="t-btn-ghost w-full text-sm">Close</button>
              </>
            ) : (
              <>
                <Loader2 className="h-12 w-12 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                <div><p className="font-bold" style={{ color: 'var(--text-primary)' }}>Generating Invoice PDF</p><p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Job state: <span className="font-semibold capitalize" style={{ color: 'var(--text-link)' }}>{pollingStatus}</span></p></div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
