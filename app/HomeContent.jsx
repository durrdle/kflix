'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import Navbar from '@/components/Navbar';
import { db } from '@/lib/firebaseParty';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const IMAGE_BACKDROP = 'https://image.tmdb.org/t/p/original';
const IMAGE_POSTER = 'https://image.tmdb.org/t/p/w500';

const fetchTMDB = async (endpoint) => {
  const separator = endpoint.includes('?') ? '&' : '?';
  const res = await fetch(
    `https://api.themoviedb.org/3/${endpoint}${separator}api_key=${TMDB_API_KEY}`
  );
  const data = await res.json();
  return data.results || [];
};

function formatRemainingTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));

  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m left`;
  }

  return `${mins}m left`;
}

function buildEpisodeKey(showId, seasonNumber, episodeNumber) {
  return `${showId}-S${seasonNumber}-E${episodeNumber}`;
}

function normalizeWatchedMap(value) {
  if (!value || typeof value !== 'object') return {};
  return value;
}

function parseContinueWatchingStorage(uid) {
  if (!uid) return [];

  try {
    const raw = localStorage.getItem(`kflix_continue_watching_${uid}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildContinueWatchingHref(item) {
  const mediaType = item.media_type || item.type || 'movie';
  const params = new URLSearchParams();

  params.set('type', mediaType);
  params.set('id', String(item.id));

  if (mediaType === 'tv') {
    const targetSeason =
      item.season !== undefined && item.season !== null && item.season !== ''
        ? item.season
        : '';

    const targetEpisode =
      item.episode !== undefined && item.episode !== null && item.episode !== ''
        ? item.episode
        : '';

    if (targetSeason !== '') {
      params.set('season', String(targetSeason));
    }

    if (targetEpisode !== '') {
      params.set('episode', String(targetEpisode));
    }
  }

  if (item.currentTime && Number(item.currentTime) > 0) {
    params.set('t', String(Math.floor(Number(item.currentTime))));
  }

  return `/watch?${params.toString()}`;
}

function buildNextUpHref(item) {
  const mediaType = item.media_type || item.type || 'movie';
  const params = new URLSearchParams();

  params.set('type', mediaType);
  params.set('id', String(item.id));

  if (mediaType === 'tv') {
    const targetSeason =
      item.nextSeason !== undefined && item.nextSeason !== null && item.nextSeason !== ''
        ? item.nextSeason
        : item.season;

    const targetEpisode =
      item.nextEpisode !== undefined && item.nextEpisode !== null && item.nextEpisode !== ''
        ? item.nextEpisode
        : item.episode;

    if (targetSeason !== undefined && targetSeason !== null && targetSeason !== '') {
      params.set('season', String(targetSeason));
    }

    if (targetEpisode !== undefined && targetEpisode !== null && targetEpisode !== '') {
      params.set('episode', String(targetEpisode));
    }
  }

  return `/watch?${params.toString()}&autoplay=1`;
}

function splitProgressIntoSections(items, watchedMap) {
  const continueItems = [];
  const nextUpItems = [];

  items.forEach((item) => {
    if (!item || !item.id) return;

    const mediaType = item.media_type || item.type || 'movie';

    if (mediaType !== 'tv') {
      continueItems.push(item);
      return;
    }

    const season = Number(item.season || 0);
    const episode = Number(item.episode || 0);
    const nextSeason = Number(item.nextSeason || 0);
    const nextEpisode = Number(item.nextEpisode || 0);

    const hasExplicitNext =
      nextSeason > 0 &&
      nextEpisode > 0 &&
      (nextSeason !== season || nextEpisode !== episode);

    const currentKey =
      season > 0 && episode > 0 ? buildEpisodeKey(item.id, season, episode) : '';

    const currentIsWatched = currentKey ? Boolean(watchedMap[currentKey]) : false;

    if (hasExplicitNext) {
      nextUpItems.push(item);
      return;
    }

    if (currentIsWatched) {
      return;
    }

    continueItems.push(item);
  });

  return {
    continueItems: continueItems.slice(0, 10),
    nextUpItems: nextUpItems.slice(0, 10),
  };
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

function CardBadges({ item, isBookmarked, onToggleBookmark, compact = false }) {
  const tmdbRating =
    typeof item.vote_average === 'number' && item.vote_average > 0
      ? item.vote_average.toFixed(1)
      : null;

  return (
    <>
      <div className={`absolute left-2 top-2 z-20 flex flex-col ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {item.imdbRating ? <RatingBadge label="IMDb" value={item.imdbRating} /> : null}
        {item.rtRating ? <RatingBadge label="RT" value={item.rtRating} /> : null}
        {tmdbRating ? <RatingBadge label="TMDB" value={tmdbRating} /> : null}
      </div>

      <div className="absolute right-2 top-2 z-20">
        <BookmarkBadge active={isBookmarked} onToggle={onToggleBookmark} />
      </div>
    </>
  );
}

function CarouselSection({
  title,
  sectionKey,
  items,
  type,
  bookmarkedIds,
  onToggleBookmark,
  cardsPerPage = 6,
  getItemType,
  emptyText,
  compact = false,
  preservePageOnItemsChange = false,
  hrefBuilder,
}) {
  const scrollRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(items.length / cardsPerPage));
  const maxPage = totalPages - 1;

  const canScrollLeft = currentPage > 0;
  const canScrollRight = currentPage < maxPage;

  const resolveMediaType = (item) => {
    if (typeof getItemType === 'function') return getItemType(item);
    return type;
  };

  const resolveHref = (item, mediaType) => {
    if (typeof hrefBuilder === 'function') return hrefBuilder(item);
    return `/${mediaType}/${item.id}`;
  };

  const goToPage = (page) => {
    if (!scrollRef.current) return;

    const clampedPage = Math.max(0, Math.min(page, maxPage));
    const pageWidth = scrollRef.current.clientWidth || 1;

    scrollRef.current.scrollTo({
      left: clampedPage * pageWidth,
      behavior: 'smooth',
    });

    setCurrentPage(clampedPage);
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const targetPage = preservePageOnItemsChange
      ? Math.max(0, Math.min(currentPage, maxPage))
      : 0;

    const pageWidth = container.clientWidth || 1;

    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }

    container.scrollTo({
      left: targetPage * pageWidth,
      behavior: 'auto',
    });
  }, [items.length, maxPage, preservePageOnItemsChange, sectionKey]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const pageWidth = container.clientWidth || 1;
      const nextPage = Math.round(container.scrollLeft / pageWidth);
      setCurrentPage((prev) => {
        const normalized = Math.max(0, Math.min(nextPage, maxPage));
        return prev === normalized ? prev : normalized;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [maxPage]);

  if (!items.length) {
    if (!emptyText) return null;

    return (
      <div className="overflow-hidden rounded-xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-5 py-3">
          <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400 md:text-xl">
            {title}
          </h2>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-gray-500 opacity-60"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>

            <button
              type="button"
              disabled
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-gray-500 opacity-60"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-5 py-8 text-sm text-gray-400">{emptyText}</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-5 py-3">
        <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400 md:text-xl">
          {title}
        </h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={!canScrollLeft}
            className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
              canScrollLeft
                ? 'cursor-pointer bg-black/25 text-gray-300 hover:text-white hover:shadow-inner hover:shadow-red-500/60'
                : 'cursor-default bg-black/15 text-gray-500 opacity-60'
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
                ? 'cursor-pointer bg-black/25 text-gray-300 hover:text-white hover:shadow-inner hover:shadow-red-500/60'
                : 'cursor-default bg-black/15 text-gray-500 opacity-60'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

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
                key={`${sectionKey}-page-${pageIndex}`}
                className={`grid min-w-full gap-4 px-5 py-5 ${
                  compact
                    ? cardsPerPage === 10
                      ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10'
                      : cardsPerPage === 5
                        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                        : 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'
                    : cardsPerPage === 5
                      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
                }`}
              >
                {pageItems.map((item, index) => {
                  const mediaType = resolveMediaType(item) || 'movie';
                  const bookmarkKey = `${mediaType}-${item.id}`;
                  const isBookmarked = bookmarkedIds.has(bookmarkKey);
                  const isContinueWatchingSection = title === 'Continue Watching';
                  const isNextUpSection = title === 'Next Up';

                  return (
                    <Link
                      key={`${sectionKey}-${item.id || index}-${mediaType}`}
                      href={resolveHref(item, mediaType)}
                      className={`group block min-w-0 cursor-pointer ${compact ? 'max-w-[190px]' : ''}`}
                    >
                      <div className="relative overflow-hidden rounded-lg border-[1.5px] border-white/10 bg-black/20 transition duration-300 group-hover:border-red-400/90 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.45)]">
                        <CardBadges
                          item={item}
                          isBookmarked={isBookmarked}
                          onToggleBookmark={() => onToggleBookmark?.(item, mediaType)}
                          compact={compact}
                        />

                        <div className="absolute inset-0 bg-red-500/10 opacity-0 blur-xl transition duration-300 group-hover:opacity-100" />

                        <div className="relative aspect-[2/3] w-full bg-gray-800">
                          {item.poster_path ? (
                            <img
                              src={`${IMAGE_POSTER}${item.poster_path}`}
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

                      <div className={compact ? 'mt-2' : 'mt-3'}>
                        <div
                          className={`line-clamp-1 font-medium text-white transition group-hover:text-red-300 ${
                            compact ? 'text-xs' : 'text-sm'
                          }`}
                        >
                          {item.title || item.name || 'Untitled'}
                        </div>

                        {isContinueWatchingSection || isNextUpSection ? (
                          <>
                            <div className={`mt-1 text-gray-400 ${compact ? 'text-[11px]' : 'text-xs'}`}>
                              {(item.media_type || item.type) === 'tv'
                                ? `S${
                                    isNextUpSection
                                      ? item.nextSeason || item.season || '?'
                                      : item.season || '?'
                                  } • E${
                                    isNextUpSection
                                      ? item.nextEpisode || item.episode || '?'
                                      : item.episode || '?'
                                  }${
                                    !isNextUpSection && item.episode_name
                                      ? ` • ${item.episode_name}`
                                      : ''
                                  }`
                                : formatRemainingTime(item.remainingTime)}
                            </div>

                            {(item.media_type || item.type) === 'tv' && (
                              <div className={`mt-1 text-gray-500 ${compact ? 'text-[11px]' : 'text-xs'}`}>
                                {isNextUpSection
                                  ? 'Ready to start'
                                  : formatRemainingTime(item.remainingTime)}
                              </div>
                            )}

                            {!isNextUpSection && (
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="h-full rounded-full bg-red-500"
                                  style={{
                                    width: `${Math.max(
                                      0,
                                      Math.min(100, Number(item.progress) || 0)
                                    )}%`,
                                  }}
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className={`mt-1 text-gray-400 ${compact ? 'text-[11px]' : 'text-xs'}`}>
                            {(item.release_date || item.first_air_date || 'Unknown').slice(0, 4)}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}

                {pageItems.length < cardsPerPage &&
                  Array.from({ length: cardsPerPage - pageItems.length }).map((_, fillerIndex) => (
                    <div key={`${sectionKey}-filler-${pageIndex}-${fillerIndex}`} />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function HomeContent() {
  const [heroMovies, setHeroMovies] = useState([]);
  const [currentBackdrop, setCurrentBackdrop] = useState(0);

  const [topDayMovies, setTopDayMovies] = useState([]);
  const [topDayShows, setTopDayShows] = useState([]);
  const [trendingWeekMovies, setTrendingWeekMovies] = useState([]);
  const [trendingWeekShows, setTrendingWeekShows] = useState([]);

  const [continueWatching, setContinueWatching] = useState([]);
  const [nextUp, setNextUp] = useState([]);
  const [bookmarkedContent, setBookmarkedContent] = useState([]);
  const [userId, setUserId] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [progressReady, setProgressReady] = useState(false);
  const [progressTick, setProgressTick] = useState(0);

  const watchedEpisodesRef = useRef({});

  const currentHero = useMemo(
    () => heroMovies[currentBackdrop] || null,
    [heroMovies, currentBackdrop]
  );

  const readBookmarks = (uid) => {
    if (!uid) {
      setBookmarkedIds(new Set());
      setBookmarkedContent([]);
      return;
    }

    try {
      const raw = localStorage.getItem(`kflix_watchlist_${uid}`);
      const parsed = raw ? JSON.parse(raw) : [];
      const normalized = Array.isArray(parsed) ? parsed : [];
      const sorted = [...normalized].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

      const ids = new Set(
        sorted.map((item) => `${item.type || item.media_type || 'movie'}-${item.id}`)
      );

      setBookmarkedIds(ids);
      setBookmarkedContent(sorted);
    } catch {
      setBookmarkedIds(new Set());
      setBookmarkedContent([]);
    }
  };

  const syncProgressSections = (uid, watchedMapArg) => {
    if (!uid) {
      setContinueWatching([]);
      setNextUp([]);
      setProgressReady(true);
      return;
    }

    try {
      const normalized = parseContinueWatchingStorage(uid);

      const latestByTitle = normalized.reduce((map, item) => {
        if (!item || !item.id) return map;

        const mediaType = item.media_type || item.type || 'movie';
        const key = `${mediaType}-${item.id}`;
        const existing = map.get(key);

        if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
          map.set(key, item);
        }

        return map;
      }, new Map());

      const sorted = [...latestByTitle.values()].sort(
        (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
      );

      const watchedMap = normalizeWatchedMap(watchedMapArg);
      const { continueItems, nextUpItems } = splitProgressIntoSections(sorted, watchedMap);

      setContinueWatching(continueItems);
      setNextUp(nextUpItems);
      setProgressReady(true);
    } catch {
      setContinueWatching([]);
      setNextUp([]);
      setProgressReady(true);
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
          media_type: mediaType,
          title: item.title || item.name || 'Untitled',
          name: item.name || item.title || 'Untitled',
          poster_path: item.poster_path || null,
          backdrop_path: item.backdrop_path || null,
          release_date: item.release_date || null,
          first_air_date: item.first_air_date || null,
          vote_average: item.vote_average ?? null,
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
      setProgressReady(false);
      readBookmarks(uid);

      if (!uid) {
        watchedEpisodesRef.current = {};
        setContinueWatching([]);
        setNextUp([]);
        setProgressReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const watchedRef = ref(db, `users/${userId}/watchedEpisodes`);

    const unsubscribe = onValue(watchedRef, (snapshot) => {
      const nextMap = normalizeWatchedMap(snapshot.exists() ? snapshot.val() : {});
      watchedEpisodesRef.current = nextMap;
      syncProgressSections(userId, nextMap);
    });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const sync = () => {
      syncProgressSections(userId, watchedEpisodesRef.current);
      readBookmarks(userId);
    };

    sync();

    const handleStorage = (event) => {
      if (
        !event.key ||
        event.key === `kflix_continue_watching_${userId}` ||
        event.key === `kflix_watchlist_${userId}`
      ) {
        setProgressTick((prev) => prev + 1);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setProgressTick((prev) => prev + 1);
      }
    };

    const handleCustom = () => {
      setProgressTick((prev) => prev + 1);
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('kflix-continue-watching-updated', handleCustom);
    window.addEventListener('kflix-watched-episode-updated', handleCustom);

    const interval = setInterval(() => {
      setProgressTick((prev) => prev + 1);
    }, 1500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('kflix-continue-watching-updated', handleCustom);
      window.removeEventListener('kflix-watched-episode-updated', handleCustom);
      clearInterval(interval);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    syncProgressSections(userId, watchedEpisodesRef.current);
    readBookmarks(userId);
  }, [progressTick, userId]);

  useEffect(() => {
    const fetchHero = async () => {
      const results = await fetchTMDB('trending/movie/day');
      setHeroMovies(results.filter((m) => m.backdrop_path).slice(0, 10));
    };

    fetchHero();
  }, []);

  useEffect(() => {
    if (!heroMovies.length) return;

    const interval = setInterval(() => {
      setCurrentBackdrop((prev) => (prev + 1) % heroMovies.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [heroMovies]);

  useEffect(() => {
    const fetchCarousels = async () => {
      const [dayMovies, dayShows, weekMovies, weekShows] = await Promise.all([
        fetchTMDB('trending/movie/day'),
        fetchTMDB('trending/tv/day'),
        fetchTMDB('trending/movie/week'),
        fetchTMDB('trending/tv/week'),
      ]);

      setTopDayMovies(dayMovies.filter((m) => m.poster_path).slice(0, 10));
      setTopDayShows(dayShows.filter((s) => s.poster_path).slice(0, 10));
      setTrendingWeekMovies(weekMovies.filter((m) => m.poster_path).slice(0, 18));
      setTrendingWeekShows(weekShows.filter((s) => s.poster_path).slice(0, 18));
    };

    fetchCarousels();
  }, []);

  const goHeroLeft = () => {
    if (!heroMovies.length) return;
    setCurrentBackdrop((prev) => (prev - 1 + heroMovies.length) % heroMovies.length);
  };

  const goHeroRight = () => {
    if (!heroMovies.length) return;
    setCurrentBackdrop((prev) => (prev + 1) % heroMovies.length);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="px-4 pt-24 sm:px-6 lg:px-8">
        <div className="relative h-[62vh] min-h-[470px] w-full overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          {heroMovies.map((movie, idx) => (
            <Link
              key={movie.id}
              href={`/movie/${movie.id}`}
              aria-label={movie.title || 'View movie details'}
              className={`absolute inset-0 z-0 cursor-pointer bg-cover bg-center transition-all duration-[900ms] ${
                idx === currentBackdrop
                  ? 'pointer-events-auto scale-100 opacity-100'
                  : 'pointer-events-none scale-[1.02] opacity-0'
              }`}
              style={{
                backgroundImage: `url(${IMAGE_BACKDROP}${movie.backdrop_path})`,
              }}
            />
          ))}

          <div className="pointer-events-none absolute inset-0 bg-black/45" />

          <div className="absolute inset-y-0 left-4 z-30 flex items-center">
            <button
              type="button"
              onClick={goHeroLeft}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/35 backdrop-blur-md transition active:scale-95 hover:shadow-inner hover:shadow-red-500/60"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          </div>

          <div className="absolute inset-y-0 right-4 z-30 flex items-center">
            <button
              type="button"
              onClick={goHeroRight}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/35 backdrop-blur-md transition active:scale-95 hover:shadow-inner hover:shadow-red-500/60"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          {currentHero && (
            <Link
              href={`/movie/${currentHero.id}`}
              className="relative z-20 flex h-full w-full max-w-4xl cursor-pointer flex-col justify-end px-8 pb-10 text-left"
            >
              <h1 className="text-4xl font-bold md:text-6xl">{currentHero.title}</h1>
              <p className="mt-4 max-w-2xl line-clamp-3 text-gray-200">
                {currentHero.overview}
              </p>
            </Link>
          )}
        </div>
      </section>

      <section className="space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 xl:grid-cols-2">
          {progressReady ? (
            <>
              <CarouselSection
                title="Continue Watching"
                sectionKey="continue-watching"
                items={continueWatching}
                bookmarkedIds={bookmarkedIds}
                onToggleBookmark={toggleBookmark}
                getItemType={(item) => item.media_type || item.type || 'movie'}
                hrefBuilder={buildContinueWatchingHref}
                emptyText="Start watching something and it’ll show up here."
                compact
                cardsPerPage={5}
                preservePageOnItemsChange
              />

              <CarouselSection
                title="Next Up"
                sectionKey="next-up"
                items={nextUp}
                bookmarkedIds={bookmarkedIds}
                onToggleBookmark={toggleBookmark}
                getItemType={(item) => item.media_type || item.type || 'movie'}
                hrefBuilder={buildNextUpHref}
                emptyText="Finish an episode and the next one will show up here."
                compact
                cardsPerPage={5}
                preservePageOnItemsChange
              />
            </>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-5 py-3">
                  <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400 md:text-xl">
                    Continue Watching
                  </h2>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-gray-500 opacity-60"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M15 6l-6 6 6 6" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-gray-500 opacity-60"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="px-5 py-8 text-sm text-gray-400">Loading your progress...</div>
              </div>

              <div className="overflow-hidden rounded-xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-5 py-3">
                  <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400 md:text-xl">
                    Next Up
                  </h2>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-gray-500 opacity-60"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M15 6l-6 6 6 6" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-gray-500 opacity-60"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="px-5 py-8 text-sm text-gray-400">Loading your progress...</div>
              </div>
            </>
          )}
        </div>

        <CarouselSection
          title="Bookmarked Content"
          sectionKey="bookmarked-content"
          items={bookmarkedContent}
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={toggleBookmark}
          getItemType={(item) => item.type || item.media_type || 'movie'}
          emptyText="Save content to your bookmarks and it’ll show up here."
          compact
          cardsPerPage={10}
          preservePageOnItemsChange
        />

        <CarouselSection
          title="Top 10 Movies of the Day"
          sectionKey="top-10-movies-day"
          items={topDayMovies}
          type="movie"
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={toggleBookmark}
          cardsPerPage={5}
        />

        <CarouselSection
          title="Top 10 Shows of the Day"
          sectionKey="top-10-shows-day"
          items={topDayShows}
          type="tv"
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={toggleBookmark}
          cardsPerPage={5}
        />

        <CarouselSection
          title="Trending Movies This Week"
          sectionKey="trending-movies-week"
          items={trendingWeekMovies}
          type="movie"
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={toggleBookmark}
        />

        <CarouselSection
          title="Trending Shows This Week"
          sectionKey="trending-shows-week"
          items={trendingWeekShows}
          type="tv"
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={toggleBookmark}
        />
      </section>

      <footer className="px-4 pb-8 pt-2 text-center text-sm text-gray-400 sm:px-6 lg:px-8">
        <p>This website does not host or store any media on its servers.</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
          <Link href="/Terms-and-Conditions" className="cursor-pointer transition hover:text-red-400">
            Terms and Conditions
          </Link>
          <span>•</span>
          <Link href="/Privacy-Policy" className="cursor-pointer transition hover:text-red-400">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/Feedback" className="cursor-pointer transition hover:text-red-400">
            Feedback
          </Link>
          <span>•</span>
          <Link href="/Contact" className="cursor-pointer transition hover:text-red-400">
            Contact
          </Link>
          <span>•</span>
          <Link href="/Help" className="cursor-pointer transition hover:text-red-400">
            Help
          </Link>
        </div>
      </footer>
    </div>
  );
}