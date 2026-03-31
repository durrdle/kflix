'use client';

import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  onDisconnect,
  onValue,
  ref,
  set,
  update,
} from 'firebase/database';
import { db } from '@/lib/firebaseParty';

function buildCurrentPath(pathname, searchParams) {
  const query = searchParams?.toString?.() || '';
  return query ? `${pathname}?${query}` : pathname;
}

export default function PresenceTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const auth = getAuth();

    let unsubscribeConnected = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (unsubscribeConnected) {
        unsubscribeConnected();
        unsubscribeConnected = null;
      }

      if (!currentUser?.uid) return;

      const connectedRef = ref(db, '.info/connected');
      const presenceRef = ref(db, `presence/${currentUser.uid}`);

      unsubscribeConnected = onValue(connectedRef, async (snapshot) => {
        if (snapshot.val() !== true) return;

        const currentPath = buildCurrentPath(
          window.location.pathname,
          new URLSearchParams(window.location.search)
        );

        try {
          await onDisconnect(presenceRef).update({
            online: false,
            lastActive: Date.now(),
          });

          await set(presenceRef, {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || '',
            photoURL: currentUser.photoURL || '',
            currentPath,
            online: true,
            lastActive: Date.now(),
          });
        } catch (error) {
          console.error('Failed to update presence:', error);
        }
      });
    });

    const heartbeat = setInterval(() => {
      const currentUser = getAuth().currentUser;
      if (!currentUser?.uid) return;

      update(ref(db, `presence/${currentUser.uid}`), {
        online: true,
        lastActive: Date.now(),
        currentPath: buildCurrentPath(
          window.location.pathname,
          new URLSearchParams(window.location.search)
        ),
      }).catch(() => {});
    }, 30000);

    const handleVisibility = () => {
      const currentUser = getAuth().currentUser;
      if (!currentUser?.uid) return;

      update(ref(db, `presence/${currentUser.uid}`), {
        online: document.visibilityState === 'visible',
        lastActive: Date.now(),
        currentPath: buildCurrentPath(
          window.location.pathname,
          new URLSearchParams(window.location.search)
        ),
      }).catch(() => {});
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (unsubscribeConnected) unsubscribeConnected();
      unsubscribeAuth();
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const currentUser = getAuth().currentUser;
    if (!currentUser?.uid) return;

    update(ref(db, `presence/${currentUser.uid}`), {
      currentPath: buildCurrentPath(pathname, searchParams),
      online: true,
      lastActive: Date.now(),
    }).catch(() => {});
  }, [pathname, searchParams]);

  return null;
}