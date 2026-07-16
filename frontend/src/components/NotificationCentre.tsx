import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck, KeyRound, CreditCard, AlertTriangle, MessageSquare, Clock, Zap } from 'lucide-react';
import { api } from '../lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  credential_request: <KeyRound size={14} />,
  credential_approved: <Check size={14} />,
  credential_expiring: <AlertTriangle size={14} />,
  subscription_expiring: <CreditCard size={14} />,
  discount_pending: <Zap size={14} />,
  dispatch_ready: <MessageSquare size={14} />,
  action_assigned: <Clock size={14} />,
  invoice_overdue: <CreditCard size={14} />,
  rotation_due: <AlertTriangle size={14} />,
};

const TYPE_COLOR: Record<string, string> = {
  credential_request: '#6366f1',
  credential_approved: '#22c55e',
  credential_expiring: '#f59e0b',
  subscription_expiring: '#f59e0b',
  discount_pending: '#8b5cf6',
  dispatch_ready: '#06b6d4',
  action_assigned: '#3b82f6',
  invoice_overdue: '#ef4444',
  rotation_due: '#ef4444',
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function NotificationCentre() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data || []);
      setUnread((data || []).filter((n: Notification) => !n.read).length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
      setUnread(c => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(n => n.map(x => ({ ...x, read: true })));
      setUnread(0);
    } catch {}
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{
          position: 'relative',
          width: 34, height: 34, borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          background: open ? 'var(--surface-sunken)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-secondary)',
          transition: 'background 150ms',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
        onMouseLeave={e => (e.currentTarget.style.background = open ? 'var(--surface-sunken)' : 'transparent')}
      >
        <Bell size={15} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 14, height: 14, borderRadius: '50%',
            background: '#ef4444', color: '#fff',
            fontSize: '0.58rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Slide-over panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 380, maxHeight: 520, overflowY: 'auto',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          zIndex: 1000,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-subtle)',
            position: 'sticky', top: 0, background: 'var(--surface-card)', zIndex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Notifications
              </span>
              {unread > 0 && (
                <span style={{
                  background: '#ef4444', color: '#fff',
                  fontSize: '0.65rem', fontWeight: 700,
                  padding: '1px 6px', borderRadius: 99,
                }}>
                  {unread} new
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    fontSize: '0.7rem', color: 'var(--accent)', background: 'none',
                    border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 6px',
                    borderRadius: 6,
                  }}
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          {notifications.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
              <Bell size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
              No notifications yet
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: n.read ? 'default' : 'pointer',
                  background: n.read ? 'transparent' : 'rgba(99,102,241,0.04)',
                  transition: 'background 150ms',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
                onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(99,102,241,0.04)')}
              >
                {/* Icon */}
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: `${TYPE_COLOR[n.type] || '#6366f1'}15`,
                  color: TYPE_COLOR[n.type] || '#6366f1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {TYPE_ICON[n.type] || <Bell size={14} />}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: n.read ? 500 : 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {timeAgo(n.createdAt)}
                  </div>
                </div>

                {/* Unread dot */}
                {!n.read && (
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--accent)', flexShrink: 0, marginTop: 4,
                  }} />
                )}
              </div>
            ))
          )}

          {notifications.length > 0 && (
            <div style={{ padding: '0.6rem 1rem', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                {notifications.length} total notification{notifications.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
