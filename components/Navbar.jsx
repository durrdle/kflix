'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { get, off, onValue, ref } from 'firebase/database';
import PartyModal from '@/components/PartyModal';
import PartyControlModal from '@/components/PartyControlModal';
import {
  app,
  db,
  clearPartyStayPrompt,
  getPartyStayPromptAt,
  joinParty,
  leaveParty,
  leavePartyOnUnload,
  schedulePartyStayPrompt,
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

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isProfilePage = pathname === '/profile';
  const isSearchPage = pathname === '/search';
  const isHomePage = pathname === '/';
  const isWatchPage = pathname === '/watch';

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

  const persistCurrentPartyState = (code, active) => {
    localStorage.setItem('kflix_current_party_code', code || '');
    localStorage.setItem('kflix_in_party', active ? 'true' : 'false');

    if (active && code) {
      localStorage.setItem('kflix_party_joined_at', String(Date.now()));
      if (!getPartyStayPromptAt()) {
        schedulePartyStayPrompt();
      }
    } else {
      localStorage.removeItem('kflix_party_joined_at');
      clearPartyStayPrompt();
      setStayPromptOpen(false);
      hostIdRef.current = '';
    }

    setPartyCode(code || '');
    setInParty(active);
    partyCodeRef.current = code || '';
    inPartyRef.current = active;
    dispatchPartyUpdate();
  };

  useEffect(() => {
    syncPartyStateFromStorage();
  }, []);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

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
      touchPartyMember(partyCode, currentUserId);
    };

    onValue(partyRef, handlePartyValue);

    partyHeartbeatRef.current = setInterval(() => {
      const activeUserId = getAuth().currentUser?.uid;
      if (!activeUserId || !partyCodeRef.current || !inPartyRef.current) return;
      touchPartyMember(partyCodeRef.current, activeUserId);
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
    if (!inParty || !partyCode) {
      setStayPromptOpen(false);
      return;
    }

    const checkPrompt = () => {
      const nextPromptAt = getPartyStayPromptAt();

      if (!nextPromptAt) {
        schedulePartyStayPrompt();
        return;
      }

      if (Date.now() >= nextPromptAt) {
        setStayPromptOpen(true);
      }
    };

    checkPrompt();
    const interval = setInterval(checkPrompt, 30000);

    return () => clearInterval(interval);
  }, [inParty, partyCode]);

  useEffect(() => {
    const auth = getAuth(app);

    const handleBeforeUnload = () => {
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId || !inPartyRef.current || !partyCodeRef.current) return;

      const isHost = hostIdRef.current === currentUserId;

      try {
        leavePartyOnUnload(partyCodeRef.current, currentUserId, isHost);
      } catch {
        // best effort
      }

      try {
        localStorage.removeItem('kflix_current_party_code');
        localStorage.removeItem('kflix_in_party');
        localStorage.removeItem('kflix_party_joined_at');
        clearPartyStayPrompt();
      } catch {
        // ignore
      }

      try {
        signOut(auth);
      } catch {
        // best effort
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const userId = currentUser?.uid;
      if (!userId) return;

      const code = localStorage.getItem('kflix_current_party_code');
      const activeInParty = localStorage.getItem('kflix_in_party') === 'true';

      if (!code || !activeInParty) return;

      try {
        await joinParty(code, userId);
        await touchPartyMember(code, userId);

        const partyRef = ref(db, `parties/${code}`);
        const snapshot = await get(partyRef);

        if (snapshot.exists()) {
          const partyData = snapshot.val() || {};
          hostIdRef.current = partyData.hostId || '';
        } else {
          persistCurrentPartyState('', false);
        }
      } catch (err) {
        console.error('Auto rejoin failed:', err);
        persistCurrentPartyState('', false);
      }
    });

    return () => unsubscribe();
  }, []);

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
      setTimeout(() => setLogoClick(false), 300);
    }
  };

  const handlePartyJoined = async (code) => {
    try {
      const currentUserId = getAuth().currentUser?.uid;
      if (!currentUserId) return;
      await joinParty(code, currentUserId);

      schedulePartyStayPrompt();
      persistCurrentPartyState(code, true);
      setPartyOpen(false);
    } catch (err) {
      console.error('Join failed:', err);
    }
  };

  const handleCreateParty = async (code) => {
    schedulePartyStayPrompt();
    persistCurrentPartyState(code, true);
    setPartyOpen(false);
  };

  const handleLeaveParty = async () => {
    try {
      const currentUserId = getAuth().currentUser?.uid;
      if (!currentUserId || !partyCode) return;

      await leaveParty(partyCode, currentUserId);

      clearPartyStayPrompt();
      persistCurrentPartyState('', false);
      setPartyControlsOpen(false);
    } catch (error) {
      console.error('Failed to leave party:', error);
      clearPartyStayPrompt();
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
      const auth = getAuth(app);
      const currentUserId = auth.currentUser?.uid;

      if (currentUserId && partyCode) {
        await leaveParty(partyCode, currentUserId);
      }

      clearPartyStayPrompt();
      persistCurrentPartyState('', false);

      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
      setSigningOut(false);
    }
  };

  const handleBackClick = () => {
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
      className={`relative h-12 w-[160px] transition ${
        logoClick ? 'scale-110 brightness-125' : 'hover:scale-105'
      }`}
    >
      <Image
        src="/images/kflix-header.png"
        alt="KFlix"
        fill
        priority
        className="object-contain object-left"
        sizes="160px"
      />
    </div>
  );

  return (
    <>
      <nav
        className={`fixed left-0 top-0 z-50 flex h-20 w-full items-center px-8 transition-all duration-300 ${
          navVisible
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-full opacity-0'
        }`}
      >
        <div className="flex items-center">
          {pathname === targetHref ? (
            <button
              type="button"
              onClick={handleLogoClick}
              className="cursor-pointer bg-transparent p-0"
              aria-label="KFlix home"
            >
              {logoNode}
            </button>
          ) : (
            <Link href={targetHref} aria-label="KFlix home">
              {logoNode}
            </Link>
          )}
        </div>

        <div className="absolute left-1/2 flex w-full max-w-[720px] -translate-x-1/2 items-center gap-2 px-4">
          {isSearchPage && (
            <div ref={filterRef} className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((prev) => !prev)}
                className={`flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold text-white backdrop-blur-md transition active:scale-95 ${
                  filterActive
                    ? 'bg-red-600 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60'
                    : 'bg-black/25 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 6h16" />
                  <path d="M7 12h10" />
                  <path d="M10 18h4" />
                </svg>
                Filter
              </button>

              <div
                className={`absolute left-0 top-full mt-2 w-[360px] overflow-hidden rounded-lg border border-red-500/40 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-all duration-200 ${
                  filterOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
                }`}
              >
                <div className="flex items-center justify-between border-b border-red-500/20 bg-red-600/10 px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
                    Search Filters
                  </span>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs font-medium text-gray-300 transition hover:text-red-300"
                  >
                    Reset
                  </button>
                </div>

                <div className="space-y-5 px-4 py-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
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
                          className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                            draftType === option.value
                              ? 'border-red-400 bg-red-600/15 text-red-300'
                              : 'border-white/10 bg-black/20 text-white hover:border-red-400/60 hover:text-red-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
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
                          className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                            draftSort === option.value
                              ? 'border-red-400 bg-red-600/15 text-red-300'
                              : 'border-white/10 bg-black/20 text-white hover:border-red-400/60 hover:text-red-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
                      Minimum TMDB Rating
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['0', '4', '5', '6', '7', '8', '9'].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setDraftMinRating(rating)}
                          className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                            draftMinRating === rating
                              ? 'border-red-400 bg-red-600/15 text-red-300'
                              : 'border-white/10 bg-black/20 text-white hover:border-red-400/60 hover:text-red-300'
                          }`}
                        >
                          {rating === '0' ? 'Any' : `${rating}+`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
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
                        className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-gray-400 focus:border-red-500/50 focus:outline-none"
                      />
                      <input
                        type="number"
                        placeholder="To"
                        min="1900"
                        max="2100"
                        value={draftYearTo}
                        onChange={(e) => setDraftYearTo(e.target.value)}
                        className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-gray-400 focus:border-red-500/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={applyFilters}
                      className="flex h-10 flex-1 items-center justify-center rounded-md bg-red-600 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60"
                    >
                      Apply Filters
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterOpen(false)}
                      className="flex h-10 items-center justify-center rounded-md bg-black/25 px-4 text-sm font-semibold text-white backdrop-blur-md transition active:scale-95 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={searchRef} className="relative flex-1">
            <form onSubmit={handleSearch} className="flex h-9">
              <input
                type="text"
                placeholder="Search..."
                className={`h-full flex-1 rounded-l-md bg-white px-4 text-sm text-black transition-all duration-200 focus:outline-none ${
                  focused ? 'shadow-[0_0_10px_rgba(255,0,0,0.6)]' : ''
                }`}
                value={searchQuery}
                onFocus={() => setFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <button className="h-full rounded-r-md bg-red-600 px-4 text-sm font-semibold text-white transition active:scale-95 hover:shadow-inner hover:shadow-red-500/60">
                Search
              </button>
            </form>

            <div
              className={`absolute left-0 top-full mt-2 w-full overflow-hidden rounded-lg border border-red-500/40 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-all duration-200 ${
                searchOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
              } ${
                resultsPulse ? 'ring-1 ring-red-500/60 shadow-[0_0_18px_rgba(239,68,68,0.25)]' : ''
              }`}
            >
              {searchOpen && (
                <div className="flex items-center justify-between border-b border-red-500/20 bg-red-600/10 px-4 py-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
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
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition active:scale-95 hover:shadow-inner hover:shadow-red-500/60"
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
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition active:scale-95 hover:shadow-inner hover:shadow-red-500/60"
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
                      onClick={() => {
                        setSearchOpen(false);
                        setFocused(false);
                      }}
                    >
                      <div
                        className={`group flex cursor-pointer items-center gap-3 px-4 py-3 transition-all duration-200 hover:bg-red-600/12 ${
                          index !== results.length - 1 ? 'border-b border-white/5' : ''
                        }`}
                      >
                        <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-gray-700 ring-1 ring-white/10 transition group-hover:ring-red-400/50">
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
                            <span className="truncate text-sm font-medium text-white transition group-hover:text-red-300">
                              {item.title || item.name}
                            </span>

                            <span className="rounded border border-red-500/20 bg-red-600/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
                              {item.media_type}
                            </span>
                          </div>

                          <div className="mt-1 truncate text-xs text-gray-400">
                            {item.release_date || item.first_air_date || 'No date available'}
                          </div>
                        </div>

                        <svg
                          className="h-4 w-4 flex-shrink-0 text-red-400/70 transition group-hover:translate-x-0.5 group-hover:text-red-300"
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

        <div className="ml-auto flex items-center space-x-2">
          {!isHomePage && (
            <button
              type="button"
              onClick={handleBackClick}
              className="flex h-9 items-center gap-2 rounded-md bg-black/25 px-4 text-sm font-semibold text-white backdrop-blur-md transition active:scale-95 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40"
            >
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 6l-6 6 6 6" />
              </svg>
              Back
            </button>
          )}

          {!isSearchPage && (
            <div ref={browseRef} className="relative">
              <button
                onClick={() => setBrowseOpen(!browseOpen)}
                className="flex h-9 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition active:scale-95 hover:shadow-inner hover:shadow-red-500/60"
              >
                Browse
                <svg className={`h-4 w-4 transition ${browseOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              <div
                className={`absolute left-0 top-full mt-2 min-w-full overflow-hidden rounded-lg border border-red-500/40 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-all duration-200 ${
                  browseOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
                }`}
              >
                <div className="border-b border-red-500/20 bg-red-600/10 px-4 py-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
                    Browse
                  </span>
                </div>

                <Link href="/search?type=movies">
                  <div className="group flex items-center justify-between px-4 py-3 transition-all duration-200 hover:bg-red-600/12">
                    <span className="text-sm font-medium text-white transition group-hover:text-red-300">
                      Movies
                    </span>
                    <svg className="h-4 w-4 text-red-400/70 transition group-hover:translate-x-0.5 group-hover:text-red-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </Link>

                <div className="border-t border-white/5" />

                <Link href="/search?type=tv">
                  <div className="group flex items-center justify-between px-4 py-3 transition-all duration-200 hover:bg-red-600/12">
                    <span className="text-sm font-medium text-white transition group-hover:text-red-300">
                      Shows
                    </span>
                    <svg className="h-4 w-4 text-red-400/70 transition group-hover:translate-x-0.5 group-hover:text-red-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </Link>

                <div className="border-t border-white/5" />

                <Link href="/search?type=tv&tab=anime">
                  <div className="group flex items-center justify-between px-4 py-3 transition-all duration-200 hover:bg-red-600/12">
                    <span className="text-sm font-medium text-white transition group-hover:text-red-300">
                      Anime
                    </span>
                    <svg className="h-4 w-4 text-red-400/70 transition group-hover:translate-x-0.5 group-hover:text-red-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </Link>

                <div className="border-t border-white/5" />

                <Link href="/livesports">
                  <div className="group flex items-center justify-between px-4 py-3 transition-all duration-200 hover:bg-red-600/12">
                    <span className="text-sm font-medium text-white transition group-hover:text-red-300">
                      Live Sports
                    </span>
                    <svg className="h-4 w-4 text-red-400/70 transition group-hover:translate-x-0.5 group-hover:text-red-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </Link>
              </div>
            </div>
          )}

          <button
            onClick={handlePartyButtonClick}
            className={`flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition active:scale-95 ${
              inParty
                ? 'bg-red-600 shadow-[0_0_14px_rgba(255,0,0,0.8)] hover:shadow-[0_0_18px_rgba(255,0,0,0.95)]'
                : 'bg-red-600 hover:shadow-inner hover:shadow-red-500/60'
            }`}
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
              className={`flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition active:scale-95 ${
                signingOut ? 'cursor-not-allowed bg-red-600/70' : 'bg-red-600 hover:shadow-inner hover:shadow-red-500/60'
              }`}
            >
              {signingOut ? 'Signing Out...' : 'Sign Out'}
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
              </svg>
            </button>
          ) : (
            <Link href="/profile">
              <span className="flex h-9 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition active:scale-95 hover:shadow-inner hover:shadow-red-500/60">
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
          <div className="w-full max-w-md rounded-2xl border border-red-500/35 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <div className="border-b border-red-500/20 bg-red-600/10 px-5 py-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-400">
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
                  className="flex h-10 flex-1 items-center justify-center rounded-lg bg-red-600 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60"
                >
                  Stay
                </button>

                <button
                  onClick={handleLeaveFromPrompt}
                  className="flex h-10 flex-1 items-center justify-center rounded-lg bg-black/25 text-sm font-semibold text-white transition active:scale-95 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40"
                >
                  Leave Party
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}