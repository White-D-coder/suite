import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, CreditCard, Receipt, AlertTriangle,
  Globe, Loader2, Calendar, Activity, Users, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

interface Renewal {
  id: string; provider: string; serviceName: string;
  cost: number; billingCycle: string; renewalDate: string;
}
interface DashboardData {
  totalRevenue: number; totalUnpaid: number; monthlyExpenses: number;
  upcomingRenewals: Renewal[];
  revenueTrend: { month: string; revenue: number; expenses: number; profit: number }[];
}
interface MonitorData {
  id: string; url: string; lastStatus: string; project: { name: string };
}

/* ── KPI Card ─────────────────────────────────────────── */
function KpiCard({
  label, value, sub, trend, trendLabel, icon: Icon, iconBg, iconColor, onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="kpi-card hover:border-[var(--accent)]"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={e => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
        }
      }}
      onMouseLeave={e => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} color={iconColor} />
        </div>
        {trendLabel && trend && (
          <span className={trend === 'up' ? 't-trend-up' : trend === 'down' ? 't-trend-down' : 't-trend-neu'}>
            {trend === 'up' && <ArrowUpRight size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />}
            {trend === 'down' && <ArrowDownRight size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />}
            {' '}{trendLabel}
          </span>
        )}
      </div>
      <p style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>{label}</p>
      <p style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>{sub}</p>
      )}
    </div>
  );
}

/* ── Custom Tooltip ────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-sm)',
      boxShadow: 'var(--shadow-md)',
      padding: '0.625rem 0.875rem',
    }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ fontSize: '0.72rem', color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>${p.value?.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  );
};

export default function DashboardOverview() {
  const navigate = useNavigate();
  const { data: finance, isLoading: financeLoading } = useQuery<DashboardData>({
    queryKey: ['finance-dashboard'],
    queryFn: () => api.get('/finance/dashboard').then(r => r.data),
  });

  const { data: monitors, isLoading: monitorsLoading } = useQuery<MonitorData[]>({
    queryKey: ['monitors-list'],
    queryFn: async () => {
      const projects = await api.get('/projects').then(r => r.data);
      const all: MonitorData[] = [];
      projects.forEach((p: any) =>
        p.websiteMonitors?.forEach((m: any) => all.push({ ...m, project: { name: p.name } }))
      );
      return all;
    },
  });

  if (financeLoading || monitorsLoading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  const daysUntil = (date: string) =>
    Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

  const totalMonitors = monitors?.length ?? 0;
  const onlineMonitors = monitors?.filter(m => m.lastStatus === 'online').length ?? 0;
  const offlineMonitors = monitors?.filter(m => m.lastStatus === 'offline') ?? [];
  const uptime = totalMonitors > 0 ? Math.round((onlineMonitors / totalMonitors) * 100) : 100;

  const revenue = finance?.totalRevenue ?? 0;
  const unpaid  = finance?.totalUnpaid ?? 0;
  const expenses = finance?.monthlyExpenses ?? 0;

  const chartData = finance?.revenueTrend ?? [
    { month: 'Jan', revenue: 0, expenses: 0, profit: 0 },
    { month: 'Feb', revenue: 0, expenses: 0, profit: 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* ── Page Heading ─────────────────────────────── */}
      <div>
        <h1 className="t-page-title">Dashboard</h1>
        <p className="t-page-subtitle">
          Financial overview and infrastructure health at a glance.
        </p>
      </div>

      {/* ── Offline Alert ─────────────────────────────── */}
      {offlineMonitors.length > 0 && (
        <div className="t-alert-warning" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#93370D', marginBottom: 4 }}>
              {offlineMonitors.length} Service{offlineMonitors.length > 1 ? 's' : ''} Offline
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {offlineMonitors.map(mon => (
                <span key={mon.id} style={{
                  background: 'rgba(247,144,9,0.12)', borderRadius: 6,
                  padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, color: '#93370D',
                }}>
                  {mon.project.name} — {mon.url}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Grid ──────────────────────────────────── */}
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <KpiCard
          label="Total Revenue"
          value={`$${revenue.toLocaleString()}`}
          sub="Lifetime collected"
          trend="up"
          trendLabel="+12.4%"
          icon={TrendingUp}
          iconBg="rgba(18,183,106,0.1)"
          iconColor="var(--success)"
          onClick={() => navigate('/invoices')}
        />
        <KpiCard
          label="Unpaid Invoices"
          value={`$${unpaid.toLocaleString()}`}
          sub={`${finance?.upcomingRenewals?.length ?? 0} pending`}
          trend={unpaid > 0 ? 'down' : 'neutral'}
          trendLabel={unpaid > 0 ? 'Needs action' : 'All clear'}
          icon={Receipt}
          iconBg="rgba(240,68,56,0.1)"
          iconColor="var(--error)"
          onClick={() => navigate('/invoices')}
        />
        <KpiCard
          label="Monthly Expenses"
          value={`$${expenses.toLocaleString()}`}
          sub="This billing cycle"
          trend="neutral"
          trendLabel="Stable"
          icon={CreditCard}
          iconBg="rgba(247,144,9,0.1)"
          iconColor="var(--warning)"
          onClick={() => navigate('/finance')}
        />
        <KpiCard
          label="Infrastructure"
          value={`${uptime}%`}
          sub={`${onlineMonitors}/${totalMonitors} monitors up`}
          trend={uptime >= 99 ? 'up' : uptime >= 90 ? 'neutral' : 'down'}
          trendLabel={uptime >= 99 ? 'All healthy' : `${offlineMonitors.length} down`}
          icon={Activity}
          iconBg="rgba(79,111,232,0.1)"
          iconColor="var(--accent)"
          onClick={() => navigate('/projects')}
        />
      </div>

      {/* ── Charts Row ────────────────────────────────── */}
      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: '2fr 1fr' }}>

        {/* Revenue vs Expenses */}
        <div className="t-card" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Revenue vs Expenses
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
              Last 6 months cashflow trend
            </p>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4F6FE8" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4F6FE8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F04438" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#F04438" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px', color: 'var(--text-secondary)' }} />
                <Area name="Revenue"  type="monotone" dataKey="revenue"  stroke="#4F6FE8" strokeWidth={2} fill="url(#gRevenue)"  />
                <Area name="Expenses" type="monotone" dataKey="expenses" stroke="#F04438" strokeWidth={2} fill="url(#gExpenses)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming Renewals */}
        <div className="t-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Upcoming Renewals
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
              Subscriptions due in 30 days
            </p>
          </div>

          {finance?.upcomingRenewals && finance.upcomingRenewals.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', overflowY: 'auto', maxHeight: 220 }}>
              {finance.upcomingRenewals.map(ren => {
                const days = daysUntil(ren.renewalDate);
                const urgency = days <= 3 ? 'urgent' : days <= 7 ? 'warning' : 'safe';
                const color = urgency === 'urgent' ? 'var(--error)' : urgency === 'warning' ? 'var(--warning)' : 'var(--success)';
                const bg    = urgency === 'urgent' ? 'var(--error-bg)' : urgency === 'warning' ? 'var(--warning-bg)' : 'var(--success-bg)';
                return (
                  <div
                    key={ren.id}
                    onClick={() => navigate('/finance')}
                    className="hover:border-[var(--accent)] hover:bg-[var(--surface-card)] transition-colors duration-150 cursor-pointer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.625rem 0.75rem',
                      background: 'var(--surface-sunken)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: `3px solid ${color}`,
                      borderTop: '1px solid transparent',
                      borderRight: '1px solid transparent',
                      borderBottom: '1px solid transparent',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ren.serviceName}</p>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{ren.provider}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        ${ren.cost.toLocaleString()}
                      </p>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, color,
                        background: bg, borderRadius: 4, padding: '1px 5px',
                        display: 'inline-block', marginTop: 2,
                      }}>
                        {days}d left
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="t-empty" style={{ flex: 1, minHeight: 160 }}>
              <Globe size={24} style={{ color: 'var(--border-default)' }} />
              <span style={{ fontSize: '0.78rem' }}>No renewals due soon</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Profit Bar Chart ───────────────────────────── */}
      <div className="t-card" style={{ padding: '1.5rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            Monthly Profit
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
            Net profit after expenses per month
          </p>
        </div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar name="Profit" dataKey="profit" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
