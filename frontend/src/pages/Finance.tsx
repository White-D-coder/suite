import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import TabBar from '../components/TabBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import {
  AlertTriangle, Plus, DollarSign, CreditCard, Calendar, Loader2,
  Bell, ShieldAlert, Send, Clock, Sparkles, CheckCircle2,
  Briefcase, TrendingUp, HelpCircle, Eye, Trash2
} from 'lucide-react';

interface Expense {
  id: string; description: string; amount: number; category: string;
  paymentDate: string; paymentMethod?: string;
  isRecurrent?: boolean; recurrenceInterval?: string;
  project?: { name: string };
  postponedUntil?: string; postponeReason?: string;
}

interface SalaryRecord {
  id: string; payPeriod: string; grossAmount: number; netAmount: number;
  taxDeducted: number; benefitsCost: number; isPaid: boolean;
  user: { name: string; role: string; email: string };
}

interface Sub {
  id: string; provider: string; serviceName: string; cost: number;
  billingCycle: string; renewalDate: string; duplicateWarning?: boolean;
}

interface FinancialAnalysisData {
  totalIncome: number;
  totalExpenses: number;
  totalSalaries: number;
  netProfit: number;
  marginPercentage: number;
  wastedSubscriptions: Sub[];
  projectMargins: { projectId: string; projectName: string; revenue: number; directCost: number; indirectCost: number; margin: number }[];
}

const inputCls = 't-input w-full px-3 py-2 text-sm';
const rSm = { borderRadius: 'var(--radius-sm)' };
const selectCls: React.CSSProperties = { ...rSm, border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-primary)', width: '100%', height: '42px', padding: '0 0.75rem', fontSize: '0.875rem' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="t-label">{label}</label>{children}</div>;
}

function ErrBanner({ msg }: { msg: string }) {
  return msg ? (
    <div className="flex items-center gap-2 text-xs p-2.5 rounded-md mb-2" style={{ background: 'rgba(232,160,144,0.12)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', borderRadius: 'var(--radius-sm)' }}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {msg}
    </div>
  ) : null;
}

const today = () => new Date().toISOString().split('T')[0];

export default function Finance() {
  const { user } = useOutletContext<{ user: any }>();
  const role = user?.role || 'employee';
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('expenses');
  const [errorMsg, setErrorMsg] = useState('');

  // Dialog States
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: 0, category: 'SaaS', paymentDate: today(), paymentMethod: 'Credit Card', isRecurrent: false, recurrenceInterval: 'monthly', projectId: '' });

  // Postpone Expense States
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [postponingExpenseId, setPostponingExpenseId] = useState<string | null>(null);
  const [postponeUntilDate, setPostponeUntilDate] = useState(today());
  const [postponeReasonText, setPostponeReasonText] = useState('');

  // Expense details drawer states
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);
  const [expenseDetailOpen, setExpenseDetailOpen] = useState(false);

  // Salary Record States
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ userId: '', payPeriod: 'Monthly July 2026', grossAmount: 0, taxPercentage: 20, benefitsCost: 150 });

  // Queries
  const { data: financialData, isLoading: finLoading } = useQuery<any>({
    queryKey: ['financial-analyser'],
    queryFn: () => api.get('/finance/analysers/financial').then(r => r.data),
    enabled: ['owner', 'admin', 'finance'].includes(role),
  });

  const { data: profitabilityData, isLoading: profLoading } = useQuery<any[]>({
    queryKey: ['profitability-analyser'],
    queryFn: () => api.get('/finance/analysers/profitability').then(r => r.data),
    enabled: ['owner', 'admin', 'finance'].includes(role),
  });

  const anaLoading = finLoading || profLoading;

  const analytics = useMemo<FinancialAnalysisData | null>(() => {
    if (!financialData || !profitabilityData) return null;
    const totalIncome = financialData.summary?.totalIncome || 0;
    const totalExpenses = financialData.summary?.totalExpense || 0;
    const totalSalaries = financialData.summary?.totalSalary || 0;
    const netProfit = financialData.summary?.netProfit || 0;
    const marginPercentage = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    return {
      totalIncome,
      totalExpenses,
      totalSalaries,
      netProfit,
      marginPercentage,
      wastedSubscriptions: financialData.wastefulSubscriptions || [],
      projectMargins: profitabilityData || [],
    };
  }, [financialData, profitabilityData]);

  const { data: expenses, isLoading: expLoading } = useQuery<Expense[]>({
    queryKey: ['expenses-list'],
    queryFn: () => api.get('/finance/expenses').then(r => r.data),
    enabled: ['owner', 'admin', 'finance'].includes(role),
  });

  const { data: salaries, isLoading: salLoading } = useQuery<SalaryRecord[]>({
    queryKey: ['salaries-list'],
    queryFn: () => api.get('/finance/salaries').then(r => r.data),
    enabled: ['owner', 'admin', 'finance'].includes(role),
  });

  const { data: projects } = useQuery<any[]>({
    queryKey: ['projects-list'],
    queryFn: () => api.get('/projects').then(r => r.data),
  });

  const { data: staff } = useQuery<any[]>({
    queryKey: ['users-list'],
    queryFn: () => api.get('/auth/users').then(r => r.data),
    enabled: ['owner', 'admin', 'finance'].includes(role),
  });

  // Mutations
  const addExpenseMutation = useMutation({
    mutationFn: (p: any) => api.post('/finance/expenses', p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses-list'] });
      qc.invalidateQueries({ queryKey: ['financial-dashboard'] });
      setIsExpenseOpen(false);
      setErrorMsg('');
      setExpenseForm({ description: '', amount: 0, category: 'SaaS', paymentDate: today(), paymentMethod: 'Credit Card', isRecurrent: false, recurrenceInterval: 'monthly', projectId: '' });
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.message || 'Failed to log expense.'),
  });

  const addSalaryMutation = useMutation({
    mutationFn: (p: any) => api.post('/finance/salaries', p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salaries-list'] });
      qc.invalidateQueries({ queryKey: ['financial-dashboard'] });
      setSalaryOpen(false);
      setSalaryForm({ userId: '', payPeriod: 'Monthly July 2026', grossAmount: 0, taxPercentage: 20, benefitsCost: 150 });
    },
  });

  const postponeExpense = (e: React.FormEvent) => {
    e.preventDefault();
    api.post(`/finance/expenses/${postponingExpenseId}/postpone`, {
      postponedUntil: postponeUntilDate,
      postponeReason: postponeReasonText,
    }).then(() => {
      qc.invalidateQueries({ queryKey: ['expenses-list'] });
      setPostponeOpen(false);
      setPostponeReasonText('');
    });
  };

  const markSalaryPaidMutation = useMutation({
    mutationFn: (id: string) => api.put(`/finance/salaries/${id}`, { isPaid: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salaries-list'] }),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/finance/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses-list'] });
      qc.invalidateQueries({ queryKey: ['financial-dashboard'] });
    },
  });

  const dialogStyle = { background: 'var(--surface-card)', border: '1px solid var(--border-default)' };

  if (role === 'employee') {
    return (
      <div className="t-empty py-20 text-center">
        <ShieldAlert size={40} className="text-red-400 mx-auto mb-2" />
        <span className="text-sm font-semibold">Access Denied. Financial accounts are restricted to Owners, Admins, and Finance staff.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="t-page-title">Corporate Financial Operations</h1>
          <p className="t-page-subtitle">Manage corporate expenditures, payroll registries, and P&amp;L performance.</p>
        </div>

        {activeTab === 'expenses' && (
          <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
            <DialogTrigger asChild>
              <button className="t-btn-primary flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4" /> Log Expense
              </button>
            </DialogTrigger>
            <DialogContent style={dialogStyle} className="max-w-lg">
              <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Log Corporate Expense</DialogTitle></DialogHeader>
              <ErrBanner msg={errorMsg} />
              <form onSubmit={e => { e.preventDefault(); addExpenseMutation.mutate({ ...expenseForm, amount: Number(expenseForm.amount), projectId: expenseForm.projectId || undefined }); }} className="space-y-4 pt-2">
                <Field label="Description / SOW *">
                  <input className={inputCls} placeholder="GitHub Enterprise seat renewal..." value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} required />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Amount (USD) *">
                    <input type="number" min="0" className={inputCls} value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} required />
                  </Field>
                  <Field label="Category">
                    <input className={inputCls} placeholder="SaaS, Infrastructure, Travel" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Payment Date">
                    <input type="date" className={inputCls} value={expenseForm.paymentDate} onChange={e => setExpenseForm({ ...expenseForm, paymentDate: e.target.value })} required />
                  </Field>
                  <Field label="Payment Method">
                    <input className={inputCls} placeholder="Credit Card, Wire Transfer" value={expenseForm.paymentMethod} onChange={e => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Recurrence">
                    <label className="flex items-center gap-2 text-xs cursor-pointer py-2">
                      <input type="checkbox" checked={expenseForm.isRecurrent} onChange={e => setExpenseForm({ ...expenseForm, isRecurrent: e.target.checked })} style={{ accentColor: 'var(--accent-primary)' }} />
                      Recurring Category
                    </label>
                  </Field>
                  {expenseForm.isRecurrent && (
                    <Field label="Recurrence Interval">
                      <select style={selectCls} value={expenseForm.recurrenceInterval} onChange={e => setExpenseForm({ ...expenseForm, recurrenceInterval: e.target.value })}>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </Field>
                  )}
                </div>
                <Field label="Link to Project (Optional)">
                  <select style={selectCls} value={expenseForm.projectId} onChange={e => setExpenseForm({ ...expenseForm, projectId: e.target.value })}>
                    <option value="">No Project (General Overhead)</option>
                    {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setIsExpenseOpen(false)}>Cancel</button><button type="submit" disabled={addExpenseMutation.isPending} className="t-btn-primary text-sm">Log Expense</button></div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {activeTab === 'salaries' && (
          <Dialog open={salaryOpen} onOpenChange={setSalaryOpen}>
            <DialogTrigger asChild>
              <button className="t-btn-primary flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4" /> Record Salary Payment
              </button>
            </DialogTrigger>
            <DialogContent style={dialogStyle}>
              <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Record Payroll Slip</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); addSalaryMutation.mutate({ ...salaryForm, grossAmount: Number(salaryForm.grossAmount), taxPercentage: Number(salaryForm.taxPercentage), benefitsCost: Number(salaryForm.benefitsCost) }); }} className="space-y-4 pt-2">
                <Field label="Employee *">
                  <select style={selectCls} value={salaryForm.userId} onChange={e => setSalaryForm({ ...salaryForm, userId: e.target.value })} required>
                    <option value="">Select Employee</option>
                    {staff?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                  </select>
                </Field>
                <Field label="Gross Base Amount (USD) *">
                  <input type="number" min="0" className={inputCls} value={salaryForm.grossAmount} onChange={e => setSalaryForm({ ...salaryForm, grossAmount: Number(e.target.value) })} required />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Tax Deductions (%)">
                    <input type="number" min="0" max="100" className={inputCls} value={salaryForm.taxPercentage} onChange={e => setSalaryForm({ ...salaryForm, taxPercentage: Number(e.target.value) })} />
                  </Field>
                  <Field label="Benefits Overhead (USD)">
                    <input type="number" min="0" className={inputCls} value={salaryForm.benefitsCost} onChange={e => setSalaryForm({ ...salaryForm, benefitsCost: Number(e.target.value) })} />
                  </Field>
                </div>
                <Field label="Payroll Period"><input className={inputCls} placeholder="e.g. July 2026" value={salaryForm.payPeriod} onChange={e => setSalaryForm({ ...salaryForm, payPeriod: e.target.value })} required /></Field>
                <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setSalaryOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Save Slip</button></div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <TabBar
        tabs={[
          { id: 'expenses', label: 'Expenses Registry', icon: CreditCard },
          { id: 'salaries', label: 'Salaries & Payroll', icon: DollarSign },
          { id: 'analyzer', label: 'Financial P&L Analyser', icon: TrendingUp },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ── Tab 1: Expenses Registry ── */}
      {activeTab === 'expenses' && (
        <div className="mt-0">
          {expLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} /></div>
          ) : expenses && expenses.length > 0 ? (
            <div className="t-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="t-table text-xs">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Linked Project</th>
                      <th>Amount</th>
                      <th>Date Paid</th>
                      <th>Recurrence</th>
                      <th>Deferred Status</th>
                      <th className="text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(exp => {
                      const isPostponed = !!exp.postponedUntil;
                      return (
                        <tr
                          key={exp.id}
                          className={`cursor-pointer hover:bg-[var(--surface-sunken)] transition-colors ${isPostponed ? 'opacity-70 bg-amber-500/5' : ''}`}
                          onClick={() => { setSelectedExpense(exp); setExpenseDetailOpen(true); }}
                        >
                          <td>
                            <p className="font-semibold text-[var(--text-primary)]">{exp.description}</p>
                            {isPostponed && (
                              <span className="text-[9px] font-bold text-amber-400 block mt-0.5 bg-amber-500/10 px-1 py-0.5 rounded w-max">
                                Postponed: {exp.postponeReason || 'Deferred'} (Until: {new Date(exp.postponedUntil!).toLocaleDateString()})
                              </span>
                            )}
                          </td>
                          <td><span className="t-tech-pill">{exp.category}</span></td>
                          <td><span className="text-[var(--text-secondary)]">{exp.project?.name || 'Overheads'}</span></td>
                          <td><span className="font-bold font-mono text-red-400">${Number(exp.amount).toFixed(2)}</span></td>
                          <td><span className="text-[var(--text-secondary)]">{new Date(exp.paymentDate).toLocaleDateString()}</span></td>
                          <td className="capitalize">{exp.isRecurrent ? `Recurrent (${exp.recurrenceInterval})` : 'One-time'}</td>
                          <td>{isPostponed ? 'Deferred' : 'Immediate'}</td>
                          <td>
                            <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                              {!isPostponed && (
                                <button
                                  onClick={() => {
                                    setPostponingExpenseId(exp.id);
                                    setPostponeOpen(true);
                                  }}
                                  className="text-[10px] py-1 px-2 border border-amber-500/20 bg-amber-500/5 text-amber-400 rounded hover:bg-amber-500/10 font-bold"
                                  title="Postpone expense"
                                >
                                  Defer Payment
                                </button>
                              )}
                              <button onClick={() => deleteExpenseMutation.mutate(exp.id)} className="text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="t-empty"><CreditCard className="h-10 w-10" style={{ color: 'var(--border-default)' }} /><span className="text-sm font-semibold">No expenses logged yet</span></div>
          )}
        </div>
      )}

      {/* ── Tab 2: Salaries & Payroll ── */}
      {activeTab === 'salaries' && (
        <div className="mt-0">
          {salLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} /></div>
          ) : salaries && salaries.length > 0 ? (
            <div className="t-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="t-table text-xs">
                  <thead>
                    <tr>
                      <th>Employee Name</th>
                      <th>Grade / Role</th>
                      <th>Payroll Period</th>
                      <th>Gross Base</th>
                      <th>Tax Deducted</th>
                      <th>Benefits Cost</th>
                      <th>Net Paid Amount</th>
                      <th>Status</th>
                      <th className="text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaries.map(sal => (
                      <tr key={sal.id}>
                        <td><span className="font-bold text-[var(--text-primary)]">{sal.user.name}</span></td>
                        <td><span className="t-tech-pill capitalize">{sal.user.role}</span></td>
                        <td>{sal.payPeriod}</td>
                        <td className="font-mono font-semibold">${Number(sal.grossAmount).toFixed(2)}</td>
                        <td className="font-mono text-red-400">-${Number(sal.taxDeducted).toFixed(2)}</td>
                        <td className="font-mono text-orange-400">-${Number(sal.benefitsCost).toFixed(2)}</td>
                        <td className="font-bold font-mono text-[var(--text-link)]">${Number(sal.netAmount).toFixed(2)}</td>
                        <td>
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            sal.isPaid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>{sal.isPaid ? 'Paid' : 'Pending Approval'}</span>
                        </td>
                        <td className="text-right">
                          {!sal.isPaid && (
                            <button onClick={() => markSalaryPaidMutation.mutate(sal.id)} className="t-btn-primary py-0.5 px-2 text-[10px] flex-inline items-center gap-0.5"><CheckCircle2 size={10} /> Mark Paid</button>
                          )}
                          {sal.isPaid && <span className="text-[var(--text-tertiary)]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="t-empty"><DollarSign className="h-10 w-10" style={{ color: 'var(--border-default)' }} /><span className="text-sm font-semibold">No payroll records logged</span></div>
          )}
        </div>
      )}

      {/* ── Tab 3: Financial Analyzer ── */}
      {activeTab === 'analyzer' && (
        <div className="space-y-6">
          {anaLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} /></div>
          ) : analytics ? (
            <>
              {/* Telemetry numbers grid */}
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="t-stat-card">
                  <p className="t-label">Total Revenues (USD)</p>
                  <p className="text-xl font-black font-mono mt-1 text-emerald-400">${analytics.totalIncome.toFixed(2)}</p>
                </div>
                <div className="t-stat-card">
                  <p className="t-label">Operating Expenses (USD)</p>
                  <p className="text-xl font-black font-mono mt-1 text-red-400">${analytics.totalExpenses.toFixed(2)}</p>
                </div>
                <div className="t-stat-card">
                  <p className="t-label">Salaries / stipend payouts</p>
                  <p className="text-xl font-black font-mono mt-1 text-orange-400">${analytics.totalSalaries.toFixed(2)}</p>
                </div>
                <div className="t-stat-card">
                  <p className="t-label">Net Profit / Margin</p>
                  <div className="flex justify-between items-end mt-1">
                    <p className={`text-xl font-black font-mono ${analytics.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${analytics.netProfit.toFixed(2)}
                    </p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      analytics.marginPercentage >= 30 ? 'bg-emerald-500/10 text-emerald-400' : analytics.marginPercentage >= 10 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {analytics.marginPercentage.toFixed(1)}% Margin
                    </span>
                  </div>
                </div>
              </div>

              {/* Profit Margin visual health indicators */}
              <div className="t-card p-5 space-y-3">
                <p className="font-semibold text-xs text-[var(--text-primary)]">Corporate Operating Profit Margin Gauge</p>
                <div className="w-full bg-[var(--surface-sunken)] rounded-full h-3 border border-[var(--border-subtle)] overflow-hidden flex">
                  <div 
                    style={{ 
                      width: `${Math.max(0, Math.min(100, analytics.marginPercentage))}%`,
                      background: analytics.marginPercentage >= 30 ? 'var(--status-online)' : analytics.marginPercentage >= 10 ? 'var(--status-idle)' : 'var(--status-offline)'
                    }} 
                    className="h-full transition-all duration-500"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] font-semibold">
                  <span>Critical Margin (&lt;10%)</span>
                  <span>Healthy Target (&gt;30%)</span>
                </div>
              </div>

              {/* Duplicate software subscriptions warning banner */}
              <div className="t-card p-5 space-y-4">
                <div>
                  <p className="font-semibold text-xs flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    <ShieldAlert className="text-orange-500" size={14} /> Flagged Wasteful Subscriptions
                  </p>
                  <p className="text-xs mt-0.5 text-[var(--text-tertiary)]">Subscriptions identified as duplicates or inactive software seats.</p>
                </div>

                {analytics.wastedSubscriptions.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.wastedSubscriptions.map(sub => (
                      <div key={sub.id} className="p-3 bg-red-500/5 border border-red-500/15 text-red-400 rounded-lg text-xs flex justify-between items-center gap-3">
                        <div>
                          <span className="font-bold text-[var(--text-primary)]">{sub.provider}</span>
                          <span className="text-[10px] text-[var(--text-tertiary)] block mt-0.5">{sub.serviceName} · Billing: {sub.billingCycle}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold font-mono text-[var(--text-primary)] block">${Number(sub.cost).toFixed(2)}</span>
                          <span className="text-[9px] uppercase font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                            Duplicate Flagged
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-[var(--surface-sunken)] text-center text-xs text-[var(--text-tertiary)]">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                    <span>No duplicate software seats or wasteful subscriptions detected!</span>
                  </div>
                )}
              </div>

              {/* Project margins list */}
              <div className="t-card p-5 space-y-4">
                <p className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>Direct labor vs Indirect Tool Overhead Margin analysis</p>
                <div className="space-y-3">
                  {analytics.projectMargins.map(pm => (
                    <div key={pm.projectId} className="p-3 bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg text-xs">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-[var(--text-primary)]">{pm.projectName}</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          pm.margin >= 30 ? 'bg-emerald-500/10 text-emerald-400' : pm.margin >= 10 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                        }`}>{pm.margin.toFixed(1)}% Profit Margin</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-[var(--text-secondary)]">
                        <p>Total Revenue: <span className="font-mono font-semibold">${pm.revenue.toFixed(2)}</span></p>
                        <p>Direct Cost: <span className="font-mono font-semibold">${pm.directCost.toFixed(2)}</span></p>
                        <p>Indirect Cost: <span className="font-mono font-semibold">${pm.indirectCost.toFixed(2)}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="t-empty py-8 text-xs">No analytics data could be compiled.</div>
          )}
        </div>
      )}

      {/* Postpone/Defer Expense Modal */}
      <Dialog open={postponeOpen} onOpenChange={setPostponeOpen}>
        <DialogContent style={dialogStyle}>
          <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Postpone Expense Payment</DialogTitle></DialogHeader>
          <p className="text-xs text-[var(--text-secondary)]">Defer corporate payout items by specifying a new release date and the operational reason.</p>
          <form onSubmit={postponeExpense} className="space-y-4 pt-2">
            <Field label="Postponed Until *">
              <input type="date" className={inputCls} value={postponeUntilDate} onChange={e => setPostponeUntilDate(e.target.value)} required />
            </Field>
            <Field label="Operational Reason *">
              <input className={inputCls} placeholder="Cashflow scheduling, pending invoice receipts..." value={postponeReasonText} onChange={e => setPostponeReasonText(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setPostponeOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Postpone Payment</button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Expense Details Modal */}
      <Dialog open={expenseDetailOpen} onOpenChange={setExpenseDetailOpen}>
        <DialogContent style={dialogStyle} className="max-w-md">
          <DialogHeader>
            <div className="flex justify-between items-center pr-6">
              <DialogTitle style={{ color: 'var(--text-primary)' }}>Corporate Expense Details</DialogTitle>
              {selectedExpense?.postponedUntil && (
                <span className="px-2 py-0.5 rounded font-bold text-xs bg-amber-500/10 text-amber-400">
                  Deferred
                </span>
              )}
            </div>
          </DialogHeader>
          
          {selectedExpense && (
            <div className="space-y-4 pt-2 text-xs leading-relaxed">
              <div>
                <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-1">Description</p>
                <p className="font-semibold text-[var(--text-primary)] text-sm">{selectedExpense.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-subtle)] pt-3">
                <div>
                  <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-1">Category</p>
                  <p className="font-semibold text-[var(--text-primary)] capitalize">{selectedExpense.category}</p>
                </div>
                <div>
                  <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-1">Linked Project</p>
                  <p className="font-semibold text-[var(--text-primary)]">{selectedExpense.project?.name || 'Overheads (No project)'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-subtle)] pt-3">
                <div>
                  <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-1">Total Amount</p>
                  <p className="font-mono font-bold text-red-400 text-sm">${Number(selectedExpense.amount).toFixed(2)}</p>
                </div>
                <div>
                  <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-1">Payment Method</p>
                  <p className="font-semibold text-[var(--text-primary)]">{selectedExpense.paymentMethod || 'Credit Card'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-subtle)] pt-3">
                <div>
                  <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-1">Payment Date</p>
                  <p className="font-semibold text-[var(--text-primary)]">{new Date(selectedExpense.paymentDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="font-bold text-[var(--text-secondary)] uppercase text-[9px] tracking-wider mb-1">Recurrence Status</p>
                  <p className="font-semibold text-[var(--text-primary)] capitalize">{selectedExpense.isRecurrent ? `Recurrent (${selectedExpense.recurrenceInterval})` : 'One-time payment'}</p>
                </div>
              </div>

              {selectedExpense.postponedUntil && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs space-y-2">
                  <div>
                    <p className="font-bold text-amber-400 uppercase text-[9px] tracking-wider mb-0.5">Deferred Release Date</p>
                    <p className="font-semibold text-[var(--text-primary)]">{new Date(selectedExpense.postponedUntil).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="font-bold text-amber-400 uppercase text-[9px] tracking-wider mb-0.5">Postponement Reason</p>
                    <p className="text-[var(--text-secondary)] font-medium">{selectedExpense.postponeReason || 'Unspecified cashflow adjustments'}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
                <button type="button" className="t-btn-primary text-xs" onClick={() => setExpenseDetailOpen(false)}>Close Details</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
