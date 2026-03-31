'use client';

import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import { db } from '@/lib/firebaseParty';

export default function useAdmin() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminReady, setAdminReady] = useState(false);

  useEffect(() => {
    const auth = getAuth();

    let unsubscribeAdmin = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);

      if (unsubscribeAdmin) {
        unsubscribeAdmin();
        unsubscribeAdmin = null;
      }

      if (!currentUser?.uid) {
        setIsAdmin(false);
        setAdminReady(true);
        return;
      }

      setAdminReady(false);

      const adminRef = ref(db, `admins/${currentUser.uid}`);

      unsubscribeAdmin = onValue(
        adminRef,
        (snapshot) => {
          setIsAdmin(snapshot.val() === true);
          setAdminReady(true);
        },
        () => {
          setIsAdmin(false);
          setAdminReady(true);
        }
      );
    });

    return () => {
      if (unsubscribeAdmin) unsubscribeAdmin();
      unsubscribeAuth();
    };
  }, []);

  return { user, isAdmin, adminReady };
}