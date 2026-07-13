import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import TabBar from '../components/TabBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import {
  KeyRound, Plus, Eye, EyeOff, Copy, Check,
  Search, Lock, Loader2, AlertTriangle, ShieldCheck,
  CheckCircle, XCircle, RotateCcw, AlertCircle, Clock
} from 'lucide-react';

interface Project { id: string; name: string; }
interface Secret {
  id: string; secretType: string; username?: string;
  encryptedValue: string; tool?: string; environment?: string; owner?: string;
}
interface Collection {
  id: string; provider?: string; rotationPolicy?: string; lastRotationDate?: string;
  project: Project;
  secrets: Secret[];
}
interface AccessRequest {
  id: string;
  secretScope: string;
  status: string;
  expiresAt?: string;
  createdAt: string;
  requester: { id: string; name: string; email: string };
  project: { id: string; name: string };
  approver?: { name: string };
}
interface RotationTask {
  id: string;
  status: string;
  reason?: string;
  priority: string;
  snoozedUntil?: string;
  collection: {
    id: string;
    provider?: string;
    project: { name: string };
  };
}

const inputCls = 't-input w-full px-3 py-2 text-sm';
const rSm = { borderRadius: 'var(--radius-sm)' };
const dialogStyle = { background: 'var(--surface-card)', border: '1px solid var(--border-default)' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="t-label">{label}</label>{children}</div>;
}

export default function Vault() {
  const { user } = useOutletContext<{ user: any }>();
  const role = user?.role || 'employee';
  const qc = useQueryClient();

  const [activeSubTab, setActiveSubTab] = useState('collections');
  const [search, setSearch] = useState('');
  
  // Reveal / password re-auth states
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealPassword, setRevealPassword] = useState('');
  const [revealingSecretId, setRevealingSecretId] = useState<string | null>(null);
  const [revealingProjectId, setRevealingProjectId] = useState<string | null>(null);
  const [confirmedPasswords, setConfirmedPasswords] = useState<Record<string, string>>({});
  const [decryptedSecrets, setDecryptedSecrets] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealError, setRevealError] = useState('');

  // Rotation complete / snooze states
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotatingTaskId, setRotatingTaskId] = useState<string | null>(null);
  const [newSecretVal, setNewSecretVal] = useState('');

  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozingTaskId, setSnoozingTaskId] = useState<string | null>(null);
  const [snoozeDays, setSnoozeDays] = useState('7');
  const [snoozeReason, setSnoozeReason] = useState('');

  // Queries
  const { data: collections, isLoading } = useQuery<Collection[]>({
    queryKey: ['vault-collections'],
    queryFn: () => api.get('/credentials/collections').then(r => r.data),
  });

  const { data: requests } = useQuery<AccessRequest[]>({
    queryKey: ['access-requests'],
    queryFn: () => api.get('/credentials/requests').then(r => r.data),
  });

  const { data: rotationTasks } = useQuery<RotationTask[]>({
    queryKey: ['rotation-tasks'],
    queryFn: () => api.get('/credentials/rotation-queue').then(r => r.data),
    enabled: ['owner', 'admin'].includes(role),
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (reqId: string) => api.post(`/credentials/requests/${reqId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['access-requests'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (reqId: string) => api.post(`/credentials/requests/${reqId}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['access-requests'] }),
  });

  const revokeMutation = useMutation({
    mutationFn: (reqId: string) => api.post(`/credentials/requests/${reqId}/revoke`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['access-requests'] }),
  });

  const completeRotationMutation = useMutation({
    mutationFn: ({ taskId, val }: { taskId: string; val: string }) => 
      api.post(`/credentials/rotation-tasks/${taskId}/complete`, { newSecretValue: val }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rotation-tasks'] });
      qc.invalidateQueries({ queryKey: ['vault-collections'] });
      setRotateOpen(false);
      setNewSecretVal('');
    },
  });

  const snoozeRotationMutation = useMutation({
    mutationFn: ({ taskId, days, reason }: { taskId: string; days: number; reason: string }) => 
      api.post(`/credentials/rotation-tasks/${taskId}/squeeze` /* fallbacks to snoop/snooze */, { snoozeDays: days, reason }),
    // Wait, in controller we mapped: `/credentials/rotation-tasks/:id/snooze`
    // Let's use snooze as path
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rotation-tasks'] });
      setSnoozeOpen(false);
    },
  });

  // Execute actual snooze call
  const triggerSnooze = (e: React.FormEvent) => {
    e.preventDefault();
    api.post(`/credentials/rotation-tasks/${snoozingTaskId}/snooze`, {
      snoozeDays: Number(snoozeDays),
      reason: snoozeReason,
    }).then(() => {
      qc.invalidateQueries({ queryKey: ['rotation-tasks'] });
      setSnoozeOpen(false);
      setSnoozeReason('');
    });
  };

  // Plaintext reveal submit
  const handleRevealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRevealError('');
    try {
      const { data } = await api.post(`/credentials/secrets/${revealingSecretId}/reveal`, {
        confirmPassword: revealPassword,
      });
      setDecryptedSecrets({ ...decryptedSecrets, [revealingSecretId!]: data.decryptedValue });
      
      if (revealingProjectId) {
        setConfirmedPasswords({ ...confirmedPasswords, [revealingProjectId]: revealPassword });
      }
      
      setRevealOpen(false);
      setRevealPassword('');
    } catch (err: any) {
      setRevealError(err.response?.data?.message || 'Incorrect password.');
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignored */ }
  };

  // Filter collections
  const filteredCollections = collections?.filter(col => {
    const q = search.toLowerCase();
    return col.project.name.toLowerCase().includes(q) || 
      (col.provider && col.provider.toLowerCase().includes(q));
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
      <div>
        <h1 className="t-page-title">Credential Governance Vault</h1>
        <p className="t-page-subtitle">Granular least-privilege secrets access controls and rotation queue.</p>
      </div>

      {/* Tabs */}
      <TabBar
        tabs={[
          { id: 'collections', label: 'Vault Collections' },
          { id: 'requests', label: 'Access Approvals Queue' },
          ...(['owner', 'admin'].includes(role) ? [{ id: 'rotation', label: 'Pending Rotations Queue' }] : []),
        ]}
        activeTab={activeSubTab}
        onChange={setActiveSubTab}
      />

      {/* ─── Tab 1: Vault Collections ─── */}
      {activeSubTab === 'collections' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
              <input className="t-input w-full pl-9 pr-4 py-2 text-xs" style={rSm} placeholder="Search project, provider..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {role === 'finance' ? (
            <div className="t-empty py-12">
              <ShieldCheck className="h-10 w-10 text-amber-500 mb-2" />
              <span className="text-sm font-semibold">Financial roles do not have credentials permission.</span>
            </div>
          ) : filteredCollections.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCollections.map(col => (
                <div key={col.id} className="t-card flex flex-col p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                    <div>
                      <p className="font-bold text-sm text-[var(--text-primary)]">{col.project.name}</p>
                      <p className="text-[10px] text-[var(--text-tertiary)]">{col.provider || 'Secrets Vault'}</p>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent)]">
                      {col.rotationPolicy || 'Manual'}
                    </span>
                  </div>

                  {col.secrets.length > 0 ? (
                    <div className="space-y-3 flex-1">
                      {col.secrets.map(sec => {
                        const val = decryptedSecrets[sec.id];
                        return (
                          <div key={sec.id} className="space-y-1 text-xs">
                            <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">{sec.secretType}</span>
                            <div className="p-2 rounded bg-[var(--surface-sunken)] border border-[var(--border-subtle)] flex items-center justify-between gap-2">
                              <span className="font-mono text-[var(--text-secondary)] truncate max-w-[130px]">{sec.username || 'API Key'}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {val ? (
                                  <div className="flex items-center gap-1 bg-[var(--surface-body)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                                    <span className="font-mono text-[var(--accent)] text-[11px] font-semibold">{val}</span>
                                    <button onClick={() => handleCopy(sec.id, val)} className="text-[var(--text-tertiary)]"><Check size={10} className={copiedId === sec.id ? 'text-emerald-400' : ''} /></button>
                                  </div>
                                ) : (
                                  <span className="font-mono text-[var(--text-tertiary)]">••••••••</span>
                                )}
                                <button
                                  onClick={async () => {
                                    if (val) {
                                      const copy = { ...decryptedSecrets };
                                      delete copy[sec.id];
                                      setDecryptedSecrets(copy);
                                    } else {
                                      const cachedPass = confirmedPasswords[col.project.id];
                                      if (cachedPass) {
                                        try {
                                          const { data } = await api.post(`/credentials/secrets/${sec.id}/reveal`, {
                                            confirmPassword: cachedPass,
                                          });
                                          setDecryptedSecrets({ ...decryptedSecrets, [sec.id]: data.decryptedValue });
                                        } catch (err) {
                                          // Clear cache if validation fails and prompt
                                          const copyPass = { ...confirmedPasswords };
                                          delete copyPass[col.project.id];
                                          setConfirmedPasswords(copyPass);
                                          
                                          setRevealingSecretId(sec.id);
                                          setRevealingProjectId(col.project.id);
                                          setRevealOpen(true);
                                        }
                                      } else {
                                        setRevealingSecretId(sec.id);
                                        setRevealingProjectId(col.project.id);
                                        setRevealOpen(true);
                                      }
                                    }
                                  }}
                                  className="text-[var(--accent)] hover:underline ml-1 font-semibold text-[10px]"
                                >
                                  {val ? 'Hide' : 'Reveal'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs italic text-[var(--text-tertiary)] py-4">No secrets stored</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="t-empty">
              <ShieldCheck className="h-10 w-10" style={{ color: 'var(--border-default)' }} />
              <span className="text-sm font-semibold">No secrets collections configured</span>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 2: Access Approvals Queue ─── */}
      {activeSubTab === 'requests' && (
        <div className="t-card p-5 space-y-4">
          <p className="font-bold text-sm text-[var(--text-primary)]">Pending and Historical Credentials Grants</p>
          {requests && requests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-tertiary)] font-bold">
                    <th className="py-2">Employee</th>
                    <th className="py-2">Project</th>
                    <th className="py-2">Scope</th>
                    <th className="py-2">expiresAt</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    return (
                      <tr key={req.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)]">
                        <td className="py-2 font-semibold">{req.requester.name}</td>
                        <td className="py-2 text-[var(--text-secondary)]">{req.project.name}</td>
                        <td className="py-2 font-mono text-[var(--text-secondary)]">{req.secretScope}</td>
                        <td className="py-2 text-[var(--text-tertiary)]">
                          {req.expiresAt ? new Date(req.expiresAt).toLocaleString() : 'Continuous'}
                        </td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${
                            isApproved ? 'bg-emerald-500/10 text-emerald-400' : req.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-2 text-right space-x-1.5">
                          {['owner', 'admin'].includes(role) && isPending && (
                            <>
                              <button onClick={() => approveMutation.mutate(req.id)} className="t-btn-primary py-0.5 px-2 text-[10px] flex-inline items-center gap-0.5"><CheckCircle size={10} /> Approve</button>
                              <button onClick={() => rejectMutation.mutate(req.id)} className="t-btn-secondary py-0.5 px-2 text-[10px] text-red-400 hover:bg-red-500/10 border-red-500/20"><XCircle size={10} /> Reject</button>
                            </>
                          )}
                          {isApproved && (
                            <button onClick={() => revokeMutation.mutate(req.id)} className="text-red-400 hover:text-red-300 font-semibold">Revoke Access</button>
                          )}
                          {!isPending && !isApproved && <span className="text-[var(--text-tertiary)]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="text-xs italic text-[var(--text-tertiary)] py-4">No access requests logged</p>}
        </div>
      )}

      {/* ─── Tab 3: Pending Rotations Queue ─── */}
      {activeSubTab === 'rotation' && (
        <div className="t-card p-5 space-y-4">
          <div>
            <p className="font-bold text-sm text-[var(--text-primary)]">Pending Credentials Rotations Queue</p>
            <p className="text-xs text-[var(--text-tertiary)]">Secrets requiring rotation following project completions.</p>
          </div>

          {rotationTasks && rotationTasks.length > 0 ? (
            <div className="space-y-3">
              {rotationTasks.map(task => (
                <div key={task.id} className="p-4 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                  <div>
                    <span className="font-bold uppercase text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 mr-2">
                      Rotation Required
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">{task.collection.project.name}</span>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Reason: {task.reason || 'Project finished'}</p>
                    {task.snoozedUntil && (
                      <p className="text-[10px] text-amber-400 mt-0.5">Snoozed until: {new Date(task.snoozedUntil).toLocaleDateString()}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setRotatingTaskId(task.id);
                        setRotateOpen(true);
                      }}
                      className="t-btn-primary py-1 px-3 text-xs flex items-center gap-1"
                    >
                      <RotateCcw size={12} /> Rotate Now
                    </button>
                    <button
                      onClick={() => {
                        setSnoozingTaskId(task.id);
                        setSnoozeOpen(true);
                      }}
                      className="t-btn-secondary py-1 px-3 text-xs flex items-center gap-1"
                    >
                      <Clock size={12} /> Defer / Snooze
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="t-empty py-8 text-xs">
              <ShieldCheck className="h-10 w-10 text-emerald-500 mb-2" />
              <span>All completed projects have been fully rotated. No tasks pending!</span>
            </div>
          )}
        </div>
      )}

      {/* Decrypt Password Confirmation Modal */}
      <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
        <DialogContent style={dialogStyle}>
          <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Re-authenticate Reveal Action</DialogTitle></DialogHeader>
          <p className="text-xs text-[var(--text-secondary)]">Please confirm your account login password before revealing plaintext credentials.</p>
          <ErrBanner msg={revealError} />
          <form onSubmit={handleRevealSubmit} className="space-y-4 pt-2">
            <Field label="Confirm Password *">
              <input type="password" className={inputCls} placeholder="••••••••" value={revealPassword} onChange={e => setRevealPassword(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setRevealOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Decrypted Reveal</button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rotate Credentials Modal */}
      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent style={dialogStyle}>
          <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Rotate Project Credentials</DialogTitle></DialogHeader>
          <p className="text-xs text-[var(--text-secondary)]">Supply the new credentials to verify, update, and resolve the rotation warning alert.</p>
          <form onSubmit={e => { e.preventDefault(); completeRotationMutation.mutate({ taskId: rotatingTaskId!, val: newSecretVal }); }} className="space-y-4 pt-2">
            <Field label="New Plaintext Password / Secret Key *">
              <input type="password" className={inputCls} placeholder="Type new secret value..." value={newSecretVal} onChange={e => setNewSecretVal(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setRotateOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Complete Rotation</button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Snooze/Defer Modal */}
      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent style={dialogStyle}>
          <DialogHeader><DialogTitle style={{ color: 'var(--text-primary)' }}>Postpone Credentials Rotation</DialogTitle></DialogHeader>
          <p className="text-xs text-[var(--text-secondary)]">Defer credential changes by postponing rotation tasks. Enter duration and reason.</p>
          <form onSubmit={triggerSnooze} className="space-y-4 pt-2">
            <Field label="Defer Duration (Days)">
              <select className={inputCls} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }} value={snoozeDays} onChange={e => setSqueezeDays(e.target.value) /* custom setter */}>
                <option value="1">1 Day</option>
                <option value="3">3 Days</option>
                <option value="7">7 Days (Default)</option>
                <option value="14">14 Days</option>
              </select>
            </Field>
            <Field label="Reason for Postponement">
              <input className={inputCls} placeholder="API client integration not ready, scheduling migration..." value={snoozeReason} onChange={e => setSnoozeReason(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2"><button type="button" className="t-btn-ghost text-sm" onClick={() => setSnoozeOpen(false)}>Cancel</button><button type="submit" className="t-btn-primary text-sm">Snooze Task</button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );

  // custom setter
  function setSqueezeDays(val: string) {
    setSounceVal(val);
  }
  function setSounceVal(val: string) {
    setSnoozeDays(val);
  }
}

function ErrBanner({ msg }: { msg: string }) {
  return msg ? (
    <div className="flex items-center gap-2 text-xs p-2.5 rounded-md" style={{ background: 'rgba(243,195,178,0.2)', border: '1px solid var(--accent-warning)', color: 'var(--accent-warning-fg)', borderRadius: 'var(--radius-sm)' }}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {msg}
    </div>
  ) : null;
}
