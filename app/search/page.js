'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Navbar from '@/components/Navbar';

const TMDB_API_KEY = 'bb55db1bab2f577940a88a75fa45692a';
const IMAGE_POSTER = 'https://image.tmdb.org/t/p/w500';

function normalizeType(type) {
  if (type === 'movies') return 'movie';
  if (type === 'movie') return 'movie';
  if (type === 'tv') return 'tv';
  return 'all';
}

function getYear(item) {
  const date = item.release_date || item.first_air_date || '';
  return date ? Number(date.slice(0, 4)) : null;
}

function getDateValue(item) {
  const date = item.release_date || item.first_air_date || '';
  return date ? new Date(date).getTime() : 0;
}

async function fetchEndpoint(endpoint) {
  const res = await fetch(`https://api.themoviedb.org/3/${endpoint}`);
  const data = await res.json();

  return {
    results: data.results || [],
    totalPages: data.total_pages || 1,
  };
}

async function fetchResultsPage({ query, type, page }) {
  const normalizedType = normalizeType(type);

  if (query.trim()) {
    if (normalizedType === 'movie') {
      const data = await fetchEndpoint(
        `search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
      );

      return {
        results: data.results.map((item) => ({ ...item, media_type: 'movie' })),
        totalPages: data.totalPages,
      };
    }

    if (normalizedType === 'tv') {
      const data = await fetchEndpoint(
        `search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
      );

      return {
        results: data.results.map((item) => ({ ...item, media_type: 'tv' })),
        totalPages: data.totalPages,
      };
    }

    const data = await fetchEndpoint(
      `search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
    );

    return {
      results: data.results.filter(
        (item) => item.media_type === 'movie' || item.media_type === 'tv'
      ),
      totalPages: data.totalPages,
    };
  }

  if (normalizedType === 'movie') {
    const data = await fetchEndpoint(
      `movie/popular?api_key=${TMDB_API_KEY}&page=${page}`
    );

    return {
      results: data.results.map((item) => ({ ...item, media_type: 'movie' })),
      totalPages: data.totalPages,
    };
  }

  if (normalizedType === 'tv') {
    const data = await fetchEndpoint(
      `tv/popular?api_key=${TMDB_API_KEY}&page=${page}`
    );

    return {
      results: data.results.map((item) => ({ ...item, media_type: 'tv' })),
      totalPages: data.totalPages,
    };
  }

  const movieData = await fetchEndpoint(
    `movie/popular?api_key=${TMDB_API_KEY}&page=${page}`
  );
  const tvData = await fetchEndpoint(
    `tv/popular?api_key=${TMDB_API_KEY}&page=${page}`
  );

  return {
    results: [
      ...movieData.results.map((item) => ({ ...item, media_type: 'movie' })),
      ...tvData.results.map((item) => ({ ...item, media_type: 'tv' })),
    ],
    totalPages: Math.max(movieData.totalPages, tvData.totalPages),
  };
}

function applyLocalFilters(items, { minRating, yearFrom, yearTo, sort }) {
  let processed = [...items];

  processed = processed.filter((item) => {
    const rating = Number(item.vote_average || 0);
    const year = getYear(item);

    if (minRating && rating < minRating) return false;
    if (yearFrom && (!year || year < yearFrom)) return false;
    if (yearTo && (!year || year > yearTo)) return false;

    return true;
  });

  if (sort === 'oldest') {
    processed.sort((a, b) => getDateValue(a) - getDateValue(b));
  } else if (sort === 'top') {
    processed.sort((a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0));
  } else {
    processed.sort((a, b) => getDateValue(b) - getDateValue(a));
  }

  return processed;
}

function RatingBadge({ label, value, filled = false }) {
  if (value === undefined || value === null || value === '') return null;

  return (
    <div
      className={`inline-flex min-h-[28px] min-w-[54px] items-center justify-center rounded-md border px-2 py-1 text-[10px] font-bold tracking-[0.08em] backdrop-blur-md ${
        filled
          ? 'border-red-400/70 bg-red-600/90 text-white shadow-[0_0_14px_rgba(239,68,68,0.35)]'
          : 'border-white/15 bg-black/65 text-white shadow-[0_0_14px_rgba(0,0,0,0.2)]'
      }`}
    >
      <span className="mr-1 text-red-300">{label}</span>
      <span>{value}</span>
    </div>
  );
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
      className={`pointer-events-auto inline-flex min-h-[28px] items-center justify-center rounded-md border px-2 py-1 text-[10px] font-bold tracking-[0.08em] backdrop-blur-md transition active:scale-95 ${
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

      {active && <span className="ml-1">Saved</span>}
    </button>
  );
}

function CardBadges({ item, isBookmarked, onToggleBookmark }) {
  const tmdbRating =
    typeof item.vote_average === 'number' && item.vote_average > 0
      ? item.vote_average.toFixed(1)
      : null;

  return (
    <div className="absolute left-2 top-2 z-20 flex flex-col gap-1.5">
      <BookmarkBadge active={isBookmarked} onToggle={onToggleBookmark} />

      {item.imdbRating ? (
        <RatingBadge label="IMDb" value={item.imdbRating} />
      ) : null}

      {item.rtRating ? (
        <RatingBadge label="RT" value={item.rtRating} />
      ) : null}

      {tmdbRating ? (
        <RatingBadge label="TMDB" value={tmdbRating} />
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  const searchParams = useSearchParams();

  const currentQuery = searchParams.get('q') || '';
  const currentType = normalizeType(searchParams.get('type') || 'all');
  const currentSort = searchParams.get('sort') || 'newest';
  const currentMinRating = Number(searchParams.get('minRating') || '0');
  const currentYearFrom = Number(searchParams.get('yearFrom') || '0');
  const currentYearTo = Number(searchParams.get('yearTo') || '0');

  const [rawResults, setRawResults] = useState([]);
  const [visibleResults, setVisibleResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [maxPages, setMaxPages] = useState(1);

  const [userId, setUserId] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

  const restoreScrollYRef = useRef(null);

  const filterConfig = useMemo(
    () => ({
      minRating: currentMinRating,
      yearFrom: currentYearFrom,
      yearTo: currentYearTo,
      sort: currentSort,
    }),
    [currentMinRating, currentYearFrom, currentYearTo, currentSort]
  );

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
    const loadInitial = async () => {
      try {
        setLoading(true);
        setCurrentPage(1);
        restoreScrollYRef.current = null;

        const { results, totalPages } = await fetchResultsPage({
          query: currentQuery,
          type: currentType,
          page: 1,
        });

        const uniqueMap = new Map();

        results.forEach((item) => {
          if (
            (item.media_type === 'movie' || item.media_type === 'tv') &&
            item.poster_path
          ) {
            uniqueMap.set(`${item.media_type}-${item.id}`, item);
          }
        });

        const deduped = Array.from(uniqueMap.values());
        setRawResults(deduped);
        setMaxPages(totalPages);
      } catch (error) {
        console.error('Failed to fetch search results:', error);
        setRawResults([]);
        setMaxPages(1);
      } finally {
        setLoading(false);
      }
    };

    loadInitial();
  }, [currentQuery, currentType]);

  useEffect(() => {
    setVisibleResults(applyLocalFilters(rawResults, filterConfig));
  }, [rawResults, filterConfig]);

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

  useEffect(() => {
    if (restoreScrollYRef.current == null) return;

    const y = restoreScrollYRef.current;

    requestAnimationFrame(() => {
      window.scrollTo({
        top: y,
        behavior: 'auto',
      });

      requestAnimationFrame(() => {
        window.__kflixLockNavbarVisibility = false;
      });

      restoreScrollYRef.current = null;
    });
  }, [visibleResults]);

  const handleLoadMore = async (e) => {
    if (loadingMore || currentPage >= maxPages) return;

    try {
      setLoadingMore(true);

      window.__kflixLockNavbarVisibility = true;
      restoreScrollYRef.current = window.scrollY;

      if (e?.currentTarget) {
        e.currentTarget.blur();
      }

      const nextPage = currentPage + 1;

      const { results } = await fetchResultsPage({
        query: currentQuery,
        type: currentType,
        page: nextPage,
      });

      setRawResults((prev) => {
        const uniqueMap = new Map(
          prev.map((item) => [`${item.media_type}-${item.id}`, item])
        );

        results.forEach((item) => {
          if (
            (item.media_type === 'movie' || item.media_type === 'tv') &&
            item.poster_path
          ) {
            uniqueMap.set(`${item.media_type}-${item.id}`, item);
          }
        });

        return Array.from(uniqueMap.values());
      });

      setCurrentPage(nextPage);
    } catch (error) {
      console.error('Failed to load more results:', error);
      restoreScrollYRef.current = null;
      window.__kflixLockNavbarVisibility = false;
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

  const resultsLabel = useMemo(() => {
    if (currentType === 'movie') return 'Movie Results';
    if (currentType === 'tv') return 'Show Results';
    return 'Results';
  }, [currentType]);

  const hasMore = currentPage < maxPages;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="px-8 pb-10 pt-24">
        <section>
          {loading ? (
            <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 px-6 py-10 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
              <p className="text-lg text-gray-300">Loading results...</p>
            </div>
          ) : visibleResults.length === 0 ? (
            <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 px-6 py-10 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
              <p className="text-lg text-gray-300">No results found.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
              <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                    {resultsLabel}
                  </h2>

                  <span className="text-sm text-gray-300">
                    {visibleResults.length} shown
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 px-6 py-6 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                {visibleResults.map((item) => {
                  const itemType = item.media_type === 'tv' ? 'tv' : 'movie';
                  const href = `/${itemType}/${item.id}`;
                  const bookmarkKey = `${itemType}-${item.id}`;
                  const isBookmarked = bookmarkedIds.has(bookmarkKey);

                  return (
                    <Link key={`${itemType}-${item.id}`} href={href} className="group min-w-0">
                      <div className="relative overflow-hidden rounded-xl border-[1.5px] border-white/10 bg-black/20 transition duration-300 group-hover:border-red-400/90 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.35)]">
                        <CardBadges
                          item={item}
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
                <div className="flex flex-col gap-3 sm:flex-row">
                  {(hasMore || loadingMore) && (
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className={`flex h-11 flex-1 items-center justify-center rounded-md text-sm font-semibold text-white transition active:scale-95 ${
                        loadingMore
                          ? 'cursor-not-allowed bg-red-600/70'
                          : 'bg-red-600 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60'
                      }`}
                    >
                      {loadingMore ? 'Loading More...' : 'Load More'}
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
            </div>
          )}
        </section>
      </main>

      <footer className="px-8 pb-8 pt-2 text-center text-sm text-gray-400">
        <p>This website does not host or store any media on its servers.</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
          <Link href="/Terms-and-Conditions" className="transition hover:text-red-400">
            Terms and Conditions
          </Link>
          <span>•</span>
          <Link href="/Privacy-Policy" className="transition hover:text-red-400">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/Feedback" className="transition hover:text-red-400">
            Feedback
          </Link>
          <span>•</span>
          <Link href="/Contact" className="transition hover:text-red-400">
            Contact
          </Link>
          <span>•</span>
          <Link href="/Help" className="transition hover:text-red-400">
            Help
          </Link>
        </div>
      </footer>
    </div>
  );
}