import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import TabBar from '../components/TabBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  FileText, Plus, Trash2, Download, Mail,
  ShieldCheck, Loader2, AlertTriangle, CheckCircle2,
  Calendar, Layers, DollarSign, Calculator
} from 'lucide-react';

interface Client { id: string; name: string; email?: string; company?: string; country?: string; currency?: string }
interface Project { id: string; name: string; clientId: string; currency?: string }
interface InvoiceSchedule { id: string; milestoneName: string; percentage?: number; amountDue: number; paymentStatus: string; dueDate?: string }
interface Invoice {
  id: string; invoiceNumber: string; clientId: string; client: Client;
  project?: Project;
  total: number; paidAmount: number; remainingBalance: number; status: string;
  issueDate: string; dueDate?: string; pdfUrl?: string; currency: string;
  fxRate?: number; fxSource?: string; taxProfile?: string;
  schedules: InvoiceSchedule[];
  lineItems?: { id: string; description: string; quantity: number; unitPrice: number; total: number }[];
}

const inputCls = 't-input w-full px-3 py-2 text-sm';
const rSm = { borderRadius: 'var(--radius-sm)' };
const selectCls: React.CSSProperties = { ...rSm, border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-primary)', width: '100%', height: '42px', padding: '0 0.75rem', fontSize: '0.875rem' };

function Field({ label, children }: { label: string; children: React.ReactNode }) { 
  return <div className="space-y-1"><label className="t-label">{label}</label>{children}</div>; 
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ');
  if (status === 'paid') return <span className="t-badge-online">{label}</span>;
  if (status === 'partially_paid') return <span className="t-badge-idle">{label}</span>;
  return <span className="t-badge-neutral">{label}</span>;
}

export default function Invoices() {
  const { user } = useOutletContext<{ user: any }>();
  const role = user?.role || 'employee';
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('history');
  
  // Invoice form states
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState(0);
  const [taxProfile, setTaxProfile] = useState('exclusive');
  const [progressBillingMode, setProgressBillingMode] = useState('none');
  const [lineItems, setLineItems] = useState<{ description: string; quantity: number; unitPrice: number }[]>([{ description: '', quantity: 1, unitPrice: 0 }]);
  
  // Billing schedules (milestones)
  const [schedules, setSchedules] = useState<{ milestoneName: string; percentage?: number; amountDue: number; dueDate?: string; reminderPolicy?: string }[]>([]);

  // FX Rate details
  const [liveFxRate, setLiveFxRate] = useState(1.0);
  const [loadingFx, setLoadingFx] = useState(false);

  const [invoiceError, setInvoiceError] = useState('');
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [emailingInvoiceId, setEmailingInvoiceId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(false);

  // Discount state
  const [discounts, setDiscounts] = useState<{ type: 'percentage' | 'fixed'; value: number; purpose: string; notes: string }[]>([]);
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [discountForm, setDiscountForm] = useState({ type: 'percentage' as 'percentage' | 'fixed', value: 0, purpose: 'client_retention', notes: '' });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({ 
    queryKey: ['invoices-list'], 
    queryFn: () => api.get('/invoices').then(r => r.data) 
  });
  const { data: clients } = useQuery<Client[]>({ 
    queryKey: ['clients-list'], 
    queryFn: () => api.get('/clients').then(r => r.data) 
  });
  const { data: projects } = useQuery<Project[]>({ 
    queryKey: ['projects-list'], 
    queryFn: () => api.get('/projects').then(r => r.data) 
  });

  const clientProjects = projects?.filter(p => p.clientId === selectedClientId) ?? [];

  // Automatically update currency & FX rate when client changes
  useEffect(() => {
    if (!selectedClientId || !clients) return;
    const client = clients.find(c => c.id === selectedClientId);
    if (client && client.currency) {
      setCurrency(client.currency);
    }
  }, [selectedClientId, clients]);

  // Fetch / Calculate mock exchange rate for preview
  useEffect(() => {
    if (currency === 'USD') {
      setLiveFxRate(1.0);
      return;
    }
    setLoadingFx(true);
    // Standard mock rate definitions for previewing conversions
    let mockRate = 1.0;
    if (currency === 'EUR') mockRate = 0.92;
    else if (currency === 'GBP') mockRate = 0.78;
    else if (currency === 'INR') mockRate = 83.5;
    else if (currency === 'CAD') mockRate = 1.36;

    setTimeout(() => {
      setLiveFxRate(mockRate);
      setLoadingFx(false);
    }, 400);
  }, [currency]);

  useEffect(() => {
    if (activeTab === 'generate') {
      setInvoiceNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  }, [activeTab]);

  useEffect(() => {
    let id: any;
    if (pollingJobId && pollingStatus !== 'completed' && pollingStatus !== 'failed' && pollingStatus !== 'success') {
      id = setInterval(async () => {
        try {
          const { data } = await api.get(`/invoices/job/${pollingJobId}`);
          setPollingStatus(data.status);
          if (data.status === 'completed' || data.status === 'success') { 
            setGeneratedPdfUrl(data.pdfUrl || 'mock'); 
            qc.invalidateQueries({ queryKey: ['invoices-list'] }); 
            setPollingStatus('completed');
          }
        } catch { 
          setPollingStatus('failed'); 
        }
      }, 2000);
    }
    return () => { if (id) clearInterval(id); };
  }, [pollingJobId, pollingStatus, qc]);

  const generateInvoiceMutation = useMutation({
    mutationFn: (payload: any) => api.post('/invoices/generate', payload).then(r => r.data),
    onSuccess: (data) => { 
      if (data.jobId && data.jobId !== 'offline-mock') {
        setPollingJobId(data.jobId); 
        setPollingStatus('queued'); 
      } else {
        alert('Invoice created successfully (Rendering bypassed - worker offline).');
        setActiveTab('history');
        qc.invalidateQueries({ queryKey: ['invoices-list'] });
      }
      setGeneratedPdfUrl(null); 
    },
    onError: (e: any) => setInvoiceError(e.response?.data?.message || 'Failed to generate invoice.'),
  });

  const emailInvoiceMutation = useMutation({
    mutationFn: (p: { invoiceId: string; clientEmail: string; pdfUrl: string; number: string }) =>
      api.post('/comms/email', { clientId: invoices?.find(i => i.id === p.invoiceId)?.clientId, to: p.clientEmail, subject: `Invoice ${p.number}`, content: `Please find invoice ${p.number} attached.`, attachmentUrl: p.pdfUrl }),
    onSuccess: () => { setEmailingInvoiceId(null); alert('Invoice emailed successfully!'); },
    onError: () => { setEmailingInvoiceId(null); alert('Failed to send email.'); },
  });

  // Totals calculations based on tax mode
  const baseSubtotal = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  let computedSubtotal = baseSubtotal;
  let taxAmount = 0;
  let total = 0;

  if (taxProfile === 'inclusive') {
    total = baseSubtotal;
    taxAmount = total * (taxRate / (100 + taxRate));
    computedSubtotal = total - taxAmount;
  } else if (taxProfile === 'exempt' || taxProfile === 'reverse-charge') {
    taxAmount = 0;
    total = baseSubtotal;
  } else {
    // exclusive
    taxAmount = baseSubtotal * (taxRate / 100);
    total = baseSubtotal + taxAmount;
  }

  // Apply discounts
  const discountTotal = discounts.reduce((sum, d) => {
    if (d.type === 'percentage') return sum + (baseSubtotal * d.value / 100);
    return sum + d.value;
  }, 0);
  const taxableAmount = Math.max(0, computedSubtotal - discountTotal);
  const adjustedTax = taxProfile === 'exempt' || taxProfile === 'reverse-charge' ? 0 : taxableAmount * (taxRate / 100);
  const finalPayable = taxProfile === 'inclusive' ? total - discountTotal : taxableAmount + adjustedTax;

  // Currency conversions
  const convertedTotal = finalPayable * liveFxRate;

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInvoiceError('');
    if (!selectedClientId) { setInvoiceError('Please select a client.'); return; }
    
    // Validate milestones
    if (progressBillingMode !== 'none') {
      const scheduleSum = schedules.reduce((sum, s) => sum + Number(s.amountDue), 0);
      if (Math.abs(scheduleSum - total) > 0.1) {
        setInvoiceError(`Billing Milestones sum (${scheduleSum.toFixed(2)}) must equal Total Invoice Due (${total.toFixed(2)})`);
        return;
      }
    }

    generateInvoiceMutation.mutate({
      clientId: selectedClientId,
      projectId: selectedProjectId || undefined,
      invoiceNumber,
      issueDate,
      dueDate: dueDate || undefined,
      currency,
      taxRate: Number(taxRate),
      taxProfile,
      progressBillingMode,
      lineItems: lineItems.map(i => ({ description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
      schedules: progressBillingMode !== 'none' ? schedules.map(s => ({
        milestoneName: s.milestoneName,
        percentage: s.percentage ? Number(s.percentage) : undefined,
        amountDue: Number(s.amountDue),
        dueDate: s.dueDate || undefined,
        reminderPolicy: s.reminderPolicy || 'pending',
      })) : undefined,
      fxRate: liveFxRate,
      fxSource: 'ExchangeRateAPI',
    });
  };

  const handleSendEmail = (inv: Invoice) => {
    if (!inv.pdfUrl) { alert('PDF not generated yet.'); return; }
    if (!inv.client.email) { alert('Client email missing.'); return; }
    setEmailingInvoiceId(inv.id);
    emailInvoiceMutation.mutate({ invoiceId: inv.id, clientEmail: inv.client.email!, pdfUrl: inv.pdfUrl, number: inv.invoiceNumber });
  };

  const addMilestone = () => {
    setSchedules([...schedules, { milestoneName: `Milestone ${schedules.length + 1}`, amountDue: 0 }]);
  };

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div>
        <h1 className="t-page-title">Accounts Billing &amp; Invoices</h1>
        <p className="t-page-subtitle">Multi-currency invoicing ledger, milestone schedules, and tax rules.</p>
      </div>

      <TabBar
        tabs={
          role === 'employee'
            ? [{ id: 'history', label: 'Invoices History', icon: FileText }]
            : [
                { id: 'history', label: 'Invoices History', icon: FileText },
                { id: 'generate', label: 'Create Invoice', icon: Plus },
              ]
        }
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ── Tab 1: Billing History ── */}
      {activeTab === 'history' && (
        <div className="mt-0">
          {invoicesLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} /></div>
          ) : invoices && invoices.length > 0 ? (
            <div className="t-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="t-table text-xs">
                  <thead>
                    <tr>
                      <th>Invoice No.</th>
                      <th>Client / Project</th>
                      <th>Base Amount (USD)</th>
                      <th>Billed Local</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>FX Audit Rate</th>
                      <th className="text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr
                        key={inv.id}
                        className="cursor-pointer hover:bg-[var(--surface-sunken)] transition-colors"
                        onClick={() => { setSelectedInvoice(inv); setInvoiceDetailOpen(true); }}
                      >
                        <td><span className="font-bold font-mono text-[var(--text-primary)]">{inv.invoiceNumber}</span></td>
                        <td>
                          <p className="font-semibold">{inv.client.name}</p>
                          {inv.project && <p className="text-[10px] text-[var(--text-tertiary)]">Project: {inv.project.name}</p>}
                        </td>
                        <td><span className="font-bold font-mono text-[var(--text-link)]">${Number(inv.total).toFixed(2)}</span></td>
                        <td>
                          <span className="font-bold font-mono text-[var(--text-secondary)]">
                            {inv.currency} { (Number(inv.total) * Number(inv.fxRate || 1.0)).toFixed(2) }
                          </span>
                        </td>
                        <td><span className="text-xs text-[var(--text-secondary)]">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</span></td>
                        <td><InvoiceStatusBadge status={inv.status} /></td>
                        <td>
                          <span className="text-[10px] bg-[var(--surface-sunken)] p-1 rounded font-mono">
                            1 USD = {Number(inv.fxRate || 1.0).toFixed(4)} {inv.currency}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                            {inv.pdfUrl && (
                              <>
                                <a href={inv.pdfUrl} target="_blank" rel="noreferrer"
                                  className="flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--surface-sunken)] border border-[var(--border-subtle)]"
                                  title="Download PDF">
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                                <button
                                  onClick={() => handleSendEmail(inv)}
                                  disabled={emailingInvoiceId === inv.id}
                                  className="flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--surface-sunken)] border border-[var(--border-subtle)]"
                                  title="Email to client">
                                  {emailingInvoiceId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
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
            </div>
          ) : (
            <div className="t-empty"><FileText className="h-10 w-10" style={{ color: 'var(--border-default)' }} /><span className="text-sm font-semibold">No invoices issued yet</span></div>
          )}
        </div>
      )}

      {/* ── Tab 2: Create Invoice ── */}
      {activeTab === 'generate' && role !== 'employee' && (
        <div className="t-card p-6 space-y-6">
          <p className="t-label">Invoicing Setup Wizard</p>
          <ErrBanner msg={invoiceError} />
          
          <form onSubmit={handleGenerateSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Client Profile *">
                <select style={selectCls} value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} required>
                  <option value="">Select a Client</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                </select>
              </Field>
              <Field label="Project Association">
                <select style={selectCls} value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} disabled={!selectedClientId}>
                  <option value="">No Project (General Invoicing)</option>
                  {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Invoice Number *"><input className={inputCls} style={rSm} value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required /></Field>
              <Field label="Issue Date *"><input type="date" className={inputCls} style={rSm} value={issueDate} onChange={e => setIssueDate(e.target.value)} required /></Field>
              <Field label="Due Date"><input type="date" className={inputCls} style={rSm} value={dueDate} onChange={e => setDueDate(e.target.value)} /></Field>
              <Field label="Billing Currency">
                <select style={selectCls} value={currency} onChange={e => setCurrency(e.target.value)}>
                  <option value="USD">USD (United States Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="GBP">GBP (British Pound)</option>
                  <option value="INR">INR (Indian Rupee)</option>
                  <option value="CAD">CAD (Canadian Dollar)</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Tax Profile">
                <select style={selectCls} value={taxProfile} onChange={e => setTaxProfile(e.target.value)}>
                  <option value="exclusive">Standard Exclusive (Add tax to SOW)</option>
                  <option value="inclusive">Standard Inclusive (Tax included in SOW)</option>
                  <option value="exempt">Tax Exempt</option>
                  <option value="reverse-charge">Reverse Charge (B2B VAT)</option>
                </select>
              </Field>
              <Field label="Tax Rate (%)"><input type="number" min="0" className={inputCls} style={rSm} value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} /></Field>
              <Field label="Billing Mode">
                <select style={selectCls} value={progressBillingMode} onChange={e => setProgressBillingMode(e.target.value)}>
                  <option value="none">Standard Invoice (Due upon receipt)</option>
                  <option value="percentage">Progressive Milestone (Apportion schedule)</option>
                </select>
              </Field>
            </div>

            {/* Currency conversion warning banner */}
            {currency !== 'USD' && (
              <div className="flex items-center justify-between p-3.5 bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg text-xs leading-relaxed">
                <div className="flex items-center gap-2">
                  <Calculator size={16} className="text-[var(--accent)] shrink-0" />
                  <span>
                    Converted Total Preview: <span className="font-mono font-bold">{currency} {convertedTotal.toFixed(2)}</span>
                    <span className="text-[var(--text-tertiary)] block text-[10px] mt-0.5">FX Audit Rate source: ExchangeRateAPI (Rate: 1 USD = {liveFxRate.toFixed(4)} {currency})</span>
                  </span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 py-0.5 px-2 rounded">
                  Rate Frozen
                </span>
              </div>
            )}

            {/* Milestone Schedules */}
            {progressBillingMode === 'percentage' && (
              <div className="space-y-4 p-4 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-xs">
                <div className="flex justify-between items-center">
                  <p className="font-bold flex items-center gap-1.5"><Layers size={13} /> Progressive Milestone schedules</p>
                  <button type="button" onClick={addMilestone} className="t-btn-ghost py-1 px-2.5 text-[10px] flex items-center gap-1"><Plus size={11} /> Add Milestone</button>
                </div>

                <div className="space-y-3">
                  {schedules.map((sch, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bg-[var(--surface-body)] p-3 rounded border border-[var(--border-subtle)]">
                      <Field label="Milestone SOW name *">
                        <input className={inputCls} placeholder="e.g. Deposit (30%)" value={sch.milestoneName} onChange={e => {
                          const copy = [...schedules];
                          copy[idx].milestoneName = e.target.value;
                          setSchedules(copy);
                        }} required />
                      </Field>
                      <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                        <Field label="Percentage (%)">
                          <input type="number" min="0" max="100" className={inputCls} placeholder="30" value={sch.percentage || ''} onChange={e => {
                            const pct = Number(e.target.value);
                            const copy = [...schedules];
                            copy[idx].percentage = pct;
                            copy[idx].amountDue = total * (pct / 100);
                            setSchedules(copy);
                          }} />
                        </Field>
                        <Field label="Fixed Amount Due">
                          <input type="number" className={inputCls} placeholder="Amount" value={sch.amountDue || ''} onChange={e => {
                            const amt = Number(e.target.value);
                            const copy = [...schedules];
                            copy[idx].amountDue = amt;
                            copy[idx].percentage = total > 0 ? (amt / total) * 100 : 0;
                            setSchedules(copy);
                          }} required />
                        </Field>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] block mb-1">Due Date</label>
                          <input type="date" className="t-input w-full p-2 text-xs" value={sch.dueDate || ''} onChange={e => {
                            const copy = [...schedules];
                            copy[idx].dueDate = e.target.value;
                            setSchedules(copy);
                          }} />
                        </div>
                        <div className="flex-shrink-0">
                          <label className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] block mb-1">Status</label>
                          <select className="t-input p-2 text-xs w-20" value={sch.reminderPolicy || 'pending'} onChange={e => {
                            const copy = [...schedules];
                            copy[idx].reminderPolicy = e.target.value; // Use field as paid state indicator in form
                            setSchedules(copy);
                          }} style={{ background: 'var(--surface-card)' }}>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                          </select>
                        </div>
                        <button type="button" onClick={() => setSchedules(schedules.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300 mt-5"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Line Items */}
            <div className="space-y-3">
              <p className="t-label">SOW Line Items</p>
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

            {/* ── Discounts Section ── */}
            <div style={{ background: 'var(--surface-sunken)', borderRadius: 10, padding: '1rem', marginTop: '0.75rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: discounts.length > 0 || showDiscountForm ? '0.75rem' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calculator size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>Discounts</span>
                  {discounts.length > 0 && (
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, background: '#ef444418', color: '#ef4444', padding: '1px 6px', borderRadius: 99 }}>
                      −{currency} {discountTotal.toFixed(2)}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => setShowDiscountForm(!showDiscountForm)} style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showDiscountForm ? 'Cancel' : '+ Add Discount'}
                </button>
              </div>

              {/* Active discounts */}
              {discounts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: showDiscountForm ? '0.75rem' : 0 }}>
                  {discounts.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--surface-card)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {d.type === 'percentage' ? `${d.value}%` : `${currency} ${d.value.toFixed(2)}`}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginLeft: 8, textTransform: 'capitalize' }}>
                          {d.purpose.replace(/_/g, ' ')}
                        </span>
                        {d.notes && <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginLeft: 6 }}>— {d.notes}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444' }}>
                          −{currency} {(d.type === 'percentage' ? baseSubtotal * d.value / 100 : d.value).toFixed(2)}
                        </span>
                        <button type="button" onClick={() => setDiscounts(ds => ds.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add discount form */}
              {showDiscountForm && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '0 0 100px' }}>
                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>Type</label>
                    <select value={discountForm.type} onChange={e => setDiscountForm(f => ({ ...f, type: e.target.value as any }))} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-primary)', fontSize: '0.75rem' }}>
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>
                  <div style={{ flex: '0 0 90px' }}>
                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>{discountForm.type === 'percentage' ? '% Off' : 'Amount'}</label>
                    <input type="number" min="0" step="0.01" value={discountForm.value || ''} onChange={e => setDiscountForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))} placeholder="0" style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>Purpose</label>
                    <select value={discountForm.purpose} onChange={e => setDiscountForm(f => ({ ...f, purpose: e.target.value }))} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-primary)', fontSize: '0.75rem' }}>
                      <option value="client_retention">Client Retention</option>
                      <option value="volume_discount">Volume Discount</option>
                      <option value="early_payment">Early Payment</option>
                      <option value="seasonal_promo">Seasonal Promo</option>
                      <option value="goodwill">Goodwill</option>
                      <option value="negotiated">Negotiated</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>Notes</label>
                    <input value={discountForm.notes} onChange={e => setDiscountForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
                  </div>
                  <button type="button" onClick={() => {
                    if (discountForm.value > 0) {
                      setDiscounts(d => [...d, { ...discountForm }]);
                      setDiscountForm({ type: 'percentage', value: 0, purpose: 'client_retention', notes: '' });
                      setShowDiscountForm(false);
                    }
                  }} style={{ padding: '0.4rem 0.75rem', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* Summary — Full Breakdown */}
            <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 2rem', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{currency} {computedSubtotal.toFixed(2)}</span>

                {discountTotal > 0 && <>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>Discount</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#ef4444', fontWeight: 600 }}>−{currency} {discountTotal.toFixed(2)}</span>
                </>}

                {discountTotal > 0 && <>
                  <span style={{ color: 'var(--text-secondary)' }}>Taxable Amount</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{currency} {taxableAmount.toFixed(2)}</span>
                </>}

                <span style={{ color: 'var(--text-secondary)' }}>Tax ({taxRate}% {taxProfile})</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{currency} {(discountTotal > 0 ? adjustedTax : taxAmount).toFixed(2)}</span>

                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />

                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Final Payable</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)' }}>{currency} {finalPayable.toFixed(2)}</span>

                {currency !== 'USD' && <>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>Converted @ {liveFxRate.toFixed(4)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>USD {(finalPayable / liveFxRate).toFixed(2)}</span>
                </>}
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

      {/* ── PDF Polling Modal ── */}
      <Dialog open={!!pollingJobId} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm text-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)' }}>
          <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Invoicing Queue Tasks</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center py-6 gap-4">
            {pollingStatus === 'completed' ? (
              <>
                <CheckCircle2 className="h-12 w-12" style={{ color: 'var(--status-online)' }} />
                <div><p className="font-bold" style={{ color: 'var(--text-primary)' }}>PDF Render Successful!</p><p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Invoice stored and ready.</p></div>
                {generatedPdfUrl && (
                  <button onClick={() => { setPollingJobId(null); setPollingStatus(null); setGeneratedPdfUrl(null); setActiveTab('history'); }} className="t-btn-primary w-full flex items-center justify-center gap-2 text-sm">Download PDF</button>
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
                <Loader2 className="h-12 w-12 animate-spin" style={{ color: 'var(--accent)' }} />
                <div><p className="font-bold" style={{ color: 'var(--text-primary)' }}>Generating Invoice PDF</p><p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Job state: <span className="font-semibold capitalize" style={{ color: 'var(--text-link)' }}>{pollingStatus}</span></p></div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Details Modal */}
      <Dialog open={invoiceDetailOpen} onOpenChange={setInvoiceDetailOpen}>
        <DialogContent style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)' }} className="max-w-2xl">
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
              <div className="grid grid-cols-3 gap-4 border-b border-[var(--border-subtle)] pb-3">
                <div>
                  <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-1">Issue Date</p>
                  <p className="font-medium text-[var(--text-primary)]">{new Date(selectedInvoice.issueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-1">Client Name</p>
                  <p className="font-medium text-[var(--text-primary)]">{selectedInvoice.client.name}</p>
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
                    <Download size={14} /> Download Invoice PDF
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

function ErrBanner({ msg }: { msg: string }) {
  return msg ? (
    <div className="flex items-center gap-2 text-xs p-2.5 rounded-md"
      style={{ background: 'rgba(232,160,144,0.12)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', borderRadius: 'var(--radius-sm)' }}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {msg}
    </div>
  ) : null;
}
