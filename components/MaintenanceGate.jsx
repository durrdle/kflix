'use client';

import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { onValue, ref, update } from 'firebase/database';
import { db } from '@/lib/firebaseParty';
import useAdmin from '@/hooks/useAdmin';

export default function MaintenanceGate({ children }) {
  const { isAdmin, adminReady } = useAdmin();

  const [maintenanceReady, setMaintenanceReady] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [maintenance, setMaintenance] = useState({
    enabled: false,
    message: 'KFlix is currently undergoing maintenance.',
  });

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

        setMaintenanceReady(true);
      },
      () => {
        setMaintenance({
          enabled: false,
          message: 'KFlix is currently undergoing maintenance.',
        });
        setMaintenanceReady(true);
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

  if (!maintenanceReady) {
    return (
      <div
        className="min-h-screen overflow-hidden"
        style={{
          background: 'var(--theme-bg)',
          color: 'var(--theme-text)',
        }}
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

          <div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border-[1.5px]"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--theme-panel-from) 82%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-panel-to) 92%, rgba(255,255,255,0.02)))',
              borderColor:
                'color-mix(in srgb, var(--theme-accent-border) 74%, rgba(255,255,255,0.08))',
              boxShadow:
                '0 24px 56px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02)',
              backdropFilter: 'blur(24px) saturate(155%)',
              WebkitBackdropFilter: 'blur(24px) saturate(155%)',
            }}
          >
            <div
              className="border-b px-5 py-4 sm:px-6"
              style={{
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 90%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-accent-soft) 58%, transparent))',
                borderColor:
                  'color-mix(in srgb, var(--theme-accent-border-soft) 90%, rgba(255,255,255,0.05))',
              }}
            >
              <h1
                className="text-base font-semibold uppercase tracking-[0.18em] sm:text-lg md:text-xl"
                style={{ color: 'var(--theme-accent-text)' }}
              >
                Loading KFlix
              </h1>
            </div>

            <div className="px-5 py-6 sm:px-6">
              <p className="text-sm" style={{ color: 'var(--theme-muted-text)' }}>
                Checking maintenance status...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (maintenance.enabled) {
    if (!adminReady) {
      return (
        <div
          className="min-h-screen overflow-hidden"
          style={{
            background: 'var(--theme-bg)',
            color: 'var(--theme-text)',
          }}
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

            <div
              className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border-[1.5px]"
              style={{
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--theme-panel-from) 82%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-panel-to) 92%, rgba(255,255,255,0.02)))',
                borderColor:
                  'color-mix(in srgb, var(--theme-accent-border) 74%, rgba(255,255,255,0.08))',
                boxShadow:
                  '0 24px 56px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02)',
                backdropFilter: 'blur(24px) saturate(155%)',
                WebkitBackdropFilter: 'blur(24px) saturate(155%)',
              }}
            >
              <div
                className="border-b px-5 py-4 sm:px-6"
                style={{
                  background:
                    'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 90%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-accent-soft) 58%, transparent))',
                  borderColor:
                    'color-mix(in srgb, var(--theme-accent-border-soft) 90%, rgba(255,255,255,0.05))',
                }}
              >
                <h1
                  className="text-base font-semibold uppercase tracking-[0.18em] sm:text-lg md:text-xl"
                  style={{ color: 'var(--theme-accent-text)' }}
                >
                  Loading KFlix
                </h1>
              </div>

              <div className="px-5 py-6 sm:px-6">
                <p className="text-sm" style={{ color: 'var(--theme-muted-text)' }}>
                  Checking admin access...
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!isAdmin) {
      return (
        <div
          className="min-h-screen overflow-hidden"
          style={{
            background: 'var(--theme-bg)',
            color: 'var(--theme-text)',
          }}
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

            <div
              className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border-[1.5px]"
              style={{
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--theme-panel-from) 82%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-panel-to) 92%, rgba(255,255,255,0.02)))',
                borderColor:
                  'color-mix(in srgb, var(--theme-accent-border) 74%, rgba(255,255,255,0.08))',
                boxShadow:
                  '0 24px 56px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02)',
                backdropFilter: 'blur(24px) saturate(155%)',
                WebkitBackdropFilter: 'blur(24px) saturate(155%)',
              }}
            >
              <div
                className="border-b px-6 py-4"
                style={{
                  background:
                    'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 90%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-accent-soft) 58%, transparent))',
                  borderColor:
                    'color-mix(in srgb, var(--theme-accent-border-soft) 90%, rgba(255,255,255,0.05))',
                }}
              >
                <h1
                  className="text-xl font-semibold uppercase tracking-[0.16em] sm:text-2xl"
                  style={{ color: 'var(--theme-accent-text)' }}
                >
                  KFlix Maintenance
                </h1>
              </div>

              <div className="px-6 py-8 text-center">
                <p className="text-base sm:text-lg" style={{ color: 'var(--theme-text)' }}>
                  {maintenance.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <>
      {children}

      {maintenance.enabled && isAdmin && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[9999]">
          <div
            className="pointer-events-auto overflow-hidden rounded-3xl border-[1.5px]"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--theme-panel-from) 82%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-panel-to) 92%, rgba(255,255,255,0.02)))',
              borderColor:
                'color-mix(in srgb, var(--theme-accent-border) 74%, rgba(255,255,255,0.08))',
              boxShadow:
                '0 24px 56px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02)',
              backdropFilter: 'blur(24px) saturate(155%)',
              WebkitBackdropFilter: 'blur(24px) saturate(155%)',
            }}
          >
            <div
              className="border-b px-4 py-3"
              style={{
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 90%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-accent-soft) 58%, transparent))',
                borderColor:
                  'color-mix(in srgb, var(--theme-accent-border-soft) 90%, rgba(255,255,255,0.05))',
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--theme-accent-text)' }}
              >
                Maintenance Active
              </p>
            </div>

            <div className="space-y-3 px-4 py-4">
              <p
                className="max-w-[260px] text-sm"
                style={{ color: 'var(--theme-text)' }}
              >
                Maintenance mode is currently enabled. Regular users are locked out.
              </p>

              <button
                type="button"
                onClick={handleDisableMaintenance}
                disabled={disabling}
                className="flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  borderColor:
                    'color-mix(in srgb, var(--theme-accent-border) 90%, rgba(255,255,255,0.06))',
                  background:
                    'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 86%, rgba(255,255,255,0.12)), color-mix(in srgb, var(--theme-accent-hover) 90%, rgba(0,0,0,0.05)))',
                  boxShadow:
                    '0 14px 28px color-mix(in srgb, var(--theme-accent-glow) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.16)',
                  color: 'var(--theme-accent-contrast)',
                  backdropFilter: 'blur(16px) saturate(150%)',
                  WebkitBackdropFilter: 'blur(16px) saturate(150%)',
                }}
              >
                {disabling ? 'Disabling...' : 'Disable Maintenance Mode'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}