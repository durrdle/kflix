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
  { id: 'noir', label: 'KFlix - Noir' },
];

function AvatarBubble({ avatarId, size = 'large' }) {
  const avatar = AVATAR_PRESETS.find((item) => item.id === avatarId) || AVATAR_PRESETS[0];
  const sizeClass =
    size === 'small'
      ? 'h-16 w-16 sm:h-20 sm:w-20'
      : size === 'card'
        ? 'h-20 w-20 sm:h-24 sm:w-24'
        : 'h-24 w-24 sm:h-28 sm:w-28';

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full border-[1.5px] bg-black/30 shadow-[0_0_20px_rgba(0,0,0,0.25)]`}
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
      className="pointer-events-auto absolute left-2 top-2 z-20 inline-flex min-h-[28px] cursor-pointer items-center justify-center rounded-md border px-2 py-1 text-[10px] font-bold tracking-[0.08em] backdrop-blur-md transition active:scale-95"
      style={{
        borderColor: 'var(--theme-accent-border)',
        backgroundColor: 'var(--theme-accent)',
        boxShadow: '0 0 14px var(--theme-accent-glow)',
        color: 'var(--theme-accent-contrast)',
      }}
      title="Remove bookmark"
      aria-label="Remove bookmark"
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--theme-accent-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--theme-accent)';
      }}
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
    <div
      className="overflow-hidden rounded-2xl border-[1.5px] shadow-[0_12px_35px_rgba(0,0,0,0.55)] lg:col-span-2"
      style={{
        borderColor: 'var(--theme-accent-border)',
        backgroundImage: 'linear-gradient(to bottom, var(--theme-panel-from), var(--theme-panel-to))',
      }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4"
        style={{
          borderColor: 'rgba(255,255,255,0.06)',
          backgroundColor: 'var(--theme-accent-soft)',
        }}
      >
        <h3 className="pr-3 text-base font-semibold uppercase tracking-[0.16em] sm:text-lg sm:tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
          Bookmarked Movies / Shows
        </h3>

        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={!canScrollLeft}
              className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
                canScrollLeft ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
              }`}
              style={{
                backgroundColor: canScrollLeft ? 'var(--theme-muted-bg)' : 'rgba(0,0,0,0.12)',
                color: canScrollLeft ? '#d1d5db' : '#6b7280',
              }}
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
                canScrollRight ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
              }`}
              style={{
                backgroundColor: canScrollRight ? 'var(--theme-muted-bg)' : 'rgba(0,0,0,0.12)',
                color: canScrollRight ? '#d1d5db' : '#6b7280',
              }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="min-h-[280px] px-4 py-5 sm:min-h-[380px] sm:px-6 sm:py-8">
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
                    className="grid min-w-full grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6 lg:gap-5"
                  >
                    {pageItems.map((item, index) => (
                      <a
                        key={`${item.id || index}-${item.type || 'movie'}`}
                        href={`/${item.type || 'movie'}/${item.id}`}
                        className="group min-w-0 cursor-pointer"
                      >
                        <div
                          className="relative overflow-hidden rounded-lg border-[1.5px] bg-black/20 transition duration-300"
                          style={{ borderColor: 'var(--theme-muted-border)' }}
                        >
                          <SavedBadgeButton onClick={() => onRemoveBookmark?.(item)} />

                          <div
                            className="absolute inset-0 opacity-0 blur-xl transition duration-300 group-hover:opacity-100"
                            style={{ backgroundColor: 'var(--theme-accent-soft)' }}
                          />

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

                        <div className="mt-2 sm:mt-3">
                          <div className="line-clamp-1 text-xs font-medium text-white transition group-hover:text-[color:var(--theme-accent-text)] sm:text-sm">
                            {item.title || item.name || 'Untitled'}
                          </div>
                          <div className="mt-1 text-[11px] text-gray-400 sm:text-xs">
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
          <div className="flex min-h-[220px] items-center sm:min-h-[300px]">
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

  const [selectedTheme, setSelectedTheme] = useState('noir');

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
      const resolvedTheme = profile.theme || 'noir';

      setProfileName(resolvedName);
      setDraftName((prev) => (editingName ? prev : resolvedName));
      setSelectedAvatar(resolvedAvatar);
      setSelectedTheme(resolvedTheme);

      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', resolvedTheme);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('kflix_theme', resolvedTheme);
      }
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
    return THEME_OPTIONS.find((theme) => theme.id === selectedTheme)?.label || 'KFlix - Noir';
  }, [selectedTheme]);

  const panelStyle = {
    borderColor: 'var(--theme-accent-border)',
    backgroundImage: 'linear-gradient(to bottom, var(--theme-panel-from), var(--theme-panel-to))',
  };

  const panelHeaderStyle = {
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'var(--theme-accent-soft)',
  };

  const softCardStyle = {
    borderColor: 'var(--theme-muted-border)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  };

  const accentButtonStyle = {
    backgroundColor: 'var(--theme-accent)',
    border: '1px solid var(--theme-accent-border)',
    color: 'var(--theme-accent-contrast)',
  };

  const ghostButtonStyle = {
    backgroundColor: 'var(--theme-muted-bg)',
    border: '1px solid var(--theme-muted-border)',
  };

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
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('kflix_theme', nextTheme);

      setSelectedTheme(nextTheme);

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
      <div className="min-h-screen bg-[color:var(--theme-bg)] text-[color:var(--theme-text)]">
        <Suspense fallback={<div className="h-20" />}>
          <Navbar />
        </Suspense>
        <div className="px-3 pb-8 pt-20 sm:px-6 sm:pb-10 sm:pt-28 lg:px-8">
          <div
            className="mx-auto w-full rounded-2xl border-[1.5px] p-6 text-center shadow-[0_12px_35px_rgba(0,0,0,0.55)] sm:p-10"
            style={panelStyle}
          >
            <p className="text-base text-gray-300 sm:text-lg">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--theme-bg)] text-[color:var(--theme-text)]">
      <Suspense fallback={<div className="h-20" />}>
        <Navbar />
      </Suspense>

      <main className="px-3 pb-8 pt-20 sm:px-6 sm:pb-10 sm:pt-24 lg:px-8">
        <div className="space-y-6 sm:space-y-8">
          <section
            className="overflow-hidden rounded-2xl border-[1.5px] shadow-[0_12px_35px_rgba(0,0,0,0.55)]"
            style={panelStyle}
          >
            <div className="border-b px-4 py-3 sm:px-6 sm:py-4" style={panelHeaderStyle}>
              <h1 className="text-lg font-semibold uppercase tracking-[0.16em] sm:text-xl md:text-2xl" style={{ color: 'var(--theme-accent-text)' }}>
                Profile
              </h1>
            </div>

            <div className="grid gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 md:grid-cols-[120px_1fr] md:items-center">
              <div className="relative mx-auto w-fit md:mx-0">
                <AvatarBubble avatarId={selectedAvatar} size="large" />

                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="absolute right-0 top-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-gray-200 backdrop-blur-md transition active:scale-95 hover:text-white"
                  style={ghostButtonStyle}
                  aria-label="Edit avatar"
                  title="Edit avatar"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
              </div>

              <div className="text-center md:text-left">
                {editingName ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="h-11 w-full rounded-md border bg-black/20 px-4 text-lg font-bold text-white focus:outline-none sm:min-w-[220px] sm:w-auto sm:text-xl md:text-2xl"
                      style={{ borderColor: 'var(--theme-accent-border)' }}
                      maxLength={24}
                      autoFocus
                    />

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleSaveName}
                        className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-semibold transition active:scale-95 sm:flex-none"
                        style={accentButtonStyle}
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={handleCancelNameEdit}
                        className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition active:scale-95 sm:flex-none"
                        style={ghostButtonStyle}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap md:items-center md:justify-start">
                    <h2 className="break-words text-2xl font-bold text-white sm:text-3xl">
                      {profileName}
                    </h2>

                    <button
                      type="button"
                      onClick={() => {
                        setDraftName(profileName);
                        setEditingName(true);
                      }}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-gray-300 backdrop-blur-md transition active:scale-95 hover:text-white"
                      style={ghostButtonStyle}
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

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:gap-8">
            <div
              className="h-full overflow-hidden rounded-2xl border-[1.5px] shadow-[0_12px_35px_rgba(0,0,0,0.55)]"
              style={panelStyle}
            >
              <div className="border-b px-4 py-3 sm:px-6 sm:py-4" style={panelHeaderStyle}>
                <h3 className="text-base font-semibold uppercase tracking-[0.16em] sm:text-lg sm:tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                  Account Details
                </h3>
              </div>

              <div className="grid gap-4 px-4 py-5 sm:px-6 sm:py-6 md:grid-cols-2">
                <div className="rounded-xl border p-4 md:col-span-2" style={softCardStyle}>
                  <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>Change Password</p>

                  <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full rounded-xl border bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500"
                      style={{ borderColor: 'var(--theme-muted-border)' }}
                    />

                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full rounded-xl border bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500"
                      style={{ borderColor: 'var(--theme-muted-border)' }}
                    />

                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full rounded-xl border bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500"
                      style={{ borderColor: 'var(--theme-muted-border)' }}
                    />

                    {passwordSuccess && (
                      <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                        {passwordSuccess}
                      </div>
                    )}

                    {passwordError && (
                      <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--theme-accent-border)', backgroundColor: 'var(--theme-accent-soft)', color: 'var(--theme-accent-text)' }}>
                        {passwordError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className={`inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold transition active:scale-95 sm:w-auto ${
                        passwordLoading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                      }`}
                      style={accentButtonStyle}
                    >
                      {passwordLoading ? 'Changing Password...' : 'Change Password'}
                    </button>
                  </form>
                </div>

                <div className="rounded-xl border p-4" style={softCardStyle}>
                  <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>Email</p>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="min-w-0 break-all text-sm text-white sm:text-base">
                      {showEmail ? user?.email || 'Not available' : censoredEmail}
                    </p>

                    {user?.email && (
                      <button
                        type="button"
                        onClick={() => setShowEmail((prev) => !prev)}
                        className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-300 backdrop-blur-md transition active:scale-95 hover:text-white"
                        style={ghostButtonStyle}
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

                <div className="rounded-xl border p-4" style={softCardStyle}>
                  <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>Unique User ID</p>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="min-w-0 break-all text-sm text-white sm:text-base">
                      {showUserId ? user?.uid || 'Not available' : censoredUserId}
                    </p>

                    {user?.uid && (
                      <button
                        type="button"
                        onClick={() => setShowUserId((prev) => !prev)}
                        className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-300 backdrop-blur-md transition active:scale-95 hover:text-white"
                        style={ghostButtonStyle}
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

            <div className="flex min-h-full flex-col gap-6">
              <div
                className="overflow-hidden rounded-2xl border-[1.5px] shadow-[0_12px_35px_rgba(0,0,0,0.55)]"
                style={panelStyle}
              >
                <div className="border-b px-4 py-3 sm:px-6 sm:py-4" style={panelHeaderStyle}>
                  <h3 className="text-base font-semibold uppercase tracking-[0.16em] sm:text-lg sm:tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                    Party Status
                  </h3>
                </div>

                <div className="space-y-4 px-4 py-5 sm:px-6">
                  <div className="rounded-xl border p-4" style={softCardStyle}>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>Current Status</p>
                    <p className="mt-2 text-base text-white">{inParty ? 'In a party' : 'Not in a party'}</p>
                  </div>

                  <div className="rounded-xl border p-4" style={softCardStyle}>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>Current Party Code</p>
                    <p className="mt-2 break-all text-base text-white">{partyCode || 'None'}</p>
                  </div>
                </div>
              </div>

              <div
                className="overflow-hidden rounded-2xl border-[1.5px] shadow-[0_12px_35px_rgba(0,0,0,0.55)]"
                style={panelStyle}
              >
                <div className="border-b px-4 py-3 sm:px-6 sm:py-4" style={panelHeaderStyle}>
                  <h3 className="text-base font-semibold uppercase tracking-[0.16em] sm:text-lg sm:tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                    Preferences
                  </h3>
                </div>

                <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
                  <div className="rounded-xl border p-4" style={softCardStyle}>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>Theme</p>

                    <div className="mt-3">
                      <select
                        value={selectedTheme}
                        onChange={handleThemeChange}
                        className="w-full rounded-xl border bg-black/35 px-4 py-3 text-sm text-white outline-none transition"
                        style={{ borderColor: 'var(--theme-muted-border)' }}
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

            <BookmarkedSection items={bookmarkedItems} onRemoveBookmark={removeBookmark} />
          </section>
        </div>
      </main>

      {avatarModalOpen && (
        <div
          onClick={() => setAvatarModalOpen(false)}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-3 backdrop-blur-sm sm:px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[780px] overflow-hidden rounded-2xl border-[1.5px] shadow-[0_12px_35px_rgba(0,0,0,0.55)]"
            style={panelStyle}
          >
            <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4" style={panelHeaderStyle}>
              <h3 className="text-base font-semibold uppercase tracking-[0.16em] sm:text-lg sm:tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                Choose Avatar
              </h3>

              <button
                type="button"
                onClick={() => setAvatarModalOpen(false)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-gray-300 backdrop-blur-md transition active:scale-95 hover:text-white"
                style={ghostButtonStyle}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="px-4 py-5 sm:px-6 sm:py-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-300">Pick one of the preset avatars for your profile.</p>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => scrollAvatars('left')}
                    disabled={!canScrollAvatarLeft}
                    className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
                      canScrollAvatarLeft ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                    }`}
                    style={{
                      backgroundColor: canScrollAvatarLeft ? 'var(--theme-muted-bg)' : 'rgba(0,0,0,0.12)',
                      color: canScrollAvatarLeft ? '#d1d5db' : '#6b7280',
                    }}
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
                      canScrollAvatarRight ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                    }`}
                    style={{
                      backgroundColor: canScrollAvatarRight ? 'var(--theme-muted-bg)' : 'rgba(0,0,0,0.12)',
                      color: canScrollAvatarRight ? '#d1d5db' : '#6b7280',
                    }}
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
                <div className="flex gap-3 pb-2 sm:gap-4">
                  {AVATAR_PRESETS.map((avatar) => {
                    const active = avatar.id === selectedAvatar;

                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => chooseAvatar(avatar.id)}
                        className="group min-w-[130px] cursor-pointer rounded-2xl border-[1.5px] bg-black/20 p-3 text-center transition duration-300 sm:min-w-[150px] sm:p-4"
                        style={{
                          borderColor: active ? 'var(--theme-accent-border)' : 'var(--theme-muted-border)',
                          boxShadow: active ? '0 0 24px var(--theme-accent-glow)' : 'none',
                        }}
                      >
                        <div className="flex justify-center">
                          <AvatarBubble avatarId={avatar.id} size="card" />
                        </div>

                        <p className="mt-3 text-sm font-medium text-white transition group-hover:text-[color:var(--theme-accent-text)] sm:mt-4">
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

      <footer className="px-4 pb-8 pt-2 text-center text-sm text-gray-400 sm:px-6 lg:px-8">
        <p>This site does not host or store any media.</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
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