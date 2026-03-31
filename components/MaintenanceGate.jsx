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
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="rounded-2xl border border-yellow-500/40 bg-gradient-to-b from-gray-800 to-gray-900 px-6 py-5 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-yellow-300">
              Loading KFlix...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (maintenance.enabled && !isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-2xl rounded-2xl border-[1.5px] border-yellow-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="border-b border-yellow-500/25 bg-yellow-500/10 px-6 py-4">
              <h1 className="text-xl font-semibold uppercase tracking-[0.16em] text-yellow-300 sm:text-2xl">
                KFlix Maintenance
              </h1>
            </div>

            <div className="px-6 py-8 text-center">
              <p className="text-base text-gray-100 sm:text-lg">
                {maintenance.message}
              </p>
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
        <div className="pointer-events-none fixed bottom-4 right-4 z-[9999]">
          <div className="pointer-events-auto overflow-hidden rounded-2xl border border-yellow-500/40 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="border-b border-yellow-500/25 bg-yellow-500/10 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-300">
                Maintenance Active
              </p>
            </div>

            <div className="space-y-3 px-4 py-4">
              <p className="max-w-[260px] text-sm text-gray-200">
                Maintenance mode is currently enabled. Regular users are locked out.
              </p>

              <button
                type="button"
                onClick={handleDisableMaintenance}
                disabled={disabling}
                className="flex h-10 w-full items-center justify-center rounded-md bg-yellow-500/80 px-4 text-sm font-semibold text-black transition active:scale-95 hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-70"
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