// components/ThemeSync.jsx
'use client';

import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebaseParty';

const ALLOWED_THEMES = ['lava', 'midnight', 'crimson', 'neon', 'noir'];

function isValidTheme(theme) {
  return ALLOWED_THEMES.includes(String(theme || ''));
}

function applyTheme(theme) {
  const nextTheme = isValidTheme(theme) ? theme : 'lava';

  document.documentElement.setAttribute('data-theme', nextTheme);

  try {
    localStorage.setItem('kflix_theme', nextTheme);
    localStorage.setItem('kflix_selected_theme', nextTheme);
  } catch {}

  window.dispatchEvent(new Event('kflix-theme-updated'));
}

function getStoredTheme() {
  try {
    const candidates = [
      localStorage.getItem('kflix_theme'),
      localStorage.getItem('kflix_selected_theme'),
      localStorage.getItem('theme'),
      document.documentElement.getAttribute('data-theme'),
      document.documentElement.getAttribute('data-kflix-theme'),
    ];

    const found = candidates.find((value) => isValidTheme(value));
    return found || 'lava';
  } catch {
    return document.documentElement.getAttribute('data-theme') || 'lava';
  }
}

export default function ThemeSync() {
  useEffect(() => {
    applyTheme(getStoredTheme());

    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.uid) {
        applyTheme(getStoredTheme());
        return;
      }

      try {
        const snap = await get(ref(db, `users/${user.uid}/profile/theme`));
        const firebaseTheme = snap.exists() ? snap.val() : '';

        if (isValidTheme(firebaseTheme)) {
          applyTheme(firebaseTheme);
          return;
        }

        applyTheme(getStoredTheme());
      } catch {
        applyTheme(getStoredTheme());
      }
    });

    const handleStorage = () => {
      applyTheme(getStoredTheme());
    };

    const handleThemeUpdated = () => {
      applyTheme(getStoredTheme());
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('kflix-theme-updated', handleThemeUpdated);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('kflix-theme-updated', handleThemeUpdated);
    };
  }, []);

  return null;
}