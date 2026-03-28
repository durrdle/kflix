'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '@/lib/firebaseParty';
import { ref, get, update, onValue } from 'firebase/database';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/original';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';

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

function getWatchedEpisodesDbRef(userId) {
  return ref(db, `users/${userId}/watchedEpisodes`);
}

function normalizeWatchedMap(value) {
  if (!value || typeof value !== 'object') return {};
  return value;
}

function getContinueWatchingItem(userId, showId) {
  if (!userId || !showId) return null;

  try {
    const raw = localStorage.getItem(`kflix_continue_watching_${userId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];

    const matchingEpisodes = list
      .filter(
        (item) =>
          item &&
          item.media_type === 'tv' &&
          String(item.id) === String(showId) &&
          Number(item.season) > 0 &&
          Number(item.episode) > 0
      )
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    return matchingEpisodes[0] || null;
  } catch {
    return null;
  }
}

function resolveContinueEpisodeTarget(item, seasons) {
  if (!item) return null;

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
                        : 'bg-black/15 text-gray-500 cursor-not-allowed opacity-60'
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
                        : 'bg-black/15 text-gray-500 cursor-not-allowed opacity-60'
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

  const cardsPerPage = 6;
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
                : 'bg-black/15 text-gray-500 cursor-not-allowed opacity-60'
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
            const pageItems = cast.slice(pageIndex * cardsPerPage, pageIndex * cardsPerPage + cardsPerPage);

            return (
              <div key={pageIndex} className="grid min-w-full grid-cols-6 gap-4 px-6 py-5">
                {pageItems.map((person) => (
                  <div key={`${person.id}-${person.cast_id || person.credit_id}`} className="group min-w-0">
                    <div className="relative overflow-hidden rounded-xl border-[1.5px] border-white/10 bg-black/20 transition duration-300 group-hover:border-red-400/80 group-hover:shadow-[0_0_20px_rgba(239,68,68,0.24)]">
                      <div className="aspect-[2/2.55] w-full bg-gray-800">
                        {person.profile_path ? (
                          <img
                            src={`${PROFILE_BASE}${person.profile_path}`}
                            alt={person.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
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
                        {person.name}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-gray-400">
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

function SimilarCarousel({ items, type }) {
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
                : 'bg-black/15 text-gray-500 cursor-not-allowed opacity-60'
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
            const pageItems = items.slice(pageIndex * cardsPerPage, pageIndex * cardsPerPage + cardsPerPage);

            return (
              <div key={pageIndex} className="grid min-w-full grid-cols-6 gap-4 px-6 py-5">
                {pageItems.map((item) => (
                  <Link key={item.id} href={`/${type}/${item.id}`} className="group min-w-0 cursor-pointer">
                    <div className="relative overflow-hidden rounded-xl border-[1.5px] border-white/10 bg-black/20 transition duration-300 group-hover:border-red-400/80 group-hover:shadow-[0_0_24px_rgba(239,68,68,0.28)]">
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
                ))}

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
    if (!userId || !id || !type) {
      setIsInWatchlist(false);
      return;
    }

    try {
      const raw = localStorage.getItem(`kflix_watchlist_${userId}`);
      const parsed = raw ? JSON.parse(raw) : [];
      const exists = parsed.some((item) => String(item.id) === String(id) && item.type === type);
      setIsInWatchlist(exists);
    } catch {
      setIsInWatchlist(false);
    }
  }, [userId, id, type, data]);

  useEffect(() => {
    if (!userId || type !== 'tv' || !id) {
      setWatchedEpisodes({});
      setContinueEpisode(null);
      return;
    }

    const watchedRef = getWatchedEpisodesDbRef(userId);

    const unsubscribe = onValue(watchedRef, (snapshot) => {
      const nextMap = normalizeWatchedMap(snapshot.exists() ? snapshot.val() : {});
      setWatchedEpisodes(nextMap);
    });

    const syncContinueEpisode = () => {
      setContinueEpisode(getContinueWatchingItem(userId, id));
    };

    syncContinueEpisode();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncContinueEpisode();
      }
    };

    window.addEventListener('storage', syncContinueEpisode);
    window.addEventListener('focus', syncContinueEpisode);
    window.addEventListener('kflix-continue-watching-updated', syncContinueEpisode);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(syncContinueEpisode, 1500);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', syncContinueEpisode);
      window.removeEventListener('focus', syncContinueEpisode);
      window.removeEventListener('kflix-continue-watching-updated', syncContinueEpisode);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [userId, type, id]);

  useEffect(() => {
    if (!userId || type !== 'tv' || !id || !continueEpisode) return;

    const syncCompletedEpisodeFromContinueWatching = async () => {
      try {
        const remainingTimeValue = continueEpisode.remainingTime;
        const remainingTime =
          remainingTimeValue === undefined || remainingTimeValue === null
            ? null
            : Number(remainingTimeValue);

        const seasonNumber = Number(continueEpisode.season || 0);
        const episodeNumber = Number(continueEpisode.episode || 0);

        if (
          remainingTime === null ||
          Number.isNaN(remainingTime) ||
          remainingTime > 240 ||
          seasonNumber <= 0 ||
          episodeNumber <= 0
        ) {
          return;
        }

        const key = buildEpisodeKey(id, seasonNumber, episodeNumber);

        if (watchedEpisodes[key]) return;

        const snapshot = await get(getWatchedEpisodesDbRef(userId));
        const existing = normalizeWatchedMap(snapshot.exists() ? snapshot.val() : {});
        const updated = {
          ...existing,
          [key]: true,
        };

        await update(ref(db, `users/${userId}`), {
          watchedEpisodes: updated,
        });
      } catch (syncError) {
        console.error('Failed to sync watched episode:', syncError);
      }
    };

    syncCompletedEpisodeFromContinueWatching();
  }, [userId, type, id, continueEpisode, watchedEpisodes]);

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
    return data.similar.results.filter((item) => item.poster_path).slice(0, 24);
  }, [data]);

  const selectableSeasons = useMemo(() => {
    if (type !== 'tv' || !data?.seasons) return [];
    return data.seasons.filter((season) => season.season_number > 0);
  }, [data, type]);

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

  const handleWatchlistToggle = () => {
    if (!userId || !data) return;

    try {
      const storageKey = `kflix_watchlist_${userId}`;
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];

      const exists = parsed.some((item) => String(item.id) === String(id) && item.type === type);

      if (exists) {
        const updated = parsed.filter(
          (item) => !(String(item.id) === String(id) && item.type === type)
        );
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setIsInWatchlist(false);
      } else {
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

        localStorage.setItem(storageKey, JSON.stringify([watchlistItem, ...parsed]));
        setIsInWatchlist(true);
      }

      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('Watchlist update failed:', error);
    }
  };

  const handleToggleEpisode = async (seasonNumber, episodeNumber) => {
    if (!userId || type !== 'tv') return;

    try {
      const currentMap = normalizeWatchedMap(watchedEpisodes);
      const key = buildEpisodeKey(id, seasonNumber, episodeNumber);
      const updated = { ...currentMap };

      if (updated[key]) {
        delete updated[key];
      } else {
        updated[key] = true;
      }

      await update(ref(db, `users/${userId}`), {
        watchedEpisodes: updated,
      });
    } catch (toggleError) {
      console.error('Failed to toggle episode:', toggleError);
    }
  };

  const handleToggleSeason = async (seasonNumber, episodes) => {
    if (!userId || type !== 'tv' || !Array.isArray(episodes) || !episodes.length) return;

    try {
      const currentMap = normalizeWatchedMap(watchedEpisodes);
      const updated = { ...currentMap };

      const allWatched = episodes.every((episode) =>
        updated[buildEpisodeKey(id, seasonNumber, episode.episode_number)]
      );

      episodes.forEach((episode) => {
        const key = buildEpisodeKey(id, seasonNumber, episode.episode_number);

        if (allWatched) {
          delete updated[key];
        } else {
          updated[key] = true;
        }
      });

      await update(ref(db, `users/${userId}`), {
        watchedEpisodes: updated,
      });
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

                <button
                  type="button"
                  onClick={handleWatchlistToggle}
                  disabled={!userId}
                  className={`flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold text-white transition active:scale-95 ${
                    isInWatchlist
                      ? 'bg-red-600 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60'
                      : 'bg-black/25 backdrop-blur-md hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40'
                  } ${!userId ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                  title={!userId ? 'Sign in to use watchlist' : isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  {isInWatchlist ? (
                    <svg
                      className="h-4 w-4 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M6 4h12a1 1 0 011 1v15l-7-4-7 4V5a1 1 0 011-1z" />
                    </svg>
                  ) : (
                    <svg
                      className="h-4 w-4 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M6 4h12a1 1 0 011 1v15l-7-4-7 4V5a1 1 0 011-1z" />
                    </svg>
                  )}
                  {isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                </button>
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
          <SimilarCarousel items={similarTitles} type={type} />
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