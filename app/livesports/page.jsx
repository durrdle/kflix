'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';

const LIVE_SPORTS_PLACEHOLDER = '/images/livesports-placeholder.webp';

function formatMatchDateParts(dateValue) {
  if (!dateValue) {
    return {
      uk: 'Time unavailable',
      cet: 'Time unavailable',
      local: 'Time unavailable',
      localZone: 'Local',
    };
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return {
      uk: 'Time unavailable',
      cet: 'Time unavailable',
      local: 'Time unavailable',
      localZone: 'Local',
    };
  }

  const uk = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(date);

  const cet = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(date);

  const local = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);

  const localZone =
    new Intl.DateTimeFormat(undefined, {
      timeZoneName: 'short',
    })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value || 'Local';

  return {
    uk,
    cet,
    local,
    localZone,
  };
}

function getTeamName(team) {
  if (!team) return '';
  return team.name || team.title || team.shortName || '';
}

function getBadgeUrl(badgeId) {
  if (!badgeId || typeof badgeId !== 'string') return null;
  return `https://streamed.pk/api/images/badge/${badgeId}.webp`;
}

function getPosterUrl(match) {
  if (!match?.poster || typeof match.poster !== 'string') return null;

  if (match.poster.startsWith('http://') || match.poster.startsWith('https://')) {
    return match.poster;
  }

  if (match.poster.startsWith('/')) {
    return `https://streamed.pk${match.poster}.webp`;
  }

  return `https://streamed.pk/api/images/proxy/${match.poster}.webp`;
}

function getMatchTitle(match) {
  if (match.title) return match.title;

  const homeName = getTeamName(match.teams?.home);
  const awayName = getTeamName(match.teams?.away);

  if (homeName && awayName) {
    return `${homeName} vs ${awayName}`;
  }

  return 'Untitled Match';
}

function getMatchSubtitle(match) {
  return (
    match.category ||
    match.sport ||
    match.league ||
    match.competition ||
    'Live Sports'
  );
}

function getMatchStatus(match) {
  if (match.status) return String(match.status).toUpperCase();
  if (match.live === true || match.is_live === true) return 'LIVE';
  return 'SCHEDULED';
}

function getSourceLinks(match) {
  if (Array.isArray(match.sources)) return match.sources;
  return [];
}

function safeSerializeSources(sources) {
  try {
    return encodeURIComponent(JSON.stringify(Array.isArray(sources) ? sources : []));
  } catch {
    return encodeURIComponent('[]');
  }
}

function normalizeSportItem(item, index) {
  if (!item) {
    return {
      id: `sport-${index}`,
      slug: '',
      label: `Sport ${index + 1}`,
    };
  }

  if (typeof item === 'string') {
    return {
      id: item,
      slug: item,
      label: item.charAt(0).toUpperCase() + item.slice(1),
    };
  }

  const slug =
    item.slug ||
    item.id ||
    item.key ||
    item.name ||
    item.title ||
    '';

  const label =
    item.name ||
    item.title ||
    item.label ||
    (typeof slug === 'string' && slug
      ? slug.charAt(0).toUpperCase() + slug.slice(1)
      : `Sport ${index + 1}`);

  return {
    id: item.id || item.slug || item.key || `sport-${index}`,
    slug: String(slug || '').trim(),
    label,
  };
}

function LiveSportsPageContent() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [sports, setSports] = useState([]);
  const [error, setError] = useState('');
  const [activeSport, setActiveSport] = useState('live');
  const [notice, setNotice] = useState('');

  const activeSportLabel = useMemo(() => {
    if (activeSport === 'live') return 'Live Now';

    const match = sports.find((sport) => sport.slug === activeSport);
    return match?.label || 'Live Now';
  }, [activeSport, sports]);

  useEffect(() => {
    const rawNotice = searchParams.get('notice') || '';
    const title = searchParams.get('title') || '';

    if (rawNotice === 'no-working-server') {
      setNotice(
        title
          ? `No working server was found for "${title}".`
          : 'No working server was found for that live event.'
      );
      return;
    }

    setNotice('');
  }, [searchParams]);

  useEffect(() => {
    if (!notice) return;

    const timeout = setTimeout(() => {
      setNotice('');
    }, 5000);

    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;

    const loadSports = async () => {
      try {
        setSportsLoading(true);

        const res = await fetch('/api/livesports/sports', {
          cache: 'no-store',
        });

        const payload = await res.json();

        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Failed to load sports categories');
        }

        const rawSports = Array.isArray(payload?.data) ? payload.data : [];
        const normalizedSports = rawSports
          .map((item, index) => normalizeSportItem(item, index))
          .filter((item) => item.slug);

        if (!cancelled) {
          setSports(normalizedSports);
        }
      } catch {
        if (!cancelled) {
          setSports([]);
        }
      } finally {
        if (!cancelled) {
          setSportsLoading(false);
        }
      }
    };

    loadSports();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMatches = async () => {
      try {
        setLoading(true);
        setError('');

        const endpoint =
          activeSport === 'live'
            ? 'matches/live'
            : `matches/${encodeURIComponent(activeSport)}`;

        const res = await fetch(`/api/livesports?endpoint=${endpoint}`, {
          cache: 'no-store',
        });

        const payload = await res.json();

        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Failed to load matches');
        }

        const rawData = payload?.data;
        const list = Array.isArray(rawData) ? rawData : [];

        if (!cancelled) {
          setMatches(list);
        }
      } catch (err) {
        if (!cancelled) {
          setMatches([]);
          setError(err instanceof Error ? err.message : 'Failed to load live sports.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMatches();

    return () => {
      cancelled = true;
    };
  }, [activeSport]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="px-8 pb-10 pt-24">
        {notice && (
          <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            {notice}
          </div>
        )}

        <section className="relative overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.16),transparent_36%)]" />

          <div className="relative z-10 px-8 py-10">
            <div className="inline-flex w-fit rounded-full border border-red-500/30 bg-red-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
              Live Sports
            </div>

            <h1 className="mt-4 text-4xl font-bold md:text-6xl">
              Watch Live Sports
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-200 md:text-base">
              Anything from Football to Motor Sports & Fights.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSport('live')}
                className={`rounded-md border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                  activeSport === 'live'
                    ? 'border-red-400 bg-red-600/15 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.18)]'
                    : 'border-white/10 bg-black/20 text-white hover:border-red-400/60 hover:text-red-300'
                }`}
              >
                Live Now
              </button>

              {sports.map((sport) => {
                const active = activeSport === sport.slug;

                return (
                  <button
                    key={sport.id}
                    type="button"
                    onClick={() => setActiveSport(sport.slug)}
                    className={`rounded-md border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                      active
                        ? 'border-red-400 bg-red-600/15 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.18)]'
                        : 'border-white/10 bg-black/20 text-white hover:border-red-400/60 hover:text-red-300'
                    }`}
                  >
                    {sport.label}
                  </button>
                );
              })}

              {sportsLoading && (
                <div className="rounded-md border border-white/10 bg-black/20 px-4 py-2 text-sm text-gray-400">
                  Loading sports...
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between border-b border-red-500/25 bg-red-600/10 px-6 py-4">
              <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                {activeSport === 'live' ? 'Live Now' : `${activeSportLabel} Live Now`}
              </h2>

              <span className="text-sm text-gray-300">
                {loading ? 'Loading...' : `${matches.length} matches`}
              </span>
            </div>

            {loading ? (
              <div className="px-6 py-10">
                <p className="text-sm text-gray-400">Loading live sports streams...</p>
              </div>
            ) : error ? (
              <div className="px-6 py-10">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="px-6 py-10">
                <p className="text-sm text-gray-400">No live matches found for this sport.</p>
              </div>
            ) : (
              <div className="grid gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-3">
                {matches.map((match, index) => {
                  const title = getMatchTitle(match);
                  const subtitle = getMatchSubtitle(match);
                  const { uk, cet, local, localZone } = formatMatchDateParts(match.date);
                  const status = getMatchStatus(match);
                  const posterUrl = getPosterUrl(match);
                  const homeName = getTeamName(match.teams?.home);
                  const awayName = getTeamName(match.teams?.away);
                  const homeBadgeUrl = getBadgeUrl(match.teams?.home?.badge);
                  const awayBadgeUrl = getBadgeUrl(match.teams?.away?.badge);
                  const hasTeams = Boolean(homeName || awayName);
                  const sources = getSourceLinks(match);
                  const hasPlayableSource = sources.some(
                    (source) => Boolean(source?.source && source?.id)
                  );

                  const watchHref = hasPlayableSource
                    ? `/livesports/watch?title=${encodeURIComponent(title)}&sources=${safeSerializeSources(
                        sources
                      )}`
                    : '';

                  return (
                    <div
                      key={`${title}-${match.date || index}-${index}`}
                      className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition hover:border-red-400/70 hover:shadow-[0_0_24px_rgba(239,68,68,0.18)]"
                    >
                      <div className="relative aspect-[16/9] w-full bg-gray-800">
                        <img
                          src={posterUrl || LIVE_SPORTS_PLACEHOLDER}
                          alt={title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            if (e.currentTarget.src.endsWith(LIVE_SPORTS_PLACEHOLDER)) return;
                            e.currentTarget.src = LIVE_SPORTS_PLACEHOLDER;
                          }}
                        />

                        <div className="absolute left-3 top-3 flex gap-2">
                          <span className="rounded-full border border-red-500/30 bg-red-600/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                            {status}
                          </span>

                          <span className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-200 backdrop-blur-md">
                            {subtitle}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col px-5 py-5">
                        <div className="min-h-[56px]">
                          <h3 className="line-clamp-2 text-lg font-semibold leading-7 text-white">
                            {title}
                          </h3>
                        </div>

                        <div className="mt-4 min-h-[72px]">
                          {hasTeams ? (
                            <div className="flex h-[72px] items-center justify-center gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                {homeBadgeUrl ? (
                                  <img
                                    src={homeBadgeUrl}
                                    alt={homeName || 'Home Team'}
                                    width="44"
                                    height="44"
                                    className="h-11 w-11 flex-shrink-0 object-contain"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] text-gray-400">
                                    N/A
                                  </div>
                                )}

                                <span className="min-w-0 truncate text-sm font-medium text-white">
                                  {homeName || 'Home'}
                                </span>
                              </div>

                              <span className="flex-shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
                                VS
                              </span>

                              <div className="flex min-w-0 flex-1 items-center justify-end gap-3 text-right">
                                <span className="min-w-0 truncate text-sm font-medium text-white">
                                  {awayName || 'Away'}
                                </span>

                                {awayBadgeUrl ? (
                                  <img
                                    src={awayBadgeUrl}
                                    alt={awayName || 'Away Team'}
                                    width="44"
                                    height="44"
                                    className="h-11 w-11 flex-shrink-0 object-contain"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] text-gray-400">
                                    N/A
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-[72px] items-center rounded-xl border border-transparent px-1 text-sm text-transparent">
                              Placeholder
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>{local}</span>
                          <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-300">
                            {localZone}
                          </span>

                          <span className="text-gray-600">•</span>

                          <span>{uk}</span>
                          <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-300">
                            UK
                          </span>

                          <span className="text-gray-600">•</span>

                          <span>{cet}</span>
                          <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-300">
                            CET
                          </span>
                        </div>

                        <div className="mt-auto pt-5">
                          {hasPlayableSource ? (
                            <Link href={watchHref}>
                              <span className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-red-600 px-5 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60">
                                <svg
                                  className="h-4 w-4 flex-shrink-0"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                >
                                  <path d="M8 5.5v13l10-6.5-10-6.5z" />
                                </svg>
                                Play
                              </span>
                            </Link>
                          ) : (
                            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm text-gray-400">
                              No source available.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

export default function LiveSportsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white" />}>
      <LiveSportsPageContent />
    </Suspense>
  );
}