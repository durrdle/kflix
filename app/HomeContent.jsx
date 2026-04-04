'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { get, onValue, ref, remove, set, update } from 'firebase/database';
import Navbar from '@/components/Navbar';
import { db } from '@/lib/firebaseParty';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const IMAGE_BACKDROP = 'https://image.tmdb.org/t/p/original';
const IMAGE_POSTER = 'https://image.tmdb.org/t/p/w500';
const WATCH_SESSION_KEY = 'kflix_watch_session';

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

function formatCountdown(dateString) {
  if (!dateString) return null;

  const target = new Date(dateString).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return 'Now airing';

  const totalSeconds = Math.floor(diff / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `Airing in ${days}d ${hours}h`;
  if (hours > 0) return `Airing in ${hours}h ${minutes}m`;
  return `Airing in ${minutes}m`;
}

function isFutureDate(dateString) {
  if (!dateString) return false;
  const time = new Date(dateString).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function buildEpisodeKey(showId, seasonNumber, episodeNumber) {
  return `${showId}-S${seasonNumber}-E${episodeNumber}`;
}

function buildContentKey(item) {
  const mediaType = item?.media_type || item?.type || 'movie';
  return `${mediaType}-${item?.id}`;
}

function buildContinueWatchingKey(type, id) {
  return `${type}-${id}`;
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
  const airingSoonItems = [];

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

    const currentEpisodeKey =
      season > 0 && episode > 0
        ? buildEpisodeKey(item.id, season, episode)
        : '';

    const currentIsWatched = currentEpisodeKey
      ? Boolean(watchedMap[currentEpisodeKey])
      : false;

    if (hasExplicitNext) {
      if (isFutureDate(item.nextAirDate)) {
        airingSoonItems.push(item);
      } else {
        nextUpItems.push(item);
      }
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
    airingSoonItems: airingSoonItems.slice(0, 10),
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

function getActiveProfileId() {
  if (typeof window === 'undefined') return '';

  try {
    const direct =
      localStorage.getItem('kflix_active_profile_id') ||
      sessionStorage.getItem('kflix_active_profile_id');

    if (direct) return String(direct);

    const raw =
      localStorage.getItem('kflix_active_profile') ||
      sessionStorage.getItem('kflix_active_profile');

    if (!raw) return '';

    const parsed = JSON.parse(raw);

    return String(parsed?.id || parsed?.profileId || parsed?.uid || '');
  } catch {
    return '';
  }
}

function resolveWatchOwnerId(userId) {
  const profileId = getActiveProfileId();
  return profileId || userId || '';
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
      className={`pointer-events-auto inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-white/10 backdrop-blur-xl transition duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 ${
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
      activeClassName="kflix-glass-button-accent text-white shadow-[0_8px_24px_var(--theme-accent-glow)]"
      inactiveClassName="kflix-glass-button text-white/90 hover:text-white hover:shadow-[0_10px_28px_rgba(255,255,255,0.08)]"
    >
      <svg
        className="h-3.5 w-3.5 flex-shrink-0"
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
          ? 'kflix-glass-button-accent bg-red-600/85 text-white shadow-[0_8px_24px_rgba(239,68,68,0.32)]'
          : 'kflix-glass-button-accent bg-green-600/85 text-white shadow-[0_8px_24px_rgba(34,197,94,0.30)]'
      }
      inactiveClassName={
        isRemove
          ? 'kflix-glass-button text-white/90 hover:text-white hover:shadow-[0_10px_28px_rgba(255,255,255,0.08)]'
          : 'kflix-glass-button text-white/90 hover:text-green-200 hover:shadow-[0_10px_28px_rgba(255,255,255,0.08)]'
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
        className="kflix-glass-button inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/90 backdrop-blur-xl transition duration-200 active:scale-95 hover:text-yellow-300 hover:shadow-[0_10px_28px_rgba(255,255,255,0.08)]"
        title="Show ratings"
        aria-label="Show ratings"
      >
        <svg
          className="h-4 w-4 flex-shrink-0"
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

      <div className="pointer-events-none absolute left-0 top-10 z-30 min-w-[96px] max-w-[120px] translate-y-1 rounded-2xl border border-white/12 bg-white/10 px-3 py-2.5 opacity-0 shadow-[0_20px_50px_rgba(0,0,0,0.42)] backdrop-blur-2xl transition-all duration-200 group-hover/ratings:pointer-events-auto group-hover/ratings:translate-y-0 group-hover/ratings:opacity-100">
        <div className="space-y-1.5">
          {item.imdbRating ? (
            <div className="flex items-center gap-2 text-[11px] leading-none">
              <span className="shrink-0 font-semibold uppercase tracking-[0.1em] text-yellow-300">
                IMDb
              </span>
              <span className="truncate text-white">{item.imdbRating}</span>
            </div>
          ) : null}

          {item.rtRating ? (
            <div className="flex items-center gap-2 text-[11px] leading-none">
              <span className="shrink-0 font-semibold uppercase tracking-[0.1em] text-yellow-300">
                RT
              </span>
              <span className="truncate text-white">{item.rtRating}</span>
            </div>
          ) : null}

          {tmdbRating ? (
            <div className="flex items-center gap-2 text-[11px] leading-none">
              <span className="shrink-0 font-semibold uppercase tracking-[0.1em] text-yellow-300">
                TMDB
              </span>
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
      {showWatchedToggle ? (
        <div className="absolute right-2.5 top-2.5 z-20">
          <ActionBadge
            checked={isWatched}
            onClick={onToggleWatched}
            title={watchedToggleTitle}
            variant={watchedToggleVariant}
          />
        </div>
      ) : (
        <>
          <div className="absolute left-2.5 top-2.5 z-20">
            <RatingsStarBadge item={item} />
          </div>

          <div className="absolute right-2.5 top-2.5 z-20 flex flex-col items-end gap-1.5">
            <BookmarkBadge active={isBookmarked} onToggle={onToggleBookmark} />
          </div>
        </>
      )}
    </>
  );
}

function MobileCarouselCard({
  sectionKey,
  item,
  mediaType,
  isBookmarked,
  onToggleBookmark,
  watchedEpisodes,
  onMarkContinueWatchingWatched,
  onRemoveNextUp,
  resolveHref,
}) {
  const isContinueWatchingSection = sectionKey === 'continue-watching';
  const isNextUpSection = sectionKey === 'next-up';
  const isAiringSoonSection = sectionKey === 'airing-soon';

  const episodeKey =
    mediaType === 'tv' && Number(item.season || 0) > 0 && Number(item.episode || 0) > 0
      ? buildEpisodeKey(item.id, item.season, item.episode)
      : '';

  const isWatched = episodeKey ? Boolean(watchedEpisodes?.[episodeKey]) : false;

  const progressSection =
    isContinueWatchingSection || isNextUpSection || isAiringSoonSection;

  const mobileWidthClass = progressSection
    ? 'w-[58vw] min-w-[58vw] max-w-[220px]'
    : 'w-[42vw] min-w-[42vw] max-w-[180px]';

  return (
    <Link
      href={resolveHref(item, mediaType)}
      className={`group block shrink-0 snap-start ${mobileWidthClass}`}
    >
      <div className="relative overflow-hidden rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-0 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl transition duration-300">
        <CardBadges
          item={item}
          isBookmarked={isBookmarked}
          onToggleBookmark={() => onToggleBookmark?.(item, mediaType)}
          showWatchedToggle={progressSection}
          isWatched={isContinueWatchingSection ? isWatched : true}
          onToggleWatched={() => {
            if (isContinueWatchingSection) {
              onMarkContinueWatchingWatched?.(item);
              return;
            }

            if (isNextUpSection || isAiringSoonSection) {
              onRemoveNextUp?.(item);
            }
          }}
          watchedToggleVariant={
            isNextUpSection || isAiringSoonSection ? 'remove' : 'watch'
          }
          watchedToggleTitle={
            isNextUpSection || isAiringSoonSection
              ? 'Remove from carousel'
              : isWatched
                ? 'Marked watched'
                : 'Mark as watched'
          }
        />

        <div className="kflix-theme-overlay-glow absolute inset-0 opacity-0 blur-2xl transition duration-300 group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black/35 via-black/10 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-black/30 via-black/8 to-transparent" />

        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[1.2rem] bg-gray-800">
          {item.poster_path ? (
            <img
              src={`${IMAGE_POSTER}${item.poster_path}`}
              alt={item.title || item.name || 'Poster'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              No Image
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 px-0.5">
        <div className="line-clamp-2 text-[12px] font-medium leading-snug text-white/95">
          {item.title || item.name || 'Untitled'}
        </div>

        {progressSection ? (
          <>
            <div className="mt-1 text-[10px] text-gray-300/85">
              {(item.media_type || item.type) === 'tv'
                ? `S${
                    isNextUpSection || isAiringSoonSection
                      ? item.nextSeason || item.season || '?'
                      : item.season || '?'
                  } • E${
                    isNextUpSection || isAiringSoonSection
                      ? item.nextEpisode || item.episode || '?'
                      : item.episode || '?'
                  }${
                    !isNextUpSection &&
                    !isAiringSoonSection &&
                    item.episode_name
                      ? ` • ${item.episode_name}`
                      : ''
                  }`
                : formatRemainingTime(item.remainingTime)}
            </div>

            {(item.media_type || item.type) === 'tv' && (
              <div className="mt-1 text-[10px] text-gray-500">
                {isAiringSoonSection && item.nextAirDate
                  ? formatCountdown(item.nextAirDate)
                  : isNextUpSection
                    ? 'Ready to start'
                    : formatRemainingTime(item.remainingTime)}
              </div>
            )}

            {!isNextUpSection && !isAiringSoonSection && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10 shadow-inner">
                <div
                  className="kflix-theme-accent-bg h-full rounded-full shadow-[0_0_14px_var(--theme-accent-glow)]"
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
          <div className="mt-1 text-[10px] text-gray-400">
            {(item.release_date || item.first_air_date || 'Unknown').slice(0, 4)}
          </div>
        )}
      </div>
    </Link>
  );
}

function DesktopCarouselCard({
  sectionKey,
  item,
  mediaType,
  isBookmarked,
  onToggleBookmark,
  watchedEpisodes,
  onMarkContinueWatchingWatched,
  onRemoveNextUp,
  resolveHref,
}) {
  const isContinueWatchingSection = sectionKey === 'continue-watching';
  const isNextUpSection = sectionKey === 'next-up';
  const isAiringSoonSection = sectionKey === 'airing-soon';

  const episodeKey =
    mediaType === 'tv' && Number(item.season || 0) > 0 && Number(item.episode || 0) > 0
      ? buildEpisodeKey(item.id, item.season, item.episode)
      : '';

  const isWatched = episodeKey ? Boolean(watchedEpisodes?.[episodeKey]) : false;

  return (
    <Link
      href={resolveHref(item, mediaType)}
      className="group block min-w-0"
    >
      <div className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-0 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_40px_rgba(0,0,0,0.26),0_0_0_1px_rgba(255,255,255,0.08)]">
        <CardBadges
          item={item}
          isBookmarked={isBookmarked}
          onToggleBookmark={() => onToggleBookmark?.(item, mediaType)}
          showWatchedToggle={
            isContinueWatchingSection || isNextUpSection || isAiringSoonSection
          }
          isWatched={isContinueWatchingSection ? isWatched : true}
          onToggleWatched={() => {
            if (isContinueWatchingSection) {
              onMarkContinueWatchingWatched?.(item);
              return;
            }

            if (isNextUpSection || isAiringSoonSection) {
              onRemoveNextUp?.(item);
            }
          }}
          watchedToggleVariant={
            isNextUpSection || isAiringSoonSection ? 'remove' : 'watch'
          }
          watchedToggleTitle={
            isNextUpSection || isAiringSoonSection
              ? 'Remove from carousel'
              : isWatched
                ? 'Marked watched'
                : 'Mark as watched'
          }
        />

        <div className="kflix-theme-overlay-glow absolute inset-0 opacity-0 blur-2xl transition duration-300 group-hover:opacity-100" />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/35 via-black/10 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-black/30 via-black/8 to-transparent" />

        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[1.35rem] bg-gray-800">
          {item.poster_path ? (
            <img
              src={`${IMAGE_POSTER}${item.poster_path}`}
              alt={item.title || item.name || 'Poster'}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              No Image
            </div>
          )}
        </div>
      </div>

      <div className="mt-2.5 px-0.5 sm:mt-3">
        <div className="line-clamp-1 text-xs font-medium tracking-[0.01em] text-white/95 transition group-hover:kflix-theme-accent-text sm:text-sm">
          {item.title || item.name || 'Untitled'}
        </div>

        {isContinueWatchingSection || isNextUpSection || isAiringSoonSection ? (
          <>
            <div className="mt-1 text-[11px] text-gray-300/85 sm:text-xs">
              {(item.media_type || item.type) === 'tv'
                ? `S${
                    isNextUpSection || isAiringSoonSection
                      ? item.nextSeason || item.season || '?'
                      : item.season || '?'
                  } • E${
                    isNextUpSection || isAiringSoonSection
                      ? item.nextEpisode || item.episode || '?'
                      : item.episode || '?'
                  }${
                    !isNextUpSection &&
                    !isAiringSoonSection &&
                    item.episode_name
                      ? ` • ${item.episode_name}`
                      : ''
                  }`
                : formatRemainingTime(item.remainingTime)}
            </div>

            {(item.media_type || item.type) === 'tv' && (
              <div className="mt-1 text-[11px] text-gray-500 sm:text-xs">
                {isAiringSoonSection && item.nextAirDate
                  ? formatCountdown(item.nextAirDate)
                  : isNextUpSection
                    ? 'Ready to start'
                    : formatRemainingTime(item.remainingTime)}
              </div>
            )}

            {!isNextUpSection && !isAiringSoonSection && (
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10 shadow-inner">
                <div
                  className="kflix-theme-accent-bg h-full rounded-full shadow-[0_0_14px_var(--theme-accent-glow)]"
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
  const mobileScrollRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined') return;
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    if (isMobile) return;

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
  }, [items.length, maxPage, preservePageOnItemsChange, sectionKey, isMobile]);

  useEffect(() => {
    if (isMobile) return;

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
  }, [maxPage, isMobile]);

  if (!items.length) {
    if (!emptyText) return null;

    return (
      <div className="kflix-theme-panel kflix-theme-panel-glow overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_10px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="kflix-theme-panel-header flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
          <h2 className="kflix-theme-accent-text text-base font-semibold uppercase tracking-[0.16em] sm:text-lg md:text-xl">
            {title}
          </h2>

          {!isMobile && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="kflix-glass-button flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-500 opacity-60 backdrop-blur-xl"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>

              <button
                type="button"
                disabled
                className="kflix-glass-button flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-500 opacity-60 backdrop-blur-xl"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="px-4 py-6 text-sm text-gray-400 sm:px-5 sm:py-8">
          {emptyText}
        </div>
      </div>
    );
  }

  return (
    <div className="kflix-theme-panel kflix-theme-panel-glow overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_10px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="kflix-theme-panel-header flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
        <h2 className="kflix-theme-accent-text pr-3 text-base font-semibold uppercase tracking-[0.16em] sm:text-lg md:text-xl">
          {title}
        </h2>

        {!isMobile && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={!canScrollLeft}
              className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/10 backdrop-blur-xl transition duration-200 active:scale-95 ${
                canScrollLeft
                  ? 'kflix-glass-button cursor-pointer text-white/90 hover:text-white hover:shadow-[0_10px_28px_rgba(255,255,255,0.08)]'
                  : 'kflix-glass-button cursor-default text-gray-500 opacity-60'
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
              className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/10 backdrop-blur-xl transition duration-200 active:scale-95 ${
                canScrollRight
                  ? 'kflix-glass-button cursor-pointer text-white/90 hover:text-white hover:shadow-[0_10px_28px_rgba(255,255,255,0.08)]'
                  : 'kflix-glass-button cursor-default text-gray-500 opacity-60'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {isMobile ? (
        <div
          ref={mobileScrollRef}
          className="overflow-x-auto snap-x snap-mandatory px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex gap-3">
            {items.map((item, index) => {
              const mediaType = resolveMediaType(item) || 'movie';
              const bookmarkKey = `${mediaType}-${item.id}`;
              const isBookmarked = bookmarkedIds.has(bookmarkKey);

              return (
                <MobileCarouselCard
                  key={`${sectionKey}-${item.id || index}-${mediaType}`}
                  sectionKey={sectionKey}
                  item={item}
                  mediaType={mediaType}
                  isBookmarked={isBookmarked}
                  onToggleBookmark={onToggleBookmark}
                  watchedEpisodes={watchedEpisodes}
                  onMarkContinueWatchingWatched={onMarkContinueWatchingWatched}
                  onRemoveNextUp={onRemoveNextUp}
                  resolveHref={resolveHref}
                />
              );
            })}
          </div>
        </div>
      ) : (
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
                          : cardsPerPage === 4
                            ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                            : cardsPerPage === 3
                              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3'
                              : 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'
                      : cardsPerPage === 5
                        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                        : cardsPerPage === 4
                          ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                          : cardsPerPage === 3
                            ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3'
                            : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
                  }`}
                >
                  {pageItems.map((item, index) => {
                    const mediaType = resolveMediaType(item) || 'movie';
                    const bookmarkKey = `${mediaType}-${item.id}`;
                    const isBookmarked = bookmarkedIds.has(bookmarkKey);

                    return (
                      <DesktopCarouselCard
                        key={`${sectionKey}-${item.id || index}-${mediaType}`}
                        sectionKey={sectionKey}
                        item={item}
                        mediaType={mediaType}
                        isBookmarked={isBookmarked}
                        onToggleBookmark={onToggleBookmark}
                        watchedEpisodes={watchedEpisodes}
                        onMarkContinueWatchingWatched={onMarkContinueWatchingWatched}
                        onRemoveNextUp={onRemoveNextUp}
                        resolveHref={resolveHref}
                      />
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
      )}
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
  const [airingSoon, setAiringSoon] = useState([]);

  const [bookmarkedContent, setBookmarkedContent] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

  const [userId, setUserId] = useState('');
  const [watchOwnerId, setWatchOwnerId] = useState('');
  const [watchedEpisodes, setWatchedEpisodes] = useState({});
  const [progressReady, setProgressReady] = useState(false);
  const [bookmarksReady, setBookmarksReady] = useState(false);
  const [, forceTick] = useState(0);

  const currentHero = useMemo(
    () => heroMovies[currentBackdrop] || null,
    [heroMovies, currentBackdrop]
  );

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const uid = currentUser?.uid || '';
      setUserId(uid);
      setWatchOwnerId(resolveWatchOwnerId(uid));

      if (!uid) {
        setContinueWatchingRaw([]);
        setContinueWatching([]);
        setNextUp([]);
        setAiringSoon([]);
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
    const syncOwner = () => {
      setWatchOwnerId(resolveWatchOwnerId(userId));
    };

    syncOwner();

    window.addEventListener('storage', syncOwner);
    window.addEventListener('kflix-profile-changed', syncOwner);

    return () => {
      window.removeEventListener('storage', syncOwner);
      window.removeEventListener('kflix-profile-changed', syncOwner);
    };
  }, [userId]);

  useEffect(() => {
    if (!watchOwnerId) return;

    const continueRef = ref(db, `users/${watchOwnerId}/continueWatching`);

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
  }, [watchOwnerId]);

  useEffect(() => {
    if (!watchOwnerId) return;

    const watchedRef = ref(db, `users/${watchOwnerId}/watchedEpisodes`);

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
  }, [watchOwnerId]);

  useEffect(() => {
    if (!watchOwnerId) return;

    const bookmarksRef = ref(db, `users/${watchOwnerId}/bookmarks`);

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
  }, [watchOwnerId]);

  useEffect(() => {
    if (!watchOwnerId) return;

    const { continueItems, nextUpItems, airingSoonItems } =
      splitProgressIntoSections(continueWatchingRaw, watchedEpisodes);

    setContinueWatching(continueItems);
    setNextUp(nextUpItems);
    setAiringSoon(airingSoonItems);
  }, [continueWatchingRaw, watchedEpisodes, watchOwnerId]);

  const toggleBookmark = async (item, mediaType) => {
    if (!watchOwnerId || !item?.id) return;

    const bookmarkKey = `${mediaType}-${item.id}`;
    const bookmarkRef = ref(db, `users/${watchOwnerId}/bookmarks/${bookmarkKey}`);
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
    if (!watchOwnerId || !item?.id) return;

    const mediaType = item.media_type || item.type || 'movie';
    const continueKey = `${mediaType}-${item.id}`;
    const continueRef = ref(db, `users/${watchOwnerId}/continueWatching/${continueKey}`);

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

      await update(ref(db, `users/${watchOwnerId}/watchedEpisodes`), {
        [episodeKey]: true,
      });

      let nextTarget = null;
      let nextAirDate = null;

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
        nextAirDate = item.nextAirDate || null;
      } else {
        try {
          const showData = await fetchTvDetail(item.id);
          const tmdbNext = showData?.next_episode_to_air;

          if (tmdbNext) {
            nextTarget = {
              season: Number(tmdbNext.season_number || 0),
              episode: Number(tmdbNext.episode_number || 0),
            };
            nextAirDate = tmdbNext.air_date || null;
          } else {
            nextTarget = resolveNextTvEpisode(showData, season, episode);
            nextAirDate = null;
          }
        } catch (error) {
          console.error('Failed to resolve next episode:', error);
        }
      }

      if (!nextTarget?.season || !nextTarget?.episode) {
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
        nextAirDate,
        currentTime: 0,
        remainingTime: null,
        progress: 0,
        isPlaying: false,
        updatedAt: Date.now(),
      });

      try {
        const raw = sessionStorage.getItem(WATCH_SESSION_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const sameMedia =
            String(saved?.type) === 'tv' &&
            String(saved?.id) === String(item.id) &&
            String(saved?.season || '') === String(season || '') &&
            String(saved?.episode || '') === String(episode || '');

          if (sameMedia) {
            sessionStorage.removeItem(WATCH_SESSION_KEY);
          }
        }
      } catch {}
    } catch (error) {
      console.error('Failed to mark continue watching item as watched:', error);
    }
  };

  const removeNextUpItem = async (item) => {
    if (!watchOwnerId || !item?.id) return;

    const mediaType = item.media_type || item.type || 'movie';
    const continueKey = `${mediaType}-${item.id}`;
    const continueRef = ref(db, `users/${watchOwnerId}/continueWatching/${continueKey}`);

    try {
      await remove(continueRef);

      try {
        const raw = sessionStorage.getItem(WATCH_SESSION_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const sameMedia =
            String(saved?.type) === String(mediaType) &&
            String(saved?.id) === String(item.id);

          if (sameMedia) {
            sessionStorage.removeItem(WATCH_SESSION_KEY);
          }
        }
      } catch {}
    } catch (error) {
      console.error('Failed to remove next up item:', error);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      forceTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
    <div className="min-h-screen bg-[var(--theme-bg)] text-white">
      <Navbar />

      <section className="px-3 pt-20 sm:px-4 sm:pt-24 lg:px-8">
        <div className="kflix-theme-panel kflix-theme-panel-glow relative h-[42vh] min-h-[300px] w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:h-[52vh] sm:min-h-[380px] lg:h-[62vh] lg:min-h-[470px]">
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

          <div className="pointer-events-none absolute inset-0 bg-black/50 sm:bg-black/42" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-black/25" />

          <div className="absolute inset-y-0 left-2 z-30 flex items-center sm:left-4">
            <button
              type="button"
              onClick={goHeroLeft}
              className="kflix-glass-button flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 text-white/90 backdrop-blur-xl transition duration-200 active:scale-95 hover:text-white hover:shadow-[0_12px_30px_rgba(255,255,255,0.08)] sm:h-11 sm:w-11"
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
              className="kflix-glass-button flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 text-white/90 backdrop-blur-xl transition duration-200 active:scale-95 hover:text-white hover:shadow-[0_12px_30px_rgba(255,255,255,0.08)] sm:h-11 sm:w-11"
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
              <div className="max-w-fit rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 backdrop-blur-xl sm:text-[11px]">
                Featured Today
              </div>

              <h1 className="mt-3 max-w-[85%] text-2xl font-bold leading-tight tracking-[-0.03em] sm:text-4xl md:text-5xl lg:text-6xl">
                {currentHero.title}
              </h1>

              <p className="mt-3 max-w-2xl line-clamp-3 text-sm text-gray-200/95 sm:mt-4 sm:text-base">
                {currentHero.overview}
              </p>
            </Link>
          )}
        </div>
      </section>

      <section className="space-y-6 px-3 py-6 sm:space-y-8 sm:px-4 sm:py-8 lg:space-y-10 lg:px-8 lg:py-10">
        <div className="grid gap-6 xl:grid-cols-3 xl:gap-10">
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
                cardsPerPage={3}
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
                cardsPerPage={3}
                preservePageOnItemsChange
                watchedEpisodes={watchedEpisodes}
                onRemoveNextUp={removeNextUpItem}
              />

              <CarouselSection
                title="Airing Soon"
                sectionKey="airing-soon"
                items={airingSoon}
                bookmarkedIds={bookmarkedIds}
                onToggleBookmark={toggleBookmark}
                getItemType={(item) => item.media_type || item.type || 'movie'}
                hrefBuilder={(item) => `/${item.media_type || item.type || 'tv'}/${item.id}`}
                emptyText="Episodes that haven’t aired yet will appear here."
                compact
                cardsPerPage={3}
                preservePageOnItemsChange
                watchedEpisodes={watchedEpisodes}
                onRemoveNextUp={removeNextUpItem}
              />
            </>
          ) : (
            <>
              <div className="kflix-theme-panel kflix-theme-panel-glow overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_10px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                <div className="kflix-theme-panel-header flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
                  <h2 className="kflix-theme-accent-text text-base font-semibold uppercase tracking-[0.16em] sm:text-lg md:text-xl">
                    Continue Watching
                  </h2>

                  <div className="hidden items-center gap-2 md:flex">
                    <button
                      type="button"
                      disabled
                      className="kflix-glass-button flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-500 opacity-60 backdrop-blur-xl"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M15 6l-6 6 6 6" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="kflix-glass-button flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-500 opacity-60 backdrop-blur-xl"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="px-4 py-6 text-sm text-gray-400 sm:px-5 sm:py-8">
                  Loading your progress...
                </div>
              </div>

              <div className="kflix-theme-panel kflix-theme-panel-glow overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_10px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                <div className="kflix-theme-panel-header flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
                  <h2 className="kflix-theme-accent-text text-base font-semibold uppercase tracking-[0.16em] sm:text-lg md:text-xl">
                    Next Up
                  </h2>

                  <div className="hidden items-center gap-2 md:flex">
                    <button
                      type="button"
                      disabled
                      className="kflix-glass-button flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-500 opacity-60 backdrop-blur-xl"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M15 6l-6 6 6 6" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="kflix-glass-button flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-500 opacity-60 backdrop-blur-xl"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="px-4 py-6 text-sm text-gray-400 sm:px-5 sm:py-8">
                  Loading your progress...
                </div>
              </div>

              <div className="kflix-theme-panel kflix-theme-panel-glow overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_10px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                <div className="kflix-theme-panel-header flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
                  <h2 className="kflix-theme-accent-text text-base font-semibold uppercase tracking-[0.16em] sm:text-lg md:text-xl">
                    Airing Soon
                  </h2>

                  <div className="hidden items-center gap-2 md:flex">
                    <button
                      type="button"
                      disabled
                      className="kflix-glass-button flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-500 opacity-60 backdrop-blur-xl"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M15 6l-6 6 6 6" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="kflix-glass-button flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-500 opacity-60 backdrop-blur-xl"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="px-4 py-6 text-sm text-gray-400 sm:px-5 sm:py-8">
                  Loading your progress...
                </div>
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
          <a
            href={`${process.env.NEXT_PUBLIC_GITHUB_REPO}/commit/${process.env.NEXT_PUBLIC_COMMIT_HASH}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-1.5 font-mono tracking-wider backdrop-blur-xl transition hover:bg-white/[0.05]"
            title="View this version on GitHub"
          >
            <span className="text-gray-500">Latest Update </span>
            <span className="kflix-theme-accent-text transition">
              {process.env.NEXT_PUBLIC_COMMIT_HASH}
            </span>
          </a>
        </div>
      </footer>
    </div>
  );
}