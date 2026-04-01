'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  browserSessionPersistence,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { get, ref } from 'firebase/database';
import { app, db } from '@/lib/firebaseParty';

const ALLOWED_THEMES = ['lava', 'midnight', 'crimson', 'neon', 'noir'];

function isValidTheme(theme) {
  return ALLOWED_THEMES.includes(String(theme || ''));
}

function resolveStoredTheme() {
  if (typeof window === 'undefined') return 'noir';

  const candidates = [
    localStorage.getItem('kflix_theme'),
    localStorage.getItem('kflix_selected_theme'),
    localStorage.getItem('theme'),
    document.documentElement.getAttribute('data-theme'),
    document.documentElement.getAttribute('data-kflix-theme'),
  ];

  const found = candidates.find((value) => isValidTheme(value));
  return found || 'noir';
}

function applyTheme(theme, options = {}) {
  const { broadcast = true } = options;
  const nextTheme = isValidTheme(theme) ? theme : 'noir';

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', nextTheme);
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('kflix_theme', nextTheme);
      localStorage.setItem('kflix_selected_theme', nextTheme);
      localStorage.setItem('theme', nextTheme);
    } catch {}

    if (broadcast) {
      window.dispatchEvent(new Event('kflix-theme-updated'));
    }
  }

  return nextTheme;
}

function getThemeWithTimeout(uid, timeoutMs = 2000) {
  return Promise.race([
    get(ref(db, `users/${uid}/profile/theme`)),
    new Promise((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

export default function LoginPage() {
  const router = useRouter();
  const auth = useMemo(() => getAuth(app), []);

  const [themeId, setThemeId] = useState('noir');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const glassShellStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-panel-from) 82%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-panel-to) 92%, rgba(255,255,255,0.02)))',
    borderColor: 'color-mix(in srgb, var(--theme-accent-border) 74%, rgba(255,255,255,0.08))',
    boxShadow:
      '0 24px 56px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02)',
    backdropFilter: 'blur(24px) saturate(155%)',
    WebkitBackdropFilter: 'blur(24px) saturate(155%)',
  };

  const glassHeaderStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 90%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-accent-soft) 58%, transparent))',
    borderColor: 'color-mix(in srgb, var(--theme-accent-border-soft) 90%, rgba(255,255,255,0.05))',
  };

  const glassInputStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-muted-bg) 82%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-muted-bg-strong) 90%, rgba(255,255,255,0.02)))',
    borderColor: 'color-mix(in srgb, var(--theme-muted-border) 92%, rgba(255,255,255,0.06))',
    color: 'var(--theme-text)',
    boxShadow:
      '0 10px 22px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.07)',
    backdropFilter: 'blur(16px) saturate(145%)',
    WebkitBackdropFilter: 'blur(16px) saturate(145%)',
  };

  const glassButtonStyle = {
    borderColor: 'color-mix(in srgb, var(--theme-accent-border) 90%, rgba(255,255,255,0.06))',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 86%, rgba(255,255,255,0.12)), color-mix(in srgb, var(--theme-accent-hover) 90%, rgba(0,0,0,0.05)))',
    boxShadow:
      '0 14px 28px color-mix(in srgb, var(--theme-accent-glow) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.16)',
    color: 'var(--theme-accent-contrast)',
    backdropFilter: 'blur(16px) saturate(150%)',
    WebkitBackdropFilter: 'blur(16px) saturate(150%)',
  };

  const glassButtonDisabledStyle = {
    borderColor: 'color-mix(in srgb, var(--theme-accent-border) 55%, rgba(255,255,255,0.05))',
    background: 'var(--theme-accent-disabled-bg)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    color: 'var(--theme-accent-disabled-text)',
  };

  const errorStyle = {
    border: '1px solid var(--theme-accent-border)',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 92%, rgba(255,255,255,0.04)), color-mix(in srgb, var(--theme-accent-soft) 70%, transparent))',
    color: 'var(--theme-accent-text)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  };

  useEffect(() => {
    const syncThemeFromStorage = () => {
      const nextTheme = resolveStoredTheme();
      applyTheme(nextTheme, { broadcast: false });
      setThemeId(nextTheme);
    };

    syncThemeFromStorage();

    window.addEventListener('storage', syncThemeFromStorage);
    window.addEventListener('kflix-theme-updated', syncThemeFromStorage);

    return () => {
      window.removeEventListener('storage', syncThemeFromStorage);
      window.removeEventListener('kflix-theme-updated', syncThemeFromStorage);
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError('');
    setLoading(true);

    try {
      await setPersistence(auth, browserSessionPersistence);

      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      let resolvedTheme = resolveStoredTheme();

      try {
        const themeSnap = await getThemeWithTimeout(credential.user.uid, 2000);

        if (themeSnap && typeof themeSnap.exists === 'function' && themeSnap.exists()) {
          const profileTheme = String(themeSnap.val() || '');

          if (isValidTheme(profileTheme)) {
            resolvedTheme = profileTheme;
          }
        }
      } catch (themeError) {
        console.error('Failed to fetch theme after login:', themeError);
      }

      const applied = applyTheme(resolvedTheme, { broadcast: true });
      setThemeId(applied);

      router.replace('/');
    } catch (err) {
  console.warn('Login failed:', err);

  const code = typeof err?.code === 'string' ? err.code : '';

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    setError('Invalid email or password.');
  } else if (code === 'auth/too-many-requests') {
    setError('Too many attempts. Please wait a bit and try again.');
  } else if (code === 'auth/network-request-failed') {
    setError('Network error. Please check your connection.');
  } else {
    setError('Login failed. Please try again.');
  }

  setLoading(false);
}
  };

  return (
    <div
      className="min-h-screen overflow-hidden"
      style={{
        background: 'var(--theme-bg)',
        color: 'var(--theme-text)',
      }}
      data-theme-page={themeId}
    >
      <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px] sm:h-[420px] sm:w-[420px]"
            style={{ backgroundColor: 'var(--theme-accent-soft)' }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at top, color-mix(in srgb, var(--theme-accent-soft) 95%, transparent), transparent 35%)',
            }}
          />
        </div>

        <a
          href="/"
          className="absolute left-4 top-5 cursor-pointer leading-none sm:left-8 sm:top-8"
          style={{
            color: 'var(--theme-accent-text)',
            fontFamily: 'GeomGraphic, Arial, Helvetica, sans-serif',
            fontWeight: 700,
            fontStyle: 'italic',
            fontSize: 'clamp(1.5rem, 2.3vw, 2rem)',
            letterSpacing: '0.02em',
            textShadow:
              '0 2px 10px color-mix(in srgb, var(--theme-accent-glow) 28%, transparent)',
          }}
        >
          
        </a>

        <div
          className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border-[1.5px]"
          style={glassShellStyle}
        >
          <div className="border-b px-5 py-4 sm:px-6" style={glassHeaderStyle}>
            <h1
              className="text-base font-semibold uppercase tracking-[0.18em] sm:text-lg md:text-xl"
              style={{ color: 'var(--theme-accent-text)' }}
            >
              Login
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 px-5 py-6 sm:px-6">
            <div>
              <label
                className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] sm:text-xs"
                style={{ color: 'var(--theme-accent-text)' }}
              >
                Email
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border px-4 text-sm placeholder:text-gray-400 focus:outline-none"
                style={glassInputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--theme-accent-border)';
                  e.currentTarget.style.boxShadow =
                    '0 0 12px color-mix(in srgb, var(--theme-accent-glow) 42%, transparent), inset 0 1px 0 rgba(255,255,255,0.08)';
                }}
                onBlur={(e) => {
                  Object.assign(e.currentTarget.style, glassInputStyle);
                }}
                required
              />
            </div>

            <div>
              <label
                className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] sm:text-xs"
                style={{ color: 'var(--theme-accent-text)' }}
              >
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-xl border px-4 text-sm placeholder:text-gray-400 focus:outline-none"
                style={glassInputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--theme-accent-border)';
                  e.currentTarget.style.boxShadow =
                    '0 0 12px color-mix(in srgb, var(--theme-accent-glow) 42%, transparent), inset 0 1px 0 rgba(255,255,255,0.08)';
                }}
                onBlur={(e) => {
                  Object.assign(e.currentTarget.style, glassInputStyle);
                }}
                required
              />
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm" style={errorStyle}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-xl border text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-80"
              style={
                loading
                  ? { ...glassButtonStyle, ...glassButtonDisabledStyle }
                  : glassButtonStyle
              }
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.filter = 'brightness(1.05)';
                  e.currentTarget.style.boxShadow =
                    '0 16px 32px color-mix(in srgb, var(--theme-accent-glow) 46%, transparent), inset 0 1px 0 rgba(255,255,255,0.18)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none';
                Object.assign(
                  e.currentTarget.style,
                  loading
                    ? { ...glassButtonStyle, ...glassButtonDisabledStyle }
                    : glassButtonStyle
                );
              }}
            >
              {loading ? 'Logging In...' : 'Log In'}
            </button>

            <p
              className="pt-1 text-center text-sm leading-6"
              style={{ color: 'var(--theme-muted-text)' }}
            >
              Contact Ser Wallace to get your account set up.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}