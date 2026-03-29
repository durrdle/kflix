'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Navbar from '@/components/Navbar';
import { setPartyMedia, subscribeToMembers } from '@/lib/firebaseParty';

const FAILOVER_DELAY_MS = 5000;

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

function getNextCandidate({
  currentSourceIndex,
  currentStreamIndex,
  streamCount,
  sourceCount,
}) {
  if (streamCount > 0 && currentStreamIndex < streamCount - 1) {
    return {
      nextSourceIndex: currentSourceIndex,
      nextStreamIndex: currentStreamIndex + 1,
    };
  }

  if (sourceCount > 0 && currentSourceIndex < sourceCount - 1) {
    return {
      nextSourceIndex: currentSourceIndex + 1,
      nextStreamIndex: 0,
    };
  }

  return null;
}

function LiveSportsWatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const titleParam = searchParams.get('title') || '';
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
  const [failoverNotice, setFailoverNotice] = useState('');
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const failoverTimerRef = useRef(null);
  const triedCandidatesRef = useRef(new Set());

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

  const triedKey = useMemo(() => {
    if (!activeSource) return '';
    return `${String(activeSource.source)}:${String(activeSource.id)}:${activeStreamIndex}`;
  }, [activeSource, activeStreamIndex]);

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
        setFrameLoaded(false);

        const params = new URLSearchParams();
        params.set('source', String(activeSource.source).trim().toLowerCase());
        params.set('id', String(activeSource.id).trim());

        const res = await fetch(`/api/livesports/stream?${params.toString()}`, {
          cache: 'no-store',
        });

        const payload = await res.json();

        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Failed to load streams for this server.');
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
    if (!embedUrl || !activeSource || !streams.length) return;

    setFrameLoaded(false);

    if (failoverTimerRef.current) {
      clearTimeout(failoverTimerRef.current);
      failoverTimerRef.current = null;
    }

    failoverTimerRef.current = setTimeout(() => {
      if (frameLoaded) return;

      if (triedKey) {
        triedCandidatesRef.current.add(triedKey);
      }

      const nextCandidate = getNextCandidate({
        currentSourceIndex: activeSourceIndex,
        currentStreamIndex: activeStreamIndex,
        streamCount: streams.length,
        sourceCount: availableSources.length,
      });

      if (!nextCandidate) {
        const params = new URLSearchParams();
        params.set('notice', 'no-working-server');
        if (titleParam) {
          params.set('title', titleParam);
        }
        router.replace(`/livesports?${params.toString()}`);
        return;
      }

      setFailoverNotice(
        `Trying ${buildSourceLabel(availableSources[nextCandidate.nextSourceIndex], nextCandidate.nextSourceIndex)} / Stream ${nextCandidate.nextStreamIndex + 1}...`
      );

      const params = new URLSearchParams(searchParams.toString());
      params.set('sourceIndex', String(nextCandidate.nextSourceIndex));
      params.set('streamIndex', String(nextCandidate.nextStreamIndex));

      router.replace(`/livesports/watch?${params.toString()}`);
    }, FAILOVER_DELAY_MS);

    return () => {
      if (failoverTimerRef.current) {
        clearTimeout(failoverTimerRef.current);
        failoverTimerRef.current = null;
      }
    };
  }, [
    embedUrl,
    frameLoaded,
    activeSource,
    activeSourceIndex,
    activeStreamIndex,
    streams,
    availableSources,
    router,
    searchParams,
    titleParam,
    triedKey,
  ]);

  useEffect(() => {
    if (!failoverNotice) return;

    const timeout = setTimeout(() => {
      setFailoverNotice('');
    }, 3000);

    return () => clearTimeout(timeout);
  }, [failoverNotice]);

  const handleSourceSelect = (index) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sourceIndex', String(index));
    params.set('streamIndex', '0');
    router.replace(`/livesports/watch?${params.toString()}`);
  };

  const handleStreamSelect = (index) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('streamIndex', String(index));
    router.replace(`/livesports/watch?${params.toString()}`);
  };

  const handleCastHelp = () => {
    window.alert(
      'To cast to your TV, use your browser’s Cast / Cast tab feature if supported.'
    );
  };

  if (loading && !streams.length) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-black text-white">
        <Navbar />

        <main className="flex min-h-0 flex-1 items-center justify-center px-8 pt-24">
          <p className="text-lg text-gray-300">Loading stream...</p>
        </main>

        <Footer />
      </div>
    );
  }

  if (error && !streams.length) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-black text-white">
        <Navbar />

        <main className="flex min-h-0 flex-1 items-center justify-center px-8 pt-24">
          <div className="text-center">
            <p className="text-lg text-red-300">{error}</p>

            <div className="mt-6">
              <Link
                href="/livesports"
                className="inline-flex h-11 items-center justify-center rounded-md bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700"
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
    <div className="flex h-screen flex-col overflow-hidden bg-black text-white">
      <Navbar />

      <main className="flex min-h-0 flex-1 flex-col px-6 pb-2 pt-24">
        <section className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
          {syncNotice && (
            <div className="mb-3 rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-200">
              {syncNotice}
            </div>
          )}

          {failoverNotice && (
            <div className="mb-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
              {failoverNotice}
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap gap-2">
                {availableSources.map((source, index) => {
                  const active = index === activeSourceIndex;

                  return (
                    <button
                      key={`${source.source || 'source'}-${source.id || index}`}
                      type="button"
                      onClick={() => handleSourceSelect(index)}
                      className={`rounded-md border px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                        active
                          ? 'border-red-400 bg-red-600/15 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.18)]'
                          : 'border-white/10 bg-black/20 text-white hover:border-red-400/60 hover:text-red-300'
                      }`}
                    >
                      {buildSourceLabel(source, index)}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                {streams.map((stream, index) => {
                  const active = index === activeStreamIndex;

                  return (
                    <button
                      key={`${stream.id || index}-${stream.streamNo || index}`}
                      type="button"
                      onClick={() => handleStreamSelect(index)}
                      className={`rounded-md border px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                        active
                          ? 'border-red-400 bg-red-600/15 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.18)]'
                          : 'border-white/10 bg-black/20 text-white hover:border-red-400/60 hover:text-red-300'
                      }`}
                    >
                      {buildStreamLabel(stream, index)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCastHelp}
                className="flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60"
              >
                Cast Help
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 p-3 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border-[1.5px] border-white/10 bg-black/20 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
              <div className="aspect-video w-full self-center bg-black">
                {embedUrl ? (
                  <iframe
                    key={`${embedUrl}-${iframeKey}`}
                    src={embedUrl}
                    title="Live Sports Player"
                    className="h-full w-full"
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; web-share"
                    allowFullScreen
                    onLoad={() => {
                      setFrameLoaded(true);
                      setFailoverNotice('');
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-400">
                    No active embedded stream available.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="shrink-0 px-8 pb-6 pt-2 text-center text-sm text-gray-400">
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
  );
}

export default function LiveSportsWatchPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-black text-white" />}>
      <LiveSportsWatchContent />
    </Suspense>
  );
}