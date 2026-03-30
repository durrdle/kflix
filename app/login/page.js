// app/login/page.js
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';

const THEME_STYLES = {
  lava: {
    accent: '#dc2626',
    accentText: '#f87171',
    border: 'rgba(239, 68, 68, 0.5)',
    borderSoft: 'rgba(239, 68, 68, 0.25)',
    panelGlow: '0 12px 35px rgba(0,0,0,0.55)',
    buttonGlow: 'rgba(239, 68, 68, 0.6)',
    orb: 'rgba(220, 38, 38, 0.12)',
    radial: 'rgba(239, 68, 68, 0.08)',
    focus: 'rgba(255, 0, 0, 0.25)',
  },
  midnight: {
    accent: '#2563eb',
    accentText: '#60a5fa',
    border: 'rgba(59, 130, 246, 0.45)',
    borderSoft: 'rgba(59, 130, 246, 0.22)',
    panelGlow: '0 12px 35px rgba(0,0,0,0.6)',
    buttonGlow: 'rgba(59, 130, 246, 0.55)',
    orb: 'rgba(37, 99, 235, 0.12)',
    radial: 'rgba(59, 130, 246, 0.08)',
    focus: 'rgba(59, 130, 246, 0.25)',
  },
  crimson: {
    accent: '#be123c',
    accentText: '#fb7185',
    border: 'rgba(244, 63, 94, 0.45)',
    borderSoft: 'rgba(244, 63, 94, 0.22)',
    panelGlow: '0 12px 35px rgba(0,0,0,0.6)',
    buttonGlow: 'rgba(244, 63, 94, 0.55)',
    orb: 'rgba(190, 18, 60, 0.12)',
    radial: 'rgba(244, 63, 94, 0.08)',
    focus: 'rgba(244, 63, 94, 0.25)',
  },
  neon: {
    accent: '#65a30d',
    accentText: '#a3e635',
    border: 'rgba(163, 230, 53, 0.45)',
    borderSoft: 'rgba(163, 230, 53, 0.22)',
    panelGlow: '0 12px 35px rgba(0,0,0,0.6)',
    buttonGlow: 'rgba(163, 230, 53, 0.55)',
    orb: 'rgba(101, 163, 13, 0.12)',
    radial: 'rgba(163, 230, 53, 0.08)',
    focus: 'rgba(163, 230, 53, 0.25)',
  },
};

function resolveStoredTheme() {
  if (typeof window === 'undefined') return 'lava';

  const candidates = [
    localStorage.getItem('kflix_theme'),
    localStorage.getItem('kflix_selected_theme'),
    localStorage.getItem('theme'),
    document.documentElement.getAttribute('data-kflix-theme'),
  ];

  const found = candidates.find((value) => value && THEME_STYLES[value]);
  return found || 'lava';
}

export default function LoginPage() {
  const [themeId, setThemeId] = useState('lava');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const syncTheme = () => {
      setThemeId(resolveStoredTheme());
    };

    syncTheme();
    window.addEventListener('storage', syncTheme);

    return () => {
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  const theme = useMemo(() => THEME_STYLES[themeId] || THEME_STYLES.lava, [themeId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch {
      setError('Invalid email or password.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-black text-white">
      <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px] sm:h-[420px] sm:w-[420px]"
            style={{ backgroundColor: theme.orb }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at top, ${theme.radial}, transparent 35%)`,
            }}
          />
        </div>

        <Link
          href="/"
          className="absolute left-4 top-5 text-2xl font-bold transition hover:scale-105 sm:left-8 sm:top-8 sm:text-3xl"
          style={{ color: theme.accent }}
        >
          KFlix
        </Link>

        <div
          className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border-[1.5px] bg-gradient-to-b from-gray-800 to-gray-900"
          style={{
            borderColor: theme.border,
            boxShadow: theme.panelGlow,
          }}
        >
          <div
            className="border-b px-5 py-4 sm:px-6"
            style={{
              borderColor: theme.borderSoft,
              backgroundColor: `${theme.accent}1a`,
            }}
          >
            <h1
              className="text-base font-semibold uppercase tracking-[0.18em] sm:text-lg md:text-xl"
              style={{ color: theme.accentText }}
            >
              Login
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 px-5 py-6 sm:px-6">
            <div>
              <label
                className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] sm:text-xs"
                style={{ color: theme.accentText }}
              >
                Email
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-md border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-gray-400 focus:outline-none"
                style={{
                  boxShadow: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = theme.border;
                  e.currentTarget.style.boxShadow = `0 0 10px ${theme.focus}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                required
              />
            </div>

            <div>
              <label
                className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] sm:text-xs"
                style={{ color: theme.accentText }}
              >
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-md border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-gray-400 focus:outline-none"
                style={{
                  boxShadow: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = theme.border;
                  e.currentTarget.style.boxShadow = `0 0 10px ${theme.focus}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                required
              />
            </div>

            {error && (
              <div
                className="rounded-md px-4 py-3 text-sm"
                style={{
                  border: `1px solid ${theme.borderSoft}`,
                  backgroundColor: `${theme.accent}1a`,
                  color: theme.accentText,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-md text-sm font-semibold text-white transition active:scale-95"
              style={{
                backgroundColor: loading ? `${theme.accent}b3` : theme.accent,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = `inset 0 0 12px ${theme.buttonGlow}`;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {loading ? 'Logging In...' : 'Log In'}
            </button>

            <p className="pt-1 text-center text-sm leading-6 text-gray-400">
              Contact Ser Wallace to get your account set up.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}