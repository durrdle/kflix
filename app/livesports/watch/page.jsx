'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Navbar from '@/components/Navbar';
import { setPartyMedia, subscribeToMembers } from '@/lib/firebaseParty';

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

function IconVolume({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 010 7" />
      <path d="M18.5 5.5a9 9 0 010 13" />
    </svg>
  );
}

function IconMute({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M23 9l-6 6" />
      <path d="M17 9l6 6" />
    </svg>
  );
}

function IconFullscreen({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M8 3H3v5" />
      <path d="M16 3h5v5" />
      <path d="M21 16v5h-5" />
      <path d="M3 16v5h5" />
    </svg>
  );
}

function IconServer({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <path d="M7 7h.01" />
      <path d="M7 17h.01" />
    </svg>
  );
}

function IconLock({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 118 0v3" />
    </svg>
  );
}

function IconUnlock({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 017.2-2.4" />
    </svg>
  );
}

function normalizeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  if (url.startsWith('/')) {
    return `https://streamed.pk${url}`;
  }

  return url;
}

function withAutoplay(url) {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('autoplay')) {
      parsed.searchParams.set('autoplay', '1');
    }
    if (!parsed.searchParams.has('autoPlay')) {
      parsed.searchParams.set('autoPlay', 'true');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function buildSourceLabel(source, index) {
  const name = String(source?.source || '').trim();
  if (name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  return `Server ${index + 1}`;
}

function buildStreamLabel(stream, index) {
  const parts = [];

  if (stream?.streamNo) parts.push(`Stream ${stream.streamNo}`);
  else parts.push(`Stream ${index + 1}`);

  if (stream?.language) parts.push(stream.language);
  if (typeof stream?.hd === 'boolean') parts.push(stream.hd ? 'HD' : 'SD');

  return parts.join(' • ');
}

function parseSourcesParam(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function LiveSportsWatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const playerFrameRef = useRef(null);
  const playerShellRef = useRef(null);
  const fullscreenNoticeTimeoutRef = useRef(null);

  const sourcesParam = searchParams.get('sources') || '';
  const sourceIndexParam = Number(searchParams.get('sourceIndex') || 0);
  const streamIndexParam = Number(searchParams.get('streamIndex') || 0);

  const availableSources = useMemo(
    () =>
      parseSourcesParam(sourcesParam).filter(
        (source) => Boolean(source?.source && source?.id)
      ),
    [sourcesParam]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [streams, setStreams] = useState([]);
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [userId, setUserId] = useState('');
  const [partyCode, setPartyCode] = useState('');
  const [members, setMembers] = useState([]);
  const [syncNotice, setSyncNotice] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [fullscreenNoticeOpen, setFullscreenNoticeOpen] = useState(false);
  const [isMobileLike, setIsMobileLike] = useState(false);

  const [playerIsPlaying, setPlayerIsPlaying] = useState(true);
  const [playerVolume, setPlayerVolume] = useState(1);
  const [playerMuted, setPlayerMuted] = useState(false);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [controlsLocked, setControlsLocked] = useState(true);

  const activeSource = useMemo(
    () => availableSources[activeSourceIndex] || null,
    [availableSources, activeSourceIndex]
  );

  const activeStream = useMemo(
    () => streams[activeStreamIndex] || null,
    [streams, activeStreamIndex]
  );

  const currentMember = useMemo(
    () => members.find((member) => String(member.id) === String(userId)) || null,
    [members, userId]
  );

  const isHost = Boolean(currentMember?.isHost);

  const embedUrl = useMemo(() => {
    const normalized = normalizeEmbedUrl(activeStream?.embedUrl || '');
    return withAutoplay(normalized);
  }, [activeStream]);

  const controlsEnabled = !isMobileLike;

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
    borderColor: 'color-mix(in srgb, var(--theme-muted-border) 92%, rgba(255,255,255,0.06))',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-muted-bg) 82%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--theme-muted-bg-strong) 90%, rgba(255,255,255,0.02)))',
    boxShadow:
      '0 12px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.07)',
    backdropFilter: 'blur(16px) saturate(145%)',
    WebkitBackdropFilter: 'blur(16px) saturate(145%)',
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

  const sendPlayerCommand = (payload) => {
    const frame = playerFrameRef.current;
    if (!frame?.contentWindow) return false;
    frame.contentWindow.postMessage(payload, '*');
    return true;
  };

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
      if (!document.fullscreenElement) {
        setFullscreenNoticeOpen(false);
        if (fullscreenNoticeTimeoutRef.current) {
          clearTimeout(fullscreenNoticeTimeoutRef.current);
          fullscreenNoticeTimeoutRef.current = null;
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (fullscreenNoticeTimeoutRef.current) {
        clearTimeout(fullscreenNoticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isMobileLike) {
      setControlsLocked(false);
      setServerMenuOpen(false);
    } else {
      setControlsLocked(true);
    }
  }, [isMobileLike]);

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
    if (availableSources.length) {
      const safeSourceIndex =
        sourceIndexParam >= 0 && sourceIndexParam < availableSources.length
          ? sourceIndexParam
          : 0;
      setActiveSourceIndex(safeSourceIndex);
    }
  }, [availableSources, sourceIndexParam]);

  useEffect(() => {
    if (!availableSources.length) {
      setError('No stream sources were provided for this match.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadStreamsForSource = async () => {
      if (!activeSource?.source || !activeSource?.id) {
        setError('Missing source information.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        setStreams([]);

        const params = new URLSearchParams();
        params.set('source', String(activeSource.source).trim().toLowerCase());
        params.set('id', String(activeSource.id).trim());

        const res = await fetch(`/api/livesports/stream?${params.toString()}`, {
          cache: 'no-store',
        });

        const payload = await res.json();

        if (!res.ok || !payload?.ok) {
          const debugText = payload?.debug?.preview ? ` (${payload.debug.preview})` : '';
          throw new Error(
            (payload?.error || 'Failed to load streams for this server.') + debugText
          );
        }

        const nextStreams = Array.isArray(payload?.data) ? payload.data : [];
        const normalizedStreams = nextStreams
          .map((stream) => ({
            ...stream,
            embedUrl: withAutoplay(normalizeEmbedUrl(stream?.embedUrl || '')),
          }))
          .filter((stream) => Boolean(stream.embedUrl));

        if (!normalizedStreams.length) {
          throw new Error('No embeddable streams were returned for this server.');
        }

        if (!cancelled) {
          setStreams(normalizedStreams);

          const safeStreamIndex =
            activeSourceIndex === sourceIndexParam &&
            streamIndexParam >= 0 &&
            streamIndexParam < normalizedStreams.length
              ? streamIndexParam
              : 0;

          setActiveStreamIndex(safeStreamIndex);
          setIframeKey((prev) => prev + 1);
          setPlayerIsPlaying(true);
        }
      } catch (err) {
        if (!cancelled) {
          setStreams([]);
          setError(
            err instanceof Error ? err.message : 'Failed to load streams for this server.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadStreamsForSource();

    return () => {
      cancelled = true;
    };
  }, [availableSources, activeSource, activeSourceIndex, sourceIndexParam, streamIndexParam]);

  useEffect(() => {
    if (streams.length) {
      const safeStreamIndex =
        streamIndexParam >= 0 && streamIndexParam < streams.length
          ? streamIndexParam
          : 0;
      setActiveStreamIndex(safeStreamIndex);
    }
  }, [streams, streamIndexParam]);

  useEffect(() => {
    if (!partyCode || !userId || !isHost || !activeSource || !activeStream) return;

    const encodedSources = encodeURIComponent(JSON.stringify(availableSources));

    setPartyMedia(partyCode, {
      mediaType: 'live',
      mediaId: `${activeSource.source}:${activeSource.id}`,
      currentTime: 0,
      isPlaying: true,
      updatedBy: userId,
      route: '/livesports/watch',
      sourceIndex: activeSourceIndex,
      streamIndex: activeStreamIndex,
      sourcesParam: encodedSources,
    }).catch((partyError) => {
      console.error('Failed to publish live sports party state:', partyError);
    });
  }, [
    partyCode,
    userId,
    isHost,
    activeSource,
    activeStream,
    availableSources,
    activeSourceIndex,
    activeStreamIndex,
  ]);

  useEffect(() => {
    const followRequested = searchParams.get('partyFollow') === '1';
    if (!followRequested) return;

    setSyncNotice('Synced to host live event.');
    const timeout = setTimeout(() => {
      setSyncNotice('');
    }, 2500);

    return () => clearTimeout(timeout);
  }, [searchParams]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && noticeOpen) {
        setNoticeOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [noticeOpen]);

  const handleSourceSelect = (index) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sourceIndex', String(index));
    params.set('streamIndex', '0');
    router.replace(`/livesports/watch?${params.toString()}`);
    setServerMenuOpen(false);
  };

  const handleStreamSelect = (index) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('streamIndex', String(index));
    router.replace(`/livesports/watch?${params.toString()}`);
  };

  const handleNoticeUnderstood = () => {
    setNoticeOpen(false);
  };

  const handleNoticeNotUnderstood = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/livesports');
  };

  const handleTogglePlay = () => {
    const nextPlaying = !playerIsPlaying;
    sendPlayerCommand({ command: nextPlaying ? 'play' : 'pause' });
    setPlayerIsPlaying(nextPlaying);
  };

  const handleVolumeChange = (event) => {
    const nextVolume = Math.max(0, Math.min(1, Number(event.target.value)));
    setPlayerVolume(nextVolume);
    setPlayerMuted(nextVolume <= 0);

    sendPlayerCommand({ command: 'volume', level: nextVolume });
    sendPlayerCommand({ command: 'mute', muted: nextVolume <= 0 });
  };

  const handleToggleMute = () => {
    const nextMuted = !playerMuted;
    setPlayerMuted(nextMuted);
    sendPlayerCommand({ command: 'mute', muted: nextMuted });

    if (!nextMuted && playerVolume <= 0) {
      setPlayerVolume(0.5);
      sendPlayerCommand({ command: 'volume', level: 0.5 });
    }

    if (nextMuted) {
      setPlayerVolume(0);
      sendPlayerCommand({ command: 'volume', level: 0 });
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

  if (loading && !streams.length) {
    return (
      <div
        className="flex min-h-screen flex-col overflow-hidden text-white"
        style={{ background: 'var(--theme-bg)' }}
      >
        <Navbar />

        <main className="flex min-h-0 flex-1 items-center justify-center px-4 pt-20 sm:px-6 sm:pt-24 lg:px-8">
          <div
            className="w-full max-w-5xl rounded-3xl border-[1.5px] px-6 py-8 text-center"
            style={glassPanelStyle}
          >
            <p className="text-base sm:text-lg" style={{ color: 'var(--theme-muted-text)' }}>
              Loading stream...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  if (error && !streams.length) {
    return (
      <div
        className="flex min-h-screen flex-col overflow-hidden text-white"
        style={{ background: 'var(--theme-bg)' }}
      >
        <Navbar />

        <main className="flex min-h-0 flex-1 items-center justify-center px-4 pt-20 sm:px-6 sm:pt-24 lg:px-8">
          <div
            className="w-full max-w-5xl rounded-3xl border-[1.5px] px-6 py-8 text-center"
            style={glassPanelStyle}
          >
            <p className="text-base sm:text-lg" style={{ color: 'var(--theme-accent-text)' }}>
              {error}
            </p>

            <div className="mt-6">
              <Link
                href="/livesports"
                className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border px-5 text-sm font-semibold transition active:scale-95"
                style={glassAccentButtonStyle}
              >
                Go Back
              </Link>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <>
      <div
        className="flex min-h-screen flex-col overflow-hidden text-white"
        style={{ background: 'var(--theme-bg)' }}
      >
        <Navbar />

        <main className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-20 sm:px-6 sm:pb-2 sm:pt-24 lg:px-8">
          <section className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
            {syncNotice && (
              <div className="mb-4 rounded-2xl border px-4 py-3 text-sm" style={successNoticeStyle}>
                {syncNotice}
              </div>
            )}

            {!isMobileLike && fullscreenNoticeOpen && (
  <div className="mb-4 rounded-2xl border px-4 py-3 text-sm" style={warningNoticeStyle}>
    Entered fullscreen. Press ESC to exit fullscreen.
  </div>
)}

            {isMobileLike && (
              <div className="mb-4 rounded-2xl border px-4 py-3 text-sm" style={warningNoticeStyle}>
                Mobile mode uses the native embedded player controls.
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
      <iframe
        key={`${embedUrl}-${iframeKey}`}
        ref={playerFrameRef}
        src={embedUrl}
        title="Live Sports Player"
        className="h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; web-share"
        allowFullScreen
      />

      {controlsEnabled && controlsLocked && (
        <div
          className="absolute inset-0 z-10"
          aria-hidden="true"
          style={{
            background: 'transparent',
            cursor: 'default',
          }}
        />
      )}
    </div>
  </div>

  {controlsEnabled && (
    <div className="mt-3 rounded-2xl border p-3 sm:p-4" style={glassSurfaceStyle}>
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
              title={playerMuted ? 'Unmute' : 'Mute'}
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
        </div>

        <div className="flex justify-center">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex h-11 w-20 cursor-pointer items-center justify-center rounded-[16px] border transition active:scale-95"
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
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div
            className="flex w-[220px] items-center justify-center gap-2 rounded-2xl border px-3 py-2"
            style={glassGhostButtonStyle}
          >
            <button
              type="button"
              onClick={() => setServerMenuOpen((prev) => !prev)}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition active:scale-95"
              style={serverMenuOpen ? glassAccentButtonStyle : glassGhostButtonStyle}
              aria-label="Servers and streams"
              title="Servers and streams"
            >
              <IconServer />
            </button>

            <button
              type="button"
              onClick={() => setControlsLocked((prev) => !prev)}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition active:scale-95"
              style={controlsLocked ? glassGhostButtonStyle : glassAccentButtonStyle}
              aria-label={controlsLocked ? 'Unlock embedded controls' : 'Lock embedded controls'}
              title={controlsLocked ? 'Unlock embedded controls' : 'Lock embedded controls'}
            >
              {controlsLocked ? <IconLock /> : <IconUnlock />}
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
              Servers
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {availableSources.map((source, index) => {
              const active = index === activeSourceIndex;

              return (
                <button
                  key={`${source.source || 'source'}-${source.id || index}`}
                  type="button"
                  onClick={() => handleSourceSelect(index)}
                  className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border px-4 text-sm font-semibold transition active:scale-95"
                  style={active ? glassAccentButtonStyle : glassGhostButtonStyle}
                >
                  {buildSourceLabel(source, index)}
                </button>
              );
            })}
          </div>

          {streams.length > 0 && (
            <>
              <div className="mb-2 mt-4 flex items-center gap-2">
                <IconServer className="h-4 w-4" />
                <p className="text-sm font-semibold" style={{ color: 'var(--theme-accent-text)' }}>
                  Streams
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {streams.map((stream, index) => {
                  const active = index === activeStreamIndex;

                  return (
                    <button
                      key={`${stream.id || index}-${stream.streamNo || index}`}
                      type="button"
                      onClick={() => handleStreamSelect(index)}
                      className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border px-4 text-sm font-semibold transition active:scale-95"
                      style={active ? glassAccentButtonStyle : glassGhostButtonStyle}
                    >
                      {buildStreamLabel(stream, index)}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div
            className="mt-3 rounded-xl border px-4 py-3 text-xs sm:text-sm"
            style={glassGhostButtonStyle}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>
                <strong>State:</strong> {playerIsPlaying ? 'Playing' : 'Paused'}
              </span>
              <span>
                <strong>Volume:</strong> {Math.round((playerMuted ? 0 : playerVolume) * 100)}%
              </span>
              <span>
                <strong>Server:</strong> {buildSourceLabel(activeSource, activeSourceIndex)}
              </span>
              <span>
                <strong>Stream:</strong> {buildStreamLabel(activeStream, activeStreamIndex)}
              </span>
              <span>
                <strong>Lock:</strong> {controlsLocked ? 'On' : 'Off'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )}
</div>
          </section>
        </main>

        <Footer />
      </div>

      {noticeOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-3 backdrop-blur-sm sm:px-4">
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl border-[1.5px]"
            style={glassPanelStyle}
          >
            <div className="border-b px-4 py-3 sm:px-5" style={glassNoticeStyle}>
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

                <p
                  className="text-sm font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--theme-accent-text)' }}
                >
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

function Footer() {
  return (
    <footer
      className="shrink-0 px-4 pb-6 pt-2 text-center text-sm sm:px-6 lg:px-8"
      style={{ color: 'var(--theme-muted-text)' }}
    >
      <p></p>

      <div
        className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm"
        style={{ color: 'var(--theme-muted-text)' }}
      />
    </footer>
  );
}

export default function LiveSportsWatchPage() {
  return (
    <Suspense fallback={<div className="h-screen text-white" style={{ background: 'var(--theme-bg)' }} />}>
      <LiveSportsWatchContent />
    </Suspense>
  );
}