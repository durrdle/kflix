// components/PartyModal.jsx
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

    const loadCode = async () => {
      if (mode !== 'create') return;

      try {
        setWarning('');
        const code = await generateUniquePartyCode();
        if (!cancelled) {
          setJoinCode(code);
          setPulse(true);
          const timer = setTimeout(() => setPulse(false), 220);
          return () => clearTimeout(timer);
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

  const navIconClass =
    'flex h-8 w-8 items-center justify-center rounded-full bg-black/25 backdrop-blur-md text-gray-300 transition active:scale-95 hover:text-white hover:shadow-inner hover:shadow-red-500/50 cursor-pointer';

  const primaryButtonClass =
    'w-44 h-9 rounded-md bg-red-600 text-white text-sm font-semibold transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60 cursor-pointer flex items-center justify-center gap-2';

  const inputClass =
    'w-52 h-10 px-4 rounded-md bg-gray-800 border border-white/10 text-white text-sm text-center focus:outline-none focus:border-red-500/50 focus:shadow-[0_0_10px_rgba(255,0,0,0.25)]';

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
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`h-[290px] w-[400px] overflow-hidden rounded-xl border border-red-500/40 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-all duration-200 ${
          pulse ? 'ring-1 ring-red-500/60 shadow-[0_0_18px_rgba(239,68,68,0.25)]' : ''
        }`}
      >
        <div className="relative flex items-center justify-between border-b border-red-500/20 bg-red-600/10 px-5 py-3">
          <div className="flex items-center gap-2">
            {mode !== 'default' ? (
              <button
                onClick={() => {
                  setMode('default');
                  setWarning('');
                  setInputCode('');
                }}
                className={navIconClass}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            ) : (
              <div className="h-8 w-8" />
            )}
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold uppercase tracking-[0.2em] text-red-400">
            Party Menu
          </div>

          <button onClick={onClose} className={navIconClass} type="button">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex h-[calc(100%-57px)] items-center justify-center px-6 py-4">
          {mode === 'default' && (
            <div className="flex w-full flex-col items-center justify-center gap-3">
              <button
                onClick={() => {
                  setWarning('');
                  setMode('join');
                }}
                className={primaryButtonClass}
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
                className={primaryButtonClass}
                type="button"
              >
                <span>Create</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M12 6v12M6 12h12" />
                </svg>
              </button>
            </div>
          )}

          {mode === 'join' && (
            <div className="flex w-full flex-col items-center justify-center gap-3">
              <input
                value={inputCode}
                onChange={(e) => {
                  setWarning('');
                  setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                }}
                placeholder="Enter 6-digit code"
                className={inputClass}
              />

              {warning && (
                <div className="w-56 rounded-md border border-red-500/30 bg-red-600/10 px-3 py-2 text-center text-xs text-red-300">
                  {warning}
                </div>
              )}

              <button
                onClick={handleJoin}
                className={`${primaryButtonClass} ${
                  inputCode.length !== 6 || working
                    ? 'cursor-not-allowed opacity-50 hover:bg-red-600 hover:shadow-none'
                    : ''
                }`}
                disabled={inputCode.length !== 6 || working}
                type="button"
              >
                <span>{working ? 'Joining...' : 'Join Party'}</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7-11-7z" />
                </svg>
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div className="flex w-full flex-col items-center justify-center gap-3">
              <div className={`${inputClass} flex items-center justify-center font-semibold tracking-[0.2em]`}>
                {joinCode || '......'}
              </div>

              {warning && (
                <div className="w-56 rounded-md border border-red-500/30 bg-red-600/10 px-3 py-2 text-center text-xs text-red-300">
                  {warning}
                </div>
              )}

              <button
                onClick={handleCreate}
                className={`${primaryButtonClass} ${working || !joinCode ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={working || !joinCode}
                type="button"
              >
                <span>{working ? 'Starting...' : 'Start Party'}</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7-11-7z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}