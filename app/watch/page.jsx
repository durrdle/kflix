'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { get, onValue, ref, update, remove, set } from 'firebase/database';
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

function getEmbedUrl({ type, id, season, episode, startAt = 0, autoPlay = true }) {
  if (!id || !type) return '';

  const params = new URLSearchParams();

  params.set('title', 'true');
  params.set('poster', 'false');
  params.set('autoPlay', autoPlay ? 'true' : 'false');
  params.set('theme', 'E7000B');
  params.set('hideServerControls', 'false');
  params.set('fullscreenButton', 'true');
  params.set('chromecast', 'true');
  params.set('sub', '0');
  params.set('server', type === 'movie' ? 'Alpha' : 'Oscar');

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
    if (shouldHideBecauseTooEarly) {
      await remove(itemRef);
      window.dispatchEvent(new Event('kflix-continue-watching-updated'));
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

function WatchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const playerFrameRef = useRef(null);
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

  const type = searchParams.get('type') || '';
  const id = searchParams.get('id') || '';
  const season = searchParams.get('season') || '';
  const episode = searchParams.get('episode') || '';
  const initialTimeParam = searchParams.get('t') || '';
  const initialAutoplayParam = searchParams.get('autoplay') || '';
  const partyFollowParam = searchParams.get('partyFollow') || '';
  const partyFollowEnabled = partyFollowParam === '1';

  const initialStartTime = Number(initialTimeParam || 0);
  const initialAutoplay = initialAutoplayParam ? initialAutoplayParam === '1' : true;

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

  const [embedState, setEmbedState] = useState({
    startAt: Number.isFinite(initialStartTime) ? Math.max(0, initialStartTime) : 0,
    autoPlay: false,
  });

  const [iframeSeed, setIframeSeed] = useState(0);

  const currentMember = useMemo(
    () => members.find((member) => String(member.id) === String(userId)) || null,
    [members, userId]
  );

  const isHost = Boolean(currentMember?.isHost);

  const embedUrl = useMemo(() => {
    return getEmbedUrl({
      type,
      id,
      season,
      episode,
      startAt: embedState.startAt,
      autoPlay: embedState.autoPlay,
    });
  }, [type, id, season, episode, embedState]);

  const iframeKey = useMemo(() => {
    return `${type}-${id}-${season || 'na'}-${episode || 'na'}-${iframeSeed}-${embedState.startAt}-${embedState.autoPlay ? '1' : '0'}`;
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

  const reloadPlayerToPosition = ({ currentTime, isPlaying }) => {
    const targetTime =
      typeof currentTime === 'number' && Number.isFinite(currentTime)
        ? Math.max(0, Math.floor(currentTime))
        : 0;

    const shouldPlay = Boolean(isPlaying);

    setEmbedState({
      startAt: targetTime,
      autoPlay: shouldPlay,
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

  useEffect(() => {
    latestPlaybackRef.current = {
      currentTime: playerCurrentTime,
      isPlaying: playerIsPlaying,
    };
  }, [playerCurrentTime, playerIsPlaying]);

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
  }, [type, id, season, episode]);

  useEffect(() => {
    const nextStartTime = Number(initialTimeParam || 0);
    const nextAutoplay = initialAutoplayParam ? initialAutoplayParam === '1' : true;

    const normalizedTime = Number.isFinite(nextStartTime) ? Math.max(0, nextStartTime) : 0;

    setEmbedState({
      startAt: normalizedTime,
      autoPlay: false,
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
  }, [initialTimeParam, initialAutoplayParam, type, id, season, episode]);

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
    const handleMessage = (event) => {
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

      if (hasEpisodeTransition) {
        markEpisodeWatched({
          uid: userId,
          showId: id,
          season: previousSeason,
          episode: previousEpisode,
        });
      }

      if (type === 'tv') {
        liveTvProgressRef.current = {
          season: liveSeason,
          episode: liveEpisode,
          episodeName: liveEpisodeName,
        };
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

  setPlayerIsPlaying(playing);
  latestPlaybackRef.current = {
    currentTime,
    isPlaying: playing,
  };

  if (autoplayUnlocked) {
    queueSaveContinueWatching(currentTime, playing);
  }
}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isHost, userId, type, id, season, episode, heroData, episodeData, autoplayUnlocked]);

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
        return;
      }

      sendPlayerCommand({
        command: pending.isPlaying ? 'play' : 'pause',
        time: pending.currentTime,
      });
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
        });
        setPlayerCurrentTime(Math.max(0, mediaTime));
        setPlayerIsPlaying(false);
        latestPlaybackRef.current = {
          currentTime: Math.max(0, mediaTime),
          isPlaying: false,
        };
        setPlayerReady(false);
        setIframeSeed((prev) => prev + 1);
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
      } else {
        applyPartyCommandToCurrentPlayer({
          currentTime: mediaTime,
          isPlaying: mediaPlaying,
        });
      }
    });

    return () => unsubscribe();
  }, [partyCode, userId, isHost, partyFollowEnabled, type, id, season, episode, playerReady, autoplayUnlocked]);

  useEffect(() => {
    return () => {
      if (saveContinueWatchingTimeoutRef.current) {
        clearTimeout(saveContinueWatchingTimeoutRef.current);
      }
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
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <Navbar />

        <main className="flex flex-1 items-center justify-center px-8 pb-4 pt-24">
          <div className="w-full max-w-6xl overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 p-8 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <p className="text-lg text-gray-300">Loading watch page...</p>
          </div>
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

  if (error || !heroData) {
    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <Navbar />

        <main className="flex flex-1 items-center justify-center px-8 pb-4 pt-24">
          <div className="w-full max-w-6xl overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 p-8 text-center shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <p className="text-lg text-red-300">{error || 'Unable to load this page.'}</p>

            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-md bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Go Home
              </Link>
            </div>
          </div>
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

  return (
    <>
      <div className="flex min-h-screen flex-col bg-black text-white">
        <Navbar />

        <main className="flex flex-1 items-center justify-center px-8 pb-4 pt-24">
          <section className="w-full max-w-6xl">
            {syncNotice && (
              <div className="mb-4 rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                {syncNotice}
              </div>
            )}

            {showAutoplayHint && (
              <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                Autoplay was requested. Playback will start after you confirm the notice.
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 p-3 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
              <div className="overflow-hidden rounded-xl border-[1.5px] border-white/10 bg-black/20 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
                <div className="aspect-video w-full bg-black">
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
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-400">
                      Unable to build a valid player URL for this media.
                    </div>
                  )}
                </div>
              </div>
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

      {noticeOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-yellow-500/35 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between border-b border-yellow-500/20 bg-yellow-500/10 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-yellow-400/30 bg-yellow-500/15 text-yellow-200">
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

                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-yellow-300">
                  Important Notice
                </p>
              </div>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <p className="text-sm font-semibold text-yellow-200">
                  1.) Some servers may not be functioning properly, or may be experiencing issues.
                </p>

                <p className="mt-2 text-sm leading-7 text-gray-200">
                  The sources are external (third party) and therefore not affected by KFlix.
                </p>

                <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
                  • If you receive a playback error, try other servers, or try using a VPN and reload the site.
                </div>
              </div>

              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <p className="text-sm font-semibold text-yellow-200">
                  2.) Be aware, using an adblocker like uBlock Origin or similar is highly suggested.
                </p>

                <p className="mt-2 text-sm leading-7 text-gray-200">
                  The embedded players might display pop-up ads or take you to a new site. KFlix is not affiliated with those ads.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleNoticeNotUnderstood}
                  className="flex h-10 items-center justify-center rounded-md bg-black/25 px-4 text-sm font-semibold text-white transition active:scale-95 hover:bg-black/35 hover:shadow-inner hover:shadow-yellow-400/20"
                >
                  I Don’t Understand
                </button>

                <button
                  type="button"
                  onClick={handleNoticeUnderstood}
                  className="flex h-10 items-center justify-center rounded-md bg-yellow-500/80 px-5 text-sm font-semibold text-black transition active:scale-95 hover:bg-yellow-400"
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
    <Suspense fallback={<div className="min-h-screen bg-black text-white" />}>
      <WatchPageContent />
    </Suspense>
  );
}