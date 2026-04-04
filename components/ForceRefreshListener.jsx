'use client';

import { useEffect, useRef } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '@/lib/firebaseParty';

export default function ForceRefreshListener() {
  const initialTokenRef = useRef(null);
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    const refreshRef = ref(db, 'siteSettings/forceRefresh');

    const unsubscribe = onValue(
      refreshRef,
      (snapshot) => {
        const value = snapshot.val() || {};
        const token = String(value.token || '');

        if (!hasBootstrappedRef.current) {
          initialTokenRef.current = token;
          hasBootstrappedRef.current = true;
          return;
        }

        if (!token) return;
        if (token === initialTokenRef.current) return;

        initialTokenRef.current = token;

        try {
          sessionStorage.setItem('kflix_last_force_refresh_token', token);
        } catch {}

        window.location.reload();
      },
      (error) => {
        console.error('Force refresh listener failed:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  return null;
}