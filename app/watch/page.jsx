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

const SERVER_OPTIONS = ['Alpha', 'Beta', 'Gamma', 'Delta'];

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

function IconSettings({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1 .6 1.65 1.65 0 00-.33 1V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-.33-1 1.65 1.65 0 00-1-.6 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-.6-1 1.65 1.65 0 00-1-.33H3a2 2 0 010-4h.09a1.65 1.65 0 001-.33 1.65 1.65 0 00.6-1 1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 017.13 3.6l.06.06A1.65 1.65 0 009 4.6c.38 0 .74-.14 1-.4.26-.26.4-.62.4-1V3a2 2 0 014 0v.09c0 .38.14.74.4 1 .26.26.62.4 1 .4a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c0 .38.14.74.4 1 .26.26.62.4 1 .4H21a2 2 0 010 4h-.09c-.38 0-.74.14-1 .4-.26.26-.4.62-.4 1z" />
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
}) {
  if (!id || !type) return '';

  const params = new URLSearchParams();

  params.set('title', 'true');
  params.set('poster', 'false');
  params.set('autoPlay', autoPlay ? 'true' : 'false');
  params.set('theme', 'E7000B');
  params.set('hideServerControls', 'true');
  params.set('fullscreenButton', 'true');
  params.set('chromecast', 'true');
  params.set('sub', '0');
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

function createContinueWatchingItem({
  type,
  heroData,
  episodeData,
  season,
  episode,
  episodeName,
  currentTime,
  isPlaying,
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
    nextSeason: null,
    nextEpisode: null,
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
        ? resolveNextTvEpisode(heroData, activeSeason, activeEpisode)
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
  const continueItem = createContinueWatchingItem({
    type: 'tv',
    heroData,
    episodeData: null,
    season: safeNextSeason,
    episode: safeNextEpisode,
    episodeName: nextEpisodeName || '',
    currentTime: 0,
    isPlaying,
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

  const [userId, setUserId] = useState('');
  const [partyCode, setPartyCode] = useState('');
  const [members, setMembers] = useState([]);

  const [playerReady, setPlayerReady] = useState(false);
  const [playerCurrentTime, setPlayerCurrentTime] = useState(
    Number.isFinite(initialStartTime) ? Math.max(0, initialStartTime) : 0
  );
  const [playerIsPlaying, setPlayerIsPlaying] = useState(false);
  const [playerVolume, setPlayerVolume] = useState(1);
  const [playerMuted, setPlayerMuted] = useState(false);

  const [selectedServer, setSelectedServer] = useState('Alpha');
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [embedState, setEmbedState] = useState({
    startAt: Number.isFinite(initialStartTime) ? Math.max(0, initialStartTime) : 0,
    autoPlay: false,
    server: 'Alpha',
  });

  const [iframeSeed, setIframeSeed] = useState(0);

  const currentMember = useMemo(
    () => members.find((member) => String(member.id) === String(userId)) || null,
    [members, userId]
  );

  const isHost = Boolean(currentMember?.isHost);

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
    });
  }, [type, id, season, episode, embedState]);

  const iframeKey = useMemo(() => {
    return `${type}-${id}-${season || 'na'}-${episode || 'na'}-${iframeSeed}-${embedState.startAt}-${embedState.autoPlay ? '1' : '0'}-${embedState.server}`;
  }, [type, id, season, episode, iframeSeed, embedState]);

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

  const reloadPlayerToPosition = ({ currentTime, isPlaying, server = selectedServer }) => {
    const targetTime =
      typeof currentTime === 'number' && Number.isFinite(currentTime)
        ? Math.max(0, Math.floor(currentTime))
        : 0;

    const shouldPlay = Boolean(isPlaying);

    setEmbedState({
      startAt: targetTime,
      autoPlay: shouldPlay,
      server,
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

  const handleVolumeChange = (event) => {
    ensureUserInteractionUnlock();

    const nextVolume = Math.max(0, Math.min(1, Number(event.target.value)));
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

    const nextMuted = !playerMuted;
    setPlayerMuted(nextMuted);

    sendPlayerCommand({
      command: 'mute',
      muted: nextMuted,
    });

    if (!nextMuted && playerVolume <= 0) {
      setPlayerVolume(0.5);
      sendPlayerCommand({
        command: 'volume',
        level: 0.5,
      });
    }
  };

  const handleFullscreen = async () => {
    const element = playerShellRef.current;
    if (!element) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await element.requestFullscreen();
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
    });
  };

  useEffect(() => {
    latestPlaybackRef.current = {
      currentTime: playerCurrentTime,
      isPlaying: playerIsPlaying,
    };
  }, [playerCurrentTime, playerIsPlaying]);

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
          const [show, ep] = await Promise.all([
            fetchTvDetail(id),
            season && episode ? fetchEpisodeDetail(id, season, episode) : Promise.resolve(null),
          ]);

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
  }, [initialTimeParam, initialAutoplayParam, type, id, season, episode, selectedServer]);

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

      if (event.data.type !== 'PLAYER_EVENT') return;

      const payload = event.data.data || {};
      const playerEvent = payload.event;

      const rawCurrentTime =
        typeof payload.currentTime === 'number' && Number.isFinite(payload.currentTime)
          ? Math.max(0, payload.currentTime)
          : 0;

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

      if (playerEvent === 'seeked') {
        setPlayerCurrentTime(currentTime);
        latestPlaybackRef.current = {
          currentTime,
          isPlaying: latestPlaybackRef.current.isPlaying,
        };

        if (isHost && Date.now() > suppressBroadcastUntilRef.current) {
          publishPlaybackState(currentTime, latestPlaybackRef.current.isPlaying, {
            season: liveSeason,
            episode: liveEpisode,
          });
        }

        queueSaveContinueWatching(currentTime, latestPlaybackRef.current.isPlaying);
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

        const nextMuted =
          typeof payload.muted === 'boolean' ? payload.muted : playerMuted;

        const nextVolume =
          typeof payload.volume === 'number' && Number.isFinite(payload.volume)
            ? Math.max(0, Math.min(1, payload.volume))
            : playerVolume;

        setPlayerIsPlaying(playing);
        setPlayerMuted(nextMuted);
        setPlayerVolume(nextVolume);

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
  }, [
    isHost,
    userId,
    type,
    id,
    season,
    episode,
    heroData,
    episodeData,
    autoplayUnlocked,
    playerMuted,
    playerVolume,
  ]);

  useEffect(() => {
    if (!playerReady || !pendingInitialSyncRef.current || !autoplayUnlocked) return;

    const pending = pendingInitialSyncRef.current;
    pendingInitialSyncRef.current = null;

    const timeout = setTimeout(() => {
      const didSeek = sendPlayerCommand({
        command: 'seek',
        time: pending.currentTime,
      });

      if (!didSeek) {
        reloadPlayerToPosition({
          currentTime: pending.currentTime,
          isPlaying: pending.isPlaying,
        });
        initialResumeAppliedRef.current = true;
        return;
      }

      sendPlayerCommand({
        command: pending.isPlaying ? 'play' : 'pause',
        time: pending.currentTime,
      });

      initialResumeAppliedRef.current = true;
    }, 700);

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
  ]);

  useEffect(() => {
    const handleFlush = () => {
      flushContinueWatching();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
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

      flushContinueWatching();
    };
  }, [type, id, season, episode, heroData, episodeData, userId, autoplayUnlocked]);

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

    const didPlay = sendPlayerCommand({
      command: shouldAutoplay ? 'play' : 'pause',
      time: targetTime,
    });

    if (!didPlay) {
      setEmbedState({
        startAt: targetTime,
        autoPlay: shouldAutoplay,
        server: selectedServer,
      });
      setIframeSeed((prev) => prev + 1);
    }

    setPlayerIsPlaying(shouldAutoplay);
    latestPlaybackRef.current = {
      currentTime: targetTime,
      isPlaying: shouldAutoplay,
    };
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
                <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
                  {embedUrl ? (
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

              <div className="mt-3 rounded-2xl border p-3 sm:p-4" style={glassSurfaceStyle}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div
                      className="flex items-center gap-3 rounded-2xl border px-3 py-2"
                      style={glassGhostButtonStyle}
                    >
                      <button
                        type="button"
                        onClick={handleToggleMute}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition active:scale-95"
                        style={glassGhostButtonStyle}
                        aria-label={playerMuted ? 'Unmute' : 'Mute'}
                      >
                        {playerMuted ? <IconMute /> : <IconVolume />}
                      </button>

                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={playerMuted ? 0 : playerVolume}
                          onChange={handleVolumeChange}
                          className="h-2 w-36 cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--theme-accent)] sm:w-40"
                          aria-label="Volume"
                        />
                        <span
                          className="min-w-[2.5rem] text-right text-xs font-semibold"
                          style={{ color: 'var(--theme-muted-text)' }}
                        >
                          {Math.round((playerMuted ? 0 : playerVolume) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => handleSeekRelative(-10)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition active:scale-95"
                      style={glassGhostButtonStyle}
                    >
                      <IconSkipBack />
                      <span>-10s</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      className="inline-flex h-11 min-w-[9.5rem] items-center justify-center gap-2 rounded-xl border px-5 text-sm font-semibold transition active:scale-95"
                      style={glassAccentButtonStyle}
                    >
                      {playerIsPlaying ? <IconPause /> : <IconPlay />}
                      <span>{playerIsPlaying ? 'Pause' : 'Play / Resume'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSeekRelative(10)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition active:scale-95"
                      style={glassGhostButtonStyle}
                    >
                      <span>+10s</span>
                      <IconSkipForward />
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setServerMenuOpen((prev) => !prev);
                        setSettingsOpen(false);
                      }}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition active:scale-95"
                      style={glassGhostButtonStyle}
                    >
                      <IconServer />
                      <span>Server</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSettingsOpen((prev) => !prev);
                        setServerMenuOpen(false);
                      }}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition active:scale-95"
                      style={glassGhostButtonStyle}
                    >
                      <IconSettings />
                      <span>Settings</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleFullscreen}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition active:scale-95"
                      style={glassGhostButtonStyle}
                    >
                      <IconFullscreen />
                      <span>Fullscreen</span>
                    </button>
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
                            className="inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition active:scale-95"
                            style={active ? glassAccentButtonStyle : glassGhostButtonStyle}
                          >
                            {serverName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {settingsOpen && (
                  <div
                    className="mt-3 rounded-2xl border p-3"
                    style={{
                      ...glassSurfaceStyle,
                      boxShadow:
                        '0 10px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <IconSettings className="h-4 w-4" />
                      <p className="text-sm font-semibold" style={{ color: 'var(--theme-accent-text)' }}>
                        Player Settings
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleToggleMute}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition active:scale-95"
                        style={glassGhostButtonStyle}
                      >
                        {playerMuted ? <IconMute /> : <IconVolume />}
                        <span>{playerMuted ? 'Unmute' : 'Mute'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={requestPlayerStatus}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition active:scale-95"
                        style={glassGhostButtonStyle}
                      >
                        <IconSettings className="h-4 w-4" />
                        <span>Refresh Status</span>
                      </button>
                    </div>

                    <div
                      className="mt-3 rounded-xl border px-4 py-3 text-xs sm:text-sm"
                      style={glassGhostButtonStyle}
                    >
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span>
                          <strong>State:</strong> {playerIsPlaying ? 'Playing' : 'Paused'}
                        </span>
                        <span>
                          <strong>Time:</strong> {Math.floor(playerCurrentTime)}s
                        </span>
                        <span>
                          <strong>Volume:</strong> {Math.round((playerMuted ? 0 : playerVolume) * 100)}%
                        </span>
                        <span>
                          <strong>Server:</strong> {selectedServer}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>

        <footer
          className="px-4 pb-8 pt-2 text-center text-sm sm:px-6 lg:px-8"
          style={{ color: 'var(--theme-muted-text)' }}
        >
          <p>This site does not host or store any media.</p>
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
                  1.) Some servers may not be functioning properly, or may be experiencing issues.
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-200 sm:leading-7">
                  The sources are external (third party) and therefore not affected by KFlix.
                </p>

                <div
                  className="mt-3 rounded-xl border px-4 py-3 text-sm text-gray-300"
                  style={glassSurfaceStyle}
                >
                  • If you receive a playback error, try other servers, or try using a VPN and reload the site.
                </div>
              </div>

              <div className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                <p className="text-sm font-semibold" style={{ color: 'var(--theme-accent-text)' }}>
                  2.) Be aware, using an adblocker like uBlock Origin or similar is highly suggested.
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-200 sm:leading-7">
                  The embedded players might display pop-up ads or take you to a new site. KFlix is not affiliated with those ads.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleNoticeNotUnderstood}
                  className="flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition active:scale-95 sm:w-auto"
                  style={glassGhostButtonStyle}
                >
                  I Don’t Understand
                </button>

                <button
                  type="button"
                  onClick={handleNoticeUnderstood}
                  className="flex h-10 w-full items-center justify-center rounded-xl border px-5 text-sm font-semibold transition active:scale-95 sm:w-auto"
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