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

function buildForceRefreshPayload(uid, reason = 'manual-refresh') {
  const now = Date.now();

  return {
    token: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    requestedAt: now,
    requestedBy: uid || '',
    reason,
  };
}

function StatCard({ label, value, subValue, accentText, glassCardStyle }) {
  return (
    <div className="rounded-2xl border p-4 sm:p-5" style={glassCardStyle}>
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.16em] sm:text-xs"
        style={{ color: 'var(--theme-accent-text)' }}
      >
        {label}
      </p>

      <p
        className="mt-2 text-xl font-bold sm:text-2xl"
        style={{ color: accentText || '#ffffff' }}
      >
        {value}
      </p>

      {subValue ? (
        <p className="mt-2 text-xs text-gray-400 sm:text-sm">{subValue}</p>
      ) : null}
    </div>
  );
}

function MobileUserCard({
  entry,
  userUid,
  isRevealed,
  onToggleReveal,
  glassCardStyle,
  glassGhostButtonStyle,
  statusChipOnlineStyle,
}) {
  const displayName =
    entry.displayName?.trim() ||
    (entry.email ? entry.email.split('@')[0] : '') ||
    `User ${String(userUid).slice(0, 6)}`;

  const emailText = entry.email || 'No email';
  const uidText = entry.uid || 'No UID';

  return (
    <div className="rounded-2xl border p-4" style={glassCardStyle}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{displayName}</p>
          <p className="mt-1 text-xs text-gray-500">
            Currently on {entry.currentPath || 'Unknown page'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleReveal(userUid)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition active:scale-95"
            style={glassGhostButtonStyle}
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

          <span
            className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={statusChipOnlineStyle}
          >
            Online
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="rounded-xl border px-3 py-2" style={glassCardStyle}>
          <p
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{ color: 'var(--theme-accent-text)' }}
          >
            Email
          </p>
          <p className="mt-1 break-all text-xs text-white">
            {isRevealed ? emailText : maskText(emailText)}
          </p>
        </div>

        <div className="rounded-xl border px-3 py-2" style={glassCardStyle}>
          <p
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{ color: 'var(--theme-accent-text)' }}
          >
            Unique User ID
          </p>
          <p className="mt-1 break-all text-xs text-white">
            {isRevealed ? uidText : maskText(uidText)}
          </p>
        </div>

        <div className="rounded-xl border px-3 py-2" style={glassCardStyle}>
          <p
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{ color: 'var(--theme-accent-text)' }}
          >
            Last Active
          </p>
          <p className="mt-1 break-all text-xs text-white">
            {formatTime(entry.lastActive)}
          </p>
        </div>
      </div>
    </div>
  );
}

function DesktopUserCard({
  entry,
  userUid,
  isRevealed,
  onToggleReveal,
  glassCardStyle,
  glassGhostButtonStyle,
  statusChipOnlineStyle,
}) {
  const displayName =
    entry.displayName?.trim() ||
    (entry.email ? entry.email.split('@')[0] : '') ||
    `User ${String(userUid).slice(0, 6)}`;

  const emailText = entry.email || 'No email';
  const uidText = entry.uid || 'No UID';

  return (
    <div className="rounded-2xl border p-4" style={glassCardStyle}>
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
                onClick={() => onToggleReveal(userUid)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition active:scale-95"
                style={glassGhostButtonStyle}
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

              <span
                className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={statusChipOnlineStyle}
              >
                Online
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <div className="rounded-xl border px-3 py-2" style={glassCardStyle}>
              <p
                className="text-[10px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--theme-accent-text)' }}
              >
                Email
              </p>
              <p className="mt-1 break-all text-xs text-white">
                {isRevealed ? emailText : maskText(emailText)}
              </p>
            </div>

            <div className="rounded-xl border px-3 py-2" style={glassCardStyle}>
              <p
                className="text-[10px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--theme-accent-text)' }}
              >
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

  const [refreshMeta, setRefreshMeta] = useState({
    token: '',
    requestedAt: 0,
    requestedBy: '',
    reason: '',
  });

  const [revealedUsers, setRevealedUsers] = useState({});

  const glassPanelStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-panel-from) 80%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-panel-to) 92%, rgba(255,255,255,0.02)))',
    borderColor: 'color-mix(in srgb, var(--theme-accent-border) 74%, rgba(255,255,255,0.08))',
    boxShadow:
      '0 20px 46px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02)',
    backdropFilter: 'blur(22px) saturate(150%)',
    WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  };

  const glassHeaderStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-accent-soft) 58%, transparent))',
    borderColor: 'color-mix(in srgb, var(--theme-accent-border-soft) 90%, rgba(255,255,255,0.05))',
  };

  const glassCardStyle = {
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

  const statusChipOnlineStyle = {
    borderColor: 'rgba(34,197,94,0.34)',
    background:
      'linear-gradient(180deg, rgba(34,197,94,0.16), rgba(21,128,61,0.12))',
    color: '#86efac',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  };

  const statusChipRefreshStyle = {
    borderColor: 'rgba(59,130,246,0.34)',
    background:
      'linear-gradient(180deg, rgba(59,130,246,0.16), rgba(29,78,216,0.12))',
    color: '#93c5fd',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  };

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
    const refreshRef = ref(db, 'siteSettings/forceRefresh');

    const unsubscribe = onValue(
      refreshRef,
      (snapshot) => {
        const value = snapshot.val() || {};
        setRefreshMeta({
          token: value.token || '',
          requestedAt: Number(value.requestedAt || 0),
          requestedBy: value.requestedBy || '',
          reason: value.reason || '',
        });
      },
      () => {
        setRefreshMeta({
          token: '',
          requestedAt: 0,
          requestedBy: '',
          reason: '',
        });
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

  const triggerForceRefresh = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) return;

    try {
      const payload = buildForceRefreshPayload(currentUser.uid, 'manual-refresh');

      await update(ref(db, 'siteSettings'), {
        forceRefresh: payload,
      });
    } catch (error) {
      console.error('Failed to trigger force refresh:', error);
    }
  };

  const saveMaintenanceState = async (enabled) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) return;

    setSavingMaintenance(true);

    try {
      const now = Date.now();
      const rootUpdates = {
        'siteSettings/maintenance/enabled': enabled,
        'siteSettings/maintenance/message':
          maintenanceMessage.trim() || 'KFlix is currently undergoing maintenance.',
        'siteSettings/maintenance/enabledAt': now,
        'siteSettings/maintenance/enabledBy': currentUser.uid,
      };

      if (!enabled) {
        const refreshPayload = buildForceRefreshPayload(
          currentUser.uid,
          'maintenance-disabled'
        );

        rootUpdates['siteSettings/forceRefresh/token'] = refreshPayload.token;
        rootUpdates['siteSettings/forceRefresh/requestedAt'] =
          refreshPayload.requestedAt;
        rootUpdates['siteSettings/forceRefresh/requestedBy'] =
          refreshPayload.requestedBy;
        rootUpdates['siteSettings/forceRefresh/reason'] = refreshPayload.reason;
      }

      await update(ref(db), rootUpdates);
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
      <div className="min-h-screen text-white" style={{ background: 'var(--theme-bg)' }}>
        <Navbar />

        <section className="px-3 pt-20 sm:px-4 sm:pt-24 lg:px-8">
          <div
            className="overflow-hidden rounded-3xl border-[1.5px]"
            style={glassPanelStyle}
          >
            <div className="border-b px-4 py-4 sm:px-6" style={glassHeaderStyle}>
              <h1
                className="text-xl font-semibold uppercase tracking-[0.16em] sm:text-2xl"
                style={{ color: 'var(--theme-accent-text)' }}
              >
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
      <div className="min-h-screen text-white" style={{ background: 'var(--theme-bg)' }}>
        <Navbar />

        <section className="px-3 pt-20 sm:px-4 sm:pt-24 lg:px-8">
          <div
            className="overflow-hidden rounded-3xl border-[1.5px]"
            style={glassPanelStyle}
          >
            <div className="border-b px-4 py-4 sm:px-6" style={glassHeaderStyle}>
              <h1
                className="text-xl font-semibold uppercase tracking-[0.16em] sm:text-2xl"
                style={{ color: 'var(--theme-accent-text)' }}
              >
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
    <div className="min-h-screen text-white" style={{ background: 'var(--theme-bg)' }}>
      <Navbar />

      <section className="space-y-6 px-3 pb-8 pt-20 sm:px-4 sm:pt-24 lg:px-8">
        <div
          className="overflow-hidden rounded-3xl border-[1.5px]"
          style={glassPanelStyle}
        >
          <div className="border-b px-4 py-4 sm:px-6" style={glassHeaderStyle}>
            <h1
              className="text-xl font-semibold uppercase tracking-[0.16em] sm:text-2xl"
              style={{ color: 'var(--theme-accent-text)' }}
            >
              KFlix Admin Panel
            </h1>
          </div>

          <div className="grid gap-4 px-4 py-5 sm:px-6 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Maintenance"
              value={maintenanceEnabled ? 'Enabled' : 'Disabled'}
              accentText={maintenanceEnabled ? 'var(--theme-accent-text)' : '#86efac'}
              glassCardStyle={glassCardStyle}
            />

            <StatCard
              label="Online Users"
              value={String(onlineUsers.length)}
              glassCardStyle={glassCardStyle}
            />

            <StatCard
              label="Last Maintenance Update"
              value={formatTime(maintenanceMeta.enabledAt)}
              glassCardStyle={glassCardStyle}
            />

            <StatCard
              label="Last Force Refresh"
              value={formatTime(refreshMeta.requestedAt)}
              glassCardStyle={glassCardStyle}
            />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div
            className="overflow-hidden rounded-3xl border-[1.5px]"
            style={glassPanelStyle}
          >
            <div className="border-b px-4 py-4 sm:px-6" style={glassHeaderStyle}>
              <h2
                className="text-lg font-semibold uppercase tracking-[0.16em]"
                style={{ color: 'var(--theme-accent-text)' }}
              >
                Maintenance Mode
              </h2>
            </div>

            <div className="space-y-4 px-4 py-5 sm:px-6">
              <div className="rounded-2xl border p-4" style={glassCardStyle}>
                <p className="text-sm text-gray-200">
                  When enabled, all regular users are forced onto the KFlix
                  maintenance page. Admins still bypass it so they can turn it off.
                </p>

                <p className="mt-3 text-sm text-gray-300">
                  When you disable maintenance, KFlix also publishes a force-refresh
                  signal so active users reload onto the newest update automatically.
                </p>
              </div>

              <div>
                <label
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em]"
                  style={{ color: 'var(--theme-accent-text)' }}
                >
                  Maintenance Message
                </label>

                <textarea
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  rows={5}
                  className="w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500"
                  style={glassCardStyle}
                  placeholder="KFlix is currently undergoing maintenance."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => saveMaintenanceState(true)}
                  disabled={savingMaintenance}
                  className="flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                  style={glassAccentButtonStyle}
                >
                  {savingMaintenance ? 'Saving...' : 'Enable Maintenance'}
                </button>

                <button
                  type="button"
                  onClick={() => saveMaintenanceState(false)}
                  disabled={savingMaintenance}
                  className="flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                  style={glassGhostButtonStyle}
                >
                  {savingMaintenance ? 'Saving...' : 'Disable Maintenance'}
                </button>

                <button
                  type="button"
                  onClick={triggerForceRefresh}
                  disabled={savingMaintenance}
                  className="flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                  style={glassGhostButtonStyle}
                >
                  Trigger Refresh Now
                </button>
              </div>

              <div className="rounded-2xl border p-4 text-sm text-gray-200" style={glassCardStyle}>
                <p>
                  <span className="text-white">Current state:</span>{' '}
                  {maintenanceEnabled ? 'Enabled' : 'Disabled'}
                </p>

                <p className="mt-2 break-all">
                  <span className="text-white">Last updated by UID:</span>{' '}
                  {maintenanceMeta.enabledBy || 'Unknown'}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={statusChipRefreshStyle}
                  >
                    Refresh Signal
                  </span>

                  <span className="text-xs text-gray-300">
                    {refreshMeta.reason || 'none'}
                  </span>
                </div>

                <p className="mt-2 break-all text-xs text-gray-300">
                  <span className="text-white">Last refresh token:</span>{' '}
                  {refreshMeta.token || 'None'}
                </p>

                <p className="mt-2 text-xs text-gray-300">
                  <span className="text-white">Last refresh time:</span>{' '}
                  {formatTime(refreshMeta.requestedAt)}
                </p>

                <p className="mt-2 break-all text-xs text-gray-300">
                  <span className="text-white">Last refresh by UID:</span>{' '}
                  {refreshMeta.requestedBy || 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          <div
            className="overflow-hidden rounded-3xl border-[1.5px]"
            style={glassPanelStyle}
          >
            <div className="border-b px-4 py-4 sm:px-6" style={glassHeaderStyle}>
              <h2
                className="text-lg font-semibold uppercase tracking-[0.16em]"
                style={{ color: 'var(--theme-accent-text)' }}
              >
                Online Users
              </h2>
            </div>

            <div className="max-h-[720px] overflow-y-auto px-4 py-5 sm:px-6">
              {onlineUsers.length === 0 ? (
                <div className="rounded-2xl border p-4" style={glassCardStyle}>
                  <p className="text-sm text-gray-400">
                    No tracked online users yet.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 sm:hidden">
                    {onlineUsers.map((entry, index) => {
                      const userUid = entry.uid || `online-user-${index}`;
                      const isRevealed = Boolean(revealedUsers[userUid]);

                      return (
                        <MobileUserCard
                          key={userUid}
                          entry={entry}
                          userUid={userUid}
                          isRevealed={isRevealed}
                          onToggleReveal={toggleRevealUser}
                          glassCardStyle={glassCardStyle}
                          glassGhostButtonStyle={glassGhostButtonStyle}
                          statusChipOnlineStyle={statusChipOnlineStyle}
                        />
                      );
                    })}
                  </div>

                  <div className="hidden space-y-3 sm:block">
                    {onlineUsers.map((entry, index) => {
                      const userUid = entry.uid || `online-user-${index}`;
                      const isRevealed = Boolean(revealedUsers[userUid]);

                      return (
                        <DesktopUserCard
                          key={userUid}
                          entry={entry}
                          userUid={userUid}
                          isRevealed={isRevealed}
                          onToggleReveal={toggleRevealUser}
                          glassCardStyle={glassCardStyle}
                          glassGhostButtonStyle={glassGhostButtonStyle}
                          statusChipOnlineStyle={statusChipOnlineStyle}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}