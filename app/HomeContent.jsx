'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Navbar from '@/components/Navbar';

const TMDB_API_KEY = 'bb55db1bab2f577940a88a75fa45692a';
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

      {item.imdbRating ? <RatingBadge label="IMDb" value={item.imdbRating} /> : null}
      {item.rtRating ? <RatingBadge label="RT" value={item.rtRating} /> : null}
      {tmdbRating ? <RatingBadge label="TMDB" value={tmdbRating} /> : null}
    </div>
  );
}

function CarouselSection({ title, items, type, bookmarkedIds, onToggleBookmark }) {
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

  if (!items.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-5 py-3">
        <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400 md:text-xl">
          {title}
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={!canScrollLeft}
            className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
              canScrollLeft
                ? 'bg-black/25 text-gray-300 cursor-pointer hover:text-white hover:shadow-inner hover:shadow-red-500/60'
                : 'bg-black/15 text-gray-500 cursor-not-allowed opacity-60'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={!canScrollRight}
            className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
              canScrollRight
                ? 'bg-black/25 text-gray-300 cursor-pointer hover:text-white hover:shadow-inner hover:shadow-red-500/60'
                : 'bg-black/15 text-gray-500 cursor-not-allowed opacity-60'
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
              <div key={pageIndex} className="grid min-w-full grid-cols-6 gap-4 px-5 py-5">
                {pageItems.map((item) => {
                  const mediaType = type;
                  const bookmarkKey = `${mediaType}-${item.id}`;
                  const isBookmarked = bookmarkedIds.has(bookmarkKey);

                  return (
                    <a
                      key={item.id}
                      href={`/${type}/${item.id}`}
                      className="group min-w-0"
                    >
                      <div className="relative overflow-hidden rounded-lg border-[1.5px] border-white/10 bg-black/20 transition duration-300 group-hover:border-red-400/90 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.45)]">
                        <CardBadges
                          item={item}
                          isBookmarked={isBookmarked}
                          onToggleBookmark={() => onToggleBookmark?.(item, mediaType)}
                        />

                        <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 bg-red-500/10 blur-xl" />

                        <div className="relative w-full aspect-[2/3] bg-gray-800">
                          <img
                            src={`${IMAGE_POSTER}${item.poster_path}`}
                            alt={item.title || item.name || 'Poster'}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.06]"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="line-clamp-1 text-sm font-medium text-white transition group-hover:text-red-300">
                          {item.title || item.name}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          {(item.release_date || item.first_air_date || 'Unknown').slice(0, 4)}
                        </div>
                      </div>
                    </a>
                  );
                })}

                {pageItems.length < cardsPerPage &&
                  Array.from({ length: cardsPerPage - pageItems.length }).map((_, fillerIndex) => (
                    <div key={`filler-${fillerIndex}`} />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ContinueWatchingSection({ items, bookmarkedIds, onToggleBookmark }) {
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

  if (!items.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-5 py-3">
        <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400 md:text-xl">
          Continue Watching
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={!canScrollLeft}
            className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
              canScrollLeft
                ? 'bg-black/25 text-gray-300 cursor-pointer hover:text-white hover:shadow-inner hover:shadow-red-500/60'
                : 'bg-black/15 text-gray-500 cursor-not-allowed opacity-60'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={!canScrollRight}
            className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
              canScrollRight
                ? 'bg-black/25 text-gray-300 cursor-pointer hover:text-white hover:shadow-inner hover:shadow-red-500/60'
                : 'bg-black/15 text-gray-500 cursor-not-allowed opacity-60'
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
              <div key={pageIndex} className="grid min-w-full grid-cols-6 gap-4 px-5 py-5">
                {pageItems.map((item, index) => {
                  const mediaType = item.media_type || 'movie';
                  const bookmarkKey = `${mediaType}-${item.id}`;
                  const isBookmarked = bookmarkedIds.has(bookmarkKey);

                  return (
                    <a
                      key={`${item.id || index}-${mediaType}`}
                      href={`/${mediaType}/${item.id}`}
                      className="group min-w-0"
                    >
                      <div className="relative overflow-hidden rounded-lg border-[1.5px] border-white/10 bg-black/20 transition duration-300 group-hover:border-red-400/90 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.45)]">
                        <CardBadges
                          item={item}
                          isBookmarked={isBookmarked}
                          onToggleBookmark={() => onToggleBookmark?.(item, mediaType)}
                        />

                        <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 bg-red-500/10 blur-xl" />

                        <div className="relative w-full aspect-[2/3] bg-gray-800">
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

                      <div className="mt-3">
                        <div className="line-clamp-1 text-sm font-medium text-white transition group-hover:text-red-300">
                          {item.title || item.name || 'Untitled'}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          Continue watching
                        </div>
                      </div>
                    </a>
                  );
                })}

                {pageItems.length < cardsPerPage &&
                  Array.from({ length: cardsPerPage - pageItems.length }).map((_, fillerIndex) => (
                    <div key={`continue-filler-${fillerIndex}`} />
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
  const router = useRouter();
  const [topMovies, setTopMovies] = useState([]);
  const [currentBackdrop, setCurrentBackdrop] = useState(0);
  const [topWeekMovies, setTopWeekMovies] = useState([]);
  const [topWeekShows, setTopWeekShows] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [userId, setUserId] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

  const currentHero = useMemo(
    () => topMovies[currentBackdrop] || null,
    [topMovies, currentBackdrop]
  );

  const readContinueWatching = (uid) => {
    if (!uid) {
      setContinueWatching([]);
      return;
    }

    const raw = localStorage.getItem(`kflix_continue_watching_${uid}`);

    if (!raw) {
      setContinueWatching([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setContinueWatching(Array.isArray(parsed) ? parsed.slice(0, 18) : []);
    } catch {
      setContinueWatching([]);
    }
  };

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
      readContinueWatching(uid);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchHero = async () => {
      const results = await fetchTMDB('trending/movie/day');
      setTopMovies(results.filter((m) => m.backdrop_path).slice(0, 10));
    };
    fetchHero();
  }, []);

  useEffect(() => {
    if (!topMovies.length) return;
    const interval = setInterval(() => {
      setCurrentBackdrop((prev) => (prev + 1) % topMovies.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [topMovies]);

  useEffect(() => {
    const fetchCarousels = async () => {
      const movies = await fetchTMDB('movie/popular');
      const shows = await fetchTMDB('tv/popular');

      setTopWeekMovies(movies.filter((m) => m.poster_path).slice(0, 18));
      setTopWeekShows(shows.filter((s) => s.poster_path).slice(0, 18));
    };
    fetchCarousels();
  }, []);

  useEffect(() => {
    const sync = () => {
      readContinueWatching(userId);
      readBookmarks(userId);
    };

    sync();

    const handleStorage = (event) => {
      if (
        !event.key ||
        event.key === `kflix_continue_watching_${userId}` ||
        event.key === `kflix_watchlist_${userId}`
      ) {
        sync();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sync();
      }
    };

    const handleCustom = () => {
      sync();
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('kflix-continue-watching-updated', handleCustom);

    const interval = setInterval(sync, 1500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('kflix-continue-watching-updated', handleCustom);
      clearInterval(interval);
    };
  }, [userId]);

  const goHeroLeft = () => {
    if (!topMovies.length) return;
    setCurrentBackdrop((prev) => (prev - 1 + topMovies.length) % topMovies.length);
  };

  const goHeroRight = () => {
    if (!topMovies.length) return;
    setCurrentBackdrop((prev) => (prev + 1) % topMovies.length);
  };

  const goToHeroDetail = () => {
    if (!currentHero) return;
    router.push(`/movie/${currentHero.id}`);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="px-8 pt-24">
        <div className="relative h-[62vh] min-h-[470px] w-full overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          {topMovies.map((movie, idx) => (
            <button
              key={movie.id}
              onClick={goToHeroDetail}
              className={`absolute inset-0 bg-center bg-cover transition-all duration-[900ms] ${
                idx === currentBackdrop
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 scale-[1.02]'
              }`}
              style={{
                backgroundImage: `url(${IMAGE_BACKDROP}${movie.backdrop_path})`,
              }}
            />
          ))}

          <div className="absolute inset-0 bg-black/45" />

          <div className="absolute inset-y-0 left-4 flex items-center z-20">
            <button
              onClick={goHeroLeft}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur-md transition active:scale-95 hover:shadow-inner hover:shadow-red-500/60"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          </div>

          <div className="absolute inset-y-0 right-4 flex items-center z-20">
            <button
              onClick={goHeroRight}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur-md transition active:scale-95 hover:shadow-inner hover:shadow-red-500/60"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          <button
            onClick={goToHeroDetail}
            className="relative z-10 flex h-full w-full max-w-4xl flex-col justify-end px-8 pb-10 text-left"
          >
            {currentHero && (
              <>
                <h1 className="text-4xl md:text-6xl font-bold">
                  {currentHero.title}
                </h1>
                <p className="mt-4 max-w-2xl line-clamp-3 text-gray-200">
                  {currentHero.overview}
                </p>
              </>
            )}
          </button>
        </div>
      </section>

      <section className="space-y-10 px-8 py-10">
        <ContinueWatchingSection
          items={continueWatching}
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={toggleBookmark}
        />
        <CarouselSection
          title="Top Movies of the Week"
          items={topWeekMovies}
          type="movie"
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={toggleBookmark}
        />
        <CarouselSection
          title="Top Shows of the Week"
          items={topWeekShows}
          type="tv"
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={toggleBookmark}
        />
      </section>

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