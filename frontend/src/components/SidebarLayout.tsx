import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FolderKanban, KeyRound,
  FileText, DollarSign, Menu, X, LogOut, Bell,
  Activity, BookOpen,
  ChevronRight,
} from 'lucide-react';

/* ─── Nav Structure ─────────────────────────────────────── */
const NAV_SECTIONS = [
  {
    label: 'Core',
    items: [
      { to: '/dashboard/overview',  icon: LayoutDashboard, label: 'Overview'     },
      { to: '/dashboard/clients',   icon: Users,           label: 'CRM'          },
      { to: '/dashboard/projects',  icon: FolderKanban,    label: 'Projects'     },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/dashboard/invoices',  icon: FileText,   label: 'Invoices'      },
      { to: '/dashboard/finance',   icon: BookOpen,   label: 'Finance'       },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/dashboard/vault',     icon: KeyRound,   label: 'Vault'         },
    ],
  },
];

/* ─── Pulse dot ─────────────────────────────────────────── */
function LiveDot() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 6, height: 6,
        borderRadius: '50%',
        background: 'var(--success)',
        boxShadow: '0 0 0 0 rgba(18,183,106,0.5)',
        animation: 'rt-pulse 2s infinite',
      }}
    />
  );
}

/* ─── Clock ─────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
      {time}
    </span>
  );
}

export default function SidebarLayout() {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  /* derive page title from pathname */
  const segment = location.pathname.split('/').filter(Boolean)[1];
  const pageTitle = segment
    ? segment.charAt(0).toUpperCase() + segment.slice(1)
    : 'Overview';

  function handleLogout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface-body)' }}>

      {/* ── Sidebar ────────────────────────────────────── */}
      <aside
        style={{
          width: open ? 'var(--sidebar-width)' : '60px',
          minWidth: open ? 'var(--sidebar-width)' : '60px',
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          zIndex: 50,
          flexShrink: 0,
        }}
      >
        {/* Logo bar */}
        <div style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          padding: '0 1rem',
          borderBottom: '1px solid var(--border-subtle)',
          gap: '0.625rem',
          flexShrink: 0,
        }}>
          {/* Logo mark */}
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(79,111,232,0.35)',
          }}>
            <DollarSign size={16} color="#fff" />
          </div>
          {open && (
            <span style={{
              fontSize: '0.95rem', fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}>
              Suite
            </span>
          )}
        </div>

        {/* Nav sections */}
        <nav style={{ flex: 1, padding: '0.75rem 0.625rem', overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} style={{ marginBottom: '1.5rem' }}>
              {open && (
                <p style={{
                  fontSize: '0.65rem', fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                  padding: '0 0.5rem', marginBottom: '0.375rem',
                }}>
                  {section.label}
                </p>
              )}
              {section.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/dashboard/overview'}
                  className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
                  title={!open ? label : undefined}
                  style={{
                    justifyContent: open ? 'flex-start' : 'center',
                    marginBottom: 2,
                  }}
                >
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  {open && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer: realtime + collapse */}
        {open && (
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <LiveDot />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>Live</span>
            <div style={{ flex: 1 }} />
            <LiveClock />
          </div>
        )}
      </aside>

      {/* ── Main column ────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          height: 60,
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '0 1.5rem',
          background: 'var(--surface-card)',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          position: 'sticky', top: 0, zIndex: 40,
        }}>
          {/* Hamburger */}
          <button
            onClick={() => setOpen(!open)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, border: '1px solid var(--border-subtle)',
              borderRadius: 8, background: 'transparent', cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'background 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {open ? <X size={14} /> : <Menu size={14} />}
          </button>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>Suite</span>
            <ChevronRight size={12} color="var(--text-tertiary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{pageTitle}</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Notification bell */}
            <button
              style={{
                width: 36, height: 36, borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-secondary)',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Bell size={15} />
            </button>

            {/* User avatar + logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                flexShrink: 0,
              }}>
                A
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Admin</span>
            </div>

            <button
              onClick={handleLogout}
              title="Logout"
              style={{
                width: 34, height: 34, borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-tertiary)',
                transition: 'background 150ms, color 150ms',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--error-bg)';
                e.currentTarget.style.color = 'var(--error)';
                e.currentTarget.style.borderColor = 'rgba(240,68,56,0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '1.75rem 2rem', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
