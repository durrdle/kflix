'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '@/lib/firebaseParty';
import { ref, get, update, onValue, set, remove } from 'firebase/database';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/original';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';
const CAST_PLACEHOLDER = '/images/cast-placeholder.webp';

async function fetchDetail(type, id) {
  const res = await fetch(
    `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=videos,credits,similar`
  );

  if (!res.ok) {
    throw new Error('Failed to fetch detail');
  }

  return res.json();
}

async function fetchSeasonDetail(showId, seasonNumber) {
  const res = await fetch(
    `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`
  );

  if (!res.ok) {
    throw new Error('Failed to fetch season details');
  }

  return res.json();
}

function formatRuntime(minutes) {
  if (!minutes || Number.isNaN(minutes)) return 'Unknown';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}

function buildEpisodeKey(showId, seasonNumber, episodeNumber) {
  return `${showId}-S${seasonNumber}-E${episodeNumber}`;
}

function buildContentKey(type, id) {
  return `${type}-${id}`;
}

function getWatchedEpisodesDbRef(userId) {
  return ref(db, `users/${userId}/watchedEpisodes`);
}

function getBookmarksDbRef(userId) {
  return ref(db, `users/${userId}/bookmarks`);
}

function getContinueWatchingItemDbRef(userId, type, id) {
  return ref(db, `users/${userId}/continueWatching/${buildContentKey(type, id)}`);
}

function getManualUnwatchedDbRef(userId, showId) {
  return ref(db, `users/${userId}/manualUnwatched/${showId}`);
}

function normalizeWatchedMap(value) {
  if (!value || typeof value !== 'object') return {};
  return value;
}

function normalizeBookmarkMap(value) {
  if (!value || typeof value !== 'object') return {};
  return value;
}

function normalizeManualUnwatchedSet(value) {
  if (!value || typeof value !== 'object') return new Set();

  const keys = Object.entries(value)
    .filter(([_, included]) => Boolean(included))
    .map(([key]) => key);

  return new Set(keys);
}

function buildManualUnwatchedObject(setValue) {
  return Array.from(setValue).reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
}

function resolveContinueEpisodeTarget(item, seasons) {
  if (!item) return null;

  const explicitNextSeason = Number(item.nextSeason || 0);
  const explicitNextEpisode = Number(item.nextEpisode || 0);

  if (explicitNextSeason > 0 && explicitNextEpisode > 0) {
    return {
      ...item,
      season: explicitNextSeason,
      episode: explicitNextEpisode,
      currentTime: 0,
      remainingTime: null,
    };
  }

  const seasonNumber = Number(item.season || 0);
  const episodeNumber = Number(item.episode || 0);

  if (seasonNumber <= 0 || episodeNumber <= 0) {
    return item;
  }

  const remainingTimeValue = item.remainingTime;
  const remainingTime =
    remainingTimeValue === undefined || remainingTimeValue === null
      ? null
      : Number(remainingTimeValue);

  if (remainingTime === null || Number.isNaN(remainingTime) || remainingTime > 240) {
    return item;
  }

  const normalizedSeasons = Array.isArray(seasons)
    ? [...seasons]
        .filter((season) => Number(season?.season_number) > 0)
        .sort((a, b) => Number(a.season_number) - Number(b.season_number))
    : [];

  const currentSeason = normalizedSeasons.find(
    (season) => Number(season.season_number) === seasonNumber
  );

  const episodeCount = Number(currentSeason?.episode_count || 0);

  if (episodeCount > 0 && episodeNumber < episodeCount) {
    return {
      ...item,
      season: seasonNumber,
      episode: episodeNumber + 1,
      currentTime: 0,
      remainingTime: null,
    };
  }

  const currentSeasonIndex = normalizedSeasons.findIndex(
    (season) => Number(season.season_number) === seasonNumber
  );

  if (currentSeasonIndex >= 0 && currentSeasonIndex < normalizedSeasons.length - 1) {
    const nextSeason = normalizedSeasons[currentSeasonIndex + 1];

    return {
      ...item,
      season: Number(nextSeason.season_number),
      episode: 1,
      currentTime: 0,
      remainingTime: null,
    };
  }

  return {
    ...item,
    currentTime: 0,
  };
}

function compareEpisodeOrder(aSeason, aEpisode, bSeason, bEpisode) {
  const as = Number(aSeason || 0);
  const ae = Number(aEpisode || 0);
  const bs = Number(bSeason || 0);
  const be = Number(bEpisode || 0);

  if (as !== bs) return as - bs;
  return ae - be;
}

function shouldAutoMarkCurrentEpisode(continueEpisode) {
  if (!continueEpisode) return false;

  const seasonNumber = Number(continueEpisode.season || 0);
  const episodeNumber = Number(continueEpisode.episode || 0);

  if (seasonNumber <= 0 || episodeNumber <= 0) {
    return false;
  }

  const explicitNextSeason = Number(continueEpisode.nextSeason || 0);
  const explicitNextEpisode = Number(continueEpisode.nextEpisode || 0);
  const hasExplicitNext =
    explicitNextSeason > 0 &&
    explicitNextEpisode > 0 &&
    (explicitNextSeason !== seasonNumber || explicitNextEpisode !== episodeNumber);

  const remainingTimeValue = continueEpisode.remainingTime;
  const remainingTime =
    remainingTimeValue === undefined || remainingTimeValue === null
      ? null
      : Number(remainingTimeValue);

  const currentTime = Number(continueEpisode.currentTime || 0);

  return (
    hasExplicitNext ||
    (remainingTime !== null &&
      !Number.isNaN(remainingTime) &&
      remainingTime <= 240 &&
      currentTime > 0)
  );
}

function buildEpisodesToAutoMark(showId, seasons, continueEpisode, manualUnwatchedSet) {
  if (!continueEpisode || !shouldAutoMarkCurrentEpisode(continueEpisode)) {
    return [];
  }

  const targetSeason = Number(continueEpisode.season || 0);
  const targetEpisode = Number(continueEpisode.episode || 0);

  if (targetSeason <= 0 || targetEpisode <= 0) {
    return [];
  }

  const normalizedSeasons = Array.isArray(seasons)
    ? [...seasons]
        .filter((season) => Number(season?.season_number) > 0)
        .sort((a, b) => Number(a.season_number) - Number(b.season_number))
    : [];

  const keys = [];

  normalizedSeasons.forEach((season) => {
    const seasonNumber = Number(season?.season_number || 0);
    const episodeCount = Number(season?.episode_count || 0);

    if (seasonNumber <= 0 || episodeCount <= 0) return;

    for (let episodeNumber = 1; episodeNumber <= episodeCount; episodeNumber += 1) {
      const isBeforeOrEqualTarget =
        compareEpisodeOrder(seasonNumber, episodeNumber, targetSeason, targetEpisode) <= 0;

      if (!isBeforeOrEqualTarget) continue;

      const key = buildEpisodeKey(showId, seasonNumber, episodeNumber);

      if (manualUnwatchedSet.has(key)) continue;

      keys.push(key);
    }
  });

  return keys;
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
      className={`pointer-events-auto inline-flex min-h-[28px] min-w-[28px] cursor-pointer items-center justify-center rounded-md border px-2 py-1 text-[10px] font-bold tracking-[0.08em] backdrop-blur-md transition active:scale-95 ${
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

function SimilarCardBadges({ item, isBookmarked, onToggleBookmark }) {
  const tmdbRating =
    typeof item.vote_average === 'number' && item.vote_average > 0
      ? item.vote_average.toFixed(1)
      : null;

  return (
    <>
      <div className="absolute left-2 top-2 z-20 flex flex-col gap-1.5">
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

function TrailerModal({ open, onClose, videoKey, title }) {
  const [playerReady, setPlayerReady] = useState(false);

  useEffect(() => {
    if (!open || !videoKey) return;

    let player;
    let mounted = true;

    const loadPlayer = () => {
      if (!mounted || !window.YT || !window.YT.Player) return;

      player = new window.YT.Player('kflix-trailer-player', {
        videoId: videoKey,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event) => {
            setPlayerReady(true);

            try {
              event.target.unMute();
              event.target.setVolume(40);
              event.target.playVideo();
            } catch (error) {
              console.error('YouTube player setup failed:', error);
            }
          },
        },
      });
    };

    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.id = 'youtube-iframe-api';
      document.body.appendChild(tag);
    }

    const previousHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousHandler === 'function') previousHandler();
      loadPlayer();
    };

    if (window.YT && window.YT.Player) {
      loadPlayer();
    }

    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEsc);

    return () => {
      mounted = false;
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);

      if (player && typeof player.destroy === 'function') {
        player.destroy();
      }
    };
  }, [open, videoKey, onClose]);

  if (!open || !videoKey) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
              Trailer
            </h3>
            <p className="mt-1 text-sm text-gray-300">{title}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/25 text-gray-300 backdrop-blur-md transition active:scale-95 hover:text-white hover:shadow-inner hover:shadow-red-500/50"
            aria-label="Close trailer"
            title="Close trailer"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-white/10 bg-black/30 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
            <div className="aspect-video w-full">
              <div id="kflix-trailer-player" className="h-full w-full" />
            </div>
          </div>

          {!playerReady && <p className="mt-4 text-sm text-gray-400">Loading trailer...</p>}
        </div>
      </div>
    </div>
  );
}

function WatchBadge({ checked, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[28px] min-w-[28px] cursor-pointer items-center justify-center rounded-md border px-2 py-1 text-[10px] font-bold tracking-[0.08em] backdrop-blur-md transition active:scale-95 ${
        checked
          ? 'border-green-400/70 bg-green-600/90 text-white shadow-[0_0_14px_rgba(34,197,94,0.35)] hover:bg-green-700'
          : 'border-white/15 bg-black/65 text-white shadow-[0_0_14px_rgba(0,0,0,0.2)] hover:border-green-400/60 hover:text-green-300'
      }`}
      title={title}
      aria-label={title}
    >
      <svg
        className="h-3.5 w-3.5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect x="5" y="5" width="14" height="14" rx="2" />
        {checked ? <path d="M8 12.5l2.5 2.5L16 9.5" /> : null}
      </svg>
    </button>
  );
}

function BookmarkIconButton({ active, onClick, disabled = false, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-11 w-11 items-center justify-center rounded-md border transition active:scale-95 ${
        active
          ? 'border-red-400/70 bg-red-600/90 text-white shadow-[0_0_14px_rgba(239,68,68,0.35)] hover:bg-red-700'
          : 'border-white/15 bg-black/25 text-white backdrop-blur-md hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40'
      } ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
    >
      <svg
        className="h-4 w-4 flex-shrink-0"
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

function WatchOptionsModal({
  open,
  onClose,
  title,
  showId,
  seasons,
  userId,
  watchedMap,
  onToggleEpisode,
  onToggleSeason,
}) {
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [seasonData, setSeasonData] = useState(null);
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [seasonError, setSeasonError] = useState('');

  const seasonScrollRef = useRef(null);
  const [canScrollSeasonUp, setCanScrollSeasonUp] = useState(false);
  const [canScrollSeasonDown, setCanScrollSeasonDown] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedSeason(null);
      setSeasonData(null);
      setLoadingSeason(false);
      setSeasonError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open || selectedSeason === null) return;

    let active = true;

    const loadSeason = async () => {
      try {
        setLoadingSeason(true);
        setSeasonError('');
        const result = await fetchSeasonDetail(showId, selectedSeason);
        if (active) {
          setSeasonData(result);
        }
      } catch {
        if (active) {
          setSeasonError('Failed to load episodes for this season.');
          setSeasonData(null);
        }
      } finally {
        if (active) {
          setLoadingSeason(false);
        }
      }
    };

    loadSeason();

    return () => {
      active = false;
    };
  }, [open, selectedSeason, showId]);

  useEffect(() => {
    if (!open) return;

    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEsc);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open, onClose]);

  useEffect(() => {
    const el = seasonScrollRef.current;
    if (!el || !open) return;

    const updateButtons = () => {
      setCanScrollSeasonUp(el.scrollTop > 4);
      setCanScrollSeasonDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    };

    updateButtons();
    el.addEventListener('scroll', updateButtons);
    window.addEventListener('resize', updateButtons);

    return () => {
      el.removeEventListener('scroll', updateButtons);
      window.removeEventListener('resize', updateButtons);
    };
  }, [open, seasons]);

  const filteredSeasons = (seasons || []).filter((season) => season.season_number > 0);

  const scrollSeasons = (direction) => {
    const el = seasonScrollRef.current;
    if (!el) return;

    el.scrollBy({
      top: direction === 'up' ? -220 : 220,
      behavior: 'smooth',
    });
  };

  const getEpisodeChecked = (seasonNumber, episodeNumber) =>
    Boolean(watchedMap[buildEpisodeKey(showId, seasonNumber, episodeNumber)]);

  const isSeasonComplete = (seasonNumber, episodes) => {
    if (!episodes?.length) return false;

    return episodes.every((episode) => getEpisodeChecked(seasonNumber, episode.episode_number));
  };

  const getSeasonChecked = (seasonNumber) => {
    if (selectedSeason === seasonNumber && seasonData?.episodes?.length) {
      return isSeasonComplete(seasonNumber, seasonData.episodes);
    }

    const seasonMeta = filteredSeasons.find((entry) => entry.season_number === seasonNumber);
    if (!seasonMeta?.episode_count) return false;

    let checkedCount = 0;

    for (let i = 1; i <= seasonMeta.episode_count; i += 1) {
      if (getEpisodeChecked(seasonNumber, i)) {
        checkedCount += 1;
      }
    }

    return checkedCount > 0 && checkedCount === seasonMeta.episode_count;
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
              Choose Episode
            </h3>
            <p className="mt-1 text-sm text-gray-300">{title}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/25 text-gray-300 backdrop-blur-md transition active:scale-95 hover:text-white hover:shadow-inner hover:shadow-red-500/50"
            aria-label="Close watch options"
            title="Close watch options"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="grid gap-0 md:grid-cols-[280px_1fr]">
          <div className="border-b border-red-500/20 bg-black/20 md:border-b-0 md:border-r">
            <div className="px-5 py-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
                  Seasons
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollSeasons('up')}
                    disabled={!canScrollSeasonUp}
                    className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
                      canScrollSeasonUp
                        ? 'bg-black/25 text-gray-300 cursor-pointer hover:text-white hover:shadow-inner hover:shadow-red-500/60'
                        : 'bg-black/15 text-gray-500 opacity-60'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M6 15l6-6 6 6" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollSeasons('down')}
                    disabled={!canScrollSeasonDown}
                    className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
                      canScrollSeasonDown
                        ? 'bg-black/25 text-gray-300 cursor-pointer hover:text-white hover:shadow-inner hover:shadow-red-500/60'
                        : 'bg-black/15 text-gray-500 opacity-60'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </div>
              </div>

              <div
                ref={seasonScrollRef}
                className="max-h-[420px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {filteredSeasons.length > 0 ? (
                  filteredSeasons.map((season) => {
                    const active = selectedSeason === season.season_number;
                    const seasonChecked = getSeasonChecked(season.season_number);

                    return (
                      <div
                        key={season.id || season.season_number}
                        className={`w-full rounded-xl border px-4 py-3 transition ${
                          active
                            ? 'border-red-400 bg-red-600/15 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.18)]'
                            : 'border-white/10 bg-black/20 text-white hover:border-red-400/60 hover:text-red-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSeason(season.season_number);
                              setSeasonData(null);
                              setSeasonError('');
                            }}
                            className="min-w-0 flex-1 cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <span>{season.name || `Season ${season.season_number}`}</span>
                            </div>
                            <div className="mt-1 text-xs text-gray-400">
                              {season.episode_count || 0} episodes
                            </div>
                          </button>

                          <WatchBadge
                            checked={seasonChecked}
                            title={seasonChecked ? 'Unmark season as watched' : 'Mark season as watched'}
                            onClick={() => {
                              const episodesToToggle =
                                active && seasonData?.episodes?.length
                                  ? seasonData.episodes
                                  : Array.from(
                                      { length: season.episode_count || 0 },
                                      (_, index) => ({
                                        episode_number: index + 1,
                                      })
                                    );

                              onToggleSeason(season.season_number, episodesToToggle);
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-400">No seasons available.</p>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
              Episodes
            </p>

            {!selectedSeason && (
              <div className="flex min-h-[320px] items-center justify-center">
                <p className="text-sm text-gray-400">Pick a season to see the episodes.</p>
              </div>
            )}

            {selectedSeason && loadingSeason && (
              <div className="flex min-h-[320px] items-center justify-center">
                <p className="text-sm text-gray-400">Loading episodes...</p>
              </div>
            )}

            {selectedSeason && seasonError && !loadingSeason && (
              <div className="flex min-h-[320px] items-center justify-center">
                <p className="text-sm text-red-300">{seasonError}</p>
              </div>
            )}

            {selectedSeason && !loadingSeason && !seasonError && seasonData && (
              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {seasonData.episodes?.length > 0 ? (
                  seasonData.episodes.map((episode) => {
                    const watched = getEpisodeChecked(selectedSeason, episode.episode_number);

                    return (
                      <div
                        key={episode.id || episode.episode_number}
                        className="group rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-red-400/70 hover:shadow-[0_0_20px_rgba(239,68,68,0.16)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-2">
                            <WatchBadge
                              checked={watched}
                              title={watched ? 'Unmark episode as watched' : 'Mark episode as watched'}
                              onClick={() => {
                                onToggleEpisode(selectedSeason, episode.episode_number);
                              }}
                            />

                            <Link
                              href={`/watch?type=tv&id=${showId}&season=${selectedSeason}&episode=${episode.episode_number}`}
                              className="min-w-0 block cursor-pointer"
                            >
                              <div className="text-sm font-semibold text-white transition group-hover:text-red-300">
                                Episode {episode.episode_number}: {episode.name}
                              </div>

                              <div className="mt-2 line-clamp-2 text-xs leading-6 text-gray-400">
                                {episode.overview || 'No description available.'}
                              </div>
                            </Link>
                          </div>

                          <div className="flex-shrink-0 text-xs text-gray-400">
                            {episode.runtime ? `${episode.runtime} min` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-400">No episodes found for this season.</p>
                )}
              </div>
            )}

            {userId ? null : (
              <p className="mt-4 text-xs text-gray-500">
                Sign in to sync watched episodes across devices.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CastCarousel({ cast }) {
  const scrollRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);

  const cardsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(cast.length / cardsPerPage));
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

  if (!cast.length) {
    return (
      <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
        <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
          <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
            Full Cast
          </h2>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-400">No cast information available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-6 py-4">
        <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
          Full Cast
        </h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={!canScrollLeft}
            className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
              canScrollLeft
                ? 'bg-black/25 text-gray-300 cursor-pointer hover:text-white hover:shadow-inner hover:shadow-red-500/60'
                : 'bg-black/15 text-gray-500 opacity-60'
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
                ? 'bg-black/25 text-gray-300 cursor-pointer hover:text-white hover:shadow-inner hover:shadow-red-500/60'
                : 'bg-black/15 text-gray-500 opacity-60'
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
            const pageItems = cast.slice(
              pageIndex * cardsPerPage,
              pageIndex * cardsPerPage + cardsPerPage
            );

            return (
              <div
                key={pageIndex}
                className="grid min-w-full grid-cols-2 gap-4 px-6 py-5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10"
              >
                {pageItems.map((person) => (
                  <div key={`${person.id}-${person.cast_id || person.credit_id}`} className="group min-w-0">
                    <div className="relative overflow-hidden rounded-xl border-[1.5px] border-white/10 bg-black/20 transition duration-300 group-hover:border-red-400/80 group-hover:shadow-[0_0_20px_rgba(239,68,68,0.24)]">
                      <div className="aspect-[2/2.6] w-full bg-gray-800">
                        <img
                          src={person.profile_path ? `${PROFILE_BASE}${person.profile_path}` : CAST_PLACEHOLDER}
                          alt={person.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                        />
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="line-clamp-1 text-xs font-medium text-white transition group-hover:text-red-300">
                        {person.name}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] text-gray-400">
                        {person.character || 'Unknown Role'}
                      </div>
                    </div>
                  </div>
                ))}

                {pageItems.length < cardsPerPage &&
                  Array.from({ length: cardsPerPage - pageItems.length }).map((_, fillerIndex) => (
                    <div key={`cast-filler-${fillerIndex}`} />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SimilarCarousel({
  items,
  type,
  bookmarkedIds,
  onToggleBookmark,
}) {
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

  if (!items.length) {
    return (
      <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
        <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
          <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
            Similar {type === 'movie' ? 'Movies' : 'Shows'}
          </h2>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-400">No similar titles available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-6 py-4">
        <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
          Similar {type === 'movie' ? 'Movies' : 'Shows'}
        </h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={!canScrollLeft}
            className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
              canScrollLeft
                ? 'bg-black/25 text-gray-300 cursor-pointer hover:text-white hover:shadow-inner hover:shadow-red-500/60'
                : 'bg-black/15 text-gray-500 opacity-60'
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
                ? 'bg-black/25 text-gray-300 cursor-pointer hover:text-white hover:shadow-inner hover:shadow-red-500/60'
                : 'bg-black/15 text-gray-500 opacity-60'
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
              <div key={pageIndex} className="grid min-w-full grid-cols-6 gap-4 px-6 py-5">
                {pageItems.map((item) => {
                  const bookmarkKey = `${type}-${item.id}`;
                  const isBookmarked = bookmarkedIds.has(bookmarkKey);

                  return (
                    <Link key={item.id} href={`/${type}/${item.id}`} className="group min-w-0 cursor-pointer">
                      <div className="relative overflow-hidden rounded-xl border-[1.5px] border-white/10 bg-black/20 transition duration-300 group-hover:border-red-400/80 group-hover:shadow-[0_0_24px_rgba(239,68,68,0.28)]">
                        <SimilarCardBadges
                          item={item}
                          isBookmarked={isBookmarked}
                          onToggleBookmark={() => onToggleBookmark(item, type)}
                        />

                        <div className="aspect-[2/2.8] w-full bg-gray-800">
                          {item.poster_path ? (
                            <img
                              src={`${POSTER_BASE}${item.poster_path}`}
                              alt={item.title || item.name || 'Poster'}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center px-3 text-center text-xs text-gray-400">
                              No Image
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="line-clamp-1 text-sm font-medium text-white transition group-hover:text-red-300">
                          {item.title || item.name || 'Untitled'}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          {(item.release_date || item.first_air_date || 'Unknown').slice(0, 4)}
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {pageItems.length < cardsPerPage &&
                  Array.from({ length: cardsPerPage - pageItems.length }).map((_, fillerIndex) => (
                    <div key={`similar-filler-${fillerIndex}`} />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DetailPageContent({ id, type }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [watchOptionsOpen, setWatchOptionsOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState({});
  const [continueEpisode, setContinueEpisode] = useState(null);
  const [manualUnwatchedKeys, setManualUnwatchedKeys] = useState(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUserId(currentUser?.uid || '');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const result = await fetchDetail(type, id);
        if (active) {
          setData(result);
        }
      } catch {
        if (active) {
          setError('Failed to load this title.');
        }
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
  }, [id, type]);

  useEffect(() => {
    if (!userId) {
      setIsInWatchlist(false);
      setBookmarkedIds(new Set());
      return;
    }

    const bookmarksRef = getBookmarksDbRef(userId);

    const unsubscribe = onValue(bookmarksRef, (snapshot) => {
      const raw = normalizeBookmarkMap(snapshot.exists() ? snapshot.val() : {});
      const keys = Object.keys(raw);
      const ids = new Set(keys);

      setBookmarkedIds(ids);
      setIsInWatchlist(ids.has(buildContentKey(type, id)));
    });

    return () => unsubscribe();
  }, [userId, id, type]);

  useEffect(() => {
    if (!userId || type !== 'tv' || !id) {
      setWatchedEpisodes({});
      setContinueEpisode(null);
      setManualUnwatchedKeys(new Set());
      return;
    }

    const watchedRef = getWatchedEpisodesDbRef(userId);
    const continueRef = getContinueWatchingItemDbRef(userId, 'tv', id);
    const manualRef = getManualUnwatchedDbRef(userId, id);

    const unsubWatched = onValue(watchedRef, (snapshot) => {
      const nextMap = normalizeWatchedMap(snapshot.exists() ? snapshot.val() : {});
      setWatchedEpisodes(nextMap);
    });

    const unsubContinue = onValue(continueRef, (snapshot) => {
      setContinueEpisode(snapshot.exists() ? snapshot.val() : null);
    });

    const unsubManual = onValue(manualRef, (snapshot) => {
      setManualUnwatchedKeys(
        normalizeManualUnwatchedSet(snapshot.exists() ? snapshot.val() : {})
      );
    });

    return () => {
      unsubWatched();
      unsubContinue();
      unsubManual();
    };
  }, [userId, type, id]);

  const selectableSeasons = useMemo(() => {
    if (type !== 'tv' || !data?.seasons) return [];
    return data.seasons.filter((season) => season.season_number > 0);
  }, [data, type]);

  useEffect(() => {
    if (!userId || type !== 'tv' || !id || !continueEpisode || !selectableSeasons.length) return;

    const syncCompletedEpisodeFromContinueWatching = async () => {
      try {
        const keysToMark = buildEpisodesToAutoMark(
          id,
          selectableSeasons,
          continueEpisode,
          manualUnwatchedKeys
        );

        if (!keysToMark.length) {
          return;
        }

        const snapshot = await get(getWatchedEpisodesDbRef(userId));
        const existing = normalizeWatchedMap(snapshot.exists() ? snapshot.val() : {});
        const updated = { ...existing };

        let changed = false;

        keysToMark.forEach((key) => {
          if (!updated[key]) {
            updated[key] = true;
            changed = true;
          }
        });

        if (!changed) {
          return;
        }

        await update(ref(db, `users/${userId}`), {
          watchedEpisodes: updated,
        });
      } catch (syncError) {
        console.error('Failed to sync watched episode chain:', syncError);
      }
    };

    syncCompletedEpisodeFromContinueWatching();
  }, [userId, type, id, continueEpisode, selectableSeasons, manualUnwatchedKeys]);

  const title = useMemo(() => {
    if (!data) return '';
    return type === 'movie' ? data.title : data.name;
  }, [data, type]);

  const releaseYear = useMemo(() => {
    if (!data) return '';
    const raw = type === 'movie' ? data.release_date : data.first_air_date;
    return raw ? raw.slice(0, 4) : 'Unknown';
  }, [data, type]);

  const runtimeText = useMemo(() => {
    if (!data) return 'Unknown';
    if (type === 'movie') return formatRuntime(data.runtime);
    if (data.episode_run_time?.length) return `${data.episode_run_time[0]} min / ep`;
    return 'Unknown';
  }, [data, type]);

  const trailer = useMemo(() => {
    if (!data?.videos?.results) return null;

    return (
      data.videos.results.find(
        (video) =>
          video.site === 'YouTube' &&
          video.type === 'Trailer' &&
          video.official !== false
      ) ||
      data.videos.results.find(
        (video) => video.site === 'YouTube' && video.type === 'Trailer'
      ) ||
      data.videos.results.find((video) => video.site === 'YouTube') ||
      null
    );
  }, [data]);

  const cast = useMemo(() => {
    if (!data?.credits?.cast) return [];
    return data.credits.cast.slice(0, 24);
  }, [data]);

  const similarTitles = useMemo(() => {
    if (!data?.similar?.results) return [];

    return data.similar.results
      .filter((item) => item && item.id && item.poster_path)
      .filter((item) => String(item.id) !== String(id))
      .slice(0, 24);
  }, [data, id]);

  const resolvedContinueEpisode = useMemo(() => {
    if (type !== 'tv' || !continueEpisode) return null;
    return resolveContinueEpisodeTarget(continueEpisode, selectableSeasons);
  }, [type, continueEpisode, selectableSeasons]);

  const continueSeasonHref = useMemo(() => {
    if (type !== 'tv' || !resolvedContinueEpisode) return '';

    return `/watch?type=tv&id=${id}&season=${resolvedContinueEpisode.season}&episode=${resolvedContinueEpisode.episode}${
      resolvedContinueEpisode.currentTime
        ? `&t=${Math.floor(Number(resolvedContinueEpisode.currentTime) || 0)}`
        : ''
    }&autoplay=1`;
  }, [type, resolvedContinueEpisode, id]);

  const handleWatchlistToggle = async () => {
    if (!userId || !data) return;

    try {
      const key = buildContentKey(type, id);
      const itemRef = ref(db, `users/${userId}/bookmarks/${key}`);

      if (isInWatchlist) {
        await remove(itemRef);
        return;
      }

      const watchlistItem = {
        id: data.id,
        type,
        media_type: type,
        title: data.title || data.name || 'Untitled',
        name: data.name || data.title || 'Untitled',
        poster_path: data.poster_path || null,
        backdrop_path: data.backdrop_path || null,
        release_date: data.release_date || null,
        first_air_date: data.first_air_date || null,
        vote_average: data.vote_average ?? null,
        addedAt: Date.now(),
      };

      await set(itemRef, watchlistItem);
    } catch (error) {
      console.error('Watchlist update failed:', error);
    }
  };

  const handleToggleSimilarBookmark = async (item, mediaType) => {
    if (!userId || !item?.id) return;

    try {
      const key = buildContentKey(mediaType, item.id);
      const itemRef = ref(db, `users/${userId}/bookmarks/${key}`);
      const exists = bookmarkedIds.has(key);

      if (exists) {
        await remove(itemRef);
        return;
      }

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

      await set(itemRef, watchlistItem);
    } catch (error) {
      console.error('Similar bookmark toggle failed:', error);
    }
  };

  const handleToggleEpisode = async (seasonNumber, episodeNumber) => {
    if (!userId || type !== 'tv') return;

    try {
      const currentMap = normalizeWatchedMap(watchedEpisodes);
      const key = buildEpisodeKey(id, seasonNumber, episodeNumber);
      const updated = { ...currentMap };
      const manualSet = new Set(manualUnwatchedKeys);

      if (updated[key]) {
        delete updated[key];
        manualSet.add(key);
      } else {
        updated[key] = true;
        manualSet.delete(key);
      }

      await update(ref(db, `users/${userId}`), {
        watchedEpisodes: updated,
      });

      const manualRef = getManualUnwatchedDbRef(userId, id);
      if (manualSet.size > 0) {
        await set(manualRef, buildManualUnwatchedObject(manualSet));
      } else {
        await remove(manualRef);
      }
    } catch (toggleError) {
      console.error('Failed to toggle episode:', toggleError);
    }
  };

  const handleToggleSeason = async (seasonNumber, episodes) => {
    if (!userId || type !== 'tv' || !Array.isArray(episodes) || !episodes.length) return;

    try {
      const currentMap = normalizeWatchedMap(watchedEpisodes);
      const updated = { ...currentMap };
      const manualSet = new Set(manualUnwatchedKeys);

      const allWatched = episodes.every((episode) =>
        updated[buildEpisodeKey(id, seasonNumber, episode.episode_number)]
      );

      episodes.forEach((episode) => {
        const key = buildEpisodeKey(id, seasonNumber, episode.episode_number);

        if (allWatched) {
          delete updated[key];
          manualSet.add(key);
        } else {
          updated[key] = true;
          manualSet.delete(key);
        }
      });

      await update(ref(db, `users/${userId}`), {
        watchedEpisodes: updated,
      });

      const manualRef = getManualUnwatchedDbRef(userId, id);
      if (manualSet.size > 0) {
        await set(manualRef, buildManualUnwatchedObject(manualSet));
      } else {
        await remove(manualRef);
      }
    } catch (toggleError) {
      console.error('Failed to toggle season:', toggleError);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <main className="px-8 pb-10 pt-24">
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 p-10 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <p className="text-lg text-gray-300">Loading details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <main className="px-8 pb-10 pt-24">
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 p-10 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <p className="text-lg text-red-300">{error || 'Title not found.'}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="px-8 pb-10 pt-24">
        <section className="relative overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          {data.backdrop_path && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${BACKDROP_BASE}${data.backdrop_path})`,
              }}
            />
          )}

          <div className="absolute inset-0 bg-black/70" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.12),transparent_35%)]" />

          <div className="relative z-10 grid gap-8 px-8 py-8 lg:grid-cols-[300px_1fr]">
            <div className="mx-auto w-full max-w-[300px]">
              <div className="overflow-hidden rounded-2xl border-[1.5px] border-white/10 bg-black/20 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
                {data.poster_path ? (
                  <img
                    src={`${POSTER_BASE}${data.poster_path}`}
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
                {type === 'movie' ? 'Movie' : 'TV Show'}
              </div>

              <h1 className="mt-4 text-4xl font-bold md:text-6xl">{title}</h1>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-300">
                <span>{releaseYear}</span>
                <span className="text-red-400">•</span>
                <span>{runtimeText}</span>
                <span className="text-red-400">•</span>
                <span>{data.vote_average ? `${data.vote_average.toFixed(1)}/10` : 'No rating'}</span>
              </div>

              {data.genres?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.genres.map((genre) => (
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
                {type === 'movie' ? (
                  <Link href={`/watch?type=movie&id=${id}`} className="cursor-pointer">
                    <span className="flex h-11 items-center justify-center gap-2 rounded-md bg-red-600 px-5 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60">
                      <svg
                        className="h-4 w-4 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M8 5.5v13l10-6.5-10-6.5z" />
                      </svg>
                      Watch
                    </span>
                  </Link>
                ) : (
                  <>
                    {continueSeasonHref ? (
                      <Link href={continueSeasonHref} className="cursor-pointer">
                        <span className="flex h-11 items-center justify-center gap-2 rounded-md bg-red-600 px-5 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60">
                          <svg
                            className="h-4 w-4 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path d="M8 5.5v13l10-6.5-10-6.5z" />
                          </svg>
                          Continue Season
                        </span>
                      </Link>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setWatchOptionsOpen(true)}
                      className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-red-600 px-5 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60"
                    >
                      <svg
                        className="h-4 w-4 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M8 5.5v13l10-6.5-10-6.5z" />
                      </svg>
                      {continueSeasonHref ? 'Browse Episodes' : 'Watch'}
                    </button>
                  </>
                )}

                {trailer && (
                  <button
                    type="button"
                    onClick={() => setTrailerOpen(true)}
                    className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-red-600 px-5 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60"
                  >
                    <svg
                      className="h-4 w-4 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M8 5.5v13l10-6.5-10-6.5z" />
                    </svg>
                    Watch Trailer
                  </button>
                )}

                <BookmarkIconButton
                  active={isInWatchlist}
                  onClick={handleWatchlistToggle}
                  disabled={!userId}
                  title={
                    !userId
                      ? 'Sign in to use watchlist'
                      : isInWatchlist
                        ? 'Remove from watchlist'
                        : 'Add to watchlist'
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
              <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                Overview
              </h2>
            </div>

            <div className="px-6 py-5">
              <p className="line-clamp-5 text-sm leading-7 text-gray-200 md:text-base">
                {data.overview || 'No overview available.'}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
              <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                Details
              </h2>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400">Original Title</p>
                <p className="mt-2 text-base text-white">
                  {data.original_title || data.original_name || 'Unknown'}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400">Language</p>
                <p className="mt-2 text-base text-white">
                  {data.original_language?.toUpperCase() || 'Unknown'}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400">Status</p>
                <p className="mt-2 text-base text-white">{data.status || 'Unknown'}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400">
                  {type === 'movie' ? 'Runtime' : 'Episode Runtime'}
                </p>
                <p className="mt-2 text-base text-white">{runtimeText}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <CastCarousel cast={cast} />
        </section>

        <section className="mt-8">
          <SimilarCarousel
            items={similarTitles}
            type={type}
            bookmarkedIds={bookmarkedIds}
            onToggleBookmark={handleToggleSimilarBookmark}
          />
        </section>
      </main>

      <TrailerModal
        open={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        videoKey={trailer?.key}
        title={title}
      />

      <WatchOptionsModal
        open={watchOptionsOpen}
        onClose={() => setWatchOptionsOpen(false)}
        title={title}
        showId={id}
        seasons={selectableSeasons}
        userId={userId}
        watchedMap={watchedEpisodes}
        onToggleEpisode={handleToggleEpisode}
        onToggleSeason={handleToggleSeason}
      />

      <footer className="px-8 pb-8 pt-2 text-center text-sm text-gray-400">
        <p>This site does not host or store any media.</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
          
        </div>
      </footer>
    </div>
  );
}