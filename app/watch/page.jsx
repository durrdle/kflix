// app/watch/page.jsx

'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/original';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

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

function getBestYoutubeVideo(videos = []) {
  if (!Array.isArray(videos) || videos.length === 0) return null;

  return (
    videos.find(
      (video) =>
        video.site === 'YouTube' &&
        video.type === 'Trailer' &&
        video.official !== false
    ) ||
    videos.find((video) => video.site === 'YouTube' && video.type === 'Trailer') ||
    videos.find((video) => video.site === 'YouTube' && video.type === 'Teaser') ||
    videos.find((video) => video.site === 'YouTube' && video.type === 'Clip') ||
    videos.find((video) => video.site === 'YouTube') ||
    null
  );
}

function formatRuntime(minutes) {
  if (!minutes || Number.isNaN(minutes)) return 'Unknown';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}

function getEmbedUrl({ activePlayer, type, id, season, episode, videoKey }) {
  if (!id || !type) return '';

  const isMovie = type === 'movie';
  const isTv = type === 'tv';

  if (activePlayer === 'player1') {
    if (isMovie) {
      return `https://vidlink.pro/movie/${id}`;
    }

    if (isTv) {
      if (season && episode) {
        return `https://vidlink.pro/tv/${id}/${season}/${episode}`;
      }

      return `https://vidlink.pro/tv/${id}`;
    }

    return '';
  }

  if (activePlayer === 'player2') {
    if (isMovie) {
      return `https://vidsrc-embed.ru/embed/movie/${id}`;
    }

    if (isTv) {
      if (season && episode) {
        return `https://vidsrc-embed.ru/embed/tv/${id}/${season}/${episode}`;
      }

      return `https://vidsrc-embed.ru/embed/tv/${id}`;
    }

    return '';
  }

  if (activePlayer === 'player3') {
    if (isMovie) {
      return `https://www.vidking.net/embed/movie/${id}`;
    }

    if (isTv) {
      if (season && episode) {
        return `https://www.vidking.net/embed/tv/${id}/${season}/${episode}`;
      }

      return `https://www.vidking.net/embed/tv/${id}`;
    }

    return '';
  }

  return '';
}

function WatchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const type = searchParams.get('type') || '';
  const id = searchParams.get('id') || '';
  const season = searchParams.get('season') || '';
  const episode = searchParams.get('episode') || '';
  const initialTimeParam = searchParams.get('t') || '';
  const initialAutoplayParam = searchParams.get('autoplay') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [heroData, setHeroData] = useState(null);
  const [episodeData, setEpisodeData] = useState(null);
  const [video, setVideo] = useState(null);
  const [activePlayer, setActivePlayer] = useState('player1');
  const [syncNotice, setSyncNotice] = useState('');
  const [pendingSync, setPendingSync] = useState(null);

  const playerFrameRef = useRef(null);

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
        setVideo(null);

        if (type === 'movie') {
          const movie = await fetchMovieDetail(id);
          if (!active) return;

          setHeroData(movie);
          setVideo(getBestYoutubeVideo(movie?.videos?.results || []));
        } else if (type === 'tv') {
          const [show, ep] = await Promise.all([
            fetchTvDetail(id),
            season && episode ? fetchEpisodeDetail(id, season, episode) : Promise.resolve(null),
          ]);

          if (!active) return;

          setHeroData(show);
          setEpisodeData(ep);

          const episodeVideo = getBestYoutubeVideo(ep?.videos?.results || []);
          const showVideo = getBestYoutubeVideo(show?.videos?.results || []);

          setVideo(episodeVideo || showVideo || null);
        } else {
          throw new Error('Unsupported type.');
        }
      } catch (err) {
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
    const startTime = Number(initialTimeParam || 0);
    const shouldAutoplay = initialAutoplayParam === '1';

    if (!initialTimeParam && !initialAutoplayParam) return;

    setPendingSync({
      currentTime: Number.isFinite(startTime) ? startTime : 0,
      isPlaying: shouldAutoplay,
      source: 'query',
    });

    setSyncNotice(
      `Synced to host${Number.isFinite(startTime) ? ` at ${Math.max(0, Math.floor(startTime))}s` : ''}.`
    );

    const timeout = setTimeout(() => {
      setSyncNotice('');
    }, 2500);

    return () => clearTimeout(timeout);
  }, [initialTimeParam, initialAutoplayParam]);

  useEffect(() => {
    const handlePartyResync = (event) => {
      const detail = event.detail || {};
      const targetTime =
        typeof detail.currentTime === 'number' && Number.isFinite(detail.currentTime)
          ? Math.max(0, detail.currentTime)
          : 0;
      const shouldPlay = Boolean(detail.isPlaying);

      const incomingType = detail.mediaType ? String(detail.mediaType) : '';
      const incomingId = detail.mediaId ? String(detail.mediaId) : '';
      const incomingSeason =
        detail.season !== undefined && detail.season !== null ? String(detail.season) : '';
      const incomingEpisode =
        detail.episode !== undefined && detail.episode !== null ? String(detail.episode) : '';

      const sameMedia =
        incomingType === type &&
        incomingId === id &&
        (incomingType !== 'tv' ||
          (incomingSeason === String(season || '') &&
            incomingEpisode === String(episode || '')));

      if (!sameMedia) {
        const nextParams = new URLSearchParams();
        nextParams.set('type', incomingType);
        nextParams.set('id', incomingId);
        nextParams.set('t', String(Math.floor(targetTime)));
        nextParams.set('autoplay', shouldPlay ? '1' : '0');

        if (incomingType === 'tv') {
          if (incomingSeason) nextParams.set('season', incomingSeason);
          if (incomingEpisode) nextParams.set('episode', incomingEpisode);
        }

        router.push(`/watch?${nextParams.toString()}`);
        return;
      }

      setPendingSync({
        currentTime: targetTime,
        isPlaying: shouldPlay,
        source: 'event',
      });

      setSyncNotice(`Synced to host at ${Math.floor(targetTime)}s.`);

      setTimeout(() => {
        setSyncNotice('');
      }, 2500);
    };

    window.addEventListener('kflix-party-resync', handlePartyResync);

    return () => {
      window.removeEventListener('kflix-party-resync', handlePartyResync);
    };
  }, [router, type, id, season, episode]);

  useEffect(() => {
    if (!pendingSync) return;

    const frame = playerFrameRef.current;
    if (!frame) return;

    console.log('Apply sync to player here:', pendingSync);

    // Example area for future player-specific sync logic:
    // - YouTube iframe API: seekTo(pendingSync.currentTime), playVideo()/pauseVideo()
    // - Other providers: use their own postMessage / SDK methods

    setPendingSync(null);
  }, [pendingSync]);

  const title = useMemo(() => {
    if (type === 'movie') {
      return heroData?.title || 'Movie';
    }

    if (type === 'tv' && episodeData) {
      return episodeData.name || heroData?.name || 'Episode';
    }

    return heroData?.name || 'Watch';
  }, [type, heroData, episodeData]);

  const subtitle = useMemo(() => {
    if (type === 'movie') {
      const year = heroData?.release_date ? heroData.release_date.slice(0, 4) : 'Unknown';
      const runtime = heroData?.runtime ? formatRuntime(heroData.runtime) : 'Unknown';
      return `${year} • ${runtime}`;
    }

    if (type === 'tv') {
      const year = heroData?.first_air_date ? heroData.first_air_date.slice(0, 4) : 'Unknown';
      const runtime = heroData?.episode_run_time?.[0]
        ? `${heroData.episode_run_time[0]} min / ep`
        : 'Unknown';

      if (season && episode) {
        return `S${String(season).padStart(2, '0')} • E${String(episode).padStart(2, '0')} • ${year} • ${runtime}`;
      }

      return `${year} • ${runtime}`;
    }

    return '';
  }, [type, heroData, season, episode]);

  const overview = useMemo(() => {
    if (type === 'tv' && episodeData?.overview) return episodeData.overview;
    return heroData?.overview || 'No overview available.';
  }, [type, heroData, episodeData]);

  const backdropPath = episodeData?.still_path || heroData?.backdrop_path || null;
  const posterPath = heroData?.poster_path || null;
  const rating = heroData?.vote_average ? `${heroData.vote_average.toFixed(1)}/10` : 'No rating';
  const releaseYear =
    type === 'movie'
      ? heroData?.release_date?.slice(0, 4) || 'Unknown'
      : heroData?.first_air_date?.slice(0, 4) || 'Unknown';

  const embedUrl = getEmbedUrl({
    activePlayer,
    type,
    id,
    season,
    episode,
    videoKey: video?.key || '',
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Suspense fallback={<div className="h-20" />}>
  <Navbar />
</Suspense>
        <main className="px-8 pb-10 pt-24">
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 p-10 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <p className="text-lg text-gray-300">Loading watch page...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !heroData) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Suspense fallback={<div className="h-20" />}>
  <Navbar />
</Suspense>
        <main className="px-8 pb-10 pt-24">
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 p-10 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Suspense fallback={<div className="h-20" />}>
  <Navbar />
</Suspense>

      <main className="px-8 pb-10 pt-24">
        <section className="relative overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          {backdropPath && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${BACKDROP_BASE}${backdropPath})`,
              }}
            />
          )}

          <div className="absolute inset-0 bg-black/75" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.14),transparent_35%)]" />

          <div className="relative z-10 grid gap-8 px-8 py-8 lg:grid-cols-[300px_1fr]">
            <div className="mx-auto w-full max-w-[300px]">
              <div className="overflow-hidden rounded-2xl border-[1.5px] border-white/10 bg-black/20 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
                {posterPath ? (
                  <img
                    src={`${POSTER_BASE}${posterPath}`}
                    alt={title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[2/3] items-center justify-center bg-gray-800 text-sm text-gray-400">
                    No Poster
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-end">
              <div className="inline-flex w-fit rounded-full border border-red-500/30 bg-red-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
                {type === 'movie' ? 'Movie Watch Page' : 'Episode Watch Page'}
              </div>

              <h1 className="mt-4 text-4xl font-bold md:text-6xl">{title}</h1>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-300">
                <span>{releaseYear}</span>
                <span className="text-red-400">•</span>
                <span>{subtitle}</span>
                <span className="text-red-400">•</span>
                <span>{rating}</span>
              </div>

              {heroData?.genres?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {heroData.genres.map((genre) => (
                    <span
                      key={genre.id}
                      className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-gray-200"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={type === 'movie' ? `/movie/${id}` : `/tv/${id}`}
                  className="flex h-11 items-center justify-center gap-2 rounded-md bg-red-600 px-5 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60"
                >
                  <svg
                    className="h-4 w-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Details
                </Link>

                {type === 'tv' && (
                  <Link
                    href={`/watch?type=tv&id=${id}`}
                    className="flex h-11 items-center justify-center gap-2 rounded-md bg-black/25 px-5 text-sm font-semibold text-white backdrop-blur-md transition active:scale-95 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40"
                  >
                    Show Trailer
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                Player
              </h2>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActivePlayer('player1')}
                  className={`h-10 rounded-md px-4 text-sm font-semibold transition active:scale-95 ${
                    activePlayer === 'player1'
                      ? 'bg-red-600 text-white shadow-inner shadow-red-500/60'
                      : 'bg-black/25 text-gray-200 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40'
                  }`}
                >
                  Player 1
                </button>

                <button
                  type="button"
                  onClick={() => setActivePlayer('player2')}
                  className={`h-10 rounded-md px-4 text-sm font-semibold transition active:scale-95 ${
                    activePlayer === 'player2'
                      ? 'bg-red-600 text-white shadow-inner shadow-red-500/60'
                      : 'bg-black/25 text-gray-200 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40'
                  }`}
                >
                  Player 2
                </button>

                <button
                  type="button"
                  onClick={() => setActivePlayer('player3')}
                  className={`h-10 rounded-md px-4 text-sm font-semibold transition active:scale-95 ${
                    activePlayer === 'player3'
                      ? 'bg-red-600 text-white shadow-inner shadow-red-500/60'
                      : 'bg-black/25 text-gray-200 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40'
                  }`}
                >
                  Player 3
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            {syncNotice && (
              <div className="mx-auto mb-4 max-w-4xl rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                {syncNotice}
              </div>
            )}

            <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border-[1.5px] border-white/10 bg-black/30 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
              <div className="aspect-video w-full">
                {embedUrl ? (
                  <iframe
                    ref={playerFrameRef}
                    src={embedUrl}
                    title={`${title} - ${activePlayer}`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-400">
                    Selected player is not configured yet.
                  </div>
                )}
              </div>
            </div>

            <div className="mx-auto mt-4 max-w-4xl rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-400">
              Active source:{' '}
              <span className="font-medium text-white">
                {activePlayer === 'player1'
                  ? 'Player 1'
                  : activePlayer === 'player2'
                  ? 'Player 2'
                  : 'Player 3'}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
              <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                Overview
              </h2>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm leading-7 text-gray-200 md:text-base">{overview}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
              <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                Player Details
              </h2>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400">Title</p>
                <p className="mt-2 text-base text-white">{title}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400">Type</p>
                <p className="mt-2 text-base text-white">
                  {type === 'movie' ? 'Movie' : 'TV Show'}
                </p>
              </div>

              {type === 'tv' && season && episode && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-red-400">Episode</p>
                  <p className="mt-2 text-base text-white">
                    Season {season}, Episode {episode}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400">
                  Selected Player
                </p>
                <p className="mt-2 text-base text-white">
                  {activePlayer === 'player1'
                    ? 'Player 1'
                    : activePlayer === 'player2'
                    ? 'Player 2'
                    : 'Player 3'}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400">
                  Sync Params
                </p>
                <p className="mt-2 text-base text-white">
                  t={initialTimeParam || '0'} • autoplay={initialAutoplayParam || '0'}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400">
                  Fallback TMDB Video
                </p>
                <p className="mt-2 text-base text-white">
                  {video?.name || 'No TMDB video found'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-8 pb-8 pt-2 text-center text-sm text-gray-400">
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>

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