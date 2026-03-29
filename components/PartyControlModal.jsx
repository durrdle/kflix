'use client';

import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  promotePartyHost,
  requestResync,
  sendPartyMessage,
  subscribeToMembers,
  subscribeToMessages,
  subscribeToParty,
  subscribeToPlayback,
  touchPartyMember,
} from '@/lib/firebaseParty';

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

      const aSeen = Number(a?.lastSeenAt || 0);
      const bSeen = Number(b?.lastSeenAt || 0);

      return bSeen - aSeen;
    });
  }, [members, partyState?.hostId]);

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

      if (Number.isFinite(Number(playbackState.sourceIndex))) {
        params.set('sourceIndex', String(playbackState.sourceIndex));
      }

      if (Number.isFinite(Number(playbackState.streamIndex))) {
        params.set('streamIndex', String(playbackState.streamIndex));
      }

      return `/livesports/watch${params.toString() ? `?${params.toString()}` : ''}`;
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

    const eventDetail = {
      mediaType: playbackState.mediaType || '',
      mediaId: playbackState.mediaId || '',
      season: playbackState.season ?? '',
      episode: playbackState.episode ?? '',
      currentTime:
        typeof playbackState.currentTime === 'number'
          ? playbackState.currentTime
          : 0,
      isPlaying: Boolean(playbackState.isPlaying),
      syncRequestedAt: partyState?.syncRequestedAt || Date.now(),
    };

    window.dispatchEvent(
      new CustomEvent('kflix-party-resync', {
        detail: eventDetail,
      })
    );

    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== targetUrl) {
      router.replace(targetUrl);
    }
  };

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || '');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!code) return;
    readChatUi();
  }, [code, chatUiKey]);

  useEffect(() => {
    if (!code) return;

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
  }, [code]);

  useEffect(() => {
    if (!code || !userId) return;

    touchPartyMember(code, userId);

    const interval = setInterval(() => {
      touchPartyMember(code, userId);
    }, 15000);

    return () => clearInterval(interval);
  }, [code, userId]);

  useEffect(() => {
    if (!code) return;

    saveChatUi({
      open: chatOpen,
      x: chatPosition.x,
      y: chatPosition.y,
    });
  }, [chatOpen, chatPosition, code, chatUiKey]);

  useEffect(() => {
    if (!dragging) return;

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
  }, [dragging]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const handleResync = async () => {
    if (!code || !userId || resyncing || !isPartyMember || isHost) return;

    try {
      setResyncing(true);
      await requestResync(code, userId);
      applyHostPlaybackNow();
      setSyncStatus('Recently Resynced');

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
    if (!chatRef.current) return;

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

  const shouldRenderModal = open;
  const shouldRenderChat = chatOpen && code && isPartyMember;
  const showJumpSection = isPartyMember && !isHost;

  if (!shouldRenderModal && !shouldRenderChat) return null;

  return (
    <>
      {shouldRenderModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[560px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-[1.5px] border-red-500/40 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between border-b border-red-500/20 bg-red-600/10 px-6 py-4">
              <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400">
                Party Controls
              </h2>

              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-gray-300 backdrop-blur-md transition active:scale-95 hover:text-white hover:shadow-inner hover:shadow-red-500/50"
                aria-label="Close"
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400">
                  Party Code
                </p>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="rounded-lg border border-white/10 bg-gray-900 px-4 py-3 text-base font-semibold tracking-[0.25em] text-white">
                    {code || '------'}
                  </div>

                  <button
                    onClick={handleCopyCode}
                    className="flex h-11 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60"
                    type="button"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className={`grid gap-4 ${showJumpSection ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
                {showJumpSection && (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-red-400">
                      Jump to Host
                    </p>

                    <div className="mt-3">
                      <div
                        className={`text-sm font-medium ${
                          syncStatus === 'Recently Resynced'
                            ? 'text-green-300'
                            : syncStatus === 'Party Closed'
                            ? 'text-red-300'
                            : 'text-white'
                        }`}
                      >
                        {syncStatus}
                      </div>

                      <p className="mt-2 text-xs text-gray-400">
                        Jump to the host’s current media and playback position.
                      </p>
                    </div>

                    <button
                      onClick={handleResync}
                      disabled={resyncing}
                      className={`mt-4 flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-white transition active:scale-95 ${
                        resyncing
                          ? 'cursor-not-allowed bg-red-900/50 opacity-70'
                          : 'bg-red-600 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60'
                      }`}
                      type="button"
                    >
                      {resyncing ? 'Resyncing...' : 'Jump to Host'}
                    </button>
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-red-400">
                    Playback State
                  </p>

                  <div className="mt-3 space-y-2 text-sm text-white">
                    <div>
                      Media: <span className="text-gray-300">{getPlaybackLabel()}</span>
                    </div>
                    <div>
                      Time: <span className="text-gray-300">{getPlaybackTimeLabel()}</span>
                    </div>
                    <div>
                      Status:{' '}
                      <span className="text-gray-300">
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
                      Updated: <span className="text-gray-300">{getPlaybackUpdatedLabel()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400">
                  Members
                </p>

                <div className="mt-3 grid gap-2">
                  {normalizedMembers.length > 0 ? (
                    normalizedMembers.map((member) => {
                      const memberIsHost = Boolean(
                        member.isHost ||
                          (partyState?.hostId && String(member.id) === String(partyState.hostId))
                      );

                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-gray-900 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-sm font-medium text-white">
                                {member.name || `User ${member.id}`}
                              </div>

                              {memberIsHost && (
                                <span className="rounded-full border border-red-500/30 bg-red-600/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-300">
                                  Host
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-gray-400">
                              {memberIsHost ? 'Host' : 'Member'}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-xs text-gray-400">
                              {Date.now() - (member.lastSeenAt || 0) < 30000 ? 'Online' : 'Idle'}
                            </div>

                            {isHost && !memberIsHost && (
                              <button
                                type="button"
                                onClick={() => handlePromote(member.id)}
                                disabled={promotingId === member.id}
                                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                                  promotingId === member.id
                                    ? 'cursor-not-allowed bg-red-900/40 text-red-200 opacity-70'
                                    : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60'
                                }`}
                              >
                                {promotingId === member.id ? 'Promoting...' : 'Promote'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-gray-900 px-4 py-3 text-sm text-gray-400">
                      No members found.
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={handleSendMessage} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400">
                  Party Chat
                </p>

                <div className="mt-3 flex gap-2">
                  <input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type a quick message..."
                    className="h-11 flex-1 rounded-xl border border-white/10 bg-gray-900 px-4 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                  />

                  <button
                    type="submit"
                    className="flex h-11 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60"
                    disabled={!isPartyMember}
                  >
                    Send
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChatOpen(true)}
                    className="flex h-10 items-center justify-center rounded-lg bg-black/25 px-4 text-sm font-semibold text-white transition active:scale-95 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40"
                    disabled={!isPartyMember}
                  >
                    Open Chatbox
                  </button>

                  <button
                    type="button"
                    onClick={() => setChatOpen(false)}
                    className="flex h-10 items-center justify-center rounded-lg bg-black/25 px-4 text-sm font-semibold text-white transition active:scale-95 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40"
                  >
                    Hide Chatbox
                  </button>
                </div>
              </form>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={onLeave}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl bg-gray-700 text-sm font-semibold text-white transition active:scale-95 hover:bg-gray-600"
                  type="button"
                >
                  Leave Party
                </button>

                <button
                  onClick={onClose}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl bg-black/25 text-sm font-semibold text-white transition active:scale-95 hover:bg-black/35 hover:shadow-inner hover:shadow-red-500/40"
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shouldRenderChat && (
        <div
          ref={chatRef}
          className="fixed z-[1000] w-[340px] overflow-hidden rounded-2xl border-[1.5px] border-red-500/40 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.6)]"
          style={{
            left: `${chatPosition.x}px`,
            top: `${chatPosition.y}px`,
          }}
        >
          <div
            onMouseDown={handleStartDrag}
            className={`flex cursor-grab items-center justify-between border-b border-red-500/20 bg-red-600/10 px-4 py-3 ${
              dragging ? 'cursor-grabbing' : ''
            }`}
          >
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-red-400">
                Party Chat
              </div>
              <div className="text-[11px] text-gray-400">Drag me around</div>
            </div>

            <button
              onClick={() => setChatOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-gray-300 transition active:scale-95 hover:text-white hover:shadow-inner hover:shadow-red-500/50"
              aria-label="Close chat"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="flex h-[360px] flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {formattedMessages.length > 0 ? (
                formattedMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[85%] rounded-2xl border px-3 py-2 ${
                      message.mine
                        ? 'ml-auto border-red-500/30 bg-red-600/15 text-white'
                        : 'border-white/10 bg-black/25 text-white'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-medium text-red-300">
                        {message.mine ? 'You' : message.senderName || `User ${message.sender}`}
                      </span>
                      <span className="text-[10px] text-gray-400">{message.time}</span>
                    </div>
                    <div className="text-sm">{message.text}</div>
                  </div>
                ))
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  No messages yet.
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-white/10 p-3">
              <div className="flex gap-2">
                <input
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Message the party..."
                  className="h-10 flex-1 rounded-xl border border-white/10 bg-gray-900 px-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                />
                <button
                  type="submit"
                  className="flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60"
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