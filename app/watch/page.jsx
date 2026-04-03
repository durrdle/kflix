'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { get, onValue, ref, remove, set, update } from 'firebase/database';
import Navbar from '@/components/Navbar';
import { db, setPartyMedia, subscribeToMembers } from '@/lib/firebaseParty';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

const VIDFAST_ORIGINS = [
  'https://vidfast.pro',
  'https://vidfast.in',
  'https://vidfast.io',
  'https://vidfast.me',
  'https://vidfast.net',
  'https://vidfast.pm',
  'https://vidfast.xyz',
];

const SERVER_OPTIONS = ['Alpha', 'vFast', 'Beta', 'Oscar', 'Max', 'Iron', 'Charlie', 'Cobra', 'Viper', 'Ranger', 'Specter', 'Echo', 'Vodka', 'Pablo', 'Loco', 'Samba', 'Bollywood', 'Kirito', 'Meliodas'];
const SUBTITLE_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'tr', label: 'Turkish' },
];

function IconPlay({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.04-5.18a1 1 0 000-1.68L9.54 5.98A1 1 0 008 6.82z" />
    </svg>
  );
}

function IconPause({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 5a1 1 0 011 1v12a1 1 0 11-2 0V6a1 1 0 011-1zm10 0a1 1 0 011 1v12a1 1 0 11-2 0V6a1 1 0 011-1z" />
    </svg>
  );
}

function IconSkipBack({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M11 19L3 12l8-7" />
      <path d="M21 19l-8-7 8-7" />
    </svg>
  );
}

function IconSkipForward({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M13 19l8-7-8-7" />
      <path d="M3 19l8-7-8-7" />
    </svg>
  );
}

function IconRotateCcw({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.708" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function IconRotateCw({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-3-6.708" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

function IconVolume({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 010 7" />
      <path d="M18.5 5.5a9 9 0 010 13" />
    </svg>
  );
}

function IconMute({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M23 9l-6 6" />
      <path d="M17 9l6 6" />
    </svg>
  );
}

function IconFullscreen({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 3H3v5" />
      <path d="M16 3h5v5" />
      <path d="M21 16v5h-5" />
      <path d="M3 16v5h5" />
    </svg>
  );
}

function IconServer({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <path d="M7 7h.01" />
      <path d="M7 17h.01" />
    </svg>
  );
}

function IconSubtitles({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 10h2" />
      <path d="M7 14h5" />
      <path d="M15 10h2" />
      <path d="M13 14h4" />
    </svg>
  );
}

function IconLock({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 118 0v3" />
    </svg>
  );
}

function IconUnlock({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 017.5-2" />
    </svg>
  );
}

function formatPlayerTime(value) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getSubtitleShortLabel(value) {
  switch (value) {
    case 'en':
      return 'EN';
    case 'ar':
      return 'AR';
    case 'fr':
      return 'FR';
    case 'de':
      return 'DE';
    case 'tr':
      return 'TR';
    default:
      return '';
  }
}

async function fetchMovieDetail(id) {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&append_to_response=videos`
  );

  if (!res.ok) {
    throw new Error('Failed to fetch movie details');
  }

  return res.json();
}

async function fetchTvDetail(id) {
  const res = await fetch(
    `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=videos`
  );

  if (!res.ok) {
    throw new Error('Failed to fetch show details');
  }

  return res.json();
}

async function fetchEpisodeDetail(id, season, episode) {
  const res = await fetch(
    `https://api.themoviedb.org/3/tv/${id}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}&append_to_response=videos`
  );

  if (!res.ok) {
    throw new Error('Failed to fetch episode details');
  }

  return res.json();
}

function getEmbedUrl({
  type,
  id,
  season,
  episode,
  startAt = 0,
  autoPlay = true,
  server = 'Alpha',
  subtitle = '0',
  mobileNativeControls = false,
}) {
  if (!id || !type) return '';

  const params = new URLSearchParams();

  params.set('title', 'false');
  params.set('poster', 'false');
  params.set('autoPlay', autoPlay ? 'true' : 'false');
  params.set('theme', 'E7000B');
  params.set('hideServer', 'true');
  params.set('fullscreenButton', mobileNativeControls ? 'true' : 'false');
  params.set('chromecast', 'true');
  params.set('sub', subtitle || '0');
  params.set('server', server);

  if (Number.isFinite(startAt) && startAt > 0) {
    params.set('startAt', String(Math.max(0, Math.floor(startAt))));
  }

  if (type === 'movie') {
    return `https://vidfast.pro/movie/${id}?${params.toString()}`;
  }

  if (type === 'tv') {
    if (season == null || season === '' || episode == null || episode === '') {
      return '';
    }

    params.set('nextButton', 'true');
    params.set('autoNext', 'true');

    return `https://vidfast.pro/tv/${id}/${season}/${episode}?${params.toString()}`;
  }

  return '';
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function buildEpisodeKey(showId, seasonNumber, episodeNumber) {
  return `${showId}-S${seasonNumber}-E${episodeNumber}`;
}

function buildContinueWatchingKey(type, id) {
  return `${type}-${id}`;
}

async function markEpisodeWatched({ uid, showId, season, episode }) {
  const safeSeason = safeNumber(season, 0);
  const safeEpisode = safeNumber(episode, 0);

  if (!uid || !showId || safeSeason <= 0 || safeEpisode <= 0) return;

  try {
    const watchedRef = ref(db, `users/${uid}/watchedEpisodes`);
    const snapshot = await get(watchedRef);
    const existing =
      snapshot.exists() && snapshot.val() && typeof snapshot.val() === 'object'
        ? snapshot.val()
        : {};

    const key = buildEpisodeKey(showId, safeSeason, safeEpisode);

    if (existing[key]) return;

    await update(watchedRef, {
      [key]: true,
    });

    window.dispatchEvent(new Event('kflix-watched-episode-updated'));
  } catch (error) {
    console.error('Failed to mark episode as watched:', error);
  }
}

function extractPayloadSeason(payload, fallback = '') {
  const candidates = [payload?.season, payload?.seasonNumber, payload?.season_number];

  for (const candidate of candidates) {
    const value = safeNumber(candidate, NaN);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return fallback;
}

function extractPayloadEpisode(payload, fallback = '') {
  const candidates = [payload?.episode, payload?.episodeNumber, payload?.episode_number];

  for (const candidate of candidates) {
    const value = safeNumber(candidate, NaN);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return fallback;
}

function extractPayloadEpisodeName(payload, fallback = '') {
  const candidates = [
    payload?.episodeName,
    payload?.episode_name,
    payload?.episodeTitle,
    payload?.episode_title,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return fallback;
}

function resolveNextTvEpisode(heroData, season, episode) {
  const currentSeason = safeNumber(season, NaN);
  const currentEpisode = safeNumber(episode, NaN);

  if (!Number.isFinite(currentSeason) || !Number.isFinite(currentEpisode)) {
    return null;
  }

  const seasons = Array.isArray(heroData?.seasons)
    ? [...heroData.seasons]
        .filter((item) => safeNumber(item?.season_number, 0) > 0)
        .sort((a, b) => safeNumber(a?.season_number, 0) - safeNumber(b?.season_number, 0))
    : [];

  const seasonMeta = seasons.find(
    (item) => safeNumber(item?.season_number, 0) === currentSeason
  );

  const episodeCount = safeNumber(seasonMeta?.episode_count, 0);

  if (episodeCount > 0 && currentEpisode < episodeCount) {
    return {
      season: currentSeason,
      episode: currentEpisode + 1,
    };
  }

  const currentSeasonIndex = seasons.findIndex(
    (item) => safeNumber(item?.season_number, 0) === currentSeason
  );

  if (currentSeasonIndex >= 0 && currentSeasonIndex < seasons.length - 1) {
    return {
      season: safeNumber(seasons[currentSeasonIndex + 1]?.season_number, ''),
      episode: 1,
    };
  }

  return null;
}

function resolveNextTvEpisodeWithAirDate(heroData, season, episode) {
  const fallbackTarget = resolveNextTvEpisode(heroData, season, episode);

  if (!fallbackTarget) return null;

  const tmdbNext = heroData?.next_episode_to_air;

  if (
    tmdbNext &&
    safeNumber(tmdbNext?.season_number, 0) === safeNumber(fallbackTarget.season, 0) &&
    safeNumber(tmdbNext?.episode_number, 0) === safeNumber(fallbackTarget.episode, 0)
  ) {
    return {
      season: fallbackTarget.season,
      episode: fallbackTarget.episode,
      airDate: tmdbNext?.air_date || null,
    };
  }

  return {
    season: fallbackTarget.season,
    episode: fallbackTarget.episode,
    airDate: null,
  };
}

function resolvePreviousTvEpisode(heroData, season, episode) {
  const currentSeason = safeNumber(season, NaN);
  const currentEpisode = safeNumber(episode, NaN);

  if (!Number.isFinite(currentSeason) || !Number.isFinite(currentEpisode)) {
    return null;
  }

  if (currentEpisode > 1) {
    return {
      season: currentSeason,
      episode: currentEpisode - 1,
    };
  }

  const seasons = Array.isArray(heroData?.seasons)
    ? [...heroData.seasons]
        .filter((item) => safeNumber(item?.season_number, 0) > 0)
        .sort((a, b) => safeNumber(a?.season_number, 0) - safeNumber(b?.season_number, 0))
    : [];

  const currentSeasonIndex = seasons.findIndex(
    (item) => safeNumber(item?.season_number, 0) === currentSeason
  );

  if (currentSeasonIndex > 0) {
    const prevSeasonMeta = seasons[currentSeasonIndex - 1];
    const prevSeasonNumber = safeNumber(prevSeasonMeta?.season_number, 0);
    const prevSeasonEpisodeCount = safeNumber(prevSeasonMeta?.episode_count, 0);

    if (prevSeasonNumber > 0 && prevSeasonEpisodeCount > 0) {
      return {
        season: prevSeasonNumber,
        episode: prevSeasonEpisodeCount,
      };
    }
  }

  return null;
}

function createContinueWatchingItem({
  type,
  heroData,
  episodeData,
  season,
  episode,
  episodeName,
  currentTime,
  isPlaying,
  nextSeason = null,
  nextEpisode = null,
  nextAirDate = null,
}) {
  if (!type || !heroData) return null;

  const watchedSeconds = Math.max(0, Math.floor(safeNumber(currentTime, 0)));

  let totalRuntimeSeconds = 0;

  if (type === 'movie') {
    totalRuntimeSeconds = safeNumber(heroData.runtime, 0) * 60;
  } else if (type === 'tv') {
    totalRuntimeSeconds =
      safeNumber(episodeData?.runtime, 0) * 60 ||
      safeNumber(heroData?.episode_run_time?.[0], 0) * 60;
  }

  const remainingSeconds =
    totalRuntimeSeconds > 0 ? Math.max(0, totalRuntimeSeconds - watchedSeconds) : null;

  const activeSeason = type === 'tv' ? safeNumber(season, '') : null;
  const activeEpisode = type === 'tv' ? safeNumber(episode, '') : null;

  return {
    id: heroData.id,
    media_type: type,
    type,
    title: heroData.title || heroData.name || 'Untitled',
    name: heroData.name || heroData.title || 'Untitled',
    poster_path: heroData.poster_path || null,
    backdrop_path: heroData.backdrop_path || null,
    release_date: heroData.release_date || null,
    first_air_date: heroData.first_air_date || null,
    vote_average: heroData.vote_average ?? null,

    season: type === 'tv' ? activeSeason : null,
    episode: type === 'tv' ? activeEpisode : null,
    nextSeason: type === 'tv' ? nextSeason : null,
    nextEpisode: type === 'tv' ? nextEpisode : null,
    nextAirDate: type === 'tv' ? nextAirDate : null,
    episode_name: type === 'tv' ? episodeName || episodeData?.name || '' : '',
    episode_runtime: type === 'tv' ? safeNumber(episodeData?.runtime, 0) : null,

    currentTime: watchedSeconds,
    totalRuntime: totalRuntimeSeconds,
    remainingTime: remainingSeconds,
    progress:
      totalRuntimeSeconds > 0
        ? Math.min(100, Math.max(0, (watchedSeconds / totalRuntimeSeconds) * 100))
        : 0,
    isPlaying: Boolean(isPlaying),
    updatedAt: Date.now(),
  };
}

async function saveContinueWatchingItem({
  uid,
  type,
  id,
  heroData,
  episodeData,
  season,
  episode,
  episodeName,
  currentTime,
  isPlaying,
}) {
  if (!uid || !type || !id || !heroData) return;

  const watchedSeconds = Math.max(0, Math.floor(safeNumber(currentTime, 0)));

  const MIN_WATCHED_SECONDS = 3 * 60;
  const HIDE_WHEN_REMAINING_SECONDS = 5 * 60;

  let totalRuntimeSeconds = 0;

  if (type === 'movie') {
    totalRuntimeSeconds = safeNumber(heroData.runtime, 0) * 60;
  } else if (type === 'tv') {
    totalRuntimeSeconds =
      safeNumber(episodeData?.runtime, 0) * 60 ||
      safeNumber(heroData?.episode_run_time?.[0], 0) * 60;
  }

  const remainingSeconds =
    totalRuntimeSeconds > 0 ? Math.max(0, totalRuntimeSeconds - watchedSeconds) : null;

  const shouldHideBecauseTooEarly = watchedSeconds < MIN_WATCHED_SECONDS;
  const shouldHideBecauseAlmostDone =
    totalRuntimeSeconds > 0 &&
    remainingSeconds !== null &&
    remainingSeconds <= HIDE_WHEN_REMAINING_SECONDS;

  const firebaseKey = buildContinueWatchingKey(type, heroData.id);
  const itemRef = ref(db, `users/${uid}/continueWatching/${firebaseKey}`);

  try {
    const existingSnap = await get(itemRef);
    const existingItem =
      existingSnap.exists() && typeof existingSnap.val() === 'object'
        ? existingSnap.val()
        : null;

    if (shouldHideBecauseTooEarly) {
      return;
    }

    const existingCurrentTime = safeNumber(existingItem?.currentTime, 0);
    const existingUpdatedAt = safeNumber(existingItem?.updatedAt, 0);

    const sameTvTarget =
      type !== 'tv' ||
      (safeNumber(existingItem?.season, '') === safeNumber(season, '') &&
        safeNumber(existingItem?.episode, '') === safeNumber(episode, ''));

    const isClearlyWorseStartupOverwrite =
      existingItem &&
      sameTvTarget &&
      existingCurrentTime > watchedSeconds &&
      watchedSeconds < MIN_WATCHED_SECONDS &&
      existingUpdatedAt > 0;

    if (isClearlyWorseStartupOverwrite) {
      return;
    }

    const activeSeason = type === 'tv' ? safeNumber(season, '') : null;
    const activeEpisode = type === 'tv' ? safeNumber(episode, '') : null;

    if (type === 'movie' && shouldHideBecauseAlmostDone) {
      await remove(itemRef);
      window.dispatchEvent(new Event('kflix-continue-watching-updated'));
      return;
    }

    const nextEpisodeTarget =
      type === 'tv' && shouldHideBecauseAlmostDone
        ? resolveNextTvEpisodeWithAirDate(heroData, activeSeason, activeEpisode)
        : null;

    const item = {
      id: heroData.id,
      media_type: type,
      type,
      title: heroData.title || heroData.name || 'Untitled',
      name: heroData.name || heroData.title || 'Untitled',
      poster_path: heroData.poster_path || null,
      backdrop_path: heroData.backdrop_path || null,
      release_date: heroData.release_date || null,
      first_air_date: heroData.first_air_date || null,
      vote_average: heroData.vote_average ?? null,

      season: type === 'tv' ? activeSeason : null,
      episode: type === 'tv' ? activeEpisode : null,
      nextSeason: nextEpisodeTarget?.season ?? null,
      nextEpisode: nextEpisodeTarget?.episode ?? null,
      nextAirDate: nextEpisodeTarget?.airDate ?? null,
      episode_name: type === 'tv' ? episodeName || episodeData?.name || '' : '',
      episode_runtime: type === 'tv' ? safeNumber(episodeData?.runtime, 0) : null,

      currentTime: watchedSeconds,
      totalRuntime: totalRuntimeSeconds,
      remainingTime:
        totalRuntimeSeconds > 0 ? Math.max(0, totalRuntimeSeconds - watchedSeconds) : null,
      progress:
        totalRuntimeSeconds > 0
          ? Math.min(100, Math.max(0, (watchedSeconds / totalRuntimeSeconds) * 100))
          : 0,
      isPlaying: Boolean(isPlaying),
      updatedAt: Date.now(),
    };

    await set(itemRef, item);
    window.dispatchEvent(new Event('kflix-continue-watching-updated'));
  } catch (error) {
    console.error('Failed to save continue watching:', error);
  }
}

async function advanceTvProgressAtomically({
  uid,
  showId,
  heroData,
  previousSeason,
  previousEpisode,
  nextSeason,
  nextEpisode,
  nextEpisodeName,
  isPlaying = true,
}) {
  const safePreviousSeason = safeNumber(previousSeason, 0);
  const safePreviousEpisode = safeNumber(previousEpisode, 0);
  const safeNextSeason = safeNumber(nextSeason, 0);
  const safeNextEpisode = safeNumber(nextEpisode, 0);

  if (
    !uid ||
    !showId ||
    !heroData ||
    safePreviousSeason <= 0 ||
    safePreviousEpisode <= 0 ||
    safeNextSeason <= 0 ||
    safeNextEpisode <= 0
  ) {
    return;
  }

  const watchedKey = buildEpisodeKey(showId, safePreviousSeason, safePreviousEpisode);
  const continueKey = buildContinueWatchingKey('tv', showId);

  const futureNextTarget = resolveNextTvEpisodeWithAirDate(
    heroData,
    safeNextSeason,
    safeNextEpisode
  );

  const continueItem = createContinueWatchingItem({
    type: 'tv',
    heroData,
    episodeData: null,
    season: safeNextSeason,
    episode: safeNextEpisode,
    episodeName: nextEpisodeName || '',
    currentTime: 0,
    isPlaying,
    nextSeason: futureNextTarget?.season ?? null,
    nextEpisode: futureNextTarget?.episode ?? null,
    nextAirDate: futureNextTarget?.airDate ?? null,
  });

  if (!continueItem) return;

  const updates = {
    [`users/${uid}/watchedEpisodes/${watchedKey}`]: true,
    [`users/${uid}/continueWatching/${continueKey}`]: continueItem,
  };

  await update(ref(db), updates);

  window.dispatchEvent(new Event('kflix-watched-episode-updated'));
  window.dispatchEvent(new Event('kflix-continue-watching-updated'));
}

function WatchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const playerFrameRef = useRef(null);
  const playerShellRef = useRef(null);
  const lastStatusRequestRef = useRef(0);
  const latestPlaybackRef = useRef({ currentTime: 0, isPlaying: true });
  const pendingInitialSyncRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const saveContinueWatchingTimeoutRef = useRef(null);
  const liveTvProgressRef = useRef({
    season: '',
    episode: '',
    episodeName: '',
  });
  const lastHandledRemotePlaybackRef = useRef('');
  const suppressBroadcastUntilRef = useRef(0);
  const initialResumeAppliedRef = useRef(false);
  const lastEpisodeTransitionSignatureRef = useRef('');
  const fullscreenNoticeTimeoutRef = useRef(null);
  const latestUserHasAdjustedVolumeRef = useRef(false);

  const latestUserIdRef = useRef('');
  const latestHeroDataRef = useRef(null);
  const latestEpisodeDataRef = useRef(null);
  const latestAutoplayUnlockedRef = useRef(false);
  const latestPartyCodeRef = useRef('');
  const latestIsHostRef = useRef(false);

  const type = searchParams.get('type') || '';
  const id = searchParams.get('id') || '';
  const season = searchParams.get('season') || '';
  const episode = searchParams.get('episode') || '';
  const initialTimeParam = searchParams.get('t') || '';
  const initialAutoplayParam = searchParams.get('autoplay') || '';
  const partyFollowParam = searchParams.get('partyFollow') || '';
  const returnToParam = searchParams.get('returnTo') || '';
  const partyFollowEnabled = partyFollowParam === '1';

  const initialStartTime = Number(initialTimeParam || 0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [heroData, setHeroData] = useState(null);
  const [episodeData, setEpisodeData] = useState(null);

  const [syncNotice, setSyncNotice] = useState('');
  const [showAutoplayHint, setShowAutoplayHint] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [autoplayUnlocked, setAutoplayUnlocked] = useState(false);
  const [fullscreenNoticeOpen, setFullscreenNoticeOpen] = useState(false);
  const [isMobileLike, setIsMobileLike] = useState(false);

  const [userId, setUserId] = useState('');
  const [partyCode, setPartyCode] = useState('');
  const [members, setMembers] = useState([]);

  const [playerReady, setPlayerReady] = useState(false);
  const [playerCurrentTime, setPlayerCurrentTime] = useState(
    Number.isFinite(initialStartTime) ? Math.max(0, initialStartTime) : 0
  );
  const [playerDuration, setPlayerDuration] = useState(0);
  const [playerIsPlaying, setPlayerIsPlaying] = useState(false);
  const [playerVolume, setPlayerVolume] = useState(0);
  const [playerMuted, setPlayerMuted] = useState(true);

  const [selectedServer, setSelectedServer] = useState('Alpha');
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
  const [selectedSubtitle, setSelectedSubtitle] = useState('0');
  const [interactionLocked, setInteractionLocked] = useState(true);

  const [embedState, setEmbedState] = useState({
  startAt: Number.isFinite(initialStartTime) ? Math.max(0, initialStartTime) : 0,
  autoPlay: false,
  server: 'Alpha',
  subtitle: '0',
});

const WATCH_SESSION_KEY = 'kflix_watch_session';

const saveWatchSession = () => {
  if (!type || !id) return;

  const activeSeason =
    type === 'tv' ? liveTvProgressRef.current.season || season || '' : '';
  const activeEpisode =
    type === 'tv' ? liveTvProgressRef.current.episode || episode || '' : '';

  const params = new URLSearchParams();
  params.set('type', String(type));
  params.set('id', String(id));

  if (type === 'tv' && activeSeason) {
    params.set('season', String(activeSeason));
  }

  if (type === 'tv' && activeEpisode) {
    params.set('episode', String(activeEpisode));
  }

  params.set(
    't',
    String(Math.max(0, Math.floor(latestPlaybackRef.current.currentTime || 0)))
  );
  params.set('autoplay', latestPlaybackRef.current.isPlaying ? '1' : '0');

  if (partyFollowEnabled) {
    params.set('partyFollow', '1');
  }

  if (returnToParam) {
    params.set('returnTo', returnToParam);
  }

  const payload = {
    type,
    id,
    season: activeSeason,
    episode: activeEpisode,
    currentTime: Math.max(0, Math.floor(latestPlaybackRef.current.currentTime || 0)),
    isPlaying: Boolean(latestPlaybackRef.current.isPlaying),
    server: selectedServer,
    subtitle: selectedSubtitle,
    returnTo: `/watch?${params.toString()}`,
    savedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(WATCH_SESSION_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to save watch session:', error);
  }
};

const [iframeSeed, setIframeSeed] = useState(0);

  const currentMember = useMemo(
    () => members.find((member) => String(member.id) === String(userId)) || null,
    [members, userId]
  );

  const isHost = Boolean(currentMember?.isHost);

  const currentSubtitleLabel = useMemo(() => {
    return SUBTITLE_OPTIONS.find((item) => item.value === selectedSubtitle)?.label || 'Subtitles';
  }, [selectedSubtitle]);

  const currentSubtitleShortLabel = useMemo(() => {
    return getSubtitleShortLabel(selectedSubtitle);
  }, [selectedSubtitle]);

  const canGoToPreviousEpisode = useMemo(() => {
    if (type !== 'tv' || !heroData) return false;
    return Boolean(resolvePreviousTvEpisode(heroData, season, episode));
  }, [type, heroData, season, episode]);

  const canGoToNextEpisode = useMemo(() => {
    if (type !== 'tv' || !heroData) return false;
    return Boolean(resolveNextTvEpisode(heroData, season, episode));
  }, [type, heroData, season, episode]);

  const glassPanelStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-panel-from) 82%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-panel-to) 92%, rgba(255,255,255,0.02)))',
    borderColor: 'color-mix(in srgb, var(--theme-accent-border) 74%, rgba(255,255,255,0.08))',
    boxShadow:
      '0 20px 46px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02)',
    backdropFilter: 'blur(22px) saturate(150%)',
    WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  };

  const glassSurfaceStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-muted-bg) 82%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-muted-bg-strong) 90%, rgba(255,255,255,0.02)))',
    borderColor: 'color-mix(in srgb, var(--theme-muted-border) 92%, rgba(255,255,255,0.06))',
    boxShadow:
      '0 12px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.07)',
    backdropFilter: 'blur(16px) saturate(145%)',
    WebkitBackdropFilter: 'blur(16px) saturate(145%)',
  };

  const glassAccentButtonStyle = {
    borderColor: 'color-mix(in srgb, var(--theme-accent-border) 90%, rgba(255,255,255,0.06))',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 86%, rgba(255,255,255,0.12)), color-mix(in srgb, var(--theme-accent-hover) 90%, rgba(0,0,0,0.05)))',
    boxShadow:
      '0 14px 28px color-mix(in srgb, var(--theme-accent-glow) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.16)',
    color: 'var(--theme-accent-contrast)',
    backdropFilter: 'blur(16px) saturate(150%)',
    WebkitBackdropFilter: 'blur(16px) saturate(150%)',
  };

  const glassGhostButtonStyle = {
    borderColor: 'color-mix(in srgb, var(--theme-muted-border) 92%, rgba(255,255,255,0.08))',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-muted-bg) 78%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-muted-bg-strong) 88%, rgba(255,255,255,0.02)))',
    boxShadow:
      '0 10px 20px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.08)',
    color: 'var(--theme-text)',
    backdropFilter: 'blur(16px) saturate(140%)',
    WebkitBackdropFilter: 'blur(16px) saturate(140%)',
  };

  const glassNoticeStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255,255,255,0.04)), color-mix(in srgb, var(--theme-accent-soft) 68%, transparent))',
    borderColor: 'var(--theme-accent-border)',
    color: 'var(--theme-accent-text)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  };

  const successNoticeStyle = {
    borderColor: 'rgba(34, 197, 94, 0.26)',
    background:
      'linear-gradient(180deg, rgba(34, 197, 94, 0.14), rgba(21, 128, 61, 0.10))',
    color: '#bbf7d0',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  };

  const warningNoticeStyle = {
    borderColor: 'rgba(234, 179, 8, 0.24)',
    background:
      'linear-gradient(180deg, rgba(234, 179, 8, 0.14), rgba(161, 98, 7, 0.10))',
    color: '#fef3c7',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  };

  const embedUrl = useMemo(() => {
    return getEmbedUrl({
      type,
      id,
      season,
      episode,
      startAt: embedState.startAt,
      autoPlay: embedState.autoPlay,
      server: embedState.server,
      subtitle: embedState.subtitle,
      mobileNativeControls: isMobileLike,
    });
  }, [type, id, season, episode, embedState, isMobileLike]);

  const iframeKey = useMemo(() => {
    return `${type}-${id}-${season || 'na'}-${episode || 'na'}-${iframeSeed}-${embedState.startAt}-${embedState.autoPlay ? '1' : '0'}-${embedState.server}-${embedState.subtitle}-${isMobileLike ? 'mobile' : 'desktop'}`;
  }, [type, id, season, episode, iframeSeed, embedState, isMobileLike]);

  const sendPlayerCommand = (payload) => {
    const frame = playerFrameRef.current;
    if (!frame?.contentWindow) return false;

    frame.contentWindow.postMessage(payload, '*');
    return true;
  };

  const requestPlayerStatus = () => {
    const now = Date.now();
    if (now - lastStatusRequestRef.current < 600) return;

    lastStatusRequestRef.current = now;
    sendPlayerCommand({ command: 'getStatus' });
  };

  const ensureUserInteractionUnlock = () => {
    if (!autoplayUnlocked) {
      setAutoplayUnlocked(true);
      setNoticeOpen(false);
    }
  };

  const publishPlaybackState = (currentTimeArg, isPlayingArg, overrides = {}) => {
    if (!partyCode || !userId || !isHost || !type || !id) return;

    const safeTime =
      typeof currentTimeArg === 'number' && Number.isFinite(currentTimeArg)
        ? Math.max(0, currentTimeArg)
        : 0;

    const safePlaying = Boolean(isPlayingArg);

    latestPlaybackRef.current = {
      currentTime: safeTime,
      isPlaying: safePlaying,
    };

    const liveSeason = overrides.season ?? liveTvProgressRef.current.season ?? season ?? null;
    const liveEpisode = overrides.episode ?? liveTvProgressRef.current.episode ?? episode ?? null;

    setPartyMedia(partyCode, {
      mediaType: type,
      mediaId: id,
      season: type === 'tv' ? liveSeason || null : null,
      episode: type === 'tv' ? liveEpisode || null : null,
      currentTime: safeTime,
      isPlaying: safePlaying,
      updatedBy: userId,
      route: '/watch',
    }).catch((partyError) => {
      console.error('Failed to publish host media to party:', partyError);
    });
  };

  const queueSaveContinueWatching = (timeArg, playingArg) => {
    if (!autoplayUnlocked) return;
    if (!initialResumeAppliedRef.current) return;
    if (pendingInitialSyncRef.current) return;
    if (!userId || !heroData || !type || !id) return;

    if (saveContinueWatchingTimeoutRef.current) {
      clearTimeout(saveContinueWatchingTimeoutRef.current);
    }

    saveContinueWatchingTimeoutRef.current = setTimeout(() => {
      saveContinueWatchingItem({
        uid: userId,
        type,
        id,
        heroData,
        episodeData,
        season: type === 'tv' ? liveTvProgressRef.current.season || season : season,
        episode: type === 'tv' ? liveTvProgressRef.current.episode || episode : episode,
        episodeName:
          type === 'tv'
            ? liveTvProgressRef.current.episodeName || episodeData?.name || ''
            : '',
        currentTime: timeArg,
        isPlaying: playingArg,
      });
    }, 250);
  };

  const flushContinueWatching = () => {
    if (saveContinueWatchingTimeoutRef.current) {
      clearTimeout(saveContinueWatchingTimeoutRef.current);
      saveContinueWatchingTimeoutRef.current = null;
    }

    if (!latestAutoplayUnlockedRef.current) return;
    if (!initialResumeAppliedRef.current) return;
    if (pendingInitialSyncRef.current) return;

    const uid = latestUserIdRef.current;
    const currentHeroData = latestHeroDataRef.current;
    const currentEpisodeData = latestEpisodeDataRef.current;

    if (!uid || !currentHeroData || !type || !id) return;

    saveContinueWatchingItem({
      uid,
      type,
      id,
      heroData: currentHeroData,
      episodeData: currentEpisodeData,
      season: type === 'tv' ? liveTvProgressRef.current.season || season : season,
      episode: type === 'tv' ? liveTvProgressRef.current.episode || episode : episode,
      episodeName:
        type === 'tv'
          ? liveTvProgressRef.current.episodeName || currentEpisodeData?.name || ''
          : '',
      currentTime: latestPlaybackRef.current.currentTime,
      isPlaying: latestPlaybackRef.current.isPlaying,
    });
  };

  const reloadPlayerToPosition = ({
    currentTime,
    isPlaying,
    server = selectedServer,
    subtitle = selectedSubtitle,
  }) => {
    const targetTime =
      typeof currentTime === 'number' && Number.isFinite(currentTime)
        ? Math.max(0, Math.floor(currentTime))
        : 0;

    const shouldPlay = Boolean(isPlaying);

    pendingSeekRef.current = {
      time: targetTime,
      play: shouldPlay,
    };

    setEmbedState({
      startAt: 0,
      autoPlay: false,
      server,
      subtitle,
    });

    setPlayerCurrentTime(targetTime);
    setPlayerIsPlaying(shouldPlay);
    latestPlaybackRef.current = {
      currentTime: targetTime,
      isPlaying: shouldPlay,
    };
    setPlayerReady(false);
    setIframeSeed((prev) => prev + 1);
    setShowAutoplayHint(shouldPlay);
  };

  const goToEpisodeTarget = (target) => {
    if (!target || type !== 'tv' || !id) return;

    const currentTime = latestPlaybackRef.current.currentTime || 0;
    const isPlaying = latestPlaybackRef.current.isPlaying;

    flushContinueWatching();

    const params = new URLSearchParams();
    params.set('type', 'tv');
    params.set('id', String(id));
    params.set('season', String(target.season));
    params.set('episode', String(target.episode));
    params.set('t', String(Math.max(0, Math.floor(isPlaying ? 0 : 0))));
    params.set('autoplay', isPlaying ? '1' : '0');

    if (partyFollowEnabled) {
      params.set('partyFollow', '1');
    }

    if (returnToParam) {
      params.set('returnTo', returnToParam);
    }

    router.push(`/watch?${params.toString()}`);
  };

  const handlePreviousEpisode = () => {
    const target = resolvePreviousTvEpisode(heroData, season, episode);
    if (!target) return;
    goToEpisodeTarget(target);
  };

  const handleNextEpisode = () => {
    const target = resolveNextTvEpisode(heroData, season, episode);
    if (!target) return;
    goToEpisodeTarget(target);
  };

  const bootstrapPlaybackAfterUnlock = (targetTime, shouldPlay) => {
    const safeTime =
      typeof targetTime === 'number' && Number.isFinite(targetTime) ? Math.max(0, targetTime) : 0;

    if (isMobileLike) {
      reloadPlayerToPosition({
        currentTime: safeTime,
        isPlaying: shouldPlay,
        server: selectedServer,
        subtitle: selectedSubtitle,
      });
      initialResumeAppliedRef.current = true;
      return;
    }

    const didSend = sendPlayerCommand({
      command: 'play',
      time: safeTime,
    });

    if (!didSend) {
      reloadPlayerToPosition({
        currentTime: safeTime,
        isPlaying: shouldPlay,
      });
      initialResumeAppliedRef.current = true;
      return;
    }

    setPlayerIsPlaying(true);
    latestPlaybackRef.current = {
      currentTime: safeTime,
      isPlaying: true,
    };

    setTimeout(() => {
      sendPlayerCommand({
        command: 'pause',
        time: safeTime,
      });
    }, 220);

    setTimeout(() => {
      sendPlayerCommand({
        command: 'seek',
        time: safeTime,
      });
    }, 420);

    setTimeout(() => {
      sendPlayerCommand({
        command: shouldPlay ? 'play' : 'pause',
        time: safeTime,
      });

      setPlayerIsPlaying(shouldPlay);
      latestPlaybackRef.current = {
        currentTime: safeTime,
        isPlaying: shouldPlay,
      };
      initialResumeAppliedRef.current = true;
    }, 700);

    setTimeout(() => {
      sendPlayerCommand({
        command: 'volume',
        level: 0,
      });
      sendPlayerCommand({
        command: 'mute',
        muted: true,
      });
      setPlayerVolume(0);
      setPlayerMuted(true);
      latestUserHasAdjustedVolumeRef.current = true;
    }, 900);

    setTimeout(() => {
      requestPlayerStatus();
    }, 1150);
  };

    const applyPartyCommandToCurrentPlayer = ({ currentTime, isPlaying }) => {
    const targetTime =
      typeof currentTime === 'number' && Number.isFinite(currentTime)
        ? Math.max(0, currentTime)
        : 0;

    const shouldPlay = Boolean(isPlaying);

    suppressBroadcastUntilRef.current = Date.now() + 1200;

    const didSeek = sendPlayerCommand({
      command: 'seek',
      time: targetTime,
    });

    if (!didSeek) {
      reloadPlayerToPosition({ currentTime: targetTime, isPlaying: shouldPlay });
      return;
    }

    setTimeout(() => {
      sendPlayerCommand({
        command: shouldPlay ? 'play' : 'pause',
        time: targetTime,
      });
    }, 120);

    setPlayerCurrentTime(targetTime);
    setPlayerIsPlaying(shouldPlay);
    latestPlaybackRef.current = {
      currentTime: targetTime,
      isPlaying: shouldPlay,
    };
  };

  const handleTogglePlay = () => {
    ensureUserInteractionUnlock();

    const targetTime = latestPlaybackRef.current.currentTime || 0;
    const nextPlaying = !playerIsPlaying;

    const didSend = sendPlayerCommand({
      command: nextPlaying ? 'play' : 'pause',
      time: targetTime,
    });

    if (!didSend) {
      reloadPlayerToPosition({
        currentTime: targetTime,
        isPlaying: nextPlaying,
      });
      return;
    }

    setPlayerIsPlaying(nextPlaying);
    latestPlaybackRef.current = {
      currentTime: targetTime,
      isPlaying: nextPlaying,
    };
  };

  const handleSeekRelative = (delta) => {
    ensureUserInteractionUnlock();

    const nextTime = Math.max(0, Math.floor((latestPlaybackRef.current.currentTime || 0) + delta));
    const currentPlaying = latestPlaybackRef.current.isPlaying;

    const didSeek = sendPlayerCommand({
      command: 'seek',
      time: nextTime,
    });

    if (!didSeek) {
      reloadPlayerToPosition({
        currentTime: nextTime,
        isPlaying: currentPlaying,
      });
      return;
    }

    setPlayerCurrentTime(nextTime);
    latestPlaybackRef.current = {
      currentTime: nextTime,
      isPlaying: currentPlaying,
    };

    queueSaveContinueWatching(nextTime, currentPlaying);
  };

  const handleSeekBarChange = (event) => {
    ensureUserInteractionUnlock();

    const nextTime = Math.max(0, Number(event.target.value) || 0);
    const currentPlaying = latestPlaybackRef.current.isPlaying;

    const didSeek = sendPlayerCommand({
      command: 'seek',
      time: nextTime,
    });

    if (!didSeek) {
      reloadPlayerToPosition({
        currentTime: nextTime,
        isPlaying: currentPlaying,
        server: selectedServer,
        subtitle: selectedSubtitle,
      });
      return;
    }

    setPlayerCurrentTime(nextTime);
    latestPlaybackRef.current = {
      currentTime: nextTime,
      isPlaying: currentPlaying,
    };

    queueSaveContinueWatching(nextTime, currentPlaying);
  };

  const handleVolumeChange = (event) => {
    ensureUserInteractionUnlock();

    const nextVolume = Math.max(0, Math.min(1, Number(event.target.value)));
    latestUserHasAdjustedVolumeRef.current = true;

    setPlayerVolume(nextVolume);
    setPlayerMuted(nextVolume <= 0);

    sendPlayerCommand({
      command: 'volume',
      level: nextVolume,
    });

    sendPlayerCommand({
      command: 'mute',
      muted: nextVolume <= 0,
    });
  };

  const handleToggleMute = () => {
    ensureUserInteractionUnlock();
    latestUserHasAdjustedVolumeRef.current = true;

    const nextMuted = !playerMuted;

    if (!nextMuted && playerVolume <= 0) {
      const restoredVolume = 0.5;

      setPlayerVolume(restoredVolume);
      setPlayerMuted(false);

      sendPlayerCommand({
        command: 'volume',
        level: restoredVolume,
      });

      sendPlayerCommand({
        command: 'mute',
        muted: false,
      });

      return;
    }

    setPlayerMuted(nextMuted);

    sendPlayerCommand({
      command: 'mute',
      muted: nextMuted,
    });

    if (nextMuted) {
      sendPlayerCommand({
        command: 'volume',
        level: 0,
      });
      setPlayerVolume(0);
    }
  };

  const handleFullscreen = async () => {
    const element = playerShellRef.current;
    if (!element) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await element.requestFullscreen();

      if (!isMobileLike) {
  setFullscreenNoticeOpen(true);

  if (fullscreenNoticeTimeoutRef.current) {
    clearTimeout(fullscreenNoticeTimeoutRef.current);
  }

  fullscreenNoticeTimeoutRef.current = setTimeout(() => {
    setFullscreenNoticeOpen(false);
  }, 3500);
}
    } catch (fullscreenError) {
      console.error('Failed to toggle fullscreen:', fullscreenError);
    }
  };

  const handleServerSelect = (serverName) => {
    if (!serverName || serverName === selectedServer) {
      setServerMenuOpen(false);
      return;
    }

    setSelectedServer(serverName);
    setServerMenuOpen(false);

    const currentTime = latestPlaybackRef.current.currentTime || 0;
    const isPlaying = latestPlaybackRef.current.isPlaying;

    setSyncNotice(`Switched to ${serverName} server.`);
    setTimeout(() => setSyncNotice(''), 2200);

    reloadPlayerToPosition({
      currentTime,
      isPlaying,
      server: serverName,
      subtitle: selectedSubtitle,
    });
  };

  const handleSubtitleSelect = (subtitleValue) => {
    if (!subtitleValue) return;

    setSelectedSubtitle(subtitleValue);
    setSubtitleMenuOpen(false);

    const currentTime = latestPlaybackRef.current.currentTime || 0;
    const isPlaying = latestPlaybackRef.current.isPlaying;

    setSyncNotice(
      subtitleValue === '0'
        ? 'Subtitles turned off.'
        : `Switched subtitles to ${subtitleValue.toUpperCase()}.`
    );
    setTimeout(() => setSyncNotice(''), 1800);

    reloadPlayerToPosition({
      currentTime,
      isPlaying,
      server: selectedServer,
      subtitle: subtitleValue,
    });
  };

  useEffect(() => {
    latestPlaybackRef.current = {
      currentTime: playerCurrentTime,
      isPlaying: playerIsPlaying,
    };
  }, [playerCurrentTime, playerIsPlaying]);

  useEffect(() => {
    const checkMobileLike = () => {
      if (typeof window === 'undefined') return;

      const hasTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0;

      const narrowScreen = window.matchMedia('(max-width: 1024px)').matches;

      setIsMobileLike(hasTouch || narrowScreen);
    };

    checkMobileLike();
    window.addEventListener('resize', checkMobileLike);

    return () => window.removeEventListener('resize', checkMobileLike);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = Boolean(document.fullscreenElement);

      if (!isFullscreen) {
        setFullscreenNoticeOpen(false);

        if (fullscreenNoticeTimeoutRef.current) {
          clearTimeout(fullscreenNoticeTimeoutRef.current);
          fullscreenNoticeTimeoutRef.current = null;
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (fullscreenNoticeTimeoutRef.current) {
        clearTimeout(fullscreenNoticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    latestUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    latestHeroDataRef.current = heroData;
  }, [heroData]);

  useEffect(() => {
    latestEpisodeDataRef.current = episodeData;
  }, [episodeData]);

  useEffect(() => {
    latestAutoplayUnlockedRef.current = autoplayUnlocked;
  }, [autoplayUnlocked]);

  useEffect(() => {
    latestPartyCodeRef.current = partyCode;
  }, [partyCode]);

  useEffect(() => {
    latestIsHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || '');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      const storedCode = localStorage.getItem('kflix_current_party_code') || '';
      const isActive = localStorage.getItem('kflix_in_party') === 'true';

      setPartyCode(isActive ? storedCode : '');
    } catch {
      setPartyCode('');
    }
  }, []);

  useEffect(() => {
    if (!partyCode) {
      setMembers([]);
      return;
    }

    const unsubscribe = subscribeToMembers(partyCode, (nextMembers) => {
      setMembers(nextMembers || []);
    });

    return () => unsubscribe?.();
  }, [partyCode]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!type || !id) {
        setError('Missing watch parameters.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        setHeroData(null);
        setEpisodeData(null);

        if (type === 'movie') {
          const movie = await fetchMovieDetail(id);
          if (!active) return;
          setHeroData(movie);
        } else if (type === 'tv') {
          const show = await fetchTvDetail(id);

let ep = null;
if (season && episode) {
  try {
    ep = await fetchEpisodeDetail(id, season, episode);
  } catch (episodeError) {
    console.error('Failed to fetch episode details:', episodeError);
    ep = null;
  }
}

if (!active) return;
setHeroData(show);
setEpisodeData(ep);
        } else {
          throw new Error('Unsupported type.');
        }
      } catch {
        if (!active) return;
        setError('Failed to load watch page.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [type, id, season, episode]);

  useEffect(() => {
    liveTvProgressRef.current = {
      season: type === 'tv' ? safeNumber(season, '') : '',
      episode: type === 'tv' ? safeNumber(episode, '') : '',
      episodeName: type === 'tv' ? episodeData?.name || '' : '',
    };
  }, [type, season, episode, episodeData]);

  useEffect(() => {
    lastHandledRemotePlaybackRef.current = '';
    lastEpisodeTransitionSignatureRef.current = '';
    initialResumeAppliedRef.current = false;
    latestUserHasAdjustedVolumeRef.current = false;
    setPlayerVolume(0);
    setPlayerMuted(true);
    setPlayerDuration(0);
    setInteractionLocked(true);
  }, [type, id, season, episode, initialTimeParam, initialAutoplayParam]);

  useEffect(() => {
    const normalizedTime = Number.isFinite(Number(initialTimeParam || 0))
      ? Math.max(0, Number(initialTimeParam || 0))
      : 0;

    const nextAutoplay = initialAutoplayParam ? initialAutoplayParam === '1' : true;

    setEmbedState({
      startAt: normalizedTime,
      autoPlay: false,
      server: selectedServer,
      subtitle: selectedSubtitle,
    });

    setPlayerCurrentTime(normalizedTime);
    setPlayerIsPlaying(false);
    latestPlaybackRef.current = {
      currentTime: normalizedTime,
      isPlaying: false,
    };
    pendingInitialSyncRef.current = {
      currentTime: normalizedTime,
      isPlaying: nextAutoplay,
    };
    setPlayerReady(false);
    setShowAutoplayHint(nextAutoplay);
    setIframeSeed((prev) => prev + 1);
  }, [initialTimeParam, initialAutoplayParam, type, id, season, episode, selectedServer, selectedSubtitle, isMobileLike]);

  useEffect(() => {
  if (!type || !id) return;

  try {
    const raw = sessionStorage.getItem(WATCH_SESSION_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw);

    const sameMedia =
      String(saved?.type) === String(type) &&
      String(saved?.id) === String(id) &&
      String(saved?.season || '') === String(season || '') &&
      String(saved?.episode || '') === String(episode || '');

    if (!sameMedia) return;

    const urlTime = Math.max(0, Number(initialTimeParam || 0));
    const savedTime = Math.max(0, Number(saved?.currentTime || 0));

    const restoredAutoplay = Boolean(saved?.isPlaying);
    const restoredServer =
      typeof saved?.server === 'string' && SERVER_OPTIONS.includes(saved.server)
        ? saved.server
        : 'Alpha';
    const restoredSubtitle =
      typeof saved?.subtitle === 'string' ? saved.subtitle : '0';

    const shouldUseSavedSession =
      savedTime > urlTime ||
      (!initialTimeParam && !initialAutoplayParam);

    if (!shouldUseSavedSession) return;

    setSelectedServer(restoredServer);
    setSelectedSubtitle(restoredSubtitle);

    setEmbedState({
      startAt: savedTime,
      autoPlay: false,
      server: restoredServer,
      subtitle: restoredSubtitle,
    });

    setPlayerCurrentTime(savedTime);
    setPlayerIsPlaying(false);
    latestPlaybackRef.current = {
      currentTime: savedTime,
      isPlaying: false,
    };

    pendingInitialSyncRef.current = {
      currentTime: savedTime,
      isPlaying: restoredAutoplay,
    };

    setPlayerReady(false);
    setShowAutoplayHint(restoredAutoplay);
    setIframeSeed((prev) => prev + 1);
  } catch (error) {
    console.error('Failed to restore watch session:', error);
  }
}, [type, id, season, episode, initialTimeParam, initialAutoplayParam]);

  useEffect(() => {
    if (!initialTimeParam && !initialAutoplayParam) return;

    const startTime = Number(initialTimeParam || 0);

    setSyncNotice(
      `Synced to host${Number.isFinite(startTime) ? ` at ${Math.max(0, Math.floor(startTime))}s` : ''}.`
    );

    const timeout = setTimeout(() => {
      setSyncNotice('');
    }, 2500);

    return () => clearTimeout(timeout);
  }, [initialTimeParam, initialAutoplayParam]);

  useEffect(() => {
    if (!showAutoplayHint) return;

    const timeout = setTimeout(() => {
      setShowAutoplayHint(false);
    }, 4000);

    return () => clearTimeout(timeout);
  }, [showAutoplayHint]);

  useEffect(() => {
    if (!partyCode || !userId || !isHost || !type || !id) return;

    publishPlaybackState(
      latestPlaybackRef.current.currentTime,
      latestPlaybackRef.current.isPlaying,
      {
        season: liveTvProgressRef.current.season || season,
        episode: liveTvProgressRef.current.episode || episode,
      }
    );
  }, [partyCode, userId, isHost, type, id, season, episode]);

  useEffect(() => {
    const handleMessage = async (event) => {
      if (!VIDFAST_ORIGINS.includes(event.origin) || !event.data) {
        return;
      }

      if (event.data.type === 'MEDIA_DATA') {
        return;
      }

      if (event.data.type !== 'PLAYER_EVENT') return;

      const payload = event.data.data || {};
      const playerEvent = payload.event;

      const rawCurrentTime =
        typeof payload.currentTime === 'number' && Number.isFinite(payload.currentTime)
          ? Math.max(0, payload.currentTime)
          : 0;

      const rawDuration =
        typeof payload.duration === 'number' && Number.isFinite(payload.duration)
          ? Math.max(0, payload.duration)
          : 0;

      if (rawDuration > 0) {
        setPlayerDuration(rawDuration);
      }

      const previousSeason = safeNumber(liveTvProgressRef.current.season, 0);
      const previousEpisode = safeNumber(liveTvProgressRef.current.episode, 0);

      const liveSeason =
        type === 'tv'
          ? extractPayloadSeason(
              payload,
              liveTvProgressRef.current.season || safeNumber(season, '')
            )
          : '';

      const liveEpisode =
        type === 'tv'
          ? extractPayloadEpisode(
              payload,
              liveTvProgressRef.current.episode || safeNumber(episode, '')
            )
          : '';

      const liveEpisodeName =
        type === 'tv'
          ? extractPayloadEpisodeName(
              payload,
              liveTvProgressRef.current.episodeName || episodeData?.name || ''
            )
          : '';

      const nextSeasonNumber = safeNumber(liveSeason, 0);
      const nextEpisodeNumber = safeNumber(liveEpisode, 0);

      const hasEpisodeTransition =
        type === 'tv' &&
        previousSeason > 0 &&
        previousEpisode > 0 &&
        nextSeasonNumber > 0 &&
        nextEpisodeNumber > 0 &&
        (previousSeason !== nextSeasonNumber || previousEpisode !== nextEpisodeNumber);

      if (type === 'tv') {
        liveTvProgressRef.current = {
          season: liveSeason,
          episode: liveEpisode,
          episodeName: liveEpisodeName,
        };
      }

      if (hasEpisodeTransition && userId && id && heroData) {
        const transitionSignature = [
          id,
          previousSeason,
          previousEpisode,
          nextSeasonNumber,
          nextEpisodeNumber,
        ].join('|');

        if (transitionSignature !== lastEpisodeTransitionSignatureRef.current) {
          lastEpisodeTransitionSignatureRef.current = transitionSignature;

          try {
            if (saveContinueWatchingTimeoutRef.current) {
              clearTimeout(saveContinueWatchingTimeoutRef.current);
              saveContinueWatchingTimeoutRef.current = null;
            }

            await advanceTvProgressAtomically({
              uid: userId,
              showId: id,
              heroData,
              previousSeason,
              previousEpisode,
              nextSeason: nextSeasonNumber,
              nextEpisode: nextEpisodeNumber,
              nextEpisodeName: liveEpisodeName,
              isPlaying: true,
            });
          } catch (transitionError) {
            console.error('Failed to advance TV progress atomically:', transitionError);

            try {
              await markEpisodeWatched({
                uid: userId,
                showId: id,
                season: previousSeason,
                episode: previousEpisode,
              });

              await saveContinueWatchingItem({
                uid: userId,
                type,
                id,
                heroData,
                episodeData: null,
                season: nextSeasonNumber,
                episode: nextEpisodeNumber,
                episodeName: liveEpisodeName,
                currentTime: 0,
                isPlaying: true,
              });
            } catch (fallbackError) {
              console.error('Fallback episode transition save failed:', fallbackError);
            }
          }

          if (!isMobileLike && autoplayUnlocked) {
            setTimeout(() => {
              const nextTime = 0;
              const shouldPlay = true;

              bootstrapPlaybackAfterUnlock(nextTime, shouldPlay);
            }, 850);
          }
        }
      }

      const currentTime = hasEpisodeTransition ? 0 : rawCurrentTime;

      if (playerEvent === 'play') {
        setPlayerCurrentTime(currentTime);
        setPlayerIsPlaying(true);
        latestPlaybackRef.current = {
          currentTime,
          isPlaying: true,
        };

        if (isHost && Date.now() > suppressBroadcastUntilRef.current) {
          publishPlaybackState(currentTime, true, {
            season: liveSeason,
            episode: liveEpisode,
          });
        }

        queueSaveContinueWatching(currentTime, true);
        return;
      }

      if (playerEvent === 'pause') {
        setPlayerCurrentTime(currentTime);
        setPlayerIsPlaying(false);
        latestPlaybackRef.current = {
          currentTime,
          isPlaying: false,
        };

        if (isHost && Date.now() > suppressBroadcastUntilRef.current) {
          publishPlaybackState(currentTime, false, {
            season: liveSeason,
            episode: liveEpisode,
          });
        }

        queueSaveContinueWatching(currentTime, false);
        return;
      }

      if (playerEvent === 'seeked' || playerEvent === 'timeupdate') {
        setPlayerCurrentTime(currentTime);
        latestPlaybackRef.current = {
          currentTime,
          isPlaying: latestPlaybackRef.current.isPlaying,
        };

        if (
          playerEvent === 'seeked' &&
          isHost &&
          Date.now() > suppressBroadcastUntilRef.current
        ) {
          publishPlaybackState(currentTime, latestPlaybackRef.current.isPlaying, {
            season: liveSeason,
            episode: liveEpisode,
          });
        }

        if (playerEvent === 'seeked' || currentTime % 15 < 1) {
          queueSaveContinueWatching(currentTime, latestPlaybackRef.current.isPlaying);
        }
        return;
      }

      if (playerEvent === 'ended') {
        setPlayerCurrentTime(currentTime);
        setPlayerIsPlaying(false);
        latestPlaybackRef.current = {
          currentTime,
          isPlaying: false,
        };
        queueSaveContinueWatching(currentTime, false);
        return;
      }

      if (playerEvent === 'playerstatus') {
        setPlayerReady(true);
        setPlayerCurrentTime(currentTime);

        const playing =
          typeof payload.playing === 'boolean'
            ? payload.playing
            : typeof payload.isPlaying === 'boolean'
              ? payload.isPlaying
              : latestPlaybackRef.current.isPlaying;

        setPlayerIsPlaying(playing);
        latestPlaybackRef.current = {
          currentTime,
          isPlaying: playing,
        };

        if (
          autoplayUnlocked &&
          initialResumeAppliedRef.current &&
          !pendingInitialSyncRef.current
        ) {
          queueSaveContinueWatching(currentTime, playing);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isHost, userId, type, id, season, episode, heroData, episodeData, autoplayUnlocked, isMobileLike]);

  useEffect(() => {
    if (!playerReady || !pendingInitialSyncRef.current || !autoplayUnlocked) return;

    const pending = pendingInitialSyncRef.current;
    pendingInitialSyncRef.current = null;

    const timeout = setTimeout(() => {
      bootstrapPlaybackAfterUnlock(pending.currentTime, pending.isPlaying);
    }, 650);

    return () => clearTimeout(timeout);
  }, [playerReady, iframeKey, autoplayUnlocked]);

  useEffect(() => {
    const handlePartyResync = (event) => {
      const detail = event.detail || {};
      if (!detail.mediaType || !detail.mediaId) return;

      const sameMedia =
        detail.mediaType === type &&
        String(detail.mediaId) === String(id) &&
        (detail.mediaType !== 'tv' ||
          (String(detail.season || '') === String(season || '') &&
            String(detail.episode || '') === String(episode || '')));

      if (!sameMedia) {
        const params = new URLSearchParams();
        params.set('type', String(detail.mediaType));
        params.set('id', String(detail.mediaId));
        params.set('t', String(Math.max(0, Math.floor(Number(detail.currentTime || 0)))));
        params.set('autoplay', detail.isPlaying ? '1' : '0');
        params.set('partyFollow', '1');

        if (detail.mediaType === 'tv') {
          if (detail.season !== undefined && detail.season !== null && String(detail.season) !== '') {
            params.set('season', String(detail.season));
          }
          if (detail.episode !== undefined && detail.episode !== null && String(detail.episode) !== '') {
            params.set('episode', String(detail.episode));
          }
        }

        router.replace(`/watch?${params.toString()}`);
        return;
      }

      if (partyFollowEnabled && autoplayUnlocked) {
        applyPartyCommandToCurrentPlayer({
          currentTime: Number(detail.currentTime || 0),
          isPlaying: Boolean(detail.isPlaying),
        });
      }

      setSyncNotice(`Synced to host at ${Math.floor(Number(detail.currentTime || 0))}s.`);
      setTimeout(() => setSyncNotice(''), 2500);
    };

    window.addEventListener('kflix-party-resync', handlePartyResync);

    return () => {
      window.removeEventListener('kflix-party-resync', handlePartyResync);
    };
  }, [router, type, id, season, episode, partyFollowEnabled, autoplayUnlocked]);

  useEffect(() => {
    if (!partyCode || !userId || isHost || !partyFollowEnabled) return;

    const playbackRef = ref(db, `parties/${partyCode}/playback`);

    const unsubscribe = onValue(playbackRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const media = snapshot.val() || {};
      if (media.mediaType === 'live') return;

      const mediaType = media.mediaType ? String(media.mediaType) : '';
      const mediaId = media.mediaId ? String(media.mediaId) : '';
      const mediaSeason =
        media.season !== undefined && media.season !== null ? String(media.season) : '';
      const mediaEpisode =
        media.episode !== undefined && media.episode !== null ? String(media.episode) : '';
      const mediaTime =
        typeof media.currentTime === 'number' && Number.isFinite(media.currentTime)
          ? Math.max(0, media.currentTime)
          : 0;
      const mediaPlaying = Boolean(media.isPlaying);

      if (!mediaType || !mediaId) return;

      const sameMedia =
        mediaType === type &&
        mediaId === String(id) &&
        (mediaType !== 'tv' ||
          (mediaSeason === String(season || '') &&
            mediaEpisode === String(episode || '')));

      if (!sameMedia) return;

      const signature = [
        mediaType,
        mediaId,
        mediaSeason,
        mediaEpisode,
        mediaPlaying ? '1' : '0',
        Math.floor(mediaTime),
        String(media.updatedAt || ''),
      ].join('|');

      if (signature === lastHandledRemotePlaybackRef.current) return;
      lastHandledRemotePlaybackRef.current = signature;

      if (!autoplayUnlocked) {
        pendingInitialSyncRef.current = {
          currentTime: mediaTime,
          isPlaying: mediaPlaying,
        };

        setEmbedState({
          startAt: Math.max(0, Math.floor(mediaTime)),
          autoPlay: false,
          server: selectedServer,
          subtitle: selectedSubtitle,
        });
        setPlayerCurrentTime(Math.max(0, mediaTime));
        setPlayerIsPlaying(false);
        latestPlaybackRef.current = {
          currentTime: Math.max(0, mediaTime),
          isPlaying: false,
        };
        setPlayerReady(false);
        setIframeSeed((prev) => prev + 1);
        initialResumeAppliedRef.current = false;
        return;
      }

      if (!playerReady) {
        pendingInitialSyncRef.current = {
          currentTime: mediaTime,
          isPlaying: mediaPlaying,
        };

        reloadPlayerToPosition({
          currentTime: mediaTime,
          isPlaying: mediaPlaying,
          server: selectedServer,
          subtitle: selectedSubtitle,
        });
        initialResumeAppliedRef.current = false;
      } else {
        applyPartyCommandToCurrentPlayer({
          currentTime: mediaTime,
          isPlaying: mediaPlaying,
        });
      }
    });

    return () => unsubscribe();
  }, [
    partyCode,
    userId,
    isHost,
    partyFollowEnabled,
    type,
    id,
    season,
    episode,
    playerReady,
    autoplayUnlocked,
    selectedServer,
    selectedSubtitle,
  ]);

  useEffect(() => {
  const handleFlush = () => {
    saveWatchSession();
    flushContinueWatching();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      saveWatchSession();
      flushContinueWatching();
    }
  };

  window.addEventListener('pagehide', handleFlush);
  window.addEventListener('beforeunload', handleFlush);
  window.addEventListener('kflix-flush-continue-watching', handleFlush);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.removeEventListener('pagehide', handleFlush);
    window.removeEventListener('beforeunload', handleFlush);
    window.removeEventListener('kflix-flush-continue-watching', handleFlush);
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    saveWatchSession();
    flushContinueWatching();
  };
}, [
  type,
  id,
  season,
  episode,
  heroData,
  episodeData,
  userId,
  autoplayUnlocked,
  selectedServer,
  selectedSubtitle,
  partyFollowEnabled,
  returnToParam,
]);

  useEffect(() => {
    return () => {
      const currentPartyCode = latestPartyCodeRef.current;
      const currentUserId = latestUserIdRef.current;
      const currentIsHost = latestIsHostRef.current;

      if (!currentPartyCode || !currentUserId || !currentIsHost) return;

      setPartyMedia(currentPartyCode, {
        mediaType: null,
        mediaId: null,
        season: null,
        episode: null,
        currentTime: 0,
        isPlaying: false,
        updatedBy: currentUserId,
        route: '',
        sourceIndex: 0,
        streamIndex: 0,
        sourcesParam: '',
      }).catch((partyError) => {
        console.error('Failed to clear host media on watch page exit:', partyError);
      });
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && noticeOpen) {
        setNoticeOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [noticeOpen]);

  const handleNoticeUnderstood = () => {
    setNoticeOpen(false);
    setAutoplayUnlocked(true);

    const shouldAutoplay = initialAutoplayParam ? initialAutoplayParam === '1' : true;
    const targetTime = latestPlaybackRef.current.currentTime || 0;

    bootstrapPlaybackAfterUnlock(targetTime, shouldAutoplay);
  };

  const handleNoticeNotUnderstood = () => {
    if (returnToParam) {
      router.push(returnToParam);
      return;
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/');
  };

  if (loading) {
    return (
      <div
        className="flex min-h-screen flex-col"
        style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}
      >
        <Navbar />

        <main className="flex flex-1 items-center justify-center px-4 pb-4 pt-20 sm:px-6 sm:pt-24 lg:px-8">
          <div className="w-full max-w-6xl overflow-hidden rounded-3xl border-[1.5px] p-6 sm:p-8" style={glassPanelStyle}>
            <p className="text-base sm:text-lg" style={{ color: 'var(--theme-muted-text)' }}>
              Loading watch page...
            </p>
          </div>
        </main>

        <footer
          className="px-4 pb-8 pt-2 text-center text-sm sm:px-6 lg:px-8"
          style={{ color: 'var(--theme-muted-text)' }}
        >
          <p>This site does not host or store any media.</p>
        </footer>
      </div>
    );
  }

  if (error || !heroData) {
    return (
      <div
        className="flex min-h-screen flex-col"
        style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}
      >
        <Navbar />

        <main className="flex flex-1 items-center justify-center px-4 pb-4 pt-20 sm:px-6 sm:pt-24 lg:px-8">
          <div className="w-full max-w-6xl overflow-hidden rounded-3xl border-[1.5px] p-6 text-center sm:p-8" style={glassPanelStyle}>
            <p className="text-base sm:text-lg" style={{ color: 'var(--theme-accent-text)' }}>
              {error || 'Unable to load this page.'}
            </p>

            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border px-5 text-sm font-semibold transition active:scale-95"
                style={glassAccentButtonStyle}
              >
                Go Home
              </Link>
            </div>
          </div>
        </main>

        <footer
          className="px-4 pb-8 pt-2 text-center text-sm sm:px-6 lg:px-8"
          style={{ color: 'var(--theme-muted-text)' }}
        >
          <p>This site does not host or store any media.</p>
        </footer>
      </div>
    );
  }

  return (
    <>
      <div
        className="flex min-h-screen flex-col"
        style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}
      >
        <Navbar />

        <main className="flex flex-1 items-center justify-center px-4 pb-4 pt-20 sm:px-6 sm:pt-24 lg:px-8">
          <section className="w-full max-w-6xl">
            {syncNotice && (
              <div
                className="mb-4 rounded-2xl border px-4 py-3 text-sm"
                style={successNoticeStyle}
              >
                {syncNotice}
              </div>
            )}

            {showAutoplayHint && (
              <div
                className="mb-4 rounded-2xl border px-4 py-3 text-sm"
                style={warningNoticeStyle}
              >
                Autoplay was requested. Playback will start after you confirm the notice.
              </div>
            )}

            {!isMobileLike && fullscreenNoticeOpen && (
  <div
    className="mb-4 rounded-2xl border px-4 py-3 text-sm"
    style={warningNoticeStyle}
  >
    Entered fullscreen. Press ESC to exit fullscreen.
  </div>
)}

            <div className="overflow-hidden rounded-3xl border-[1.5px] p-2 sm:p-3" style={glassPanelStyle}>
              <div
                ref={playerShellRef}
                className="overflow-hidden rounded-2xl border-[1.5px] p-0"
                style={{
                  ...glassSurfaceStyle,
                  boxShadow:
                    '0 0 34px color-mix(in srgb, var(--theme-accent-glow) 42%, transparent), 0 16px 32px rgba(0,0,0,0.28)',
                }}
              >
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
                  {embedUrl ? (
                    <>
                      <iframe
                        key={iframeKey}
                        ref={playerFrameRef}
                        src={embedUrl}
                        title="KFlix Player"
                        className="h-full w-full"
                        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; web-share"
                        allowFullScreen
                        referrerPolicy="no-referrer"
                        onLoad={() => {
                          setPlayerReady(true);

                          setTimeout(() => {
                            requestPlayerStatus();

                            if (pendingSeekRef.current) {
                              const { time, play } = pendingSeekRef.current;

                              sendPlayerCommand({
                                command: 'seek',
                                time,
                              });

                              setTimeout(() => {
                                sendPlayerCommand({
                                  command: play ? 'play' : 'pause',
                                  time,
                                });
                              }, 120);

                              pendingSeekRef.current = null;
                            }

                            if (isHost && partyCode) {
                              publishPlaybackState(
                                latestPlaybackRef.current.currentTime,
                                latestPlaybackRef.current.isPlaying,
                                {
                                  season: liveTvProgressRef.current.season || season,
                                  episode: liveTvProgressRef.current.episode || episode,
                                }
                              );
                            }
                          }, 700);
                        }}
                      />

                      {!isMobileLike && interactionLocked && (
                        <div
                          className="absolute inset-0 z-10"
                          aria-hidden="true"
                          style={{
                            background: 'transparent',
                            cursor: 'default',
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <div
                      className="flex h-full items-center justify-center px-4 text-center text-sm sm:px-6"
                      style={{ color: 'var(--theme-muted-text)' }}
                    >
                      Unable to build a valid player URL for this media.
                    </div>
                  )}
                </div>
              </div>

              {!isMobileLike && (
                <div className="mt-3 rounded-2xl border p-3 sm:p-4" style={glassSurfaceStyle}>
                  <div
                    className="mb-3 rounded-2xl border px-3 py-3 sm:px-4"
                    style={glassGhostButtonStyle}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="min-w-[3.25rem] text-xs font-semibold sm:min-w-[4rem]"
                        style={{ color: 'var(--theme-muted-text)' }}
                      >
                        {formatPlayerTime(playerCurrentTime)}
                      </span>

                      <input
                        type="range"
                        min="0"
                        max={Math.max(0, Math.floor(playerDuration || 0))}
                        step="1"
                        value={Math.min(
                          Math.max(0, Math.floor(playerCurrentTime || 0)),
                          Math.max(0, Math.floor(playerDuration || 0))
                        )}
                        onChange={handleSeekBarChange}
                        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--theme-accent)]"
                        aria-label="Seek"
                      />

                      <span
                        className="min-w-[3.25rem] text-right text-xs font-semibold sm:min-w-[4rem]"
                        style={{ color: 'var(--theme-muted-text)' }}
                      >
                        {formatPlayerTime(playerDuration)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_auto_220px] lg:items-center">
                    <div className="flex justify-center lg:justify-start">
                      <div
                        className="flex w-[220px] items-center gap-2 rounded-2xl border px-3 py-2"
                        style={glassGhostButtonStyle}
                      >
                        <button
                          type="button"
                          onClick={handleToggleMute}
                          className="inline-flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border transition active:scale-95"
                          style={playerMuted ? glassAccentButtonStyle : glassGhostButtonStyle}
                          aria-label={playerMuted ? 'Unmute' : 'Mute'}
                        >
                          {playerMuted ? <IconMute /> : <IconVolume />}
                        </button>

                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={playerMuted ? 0 : playerVolume}
                          onChange={handleVolumeChange}
                          className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--theme-accent)]"
                          aria-label="Volume"
                        />

                        <span
                          className="min-w-[2.3rem] text-right text-xs font-semibold"
                          style={{ color: 'var(--theme-muted-text)' }}
                        >
                          {Math.round((playerMuted ? 0 : playerVolume) * 100)}%
                        </span>
                      </div>
                    </div>                    <div className="flex justify-center">
                      <div className="flex items-center justify-center gap-2 sm:gap-3">
                        {type === 'tv' && (
                          <button
                            type="button"
                            onClick={handlePreviousEpisode}
                            disabled={!canGoToPreviousEpisode}
                            className="inline-flex h-11 min-w-[3rem] cursor-pointer items-center justify-center rounded-xl border px-3 text-xs font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            style={glassGhostButtonStyle}
                            aria-label="Previous episode"
                            title="Previous episode"
                          >
                            
                            <IconSkipBack />
                          </button>
                        )}

                        <button
  type="button"
  onClick={() => handleSeekRelative(-10)}
  className="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-95"
  style={glassGhostButtonStyle}
  aria-label="Back 10 seconds"
  title="Back 10 seconds"
>
  <div className="relative flex items-center justify-center">
  <IconRotateCcw className="h-5 w-5" />
  <span className="pointer-events-none absolute text-[10px] font-bold leading-none">
    
  </span>
</div>
</button>

                        <button
  type="button"
  onClick={handleTogglePlay}
  className="inline-flex h-11 w-20 cursor-pointer items-center justify-center rounded-[12px] border transition active:scale-95"
  style={glassAccentButtonStyle}
  aria-label={playerIsPlaying ? 'Pause' : 'Resume'}
  title={playerIsPlaying ? 'Pause' : 'Resume'}
>
  {playerIsPlaying ? (
    <IconPause className="h-9 w-9" />
  ) : (
    <IconPlay className="h-9 w-9" />
  )}
</button>

                        <button
  type="button"
  onClick={() => handleSeekRelative(10)}
  className="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-95"
  style={glassGhostButtonStyle}
  aria-label="Forward 10 seconds"
  title="Forward 10 seconds"
>
  <div className="relative flex items-center justify-center">
  <IconRotateCw className="h-5 w-5" />
  <span className="pointer-events-none absolute text-[10px] font-bold leading-none">
    
  </span>
</div>
</button>

                        {type === 'tv' && (
                          <button
                            type="button"
                            onClick={handleNextEpisode}
                            disabled={!canGoToNextEpisode}
                            className="inline-flex h-11 min-w-[3rem] cursor-pointer items-center justify-center rounded-xl border px-3 text-xs font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            style={glassGhostButtonStyle}
                            aria-label="Next episode"
                            title="Next episode"
                          >
                            <IconSkipForward />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-center lg:justify-end">
                      <div
                        className="flex w-[220px] items-center justify-center gap-2 rounded-2xl border px-3 py-2"
                        style={glassGhostButtonStyle}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setServerMenuOpen((prev) => !prev);
                            setSubtitleMenuOpen(false);
                          }}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition active:scale-95"
                          style={serverMenuOpen ? glassAccentButtonStyle : glassGhostButtonStyle}
                          aria-label="Server"
                          title="Server"
                        >
                          <IconServer />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSubtitleMenuOpen((prev) => !prev);
                            setServerMenuOpen(false);
                          }}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition active:scale-95"
                          style={selectedSubtitle !== '0' ? glassAccentButtonStyle : glassGhostButtonStyle}
                          aria-label="Subtitles"
                          title={currentSubtitleLabel}
                        >
                          <IconSubtitles className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setInteractionLocked((prev) => !prev)}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition active:scale-95"
                          style={interactionLocked ? glassGhostButtonStyle : glassAccentButtonStyle}
                          aria-label={interactionLocked ? 'Unlock player interaction' : 'Lock player interaction'}
                          title={interactionLocked ? 'Unlock player interaction' : 'Lock player interaction'}
                        >
                          {interactionLocked ? <IconLock /> : <IconUnlock />}
                        </button>

                        <button
                          type="button"
                          onClick={handleFullscreen}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition active:scale-95"
                          style={glassGhostButtonStyle}
                          aria-label="Fullscreen"
                          title="Fullscreen"
                        >
                          <IconFullscreen />
                        </button>
                      </div>
                    </div>
                  </div>

                  {serverMenuOpen && (
                    <div
                      className="mt-3 rounded-2xl border p-3"
                      style={{
                        ...glassSurfaceStyle,
                        boxShadow:
                          '0 10px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.06)',
                      }}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <IconServer className="h-4 w-4" />
                        <p className="text-sm font-semibold" style={{ color: 'var(--theme-accent-text)' }}>
                          Choose Server
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {SERVER_OPTIONS.map((serverName) => {
                          const active = selectedServer === serverName;

                          return (
                            <button
                              key={serverName}
                              type="button"
                              onClick={() => handleServerSelect(serverName)}
                              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border px-4 text-sm font-semibold transition active:scale-95"
                              style={active ? glassAccentButtonStyle : glassGhostButtonStyle}
                            >
                              {serverName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {subtitleMenuOpen && (
                    <div
                      className="mt-3 rounded-2xl border p-3"
                      style={{
                        ...glassSurfaceStyle,
                        boxShadow:
                          '0 10px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.06)',
                      }}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <IconSubtitles className="h-4 w-4" />
                        <p className="text-sm font-semibold" style={{ color: 'var(--theme-accent-text)' }}>
                          Choose Subtitles
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {SUBTITLE_OPTIONS.map((subtitleOption) => {
                          const active = selectedSubtitle === subtitleOption.value;

                          return (
                            <button
                              key={subtitleOption.value}
                              type="button"
                              onClick={() => handleSubtitleSelect(subtitleOption.value)}
                              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border px-4 text-sm font-semibold transition active:scale-95"
                              style={active ? glassAccentButtonStyle : glassGhostButtonStyle}
                            >
                              {subtitleOption.label}
                            </button>
                          );
                        })}
                      </div>

                      <div
                        className="mt-3 rounded-xl border px-4 py-3 text-xs sm:text-sm"
                        style={glassGhostButtonStyle}
                      >
                        Subtitle changes reload the player at the current timestamp so the switch feels smooth.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </main>

        <footer
          className="px-4 pb-8 pt-2 text-center text-sm sm:px-6 lg:px-8"
          style={{ color: 'var(--theme-muted-text)' }}
        >
          <p></p>
        </footer>
      </div>

      {noticeOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-3 backdrop-blur-sm sm:px-4">
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl border-[1.5px]"
            style={glassPanelStyle}
          >
            <div
              className="border-b px-4 py-3 sm:px-5"
              style={glassNoticeStyle}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full border text-yellow-200"
                  style={{
                    borderColor: 'rgba(250, 204, 21, 0.28)',
                    background:
                      'linear-gradient(180deg, rgba(250, 204, 21, 0.14), rgba(161, 98, 7, 0.10))',
                  }}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>

                <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                  Important Notice
                </p>
              </div>
            </div>

            <div className="space-y-4 px-4 py-4 sm:space-y-5 sm:px-5 sm:py-5">
              <div className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                <p className="text-sm font-semibold" style={{ color: 'var(--theme-accent-text)' }}>
                  1.) How to resolve Server / Playback issues?
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-200 sm:leading-7">
                  The embedded players are external (third party) and therefor not affected by KFlix.
                </p>

                <p className="mt-0 text-sm leading-6 text-gray-500 sm:leading-2">
                  Down below are the most common solutions for server or playback issues.
                </p>

                <div
                  className="mt-3 rounded-xl border px-4 py-3 text-sm text-gray-300"
                  style={glassSurfaceStyle}
                >
                • Refresh the page multiple times.
                </div> 
                
                <div
                  className="mt-3 rounded-xl border px-4 py-3 text-sm text-gray-300"
                  style={glassSurfaceStyle}
                >
                • Switch between the different servers.
                </div> 
                
                <div
                  className="mt-3 rounded-xl border px-4 py-3 text-sm text-gray-300"
                  style={glassSurfaceStyle}
                >
                • Turn on a VPN, and refresh the page (best fix).
                </div> 
              </div>

              <div className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                <p className="text-sm font-semibold" style={{ color: 'var(--theme-accent-text)' }}>
                  2.) How to prevent pop-up ads and unwanted content?
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-200 sm:leading-7">
                  The players have baked in ads, new windows might open when clicking on the player.
                </p>

                <p className="mt-0 text-sm leading-6 text-gray-500 sm:leading-2">
                  We combat this by using our own control panel, and adding a invisible (toggleable) layer on top.
                </p>

                <div
                  className="mt-3 rounded-xl border px-4 py-3 text-sm text-gray-300"
                  style={glassSurfaceStyle}
                >
                • Use adblockers like uBlock Origin.
                </div> 

                <div
                  className="mt-3 rounded-xl border px-4 py-3 text-sm text-gray-300"
                  style={glassSurfaceStyle}
                >
                • Use browsers like Brave.
                </div> 
              </div>

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleNoticeNotUnderstood}
                  className="flex h-10 w-full cursor-pointer items-center justify-center rounded-xl border px-4 text-sm font-semibold transition active:scale-95 sm:w-auto"
                  style={glassGhostButtonStyle}
                >
                  I Don’t Understand
                </button>

                <button
                  type="button"
                  onClick={handleNoticeUnderstood}
                  className="flex h-10 w-full cursor-pointer items-center justify-center rounded-xl border px-5 text-sm font-semibold transition active:scale-95 sm:w-auto"
                  style={glassAccentButtonStyle}
                >
                  I Understand
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen text-white" style={{ background: 'var(--theme-bg)' }} />}>
      <WatchPageContent />
    </Suspense>
  );
}