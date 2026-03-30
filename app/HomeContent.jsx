'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { onValue, ref, set, remove, update } from 'firebase/database';
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

async function fetchTvDetail(id) {
  const res = await fetch(
    `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}`
  );

  if (!res.ok) {
    throw new Error('Failed to fetch show details');
  }

  return res.json();
}

function formatRemainingTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);

  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${mins}m left`;
}

function buildEpisodeKey(showId, seasonNumber, episodeNumber) {
  return `${showId}-S${seasonNumber}-E${episodeNumber}`;
}

function buildContentKey(item) {
  const mediaType = item?.media_type || item?.type || 'movie';
  return `${mediaType}-${item?.id}`;
}

function normalizeMap(value) {
  if (!value || typeof value !== 'object') return {};
  return value;
}

function mapToSortedArray(value, sortField = 'updatedAt') {
  const normalized = normalizeMap(value);
  return Object.values(normalized)
    .filter(Boolean)
    .sort((a, b) => (b?.[sortField] || 0) - (a?.[sortField] || 0));
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

function resolveNextTvEpisode(showData, season, episode) {
  const currentSeason = Number(season || 0);
  const currentEpisode = Number(episode || 0);

  if (currentSeason <= 0 || currentEpisode <= 0) return null;

  const seasons = Array.isArray(showData?.seasons)
    ? [...showData.seasons]
        .filter((item) => Number(item?.season_number || 0) > 0)
        .sort((a, b) => Number(a?.season_number || 0) - Number(b?.season_number || 0))
    : [];

  const seasonMeta = seasons.find(
    (item) => Number(item?.season_number || 0) === currentSeason
  );

  const episodeCount = Number(seasonMeta?.episode_count || 0);

  if (episodeCount > 0 && currentEpisode < episodeCount) {
    return {
      season: currentSeason,
      episode: currentEpisode + 1,
    };
  }

  const currentSeasonIndex = seasons.findIndex(
    (item) => Number(item?.season_number || 0) === currentSeason
  );

  if (currentSeasonIndex >= 0 && currentSeasonIndex < seasons.length - 1) {
    return {
      season: Number(seasons[currentSeasonIndex + 1]?.season_number || 0),
      episode: 1,
    };
  }

  return null;
}

function IconBadgeButton({
  active = false,
  onClick,
  title,
  ariaLabel,
  activeClassName,
  inactiveClassName,
  children,
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      className={`pointer-events-auto inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border backdrop-blur-md transition active:scale-95 ${
        active ? activeClassName : inactiveClassName
      }`}
      title={title}
      aria-label={ariaLabel || title}
    >
      {children}
    </button>
  );
}

function BookmarkBadge({ active, onToggle }) {
  return (
    <IconBadgeButton
      active={active}
      onClick={onToggle}
      title={active ? 'Remove bookmark' : 'Save bookmark'}
      ariaLabel={active ? 'Remove bookmark' : 'Save bookmark'}
      activeClassName="border-red-400/70 bg-red-600/90 text-white shadow-[0_0_14px_rgba(239,68,68,0.35)] hover:bg-red-700"
      inactiveClassName="border-white/15 bg-black/65 text-white shadow-[0_0_14px_rgba(0,0,0,0.2)] hover:border-red-400/60 hover:text-red-300"
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
    </IconBadgeButton>
  );
}

function ActionBadge({
  checked = false,
  onClick,
  title,
  variant = 'watch',
}) {
  const isRemove = variant === 'remove';

  return (
    <IconBadgeButton
      active={checked}
      onClick={onClick}
      title={title}
      ariaLabel={title}
      activeClassName={
        isRemove
          ? 'border-red-400/70 bg-red-600/90 text-white shadow-[0_0_14px_rgba(239,68,68,0.35)] hover:bg-red-700'
          : 'border-green-400/70 bg-green-600/90 text-white shadow-[0_0_14px_rgba(34,197,94,0.35)] hover:bg-green-700'
      }
      inactiveClassName={
        isRemove
          ? 'border-white/15 bg-black/65 text-white shadow-[0_0_14px_rgba(0,0,0,0.2)] hover:border-red-400/60 hover:text-red-300'
          : 'border-white/15 bg-black/65 text-white shadow-[0_0_14px_rgba(0,0,0,0.2)] hover:border-green-400/60 hover:text-green-300'
      }
    >
      <svg
        className="h-3.5 w-3.5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        {isRemove ? (
          <path d="M6 6l12 12M18 6L6 18" />
        ) : (
          <>
            <rect x="5" y="5" width="14" height="14" rx="2" />
            {checked ? <path d="M8 12.5l2.5 2.5L16 9.5" /> : null}
          </>
        )}
      </svg>
    </IconBadgeButton>
  );
}

function RatingsStarBadge({ item }) {
  const tmdbRating =
    typeof item.vote_average === 'number' && item.vote_average > 0
      ? item.vote_average.toFixed(1)
      : null;

  const hasAnyRating = Boolean(item.imdbRating || item.rtRating || tmdbRating);

  if (!hasAnyRating) return null;

  return (
    <div className="group/ratings pointer-events-auto relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-black/65 text-white shadow-[0_0_14px_rgba(0,0,0,0.2)] backdrop-blur-md transition active:scale-95 hover:border-yellow-300/70 hover:text-yellow-300"
        title="Show ratings"
        aria-label="Show ratings"
      >
        <svg
          className="h-3.5 w-3.5 flex-shrink-0"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            className="transition-opacity duration-150 group-hover/ratings:opacity-0"
            d="M12 17.3l-5.56 3.1 1.06-6.28L2.94 9.7l6.31-.93L12 3.1l2.75 5.67 6.31.93-4.56 4.42 1.06 6.28L12 17.3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            className="opacity-0 transition-opacity duration-150 group-hover/ratings:opacity-100"
            d="M12 17.3l-5.56 3.1 1.06-6.28L2.94 9.7l6.31-.93L12 3.1l2.75 5.67 6.31.93-4.56 4.42 1.06 6.28L12 17.3z"
            fill="currentColor"
          />
        </svg>
      </button>

      <div className="pointer-events-none absolute left-0 top-9 z-30 min-w-[88px] max-w-[110px] rounded-md border border-yellow-300/45 bg-gradient-to-b from-gray-800 to-gray-900 px-2.5 py-2 opacity-0 shadow-[0_0_18px_rgba(253,224,71,0.18),0_12px_35px_rgba(0,0,0,0.55)] transition-all duration-150 group-hover/ratings:pointer-events-auto group-hover/ratings:translate-y-0 group-hover/ratings:opacity-100">
        <div className="space-y-1.5">
          {item.imdbRating ? (
            <div className="flex items-center gap-2 text-[11px] leading-none">
              <span className="shrink-0 font-semibold uppercase tracking-[0.08em] text-yellow-300">IMDb</span>
              <span className="truncate text-white">{item.imdbRating}</span>
            </div>
          ) : null}

          {item.rtRating ? (
            <div className="flex items-center gap-2 text-[11px] leading-none">
              <span className="shrink-0 font-semibold uppercase tracking-[0.08em] text-yellow-300">RT</span>
              <span className="truncate text-white">{item.rtRating}</span>
            </div>
          ) : null}

          {tmdbRating ? (
            <div className="flex items-center gap-2 text-[11px] leading-none">
              <span className="shrink-0 font-semibold uppercase tracking-[0.08em] text-yellow-300">TMDB</span>
              <span className="truncate text-white">{tmdbRating}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CardBadges({
  item,
  isBookmarked,
  onToggleBookmark,
  showWatchedToggle = false,
  isWatched = false,
  onToggleWatched,
  watchedToggleVariant = 'watch',
  watchedToggleTitle,
}) {
  return (
    <>
      <div className="absolute left-2 top-2 z-20">
        <RatingsStarBadge item={item} />
      </div>

      <div className="absolute right-2 top-2 z-20 flex flex-col items-end gap-1">
        <BookmarkBadge active={isBookmarked} onToggle={onToggleBookmark} />
        {showWatchedToggle ? (
          <ActionBadge
            checked={isWatched}
            onClick={onToggleWatched}
            title={watchedToggleTitle}
            variant={watchedToggleVariant}
          />
        ) : null}
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
  watchedEpisodes,
  onMarkContinueWatchingWatched,
  onRemoveNextUp,
}) {
  const scrollRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);

  const mobileCardsPerPage = compact ? 2 : 2;
  const desktopCardsPerPage = cardsPerPage;
  const effectiveCardsPerPage = desktopCardsPerPage;
  const totalPages = Math.max(1, Math.ceil(items.length / effectiveCardsPerPage));
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
        <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold uppercase tracking-[0.16em] text-red-400 sm:text-lg md:text-xl">
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

        <div className="px-4 py-6 text-sm text-gray-400 sm:px-5 sm:py-8">{emptyText}</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-4 py-3 sm:px-5">
        <h2 className="pr-3 text-base font-semibold uppercase tracking-[0.16em] text-red-400 sm:text-lg md:text-xl">
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
              pageIndex * effectiveCardsPerPage,
              pageIndex * effectiveCardsPerPage + effectiveCardsPerPage
            );

            return (
              <div
                key={`${sectionKey}-page-${pageIndex}`}
                className={`grid min-w-full gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5 ${
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

                  const episodeKey =
                    mediaType === 'tv' && Number(item.season || 0) > 0 && Number(item.episode || 0) > 0
                      ? buildEpisodeKey(item.id, item.season, item.episode)
                      : '';

                  const isWatched = episodeKey ? Boolean(watchedEpisodes?.[episodeKey]) : false;

                  return (
                    <Link
                      key={`${sectionKey}-${item.id || index}-${mediaType}`}
                      href={resolveHref(item, mediaType)}
                      className="group block min-w-0"
                    >
                      <div className="relative overflow-hidden rounded-lg border-[1.5px] border-white/10 bg-black/20 transition duration-300 group-hover:border-red-400/90 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.45)]">
                        <CardBadges
                          item={item}
                          isBookmarked={isBookmarked}
                          onToggleBookmark={() => onToggleBookmark?.(item, mediaType)}
                          showWatchedToggle={isContinueWatchingSection || isNextUpSection}
                          isWatched={isContinueWatchingSection ? isWatched : true}
                          onToggleWatched={() => {
                            if (isContinueWatchingSection) {
                              onMarkContinueWatchingWatched?.(item);
                              return;
                            }

                            if (isNextUpSection) {
                              onRemoveNextUp?.(item);
                            }
                          }}
                          watchedToggleVariant={isNextUpSection ? 'remove' : 'watch'}
                          watchedToggleTitle={
                            isNextUpSection
                              ? 'Remove from Next Up'
                              : isWatched
                                ? 'Marked watched'
                                : 'Mark as watched'
                          }
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

                      <div className="mt-2 sm:mt-3">
                        <div className="line-clamp-1 text-xs font-medium text-white transition group-hover:text-red-300 sm:text-sm">
                          {item.title || item.name || 'Untitled'}
                        </div>

                        {isContinueWatchingSection || isNextUpSection ? (
                          <>
                            <div className="mt-1 text-[11px] text-gray-400 sm:text-xs">
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
                              <div className="mt-1 text-[11px] text-gray-500 sm:text-xs">
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
                          <div className="mt-1 text-[11px] text-gray-400 sm:text-xs">
                            {(item.release_date || item.first_air_date || 'Unknown').slice(0, 4)}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}

                {pageItems.length < effectiveCardsPerPage &&
                  Array.from({ length: effectiveCardsPerPage - pageItems.length }).map((_, fillerIndex) => (
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

  const [continueWatchingRaw, setContinueWatchingRaw] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [nextUp, setNextUp] = useState([]);

  const [bookmarkedContent, setBookmarkedContent] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

  const [userId, setUserId] = useState('');
  const [watchedEpisodes, setWatchedEpisodes] = useState({});
  const [progressReady, setProgressReady] = useState(false);
  const [bookmarksReady, setBookmarksReady] = useState(false);

  const currentHero = useMemo(
    () => heroMovies[currentBackdrop] || null,
    [heroMovies, currentBackdrop]
  );

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const uid = currentUser?.uid || '';
      setUserId(uid);

      if (!uid) {
        setContinueWatchingRaw([]);
        setContinueWatching([]);
        setNextUp([]);
        setBookmarkedContent([]);
        setBookmarkedIds(new Set());
        setWatchedEpisodes({});
        setProgressReady(true);
        setBookmarksReady(true);
      } else {
        setProgressReady(false);
        setBookmarksReady(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const continueRef = ref(db, `users/${userId}/continueWatching`);

    const unsubscribe = onValue(
      continueRef,
      (snapshot) => {
        const raw = snapshot.exists() ? snapshot.val() : {};
        const items = mapToSortedArray(raw, 'updatedAt');
        setContinueWatchingRaw(items);
        setProgressReady(true);
      },
      () => {
        setContinueWatchingRaw([]);
        setProgressReady(true);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const watchedRef = ref(db, `users/${userId}/watchedEpisodes`);

    const unsubscribe = onValue(
      watchedRef,
      (snapshot) => {
        const nextMap = normalizeMap(snapshot.exists() ? snapshot.val() : {});
        setWatchedEpisodes(nextMap);
      },
      () => {
        setWatchedEpisodes({});
      }
    );

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const bookmarksRef = ref(db, `users/${userId}/bookmarks`);

    const unsubscribe = onValue(
      bookmarksRef,
      (snapshot) => {
        const raw = snapshot.exists() ? snapshot.val() : {};
        const items = mapToSortedArray(raw, 'addedAt');

        setBookmarkedContent(items);
        setBookmarkedIds(new Set(items.map((item) => buildContentKey(item))));
        setBookmarksReady(true);
      },
      () => {
        setBookmarkedContent([]);
        setBookmarkedIds(new Set());
        setBookmarksReady(true);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const { continueItems, nextUpItems } = splitProgressIntoSections(
      continueWatchingRaw,
      watchedEpisodes
    );

    setContinueWatching(continueItems);
    setNextUp(nextUpItems);
  }, [continueWatchingRaw, watchedEpisodes, userId]);

  const toggleBookmark = async (item, mediaType) => {
    if (!userId || !item?.id) return;

    const bookmarkKey = `${mediaType}-${item.id}`;
    const bookmarkRef = ref(db, `users/${userId}/bookmarks/${bookmarkKey}`);
    const exists = bookmarkedIds.has(bookmarkKey);

    try {
      if (exists) {
        await remove(bookmarkRef);
        return;
      }

      const bookmarkItem = {
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
        imdbRating: item.imdbRating ?? null,
        rtRating: item.rtRating ?? null,
        addedAt: Date.now(),
      };

      await set(bookmarkRef, bookmarkItem);
    } catch (error) {
      console.error('Bookmark toggle failed:', error);
    }
  };

  const markContinueWatchingAsWatched = async (item) => {
    if (!userId || !item?.id) return;

    const mediaType = item.media_type || item.type || 'movie';
    const continueKey = `${mediaType}-${item.id}`;
    const continueRef = ref(db, `users/${userId}/continueWatching/${continueKey}`);

    try {
      if (mediaType !== 'tv') {
        await remove(continueRef);
        return;
      }

      const season = Number(item.season || 0);
      const episode = Number(item.episode || 0);

      if (season <= 0 || episode <= 0) {
        await remove(continueRef);
        return;
      }

      const episodeKey = buildEpisodeKey(item.id, season, episode);
      await update(ref(db, `users/${userId}/watchedEpisodes`), {
        [episodeKey]: true,
      });

      let nextTarget = null;

      const explicitNextSeason = Number(item.nextSeason || 0);
      const explicitNextEpisode = Number(item.nextEpisode || 0);

      if (
        explicitNextSeason > 0 &&
        explicitNextEpisode > 0 &&
        (explicitNextSeason !== season || explicitNextEpisode !== episode)
      ) {
        nextTarget = {
          season: explicitNextSeason,
          episode: explicitNextEpisode,
        };
      } else {
        try {
          const showData = await fetchTvDetail(item.id);
          nextTarget = resolveNextTvEpisode(showData, season, episode);
        } catch (error) {
          console.error('Failed to resolve next episode:', error);
        }
      }

      if (!nextTarget) {
        await remove(continueRef);
        return;
      }

      await set(continueRef, {
        ...item,
        media_type: 'tv',
        type: 'tv',
        season,
        episode,
        nextSeason: nextTarget.season,
        nextEpisode: nextTarget.episode,
        currentTime: 0,
        remainingTime: null,
        progress: 0,
        isPlaying: false,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to mark continue watching item as watched:', error);
    }
  };

  const removeNextUpItem = async (item) => {
    if (!userId || !item?.id) return;

    const mediaType = item.media_type || item.type || 'movie';
    const continueKey = `${mediaType}-${item.id}`;
    const continueRef = ref(db, `users/${userId}/continueWatching/${continueKey}`);

    try {
      await remove(continueRef);
    } catch (error) {
      console.error('Failed to remove next up item:', error);
    }
  };

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

  const homepageReady = progressReady && bookmarksReady;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="px-3 pt-20 sm:px-4 sm:pt-24 lg:px-8">
        <div className="relative h-[42vh] min-h-[300px] w-full overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)] sm:h-[52vh] sm:min-h-[380px] lg:h-[62vh] lg:min-h-[470px]">
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

          <div className="pointer-events-none absolute inset-0 bg-black/50 sm:bg-black/45" />

          <div className="absolute inset-y-0 left-2 z-30 flex items-center sm:left-4">
            <button
              type="button"
              onClick={goHeroLeft}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 backdrop-blur-md transition active:scale-95 hover:shadow-inner hover:shadow-red-500/60 sm:h-10 sm:w-10"
            >
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          </div>

          <div className="absolute inset-y-0 right-2 z-30 flex items-center sm:right-4">
            <button
              type="button"
              onClick={goHeroRight}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 backdrop-blur-md transition active:scale-95 hover:shadow-inner hover:shadow-red-500/60 sm:h-10 sm:w-10"
            >
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          {currentHero && (
            <Link
              href={`/movie/${currentHero.id}`}
              className="relative z-20 flex h-full w-full max-w-4xl cursor-pointer flex-col justify-end px-4 pb-6 text-left sm:px-6 sm:pb-8 lg:px-8 lg:pb-10"
            >
              <h1 className="max-w-[85%] text-2xl font-bold leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
                {currentHero.title}
              </h1>
              <p className="mt-3 max-w-2xl line-clamp-3 text-sm text-gray-200 sm:mt-4 sm:text-base">
                {currentHero.overview}
              </p>
            </Link>
          )}
        </div>
      </section>

      <section className="space-y-6 px-3 py-6 sm:space-y-8 sm:px-4 sm:py-8 lg:space-y-10 lg:px-8 lg:py-10">
        <div className="grid gap-6 xl:grid-cols-2 xl:gap-10">
          {homepageReady ? (
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
                watchedEpisodes={watchedEpisodes}
                onMarkContinueWatchingWatched={markContinueWatchingAsWatched}
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
                watchedEpisodes={watchedEpisodes}
                onRemoveNextUp={removeNextUpItem}
              />
            </>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-4 py-3 sm:px-5">
                  <h2 className="text-base font-semibold uppercase tracking-[0.16em] text-red-400 sm:text-lg md:text-xl">
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

                <div className="px-4 py-6 text-sm text-gray-400 sm:px-5 sm:py-8">Loading your progress...</div>
              </div>

              <div className="overflow-hidden rounded-xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-4 py-3 sm:px-5">
                  <h2 className="text-base font-semibold uppercase tracking-[0.16em] text-red-400 sm:text-lg md:text-xl">
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

                <div className="px-4 py-6 text-sm text-gray-400 sm:px-5 sm:py-8">Loading your progress...</div>
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
          watchedEpisodes={watchedEpisodes}
        />

        <CarouselSection
          title="Top 10 Movies of the Day"
          sectionKey="top-10-movies-day"
          items={topDayMovies}
          type="movie"
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={toggleBookmark}
          cardsPerPage={5}
          watchedEpisodes={watchedEpisodes}
        />

        <CarouselSection
          title="Top 10 Shows of the Day"
          sectionKey="top-10-shows-day"
          items={topDayShows}
          type="tv"
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={toggleBookmark}
          cardsPerPage={5}
          watchedEpisodes={watchedEpisodes}
        />

        <CarouselSection
          title="Trending Movies This Week"
          sectionKey="trending-movies-week"
          items={trendingWeekMovies}
          type="movie"
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={toggleBookmark}
          watchedEpisodes={watchedEpisodes}
        />

        <CarouselSection
          title="Trending Shows This Week"
          sectionKey="trending-shows-week"
          items={trendingWeekShows}
          type="tv"
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={toggleBookmark}
          watchedEpisodes={watchedEpisodes}
        />
      </section>

      <footer className="px-4 pb-8 pt-2 text-center text-sm text-gray-400 sm:px-6 lg:px-8">
        <p>This site does not host or store any media.</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
          <Link href="/Terms-and-Conditions" className="cursor-pointer transition hover:text-red-400">
            Terms and Conditions
          </Link>

          <span>•</span>

          <Link href="/Privacy-Policy" className="cursor-pointer transition hover:text-red-400">
            Privacy Policy
          </Link>

          <span>•</span>

          <a
            href={`${process.env.NEXT_PUBLIC_GITHUB_REPO}/commit/${process.env.NEXT_PUBLIC_COMMIT_HASH}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-mono tracking-wider"
            title="View this version on GitHub"
          >
            <span className="text-gray-500">Update</span>
            <span className="animate-pulse text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)] transition hover:text-red-300">
              {process.env.NEXT_PUBLIC_COMMIT_HASH}
            </span>
          </a>
        </div>
      </footer>
    </div>
  );
}