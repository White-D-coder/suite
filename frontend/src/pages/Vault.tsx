import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Shield, Globe, Key, Lock, Eye, EyeOff, ChevronDown, ChevronRight,
  X, Check, Clock, AlertTriangle, Link2, Users, RefreshCw, ExternalLink,
  Infinity, Calendar, Server, Database, Code, CreditCard, Mail, MessageSquare,
  Palette, BarChart3, Cpu, Zap, ShieldCheck, Building2, FolderOpen,
  Filter, SortAsc, Download, MoreHorizontal, ArrowRight, ChevronUp, Layers
} from 'lucide-react';
import { api } from '../lib/api';

/* ─── Types ─────────────────────────────────────────────── */
interface Technology {
  id: string;
  name: string;
  category: string;
  officialUrl?: string;
  logoUrl?: string;
  fieldDefinitions?: FieldDef[];
}

interface FieldDef {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  isSecret: boolean;
  isRequired: boolean;
  displayOrder: number;
}

interface TechAccount {
  id: string;
  accountName: string;
  accountIdentifier?: string;
  technology: Technology;
  ownerType: string;
  status: string;
  isLifetime: boolean;
  subscriptionPlan?: string;
  billingCycle?: string;
  billingAmount?: number;
  billingCurrency?: string;
  nextBillingDate?: string;
  subscriptionStatus: string;
  lastRotationDate?: string;
  nextRotationDate?: string;
  twoFactorEnabled: boolean;
  projectLinks: { project: { id: string; name: string } }[];
  environments: TechEnv[];
  fields: TechField[];
  grants?: any[];
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface TechEnv {
  id: string;
  environmentName: string;
  environmentType: string;
  url?: string;
  active: boolean;
}

interface TechField {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  isSecret: boolean;
  nonSecretValue?: string;
  encryptedValue?: string;
  environmentId?: string;
}

interface AccessRequest {
  id: string;
  requesterId: string;
  status: string;
  urgency: string;
  requestReason: string;
  taskReference?: string;
  requestedDurationMin?: number;
  requestedAt: string;
  technologyAccount: { id: string; accountName: string; technology: Technology };
  requestedFields: {
    id: string;
    accountFieldId: string;
    approved: boolean;
    accountField: { fieldKey: string; fieldLabel: string; isSecret: boolean };
  }[];
}

interface Grant {
  id: string;
  employeeId: string;
  projectId: string;
  active: boolean;
  canReveal: boolean;
  canCopy: boolean;
  singleUse: boolean;
  grantedAt: string;
  expiresAt?: string;
  lastAccessedAt?: string;
  technologyAccount: { accountName: string; technology: Technology };
  accountField: { fieldKey: string; fieldLabel: string; isSecret: boolean };
}

/* ─── Category Icons ─────────────────────────────────────── */
const CAT_ICON: Record<string, React.ReactNode> = {
  'Source Control': <Code size={13} />,
  'Cloud Infrastructure': <Server size={13} />,
  'Hosting': <Globe size={13} />,
  'Domain and DNS': <Globe size={13} />,
  'Database': <Database size={13} />,
  'Email': <Mail size={13} />,
  'Communication': <MessageSquare size={13} />,
  'Design': <Palette size={13} />,
  'Project Management': <FolderOpen size={13} />,
  'Analytics': <BarChart3 size={13} />,
  'Payment Gateway': <CreditCard size={13} />,
  'Artificial Intelligence': <Cpu size={13} />,
  'Marketing': <Zap size={13} />,
  'CRM': <Building2 size={13} />,
  'Security': <ShieldCheck size={13} />,
};

function catColor(category: string) {
  const map: Record<string, string> = {
    'Source Control': '#6366f1',
    'Cloud Infrastructure': '#f59e0b',
    'Hosting': '#06b6d4',
    'Domain and DNS': '#10b981',
    'Database': '#8b5cf6',
    'Email': '#ec4899',
    'Communication': '#3b82f6',
    'Design': '#f97316',
    'Project Management': '#14b8a6',
    'Payment Gateway': '#22c55e',
    'Artificial Intelligence': '#a78bfa',
    'Marketing': '#fb923c',
    'CRM': '#38bdf8',
    'Security': '#ef4444',
  };
  return map[category] || '#94a3b8';
}

/* ─── Sub-components ─────────────────────────────────────── */
function Badge({ label, color = '#6366f1', bg }: { label: string; color?: string; bg?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      background: bg || `${color}18`, color,
      fontSize: '0.65rem', fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

function TabButton({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.45rem 0.9rem',
      borderRadius: 8,
      border: 'none',
      background: active ? 'var(--accent)' : 'transparent',
      color: active ? '#fff' : 'var(--text-secondary)',
      fontSize: '0.78rem',
      fontWeight: active ? 600 : 500,
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 6,
      transition: 'all 150ms',
    }}>
      {label}
      {count !== undefined && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.25)' : 'var(--surface-sunken)',
          color: active ? '#fff' : 'var(--text-tertiary)',
          fontSize: '0.6rem', fontWeight: 700,
          padding: '1px 5px', borderRadius: 99,
        }}>{count}</span>
      )}
    </button>
  );
}

/* ─── Technology Directory Tab ───────────────────────────── */
function TechnologyDirectory({ user }: { user: any }) {
  const [catalogue, setCatalogue] = useState<Technology[]>([]);
  const [accounts, setAccounts] = useState<TechAccount[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<TechAccount | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [selectedTech, setSelectedTech] = useState<Technology | null>(null);
  const [revealedFields, setRevealedFields] = useState<Record<string, string>>({});
  const [accountSearch, setAccountSearch] = useState('');
  const [sortCol, setSortCol] = useState<string>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState<any>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [activeEnvTab, setActiveEnvTab] = useState<string>('');

  useEffect(() => {
    api.get('/technologies').then(r => setCatalogue(r.data || []));
    loadAccounts();
  }, []);

  const loadAccounts = () => {
    api.get('/technology-accounts').then(r => setAccounts(r.data?.items || r.data || []));
  };

  const categories = [...new Set(catalogue.map(t => t.category))].sort();

  const filtered = accounts.filter(a => {
    const q = (accountSearch || search).toLowerCase();
    const matchSearch = !q || a.accountName.toLowerCase().includes(q) || a.technology.name.toLowerCase().includes(q) || (a.accountIdentifier || '').toLowerCase().includes(q);
    const matchCat = !catFilter || a.technology.category === catFilter;
    return matchSearch && matchCat;
  }).sort((a: any, b: any) => {
    const va = a[sortCol] || '';
    const vb = b[sortCol] || '';
    return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  const revealField = async (fieldId: string) => {
    try {
      const { data } = await api.post(`/vault/fields/${fieldId}/reveal`);
      setRevealedFields(r => ({ ...r, [fieldId]: data.value || '(empty)' }));
      // Auto-hide after 30 seconds
      setTimeout(() => setRevealedFields(r => { const next = { ...r }; delete next[fieldId]; return next; }), 30000);
    } catch {
      alert('Access denied or no active grant for this field.');
    }
  };

  const createAccount = async () => {
    if (!selectedTech) return;
    setLoading(true);
    try {
      const { data: acct } = await api.post(`/technologies/${selectedTech.id}/accounts`, {
        accountName: newAccount.accountName,
        accountIdentifier: newAccount.accountIdentifier,
        ownerType: newAccount.ownerType || 'agency',
        subscriptionPlan: newAccount.subscriptionPlan,
        billingCycle: newAccount.billingCycle,
        billingAmount: newAccount.billingAmount ? parseFloat(newAccount.billingAmount) : undefined,
        isLifetime: newAccount.isLifetime || false,
        status: 'active',
      });
      // Create fields
      const fields = (selectedTech.fieldDefinitions || []).filter(fd => fieldValues[fd.fieldKey]);
      for (const fd of fields) {
        await api.post(`/technology-accounts/${acct.id}/fields`, {
          fieldKey: fd.fieldKey,
          fieldLabel: fd.fieldLabel,
          isSecret: fd.isSecret,
          value: fieldValues[fd.fieldKey],
        });
      }
      setShowAddForm(false);
      setNewAccount({});
      setFieldValues({});
      loadAccounts();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const headerStyle = {
    padding: '0.5rem 0.75rem',
    fontSize: '0.68rem',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--surface-sunken)',
    cursor: 'pointer',
    userSelect: 'none' as const,
  };

  const cellStyle = {
    padding: '0.65rem 0.75rem',
    fontSize: '0.78rem',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-subtle)',
    verticalAlign: 'top' as const,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filters row */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            value={accountSearch}
            onChange={e => setAccountSearch(e.target.value)}
            placeholder="Search technology accounts…"
            style={{
              width: '100%', padding: '0.45rem 0.75rem 0.45rem 2rem',
              borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: 'var(--surface-sunken)', color: 'var(--text-primary)',
              fontSize: '0.8rem',
            }}
          />
        </div>

        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          style={{
            padding: '0.45rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-subtle)',
            background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.78rem',
          }}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <button
          onClick={() => { setShowAddForm(true); setSelectedTech(null); setNewAccount({}); setFieldValues({}); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0.45rem 0.9rem', borderRadius: 8,
            background: 'var(--accent)', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
          }}
        >
          <Plus size={13} /> Add Technology
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {[
          { label: 'Total Accounts', value: accounts.length, color: '#6366f1' },
          { label: 'Active', value: accounts.filter(a => a.status === 'active').length, color: '#22c55e' },
          { label: 'Expiring (30d)', value: accounts.filter(a => a.nextBillingDate && new Date(a.nextBillingDate) < new Date(Date.now() + 30 * 86400000) && !a.isLifetime).length, color: '#f59e0b' },
          { label: '2FA Enabled', value: accounts.filter(a => a.twoFactorEnabled).length, color: '#06b6d4' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, padding: '0.75rem',
            background: 'var(--surface-card)', borderRadius: 10,
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Accounts table */}
      <div style={{ borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden', background: 'var(--surface-card)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { key: 'technology', label: 'Technology' },
                  { key: 'accountName', label: 'Account' },
                  { key: 'status', label: 'Status' },
                  { key: 'billingCycle', label: 'Billing' },
                  { key: 'nextBillingDate', label: 'Next Renewal' },
                  { key: 'projects', label: 'Projects' },
                  { key: 'twoFactor', label: '2FA' },
                  { key: '', label: '' },
                ].map(col => (
                  <th
                    key={col.key}
                    style={headerStyle}
                    onClick={() => {
                      if (!col.key) return;
                      if (sortCol === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortCol(col.key); setSortDir('asc'); }
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {col.label}
                      {sortCol === col.key && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ ...cellStyle, textAlign: 'center', color: 'var(--text-tertiary)', padding: '2rem' }}>No accounts found</td></tr>
              ) : filtered.map(acc => {
                const isExpiringSoon = !acc.isLifetime && acc.nextBillingDate && new Date(acc.nextBillingDate) < new Date(Date.now() + 30 * 86400000);
                return (
                  <tr key={acc.id} style={{ cursor: 'pointer', transition: 'background 100ms' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => {
                      setSelectedAccount(acc);
                      setActiveEnvTab(acc.environments[0]?.id || '');
                    }}
                  >
                    {/* Technology */}
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: `${catColor(acc.technology.category)}18`,
                          color: catColor(acc.technology.category),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {CAT_ICON[acc.technology.category] || <Globe size={13} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{acc.technology.name}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{acc.technology.category}</div>
                        </div>
                      </div>
                    </td>

                    {/* Account */}
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 500 }}>{acc.accountName}</div>
                      {acc.accountIdentifier && <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{acc.accountIdentifier}</div>}
                    </td>

                    {/* Status */}
                    <td style={cellStyle}>
                      <Badge
                        label={acc.subscriptionStatus === 'active' ? 'Active' : acc.subscriptionStatus}
                        color={acc.subscriptionStatus === 'active' ? '#22c55e' : acc.subscriptionStatus === 'expired' ? '#ef4444' : '#f59e0b'}
                      />
                    </td>

                    {/* Billing */}
                    <td style={cellStyle}>
                      {acc.isLifetime ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6366f1', fontWeight: 600, fontSize: '0.75rem' }}>
                          <Infinity size={13} /> Lifetime
                        </div>
                      ) : acc.billingCycle ? (
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{acc.billingCurrency || 'USD'} {acc.billingAmount?.toLocaleString() || '—'}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{acc.billingCycle}</div>
                        </div>
                      ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>

                    {/* Renewal */}
                    <td style={cellStyle}>
                      {acc.isLifetime ? <span style={{ color: 'var(--text-tertiary)' }}>N/A</span> :
                        acc.nextBillingDate ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {isExpiringSoon && <AlertTriangle size={11} style={{ color: '#f59e0b' }} />}
                            <span style={{ color: isExpiringSoon ? '#f59e0b' : 'var(--text-primary)', fontSize: '0.75rem' }}>
                              {new Date(acc.nextBillingDate).toLocaleDateString()}
                            </span>
                          </div>
                        ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>

                    {/* Projects */}
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {acc.projectLinks.slice(0, 2).map(pl => (
                          <Badge key={pl.project.id} label={pl.project.name} color="#6366f1" />
                        ))}
                        {acc.projectLinks.length > 2 && <Badge label={`+${acc.projectLinks.length - 2}`} color="#6366f1" />}
                        {acc.projectLinks.length === 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>None</span>}
                      </div>
                    </td>

                    {/* 2FA */}
                    <td style={cellStyle}>
                      {acc.twoFactorEnabled
                        ? <span style={{ color: '#22c55e', fontSize: '0.72rem', fontWeight: 600 }}>✓ ON</span>
                        : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>—</span>}
                    </td>

                    {/* Actions */}
                    <td style={cellStyle} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setSelectedAccount(acc);
                          setActiveEnvTab(acc.environments[0]?.id || '');
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.72rem', fontWeight: 600 }}
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Detail Slide-over */}
      {selectedAccount && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'flex-end',
        }} onClick={() => setSelectedAccount(null)}>
          <div
            style={{
              width: 560, height: '100%', overflowY: 'auto',
              background: 'var(--surface-card)',
              borderLeft: '1px solid var(--border-subtle)',
              padding: '1.5rem',
              animation: 'slideInRight 250ms ease',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${catColor(selectedAccount.technology.category)}18`,
                    color: catColor(selectedAccount.technology.category),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {CAT_ICON[selectedAccount.technology.category] || <Globe size={16} />}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedAccount.accountName}</h3>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{selectedAccount.technology.name} · {selectedAccount.technology.category}</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedAccount(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Status badges */}
            <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <Badge label={selectedAccount.subscriptionStatus} color={selectedAccount.subscriptionStatus === 'active' ? '#22c55e' : '#ef4444'} />
              {selectedAccount.isLifetime && <Badge label="Lifetime" color="#6366f1" />}
              {selectedAccount.twoFactorEnabled && <Badge label="2FA Active" color="#22c55e" />}
              <Badge label={selectedAccount.ownerType === 'agency' ? 'Agency-owned' : 'Client-owned'} color="#94a3b8" />
            </div>

            {/* Subscription info */}
            {(selectedAccount.billingCycle || selectedAccount.subscriptionPlan) && (
              <div style={{ background: 'var(--surface-sunken)', borderRadius: 10, padding: '0.85rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Subscription</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {selectedAccount.subscriptionPlan && <div><div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Plan</div><div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedAccount.subscriptionPlan}</div></div>}
                  {selectedAccount.billingCycle && <div><div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Billing Cycle</div><div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{selectedAccount.billingCycle}</div></div>}
                  {selectedAccount.billingAmount !== undefined && <div><div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Amount</div><div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedAccount.billingCurrency || 'USD'} {selectedAccount.billingAmount.toLocaleString()}</div></div>}
                  {selectedAccount.nextBillingDate && !selectedAccount.isLifetime && <div><div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Next Renewal</div><div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(selectedAccount.nextBillingDate).toLocaleDateString()}</div></div>}
                </div>
              </div>
            )}

            {/* Linked projects */}
            {selectedAccount.projectLinks.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Linked Projects</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedAccount.projectLinks.map(pl => (
                    <Badge key={pl.project.id} label={pl.project.name} color="#6366f1" />
                  ))}
                </div>
              </div>
            )}

            {/* Environments */}
            {selectedAccount.environments.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Environments</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {selectedAccount.environments.map(env => (
                    <button key={env.id} onClick={() => setActiveEnvTab(env.id)} style={{
                      padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: activeEnvTab === env.id ? 'var(--accent)' : 'var(--surface-sunken)',
                      color: activeEnvTab === env.id ? '#fff' : 'var(--text-secondary)',
                      fontSize: '0.72rem', fontWeight: 600,
                    }}>
                      {env.environmentName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Credential Fields */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Credentials</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedAccount.fields.filter(f => !activeEnvTab || f.environmentId === activeEnvTab || !f.environmentId).map(field => (
                  <div key={field.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.85rem',
                    background: 'var(--surface-sunken)', borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 2 }}>{field.fieldLabel}</div>
                      {field.isSecret ? (
                        revealedFields[field.id]
                          ? <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#22c55e', wordBreak: 'break-all' }}>{revealedFields[field.id]}</div>
                          : <div style={{ fontSize: '0.8rem', letterSpacing: 3, color: 'var(--text-tertiary)' }}>••••••••</div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{field.nonSecretValue || '—'}</div>
                      )}
                    </div>
                    {field.isSecret && (
                      <button
                        onClick={() => revealedFields[field.id] ? setRevealedFields(r => { const n = { ...r }; delete n[field.id]; return n; }) : revealField(field.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: revealedFields[field.id] ? '#ef4444' : 'var(--accent)',
                          display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 600, flexShrink: 0, marginLeft: 8,
                        }}
                      >
                        {revealedFields[field.id] ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Reveal</>}
                      </button>
                    )}
                  </div>
                ))}
                {selectedAccount.fields.length === 0 && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>
                    No credentials added yet
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {selectedAccount.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedAccount.tags.map(tag => <Badge key={tag} label={tag} color="#94a3b8" />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Technology Account Modal */}
      {showAddForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowAddForm(false)}>
          <div style={{ width: 540, maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface-base)', borderRadius: 16, padding: '1.5rem', border: '1px solid var(--border-subtle)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>Add Technology Account</h3>

            {/* Technology search */}
            {!selectedTech ? (
              <>
                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search technology (GitHub, AWS, Stripe…)"
                    style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
                  {catalogue.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase())).map(tech => (
                    <button key={tech.id} onClick={() => setSelectedTech(tech)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.85rem',
                      background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)',
                      borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      color: 'var(--text-primary)', transition: 'all 150ms',
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${catColor(tech.category)}18`, color: catColor(tech.category), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {CAT_ICON[tech.category] || <Globe size={13} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{tech.name}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{tech.category}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.85rem', background: 'var(--surface-sunken)', borderRadius: 8, marginBottom: '1rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${catColor(selectedTech.category)}18`, color: catColor(selectedTech.category), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {CAT_ICON[selectedTech.category] || <Globe size={13} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{selectedTech.name}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{selectedTech.category}</div>
                  </div>
                  <button onClick={() => { setSelectedTech(null); setFieldValues({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={14} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Account Name *</label>
                  <input value={newAccount.accountName || ''} onChange={e => setNewAccount((a: any) => ({ ...a, accountName: e.target.value }))} placeholder={`e.g. ${selectedTech.name} - Main`}
                    style={{ padding: '0.45rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Billing Cycle</label>
                    <select value={newAccount.billingCycle || ''} onChange={e => setNewAccount((a: any) => ({ ...a, billingCycle: e.target.value, isLifetime: e.target.value === 'lifetime' }))}
                      style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.78rem', marginTop: 4 }}>
                      <option value="">— None —</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="lifetime">Lifetime</option>
                      <option value="trial">Trial</option>
                      <option value="one_time">One-time</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Billing Amount</label>
                    <input value={newAccount.billingAmount || ''} onChange={e => setNewAccount((a: any) => ({ ...a, billingAmount: e.target.value }))} placeholder="0.00" type="number"
                      style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.78rem', marginTop: 4 }} />
                  </div>
                </div>

                {/* Technology field definitions */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Credentials <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(leave blank to add later)</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(selectedTech.fieldDefinitions || []).sort((a, b) => a.displayOrder - b.displayOrder).map(fd => (
                      <div key={fd.fieldKey}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                          {fd.fieldLabel} {fd.isRequired && <span style={{ color: '#ef4444' }}>*</span>}
                          {fd.isSecret && <Lock size={10} style={{ marginLeft: 4, color: '#f59e0b', verticalAlign: 'middle' }} />}
                        </label>
                        {fd.fieldType === 'textarea' ? (
                          <textarea value={fieldValues[fd.fieldKey] || ''} onChange={e => setFieldValues(v => ({ ...v, [fd.fieldKey]: e.target.value }))} rows={3}
                            style={{ width: '100%', padding: '0.4rem 0.7rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.78rem', resize: 'vertical', marginTop: 2, fontFamily: fd.isSecret ? 'monospace' : 'inherit' }} />
                        ) : (
                          <input
                            type={fd.fieldType === 'password' ? 'password' : fd.fieldType === 'boolean' ? 'checkbox' : 'text'}
                            value={fieldValues[fd.fieldKey] || ''}
                            onChange={e => setFieldValues(v => ({ ...v, [fd.fieldKey]: e.target.value }))}
                            style={{ width: '100%', padding: '0.4rem 0.7rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.78rem', marginTop: 2, fontFamily: fd.isSecret ? 'monospace' : 'inherit' }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowAddForm(false)} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                  <button onClick={createAccount} disabled={loading || !newAccount.accountName} style={{
                    padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
                    background: loading ? 'var(--surface-sunken)' : 'var(--accent)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600,
                  }}>
                    {loading ? 'Saving…' : 'Save Account'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Access Requests Tab ────────────────────────────────── */
function AccessRequestsTab({ user }: { user: any }) {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [selected, setSelected] = useState<AccessRequest | null>(null);
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(false);
  const isOwner = ['owner', 'admin'].includes(user?.role);

  const load = useCallback(() => {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    api.get(`/vault/field-access-requests${params}`).then(r => setRequests(r.data || []));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const approve = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const approvalList = selected.requestedFields.map(rf => ({
        fieldId: rf.accountFieldId,
        canReveal: approvals[rf.accountFieldId] !== false,
        canCopy: false,
        singleUse: false,
      }));
      await api.post(`/vault/field-access-requests/${selected.id}/approve`, { approvals: approvalList });
      setSelected(null);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const reject = async () => {
    if (!selected || !rejectReason) return;
    setLoading(true);
    try {
      await api.post(`/vault/field-access-requests/${selected.id}/reject`, { reason: rejectReason });
      setSelected(null);
      load();
    } finally {
      setLoading(false);
    }
  };

  const urgencyColor = (u: string) => ({ critical: '#ef4444', high: '#f59e0b', normal: '#6366f1' })[u] || '#6366f1';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filter row */}
      <div style={{ display: 'flex', gap: 8 }}>
        {['pending', 'approved', 'partial', 'rejected', 'revoked', ''].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '0.4rem 0.85rem', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: statusFilter === s ? 'var(--accent)' : 'var(--surface-sunken)',
            color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
            fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize',
          }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
          <Shield size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
          No {statusFilter} access requests
        </div>
      ) : requests.map(req => (
        <div key={req.id} style={{
          background: 'var(--surface-card)', borderRadius: 12,
          border: '1px solid var(--border-subtle)',
          padding: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Badge label={req.urgency} color={urgencyColor(req.urgency)} />
                <Badge
                  label={req.status}
                  color={req.status === 'approved' ? '#22c55e' : req.status === 'rejected' ? '#ef4444' : req.status === 'pending' ? '#f59e0b' : '#6366f1'}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{new Date(req.requestedAt).toLocaleDateString()}</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>
                {req.technologyAccount.technology.name} — {req.technologyAccount.accountName}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
                {req.requestReason}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {req.requestedFields.map(rf => (
                  <span key={rf.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 6,
                    background: rf.approved ? '#22c55e18' : 'var(--surface-sunken)',
                    color: rf.approved ? '#22c55e' : 'var(--text-secondary)',
                    fontSize: '0.68rem', fontWeight: 500,
                    border: '1px solid var(--border-subtle)',
                  }}>
                    {rf.approved ? <Check size={10} /> : <Lock size={10} />}
                    {rf.accountField?.fieldLabel || rf.accountFieldId}
                  </span>
                ))}
              </div>
            </div>
            {isOwner && req.status === 'pending' && (
              <button onClick={() => {
                setSelected(req);
                const initApprovals: Record<string, boolean> = {};
                req.requestedFields.forEach(f => { initApprovals[f.accountFieldId] = true; });
                setApprovals(initApprovals);
              }} style={{
                padding: '0.45rem 0.9rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
              }}>
                Review
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Review modal */}
      {selected && isOwner && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelected(null)}>
          <div style={{ width: 500, background: 'var(--surface-base)', borderRadius: 16, padding: '1.5rem', border: '1px solid var(--border-subtle)', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
              Review Access Request
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </h3>

            <div style={{ background: 'var(--surface-sunken)', borderRadius: 10, padding: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Reason</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{selected.requestReason}</div>
              {selected.taskReference && <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 6 }}>Task ref: {selected.taskReference}</div>}
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Approve / reject individual fields:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1rem' }}>
              {selected.requestedFields.map(rf => (
                <div key={rf.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--surface-sunken)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{rf.accountField?.fieldLabel}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{rf.accountField?.isSecret ? 'Secret field' : 'Non-secret'}</div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={approvals[rf.accountFieldId] !== false} onChange={e => setApprovals(a => ({ ...a, [rf.accountFieldId]: e.target.checked }))} />
                    <span style={{ fontSize: '0.72rem', color: approvals[rf.accountFieldId] !== false ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {approvals[rf.accountFieldId] !== false ? 'Approve' : 'Deny'}
                    </span>
                  </label>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Rejection reason (if rejecting)</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder="Reason for rejection…"
                style={{ padding: '0.45rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.78rem', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={reject} disabled={loading || !rejectReason} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                Reject
              </button>
              <button onClick={approve} disabled={loading} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                {loading ? 'Saving…' : 'Approve Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Employee Access Registry Tab ───────────────────────── */
function EmployeeRegistryTab() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Load all active grants via search
    api.get('/vault/field-access-requests?status=approved').then(r => {
      // Flatten requestedFields into individual grants for display
      const items: any[] = [];
      (r.data || []).forEach((req: any) => {
        (req.requestedFields || []).filter((rf: any) => rf.approved).forEach((rf: any) => {
          items.push({
            id: rf.id,
            employeeId: req.requesterId,
            projectId: req.projectId,
            technologyAccount: req.technologyAccount,
            accountField: rf.accountField,
            grantedAt: req.reviewedAt || req.requestedAt,
            expiresAt: req.expiresAt,
            status: req.status,
            canReveal: rf.canReveal,
            canCopy: rf.canCopy,
          });
        });
      });
      setGrants(items);
    });
  }, []);

  const filtered = grants.filter(g => {
    const q = search.toLowerCase();
    return !q || g.technologyAccount?.technology?.name?.toLowerCase().includes(q) || g.accountField?.fieldLabel?.toLowerCase().includes(q);
  });

  const cellStyle = { padding: '0.6rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' as const };

  const revokeGrant = async (grantId: string) => {
    if (!confirm('Revoke this access grant?')) return;
    try {
      await api.delete(`/employee-credential-grants/${grantId}`);
      setGrants(g => g.filter(x => x.id !== grantId));
    } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ position: 'relative', maxWidth: 340 }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee, technology…"
          style={{ width: '100%', padding: '0.45rem 0.75rem 0.45rem 2rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
      </div>

      <div style={{ borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden', background: 'var(--surface-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-sunken)' }}>
              {['Technology', 'Field', 'Environment', 'Granted', 'Expires', 'Reveal', 'Copy', 'Actions'].map(h => (
                <th key={h} style={{ padding: '0.5rem 0.75rem', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ ...cellStyle, textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>No active access grants</td></tr>
            ) : filtered.map(g => (
              <tr key={g.id} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 600 }}>{g.technologyAccount?.technology?.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{g.technologyAccount?.accountName}</div>
                </td>
                <td style={cellStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {g.accountField?.isSecret && <Lock size={11} style={{ color: '#f59e0b' }} />}
                    {g.accountField?.fieldLabel}
                  </div>
                </td>
                <td style={cellStyle}><span style={{ color: 'var(--text-tertiary)' }}>—</span></td>
                <td style={cellStyle}>{g.grantedAt ? new Date(g.grantedAt).toLocaleDateString() : '—'}</td>
                <td style={cellStyle}>
                  {g.expiresAt ? (
                    <span style={{ color: new Date(g.expiresAt) < new Date() ? '#ef4444' : '#f59e0b' }}>
                      {new Date(g.expiresAt).toLocaleDateString()}
                    </span>
                  ) : <Badge label="Permanent" color="#6366f1" />}
                </td>
                <td style={cellStyle}>{g.canReveal ? <span style={{ color: '#22c55e', fontWeight: 600 }}>✓</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>
                <td style={cellStyle}>{g.canCopy ? <span style={{ color: '#22c55e', fontWeight: 600 }}>✓</span> : <span style={{ color: '#ef4444' }}>✗</span>}</td>
                <td style={cellStyle}>
                  <button onClick={() => revokeGrant(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.7rem', fontWeight: 600 }}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Main Vault Page ────────────────────────────────────── */
export default function Vault() {
  const [tab, setTab] = useState<'directory' | 'requests' | 'registry' | 'rotation'>('directory');
  const [user, setUser] = useState<any>(null);
  const [requestCount, setRequestCount] = useState(0);
  const isOwner = ['owner', 'admin'].includes(user?.role);

  useEffect(() => {
    api.get('/auth/me').then(r => setUser(r.data));
    api.get('/vault/field-access-requests?status=pending').then(r => setRequestCount((r.data || []).length));
  }, []);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Technology Vault
            </h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              Intelligent credential and technology account directory
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-sunken)', padding: 4, borderRadius: 10, width: 'fit-content', marginTop: '1rem' }}>
          <TabButton label="Directory" active={tab === 'directory'} onClick={() => setTab('directory')} />
          {isOwner && <TabButton label="Access Requests" active={tab === 'requests'} onClick={() => setTab('requests')} count={requestCount} />}
          {isOwner && <TabButton label="Employee Registry" active={tab === 'registry'} onClick={() => setTab('registry')} />}
          <TabButton label="Rotation Queue" active={tab === 'rotation'} onClick={() => setTab('rotation')} />
        </div>
      </div>

      {tab === 'directory' && <TechnologyDirectory user={user} />}
      {tab === 'requests' && isOwner && <AccessRequestsTab user={user} />}
      {tab === 'registry' && isOwner && <EmployeeRegistryTab />}
      {tab === 'rotation' && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
          <RefreshCw size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
          Rotation queue management from the existing Vault module is shown here.
        </div>
      )}
    </div>
  );
}
