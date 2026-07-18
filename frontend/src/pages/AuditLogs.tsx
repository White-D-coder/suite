import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Loader2, ShieldAlert, Search, Info, Terminal } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  } | null;
}

export default function AuditLogs() {
  const [search, setSearch] = useState('');

  const { data: logs, isLoading, error } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs-list'],
    queryFn: () => api.get('/audit-logs').then(r => r.data),
  });

  const filtered = logs?.filter(log => {
    const q = search.toLowerCase();
    return log.action.toLowerCase().includes(q) ||
      (log.user?.name || 'system').toLowerCase().includes(q) ||
      (log.user?.email || '').toLowerCase().includes(q) ||
      (log.ipAddress && log.ipAddress.includes(q)) ||
      (log.details && log.details.toLowerCase().includes(q));
  }) ?? [];

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="t-empty py-20 text-center">
        <ShieldAlert size={40} className="text-red-400 mx-auto mb-2 animate-bounce" />
        <span className="text-sm font-semibold">Access Denied. Only Owner and Admin personas are authorized to inspect security logs.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div>
        <h1 className="t-page-title">Immutable Security Audit Trail</h1>
        <p className="t-page-subtitle">Append-only compliance logs tracing every high-risk secret access and authentication event.</p>
      </div>

      {/* Search filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
        <input
          className="t-input w-full pl-9 pr-4 py-2.5 text-xs"
          style={{ borderRadius: 'var(--radius-sm)' }}
          placeholder="Filter logs by operator name, action, or IP address..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Logs Table */}
      {filtered.length > 0 ? (
        <div className="t-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="t-table text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[var(--text-tertiary)] font-bold">
                  <th className="py-2">Timestamp</th>
                  <th className="py-2">Performed By (Persona)</th>
                  <th className="py-2">Action / Security Event</th>
                  <th className="py-2">IP Address</th>
                  <th className="py-2">User Agent Details</th>
                  <th className="py-2 text-right pr-4">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)]">
                    <td className="py-2.5 font-mono text-[var(--text-secondary)]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5">
                      <span className="font-bold text-[var(--text-primary)]">{log.user?.name || 'System'}</span>
                      {log.user ? (
                        <span className="text-[10px] text-[var(--text-tertiary)] block">{log.user.email} ({log.user.role.toUpperCase()})</span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-tertiary)] block">Automated background worker</span>
                      )}
                    </td>
                    <td className="py-2.5 font-semibold text-red-400">
                      <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-mono text-[10px]">
                        {log.action.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono">{log.ipAddress || '—'}</td>
                    <td className="py-2.5 text-[var(--text-tertiary)] truncate max-w-[200px]" title={log.userAgent}>
                      {log.userAgent || '—'}
                    </td>
                    <td className="py-2.5 text-right pr-4">
                      {log.details ? (
                        <button
                          onClick={() => alert(`Log details:\n${JSON.stringify(JSON.parse(log.details!), null, 2)}`)}
                          className="t-btn-ghost p-1 text-[10px] uppercase font-bold flex-inline items-center gap-1"
                        >
                          <Terminal size={11} /> View Meta
                        </button>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="t-empty">
          <ShieldAlert className="h-10 w-10 text-[var(--border-default)]" />
          <span className="text-sm font-semibold">No security events found matching query.</span>
        </div>
      )}
    </div>
  );
}
