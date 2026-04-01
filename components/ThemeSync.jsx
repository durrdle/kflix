'use client';

import { useEffect } from 'react';

const ALLOWED_THEMES = ['lava', 'midnight', 'crimson', 'neon', 'noir'];
const DEFAULT_THEME = 'noir';

function isValidTheme(theme) {
  return ALLOWED_THEMES.includes(String(theme || ''));
}

function resolveStoredTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;

  const candidates = [
    localStorage.getItem('kflix_theme'),
    localStorage.getItem('kflix_selected_theme'),
    localStorage.getItem('theme'),
    document.documentElement.getAttribute('data-theme'),
    document.documentElement.getAttribute('data-kflix-theme'),
  ];

  const found = candidates.find((value) => isValidTheme(value));
  return found || DEFAULT_THEME;
}

function applyThemeSilently(theme) {
  const nextTheme = isValidTheme(theme) ? theme : DEFAULT_THEME;

  if (typeof document !== 'undefined') {
    const currentTheme = document.documentElement.getAttribute('data-theme');

    if (currentTheme !== nextTheme) {
      document.documentElement.setAttribute('data-theme', nextTheme);
    }

    document.documentElement.setAttribute('data-kflix-theme', nextTheme);
  }

  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem('kflix_theme') !== nextTheme) {
        localStorage.setItem('kflix_theme', nextTheme);
      }
      if (localStorage.getItem('kflix_selected_theme') !== nextTheme) {
        localStorage.setItem('kflix_selected_theme', nextTheme);
      }
      if (localStorage.getItem('theme') !== nextTheme) {
        localStorage.setItem('theme', nextTheme);
      }
    } catch {}
  }

  return nextTheme;
}

export default function ThemeSync() {
  useEffect(() => {
    const syncThemeFromStorage = () => {
      applyThemeSilently(resolveStoredTheme());
    };

    syncThemeFromStorage();

    const handleStorage = (event) => {
      if (
        !event.key ||
        event.key === 'kflix_theme' ||
        event.key === 'kflix_selected_theme' ||
        event.key === 'theme'
      ) {
        syncThemeFromStorage();
      }
    };

    const handleThemeUpdated = () => {
      syncThemeFromStorage();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('kflix-theme-updated', handleThemeUpdated);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('kflix-theme-updated', handleThemeUpdated);
    };
  }, []);

  return null;
}