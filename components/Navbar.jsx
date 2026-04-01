'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { get, off, onValue, ref } from 'firebase/database';
import PartyModal from '@/components/PartyModal';
import PartyControlModal from '@/components/PartyControlModal';
import useAdmin from '@/hooks/useAdmin';
import {
  app,
  db,
  clearLastPartySession,
  clearPartyStayPrompt,
  clearRecentPartyLogout,
  cleanupExpiredPartyMembers,
  getLastPartySession,
  getPartyStayPromptAt,
  HOST_LOGOUT_GRACE_MS,
  isRecentPartyLogoutActive,
  joinParty,
  leaveParty,
  markPartyLogoutGrace,
  markRecentPartyLogout,
  MEMBER_LOGOUT_GRACE_MS,
  revivePartyMember,
  schedulePartyStayPrompt,
  setLastPartySession,
  setPartyMedia,
  touchPartyMember,
} from '@/lib/firebaseParty';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w92';

export default function Navbar() {
  const [browseOpen, setBrowseOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [logoClick, setLogoClick] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [partyControlsOpen, setPartyControlsOpen] = useState(false);
  const [inParty, setInParty] = useState(false);
  const [partyCode, setPartyCode] = useState('');
  const [resultsPulse, setResultsPulse] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [stayPromptOpen, setStayPromptOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [rejoinPromptOpen, setRejoinPromptOpen] = useState(false);
  const [rejoinPromptMode, setRejoinPromptMode] = useState('member');
  const [rejoinPromptCode, setRejoinPromptCode] = useState('');
  const [rejoinPromptPending, setRejoinPromptPending] = useState(false);

  const [partyJumpPromptOpen, setPartyJumpPromptOpen] = useState(false);
  const [partyJumpTarget, setPartyJumpTarget] = useState(null);

  const [draftType, setDraftType] = useState('all');
  const [draftSort, setDraftSort] = useState('newest');
  const [draftMinRating, setDraftMinRating] = useState('0');
  const [draftYearFrom, setDraftYearFrom] = useState('');
  const [draftYearTo, setDraftYearTo] = useState('');

  const browseRef = useRef(null);
  const searchRef = useRef(null);
  const filterRef = useRef(null);
  const resultsScrollRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const partyUnsubRef = useRef(null);
  const partyHeartbeatRef = useRef(null);
  const hostIdRef = useRef('');
  const partyCodeRef = useRef('');
  const inPartyRef = useRef(false);
  const rejoinCheckedRef = useRef(false);
  const lastPromptedPlaybackSignatureRef = useRef('');
  const suppressNextPromptRef = useRef(false);

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin } = useAdmin();

  const isProfilePage = pathname === '/profile';
  const isSearchPage = pathname === '/search';
  const isHomePage = pathname === '/';
  const isWatchPage = pathname === '/watch';
  const isLiveSportsWatchPage = pathname === '/livesports/watch';
  const isAdminPage = pathname === '/admin';
  const isActivePartyPlaybackPage = isWatchPage || isLiveSportsWatchPage;

  const glassPanelStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-navbar-bg) 88%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-navbar-bg) 94%, rgba(0,0,0,0.04)))',
    border: '1px solid color-mix(in srgb, var(--theme-accent-border) 60%, rgba(255,255,255,0.06))',
    boxShadow:
      '0 18px 44px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -1px 0 rgba(255,255,255,0.02)',
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
  };

  const glassDropdownStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-panel-from) 80%, rgba(255,255,255,0.07)), color-mix(in srgb, var(--theme-panel-to) 90%, rgba(255,255,255,0.02)))',
    border: '1px solid color-mix(in srgb, var(--theme-accent-border) 68%, rgba(255,255,255,0.08))',
    boxShadow:
      '0 22px 50px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.03)',
    backdropFilter: 'blur(22px) saturate(155%)',
    WebkitBackdropFilter: 'blur(22px) saturate(155%)',
  };

  const ghostButtonStyle = {
    borderColor: 'color-mix(in srgb, var(--theme-muted-border) 92%, rgba(255,255,255,0.08))',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-muted-bg) 78%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-muted-bg-strong) 88%, rgba(255,255,255,0.02)))',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 20px rgba(0,0,0,0.16)',
    backdropFilter: 'blur(16px) saturate(140%)',
    WebkitBackdropFilter: 'blur(16px) saturate(140%)',
  };

  const accentButtonStyle = {
    borderColor: 'color-mix(in srgb, var(--theme-accent-border) 90%, rgba(255,255,255,0.06))',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 86%, rgba(255,255,255,0.12)), color-mix(in srgb, var(--theme-accent-hover) 90%, rgba(0,0,0,0.05)))',
    boxShadow:
      '0 12px 26px color-mix(in srgb, var(--theme-accent-glow) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.16)',
    color: 'var(--theme-accent-contrast)',
    backdropFilter: 'blur(16px) saturate(145%)',
    WebkitBackdropFilter: 'blur(16px) saturate(145%)',
  };

  const accentButtonDisabledStyle = {
    borderColor: 'color-mix(in srgb, var(--theme-accent-border) 55%, rgba(255,255,255,0.05))',
    background: 'var(--theme-accent-disabled-bg)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    color: 'var(--theme-accent-disabled-text)',
  };

  const yellowGlassButtonStyle = {
    borderColor: 'rgba(250, 204, 21, 0.34)',
    background:
      'linear-gradient(180deg, rgba(250, 204, 21, 0.82), rgba(234, 179, 8, 0.72))',
    boxShadow:
      '0 12px 24px rgba(250, 204, 21, 0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
    color: '#111111',
    backdropFilter: 'blur(16px) saturate(145%)',
    WebkitBackdropFilter: 'blur(16px) saturate(145%)',
  };

  const themedButtonClass =
    'cursor-pointer rounded-xl border backdrop-blur-md transition duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20';

  const themedGhostButtonClass =
    `${themedButtonClass} text-white/90 hover:text-white hover:border-[color:var(--theme-accent-border)]`;

  const themedAccentButtonClass =
    `${themedButtonClass} hover:brightness-[1.04]`;

  const armInitialPartyFollow = () => {
    localStorage.setItem('kflix_party_auto_follow_armed', 'true');
  };

  const consumeInitialPartyFollow = () => {
    const armed = localStorage.getItem('kflix_party_auto_follow_armed') === 'true';
    if (armed) {
      localStorage.setItem('kflix_party_auto_follow_armed', 'false');
    }
    return armed;
  };

  const resetInitialPartyFollow = () => {
    localStorage.setItem('kflix_party_auto_follow_armed', 'false');
  };

  const syncPartyStateFromStorage = () => {
    const savedCode = localStorage.getItem('kflix_current_party_code') || '';
    const savedInParty = localStorage.getItem('kflix_in_party') === 'true';
    setPartyCode(savedCode);
    setInParty(savedInParty);
    partyCodeRef.current = savedCode;
    inPartyRef.current = savedInParty;
  };

  const dispatchPartyUpdate = () => {
    window.dispatchEvent(new Event('kflix-party-updated'));
  };

  const flushWatchProgressBeforeNav = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('kflix-flush-continue-watching'));
  };

  const persistCurrentPartyState = (code, active) => {
    const nextCode = code || '';
    const nextActive = Boolean(active);
    const currentStoredCode = localStorage.getItem('kflix_current_party_code') || '';
    const currentStoredActive = localStorage.getItem('kflix_in_party') === 'true';

    const changed =
      currentStoredCode !== nextCode || currentStoredActive !== nextActive;

    if (changed) {
      localStorage.setItem('kflix_current_party_code', nextCode);
      localStorage.setItem('kflix_in_party', nextActive ? 'true' : 'false');
    }

    if (nextActive && nextCode) {
      if (!localStorage.getItem('kflix_party_joined_at')) {
        localStorage.setItem('kflix_party_joined_at', String(Date.now()));
      }

      if (!getPartyStayPromptAt()) {
        schedulePartyStayPrompt();
      }
    } else {
      localStorage.removeItem('kflix_party_joined_at');
      clearPartyStayPrompt();
      setStayPromptOpen(false);
      hostIdRef.current = '';
      resetInitialPartyFollow();
      setPartyJumpPromptOpen(false);
      setPartyJumpTarget(null);
      lastPromptedPlaybackSignatureRef.current = '';
    }

    setPartyCode((prev) => (prev === nextCode ? prev : nextCode));
    setInParty((prev) => (prev === nextActive ? prev : nextActive));
    partyCodeRef.current = nextCode;
    inPartyRef.current = nextActive;

    if (changed) {
      dispatchPartyUpdate();
    }
  };

  const buildPartyPlaybackTargetUrl = (playback) => {
    if (!playback) return '';

    const mediaType = String(playback.mediaType || '');
    if (!mediaType) return '';

    if (mediaType === 'live') {
      const params = new URLSearchParams();

      if (playback.sourcesParam) {
        params.set('sources', playback.sourcesParam);
      }

      params.set('sourceIndex', String(playback.sourceIndex ?? 0));
      params.set('streamIndex', String(playback.streamIndex ?? 0));
      params.set('partyFollow', '1');

      return `/livesports/watch?${params.toString()}`;
    }

    const mediaId = String(playback.mediaId || '');
    if (!mediaId) return '';

    const params = new URLSearchParams();
    params.set('type', mediaType);
    params.set('id', mediaId);
    params.set('t', String(Math.max(0, Math.floor(Number(playback.currentTime || 0)))));
    params.set('autoplay', playback.isPlaying ? '1' : '0');
    params.set('partyFollow', '1');

    if (mediaType === 'tv') {
      if (playback.season !== undefined && playback.season !== null && String(playback.season) !== '') {
        params.set('season', String(playback.season));
      }

      if (playback.episode !== undefined && playback.episode !== null && String(playback.episode) !== '') {
        params.set('episode', String(playback.episode));
      }
    }

    return `/watch?${params.toString()}`;
  };

  const isSamePlaybackTargetAsCurrentPage = (playback) => {
    const mediaType = String(playback?.mediaType || '');
    if (!mediaType) return false;

    if (mediaType === 'live') {
      return pathname === '/livesports/watch';
    }

    if (pathname !== '/watch') return false;

    const currentType = searchParams.get('type') || '';
    const currentId = searchParams.get('id') || '';
    const currentSeason = searchParams.get('season') || '';
    const currentEpisode = searchParams.get('episode') || '';

    const playbackType = String(playback.mediaType || '');
    const playbackId = String(playback.mediaId || '');
    const playbackSeason =
      playback.season !== undefined && playback.season !== null ? String(playback.season) : '';
    const playbackEpisode =
      playback.episode !== undefined && playback.episode !== null ? String(playback.episode) : '';

    return (
      currentType === playbackType &&
      currentId === playbackId &&
      (playbackType !== 'tv' ||
        (currentSeason === playbackSeason && currentEpisode === playbackEpisode))
    );
  };

  const handleAcceptPartyJump = () => {
    if (!partyJumpTarget?.url) {
      setPartyJumpPromptOpen(false);
      setPartyJumpTarget(null);
      return;
    }

    suppressNextPromptRef.current = true;
    const targetUrl = partyJumpTarget.url;
    setPartyJumpPromptOpen(false);
    setPartyJumpTarget(null);
    router.replace(targetUrl);
  };

  const handleDeclinePartyJump = () => {
    setPartyJumpPromptOpen(false);
    setPartyJumpTarget(null);
  };

  useEffect(() => {
    syncPartyStateFromStorage();
  }, []);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);

      if (!currentUser) {
        const activeInParty = localStorage.getItem('kflix_in_party') === 'true';
        if (activeInParty && isRecentPartyLogoutActive()) {
          persistCurrentPartyState('', false);
        }
        rejoinCheckedRef.current = false;
        return;
      }

      clearRecentPartyLogout();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || rejoinCheckedRef.current) return;

    const run = async () => {
      rejoinCheckedRef.current = true;

      const session = getLastPartySession();
      if (!session) return;
      if (session.userId && String(session.userId) !== String(user.uid)) return;

      const code = session.code || '';
      if (!code) {
        clearLastPartySession();
        return;
      }

      try {
        await cleanupExpiredPartyMembers(code);

        const partySnapshot = await get(ref(db, `parties/${code}`));
        if (!partySnapshot.exists()) {
          clearLastPartySession();
          return;
        }

        const party = partySnapshot.val() || {};
        const member = party?.members?.[user.uid] || null;

        if (!member) {
          clearLastPartySession();
          return;
        }

        const loggedOutAt = Number(member.loggedOutAt || 0);
        if (!loggedOutAt) {
          clearLastPartySession();
          return;
        }

        const timeout = member.isHost ? HOST_LOGOUT_GRACE_MS : MEMBER_LOGOUT_GRACE_MS;
        const stillValid = Date.now() - loggedOutAt < timeout;

        if (!stillValid) {
          clearLastPartySession();
          return;
        }

        setRejoinPromptCode(code);
        setRejoinPromptMode(member.isHost ? 'host' : 'member');
        setRejoinPromptOpen(true);
      } catch (error) {
        console.error('Failed to prepare rejoin prompt:', error);
      }
    };

    run();
  }, [user]);

  useEffect(() => {
    if (partyUnsubRef.current) {
      partyUnsubRef.current();
      partyUnsubRef.current = null;
    }

    if (partyHeartbeatRef.current) {
      clearInterval(partyHeartbeatRef.current);
      partyHeartbeatRef.current = null;
    }

    if (!partyCode) return;

    const partyRef = ref(db, `parties/${partyCode}`);
    const currentUserId = getAuth().currentUser?.uid;
    if (!currentUserId) return;

    const handlePartyValue = (snapshot) => {
      const party = snapshot.exists() ? snapshot.val() : null;

      if (!party) {
        persistCurrentPartyState('', false);
        setPartyControlsOpen(false);
        return;
      }

      hostIdRef.current = party.hostId || '';
      persistCurrentPartyState(partyCode, true);
    };

    onValue(partyRef, handlePartyValue);

    partyHeartbeatRef.current = setInterval(() => {
      const activeUserId = getAuth().currentUser?.uid;
      if (!activeUserId || !partyCodeRef.current || !inPartyRef.current) return;
      touchPartyMember(partyCodeRef.current, activeUserId);
      cleanupExpiredPartyMembers(partyCodeRef.current).catch(() => {});
    }, 10000);

    partyUnsubRef.current = () => {
      off(partyRef, 'value', handlePartyValue);
    };

    return () => {
      if (partyUnsubRef.current) {
        partyUnsubRef.current();
        partyUnsubRef.current = null;
      }

      if (partyHeartbeatRef.current) {
        clearInterval(partyHeartbeatRef.current);
        partyHeartbeatRef.current = null;
      }
    };
  }, [partyCode]);

  useEffect(() => {
    syncPartyStateFromStorage();

    const handleStorage = (event) => {
      if (!event.key || event.key === 'kflix_current_party_code' || event.key === 'kflix_in_party') {
        syncPartyStateFromStorage();
      }
    };

    const handlePartyUpdated = () => {
      syncPartyStateFromStorage();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncPartyStateFromStorage();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('kflix-party-updated', handlePartyUpdated);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('kflix-party-updated', handlePartyUpdated);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!user?.uid || !partyCode || !inParty) return;
    if (!hostIdRef.current || String(hostIdRef.current) !== String(user.uid)) return;
    if (isActivePartyPlaybackPage) return;

    setPartyMedia(partyCode, {
      mediaType: null,
      mediaId: null,
      season: null,
      episode: null,
      currentTime: 0,
      isPlaying: false,
      updatedBy: user.uid,
      route: '',
      sourceIndex: 0,
      streamIndex: 0,
      sourcesParam: '',
    }).catch((error) => {
      console.error('Failed to clear stale host playback from navbar:', error);
    });
  }, [user?.uid, partyCode, inParty, isActivePartyPlaybackPage]);

  useEffect(() => {
    if (!partyCode || !inParty) return;

    const currentUserId = getAuth().currentUser?.uid;
    if (!currentUserId) return;
    if (String(hostIdRef.current || '') === String(currentUserId)) return;

    const shouldAutoFollowInitial = consumeInitialPartyFollow();
    const playbackRef = ref(db, `parties/${partyCode}/playback`);

    const unsubscribe = onValue(playbackRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const playback = snapshot.val() || {};
      const mediaType = String(playback.mediaType || '');
      const route = String(playback.route || '');

      if (!mediaType) return;
      if (route !== '/watch' && route !== '/livesports/watch') return;

      const targetUrl = buildPartyPlaybackTargetUrl(playback);
      if (!targetUrl) return;

      const signature = [
        mediaType,
        String(playback.mediaId || ''),
        String(playback.season ?? ''),
        String(playback.episode ?? ''),
        route,
        String(playback.updatedAt || ''),
      ].join('|');

      const alreadyPrompted = signature === lastPromptedPlaybackSignatureRef.current;
      const sameAsCurrentPage = isSamePlaybackTargetAsCurrentPage(playback);

      if (shouldAutoFollowInitial && !alreadyPrompted) {
        lastPromptedPlaybackSignatureRef.current = signature;
        suppressNextPromptRef.current = true;
        router.replace(targetUrl);
        return;
      }

      if (sameAsCurrentPage) return;
      if (alreadyPrompted) return;

      if (suppressNextPromptRef.current) {
        suppressNextPromptRef.current = false;
        lastPromptedPlaybackSignatureRef.current = signature;
        return;
      }

      lastPromptedPlaybackSignatureRef.current = signature;
      setPartyJumpTarget({
        url: targetUrl,
        mediaType,
      });
      setPartyJumpPromptOpen(true);
    });

    return () => unsubscribe();
  }, [partyCode, inParty, pathname, router, searchParams]);

  useEffect(() => {
    if (isSearchPage) {
      setSearchQuery(searchParams.get('q') || '');
      setDraftType(searchParams.get('type') || 'all');
      setDraftSort(searchParams.get('sort') || 'newest');
      setDraftMinRating(searchParams.get('minRating') || '0');
      setDraftYearFrom(searchParams.get('yearFrom') || '');
      setDraftYearTo(searchParams.get('yearTo') || '');
    }
  }, [isSearchPage, searchParams]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.__kflixLockNavbarVisibility) {
        lastScrollYRef.current = window.scrollY;
        return;
      }

      const currentY = window.scrollY;
      setNavVisible(currentY <= 8);
      lastScrollYRef.current = currentY;
    };

    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchResults = async (query) => {
    if (!query.trim()) {
      setResults([]);
      setSearchOpen(false);
      return;
    }

    const res = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`
    );

    const data = await res.json();

    const filtered = (data.results || [])
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, 6);

    setResults(filtered);
    setSearchOpen(filtered.length > 0);
    setResultsPulse(true);
    setTimeout(() => setResultsPulse(false), 220);
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      if (!searchQuery.trim()) {
        setResults([]);
        setSearchOpen(false);
        return;
      }

      fetchResults(searchQuery);
    }, 250);

    return () => clearTimeout(delay);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (browseRef.current && !browseRef.current.contains(e.target)) {
        setBrowseOpen(false);
      }

      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
        setFocused(false);
      }

      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const el = resultsScrollRef.current;
    if (!el) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }

    const updateScrollButtons = () => {
      setCanScrollUp(el.scrollTop > 4);
      setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    };

    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);

    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [results, searchOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setBrowseOpen(false);
    setFilterOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const scrollResults = (direction) => {
    const el = resultsScrollRef.current;
    if (!el) return;

    el.scrollBy({
      top: direction === 'up' ? -180 : 180,
      behavior: 'smooth',
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set('q', searchQuery.trim());

    if (isSearchPage) {
      router.replace(`/search?${params.toString()}`);
    } else {
      router.push(`/search?${params.toString()}`);
    }

    setSearchOpen(false);
    setFocused(false);
    setMobileMenuOpen(false);
  };

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    if (draftType === 'all') params.delete('type');
    else params.set('type', draftType);

    if (draftSort === 'newest') params.delete('sort');
    else params.set('sort', draftSort);

    if (draftMinRating === '0') params.delete('minRating');
    else params.set('minRating', draftMinRating);

    if (draftYearFrom.trim()) params.set('yearFrom', draftYearFrom.trim());
    else params.delete('yearFrom');

    if (draftYearTo.trim()) params.set('yearTo', draftYearTo.trim());
    else params.delete('yearTo');

    router.push(`/search${params.toString() ? `?${params.toString()}` : ''}`);
    setFilterOpen(false);
    setMobileMenuOpen(false);
  };

  const resetFilters = () => {
    setDraftType('all');
    setDraftSort('newest');
    setDraftMinRating('0');
    setDraftYearFrom('');
    setDraftYearTo('');

    const params = new URLSearchParams(searchParams.toString());
    params.delete('type');
    params.delete('sort');
    params.delete('minRating');
    params.delete('yearFrom');
    params.delete('yearTo');

    router.push(`/search${params.toString() ? `?${params.toString()}` : ''}`);
    setFilterOpen(false);
  };

  const targetHref = user ? '/' : '/login';

  const handleLogoClick = () => {
    if (pathname === targetHref) {
      setLogoClick(true);
      setTimeout(() => setLogoClick(false), 520);
    }
  };

  const handlePartyJoined = async (code) => {
    try {
      const currentUserId = getAuth().currentUser?.uid;
      if (!currentUserId) return;

      await joinParty(code, currentUserId);
      schedulePartyStayPrompt();
      armInitialPartyFollow();
      persistCurrentPartyState(code, true);
      clearRecentPartyLogout();
      clearLastPartySession();
      setPartyOpen(false);
      setMobileMenuOpen(false);
    } catch (err) {
      console.error('Join failed:', err);
    }
  };

  const handleCreateParty = async (code) => {
    schedulePartyStayPrompt();
    resetInitialPartyFollow();
    persistCurrentPartyState(code, true);
    clearRecentPartyLogout();
    clearLastPartySession();
    setPartyOpen(false);
    setMobileMenuOpen(false);
  };

  const handleLeaveParty = async () => {
    try {
      const currentUserId = getAuth().currentUser?.uid;
      if (!currentUserId || !partyCode) return;

      await leaveParty(partyCode, currentUserId);
      clearLastPartySession();
      markRecentPartyLogout(partyCode);
      clearPartyStayPrompt();
      resetInitialPartyFollow();
      persistCurrentPartyState('', false);
      setPartyControlsOpen(false);
    } catch (error) {
      console.error('Failed to leave party:', error);
      clearLastPartySession();
      markRecentPartyLogout(partyCode);
      clearPartyStayPrompt();
      resetInitialPartyFollow();
      persistCurrentPartyState('', false);
      setPartyControlsOpen(false);
    }
  };

  const handleStayInParty = () => {
    schedulePartyStayPrompt();
    setStayPromptOpen(false);
  };

  const handleLeaveFromPrompt = async () => {
    setStayPromptOpen(false);
    await handleLeaveParty();
  };

  const handlePartyButtonClick = () => {
    if (inParty) setPartyControlsOpen(true);
    else setPartyOpen(true);
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);

      const preservedTheme =
        localStorage.getItem('kflix_theme') ||
        localStorage.getItem('kflix_selected_theme') ||
        localStorage.getItem('theme') ||
        document.documentElement.getAttribute('data-theme') ||
        'noir';

      document.documentElement.setAttribute('data-theme', preservedTheme);
      localStorage.setItem('kflix_theme', preservedTheme);
      localStorage.setItem('kflix_selected_theme', preservedTheme);
      localStorage.setItem('theme', preservedTheme);
      window.dispatchEvent(new Event('kflix-theme-updated'));

      const auth = getAuth(app);
      const currentUserId = auth.currentUser?.uid;
      const activePartyCode = partyCode || localStorage.getItem('kflix_current_party_code') || '';

      if (currentUserId && activePartyCode) {
        const memberSnapshot = await get(ref(db, `parties/${activePartyCode}/members/${currentUserId}`));
        const member = memberSnapshot.exists() ? memberSnapshot.val() || {} : null;

        await markPartyLogoutGrace(activePartyCode, currentUserId);

        if (member) {
          setLastPartySession({
            code: activePartyCode,
            userId: currentUserId,
            isHost: Boolean(member.isHost),
            logoutAt: Date.now(),
          });
        }

        markRecentPartyLogout(activePartyCode);
      } else {
        markRecentPartyLogout(activePartyCode);
        clearLastPartySession();
      }

      clearPartyStayPrompt();
      resetInitialPartyFollow();
      persistCurrentPartyState('', false);

      await signOut(auth);

      document.documentElement.setAttribute('data-theme', preservedTheme);
      localStorage.setItem('kflix_theme', preservedTheme);
      localStorage.setItem('kflix_selected_theme', preservedTheme);
      localStorage.setItem('theme', preservedTheme);
      window.dispatchEvent(new Event('kflix-theme-updated'));

      setMobileMenuOpen(false);
      router.push('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
      setSigningOut(false);
    }
  };

  const handleRejoinAccept = async () => {
    if (!user || !rejoinPromptCode) return;

    try {
      setRejoinPromptPending(true);

      const partySnapshot = await get(ref(db, `parties/${rejoinPromptCode}`));
      if (!partySnapshot.exists()) {
        clearLastPartySession();
        setRejoinPromptOpen(false);
        setRejoinPromptCode('');
        return;
      }

      if (rejoinPromptMode === 'host') {
        await revivePartyMember(rejoinPromptCode, user.uid);
        persistCurrentPartyState(rejoinPromptCode, true);
        schedulePartyStayPrompt();
      } else {
        await revivePartyMember(rejoinPromptCode, user.uid);
        persistCurrentPartyState(rejoinPromptCode, true);
        schedulePartyStayPrompt();
        armInitialPartyFollow();
      }

      clearLastPartySession();
      clearRecentPartyLogout();
      setRejoinPromptOpen(false);
      setRejoinPromptCode('');
      setRejoinPromptPending(false);
    } catch (error) {
      console.error('Failed to restore party session:', error);
      setRejoinPromptPending(false);
    }
  };

  const handleRejoinDecline = async () => {
    if (!user || !rejoinPromptCode) {
      clearLastPartySession();
      setRejoinPromptOpen(false);
      setRejoinPromptCode('');
      return;
    }

    try {
      setRejoinPromptPending(true);
      await leaveParty(rejoinPromptCode, user.uid);
    } catch (error) {
      console.error('Failed to close pending party session:', error);
    } finally {
      clearLastPartySession();
      persistCurrentPartyState('', false);
      setRejoinPromptOpen(false);
      setRejoinPromptCode('');
      setRejoinPromptPending(false);
    }
  };

  const handleBackClick = () => {
    setMobileMenuOpen(false);

    if (isWatchPage) {
      flushWatchProgressBeforeNav();
    }

    if (isWatchPage) {
      const watchType = searchParams.get('type') || '';
      const watchId = searchParams.get('id') || '';

      if (watchType === 'movie' && watchId) {
        router.push(`/movie/${watchId}`);
        return;
      }

      if (watchType === 'tv' && watchId) {
        router.push(`/tv/${watchId}`);
        return;
      }
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(targetHref);
  };

  const filterActive =
    draftType !== 'all' ||
    draftSort !== 'newest' ||
    draftMinRating !== '0' ||
    draftYearFrom.trim() ||
    draftYearTo.trim();

  const logoNode = (
    <div
      className="flex h-10 items-center px-1 sm:h-11"
      style={{
        color: 'var(--theme-accent-text)',
        fontFamily: 'GeomGraphicW03-Bold-Italic, sans-serif',
        fontWeight: 700,
        fontStyle: 'italic',
        textShadow: '0 2px 10px color-mix(in srgb, var(--theme-accent-glow) 28%, transparent)',
      }}
    >
      <span className="text-[1.5rem] leading-none sm:text-[1.8rem]">
        KFlix Streaming
      </span>
    </div>
  );

  return (
    <>
      <style jsx global>{`
        @keyframes kflixLogoPulse {
          0% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          28% {
            transform: scale(0.92) rotate(-1deg);
            opacity: 0.9;
          }
          58% {
            transform: scale(1.08) rotate(1deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
      `}</style>

      <nav
        className={`fixed left-0 top-0 z-50 flex h-16 w-full items-center justify-between px-4 transition-all duration-300 sm:h-20 sm:px-6 lg:px-8 ${
          navVisible
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-full opacity-0'
        }`}
        style={glassPanelStyle}
      >
        <div className="flex items-center">
          {pathname === targetHref ? (
            <button
              type="button"
              onClick={handleLogoClick}
              className="cursor-pointer bg-transparent p-0"
              aria-label="KFlix home"
              style={{
                animation: logoClick ? 'kflixLogoPulse 0.52s ease' : 'none',
              }}
            >
              {logoNode}
            </button>
          ) : (
            <Link
              href={targetHref}
              aria-label="KFlix home"
              className="cursor-pointer"
              onClick={() => {
                if (isWatchPage) {
                  flushWatchProgressBeforeNav();
                }
              }}
            >
              {logoNode}
            </Link>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          {!isHomePage && (
            <button
              type="button"
              onClick={handleBackClick}
              className={`flex h-10 w-10 items-center justify-center ${themedGhostButtonClass}`}
              style={ghostButtonStyle}
              aria-label="Go back"
              title="Back"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={`flex h-10 w-10 items-center justify-center ${themedGhostButtonClass}`}
            style={ghostButtonStyle}
            aria-label="Open menu"
            title="Open menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <div className="absolute left-1/2 hidden w-full max-w-[560px] -translate-x-1/2 items-center gap-2 px-4 lg:flex">
          {isSearchPage && (
            <div ref={filterRef} className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((prev) => !prev)}
                className={`flex h-10 items-center gap-2 px-4 text-sm font-semibold ${
                  filterActive ? themedAccentButtonClass : themedGhostButtonClass
                }`}
                style={filterActive ? accentButtonStyle : ghostButtonStyle}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 6h16" />
                  <path d="M7 12h10" />
                  <path d="M10 18h4" />
                </svg>
                Filter
              </button>

              <div
                className={`absolute left-0 top-full mt-3 w-[360px] overflow-hidden rounded-2xl transition-all duration-200 ${
                  filterOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
                }`}
                style={glassDropdownStyle}
              >
                <div
                  className="flex items-center justify-between border-b px-4 py-3"
                  style={{
                    borderColor: 'rgba(255,255,255,0.06)',
                    backgroundColor: 'var(--theme-accent-soft)',
                  }}
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                    Search Filters
                  </span>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="cursor-pointer text-xs font-medium text-gray-300 transition hover:text-[color:var(--theme-accent-text)]"
                  >
                    Reset
                  </button>
                </div>

                <div className="space-y-5 px-4 py-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                      Content Type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'all', label: 'All' },
                        { value: 'movies', label: 'Movies' },
                        { value: 'tv', label: 'Shows' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDraftType(option.value)}
                          className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition ${
                            draftType === option.value
                              ? 'shadow-[0_0_18px_var(--theme-accent-glow)]'
                              : 'text-white hover:text-[color:var(--theme-accent-text)]'
                          }`}
                          style={draftType === option.value ? accentButtonStyle : ghostButtonStyle}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                      Sort By
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'newest', label: 'Newest' },
                        { value: 'oldest', label: 'Oldest' },
                        { value: 'top', label: 'Top Rated' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDraftSort(option.value)}
                          className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition ${
                            draftSort === option.value
                              ? 'shadow-[0_0_18px_var(--theme-accent-glow)]'
                              : 'text-white hover:text-[color:var(--theme-accent-text)]'
                          }`}
                          style={draftSort === option.value ? accentButtonStyle : ghostButtonStyle}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                      Minimum TMDB Rating
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['0', '4', '5', '6', '7', '8', '9'].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setDraftMinRating(rating)}
                          className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition ${
                            draftMinRating === rating
                              ? 'shadow-[0_0_18px_var(--theme-accent-glow)]'
                              : 'text-white hover:text-[color:var(--theme-accent-text)]'
                          }`}
                          style={draftMinRating === rating ? accentButtonStyle : ghostButtonStyle}
                        >
                          {rating === '0' ? 'Any' : `${rating}+`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                      Year Range
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="From"
                        min="1900"
                        max="2100"
                        value={draftYearFrom}
                        onChange={(e) => setDraftYearFrom(e.target.value)}
                        className="h-10 rounded-xl border px-3 text-sm text-white placeholder:text-gray-400 focus:outline-none"
                        style={ghostButtonStyle}
                      />
                      <input
                        type="number"
                        placeholder="To"
                        min="1900"
                        max="2100"
                        value={draftYearTo}
                        onChange={(e) => setDraftYearTo(e.target.value)}
                        className="h-10 rounded-xl border px-3 text-sm text-white placeholder:text-gray-400 focus:outline-none"
                        style={ghostButtonStyle}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={applyFilters}
                      className={`flex h-10 flex-1 items-center justify-center text-sm font-semibold ${themedAccentButtonClass}`}
                      style={accentButtonStyle}
                    >
                      Apply Filters
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterOpen(false)}
                      className={`flex h-10 items-center justify-center px-4 text-sm font-semibold ${themedGhostButtonClass}`}
                      style={ghostButtonStyle}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={searchRef} className="relative flex-1">
            <form onSubmit={handleSearch} className="flex items-stretch">
              <input
                type="text"
                placeholder="Search..."
                className={`h-10 min-w-0 flex-1 rounded-l-xl border px-4 text-sm transition-all duration-200 placeholder:text-gray-500 focus:outline-none ${
                  focused ? 'shadow-[0_0_16px_var(--theme-accent-glow)]' : ''
                }`}
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.90))',
                  color: '#000000',
                  borderColor: focused ? 'var(--theme-accent-border)' : 'rgba(255,255,255,0.22)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                }}
                value={searchQuery}
                onFocus={() => setFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <button
                type="submit"
                className={`flex h-10 items-center gap-2 rounded-r-xl border px-4 text-sm font-semibold ${themedAccentButtonClass}`}
                style={{
                  ...accentButtonStyle,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  marginLeft: '-1px',
                }}
              >
                <span>Search</span>
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </button>
            </form>

            <div
              className={`absolute left-0 top-full mt-3 w-full overflow-hidden rounded-2xl transition-all duration-200 ${
                searchOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
              } ${
                resultsPulse ? 'ring-1 shadow-[0_0_20px_var(--theme-accent-glow)]' : ''
              }`}
              style={glassDropdownStyle}
            >
              {searchOpen && (
                <div
                  className="flex items-center justify-between border-b px-4 py-2.5"
                  style={{
                    borderColor: 'rgba(255,255,255,0.06)',
                    backgroundColor: 'var(--theme-accent-soft)',
                  }}
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                    Top Results
                  </span>
                  <span className="text-[11px] text-gray-300">{results.length} shown</span>
                </div>
              )}

              <div className="relative">
                {canScrollUp && (
                  <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2">
                    <button
                      type="button"
                      onClick={() => scrollResults('up')}
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${themedGhostButtonClass}`}
                      style={ghostButtonStyle}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M6 15l6-6 6 6" />
                      </svg>
                    </button>
                  </div>
                )}

                {canScrollDown && (
                  <div className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2">
                    <button
                      type="button"
                      onClick={() => scrollResults('down')}
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${themedGhostButtonClass}`}
                      style={ghostButtonStyle}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                )}

                <div
                  ref={resultsScrollRef}
                  className="max-h-[360px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  {results.map((item, index) => (
                    <Link
                      key={`${item.media_type}-${item.id}`}
                      href={item.media_type === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`}
                      className="cursor-pointer"
                      onClick={() => {
                        setSearchOpen(false);
                        setFocused(false);
                      }}
                    >
                      <div
                        className={`group flex cursor-pointer items-center gap-3 px-4 py-3 transition-all duration-200 ${
                          index !== results.length - 1 ? 'border-b border-white/5' : ''
                        }`}
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--theme-accent-soft)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-gray-700 ring-1 ring-white/10 transition group-hover:ring-[color:var(--theme-accent-border)]">
                          {item.poster_path ? (
                            <img
                              src={`${IMAGE_BASE}${item.poster_path}`}
                              className="h-full w-full object-cover"
                              alt={item.title || item.name || 'Poster'}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-300">
                              N/A
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-white transition group-hover:text-[color:var(--theme-accent-text)]">
                              {item.title || item.name}
                            </span>

                            <span
                              className="rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
                              style={{
                                borderColor: 'var(--theme-accent-border)',
                                backgroundColor: 'var(--theme-accent-soft)',
                                color: 'var(--theme-accent-text)',
                              }}
                            >
                              {item.media_type}
                            </span>
                          </div>

                          <div className="mt-1 truncate text-xs text-gray-400">
                            {item.release_date || item.first_air_date || 'No date available'}
                          </div>
                        </div>

                        <svg
                          className="h-4 w-4 flex-shrink-0 transition group-hover:translate-x-0.5"
                          style={{ color: 'var(--theme-accent-text)' }}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ml-auto hidden items-center space-x-2 lg:flex">
          {!isHomePage && (
            <button
              type="button"
              onClick={handleBackClick}
              className={`flex h-10 items-center gap-2 px-4 text-sm font-semibold ${themedGhostButtonClass}`}
              style={ghostButtonStyle}
            >
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 6l-6 6 6 6" />
              </svg>
              Back
            </button>
          )}

          {isAdmin && !isAdminPage && (
            <Link href="/admin" className="cursor-pointer">
              <span
                className="flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-95"
                style={yellowGlassButtonStyle}
              >
                Admin
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
                </svg>
              </span>
            </Link>
          )}

          {!isSearchPage && (
            <div ref={browseRef} className="relative">
              <button
                onClick={() => setBrowseOpen(!browseOpen)}
                className={`flex h-10 cursor-pointer items-center gap-2 px-4 text-sm font-semibold ${themedAccentButtonClass}`}
                style={accentButtonStyle}
                type="button"
              >
                Browse
                <svg className={`h-4 w-4 transition ${browseOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              <div
                className={`absolute left-0 top-full mt-3 min-w-[220px] overflow-hidden rounded-2xl transition-all duration-200 ${
                  browseOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
                }`}
                style={glassDropdownStyle}
              >
                <div
                  className="border-b px-4 py-2.5"
                  style={{
                    borderColor: 'rgba(255,255,255,0.06)',
                    backgroundColor: 'var(--theme-accent-soft)',
                  }}
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                    Browse
                  </span>
                </div>

                <Link href="/search?type=movies" className="cursor-pointer">
                  <div className="group flex cursor-pointer items-center justify-between px-4 py-3 transition-all duration-200 hover:text-[color:var(--theme-accent-text)]">
                    <span className="text-sm font-medium text-white transition group-hover:text-[color:var(--theme-accent-text)]">
                      Movies
                    </span>
                    <svg className="h-4 w-4 transition group-hover:translate-x-0.5" style={{ color: 'var(--theme-accent-text)' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </Link>

                <div className="border-t border-white/5" />

                <Link href="/search?type=tv" className="cursor-pointer">
                  <div className="group flex cursor-pointer items-center justify-between px-4 py-3 transition-all duration-200 hover:text-[color:var(--theme-accent-text)]">
                    <span className="text-sm font-medium text-white transition group-hover:text-[color:var(--theme-accent-text)]">
                      Shows
                    </span>
                    <svg className="h-4 w-4 transition group-hover:translate-x-0.5" style={{ color: 'var(--theme-accent-text)' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </Link>

                <div className="border-t border-white/5" />

                <Link href="/search?type=tv&tab=anime" className="cursor-pointer">
                  <div className="group flex cursor-pointer items-center justify-between px-4 py-3 transition-all duration-200 hover:text-[color:var(--theme-accent-text)]">
                    <span className="text-sm font-medium text-white transition group-hover:text-[color:var(--theme-accent-text)]">
                      Anime
                    </span>
                    <svg className="h-4 w-4 transition group-hover:translate-x-0.5" style={{ color: 'var(--theme-accent-text)' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </Link>

                <div className="border-t border-white/5" />

                <Link href="/livesports" className="cursor-pointer">
                  <div className="group flex cursor-pointer items-center justify-between px-4 py-3 transition-all duration-200 hover:text-[color:var(--theme-accent-text)]">
                    <span className="text-sm font-medium text-white transition group-hover:text-[color:var(--theme-accent-text)]">
                      Live Sports
                    </span>
                    <svg className="h-4 w-4 transition group-hover:translate-x-0.5" style={{ color: 'var(--theme-accent-text)' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </Link>
              </div>
            </div>
          )}

          <button
            onClick={handlePartyButtonClick}
            className={`flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-95 ${
              inParty ? 'shadow-[0_0_16px_var(--theme-accent-glow)]' : ''
            }`}
            style={accentButtonStyle}
            type="button"
          >
            Party
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="9" cy="7" r="3" />
              <circle cx="15" cy="7" r="3" />
              <path d="M4 20c0-3 3-5 5-5" />
              <path d="M20 20c0-3-3-5-5-5" />
            </svg>
          </button>

          {isProfilePage ? (
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-95 ${
                signingOut ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
              }`}
              style={signingOut ? { ...accentButtonStyle, ...accentButtonDisabledStyle } : accentButtonStyle}
              type="button"
            >
              {signingOut ? 'Signing Out...' : 'Sign Out'}
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
              </svg>
            </button>
          ) : (
            <Link href="/profile" className="cursor-pointer">
              <span
                className="flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-95"
                style={accentButtonStyle}
              >
                Profile
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5z" />
                  <path d="M2 22c0-4 4-7 10-7s10 3 10 7" />
                </svg>
              </span>
            </Link>
          )}
        </div>
      </nav>

      <div
        className={`fixed inset-0 z-[70] lg:hidden ${
          mobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div
          onClick={() => setMobileMenuOpen(false)}
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div
          className={`absolute right-0 top-0 flex h-full w-[88vw] max-w-[380px] flex-col transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={glassDropdownStyle}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-4"
            style={{
              borderColor: 'rgba(255,255,255,0.06)',
              backgroundColor: 'var(--theme-accent-soft)',
            }}
          >
            <span className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
              Menu
            </span>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex h-10 w-10 items-center justify-center ${themedGhostButtonClass}`}
              style={ghostButtonStyle}
              aria-label="Close menu"
              title="Close menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                  Search
                </p>

                <div className="space-y-2">
                  <form onSubmit={handleSearch} className="flex items-stretch">
                    <input
                      type="text"
                      placeholder="Search..."
                      className="h-11 min-w-0 flex-1 rounded-l-xl border px-4 text-sm text-black placeholder:text-gray-500 focus:outline-none"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.90))',
                        color: '#000000',
                        borderColor: 'rgba(255,255,255,0.22)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                      }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />

                    <button
                      type="submit"
                      className={`flex h-11 items-center gap-2 rounded-r-xl px-4 text-sm font-semibold ${themedAccentButtonClass}`}
                      style={{
                        ...accentButtonStyle,
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        marginLeft: '-1px',
                      }}
                    >
                      <span>Search</span>
                      <svg
                        className="h-4 w-4 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle cx="11" cy="11" r="7" />
                        <path d="M20 20l-3.5-3.5" />
                      </svg>
                    </button>
                  </form>

                  {results.length > 0 && (
                    <div
                      className="overflow-hidden rounded-2xl"
                      style={glassDropdownStyle}
                    >
                      <div
                        className="border-b px-3 py-2"
                        style={{
                          borderColor: 'rgba(255,255,255,0.06)',
                          backgroundColor: 'var(--theme-accent-soft)',
                        }}
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                          Top Results
                        </span>
                      </div>

                      <div className="max-h-[280px] overflow-y-auto">
                        {results.map((item, index) => (
                          <Link
                            key={`${item.media_type}-${item.id}`}
                            href={item.media_type === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`}
                            className="cursor-pointer"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <div
                              className={`group flex cursor-pointer items-center gap-3 px-3 py-3 transition ${
                                index !== results.length - 1 ? 'border-b border-white/5' : ''
                              }`}
                            >
                              <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-gray-700 ring-1 ring-white/10">
                                {item.poster_path ? (
                                  <img
                                    src={`${IMAGE_BASE}${item.poster_path}`}
                                    className="h-full w-full object-cover"
                                    alt={item.title || item.name || 'Poster'}
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-300">
                                    N/A
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-white transition group-hover:text-[color:var(--theme-accent-text)]">
                                  {item.title || item.name}
                                </div>
                                <div className="mt-1 truncate text-xs text-gray-400">
                                  {item.release_date || item.first_air_date || 'No date available'}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {isSearchPage && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                    Filters
                  </p>

                  <div className="space-y-4 rounded-2xl border p-4" style={ghostButtonStyle}>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                        Content Type
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'all', label: 'All' },
                          { value: 'movies', label: 'Movies' },
                          { value: 'tv', label: 'Shows' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setDraftType(option.value)}
                            className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition ${
                              draftType === option.value
                                ? 'shadow-[0_0_18px_var(--theme-accent-glow)]'
                                : 'text-white hover:text-[color:var(--theme-accent-text)]'
                            }`}
                            style={draftType === option.value ? accentButtonStyle : ghostButtonStyle}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                        Sort By
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'newest', label: 'Newest' },
                          { value: 'oldest', label: 'Oldest' },
                          { value: 'top', label: 'Top Rated' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setDraftSort(option.value)}
                            className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition ${
                              draftSort === option.value
                                ? 'shadow-[0_0_18px_var(--theme-accent-glow)]'
                                : 'text-white hover:text-[color:var(--theme-accent-text)]'
                            }`}
                            style={draftSort === option.value ? accentButtonStyle : ghostButtonStyle}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                        Minimum TMDB Rating
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['0', '4', '5', '6', '7', '8', '9'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setDraftMinRating(rating)}
                            className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition ${
                              draftMinRating === rating
                                ? 'shadow-[0_0_18px_var(--theme-accent-glow)]'
                                : 'text-white hover:text-[color:var(--theme-accent-text)]'
                            }`}
                            style={draftMinRating === rating ? accentButtonStyle : ghostButtonStyle}
                          >
                            {rating === '0' ? 'Any' : `${rating}+`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                        Year Range
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="From"
                          min="1900"
                          max="2100"
                          value={draftYearFrom}
                          onChange={(e) => setDraftYearFrom(e.target.value)}
                          className="h-10 rounded-xl border px-3 text-sm text-white placeholder:text-gray-400 focus:outline-none"
                          style={ghostButtonStyle}
                        />
                        <input
                          type="number"
                          placeholder="To"
                          min="1900"
                          max="2100"
                          value={draftYearTo}
                          onChange={(e) => setDraftYearTo(e.target.value)}
                          className="h-10 rounded-xl border px-3 text-sm text-white placeholder:text-gray-400 focus:outline-none"
                          style={ghostButtonStyle}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={applyFilters}
                        className={`flex h-10 flex-1 items-center justify-center text-sm font-semibold ${themedAccentButtonClass}`}
                        style={accentButtonStyle}
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className={`flex h-10 items-center justify-center px-4 text-sm font-semibold ${themedGhostButtonClass}`}
                        style={ghostButtonStyle}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                  Browse
                </p>

                <div className="space-y-2">
                  <Link href="/search?type=movies" className="cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                    <div className="cursor-pointer rounded-xl border px-4 py-3 text-sm font-medium text-white transition hover:border-[color:var(--theme-accent-border)] hover:text-[color:var(--theme-accent-text)]" style={ghostButtonStyle}>
                      Movies
                    </div>
                  </Link>

                  <Link href="/search?type=tv" className="cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                    <div className="cursor-pointer rounded-xl border px-4 py-3 text-sm font-medium text-white transition hover:border-[color:var(--theme-accent-border)] hover:text-[color:var(--theme-accent-text)]" style={ghostButtonStyle}>
                      Shows
                    </div>
                  </Link>

                  <Link href="/search?type=tv&tab=anime" className="cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                    <div className="cursor-pointer rounded-xl border px-4 py-3 text-sm font-medium text-white transition hover:border-[color:var(--theme-accent-border)] hover:text-[color:var(--theme-accent-text)]" style={ghostButtonStyle}>
                      Anime
                    </div>
                  </Link>

                  <Link href="/livesports" className="cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                    <div className="cursor-pointer rounded-xl border px-4 py-3 text-sm font-medium text-white transition hover:border-[color:var(--theme-accent-border)] hover:text-[color:var(--theme-accent-text)]" style={ghostButtonStyle}>
                      Live Sports
                    </div>
                  </Link>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                  Actions
                </p>

                <div className="space-y-2">
                  {isAdmin && (
                    <Link href="/admin" className="cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                      <div className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-95" style={yellowGlassButtonStyle}>
                        Admin
                        <svg
                          className="h-4 w-4 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
                        </svg>
                      </div>
                    </Link>
                  )}

                  <button
                    onClick={handlePartyButtonClick}
                    className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-95"
                    style={accentButtonStyle}
                    type="button"
                  >
                    Party
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="9" cy="7" r="3" />
                      <circle cx="15" cy="7" r="3" />
                      <path d="M4 20c0-3 3-5 5-5" />
                      <path d="M20 20c0-3-3-5-5-5" />
                    </svg>
                  </button>

                  {isProfilePage ? (
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-95 ${
                        signingOut ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                      }`}
                      style={signingOut ? { ...accentButtonStyle, ...accentButtonDisabledStyle } : accentButtonStyle}
                      type="button"
                    >
                      {signingOut ? 'Signing Out...' : 'Sign Out'}
                    </button>
                  ) : (
                    <Link href="/profile" className="cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                      <div
                        className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-95"
                        style={accentButtonStyle}
                      >
                        Profile
                        <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5z" />
                          <path d="M2 22c0-4 4-7 10-7s10 3 10 7" />
                        </svg>
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PartyModal
        open={partyOpen}
        onClose={() => setPartyOpen(false)}
        onJoinParty={handlePartyJoined}
        onCreateParty={handleCreateParty}
      />

      <PartyControlModal
        open={partyControlsOpen}
        onClose={() => setPartyControlsOpen(false)}
        onLeave={handleLeaveParty}
        code={partyCode}
      />

      {stayPromptOpen && inParty && (
        <div className="fixed inset-x-0 top-24 z-[998] flex justify-center px-4">
          <div
            className="w-full max-w-md rounded-2xl backdrop-blur-md"
            style={glassDropdownStyle}
          >
            <div className="border-b px-5 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'var(--theme-accent-soft)' }}>
              <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                Party Check-In
              </p>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-gray-200">
                Do you still want to stay in this party?
              </p>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleStayInParty}
                  className={`flex h-10 flex-1 items-center justify-center text-sm font-semibold ${themedAccentButtonClass}`}
                  style={accentButtonStyle}
                  type="button"
                >
                  Stay
                </button>

                <button
                  onClick={handleLeaveFromPrompt}
                  className={`flex h-10 flex-1 items-center justify-center text-sm font-semibold ${themedGhostButtonClass}`}
                  style={ghostButtonStyle}
                  type="button"
                >
                  Leave Party
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejoinPromptOpen && (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl"
            style={glassDropdownStyle}
          >
            <div className="border-b px-5 py-4" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'var(--theme-accent-soft)' }}>
              <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                {rejoinPromptMode === 'host' ? 'Keep Party Alive' : 'Rejoin Party'}
              </p>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-sm leading-6 text-gray-200">
                {rejoinPromptMode === 'host'
                  ? 'You logged out while hosting a party. Do you want to keep the party alive and resume hosting it?'
                  : 'You logged out while in a party. Do you want to rejoin that party?'}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleRejoinDecline}
                  disabled={rejoinPromptPending}
                  className={`flex h-10 items-center justify-center px-4 text-sm font-semibold ${themedGhostButtonClass} disabled:cursor-not-allowed disabled:opacity-70`}
                  style={ghostButtonStyle}
                >
                  No
                </button>

                <button
                  type="button"
                  onClick={handleRejoinAccept}
                  disabled={rejoinPromptPending}
                  className={`flex h-10 items-center justify-center px-5 text-sm font-semibold ${themedAccentButtonClass} disabled:cursor-not-allowed disabled:opacity-80`}
                  style={rejoinPromptPending ? { ...accentButtonStyle, ...accentButtonDisabledStyle } : accentButtonStyle}
                >
                  {rejoinPromptPending ? 'Please wait...' : 'Yes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {partyJumpPromptOpen && partyJumpTarget && (
        <div className="fixed inset-0 z-[1002] flex items-center justify-center bg-black/70 px-3 backdrop-blur-sm sm:px-4">
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border shadow-[0_12px_35px_rgba(0,0,0,0.55)]"
            style={{
              ...glassDropdownStyle,
              borderColor: 'rgba(250, 204, 21, 0.28)',
            }}
          >
            <div className="border-b px-4 py-3 sm:px-5" style={{ borderColor: 'rgba(250,204,21,0.18)', backgroundColor: 'rgba(250,204,21,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-yellow-400/25 bg-yellow-500/12 text-yellow-200">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M13 5l7 7-7 7" />
                    <path d="M5 12h15" />
                  </svg>
                </div>

                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-yellow-300">
                  Jump to Host Content
                </p>
              </div>
            </div>

            <div className="space-y-4 px-4 py-4 sm:space-y-5 sm:px-5 sm:py-5">
              <div className="rounded-2xl border border-yellow-500/16 bg-yellow-500/5 p-4">
                <p className="text-sm font-semibold text-yellow-200">
                  The host started new content.
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-200 sm:leading-7">
                  Do you want to jump to what the host is currently playing?
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleDeclinePartyJump}
                  className="flex h-10 w-full cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold text-white transition active:scale-95 sm:w-auto"
                  style={ghostButtonStyle}
                >
                  No
                </button>

                <button
                  type="button"
                  onClick={handleAcceptPartyJump}
                  className="flex h-10 w-full cursor-pointer items-center justify-center rounded-xl px-5 text-sm font-semibold transition active:scale-95 sm:w-auto"
                  style={yellowGlassButtonStyle}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}