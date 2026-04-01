'use client';

import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { onValue, ref, update } from 'firebase/database';
import { db } from '@/lib/firebaseParty';
import useAdmin from '@/hooks/useAdmin';

export default function MaintenanceGate({ children }) {
  const { isAdmin, adminReady } = useAdmin();
  const [ready, setReady] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [maintenance, setMaintenance] = useState({
    enabled: false,
    message: 'KFlix is currently undergoing maintenance.',
  });

  const glassPanelStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-panel-from) 82%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-panel-to) 92%, rgba(255,255,255,0.02)))',
    borderColor: 'color-mix(in srgb, var(--theme-accent-border) 74%, rgba(255,255,255,0.08))',
    boxShadow:
      '0 20px 46px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02)',
    backdropFilter: 'blur(22px) saturate(150%)',
    WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  };

  const glassSurfaceStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-muted-bg) 82%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-muted-bg-strong) 90%, rgba(255,255,255,0.02)))',
    borderColor: 'color-mix(in srgb, var(--theme-muted-border) 92%, rgba(255,255,255,0.06))',
    boxShadow:
      '0 12px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.07)',
    backdropFilter: 'blur(16px) saturate(145%)',
    WebkitBackdropFilter: 'blur(16px) saturate(145%)',
  };

  const glassAccentButtonStyle = {
    borderColor: 'color-mix(in srgb, var(--theme-accent-border) 90%, rgba(255,255,255,0.06))',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 86%, rgba(255,255,255,0.12)), color-mix(in srgb, var(--theme-accent-hover) 90%, rgba(0,0,0,0.05)))',
    boxShadow:
      '0 14px 28px color-mix(in srgb, var(--theme-accent-glow) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.16)',
    color: 'var(--theme-accent-contrast)',
    backdropFilter: 'blur(16px) saturate(150%)',
    WebkitBackdropFilter: 'blur(16px) saturate(150%)',
  };

  const glassGhostButtonStyle = {
    borderColor: 'color-mix(in srgb, var(--theme-muted-border) 92%, rgba(255,255,255,0.08))',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-muted-bg) 78%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-muted-bg-strong) 88%, rgba(255,255,255,0.02)))',
    boxShadow:
      '0 10px 20px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.08)',
    color: 'var(--theme-text)',
    backdropFilter: 'blur(16px) saturate(140%)',
    WebkitBackdropFilter: 'blur(16px) saturate(140%)',
  };

  const glassNoticeStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255,255,255,0.04)), color-mix(in srgb, var(--theme-accent-soft) 68%, transparent))',
    borderColor: 'var(--theme-accent-border)',
    color: 'var(--theme-accent-text)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  };

  useEffect(() => {
    const maintenanceRef = ref(db, 'siteSettings/maintenance');

    const unsubscribe = onValue(
      maintenanceRef,
      (snapshot) => {
        const value = snapshot.val() || {};

        setMaintenance({
          enabled: Boolean(value.enabled),
          message:
            typeof value.message === 'string' && value.message.trim()
              ? value.message
              : 'KFlix is currently undergoing maintenance.',
        });

        setReady(true);
      },
      () => {
        setMaintenance({
          enabled: false,
          message: 'KFlix is currently undergoing maintenance.',
        });
        setReady(true);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleDisableMaintenance = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser?.uid || !isAdmin) return;

    setDisabling(true);

    try {
      await update(ref(db, 'siteSettings/maintenance'), {
        enabled: false,
        enabledAt: Date.now(),
        enabledBy: currentUser.uid,
      });
    } catch (error) {
      console.error('Failed to disable maintenance mode:', error);
    } finally {
      setDisabling(false);
    }
  };

  if (!ready || !adminReady) {
    return (
      <div
        className="min-h-screen text-white"
        style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}
      >
        <div className="flex min-h-screen items-center justify-center px-4">
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl border-[1.5px]"
            style={glassPanelStyle}
          >
            <div
              className="border-b px-5 py-4"
              style={glassNoticeStyle}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full border"
                  style={{
                    borderColor: 'var(--theme-accent-border)',
                    background:
                      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-accent-soft) 70%, transparent))',
                    color: 'var(--theme-accent-text)',
                  }}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 6v6" />
                    <path d="M12 16h.01" />
                    <path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z" />
                  </svg>
                </div>

                <p
                  className="text-sm font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--theme-accent-text)' }}
                >
                  Loading KFlix
                </p>
              </div>
            </div>

            <div className="px-5 py-5">
              <div className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                <p className="text-sm text-gray-200">
                  Checking maintenance status...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (maintenance.enabled && !isAdmin) {
    return (
      <div
        className="min-h-screen text-white"
        style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}
      >
        <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
              style={{ backgroundColor: 'var(--theme-accent-soft)' }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at top, color-mix(in srgb, var(--theme-accent-soft) 85%, transparent), transparent 38%)',
              }}
            />
          </div>

          <div
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border-[1.5px]"
            style={glassPanelStyle}
          >
            <div
              className="border-b px-5 py-4 sm:px-6"
              style={glassNoticeStyle}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full border"
                  style={{
                    borderColor: 'var(--theme-accent-border)',
                    background:
                      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-accent-soft) 70%, transparent))',
                    color: 'var(--theme-accent-text)',
                  }}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>

                <div>
                  <h1
                    className="text-lg font-semibold uppercase tracking-[0.16em] sm:text-xl"
                    style={{ color: 'var(--theme-accent-text)' }}
                  >
                    KFlix Maintenance
                  </h1>
                  <p className="mt-1 text-sm text-gray-300">
                    We’ll be back shortly.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
              <div className="rounded-2xl border p-5 sm:p-6" style={glassSurfaceStyle}>
                <p className="text-base leading-7 text-gray-100 sm:text-lg sm:leading-8">
                  {maintenance.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}

      {maintenance.enabled && isAdmin && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] px-3 sm:px-0">
          <div
            className="pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-3xl border-[1.5px]"
            style={glassPanelStyle}
          >
            <div
              className="border-b px-4 py-3"
              style={glassNoticeStyle}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full border"
                  style={{
                    borderColor: 'var(--theme-accent-border)',
                    background:
                      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-accent-soft) 70%, transparent))',
                    color: 'var(--theme-accent-text)',
                  }}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>

                <p
                  className="text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--theme-accent-text)' }}
                >
                  Maintenance Active
                </p>
              </div>
            </div>

            <div className="space-y-3 px-4 py-4">
              <div className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                <p className="text-sm leading-6 text-gray-200">
                  Maintenance mode is currently enabled. Regular users are locked out.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDisableMaintenance}
                disabled={disabling}
                className={`flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition active:scale-95 ${
                  disabling ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                }`}
                style={glassAccentButtonStyle}
              >
                {disabling ? 'Disabling...' : 'Disable Maintenance Mode'}
              </button>

              <button
                type="button"
                disabled
                className="flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold opacity-80"
                style={glassGhostButtonStyle}
              >
                Admin Override Available
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}