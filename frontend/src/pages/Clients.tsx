import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Search, Plus, Building, User, Mail, AlertTriangle, Loader2, ArrowRight, Tag } from 'lucide-react';

interface Client {
  id: string; name: string; company?: string;
  email?: string; phone?: string; country?: string; notes?: string; type?: string;
}

const CLIENT_TYPES = [
  { value: '', label: 'Select type…' },
  { value: 'agency', label: 'Agency' },
  { value: 'direct', label: 'Direct' },
  { value: 'referral', label: 'Referral' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'startup', label: 'Startup' },
];

const emptyForm = {
  name: '', company: '', email: '', phone: '', country: '',
  currency: 'USD', billingAddress: '', paymentTerms: 'Net 30', notes: '', type: '',
};

const inputCls = 't-input w-full px-3 py-2.5 text-sm';
const rSm = { borderRadius: 'var(--radius-sm)' };

const countryCurrencyMap: Record<string, string> = {
  'united states': 'USD', 'us': 'USD', 'usa': 'USD',
  'united kingdom': 'GBP', 'uk': 'GBP', 'great britain': 'GBP', 'england': 'GBP',
  'germany': 'EUR', 'france': 'EUR', 'italy': 'EUR', 'spain': 'EUR',
  'netherlands': 'EUR', 'belgium': 'EUR', 'ireland': 'EUR', 'europe': 'EUR', 'eu': 'EUR',
  'india': 'INR', 'in': 'INR',
  'canada': 'CAD', 'ca': 'CAD',
  'australia': 'AUD', 'au': 'AUD',
  'japan': 'JPY', 'jp': 'JPY',
  'singapore': 'SGD', 'sg': 'SGD',
  'switzerland': 'CHF', 'ch': 'CHF',
};

function getCurrencyByCountry(country: string): string {
  const c = country.trim().toLowerCase();
  return countryCurrencyMap[c] || 'USD';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="t-label">{label}</label>{children}</div>;
}

const TYPE_BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  agency:     { bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa' },
  direct:     { bg: 'rgba(16,185,129,0.15)',  color: '#34d399' },
  referral:   { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  enterprise: { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
  startup:    { bg: 'rgba(236,72,153,0.15)',  color: '#f472b6' },
};

function TypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const colors = TYPE_BADGE_COLORS[type] || { bg: 'var(--surface-sunken)', color: 'var(--text-secondary)' };
  return (
    <span style={{ background: colors.bg, color: colors.color, borderRadius: '4px', padding: '2px 7px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {type}
    </span>
  );
}

export default function Clients() {
  const { user } = useOutletContext<{ user: any }>();
  const role = user?.role || 'employee';
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const handleCountryChange = (countryName: string) => {
    const inferred = getCurrencyByCountry(countryName);
    setForm(prev => ({
      ...prev,
      country: countryName,
      currency: inferred
    }));
  };

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients').then(r => r.data),
    refetchInterval: 5000, // real-time polling every 5s
    refetchIntervalInBackground: true,
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.post('/clients', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients-list'] });
      setOpen(false);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to create client.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!form.name) { setFormError('Client name is required.'); return; }
    createMutation.mutate(form);
  };

  const filtered = clients?.filter(c => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
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
          <h1 className="t-page-title">Clients CRM</h1>
          <p className="t-page-subtitle">Manage accounts, billing defaults, and client relations.</p>
        </div>
        {role !== 'employee' && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="t-btn-primary flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4" />Add Client
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)' }}>
              <DialogHeader>
                <DialogTitle style={{ color: 'var(--text-primary)' }}>New Client Registry</DialogTitle>
              </DialogHeader>
              {formError && (
                <div className="flex items-center gap-2 text-xs p-2.5 rounded-md"
                  style={{ background: 'rgba(243,195,178,0.2)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', ...rSm }}>
                  <AlertTriangle className="h-4 w-4 shrink-0" />{formError}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Client Name *"><input className={inputCls} style={rSm} placeholder="John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></Field>
                  <Field label="Company"><input className={inputCls} style={rSm} placeholder="Acme Corp" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Email"><input type="email" className={inputCls} style={rSm} placeholder="john@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Phone"><input className={inputCls} style={rSm} placeholder="+1 555-0199" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Client Type">
                    <select
                      className={inputCls}
                      style={{ ...rSm, background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                      value={form.type}
                      onChange={e => setForm({ ...form, type: e.target.value })}
                    >
                      {CLIENT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Payment Terms"><input className={inputCls} style={rSm} placeholder="Net 30" value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} /></Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Country"><input className={inputCls} style={rSm} placeholder="United States" value={form.country} onChange={e => handleCountryChange(e.target.value)} /></Field>
                  <Field label="Currency"><input className={inputCls} style={rSm} placeholder="USD" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} /></Field>
                  <Field label="Billing Address"><input className={inputCls} style={rSm} placeholder="123 Main St…" value={form.billingAddress} onChange={e => setForm({ ...form, billingAddress: e.target.value })} /></Field>
                </div>
                <Field label="Notes">
                  <textarea className={`${inputCls} h-16 resize-none`} style={rSm} placeholder="Relationship notes…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </Field>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" className="t-btn-ghost text-sm" onClick={() => setOpen(false)}>Cancel</button>
                  <button type="submit" disabled={createMutation.isPending} className="t-btn-primary text-sm">
                    {createMutation.isPending ? 'Saving…' : 'Register Client'}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Table card */}
      <div className="t-card overflow-hidden">
        {/* Search */}
        <div className="p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
            <input className="t-input w-full pl-9 pr-4 py-2.5 text-sm" style={rSm} placeholder="Search by name, email, company…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {filtered.length > 0 ? (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="t-table">
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th>Company</th>
                    <th>Email</th>
                    <th>Type</th>
                    <th>Country</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(client => (
                    <tr key={client.id} className="cursor-pointer" onClick={() => navigate(`/dashboard/clients/${client.id}`)}>
                      <td>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-link)' }} />
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{client.name}</span>
                        </div>
                      </td>
                      <td>
                        {client.company ? (
                          <div className="flex items-center gap-1.5">
                            <Building className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                            <span style={{ color: 'var(--text-primary)' }}>{client.company}</span>
                          </div>
                        ) : <span style={{ color: 'var(--text-tertiary)' }} className="italic text-xs">—</span>}
                      </td>
                      <td>
                        {client.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                            <span style={{ color: 'var(--text-primary)' }}>{client.email}</span>
                          </div>
                        ) : <span style={{ color: 'var(--text-tertiary)' }} className="italic text-xs">—</span>}
                      </td>
                      <td>
                        {client.type ? (
                          <div className="flex items-center gap-1.5">
                            <Tag className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                            <TypeBadge type={client.type} />
                          </div>
                        ) : <span style={{ color: 'var(--text-tertiary)' }} className="italic text-xs">—</span>}
                      </td>
                      <td><span style={{ color: 'var(--text-secondary)' }}>{client.country || '—'}</span></td>
                      <td>
                        <div className="flex justify-end">
                          <ArrowRight className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {filtered.map(client => (
                <button key={client.id} className="w-full text-left p-4 flex items-center justify-between hover:bg-[var(--surface-sunken)] transition-colors"
                  onClick={() => navigate(`/dashboard/clients/${client.id}`)}>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{client.name}</p>
                      <TypeBadge type={client.type} />
                    </div>
                    {client.company && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{client.company}</p>}
                    {client.email && <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{client.email}</p>}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="t-empty m-6">
            <User className="h-10 w-10" style={{ color: 'var(--border-default)' }} />
            <span className="text-sm font-semibold">No clients match your search</span>
          </div>
        )}
      </div>
    </div>
  );
}
