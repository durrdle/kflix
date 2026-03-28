'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
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

function getEmbedUrl({ type, id, season, episode, startAt = 0, autoPlay = false }) {
  if (!id || !type) return '';

  const params = new URLSearchParams();

  params.set('title', 'true');
  params.set('poster', 'false');
  params.set('autoPlay', autoPlay ? 'true' : 'false');
  params.set('theme', 'E7000B');
  params.set('hideServerControls', 'false');
  params.set('fullscreenButton', 'true');
  params.set('chromecast', 'true');
  params.set('sub', 'en');

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

function getContinueWatchingStorageKey(uid) {
  return `kflix_continue_watching_${uid}`;
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function saveContinueWatchingItem({
  uid,
  type,
  id,
  heroData,
  episodeData,
  season,
  episode,
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
    totalRuntimeSeconds > 0
      ? Math.max(0, totalRuntimeSeconds - watchedSeconds)
      : null;

  const shouldHideBecauseTooEarly = watchedSeconds < MIN_WATCHED_SECONDS;
  const shouldHideBecauseAlmostDone =
    totalRuntimeSeconds > 0 &&
    remainingSeconds !== null &&
    remainingSeconds <= HIDE_WHEN_REMAINING_SECONDS;

  const storageKey = getContinueWatchingStorageKey(uid);

  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];

    const isSameItem = (entry) => {
      if (type === 'movie') {
        return entry.media_type === 'movie' && String(entry.id) === String(id);
      }

      return (
        entry.media_type === 'tv' &&
        String(entry.id) === String(id) &&
        String(entry.season || '') === String(season || '') &&
        String(entry.episode || '') === String(episode || '')
      );
    };

    const filtered = list.filter((entry) => !isSameItem(entry));

    if (shouldHideBecauseTooEarly || shouldHideBecauseAlmostDone) {
      localStorage.setItem(storageKey, JSON.stringify(filtered));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('kflix-continue-watching-updated'));
      return;
    }

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

      season: type === 'tv' ? safeNumber(season, '') : null,
      episode: type === 'tv' ? safeNumber(episode, '') : null,
      episode_name: type === 'tv' ? episodeData?.name || '' : '',
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

    localStorage.setItem(storageKey, JSON.stringify([item, ...filtered].slice(0, 24)));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('kflix-continue-watching-updated'));
  } catch (error) {
    console.error('Failed to save continue watching:', error);
  }
}

function WatchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const playerFrameRef = useRef(null);
  const publishIntervalRef = useRef(null);
  const lastStatusRequestRef = useRef(0);
  const latestPlaybackRef = useRef({ currentTime: 0, isPlaying: false });
  const pendingInitialSyncRef = useRef(null);
  const saveContinueWatchingTimeoutRef = useRef(null);
  const lastRemoteMediaSignatureRef = useRef('');

  const type = searchParams.get('type') || '';
  const id = searchParams.get('id') || '';
  const season = searchParams.get('season') || '';
  const episode = searchParams.get('episode') || '';
  const initialTimeParam = searchParams.get('t') || '';
  const initialAutoplayParam = searchParams.get('autoplay') || '';

  const initialStartTime = Number(initialTimeParam || 0);
  const initialAutoplay = initialAutoplayParam === '1';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [heroData, setHeroData] = useState(null);
  const [episodeData, setEpisodeData] = useState(null);

  const [syncNotice, setSyncNotice] = useState('');
  const [showAutoplayHint, setShowAutoplayHint] = useState(false);

  const [userId, setUserId] = useState('');
  const [partyCode, setPartyCode] = useState('');
  const [members, setMembers] = useState([]);

  const [playerReady, setPlayerReady] = useState(false);
  const [playerCurrentTime, setPlayerCurrentTime] = useState(
    Number.isFinite(initialStartTime) ? Math.max(0, initialStartTime) : 0
  );
  const [playerIsPlaying, setPlayerIsPlaying] = useState(initialAutoplay);

  const [embedState, setEmbedState] = useState({
    startAt: Number.isFinite(initialStartTime) ? Math.max(0, initialStartTime) : 0,
    autoPlay: initialAutoplay,
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
    if (now - lastStatusRequestRef.current < 800) return;

    lastStatusRequestRef.current = now;

    sendPlayerCommand({
      command: 'playerstatus',
    });
  };

  const publishPlaybackState = (currentTimeArg, isPlayingArg) => {
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

    setPartyMedia(partyCode, {
      mediaType: type,
      mediaId: id,
      season: type === 'tv' ? season || null : null,
      episode: type === 'tv' ? episode || null : null,
      currentTime: safeTime,
      isPlaying: safePlaying,
      updatedBy: userId,
    }).catch((partyError) => {
      console.error('Failed to publish host media to party:', partyError);
    });
  };

  const queueSaveContinueWatching = (timeArg, playingArg) => {
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
        season,
        episode,
        currentTime: timeArg,
        isPlaying: playingArg,
      });
    }, 300);
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

  const applyPartyResyncToCurrentPlayer = ({ currentTime, isPlaying }) => {
    const targetTime =
      typeof currentTime === 'number' && Number.isFinite(currentTime)
        ? Math.max(0, currentTime)
        : 0;

    const shouldPlay = Boolean(isPlaying);

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
    }, 150);

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
    const nextStartTime = Number(initialTimeParam || 0);
    const nextAutoplay = initialAutoplayParam === '1';

    const normalizedTime = Number.isFinite(nextStartTime) ? Math.max(0, nextStartTime) : 0;

    setEmbedState({
      startAt: normalizedTime,
      autoPlay: nextAutoplay,
    });

    setPlayerCurrentTime(normalizedTime);
    setPlayerIsPlaying(nextAutoplay);
    latestPlaybackRef.current = {
      currentTime: normalizedTime,
      isPlaying: nextAutoplay,
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
    const handleMessage = (event) => {
      if (!VIDFAST_ORIGINS.includes(event.origin) || !event.data) {
        return;
      }

      if (event.data.type !== 'PLAYER_EVENT') return;

      const payload = event.data.data || {};
      const playerEvent = payload.event;

      const currentTime =
        typeof payload.currentTime === 'number' && Number.isFinite(payload.currentTime)
          ? Math.max(0, payload.currentTime)
          : 0;

      if (playerEvent === 'play') {
        setPlayerCurrentTime(currentTime);
        setPlayerIsPlaying(true);
        latestPlaybackRef.current = {
          currentTime,
          isPlaying: true,
        };

        if (isHost) {
          publishPlaybackState(currentTime, true);
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

        if (isHost) {
          publishPlaybackState(currentTime, false);
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

        if (isHost) {
          publishPlaybackState(currentTime, latestPlaybackRef.current.isPlaying);
        }

        queueSaveContinueWatching(currentTime, latestPlaybackRef.current.isPlaying);
        return;
      }

      if (playerEvent === 'playerstatus') {
        setPlayerReady(true);
        setPlayerCurrentTime(currentTime);

        const playing =
          typeof payload.isPlaying === 'boolean'
            ? payload.isPlaying
            : latestPlaybackRef.current.isPlaying;

        setPlayerIsPlaying(playing);
        latestPlaybackRef.current = {
          currentTime,
          isPlaying: playing,
        };

        if (isHost) {
          publishPlaybackState(currentTime, playing);
        }

        queueSaveContinueWatching(currentTime, playing);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isHost, partyCode, userId, type, id, season, episode, heroData, episodeData]);

  useEffect(() => {
    if (!partyCode || !userId || !isHost || !type || !id) return;

    publishPlaybackState(latestPlaybackRef.current.currentTime, latestPlaybackRef.current.isPlaying);
  }, [partyCode, userId, isHost, type, id, season, episode]);

  useEffect(() => {
    if (publishIntervalRef.current) {
      clearInterval(publishIntervalRef.current);
      publishIntervalRef.current = null;
    }

    if (!partyCode || !userId || !isHost || !playerReady) return;

    publishIntervalRef.current = setInterval(() => {
      requestPlayerStatus();
      publishPlaybackState(
        latestPlaybackRef.current.currentTime,
        latestPlaybackRef.current.isPlaying
      );
    }, 2000);

    return () => {
      if (publishIntervalRef.current) {
        clearInterval(publishIntervalRef.current);
        publishIntervalRef.current = null;
      }
    };
  }, [partyCode, userId, isHost, playerReady, type, id, season, episode]);

  useEffect(() => {
    if (!playerReady || !pendingInitialSyncRef.current) return;

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

      if (pending.isPlaying) {
        sendPlayerCommand({
          command: 'play',
          time: pending.currentTime,
        });
      } else {
        sendPlayerCommand({
          command: 'pause',
          time: pending.currentTime,
        });
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [playerReady, iframeKey]);

  useEffect(() => {
    if (!partyCode || !userId || isHost) return;

    const mediaRef = ref(db, `parties/${partyCode}/media`);

    const unsubscribe = onValue(mediaRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const media = snapshot.val() || {};
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

      const signature = [
        mediaType,
        mediaId,
        mediaSeason,
        mediaEpisode,
        Math.floor(mediaTime),
        mediaPlaying ? '1' : '0',
      ].join('|');

      if (signature === lastRemoteMediaSignatureRef.current) return;
      lastRemoteMediaSignatureRef.current = signature;

      const sameMedia =
        mediaType === type &&
        mediaId === String(id) &&
        (mediaType !== 'tv' ||
          (mediaSeason === String(season || '') &&
            mediaEpisode === String(episode || '')));

      if (!sameMedia) {
        const params = new URLSearchParams();
        params.set('type', mediaType);
        params.set('id', mediaId);
        params.set('t', String(Math.floor(mediaTime)));
        params.set('autoplay', mediaPlaying ? '1' : '0');

        if (mediaType === 'tv') {
          if (mediaSeason) params.set('season', mediaSeason);
          if (mediaEpisode) params.set('episode', mediaEpisode);
        }

        router.push(`/watch?${params.toString()}`);
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
        applyPartyResyncToCurrentPlayer({
          currentTime: mediaTime,
          isPlaying: mediaPlaying,
        });
      }

      setSyncNotice(`Synced to host at ${Math.floor(mediaTime)}s.`);

      setTimeout(() => {
        setSyncNotice('');
      }, 2500);
    });

    return () => unsubscribe();
  }, [partyCode, userId, isHost, router, type, id, season, episode, playerReady]);

  useEffect(() => {
    return () => {
      if (publishIntervalRef.current) {
        clearInterval(publishIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveContinueWatchingTimeoutRef.current) {
        clearTimeout(saveContinueWatchingTimeoutRef.current);
      }
    };
  }, []);

  const handleCastHelp = () => {
    window.alert(
      'To cast to your TV, use the Chromecast icon inside the player when available. If you do not see it, use your browser’s Cast / Cast tab feature.'
    );
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

  return (
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
              Autoplay was requested. Some browsers may still require one click to start playback.
            </div>
          )}

          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="rounded-xl border border-red-500/25 bg-red-600/10 px-4 py-3 text-sm text-red-100">
              Chromecast is available through the player when supported. If you do not see the cast icon, use your browser’s Cast feature.
            </div>

            <button
              type="button"
              onClick={handleCastHelp}
              className="flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60"
            >
              Cast Help
            </button>
          </div>

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
                      }, 500);
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

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white" />}>
      <WatchPageContent />
    </Suspense>
  );
}