'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [mounted, setMounted] = useState(false);

  const sportsScrollRef = useRef(null);

  const activeSportLabel = useMemo(() => {
    if (activeSport === 'live') return 'Live Now';

    const match = sports.find((sport) => sport.slug === activeSport);
    return match?.label || 'Live Now';
  }, [activeSport, sports]);

  const glassPanelStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-panel-from) 82%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--theme-panel-to) 92%, rgba(255,255,255,0.02)))',
    borderColor: 'color-mix(in srgb, var(--theme-accent-border) 74%, rgba(255,255,255,0.08))',
    boxShadow:
      '0 20px 46px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02)',
    backdropFilter: 'blur(22px) saturate(150%)',
    WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  };

  const glassHeaderStyle = {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 90%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-accent-soft) 58%, transparent))',
    borderColor: 'color-mix(in srgb, var(--theme-accent-border-soft) 90%, rgba(255,255,255,0.05))',
  };

  const glassChipStyle = {
    borderColor: 'var(--theme-accent-border)',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 92%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-accent-soft) 64%, transparent))',
    color: 'var(--theme-accent-text)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
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

  const glassActiveButtonStyle = {
    borderColor: 'var(--theme-accent-border)',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 16%, rgba(255,255,255,0.10)), color-mix(in srgb, var(--theme-accent-soft) 90%, rgba(255,255,255,0.04)))',
    color: 'var(--theme-accent-text)',
    boxShadow:
      '0 0 18px color-mix(in srgb, var(--theme-accent-glow) 44%, transparent), inset 0 1px 0 rgba(255,255,255,0.12)',
    backdropFilter: 'blur(16px) saturate(145%)',
    WebkitBackdropFilter: 'blur(16px) saturate(145%)',
  };

  const glassCardStyle = {
    borderColor: 'color-mix(in srgb, var(--theme-muted-border) 92%, rgba(255,255,255,0.08))',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-muted-bg) 82%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-muted-bg-strong) 90%, rgba(255,255,255,0.02)))',
    boxShadow:
      '0 12px 26px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
    backdropFilter: 'blur(18px) saturate(145%)',
    WebkitBackdropFilter: 'blur(18px) saturate(145%)',
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

  useEffect(() => {
    setMounted(true);
  }, []);

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

  useEffect(() => {
    const el = sportsScrollRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const updateScrollButtons = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };

    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);

    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [sports, activeSport]);

  const scrollSports = (direction) => {
    const el = sportsScrollRef.current;
    if (!el) return;

    el.scrollBy({
      left: direction === 'left' ? -260 : 260,
      behavior: 'smooth',
    });
  };

  return (
    <div className="min-h-screen text-white" style={{ background: 'var(--theme-bg)' }}>
      <Navbar />

      <main className="px-4 pb-10 pt-20 sm:px-6 sm:pt-24 lg:px-8">
        {notice && (
          <div
            className="mb-6 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'rgba(234, 179, 8, 0.20)',
              background:
                'linear-gradient(180deg, rgba(234, 179, 8, 0.14), rgba(161, 98, 7, 0.10))',
              color: '#fef3c7',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          >
            {notice}
          </div>
        )}

        <section
          className="relative overflow-hidden rounded-3xl border-[1.5px]"
          style={glassPanelStyle}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at top, color-mix(in srgb, var(--theme-accent-soft) 95%, transparent), transparent 36%)',
            }}
          />

          <div className="relative z-10 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <div
              className="inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
              style={glassChipStyle}
            >
              Live Sports
            </div>

            <h1 className="mt-4 text-3xl font-bold sm:text-4xl md:text-5xl lg:text-6xl">
              Watch Live Sports
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-6 md:text-base md:leading-7" style={{ color: 'var(--theme-text)' }}>
              Anything from Football to Motor Sports &amp; Fights.
            </p>

            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div
                  className="text-xs font-semibold uppercase tracking-[0.18em] sm:text-sm"
                  style={{ color: 'var(--theme-accent-text)' }}
                >
                  Categories
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollSports('left')}
                    disabled={mounted ? !canScrollLeft : false}
                    className="flex h-10 w-10 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-60"
                    style={glassGhostButtonStyle}
                    aria-label="Scroll categories left"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M15 6l-6 6 6 6" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollSports('right')}
                    disabled={mounted ? !canScrollRight : false}
                    className="flex h-10 w-10 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-60"
                    style={glassGhostButtonStyle}
                    aria-label="Scroll categories right"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>

              <div
                ref={sportsScrollRef}
                className="flex gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-3"
              >
                <button
                  type="button"
                  onClick={() => setActiveSport('live')}
                  className="shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition active:scale-95 sm:px-4"
                  style={activeSport === 'live' ? glassActiveButtonStyle : glassGhostButtonStyle}
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
                      className="shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition active:scale-95 sm:px-4"
                      style={active ? glassActiveButtonStyle : glassGhostButtonStyle}
                    >
                      {sport.label}
                    </button>
                  );
                })}

                {sportsLoading && (
                  <div
                    className="shrink-0 rounded-xl border px-4 py-2 text-sm"
                    style={glassGhostButtonStyle}
                  >
                    Loading sports...
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div
            className="overflow-hidden rounded-3xl border-[1.5px]"
            style={glassPanelStyle}
          >
            <div
              className="flex flex-col gap-2 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              style={glassHeaderStyle}
            >
              <h2
                className="text-base font-semibold uppercase tracking-[0.18em] sm:text-lg"
                style={{ color: 'var(--theme-accent-text)' }}
              >
                {activeSport === 'live' ? 'Live Now' : `${activeSportLabel} Live Now`}
              </h2>

              <span className="text-sm" style={{ color: 'var(--theme-text)' }}>
                {loading ? 'Loading...' : `${matches.length} matches`}
              </span>
            </div>

            {loading ? (
              <div className="px-4 py-10 sm:px-6">
                <p className="text-sm" style={{ color: 'var(--theme-muted-text)' }}>Loading live sports streams...</p>
              </div>
            ) : error ? (
              <div className="px-4 py-10 sm:px-6">
                <p className="text-sm" style={{ color: 'var(--theme-accent-text)' }}>{error}</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="px-4 py-10 sm:px-6">
                <p className="text-sm" style={{ color: 'var(--theme-muted-text)' }}>No live matches found for this sport.</p>
              </div>
            ) : (
              <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-6 md:grid-cols-2 xl:grid-cols-3">
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
                      className="flex h-full flex-col overflow-hidden rounded-3xl border transition"
                      style={glassCardStyle}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--theme-accent-border)';
                        e.currentTarget.style.boxShadow =
                          '0 0 30px color-mix(in srgb, var(--theme-accent-glow) 40%, transparent), 0 12px 26px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        Object.assign(e.currentTarget.style, glassCardStyle);
                      }}
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

                        <div className="absolute left-2 top-2 flex flex-wrap gap-2 sm:left-3 sm:top-3">
                          <span
                            className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] sm:px-3"
                            style={glassActiveButtonStyle}
                          >
                            {status}
                          </span>

                          <span
                            className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] sm:px-3"
                            style={glassGhostButtonStyle}
                          >
                            {subtitle}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col px-4 py-4 sm:px-5 sm:py-5">
                        <div className="min-h-[56px]">
                          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-white sm:text-lg sm:leading-7">
                            {title}
                          </h3>
                        </div>

                        <div className="mt-4 min-h-[72px]">
                          {hasTeams ? (
                            <div
                              className="flex h-[72px] items-center justify-center gap-3 rounded-2xl border px-3 py-3 sm:gap-4 sm:px-4"
                              style={glassGhostButtonStyle}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                {homeBadgeUrl ? (
                                  <img
                                    src={homeBadgeUrl}
                                    alt={homeName || 'Home Team'}
                                    width="44"
                                    height="44"
                                    className="h-10 w-10 flex-shrink-0 object-contain sm:h-11 sm:w-11"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] text-gray-400 sm:h-11 sm:w-11">
                                    N/A
                                  </div>
                                )}

                                <span className="min-w-0 truncate text-sm font-medium text-white">
                                  {homeName || 'Home'}
                                </span>
                              </div>

                              <span
                                className="flex-shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] sm:text-xs"
                                style={{ color: 'var(--theme-accent-text)' }}
                              >
                                VS
                              </span>

                              <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right sm:gap-3">
                                <span className="min-w-0 truncate text-sm font-medium text-white">
                                  {awayName || 'Away'}
                                </span>

                                {awayBadgeUrl ? (
                                  <img
                                    src={awayBadgeUrl}
                                    alt={awayName || 'Away Team'}
                                    width="44"
                                    height="44"
                                    className="h-10 w-10 flex-shrink-0 object-contain sm:h-11 sm:w-11"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] text-gray-400 sm:h-11 sm:w-11">
                                    N/A
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-[72px] items-center rounded-2xl border border-transparent px-1 text-sm text-transparent">
                              Placeholder
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--theme-muted-text)' }}>
                          <span>{local}</span>
                          <span
                            className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={glassGhostButtonStyle}
                          >
                            {localZone}
                          </span>

                          <span>•</span>

                          <span>{uk}</span>
                          <span
                            className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={glassGhostButtonStyle}
                          >
                            UK
                          </span>

                          <span>•</span>

                          <span>{cet}</span>
                          <span
                            className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={glassGhostButtonStyle}
                          >
                            CET
                          </span>
                        </div>

                        <div className="mt-auto pt-5">
                          {hasPlayableSource ? (
                            <Link href={watchHref}>
                              <span
                                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-5 text-sm font-semibold transition active:scale-95"
                                style={glassAccentButtonStyle}
                              >
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
                            <div
                              className="rounded-2xl border px-4 py-3 text-center text-sm"
                              style={glassGhostButtonStyle}
                            >
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

      <footer className="px-4 pb-8 pt-2 text-center text-sm sm:px-6 lg:px-8" style={{ color: 'var(--theme-muted-text)' }}>
        <p>This site does not host or store any media.</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm" style={{ color: 'var(--theme-muted-text)' }}>
        </div>
      </footer>
    </div>
  );
}

export default function LiveSportsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen text-white" style={{ background: 'var(--theme-bg)' }} />}>
      <LiveSportsPageContent />
    </Suspense>
  );
}