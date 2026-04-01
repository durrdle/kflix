'use client';

import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  cleanupExpiredPartyMembers,
  HOST_LOGOUT_GRACE_MS,
  MEMBER_LOGOUT_GRACE_MS,
  promotePartyHost,
  requestResync,
  sendPartyMessage,
  subscribeToMembers,
  subscribeToMessages,
  subscribeToParty,
  subscribeToPlayback,
} from '@/lib/firebaseParty';

function formatRemainingCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function PartyControlModal({ open, onClose, onLeave, code }) {
  const router = useRouter();

  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState('In Sync');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [playbackState, setPlaybackState] = useState(null);
  const [userId, setUserId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [chatPosition, setChatPosition] = useState({ x: 24, y: 24 });
  const [resyncing, setResyncing] = useState(false);
  const [partyState, setPartyState] = useState(null);
  const [promotingId, setPromotingId] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [clockTick, setClockTick] = useState(Date.now());

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const chatRef = useRef(null);

  const chatUiKey = useMemo(
    () => (code ? `kflix_party_chat_ui_${code}` : ''),
    [code]
  );

  const currentMember = useMemo(
    () => members.find((member) => String(member.id) === String(userId)) || null,
    [members, userId]
  );

  const isHost = Boolean(
    currentMember?.isHost ||
      (partyState?.hostId && String(currentMember?.id || '') === String(partyState.hostId))
  );

  const isPartyMember = Boolean(currentMember);

  const normalizedMembers = useMemo(() => {
    const hostId = partyState?.hostId ? String(partyState.hostId) : '';

    return [...members].sort((a, b) => {
      const aIsHost = Boolean(a?.isHost || (hostId && String(a?.id) === hostId));
      const bIsHost = Boolean(b?.isHost || (hostId && String(b?.id) === hostId));

      if (aIsHost && !bIsHost) return -1;
      if (!aIsHost && bIsHost) return 1;

      const aOffline = Boolean(a?.isOffline);
      const bOffline = Boolean(b?.isOffline);
      if (aOffline !== bOffline) return aOffline ? 1 : -1;

      const aSeen = Number(a?.lastSeenAt || 0);
      const bSeen = Number(b?.lastSeenAt || 0);

      return bSeen - aSeen;
    });
  }, [members, partyState?.hostId]);

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
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255,255,255,0.04)), color-mix(in srgb, var(--theme-accent-soft) 68%, transparent))',
    borderColor: 'var(--theme-accent-border)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
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

  const glassSuccessButtonStyle = {
    borderColor: 'rgba(34, 197, 94, 0.34)',
    background:
      'linear-gradient(180deg, rgba(34, 197, 94, 0.88), rgba(21, 128, 61, 0.82))',
    boxShadow:
      '0 14px 28px rgba(34, 197, 94, 0.24), inset 0 1px 0 rgba(255,255,255,0.14)',
    color: '#ffffff',
    backdropFilter: 'blur(16px) saturate(150%)',
    WebkitBackdropFilter: 'blur(16px) saturate(150%)',
  };

  const glassDangerButtonStyle = {
    borderColor: 'rgba(239, 68, 68, 0.30)',
    background:
      'linear-gradient(180deg, rgba(127, 29, 29, 0.80), rgba(69, 10, 10, 0.78))',
    boxShadow:
      '0 12px 24px rgba(127, 29, 29, 0.22), inset 0 1px 0 rgba(255,255,255,0.10)',
    color: '#ffffff',
    backdropFilter: 'blur(16px) saturate(145%)',
    WebkitBackdropFilter: 'blur(16px) saturate(145%)',
  };

  const saveChatUi = (next) => {
    if (!chatUiKey) return;
    localStorage.setItem(chatUiKey, JSON.stringify(next));
  };

  const readChatUi = () => {
    if (!chatUiKey) return;

    try {
      const raw = localStorage.getItem(chatUiKey);
      const parsed = raw ? JSON.parse(raw) : null;

      if (parsed) {
        setChatOpen(Boolean(parsed.open));

        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setChatPosition({ x: parsed.x, y: parsed.y });
        }
      }
    } catch {
      // ignore
    }
  };

  const buildResyncUrl = () => {
    if (!playbackState?.mediaType) return null;

    if (playbackState.mediaType === 'live') {
      const params = new URLSearchParams();

      if (playbackState.sourcesParam) {
        params.set('sources', playbackState.sourcesParam);
      }

      params.set('sourceIndex', String(playbackState.sourceIndex ?? 0));
      params.set('streamIndex', String(playbackState.streamIndex ?? 0));
      params.set('partyFollow', '1');

      return `/livesports/watch?${params.toString()}`;
    }

    if (!playbackState?.mediaId) return null;

    const mediaType = String(playbackState.mediaType);
    const mediaId = String(playbackState.mediaId);
    const currentTime =
      typeof playbackState.currentTime === 'number'
        ? Math.max(0, Math.floor(playbackState.currentTime))
        : 0;
    const autoplay = playbackState?.isPlaying ? '1' : '0';

    const params = new URLSearchParams();
    params.set('type', mediaType);
    params.set('id', mediaId);
    params.set('t', String(currentTime));
    params.set('autoplay', autoplay);
    params.set('partyFollow', '1');

    if (mediaType === 'tv') {
      if (playbackState.season != null && playbackState.season !== '') {
        params.set('season', String(playbackState.season));
      }
      if (playbackState.episode != null && playbackState.episode !== '') {
        params.set('episode', String(playbackState.episode));
      }
    }

    return `/watch?${params.toString()}`;
  };

  const getPlaybackLabel = () => {
    if (!playbackState?.mediaType) {
      return 'Nothing synced yet';
    }

    if (playbackState.mediaType === 'live') {
      return 'Live Event';
    }

    if (!playbackState?.mediaId) {
      return 'Nothing synced yet';
    }

    if (playbackState.mediaType === 'tv') {
      const seasonLabel =
        playbackState.season != null && playbackState.season !== ''
          ? `S${String(playbackState.season)}`
          : 'S?';
      const episodeLabel =
        playbackState.episode != null && playbackState.episode !== ''
          ? `E${String(playbackState.episode)}`
          : 'E?';

      return `TV / ${playbackState.mediaId} / ${seasonLabel} ${episodeLabel}`;
    }

    return `Movie / ${playbackState.mediaId}`;
  };

  const getPlaybackTimeLabel = () => {
    if (playbackState?.mediaType === 'live') {
      return 'Live';
    }

    if (
      typeof playbackState?.currentTime !== 'number' ||
      !Number.isFinite(playbackState.currentTime)
    ) {
      return '0s';
    }

    const total = Math.max(0, Math.floor(playbackState.currentTime));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getPlaybackUpdatedLabel = () => {
    if (!playbackState?.updatedAt) return 'No live data yet';

    const diff = Math.max(0, Date.now() - playbackState.updatedAt);

    if (diff < 5000) return 'Live now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;

    return `${Math.floor(diff / 60000)}m ago`;
  };

  const applyHostPlaybackNow = () => {
    const targetUrl = buildResyncUrl();
    if (!targetUrl) return;

    if (playbackState?.mediaType === 'live') {
      router.replace(targetUrl);
      return;
    }

    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl !== targetUrl) {
      router.replace(targetUrl);
      return;
    }

    window.dispatchEvent(
      new CustomEvent('kflix-party-resync', {
        detail: {
          mediaType: playbackState.mediaType || '',
          mediaId: playbackState.mediaId || '',
          season: playbackState.season ?? '',
          episode: playbackState.episode ?? '',
          currentTime:
            typeof playbackState.currentTime === 'number'
              ? playbackState.currentTime
              : 0,
          isPlaying: Boolean(playbackState.isPlaying),
          syncRequestedAt: Date.now(),
        },
      })
    );
  };

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || '');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!code) return;
    readChatUi();
  }, [code, chatUiKey]);

  useEffect(() => {
    if (!code) return;
    if (!open && !chatOpen) return;

    const unsubParty = subscribeToParty(code, (party) => {
      setPartyState(party || null);

      if (!party) {
        setSyncStatus('Party Closed');
        return;
      }

      const lastResync = party.syncRequestedAt || 0;
      const ageMs = Date.now() - lastResync;

      if (!lastResync) {
        setSyncStatus('In Sync');
      } else if (ageMs < 15000) {
        setSyncStatus('Recently Resynced');
      } else {
        setSyncStatus('In Sync');
      }
    });

    const unsubMessages = subscribeToMessages(code, (nextMessages) => {
      setMessages(nextMessages);
    });

    const unsubMembers = subscribeToMembers(code, (nextMembers) => {
      setMembers(nextMembers || []);
    });

    const unsubPlayback = subscribeToPlayback(code, (nextPlayback) => {
      setPlaybackState(nextPlayback || null);
    });

    return () => {
      unsubParty?.();
      unsubMessages?.();
      unsubMembers?.();
      unsubPlayback?.();
    };
  }, [code, open, chatOpen]);

  useEffect(() => {
    if (!code || (!open && !chatOpen)) return;

    const interval = setInterval(() => {
      setClockTick(Date.now());
      cleanupExpiredPartyMembers(code).catch(() => {});
    }, 1000);

    return () => clearInterval(interval);
  }, [code, open, chatOpen]);

  useEffect(() => {
    const hostId = String(partyState?.hostId || '');
    if (!hostId) return;

    setMembers((prev) =>
      prev.map((member) => ({
        ...member,
        isHost: String(member.id) === hostId,
      }))
    );
  }, [partyState?.hostId]);

  useEffect(() => {
    if (!code) return;

    saveChatUi({
      open: chatOpen,
      x: chatPosition.x,
      y: chatPosition.y,
    });
  }, [chatOpen, chatPosition, code, chatUiKey]);

  useEffect(() => {
    if (!dragging || isMobile) return;

    const handleMove = (e) => {
      const nextX = e.clientX - dragOffsetRef.current.x;
      const nextY = e.clientY - dragOffsetRef.current.y;

      const maxX = Math.max(8, window.innerWidth - 360);
      const maxY = Math.max(8, window.innerHeight - 220);

      setChatPosition({
        x: Math.max(8, Math.min(nextX, maxX)),
        y: Math.max(8, Math.min(nextY, maxY)),
      });
    };

    const handleUp = () => {
      setDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, isMobile]);

  useEffect(() => {
    if (!open && !chatOpen) return;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
    };
  }, [open, chatOpen]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const shouldRenderModal = open;
  const shouldRenderChat = chatOpen && code && isPartyMember;
  const showJumpSection = isPartyMember && !isHost;

  const hasActiveHostPlayback = Boolean(
    playbackState?.mediaType &&
      playbackState?.mediaId &&
      (playbackState?.route === '/watch' || playbackState?.route === '/livesports/watch')
  );

  const handleResync = async () => {
    if (!code || !userId || resyncing || !isPartyMember || isHost || !hasActiveHostPlayback) {
      return;
    }

    try {
      setResyncing(true);
      applyHostPlaybackNow();
      setSyncStatus('Recently Resynced');

      await requestResync(code, userId);

      setTimeout(() => {
        setResyncing(false);
      }, 800);
    } catch (error) {
      console.error('Resync failed:', error);
      setResyncing(false);
    }
  };

  const handlePromote = async (memberId) => {
    if (!code || !userId || !isHost || !memberId || memberId === userId) return;

    try {
      setPromotingId(memberId);
      await promotePartyHost(code, userId, memberId);
    } catch (error) {
      console.error('Failed to promote member:', error);
    } finally {
      setPromotingId('');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = chatMessage.trim();

    if (!trimmed || !code || !userId || !isPartyMember) return;

    try {
      await sendPartyMessage(code, userId, trimmed);
      setChatMessage('');
      setChatOpen(true);
    } catch (error) {
      console.error('Failed to send party message:', error);
    }
  };

  const handleStartDrag = (e) => {
    if (!chatRef.current || isMobile) return;

    const rect = chatRef.current.getBoundingClientRect();

    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    setDragging(true);
  };

  const formattedMessages = messages.map((message) => {
    const time = new Date(message.createdAt || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return {
      ...message,
      time,
      mine: String(message.sender) === String(userId),
    };
  });

  if (!shouldRenderModal && !shouldRenderChat) return null;

  return (
    <>
      {shouldRenderModal && (
        <div className="fixed inset-0 z-[999] overflow-y-auto bg-black/70 backdrop-blur-sm">
          <div className="flex min-h-full items-start justify-center px-3 pb-3 pt-20 sm:items-center sm:px-4 sm:py-6">
            <div
              className="w-full max-w-[620px] overflow-hidden rounded-3xl border-[1.5px] max-h-[calc(100dvh-1.5rem)] sm:max-h-[85dvh]"
              style={glassPanelStyle}
            >
              <div
                className="flex items-center justify-between border-b px-4 py-4 sm:px-6"
                style={glassHeaderStyle}
              >
                <h2 className="text-base font-semibold uppercase tracking-[0.18em] sm:text-lg" style={{ color: 'var(--theme-accent-text)' }}>
                  Party Controls
                </h2>

                <button
                  onClick={onClose}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition active:scale-95"
                  style={glassGhostButtonStyle}
                  aria-label="Close"
                  type="button"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 max-h-[calc(100dvh-6.5rem)] sm:max-h-[calc(85dvh-4.5rem)]">
                <div className="space-y-5">
                  <div className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                      Party Code
                    </p>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div
                        className="rounded-2xl border px-4 py-3 text-center text-sm font-semibold tracking-[0.25em] sm:text-base"
                        style={glassSurfaceStyle}
                      >
                        {code || '------'}
                      </div>

                      <button
                        onClick={handleCopyCode}
                        className="flex h-11 w-full items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition active:scale-95 sm:w-auto"
                        style={copied ? glassSuccessButtonStyle : glassAccentButtonStyle}
                        type="button"
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className={`grid gap-4 ${showJumpSection ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
                    {showJumpSection && (
                      <div className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                        <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                          Jump to Host
                        </p>

                        <div className="mt-3">
                          <div
                            className={`text-sm font-medium ${
                              !hasActiveHostPlayback
                                ? 'text-[var(--theme-muted-text)]'
                                : syncStatus === 'Recently Resynced'
                                  ? 'text-green-300'
                                  : syncStatus === 'Party Closed'
                                    ? 'text-[var(--theme-accent-text)]'
                                    : 'text-[var(--theme-text)]'
                            }`}
                          >
                            {hasActiveHostPlayback ? syncStatus : 'No active content'}
                          </div>

                          <p className="mt-2 text-xs leading-6 text-[var(--theme-muted-text)]">
                            {hasActiveHostPlayback
                              ? 'Jump to the host’s current media and playback position.'
                              : 'The host is not currently playing anything.'}
                          </p>
                        </div>

                        <button
                          onClick={handleResync}
                          disabled={resyncing || !hasActiveHostPlayback}
                          className="mt-4 flex h-11 w-full items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                          style={glassAccentButtonStyle}
                          type="button"
                        >
                          {resyncing ? 'Resyncing...' : 'Jump to Host'}
                        </button>
                      </div>
                    )}

                    <div className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                      <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                        Playback State
                      </p>

                      <div className="mt-3 space-y-2 text-sm text-[var(--theme-text)]">
                        <div className="break-words">
                          Media: <span className="text-[var(--theme-muted-text)]">{getPlaybackLabel()}</span>
                        </div>
                        <div>
                          Time: <span className="text-[var(--theme-muted-text)]">{getPlaybackTimeLabel()}</span>
                        </div>
                        <div>
                          Status:{' '}
                          <span className="text-[var(--theme-muted-text)]">
                            {playbackState?.mediaType === 'live'
                              ? 'Live'
                              : playbackState?.isPlaying
                                ? 'Playing'
                                : playbackState?.mediaId
                                  ? 'Paused'
                                  : 'Waiting'}
                          </span>
                        </div>
                        <div>
                          Updated: <span className="text-[var(--theme-muted-text)]">{getPlaybackUpdatedLabel()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                      Members
                    </p>

                    <div className="mt-3 grid gap-2">
                      {normalizedMembers.length > 0 ? (
                        normalizedMembers.map((member) => {
                          const memberIsHost = Boolean(
                            member.isHost ||
                              (partyState?.hostId && String(member.id) === String(partyState.hostId))
                          );

                          const isOffline = Boolean(member.isOffline);
                          const loggedOutAt = Number(member.loggedOutAt || 0);
                          const graceMs = memberIsHost ? HOST_LOGOUT_GRACE_MS : MEMBER_LOGOUT_GRACE_MS;

                          const liveRemainingMs =
                            isOffline && loggedOutAt > 0
                              ? Math.max(0, graceMs - (clockTick - loggedOutAt))
                              : 0;

                          return (
                            <div
                              key={member.id}
                              className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                                isOffline ? 'opacity-55' : ''
                              }`}
                              style={glassSurfaceStyle}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className={`truncate text-sm font-medium ${isOffline ? 'text-[var(--theme-muted-text)]' : 'text-[var(--theme-text)]'}`}>
                                    {member.name || `User ${member.id}`}
                                  </div>

                                  {memberIsHost && (
                                    <span
                                      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                                      style={{
                                        borderColor: 'var(--theme-accent-border)',
                                        background:
                                          'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255,255,255,0.04)), color-mix(in srgb, var(--theme-accent-soft) 68%, transparent))',
                                        color: 'var(--theme-accent-text)',
                                      }}
                                    >
                                      Host
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs text-[var(--theme-muted-text)]">
                                  {memberIsHost ? 'Host' : 'Member'}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                {isOffline ? (
                                  <div
                                    className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                                    style={{
                                      borderColor: 'var(--theme-accent-border)',
                                      background:
                                        'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255,255,255,0.04)), color-mix(in srgb, var(--theme-accent-soft) 68%, transparent))',
                                      color: 'var(--theme-accent-text)',
                                    }}
                                  >
                                    <span className="opacity-80">Time to rejoin:</span>{' '}
                                    <span className="font-bold">{formatRemainingCountdown(liveRemainingMs)}</span>
                                  </div>
                                ) : (
                                  <div className="text-xs text-green-300">
                                    Online
                                  </div>
                                )}

                                {isHost && !memberIsHost && !isOffline && (
                                  <button
                                    type="button"
                                    onClick={() => handlePromote(member.id)}
                                    disabled={promotingId === member.id}
                                    className="rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                                    style={glassAccentButtonStyle}
                                  >
                                    {promotingId === member.id ? 'Promoting...' : 'Promote'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border px-4 py-3 text-sm text-[var(--theme-muted-text)]" style={glassSurfaceStyle}>
                          No members found.
                        </div>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleSendMessage} className="rounded-2xl border p-4" style={glassSurfaceStyle}>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                      Party Chat
                    </p>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Type a quick message..."
                        className="h-11 flex-1 rounded-2xl border px-4 text-sm text-[var(--theme-text)] outline-none transition placeholder:text-[var(--theme-muted-text)]"
                        style={glassSurfaceStyle}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--theme-accent-border)';
                          e.currentTarget.style.boxShadow =
                            '0 0 14px color-mix(in srgb, var(--theme-accent-glow) 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.07)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor =
                            'color-mix(in srgb, var(--theme-muted-border) 92%, rgba(255,255,255,0.06))';
                          e.currentTarget.style.boxShadow =
                            '0 12px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.07)';
                        }}
                      />

                      <button
                        type="submit"
                        className="flex h-11 w-full items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition active:scale-95 sm:w-auto"
                        style={glassAccentButtonStyle}
                        disabled={!isPartyMember}
                      >
                        Send
                      </button>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setChatOpen(true)}
                        className="flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition active:scale-95"
                        style={glassGhostButtonStyle}
                        disabled={!isPartyMember}
                      >
                        Open Chatbox
                      </button>

                      <button
                        type="button"
                        onClick={() => setChatOpen(false)}
                        className="flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition active:scale-95"
                        style={glassGhostButtonStyle}
                      >
                        Hide Chatbox
                      </button>
                    </div>
                  </form>

                  <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                    <button
                      onClick={onLeave}
                      className="flex h-11 flex-1 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition active:scale-95"
                      style={glassDangerButtonStyle}
                      type="button"
                    >
                      Leave Party
                    </button>

                    <button
                      onClick={onClose}
                      className="flex h-11 flex-1 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition active:scale-95"
                      style={glassGhostButtonStyle}
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {shouldRenderChat && (
        <div
          ref={chatRef}
          className={`fixed z-[1000] overflow-hidden rounded-3xl border-[1.5px] ${
            isMobile ? 'left-3 right-3 bottom-3 w-auto' : 'w-[360px]'
          }`}
          style={
            isMobile
              ? glassPanelStyle
              : {
                  ...glassPanelStyle,
                  left: `${chatPosition.x}px`,
                  top: `${chatPosition.y}px`,
                }
          }
        >
          <div
            onMouseDown={handleStartDrag}
            className={`flex items-center justify-between border-b px-4 py-3 ${
              isMobile ? 'cursor-default' : dragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={glassHeaderStyle}
          >
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-accent-text)' }}>
                Party Chat
              </div>
              <div className="text-[11px] text-[var(--theme-muted-text)]">
                {isMobile ? 'Party messages' : 'Drag me around'}
              </div>
            </div>

            <button
              onClick={() => setChatOpen(false)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border transition active:scale-95"
              style={glassGhostButtonStyle}
              aria-label="Close chat"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className={`flex flex-col ${isMobile ? 'h-[60dvh] max-h-[520px]' : 'h-[380px]'}`}>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {formattedMessages.length > 0 ? (
                formattedMessages.map((message) => (
                  <div
                    key={message.id}
                    className="max-w-[85%] rounded-2xl border px-3 py-2"
                    style={
                      message.mine
                        ? {
                            marginLeft: 'auto',
                            borderColor: 'var(--theme-accent-border)',
                            background:
                              'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255,255,255,0.04)), color-mix(in srgb, var(--theme-accent-soft) 68%, transparent))',
                            color: 'var(--theme-text)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                          }
                        : glassSurfaceStyle
                    }
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-medium" style={{ color: 'var(--theme-accent-text)' }}>
                        {message.mine ? 'You' : message.senderName || `User ${message.sender}`}
                      </span>
                      <span className="text-[10px] text-[var(--theme-muted-text)]">{message.time}</span>
                    </div>
                    <div className="break-words text-sm">{message.text}</div>
                  </div>
                ))
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[var(--theme-muted-text)]">
                  No messages yet.
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="border-t p-3" style={{ borderColor: 'var(--theme-muted-border)' }}>
              <div className="flex gap-2">
                <input
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Message the party..."
                  className="h-10 flex-1 rounded-2xl border px-3 text-sm text-[var(--theme-text)] outline-none transition placeholder:text-[var(--theme-muted-text)]"
                  style={glassSurfaceStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--theme-accent-border)';
                    e.currentTarget.style.boxShadow =
                      '0 0 14px color-mix(in srgb, var(--theme-accent-glow) 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.07)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor =
                      'color-mix(in srgb, var(--theme-muted-border) 92%, rgba(255,255,255,0.06))';
                    e.currentTarget.style.boxShadow =
                      '0 12px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.07)';
                  }}
                />
                <button
                  type="submit"
                  className="flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition active:scale-95"
                  style={glassAccentButtonStyle}
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}