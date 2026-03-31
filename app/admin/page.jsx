'use client';

import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { onValue, ref, update } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { db } from '@/lib/firebaseParty';
import useAdmin from '@/hooks/useAdmin';

function formatTime(timestamp) {
  if (!timestamp) return 'Never';
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return 'Unknown';
  }
}

function maskText(value) {
  const text = String(value || '');
  if (!text) return 'Hidden';
  return '•'.repeat(Math.max(12, text.length));
}

export default function AdminPage() {
  const { isAdmin, adminReady } = useAdmin();

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    'KFlix is currently undergoing maintenance.'
  );
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  const [presenceMap, setPresenceMap] = useState({});
  const [maintenanceMeta, setMaintenanceMeta] = useState({
    enabledAt: 0,
    enabledBy: '',
  });

  const [revealedUsers, setRevealedUsers] = useState({});

  useEffect(() => {
    const maintenanceRef = ref(db, 'siteSettings/maintenance');

    const unsubscribe = onValue(
      maintenanceRef,
      (snapshot) => {
        const value = snapshot.val() || {};

        setMaintenanceEnabled(Boolean(value.enabled));
        setMaintenanceMessage(
          typeof value.message === 'string' && value.message.trim()
            ? value.message
            : 'KFlix is currently undergoing maintenance.'
        );

        setMaintenanceMeta({
          enabledAt: Number(value.enabledAt || 0),
          enabledBy: value.enabledBy || '',
        });
      },
      () => {
        setMaintenanceEnabled(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const presenceRef = ref(db, 'presence');

    const unsubscribe = onValue(
      presenceRef,
      (snapshot) => {
        setPresenceMap(snapshot.val() || {});
      },
      () => {
        setPresenceMap({});
      }
    );

    return () => unsubscribe();
  }, []);

  const onlineUsers = useMemo(() => {
    return Object.values(presenceMap || {})
      .filter((entry) => entry?.online)
      .sort((a, b) => (b?.lastActive || 0) - (a?.lastActive || 0));
  }, [presenceMap]);

  const saveMaintenanceState = async (enabled) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) return;

    setSavingMaintenance(true);

    try {
      await update(ref(db, 'siteSettings/maintenance'), {
        enabled,
        message:
          maintenanceMessage.trim() || 'KFlix is currently undergoing maintenance.',
        enabledAt: Date.now(),
        enabledBy: currentUser.uid,
      });
    } catch (error) {
      console.error('Failed to update maintenance mode:', error);
    } finally {
      setSavingMaintenance(false);
    }
  };

  const toggleRevealUser = (uid) => {
    setRevealedUsers((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  if (!adminReady) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <section className="px-3 pt-20 sm:px-4 sm:pt-24 lg:px-8">
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-yellow-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="border-b border-yellow-500/25 bg-yellow-500/10 px-4 py-4 sm:px-6">
              <h1 className="text-xl font-semibold uppercase tracking-[0.16em] text-yellow-300 sm:text-2xl">
                KFlix Admin
              </h1>
            </div>

            <div className="px-4 py-6 sm:px-6">
              <p className="text-sm text-gray-300">Loading admin panel...</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white">
        <section className="px-3 pt-20 sm:px-4 sm:pt-24 lg:px-8">
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-yellow-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="border-b border-yellow-500/25 bg-yellow-500/10 px-4 py-4 sm:px-6">
              <h1 className="text-xl font-semibold uppercase tracking-[0.16em] text-yellow-300 sm:text-2xl">
                Access Denied
              </h1>
            </div>

            <div className="px-4 py-6 sm:px-6">
              <p className="text-sm text-gray-300">
                You do not have permission to view this page.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="space-y-6 px-3 pt-20 pb-8 sm:px-4 sm:pt-24 lg:px-8">
        <div className="overflow-hidden rounded-2xl border-[1.5px] border-yellow-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          <div className="border-b border-yellow-500/25 bg-yellow-500/10 px-4 py-4 sm:px-6">
            <h1 className="text-xl font-semibold uppercase tracking-[0.16em] text-yellow-300 sm:text-2xl">
              KFlix Admin Panel
            </h1>
          </div>

          <div className="grid gap-4 px-4 py-5 sm:px-6 md:grid-cols-3">
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-300/80">
                Maintenance
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  maintenanceEnabled ? 'text-yellow-300' : 'text-green-400'
                }`}
              >
                {maintenanceEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>

            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-300/80">
                Online Users
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {onlineUsers.length}
              </p>
            </div>

            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-300/80">
                Last Maintenance Update
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                {formatTime(maintenanceMeta.enabledAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-yellow-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="border-b border-yellow-500/25 bg-yellow-500/10 px-4 py-4 sm:px-6">
              <h2 className="text-lg font-semibold uppercase tracking-[0.16em] text-yellow-300">
                Maintenance Mode
              </h2>
            </div>

            <div className="space-y-4 px-4 py-5 sm:px-6">
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <p className="text-sm text-gray-200">
                  When enabled, all regular users are forced onto the KFlix
                  maintenance page. Admins still bypass it so they can turn it off.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-yellow-300">
                  Maintenance Message
                </label>
                <textarea
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-yellow-500/20 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
                  placeholder="KFlix is currently undergoing maintenance."
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => saveMaintenanceState(true)}
                  disabled={savingMaintenance}
                  className="flex h-11 items-center justify-center rounded-md bg-yellow-500/80 px-5 text-sm font-semibold text-black transition active:scale-95 hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingMaintenance ? 'Saving...' : 'Enable Maintenance'}
                </button>

                <button
                  type="button"
                  onClick={() => saveMaintenanceState(false)}
                  disabled={savingMaintenance}
                  className="flex h-11 items-center justify-center rounded-md border border-yellow-500/30 bg-yellow-500/10 px-5 text-sm font-semibold text-yellow-200 transition active:scale-95 hover:bg-yellow-500/15 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingMaintenance ? 'Saving...' : 'Disable Maintenance'}
                </button>
              </div>

              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm text-gray-200">
                <p>
                  <span className="text-white">Current state:</span>{' '}
                  {maintenanceEnabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="mt-2 break-all">
                  <span className="text-white">Last updated by UID:</span>{' '}
                  {maintenanceMeta.enabledBy || 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border-[1.5px] border-yellow-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="border-b border-yellow-500/25 bg-yellow-500/10 px-4 py-4 sm:px-6">
              <h2 className="text-lg font-semibold uppercase tracking-[0.16em] text-yellow-300">
                Online Users
              </h2>
            </div>

            <div className="max-h-[620px] space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
              {onlineUsers.length === 0 ? (
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                  <p className="text-sm text-gray-400">
                    No tracked online users yet.
                  </p>
                </div>
              ) : (
                onlineUsers.map((entry, index) => {
                  const userUid = entry.uid || `online-user-${index}`;
                  const isRevealed = Boolean(revealedUsers[userUid]);

                  const displayName =
                    entry.displayName?.trim() ||
                    (entry.email ? entry.email.split('@')[0] : '') ||
                    `User ${String(userUid).slice(0, 6)}`;

                  const emailText = entry.email || 'No email';
                  const uidText = entry.uid || 'No UID';

                  return (
                    <div
                      key={userUid}
                      className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {displayName}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleRevealUser(userUid)}
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-black/25 text-yellow-200 backdrop-blur-md transition active:scale-95 hover:text-white hover:shadow-inner hover:shadow-yellow-500/50"
                                aria-label={isRevealed ? 'Hide email and UID' : 'Show email and UID'}
                                title={isRevealed ? 'Hide email and UID' : 'Show email and UID'}
                              >
                                {isRevealed ? (
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                ) : (
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M3 3l18 18" />
                                    <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
                                    <path d="M9.88 5.09A10.94 10.94 0 0112 5c6.5 0 10 7 10 7a17.6 17.6 0 01-3.04 3.81" />
                                    <path d="M6.61 6.61C3.9 8.27 2 12 2 12a17.3 17.3 0 004.21 4.79" />
                                  </svg>
                                )}
                              </button>

                              <span className="rounded-full border border-green-400/30 bg-green-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-green-300">
                                Online
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-col gap-2">
                            <div className="rounded-lg border border-yellow-500/20 bg-black/20 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-yellow-300">
                                Email
                              </p>
                              <p className="mt-1 break-all text-xs text-white">
                                {isRevealed ? emailText : maskText(emailText)}
                              </p>
                            </div>

                            <div className="rounded-lg border border-yellow-500/20 bg-black/20 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-yellow-300">
                                Unique User ID
                              </p>
                              <p className="mt-1 break-all text-xs text-white">
                                {isRevealed ? uidText : maskText(uidText)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-gray-500">
                        Currently on {entry.currentPath || 'Unknown page'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}