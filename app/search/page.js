'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Navbar from '@/components/Navbar';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const IMAGE_POSTER = 'https://image.tmdb.org/t/p/w500';
const INITIAL_ITEM_COUNT = 30;
const LOAD_MORE_COUNT = 30;
const GITHUB_HASH = process.env.NEXT_PUBLIC_GIT_HASH || 'dev';
const GITHUB_REPO_URL = process.env.NEXT_PUBLIC_GITHUB_REPO_URL || '#';

const STRICT_ANIME_KEYWORDS = '210024|287501';

const TAB_CONFIG = [
  { key: 'popular', label: 'Most Popular', sort: 'popularity.desc' },
  { key: 'rated', label: 'Most Rated', sort: 'vote_average.desc' },
  { key: 'recent', label: 'Most Recent', sort: 'date.desc' },

  { key: 'action', label: 'Action', sort: 'popularity.desc', movieGenre: '28', tvGenre: '10759' },
  { key: 'adventure', label: 'Adventure', sort: 'popularity.desc', movieGenre: '12', tvGenre: '10759' },
  { key: 'animation', label: 'Animation', sort: 'popularity.desc', movieGenre: '16', tvGenre: '16' },
  { key: 'anime', label: 'Anime', sort: 'popularity.desc', animeOnly: true, forceType: 'tv' },
  { key: 'comedy', label: 'Comedy', sort: 'popularity.desc', movieGenre: '35', tvGenre: '35' },
  { key: 'crime', label: 'Crime', sort: 'popularity.desc', movieGenre: '80', tvGenre: '80' },
  { key: 'documentary', label: 'Documentary', sort: 'popularity.desc', movieGenre: '99', tvGenre: '99' },
  { key: 'drama', label: 'Drama', sort: 'popularity.desc', movieGenre: '18', tvGenre: '18' },
  { key: 'family', label: 'Family', sort: 'popularity.desc', movieGenre: '10751', tvGenre: '10751' },
  { key: 'fantasy', label: 'Fantasy', sort: 'popularity.desc', movieGenre: '14', tvGenre: '10765' },
  { key: 'history', label: 'History', sort: 'popularity.desc', movieGenre: '36', tvGenre: '36' },
  { key: 'horror', label: 'Horror', sort: 'popularity.desc', movieGenre: '27', tvGenre: '9648' },
  { key: 'mystery', label: 'Mystery', sort: 'popularity.desc', movieGenre: '9648', tvGenre: '9648' },
  { key: 'romance', label: 'Romance', sort: 'popularity.desc', movieGenre: '10749', tvGenre: '10766' },
  { key: 'scifi', label: 'Sci-Fi', sort: 'popularity.desc', movieGenre: '878', tvGenre: '10765' },
  { key: 'thriller', label: 'Thriller', sort: 'popularity.desc', movieGenre: '53', tvGenre: '9648' },
  { key: 'war', label: 'War', sort: 'popularity.desc', movieGenre: '10752', tvGenre: '10768' },
  { key: 'western', label: 'Western', sort: 'popularity.desc', movieGenre: '37', tvGenre: '37' },
];

function normalizeType(type) {
  if (type === 'movies') return 'movie';
  if (type === 'movie') return 'movie';
  if (type === 'tv') return 'tv';
  return 'all';
}

function getDateString(item) {
  return item.release_date || item.first_air_date || '';
}

function getDateValue(item) {
  const date = getDateString(item);
  return date ? new Date(date).getTime() : 0;
}

function getYear(item) {
  const date = getDateString(item);
  return date ? Number(date.slice(0, 4)) : null;
}

function formatToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isReleased(item) {
  const value = getDateValue(item);
  return value > 0 && value <= Date.now();
}

function getDiscoverSort(sort, mediaType) {
  if (sort === 'vote_average.desc') return 'vote_average.desc';
  if (sort === 'date.desc') {
    return mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
  }
  return 'popularity.desc';
}

function dedupeItems(items) {
  const map = new Map();

  items.forEach((item) => {
    if (
      (item.media_type === 'movie' || item.media_type === 'tv') &&
      item.poster_path &&
      isReleased(item)
    ) {
      map.set(`${item.media_type}-${item.id}`, item);
    }
  });

  return Array.from(map.values());
}

function getTabConfig(tabKey) {
  return TAB_CONFIG.find((tab) => tab.key === tabKey) || TAB_CONFIG[0];
}

function buildDiscoverEndpoint({
  mediaType,
  page,
  tabConfig,
  minRating,
  yearFrom,
  yearTo,
}) {
  const today = formatToday();
  const params = new URLSearchParams();

  params.set('api_key', TMDB_API_KEY);
  params.set('page', String(page));
  params.set('include_adult', 'false');
  params.set('include_video', 'false');
  params.set('sort_by', getDiscoverSort(tabConfig.sort, mediaType));

  if (mediaType === 'movie') {
    params.set('primary_release_date.lte', today);
    if (yearFrom) params.set('primary_release_date.gte', `${yearFrom}-01-01`);
    if (yearTo) params.set('primary_release_date.lte', `${yearTo}-12-31`);
  } else {
    params.set('first_air_date.lte', today);
    if (yearFrom) params.set('first_air_date.gte', `${yearFrom}-01-01`);
    if (yearTo) params.set('first_air_date.lte', `${yearTo}-12-31`);
  }

  if (minRating > 0) {
    params.set('vote_average.gte', String(minRating));
    params.set('vote_count.gte', '25');
  }

  if (tabConfig.sort === 'vote_average.desc') {
    params.set('vote_count.gte', '100');
  }

  if (tabConfig.animeOnly) {
    params.set('with_keywords', STRICT_ANIME_KEYWORDS);
    params.set('with_genres', '16');
    params.set('with_original_language', 'ja');
    params.set('include_null_first_air_dates', 'false');
  } else {
    const genre = mediaType === 'movie' ? tabConfig.movieGenre : tabConfig.tvGenre;
    if (genre) params.set('with_genres', genre);
  }

  return `discover/${mediaType}?${params.toString()}`;
}

async function fetchEndpoint(endpoint) {
  const res = await fetch(`https://api.themoviedb.org/3/${endpoint}`);
  const data = await res.json();

  return {
    results: data.results || [],
    totalPages: data.total_pages || 1,
  };
}

async function fetchSearchResults({ query, type, page }) {
  const normalizedType = normalizeType(type);

  if (normalizedType === 'movie') {
    const data = await fetchEndpoint(
      `search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
    );

    return {
      results: dedupeItems(data.results.map((item) => ({ ...item, media_type: 'movie' }))),
      totalPages: data.totalPages,
    };
  }

  if (normalizedType === 'tv') {
    const data = await fetchEndpoint(
      `search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
    );

    return {
      results: dedupeItems(data.results.map((item) => ({ ...item, media_type: 'tv' }))),
      totalPages: data.totalPages,
    };
  }

  const data = await fetchEndpoint(
    `search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
  );

  return {
    results: dedupeItems(
      data.results.filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    ),
    totalPages: data.totalPages,
  };
}

async function fetchDiscoverResults({
  type,
  activeTab,
  page,
  minRating,
  yearFrom,
  yearTo,
}) {
  const normalizedType = normalizeType(type);
  const tabConfig = getTabConfig(activeTab);

  const fetchMovie = () =>
    fetchEndpoint(
      buildDiscoverEndpoint({
        mediaType: 'movie',
        page,
        tabConfig,
        minRating,
        yearFrom,
        yearTo,
      })
    );

  const fetchTv = () =>
    fetchEndpoint(
      buildDiscoverEndpoint({
        mediaType: 'tv',
        page,
        tabConfig,
        minRating,
        yearFrom,
        yearTo,
      })
    );

  if (tabConfig.forceType === 'tv') {
    const data = await fetchTv();
    return {
      results: dedupeItems(data.results.map((item) => ({ ...item, media_type: 'tv' }))),
      totalPages: data.totalPages,
    };
  }

  if (normalizedType === 'movie') {
    const data = await fetchMovie();
    return {
      results: dedupeItems(data.results.map((item) => ({ ...item, media_type: 'movie' }))),
      totalPages: data.totalPages,
    };
  }

  if (normalizedType === 'tv') {
    const data = await fetchTv();
    return {
      results: dedupeItems(data.results.map((item) => ({ ...item, media_type: 'tv' }))),
      totalPages: data.totalPages,
    };
  }

  const [movieData, tvData] = await Promise.all([fetchMovie(), fetchTv()]);

  return {
    results: dedupeItems([
      ...movieData.results.map((item) => ({ ...item, media_type: 'movie' })),
      ...tvData.results.map((item) => ({ ...item, media_type: 'tv' })),
    ]),
    totalPages: Math.max(movieData.totalPages, tvData.totalPages),
  };
}

function applyLocalFilters(items, { minRating, yearFrom, yearTo, currentType, activeTab }) {
  const tab = getTabConfig(activeTab);

  let processed = [...items];

  processed = processed.filter((item) => {
    const itemType = item.media_type === 'tv' ? 'tv' : 'movie';
    const rating = Number(item.vote_average || 0);
    const year = getYear(item);
    const genreIds = Array.isArray(item.genre_ids) ? item.genre_ids : [];
    const isAnimeMatch =
      genreIds.includes(16) &&
      String(item.original_language || '').toLowerCase() === 'ja';

    if (!isReleased(item)) return false;
    if (tab.forceType && itemType !== tab.forceType) return false;
    if (currentType !== 'all' && !tab.forceType && itemType !== currentType) return false;
    if (minRating > 0 && rating < minRating) return false;
    if (yearFrom > 0 && (!year || year < yearFrom)) return false;
    if (yearTo > 0 && (!year || year > yearTo)) return false;

    if (tab.animeOnly && !isAnimeMatch) return false;

    if (!tab.animeOnly) {
      const requiredGenre = itemType === 'movie' ? tab.movieGenre : tab.tvGenre;
      if (requiredGenre && !genreIds.includes(Number(requiredGenre))) return false;
    }

    return true;
  });

  if (tab.sort === 'vote_average.desc') {
    processed.sort((a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0));
  } else if (tab.sort === 'date.desc') {
    processed.sort((a, b) => getDateValue(b) - getDateValue(a));
  } else {
    processed.sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
  }

  return processed;
}

function BookmarkBadge({ active, onToggle }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle?.();
      }}
      className={`pointer-events-auto inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border backdrop-blur-md transition active:scale-95 ${
        active
          ? 'border-red-400/70 bg-red-600/90 text-white shadow-[0_0_14px_rgba(239,68,68,0.35)] hover:bg-red-700'
          : 'border-white/15 bg-black/65 text-white shadow-[0_0_14px_rgba(0,0,0,0.2)] hover:border-red-400/60 hover:text-red-300'
      }`}
      title={active ? 'Remove bookmark' : 'Save bookmark'}
      aria-label={active ? 'Remove bookmark' : 'Save bookmark'}
    >
      <svg
        className="h-3 w-3 flex-shrink-0"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M6 4h12a1 1 0 011 1v15l-7-4-7 4V5a1 1 0 011-1z" />
      </svg>
    </button>
  );
}

function CardBadges({ isBookmarked, onToggleBookmark }) {
  return (
    <div className="absolute left-2 top-2 z-20 flex flex-col gap-1">
      <BookmarkBadge active={isBookmarked} onToggle={onToggleBookmark} />
    </div>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabScrollRef = useRef(null);

  const currentQuery = searchParams.get('q') || '';
  const currentType = normalizeType(searchParams.get('type') || 'all');
  const currentMinRating = Number(searchParams.get('minRating') || '0');
  const currentYearFrom = Number(searchParams.get('yearFrom') || '0');
  const currentYearTo = Number(searchParams.get('yearTo') || '0');
  const currentTabParam = searchParams.get('tab') || '';

  const [activeTab, setActiveTab] = useState('popular');
  const [rawResults, setRawResults] = useState([]);
  const [visibleResults, setVisibleResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [maxPages, setMaxPages] = useState(1);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ITEM_COUNT);

  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);

  const [userId, setUserId] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

  useEffect(() => {
    if (TAB_CONFIG.some((tab) => tab.key === currentTabParam)) {
      setActiveTab(currentTabParam);
    } else {
      setActiveTab('popular');
    }
  }, [currentTabParam]);

  const filterConfig = useMemo(
    () => ({
      activeTab,
      minRating: currentMinRating,
      yearFrom: currentYearFrom,
      yearTo: currentYearTo,
      currentType,
    }),
    [activeTab, currentMinRating, currentYearFrom, currentYearTo, currentType]
  );

  const activeTabConfig = useMemo(
    () => getTabConfig(activeTab),
    [activeTab]
  );

  const filteredResults = useMemo(
    () => applyLocalFilters(rawResults, filterConfig),
    [rawResults, filterConfig]
  );

  useEffect(() => {
    setVisibleResults(filteredResults.slice(0, visibleCount));
  }, [filteredResults, visibleCount]);

  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) {
      setCanScrollTabsLeft(false);
      setCanScrollTabsRight(false);
      return;
    }

    const updateTabScrollButtons = () => {
      setCanScrollTabsLeft(el.scrollLeft > 4);
      setCanScrollTabsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };

    updateTabScrollButtons();
    el.addEventListener('scroll', updateTabScrollButtons, { passive: true });
    window.addEventListener('resize', updateTabScrollButtons);

    return () => {
      el.removeEventListener('scroll', updateTabScrollButtons);
      window.removeEventListener('resize', updateTabScrollButtons);
    };
  }, []);

  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      setCanScrollTabsLeft(el.scrollLeft > 4);
      setCanScrollTabsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    });
  }, [activeTab]);

  const readBookmarks = (uid) => {
    if (!uid) {
      setBookmarkedIds(new Set());
      return;
    }

    try {
      const raw = localStorage.getItem(`kflix_watchlist_${uid}`);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = new Set(
        (Array.isArray(parsed) ? parsed : []).map((item) => `${item.type || 'movie'}-${item.id}`)
      );
      setBookmarkedIds(ids);
    } catch {
      setBookmarkedIds(new Set());
    }
  };

  const toggleBookmark = (item, mediaType) => {
    if (!userId || !item?.id) return;

    try {
      const storageKey = `kflix_watchlist_${userId}`;
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];

      const exists = parsed.some(
        (entry) => String(entry.id) === String(item.id) && entry.type === mediaType
      );

      let updated;

      if (exists) {
        updated = parsed.filter(
          (entry) => !(String(entry.id) === String(item.id) && entry.type === mediaType)
        );
      } else {
        const watchlistItem = {
          id: item.id,
          type: mediaType,
          title: item.title || item.name || 'Untitled',
          poster_path: item.poster_path || null,
          backdrop_path: item.backdrop_path || null,
          addedAt: Date.now(),
        };

        updated = [watchlistItem, ...parsed];
      }

      localStorage.setItem(storageKey, JSON.stringify(updated));
      readBookmarks(userId);
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('Bookmark toggle failed:', error);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const uid = currentUser?.uid || '';
      setUserId(uid);
      readBookmarks(uid);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadPagesUntilMinimum = async () => {
      try {
        setLoading(true);
        setCurrentPage(1);
        setVisibleCount(INITIAL_ITEM_COUNT);

        const targetType = activeTabConfig.forceType || currentType;
        let aggregated = [];
        let highestTotalPages = 1;
        let page = 1;

        while (page <= highestTotalPages && aggregated.length < INITIAL_ITEM_COUNT) {
          const result = currentQuery.trim()
            ? await fetchSearchResults({
                query: currentQuery,
                type: targetType,
                page,
              })
            : await fetchDiscoverResults({
                type: targetType,
                activeTab,
                page,
                minRating: currentMinRating,
                yearFrom: currentYearFrom,
                yearTo: currentYearTo,
              });

          aggregated = dedupeItems([...aggregated, ...result.results]);
          highestTotalPages = Math.max(highestTotalPages, result.totalPages || 1);
          page += 1;
        }

        setRawResults(aggregated);
        setMaxPages(highestTotalPages);
        setCurrentPage(Math.max(1, page - 1));
      } catch (error) {
        console.error('Failed to fetch search results:', error);
        setRawResults([]);
        setMaxPages(1);
        setCurrentPage(1);
      } finally {
        setLoading(false);
      }
    };

    loadPagesUntilMinimum();
  }, [
    currentQuery,
    currentType,
    activeTab,
    activeTabConfig.forceType,
    currentMinRating,
    currentYearFrom,
    currentYearTo,
  ]);

  useEffect(() => {
    const sync = () => {
      readBookmarks(userId);
    };

    sync();

    const handleStorage = (event) => {
      if (!event.key || event.key === `kflix_watchlist_${userId}`) {
        sync();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sync();
      }
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(sync, 1500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [userId]);

  const handleLoadMore = async () => {
    if (loadingMore) return;

    const neededVisibleCount = visibleCount + LOAD_MORE_COUNT;

    if (filteredResults.length >= neededVisibleCount || currentPage >= maxPages) {
      setVisibleCount((prev) => prev + LOAD_MORE_COUNT);
      return;
    }

    try {
      setLoadingMore(true);

      const targetType = activeTabConfig.forceType || currentType;
      let nextPage = currentPage + 1;
      let nextRaw = [...rawResults];

      while (nextPage <= maxPages && applyLocalFilters(nextRaw, filterConfig).length < neededVisibleCount) {
        const result = currentQuery.trim()
          ? await fetchSearchResults({
              query: currentQuery,
              type: targetType,
              page: nextPage,
            })
          : await fetchDiscoverResults({
              type: targetType,
              activeTab,
              page: nextPage,
              minRating: currentMinRating,
              yearFrom: currentYearFrom,
              yearTo: currentYearTo,
            });

        nextRaw = dedupeItems([...nextRaw, ...result.results]);
        nextPage += 1;
      }

      setRawResults(nextRaw);
      setCurrentPage(Math.max(currentPage, nextPage - 1));
      setVisibleCount((prev) => prev + LOAD_MORE_COUNT);
    } catch (error) {
      console.error('Failed to load more results:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleBackToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const scrollTabs = (direction) => {
    const el = tabScrollRef.current;
    if (!el) return;

    const amount = 280;
    const nextLeft =
      direction === 'left'
        ? Math.max(0, el.scrollLeft - amount)
        : Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + amount);

    el.scrollTo({
      left: nextLeft,
      behavior: 'smooth',
    });
  };

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);

    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabKey);
    router.replace(`/search?${params.toString()}`);
  };

  const resultsLabel = useMemo(() => {
    if (activeTab === 'anime') return 'Anime Results';
    return activeTabConfig.label;
  }, [activeTab, activeTabConfig]);

  const canLoadMore =
    visibleResults.length < filteredResults.length || currentPage < maxPages;

  return (
    <div className="min-h-screen bg-black text-white">
      <Suspense fallback={<div className="h-20" />}>
        <Navbar />
      </Suspense>

      <main className="px-8 pb-10 pt-24">
        <section>
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                  {resultsLabel}
                </h2>

                {!loading && (
                  <span className="text-sm text-gray-300">
                    {visibleResults.length} shown
                  </span>
                )}
              </div>
            </div>

            <div className="border-b border-red-500/15 px-6 py-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!canScrollTabsLeft) return;
                    scrollTabs('left');
                  }}
                  aria-disabled={!canScrollTabsLeft}
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full backdrop-blur-md transition ${
                    canScrollTabsLeft
                      ? 'bg-black/25 text-white cursor-pointer active:scale-95 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40'
                      : 'bg-black/15 text-gray-500 cursor-default opacity-60'
                  }`}
                  aria-label="Scroll tabs left"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                </button>

                <div
                  ref={tabScrollRef}
                  className="flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  <div className="flex min-w-max gap-2">
                    {TAB_CONFIG.map((tab) => {
                      const active = tab.key === activeTab;

                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => handleTabChange(tab.key)}
                          className={`whitespace-nowrap rounded-md border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                            active
                              ? 'border-red-400 bg-red-600/15 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.18)]'
                              : 'border-white/10 bg-black/20 text-white hover:border-red-400/60 hover:text-red-300'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!canScrollTabsRight) return;
                    scrollTabs('right');
                  }}
                  aria-disabled={!canScrollTabsRight}
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full backdrop-blur-md transition ${
                    canScrollTabsRight
                      ? 'bg-black/25 text-white cursor-pointer active:scale-95 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40'
                      : 'bg-black/15 text-gray-500 cursor-default opacity-60'
                  }`}
                  aria-label="Scroll tabs right"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="px-6 py-10">
                <p className="text-lg text-gray-300">Loading results...</p>
              </div>
            ) : visibleResults.length === 0 ? (
              <div className="px-6 py-10">
                <p className="text-lg text-gray-300">No results found.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 px-6 py-6 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
                  {visibleResults.map((item) => {
                    const itemType = item.media_type === 'tv' ? 'tv' : 'movie';
                    const href = `/${itemType}/${item.id}`;
                    const bookmarkKey = `${itemType}-${item.id}`;
                    const isBookmarked = bookmarkedIds.has(bookmarkKey);

                    return (
                      <Link
                        key={`${itemType}-${item.id}`}
                        href={href}
                        className="group min-w-0 cursor-pointer"
                      >
                        <div className="relative overflow-hidden rounded-xl border-[1.5px] border-white/10 bg-black/20 transition duration-300 group-hover:border-red-400/90 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.35)]">
                          <CardBadges
                            isBookmarked={isBookmarked}
                            onToggleBookmark={() => toggleBookmark(item, itemType)}
                          />

                          <div className="absolute inset-0 opacity-0 bg-red-500/10 blur-xl transition duration-300 group-hover:opacity-100" />

                          <div className="relative aspect-[2/3] w-full bg-gray-800">
                            <img
                              src={`${IMAGE_POSTER}${item.poster_path}`}
                              alt={item.title || item.name || 'Poster'}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]"
                            />
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="line-clamp-1 text-sm font-medium text-white transition group-hover:text-red-300">
                            {item.title || item.name}
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                            <span>
                              {(item.release_date || item.first_air_date || 'Unknown').slice(0, 4)}
                            </span>
                            <span className="text-red-400">•</span>
                            <span>{itemType === 'movie' ? 'Movie' : 'Show'}</span>
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            TMDB {Number(item.vote_average || 0).toFixed(1)}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <div className="border-t border-red-500/15 px-6 pb-6 pt-2">
                  <div className="flex justify-end gap-2">
                    {canLoadMore && (
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className={`flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition active:scale-95 ${
                          loadingMore
                            ? 'cursor-default bg-red-600/70'
                            : 'bg-red-600 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60'
                        }`}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                        {loadingMore ? 'Loading...' : 'Load More'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleBackToTop}
                      className="flex h-11 items-center justify-center gap-2 rounded-md bg-black/25 px-5 text-sm font-semibold text-white backdrop-blur-md transition active:scale-95 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M18 15l-6-6-6 6" />
                      </svg>
                      Back to Top
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>

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

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white" />}>
      <SearchPageContent />
    </Suspense>
  );
}