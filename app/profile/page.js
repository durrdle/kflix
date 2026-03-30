'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { onValue, ref, update, remove } from 'firebase/database';
import Navbar from '@/components/Navbar';
import { db } from '@/lib/firebaseParty';

const AVATAR_PRESETS = [
  {
    id: 'ember',
    name: 'Ember',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)',
    ring: 'rgba(239, 68, 68, 0.45)',
    icon: (
      <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
        <path d="M12 3c1.6 2.2 3.2 4.3 3.2 6.8A3.2 3.2 0 0112 13a3.2 3.2 0 01-3.2-3.2C8.8 7.3 10.4 5.2 12 3z" />
        <path d="M7 14.5A5.5 5.5 0 0012 21a5.5 5.5 0 005-6.5c0-2.2-1.2-4-3-5.5.2 2.8-1.4 4.5-3 4.5s-3.2-1.7-3-4.5c-1.8 1.5-3 3.3-3 5.5z" />
      </svg>
    ),
  },
  {
    id: 'nova',
    name: 'Nova',
    gradient: 'linear-gradient(135deg, #fb7185 0%, #7c2d12 100%)',
    ring: 'rgba(251, 113, 133, 0.45)',
    icon: (
      <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M4.9 4.9l2.5 2.5M16.6 16.6l2.5 2.5M19.1 4.9l-2.5 2.5M7.4 16.6l-2.5 2.5" />
      </svg>
    ),
  },
  {
    id: 'shadow',
    name: 'Shadow',
    gradient: 'linear-gradient(135deg, #52525b 0%, #09090b 100%)',
    ring: 'rgba(161, 161, 170, 0.35)',
    icon: (
      <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
        <path d="M17 14a5 5 0 11-7-7 7 7 0 107 7z" />
      </svg>
    ),
  },
  {
    id: 'ocean',
    name: 'Ocean',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #1e3a8a 100%)',
    ring: 'rgba(14, 165, 233, 0.4)',
    icon: (
      <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
        <path d="M3 14c1.5 1.3 3 2 4.5 2S10.5 15.3 12 14c1.5-1.3 3-2 4.5-2s3 .7 4.5 2" />
        <path d="M3 18c1.5 1.3 3 2 4.5 2s3-.7 4.5-2c1.5-1.3 3-2 4.5-2s3 .7 4.5 2" />
        <path d="M12 4c2.5 2.4 4 4.4 4 6.5A4 4 0 018 10.5C8 8.4 9.5 6.4 12 4z" />
      </svg>
    ),
  },
  {
    id: 'volt',
    name: 'Volt',
    gradient: 'linear-gradient(135deg, #a3e635 0%, #365314 100%)',
    ring: 'rgba(163, 230, 53, 0.4)',
    icon: (
      <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
        <path d="M13 2L5 13h5l-1 9 8-11h-5l1-9z" />
      </svg>
    ),
  },
  {
    id: 'royal',
    name: 'Royal',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #312e81 100%)',
    ring: 'rgba(139, 92, 246, 0.4)',
    icon: (
      <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
        <path d="M5 18h14l-1-7-3 2-3-5-3 5-3-2-1 7z" />
        <path d="M7 21h10" />
      </svg>
    ),
  },
  {
    id: 'mint',
    name: 'Mint',
    gradient: 'linear-gradient(135deg, #34d399 0%, #064e3b 100%)',
    ring: 'rgba(52, 211, 153, 0.4)',
    icon: (
      <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
        <path d="M6 14c0-5 4-9 9-9 0 5-4 9-9 9z" />
        <path d="M9 18c0-3 2-5 5-5 0 3-2 5-5 5z" />
      </svg>
    ),
  },
  {
    id: 'sunset',
    name: 'Sunset',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #7c2d12 100%)',
    ring: 'rgba(245, 158, 11, 0.4)',
    icon: (
      <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
        <path d="M4 18h16" />
        <path d="M7 18a5 5 0 0110 0" />
        <path d="M12 3v3M5.6 6.6l2.1 2.1M18.4 6.6l-2.1 2.1" />
      </svg>
    ),
  },
];

const THEME_OPTIONS = [
  { id: 'lava', label: 'KFlix - Lava' },
  { id: 'midnight', label: 'KFlix - Midnight' },
  { id: 'crimson', label: 'KFlix - Crimson' },
  { id: 'neon', label: 'KFlix - Neon' },
];

function AvatarBubble({ avatarId, size = 'large' }) {
  const avatar = AVATAR_PRESETS.find((item) => item.id === avatarId) || AVATAR_PRESETS[0];
  const sizeClass =
    size === 'small'
      ? 'h-20 w-20'
      : size === 'card'
      ? 'h-24 w-24'
      : 'h-28 w-28';

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full border-[1.5px] bg-black/30 shadow-[0_0_20px_rgba(239,68,68,0.18)]`}
      style={{
        backgroundImage: avatar.gradient,
        borderColor: avatar.ring,
      }}
    >
      {avatar.icon}
    </div>
  );
}

function SavedBadgeButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      className="pointer-events-auto absolute left-2 top-2 z-20 inline-flex min-h-[28px] items-center justify-center rounded-md border border-red-400/70 bg-red-600/90 px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-white shadow-[0_0_14px_rgba(239,68,68,0.35)] backdrop-blur-md transition hover:bg-red-700 active:scale-95"
      title="Remove bookmark"
      aria-label="Remove bookmark"
    >
      <svg
        className="h-3 w-3 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M6 4h12a1 1 0 011 1v15l-7-4-7 4V5a1 1 0 011-1z" />
      </svg>
      <span className="ml-1">Saved</span>
    </button>
  );
}

function BookmarkedSection({ items, onRemoveBookmark }) {
  const scrollRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);

  const cardsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(items.length / cardsPerPage));
  const maxPage = totalPages - 1;

  const canScrollLeft = currentPage > 0;
  const canScrollRight = currentPage < maxPage;

  const goToPage = (page) => {
    if (!scrollRef.current) return;

    const clampedPage = Math.max(0, Math.min(page, maxPage));
    const container = scrollRef.current;
    const pageWidth = container.clientWidth;

    container.scrollTo({
      left: clampedPage * pageWidth,
      behavior: 'smooth',
    });

    setCurrentPage(clampedPage);
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const pageWidth = container.clientWidth || 1;
      const nextPage = Math.round(container.scrollLeft / pageWidth);
      setCurrentPage(Math.max(0, Math.min(nextPage, maxPage)));
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [maxPage]);

  return (
    <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)] lg:col-span-2">
      <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-6 py-4">
        <h3 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
          Bookmarked Movies / Shows
        </h3>

        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={!canScrollLeft}
              className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
                canScrollLeft
                  ? 'cursor-pointer bg-black/25 text-gray-300 hover:text-white hover:shadow-inner hover:shadow-red-500/50'
                  : 'cursor-not-allowed bg-black/15 text-gray-500 opacity-60'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={!canScrollRight}
              className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
                canScrollRight
                  ? 'cursor-pointer bg-black/25 text-gray-300 hover:text-white hover:shadow-inner hover:shadow-red-500/50'
                  : 'cursor-not-allowed bg-black/15 text-gray-500 opacity-60'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="min-h-[380px] px-6 py-8">
        {items.length > 0 ? (
          <div
            ref={scrollRef}
            className="overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex w-full">
              {Array.from({ length: totalPages }).map((_, pageIndex) => {
                const pageItems = items.slice(
                  pageIndex * cardsPerPage,
                  pageIndex * cardsPerPage + cardsPerPage
                );

                return (
                  <div
                    key={pageIndex}
                    className="grid min-w-full grid-cols-6 gap-5"
                  >
                    {pageItems.map((item, index) => (
                      <a
                        key={`${item.id || index}-${item.type || 'movie'}`}
                        href={`/${item.type || 'movie'}/${item.id}`}
                        className="group min-w-0"
                      >
                        <div className="relative overflow-hidden rounded-lg border-[1.5px] border-white/10 bg-black/20 transition duration-300 group-hover:border-red-400/90 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.45)]">
                          <SavedBadgeButton
                            onClick={() => onRemoveBookmark?.(item)}
                          />

                          <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 bg-red-500/10 blur-xl" />

                          <div className="relative aspect-[2/3] w-full bg-gray-800">
                            {item.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                                alt={item.title || item.name || 'Poster'}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.06]"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                                No Image
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="line-clamp-1 text-sm font-medium text-white transition group-hover:text-red-300">
                            {item.title || item.name || 'Untitled'}
                          </div>
                          <div className="mt-1 text-xs text-gray-400">
                            {item.type === 'tv' ? 'TV Show' : 'Movie'}
                          </div>
                        </div>
                      </a>
                    ))}

                    {pageItems.length < cardsPerPage &&
                      Array.from({ length: cardsPerPage - pageItems.length }).map((_, fillerIndex) => (
                        <div key={`bookmark-filler-${fillerIndex}`} />
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[300px] items-center">
            <p className="text-sm text-gray-400">
              No bookmarked titles yet. Add movies or shows to your watchlist and they will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfilePageContent() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partyCode, setPartyCode] = useState('');
  const [inParty, setInParty] = useState(false);
  const [bookmarkedItems, setBookmarkedItems] = useState([]);

  const [showUserId, setShowUserId] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const [profileName, setProfileName] = useState('');
  const [draftName, setDraftName] = useState('');
  const [editingName, setEditingName] = useState(false);

  const [selectedAvatar, setSelectedAvatar] = useState('ember');
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const avatarScrollRef = useRef(null);
  const [canScrollAvatarLeft, setCanScrollAvatarLeft] = useState(false);
  const [canScrollAvatarRight, setCanScrollAvatarRight] = useState(false);

  const [selectedTheme, setSelectedTheme] = useState('lava');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const readPartyState = () => {
    const savedCode = localStorage.getItem('kflix_current_party_code') || '';
    const savedInParty = localStorage.getItem('kflix_in_party') === 'true';
    setPartyCode(savedCode);
    setInParty(savedInParty);
  };

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser(currentUser);
      readPartyState();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user?.uid) return;

    const profileRef = ref(db, `users/${user.uid}/profile`);

    const unsubscribe = onValue(profileRef, (snapshot) => {
      const profile = snapshot.exists() ? snapshot.val() || {} : {};

      const resolvedName =
        profile.displayName ||
        user.displayName ||
        (user.email ? user.email.split('@')[0] : 'User');

      const resolvedAvatar = profile.avatarId || 'ember';
      const resolvedTheme = profile.theme || 'lava';

      setProfileName(resolvedName);
      setDraftName((prev) => (editingName ? prev : resolvedName));
      setSelectedAvatar(resolvedAvatar);
      setSelectedTheme(resolvedTheme);
    });

    return () => unsubscribe();
  }, [user, editingName]);

  useEffect(() => {
    if (!user?.uid) {
      setBookmarkedItems([]);
      return;
    }

    const bookmarksRef = ref(db, `users/${user.uid}/bookmarks`);

    const unsubscribe = onValue(bookmarksRef, (snapshot) => {
      const raw = snapshot.exists() ? snapshot.val() || {} : {};
      const items = Object.values(raw)
        .filter(Boolean)
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
        .slice(0, 24);

      setBookmarkedItems(items);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const sync = () => {
      readPartyState();
    };

    sync();

    const handleStorage = (event) => {
      if (
        !event.key ||
        event.key === 'kflix_current_party_code' ||
        event.key === 'kflix_in_party'
      ) {
        sync();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sync();
      }
    };

    const handlePartyUpdated = () => {
      sync();
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('kflix-party-updated', handlePartyUpdated);

    const interval = setInterval(sync, 1500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('kflix-party-updated', handlePartyUpdated);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const el = avatarScrollRef.current;
    if (!el || !avatarModalOpen) return;

    const updateButtons = () => {
      setCanScrollAvatarLeft(el.scrollLeft > 4);
      setCanScrollAvatarRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };

    updateButtons();
    el.addEventListener('scroll', updateButtons);
    window.addEventListener('resize', updateButtons);

    return () => {
      el.removeEventListener('scroll', updateButtons);
      window.removeEventListener('resize', updateButtons);
    };
  }, [avatarModalOpen]);

  const joinedDate = useMemo(() => {
    if (!user?.metadata?.creationTime) return 'Unknown';
    return new Date(user.metadata.creationTime).toLocaleDateString();
  }, [user]);

  const censoredUserId = useMemo(() => {
    const uid = user?.uid || 'Not available';
    if (!user?.uid) return uid;
    return '*'.repeat(uid.length);
  }, [user]);

  const censoredEmail = useMemo(() => {
    const email = user?.email || 'Not available';
    if (!user?.email) return email;
    return '*'.repeat(email.length);
  }, [user]);

  const currentThemeLabel = useMemo(() => {
    return THEME_OPTIONS.find((theme) => theme.id === selectedTheme)?.label || 'KFlix - Lava';
  }, [selectedTheme]);

  const handleSaveName = async () => {
    const cleaned = draftName.trim().slice(0, 24);
    if (!cleaned || !user?.uid) return;

    try {
      await update(ref(db, `users/${user.uid}/profile`), {
        displayName: cleaned,
      });

      const activePartyCode = localStorage.getItem('kflix_current_party_code') || '';
      const activeInParty = localStorage.getItem('kflix_in_party') === 'true';

      if (activePartyCode && activeInParty) {
        await update(ref(db, `parties/${activePartyCode}/members/${user.uid}`), {
          name: cleaned,
          lastSeenAt: Date.now(),
        });
      }

      setEditingName(false);
    } catch (error) {
      console.error('Failed to save profile name:', error);
    }
  };

  const handleCancelNameEdit = () => {
    setDraftName(profileName);
    setEditingName(false);
  };

  const scrollAvatars = (direction) => {
    const el = avatarScrollRef.current;
    if (!el) return;

    el.scrollBy({
      left: direction === 'left' ? -320 : 320,
      behavior: 'smooth',
    });
  };

  const chooseAvatar = async (avatarId) => {
    if (!user?.uid) return;

    try {
      await update(ref(db, `users/${user.uid}/profile`), {
        avatarId,
      });
      setAvatarModalOpen(false);
    } catch (error) {
      console.error('Failed to save avatar:', error);
    }
  };

  const handleThemeChange = async (e) => {
    if (!user?.uid) return;

    const nextTheme = e.target.value;

    try {
      await update(ref(db, `users/${user.uid}/profile`), {
        theme: nextTheme,
      });
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const removeBookmark = async (itemToRemove) => {
    if (!user?.uid || !itemToRemove?.id) return;

    try {
      const key = `${itemToRemove.type || itemToRemove.media_type || 'movie'}-${itemToRemove.id}`;
      await remove(ref(db, `users/${user.uid}/bookmarks/${key}`));
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    setPasswordSuccess('');
    setPasswordError('');

    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser || !currentUser.email) {
      setPasswordError('No signed-in user found.');
      return;
    }

    const hasPasswordProvider = currentUser.providerData.some(
      (provider) => provider.providerId === 'password'
    );

    if (!hasPasswordProvider) {
      setPasswordError('This account does not use email/password sign-in.');
      return;
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    try {
      setPasswordLoading(true);

      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );

      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);

      setPasswordSuccess('Password changed successfully. If anything looks off, sign out and sign back in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error('Password change failed:', error);

      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          setPasswordError('Your current password is incorrect.');
          break;
        case 'auth/weak-password':
          setPasswordError('Your new password is too weak.');
          break;
        case 'auth/requires-recent-login':
          setPasswordError('Please sign out and sign back in, then try again.');
          break;
        default:
          setPasswordError('Failed to change password. Please try again.');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Suspense fallback={<div className="h-20" />}>
          <Navbar />
        </Suspense>
        <div className="px-8 pb-10 pt-28">
          <div className="mx-auto w-full rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 p-10 text-center shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <p className="text-lg text-gray-300">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Suspense fallback={<div className="h-20" />}>
        <Navbar />
      </Suspense>

      <main className="px-8 pb-10 pt-24">
        <div className="space-y-8">
          <section className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
              <h1 className="text-xl font-semibold uppercase tracking-[0.18em] text-red-400 md:text-2xl">
                Profile
              </h1>
            </div>

            <div className="grid gap-6 px-6 py-6 md:grid-cols-[120px_1fr] md:items-center">
              <div className="relative w-fit">
                <AvatarBubble avatarId={selectedAvatar} size="large" />

                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-gray-200 backdrop-blur-md transition active:scale-95 hover:text-white hover:shadow-inner hover:shadow-red-500/50"
                  aria-label="Edit avatar"
                  title="Edit avatar"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
              </div>

              <div>
                {editingName ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="h-11 min-w-[220px] rounded-md border border-white/10 bg-black/20 px-4 text-xl font-bold text-white focus:border-red-500/50 focus:outline-none focus:shadow-[0_0_10px_rgba(255,0,0,0.25)] md:text-2xl"
                      maxLength={24}
                      autoFocus
                    />

                    <button
                      type="button"
                      onClick={handleSaveName}
                      className="flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60"
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelNameEdit}
                      className="flex h-10 items-center justify-center rounded-md bg-black/20 px-4 text-sm font-semibold text-white transition active:scale-95 hover:bg-black/30 hover:shadow-inner hover:shadow-red-500/40"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-white md:text-3xl">{profileName}</h2>

                    <button
                      type="button"
                      onClick={() => {
                        setDraftName(profileName);
                        setEditingName(true);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-gray-300 backdrop-blur-md transition active:scale-95 hover:text-white hover:shadow-inner hover:shadow-red-500/50"
                      aria-label="Edit name"
                      title="Edit name"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                  </div>
                )}

                <p className="mt-2 text-sm text-gray-400">Member since {joinedDate}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="h-full overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
              <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
                <h3 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                  Account Details
                </h3>
              </div>

              <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 md:col-span-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-red-400">Change Password</p>

                  <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full rounded-xl border border-white/10 bg-gray-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                    />

                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full rounded-xl border border-white/10 bg-gray-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                    />

                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full rounded-xl border border-white/10 bg-gray-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                    />

                    {passwordSuccess && (
                      <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                        {passwordSuccess}
                      </div>
                    )}

                    {passwordError && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {passwordError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white transition active:scale-95 ${
                        passwordLoading
                          ? 'cursor-not-allowed bg-red-900/50 opacity-70'
                          : 'bg-red-600 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60'
                      }`}
                    >
                      {passwordLoading ? 'Changing Password...' : 'Change Password'}
                    </button>
                  </form>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-red-400">Email</p>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="min-w-0 break-all text-base text-white">
                      {showEmail ? user?.email || 'Not available' : censoredEmail}
                    </p>

                    {user?.email && (
                      <button
                        type="button"
                        onClick={() => setShowEmail((prev) => !prev)}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-black/25 text-gray-300 backdrop-blur-md transition active:scale-95 hover:text-white hover:shadow-inner hover:shadow-red-500/50"
                        aria-label={showEmail ? 'Hide email' : 'Show email'}
                        title={showEmail ? 'Hide email' : 'Show email'}
                      >
                        {showEmail ? (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M3 3l18 18" />
                            <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
                            <path d="M9.88 5.09A10.94 10.94 0 0112 5c6.5 0 10 7 10 7a17.6 17.6 0 01-3.04 3.81" />
                            <path d="M6.61 6.61C3.9 8.27 2 12 2 12a17.3 17.3 0 004.21 4.79" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-red-400">Unique User ID</p>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="min-w-0 break-all text-base text-white">
                      {showUserId ? user?.uid || 'Not available' : censoredUserId}
                    </p>

                    {user?.uid && (
                      <button
                        type="button"
                        onClick={() => setShowUserId((prev) => !prev)}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-black/25 text-gray-300 backdrop-blur-md transition active:scale-95 hover:text-white hover:shadow-inner hover:shadow-red-500/50"
                        aria-label={showUserId ? 'Hide user ID' : 'Show user ID'}
                        title={showUserId ? 'Hide user ID' : 'Show user ID'}
                      >
                        {showUserId ? (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M3 3l18 18" />
                            <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
                            <path d="M9.88 5.09A10.94 10.94 0 0112 5c6.5 0 10 7 10 7a17.6 17.6 0 01-3.04 3.81" />
                            <path d="M6.61 6.61C3.9 8.27 2 12 2 12a17.3 17.3 0 004.21 4.79" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-h-full flex-col">
              <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
                <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
                  <h3 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                    Party Status
                  </h3>
                </div>

                <div className="space-y-4 px-6 py-5">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-red-400">Current Status</p>
                    <p className="mt-2 text-base text-white">{inParty ? 'In a party' : 'Not in a party'}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-red-400">Current Party Code</p>
                    <p className="mt-2 text-base text-white">{partyCode || 'None'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-8">
                <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
                  <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
                    <h3 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                      Preferences
                    </h3>
                  </div>

                  <div className="space-y-4 px-6 py-6">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-red-400">Theme</p>

                      <div className="mt-3">
                        <select
                          value={selectedTheme}
                          onChange={handleThemeChange}
                          className="w-full rounded-xl border border-white/10 bg-gray-900 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                        >
                          {THEME_OPTIONS.map((theme) => (
                            <option key={theme.id} value={theme.id}>
                              {theme.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <p className="mt-3 text-sm text-gray-400">Current theme: {currentThemeLabel}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <BookmarkedSection items={bookmarkedItems} onRemoveBookmark={removeBookmark} />
          </section>
        </div>
      </main>

      {avatarModalOpen && (
        <div
          onClick={() => setAvatarModalOpen(false)}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[780px] max-w-[calc(100vw-4rem)] overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-6 py-4">
              <h3 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                Choose Avatar
              </h3>

              <button
                type="button"
                onClick={() => setAvatarModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-gray-300 backdrop-blur-md transition active:scale-95 hover:text-white hover:shadow-inner hover:shadow-red-500/50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm text-gray-300">Pick one of the preset avatars for your profile.</p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollAvatars('left')}
                    disabled={!canScrollAvatarLeft}
                    className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
                      canScrollAvatarLeft
                        ? 'cursor-pointer bg-black/25 text-gray-300 hover:text-white hover:shadow-inner hover:shadow-red-500/50'
                        : 'cursor-not-allowed bg-black/15 text-gray-500 opacity-60'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M15 6l-6 6 6 6" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollAvatars('right')}
                    disabled={!canScrollAvatarRight}
                    className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
                      canScrollAvatarRight
                        ? 'cursor-pointer bg-black/25 text-gray-300 hover:text-white hover:shadow-inner hover:shadow-red-500/50'
                        : 'cursor-not-allowed bg-black/15 text-gray-500 opacity-60'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>

              <div
                ref={avatarScrollRef}
                className="overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                <div className="flex gap-4 pb-2">
                  {AVATAR_PRESETS.map((avatar) => {
                    const active = avatar.id === selectedAvatar;

                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => chooseAvatar(avatar.id)}
                        className={`group min-w-[150px] rounded-2xl border-[1.5px] bg-black/20 p-4 text-center transition duration-300 ${
                          active
                            ? 'border-red-400/90 shadow-[0_0_24px_rgba(239,68,68,0.32)]'
                            : 'border-white/10 hover:border-red-400/70 hover:shadow-[0_0_22px_rgba(239,68,68,0.18)]'
                        }`}
                      >
                        <div className="flex justify-center">
                          <AvatarBubble avatarId={avatar.id} size="card" />
                        </div>

                        <p className="mt-4 text-sm font-medium text-white transition group-hover:text-red-300">
                          {avatar.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="px-8 pb-8 pt-2 text-center text-sm text-gray-400">
        <p>This site does not host or store any media.</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
          <Link href="/Terms-and-Conditions" className="transition hover:text-red-400">
            Terms and Conditions
          </Link>
          <span>•</span>
          <Link href="/Privacy-Policy" className="transition hover:text-red-400">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white" />}>
      <ProfilePageContent />
    </Suspense>
  );
}