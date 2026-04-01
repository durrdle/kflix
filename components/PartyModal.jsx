'use client';

import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  createParty,
  ensureHostMembership,
  generateUniquePartyCode,
  joinParty,
} from '@/lib/firebaseParty';

export default function PartyModal({ open, onClose, onJoinParty, onCreateParty }) {
  const [mode, setMode] = useState('default');
  const [joinCode, setJoinCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [pulse, setPulse] = useState(false);
  const [userId, setUserId] = useState('');
  const [warning, setWarning] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUserId(currentUser?.uid || '');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pulseTimer;

    const loadCode = async () => {
      if (mode !== 'create') return;

      try {
        setWarning('');
        const code = await generateUniquePartyCode();

        if (!cancelled) {
          setJoinCode(code);
          setPulse(true);
          pulseTimer = setTimeout(() => setPulse(false), 220);
        }
      } catch {
        if (!cancelled) {
          setWarning('Failed to generate a party code.');
        }
      }
    };

    loadCode();

    return () => {
      cancelled = true;
      if (pulseTimer) clearTimeout(pulseTimer);
    };
  }, [mode]);

  useEffect(() => {
    if (!open) {
      setMode('default');
      setJoinCode('');
      setInputCode('');
      setPulse(false);
      setWarning('');
      setWorking(false);
    }
  }, [open]);

  if (!open) return null;

  const glassPanelStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-panel-from) 82%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-panel-to) 92%, rgba(255,255,255,0.02)))',
    borderColor: pulse
      ? 'var(--theme-accent-border)'
      : 'color-mix(in srgb, var(--theme-accent-border) 74%, rgba(255,255,255,0.08))',
    boxShadow: pulse
      ? '0 0 26px color-mix(in srgb, var(--theme-accent-glow) 55%, transparent), 0 20px 46px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08)'
      : '0 20px 46px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02)',
    backdropFilter: 'blur(22px) saturate(150%)',
    WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  };

  const glassHeaderStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255,255,255,0.04)), color-mix(in srgb, var(--theme-accent-soft) 68%, transparent))',
    borderColor: 'var(--theme-accent-border)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  };

  const glassSurfaceStyle = {
    borderColor: 'color-mix(in srgb, var(--theme-muted-border) 92%, rgba(255,255,255,0.06))',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-muted-bg) 82%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-muted-bg-strong) 90%, rgba(255,255,255,0.02)))',
    boxShadow:
      '0 12px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.07)',
    backdropFilter: 'blur(16px) saturate(145%)',
    WebkitBackdropFilter: 'blur(16px) saturate(145%)',
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

  const warningStyle = {
    borderColor: 'var(--theme-accent-border)',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255,255,255,0.04)), color-mix(in srgb, var(--theme-accent-soft) 68%, transparent))',
    color: 'var(--theme-accent-text)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  };

  const handleJoin = async () => {
    if (inputCode.length !== 6 || working || !userId) return;

    try {
      setWorking(true);
      setWarning('');
      await joinParty(inputCode, userId);
      onJoinParty(inputCode);
      onClose();
    } catch {
      setWarning('That party code is not active.');
      setPulse(true);
      setTimeout(() => setPulse(false), 220);
    } finally {
      setWorking(false);
    }
  };

  const handleCreate = async () => {
    if (!joinCode || working || !userId) return;

    try {
      setWorking(true);
      setWarning('');
      await createParty(joinCode, userId);
      await ensureHostMembership(joinCode, userId);
      onCreateParty(joinCode);
      onClose();
    } catch {
      setWarning('Failed to create party.');
      setPulse(true);
      setTimeout(() => setPulse(false), 220);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-3 backdrop-blur-sm sm:px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] overflow-hidden rounded-3xl border-[1.5px]"
        style={glassPanelStyle}
      >
        <div
          className="relative flex items-center justify-between border-b px-4 py-3 sm:px-5"
          style={glassHeaderStyle}
        >
          <div className="flex items-center gap-2">
            {mode !== 'default' ? (
              <button
                onClick={() => {
                  setMode('default');
                  setWarning('');
                  setInputCode('');
                }}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition active:scale-95"
                style={glassGhostButtonStyle}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            ) : (
              <div className="h-9 w-9" />
            )}
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold uppercase tracking-[0.18em] sm:text-base" style={{ color: 'var(--theme-accent-text)' }}>
            Party Menu
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition active:scale-95"
            style={glassGhostButtonStyle}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-5 sm:px-5 sm:py-6">
          {mode === 'default' && (
            <div className="space-y-3">
              <div className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                <p className="text-sm leading-6 text-gray-200">
                  Start a new party or join an existing one with a code.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => {
                    setWarning('');
                    setMode('join');
                  }}
                  className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition active:scale-95"
                  style={glassAccentButtonStyle}
                  type="button"
                >
                  <span>Join</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>

                <button
                  onClick={() => {
                    setWarning('');
                    setMode('create');
                  }}
                  className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition active:scale-95"
                  style={glassGhostButtonStyle}
                  type="button"
                >
                  <span>Create</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M12 6v12M6 12h12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {mode === 'join' && (
            <div className="space-y-4">
              <div className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                  Enter Party Code
                </p>

                <input
                  value={inputCode}
                  onChange={(e) => {
                    setWarning('');
                    setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                  placeholder="Enter 6-digit code"
                  className="mt-3 h-14 w-full rounded-2xl border px-4 text-center text-base font-semibold tracking-[0.22em] text-[var(--theme-text)] outline-none placeholder:tracking-normal placeholder:text-[var(--theme-muted-text)]"
                  style={glassSurfaceStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--theme-accent-border)';
                    e.currentTarget.style.boxShadow =
                      '0 0 14px color-mix(in srgb, var(--theme-accent-glow) 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.07)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor =
                      'color-mix(in srgb, var(--theme-muted-border) 92%, rgba(255,255,255,0.06))';
                    e.currentTarget.style.boxShadow =
                      '0 12px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.07)';
                  }}
                />
              </div>

              {warning && (
                <div className="rounded-2xl border px-4 py-3 text-center text-sm" style={warningStyle}>
                  {warning}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={() => {
                    setMode('default');
                    setWarning('');
                    setInputCode('');
                  }}
                  className="flex h-11 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition active:scale-95"
                  style={glassGhostButtonStyle}
                  type="button"
                >
                  Cancel
                </button>

                <button
                  onClick={handleJoin}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  style={glassAccentButtonStyle}
                  disabled={inputCode.length !== 6 || working}
                  type="button"
                >
                  <span>{working ? 'Joining...' : 'Join Party'}</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7-11-7z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-4">
              <div className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                  Your Party Code
                </p>

                <div
                  className="mt-3 flex h-14 items-center justify-center rounded-2xl border text-xl font-semibold tracking-[0.28em]"
                  style={glassSurfaceStyle}
                >
                  {joinCode || '......'}
                </div>
              </div>

              {warning && (
                <div className="rounded-2xl border px-4 py-3 text-center text-sm" style={warningStyle}>
                  {warning}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={() => {
                    setMode('default');
                    setWarning('');
                    setJoinCode('');
                  }}
                  className="flex h-11 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition active:scale-95"
                  style={glassGhostButtonStyle}
                  type="button"
                >
                  Cancel
                </button>

                <button
                  onClick={handleCreate}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  style={glassAccentButtonStyle}
                  disabled={working || !joinCode}
                  type="button"
                >
                  <span>{working ? 'Starting...' : 'Start Party'}</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7-11-7z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}