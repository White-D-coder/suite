import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import TabBar from '../components/TabBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import {
  AlertTriangle, Plus, DollarSign, CreditCard, Calendar, Loader2,
  Bell, ShieldAlert, Send, Clock, Sparkles
} from 'lucide-react';

interface Client { id: string; name: string; }
interface Income { id: string; client: Client; amount: number; currency: string; exchangeRate: number; paymentDate: string; paymentMethod?: string; status: string; }
interface Expense { id: string; description: string; amount: number; currency: string; category: string; paymentDate: string; paymentMethod?: string; }
interface Subscription { id: string; provider: string; serviceName: string; cost: number; billingCycle: string; renewalDate: string; paymentMethod?: string; reminderDays: number; }

const inputCls = 't-input w-full px-3 py-2.5 text-sm';
const rSm = { borderRadius: 'var(--radius-sm)' };
const selectCls: React.CSSProperties = { ...rSm, border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-primary)', width: '100%', height: '42px', padding: '0 0.75rem', fontSize: '0.875rem' };
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><label className="t-label">{label}</label>{children}</div>; }
function ErrBanner({ msg }: { msg: string }) { return msg ? <div className="flex items-center gap-2 text-xs p-2.5 rounded-md mb-2" style={{ background: 'rgba(232,160,144,0.12)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', ...rSm }}><AlertTriangle className="h-4 w-4 shrink-0" />{msg}</div> : null; }

const today = () => new Date().toISOString().split('T')[0];

export default function Finance() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('income');
  const [isIncomeOpen, setIsIncomeOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isSubOpen, setIsSubOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const [incomeForm, setIncomeForm] = useState({ clientId: '', amount: 0, currency: 'USD', paymentDate: today(), status: 'one-time', paymentMethod: 'Bank Transfer' });
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: 0, currency: 'USD', category: 'SaaS', paymentDate: today(), paymentMethod: 'Credit Card' });
  const [subForm, setSubForm] = useState({ provider: '', serviceName: '', cost: 0, billingCycle: 'monthly', renewalDate: today(), paymentMethod: 'Credit Card', reminderDays: 7 });

  const { data: clients } = useQuery<Client[]>({ queryKey: ['clients-list'], queryFn: () => api.get('/clients').then(r => r.data) });
  const { data: incomeList, isLoading: incomeLoading } = useQuery<Income[]>({ queryKey: ['income-list'], queryFn: () => api.get('/finance/income').then(r => r.data) });
  const { data: expenseList, isLoading: expenseLoading } = useQuery<Expense[]>({ queryKey: ['expenses-list'], queryFn: () => api.get('/finance/expenses').then(r => r.data) });
  const { data: subList, isLoading: subsLoading } = useQuery<Subscription[]>({ queryKey: ['subscriptions-list'], queryFn: () => api.get('/finance/subscriptions').then(r => r.data) });

  const addIncomeMutation = useMutation({ mutationFn: (p: any) => api.post('/finance/income', p), onSuccess: () => { qc.invalidateQueries({ queryKey: ['income-list'] }); setIsIncomeOpen(false); setErrorMsg(''); }, onError: (e: any) => setErrorMsg(e.response?.data?.message || 'Failed.') });
  const addExpenseMutation = useMutation({ mutationFn: (p: any) => api.post('/finance/expenses', p), onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses-list'] }); setIsExpenseOpen(false); setErrorMsg(''); }, onError: (e: any) => setErrorMsg(e.response?.data?.message || 'Failed.') });
  const addSubMutation = useMutation({ mutationFn: (p: any) => api.post('/finance/subscriptions', p), onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriptions-list'] }); setIsSubOpen(false); setErrorMsg(''); }, onError: (e: any) => setErrorMsg(e.response?.data?.message || 'Failed.') });

  // Trigger manual reminder
  const sendReminder = async (subId: string) => {
    setRemindingId(subId);
    try {
      await api.post(`/finance/subscriptions/${subId}/remind`);
      alert('Notification sent via WhatsApp and Email successfully!');
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to dispatch manual reminders.');
    } finally {
      setRemindingId(null);
    }
  };

  const dialogStyle = { background: 'var(--surface-card)', border: '1px solid var(--border-default)' };

  // Calculate monthly burn rate
  const monthlyBurn = subList?.reduce((acc, sub) => {
    const cost = Number(sub.cost);
    return acc + (sub.billingCycle === 'yearly' ? cost / 12 : cost);
  }, 0) ?? 0;

  return (
    <div className="space-y-8 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="t-page-title">Financial Ledger</h1>
          <p className="t-page-subtitle">Cashflow records, corporate expenses, and automated renewals.</p>
        </div>

        {/* Action button based on tab */}
        {activeTab === 'income' && (
          <Dialog open={isIncomeOpen} onOpenChange={setIsIncomeOpen}>
            <DialogTrigger asChild><button className="t-btn-primary flex items-center gap-2 text-sm"><Plus className="h-4 w-4" />Record Income</button></DialogTrigger>
            <DialogContent style={dialogStyle}>
              <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Record Payment Received</DialogTitle></DialogHeader>
              <ErrBanner msg={errorMsg} />
              <form onSubmit={e => { e.preventDefault(); if (!incomeForm.clientId) return setErrorMsg('Select a client'); addIncomeMutation.mutate({ ...incomeForm, amount: Number(incomeForm.amount) }); }} className="space-y-4 pt-2">
                <Field label="Client *">
                  <select style={selectCls} value={incomeForm.clientId} onChange={e => setIncomeForm({ ...incomeForm, clientId: e.target.value })} required>
                    <option value="">Select a Client</option>
                    {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Amount *"><input type="number" min="0" className={inputCls} style={rSm} value={incomeForm.amount} onChange={e => setIncomeForm({ ...incomeForm, amount: Number(e.target.value) })} required /></Field>
                  <Field label="Currency *"><input className={inputCls} style={rSm} placeholder="USD" value={incomeForm.currency} onChange={e => setIncomeForm({ ...incomeForm, currency: e.target.value })} required /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Payment Date"><input type="date" className={inputCls} style={rSm} value={incomeForm.paymentDate} onChange={e => setIncomeForm({ ...incomeForm, paymentDate: e.target.value })} required /></Field>
                  <Field label="Status">
                    <select style={selectCls} value={incomeForm.status} onChange={e => setIncomeForm({ ...incomeForm, status: e.target.value })}>
                      <option value="one-time">One-Time</option>
                      <option value="recurring">Recurring</option>
                    </select>
                  </Field>
                </div>
                <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setIsIncomeOpen(false)}>Cancel</button><button type="submit" disabled={addIncomeMutation.isPending} className="t-btn-primary text-sm">Record</button></div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {activeTab === 'expenses' && (
          <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
            <DialogTrigger asChild><button className="t-btn-primary flex items-center gap-2 text-sm"><Plus className="h-4 w-4" />Log Expense</button></DialogTrigger>
            <DialogContent style={dialogStyle}>
              <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Log Corporate Expense</DialogTitle></DialogHeader>
              <ErrBanner msg={errorMsg} />
              <form onSubmit={e => { e.preventDefault(); if (!expenseForm.description) return setErrorMsg('Description required'); addExpenseMutation.mutate({ ...expenseForm, amount: Number(expenseForm.amount) }); }} className="space-y-4 pt-2">
                <Field label="Description *"><input className={inputCls} style={rSm} placeholder="GitHub Enterprise monthly…" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} required /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Amount *"><input type="number" min="0" className={inputCls} style={rSm} value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} required /></Field>
                  <Field label="Category"><input className={inputCls} style={rSm} placeholder="SaaS, Infrastructure…" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Payment Date"><input type="date" className={inputCls} style={rSm} value={expenseForm.paymentDate} onChange={e => setExpenseForm({ ...expenseForm, paymentDate: e.target.value })} required /></Field>
                  <Field label="Method"><input className={inputCls} style={rSm} placeholder="Credit Card" value={expenseForm.paymentMethod} onChange={e => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })} /></Field>
                </div>
                <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setIsExpenseOpen(false)}>Cancel</button><button type="submit" disabled={addExpenseMutation.isPending} className="t-btn-primary text-sm">Log</button></div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {activeTab === 'subscriptions' && (
          <Dialog open={isSubOpen} onOpenChange={setIsSubOpen}>
            <DialogTrigger asChild><button className="t-btn-primary flex items-center gap-2 text-sm"><Plus className="h-4 w-4" />Track Subscription</button></DialogTrigger>
            <DialogContent style={dialogStyle}>
              <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Register Software Renewal</DialogTitle></DialogHeader>
              <ErrBanner msg={errorMsg} />
              <form onSubmit={e => { e.preventDefault(); if (!subForm.serviceName) return setErrorMsg('Service name required'); addSubMutation.mutate({ ...subForm, cost: Number(subForm.cost), reminderDays: Number(subForm.reminderDays) }); }} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Provider *"><input className={inputCls} style={rSm} placeholder="AWS, Vercel…" value={subForm.provider} onChange={e => setSubForm({ ...subForm, provider: e.target.value })} required /></Field>
                  <Field label="Service Name *"><input className={inputCls} style={rSm} placeholder="Pro Team Plan" value={subForm.serviceName} onChange={e => setSubForm({ ...subForm, serviceName: e.target.value })} required /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Cost *"><input type="number" min="0" className={inputCls} style={rSm} value={subForm.cost} onChange={e => setSubForm({ ...subForm, cost: Number(e.target.value) })} required /></Field>
                  <Field label="Billing Cycle">
                    <select style={selectCls} value={subForm.billingCycle} onChange={e => setSubForm({ ...subForm, billingCycle: e.target.value })}>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Renewal Date"><input type="date" className={inputCls} style={rSm} value={subForm.renewalDate} onChange={e => setSubForm({ ...subForm, renewalDate: e.target.value })} required /></Field>
                  <Field label="Reminder Period (Days)"><input type="number" min="1" className={inputCls} style={rSm} value={subForm.reminderDays} onChange={e => setSubForm({ ...subForm, reminderDays: Number(e.target.value) })} /></Field>
                </div>
                <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setIsSubOpen(false)}>Cancel</button><button type="submit" disabled={addSubMutation.isPending} className="t-btn-primary text-sm">Track</button></div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tabs list */}
      <TabBar
        tabs={[
          { id: 'income', label: 'Income Registry', icon: DollarSign },
          { id: 'expenses', label: 'Expenses Log', icon: CreditCard },
          { id: 'subscriptions', label: 'Software Subscriptions', icon: Calendar },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab content */}
      <div className="mt-0">
        {activeTab === 'income' && (
          incomeLoading ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent-primary)' }} /></div>
            : incomeList && incomeList.length > 0 ? (
              <div className="t-card overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                  <table className="t-table">
                    <thead><tr><th>Client</th><th>Amount</th><th>Exchange Rate</th><th>USD Value</th><th>Date</th></tr></thead>
                    <tbody>
                      {incomeList.map(inc => (
                        <tr key={inc.id}>
                          <td><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{inc.client?.name}</span></td>
                          <td><span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{inc.currency} {Number(inc.amount).toFixed(2)}</span></td>
                          <td><span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{Number(inc.exchangeRate).toFixed(4)}</span></td>
                          <td><span className="font-bold font-mono" style={{ color: 'var(--status-online)' }}>${(Number(inc.amount) * Number(inc.exchangeRate)).toFixed(2)}</span></td>
                          <td><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(inc.paymentDate).toLocaleDateString()}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {incomeList.map(inc => (
                    <div key={inc.id} className="p-4 space-y-1">
                      <div className="flex justify-between"><span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{inc.client?.name}</span><span className="font-bold font-mono" style={{ color: 'var(--status-online)' }}>${(Number(inc.amount) * Number(inc.exchangeRate)).toFixed(2)}</span></div>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{inc.currency} {Number(inc.amount).toFixed(2)} · {new Date(inc.paymentDate).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="t-empty"><DollarSign className="h-10 w-10" style={{ color: 'var(--border-default)' }} /><span className="text-sm font-semibold">No income records yet</span></div>
        )}

        {activeTab === 'expenses' && (
          expenseLoading ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent-primary)' }} /></div>
            : expenseList && expenseList.length > 0 ? (
              <div className="t-card overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                  <table className="t-table">
                    <thead><tr><th>Description</th><th>Category</th><th>Amount</th><th>Date Paid</th><th>Method</th></tr></thead>
                    <tbody>
                      {expenseList.map(exp => (
                        <tr key={exp.id}>
                          <td><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{exp.description}</span></td>
                          <td><span className="t-tech-pill">{exp.category}</span></td>
                          <td><span className="font-bold font-mono" style={{ color: 'var(--status-offline)' }}>${Number(exp.amount).toFixed(2)}</span></td>
                          <td><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(exp.paymentDate).toLocaleDateString()}</span></td>
                          <td><span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{exp.paymentMethod || '—'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {expenseList.map(exp => (
                    <div key={exp.id} className="p-4 space-y-1">
                      <div className="flex justify-between"><span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{exp.description}</span><span className="font-bold font-mono" style={{ color: 'var(--status-offline)' }}>${Number(exp.amount).toFixed(2)}</span></div>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{exp.category} · {new Date(exp.paymentDate).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="t-empty"><CreditCard className="h-10 w-10" style={{ color: 'var(--border-default)' }} /><span className="text-sm font-semibold">No expenses recorded</span></div>
        )}

        {activeTab === 'subscriptions' && (
          subsLoading ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent-primary)' }} /></div>
            : subList && subList.length > 0 ? (
              <div className="space-y-6">
                {/* Stats board */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="t-stat-card flex items-center justify-between">
                    <div>
                      <p className="t-label">Monthly Burn Rate</p>
                      <p className="text-2xl font-black font-mono mt-1" style={{ color: 'var(--text-primary)' }}>
                        ${monthlyBurn.toFixed(2)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <div className="t-stat-card flex items-center justify-between">
                    <div>
                      <p className="t-label">Monitored Renewals</p>
                      <p className="text-2xl font-black font-mono mt-1" style={{ color: 'var(--text-primary)' }}>
                        {subList.length}
                      </p>
                    </div>
                    <Calendar className="h-8 w-8" style={{ color: 'var(--accent-secondary-fg)' }} />
                  </div>
                </div>

                {/* Subscriptions Card Grid */}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {subList.map(sub => {
                    const days = Math.ceil((new Date(sub.renewalDate).getTime() - Date.now()) / 86400000);
                    const urgent = days <= sub.reminderDays && days > 0;
                    const expired = days <= 0;

                    let urgencyClass = 't-renewal-safe';
                    let stateColor = 'var(--status-online)';
                    if (expired) {
                      urgencyClass = 't-renewal-urgent';
                      stateColor = 'var(--status-offline)';
                    } else if (urgent) {
                      urgencyClass = 't-renewal-urgent';
                      stateColor = 'var(--status-offline)';
                    } else if (days <= 30) {
                      urgencyClass = 't-renewal-warning';
                      stateColor = 'var(--status-idle)';
                    }

                    return (
                      <div
                        key={sub.id}
                        className={`t-card p-5 flex flex-col justify-between ${urgencyClass}`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            {/* Initials avatar */}
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                              {sub.provider.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}>
                              {sub.billingCycle}
                            </span>
                          </div>

                          <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{sub.serviceName}</h3>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sub.provider}</p>

                          <div className="mt-4 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span style={{ color: 'var(--text-tertiary)' }}>Cost:</span>
                              <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>${Number(sub.cost).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span style={{ color: 'var(--text-tertiary)' }}>Renewal:</span>
                              <span style={{ color: stateColor, fontWeight: 600 }}>
                                {new Date(sub.renewalDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <span className="text-[10px] font-mono font-bold flex items-center gap-1" style={{ color: stateColor }}>
                            <Clock className="h-3 w-3" />
                            {expired ? 'EXPIRED' : `${days} days left`}
                          </span>

                          <button
                            onClick={() => sendReminder(sub.id)}
                            disabled={remindingId === sub.id}
                            className="t-btn-ghost flex items-center gap-1 text-[10px] uppercase font-bold"
                            style={{ minHeight: '28px', padding: '0 8px', borderRadius: '4px' }}
                          >
                            {remindingId === sub.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            <span>Notify</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : <div className="t-empty"><Calendar className="h-10 w-10" style={{ color: 'var(--border-default)' }} /><span className="text-sm font-semibold">No subscriptions tracked</span></div>
        )}
      </div>
    </div>
  );
}
