import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { KeyRound, Mail, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail]               = useState('admin@agency.com');
  const [password, setPassword]         = useState('adminpassword123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('agency_jwt_token')) navigate('/dashboard/overview');
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('agency_jwt_token', data.accessToken);
      navigate('/dashboard/overview');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally { setLoading(false); }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--surface-body)', position: 'relative', overflow: 'hidden' }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(79,111,232,0.10), transparent)' }}
      />

      <div
        className="relative w-full max-w-md z-10"
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '2.5rem',
        }}
      >
        {/* Logo mark */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl"
            style={{ background: 'var(--accent)', boxShadow: '0 4px 14px rgba(79,111,232,0.3)' }}
          >
            <KeyRound className="h-6 w-6" style={{ color: '#fff' }} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Agency Suite
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Sign in to access your command center
            </p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="flex items-center gap-2 text-sm p-3 rounded-md mb-5"
            style={{
              background: 'var(--error-bg)',
              border: '1px solid rgba(240,68,56,0.3)',
              color: 'var(--error)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="t-label">Email Address</label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                style={{ color: 'var(--text-tertiary)' }}
              />
              <input
                type="email"
                autoComplete="email"
                placeholder="admin@agency.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="t-input w-full pl-9 pr-4 py-2.5 text-sm"
                style={{ borderRadius: 'var(--radius-sm)' }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="t-label">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="t-input w-full px-4 pr-10 py-2.5 text-sm"
                style={{ borderRadius: 'var(--radius-sm)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6"
                style={{ color: 'var(--text-tertiary)' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Demo credential hint */}
          <div
            className="text-xs p-2.5 rounded-md"
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(79,111,232,0.2)',
            }}
          >
            <span className="font-semibold" style={{ color: 'var(--accent)' }}>Demo credentials</span> are pre-filled — just click Sign In.
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="t-btn-primary w-full flex items-center justify-center gap-2"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authenticating…</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
