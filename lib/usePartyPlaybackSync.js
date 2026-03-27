// lib/usePartyPlaybackSync.js
'use client';

import { useEffect, useRef } from 'react';
import {
  setPartyMedia,
  subscribeToParty,
  subscribeToPlayback,
  updatePartyPlaybackState,
} from '@/lib/firebaseParty';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export function usePartyPlaybackSync({
  partyCode,
  mediaId,
  mediaType,
  playerRef,
  enabled = true,
}) {
  const userIdRef = useRef('');
  const ignoreIncomingRef = useRef(false);
  const lastAppliedSyncVersionRef = useRef(null);

  useEffect(() => {
  const auth = getAuth();

  const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
    userIdRef.current = currentUser?.uid || '';
  });

  return () => unsubscribe();
}, []);

  useEffect(() => {
    if (!enabled || !partyCode || !mediaId || !mediaType) return;

    if (!userIdRef.current) return;

setPartyMedia(partyCode, {
  mediaId,
  mediaType,
  currentTime: 0,
  isPlaying: false,
  updatedBy: userIdRef.current,
});
  }, [enabled, partyCode, mediaId, mediaType]);

  useEffect(() => {
    if (!enabled || !partyCode || !playerRef?.current) return;

    const unsubPlayback = subscribeToPlayback(partyCode, (playback) => {
      if (!playback || !playerRef.current) return;
      if (playback.updatedBy === userIdRef.current && !ignoreIncomingRef.current) return;
      if (playback.mediaId && String(playback.mediaId) !== String(mediaId)) return;
      if (playback.mediaType && String(playback.mediaType) !== String(mediaType)) return;

      ignoreIncomingRef.current = true;

      try {
        if (
          typeof playback.currentTime === 'number' &&
          Math.abs((playerRef.current.currentTime || 0) - playback.currentTime) > 2
        ) {
          playerRef.current.currentTime = playback.currentTime;
        }

        if (playback.isPlaying) {
          playerRef.current.play?.();
        } else {
          playerRef.current.pause?.();
        }
      } catch (error) {
        console.error('Failed applying party playback state:', error);
      }

      setTimeout(() => {
        ignoreIncomingRef.current = false;
      }, 300);
    });

    const unsubParty = subscribeToParty(partyCode, (party) => {
      if (!party || !playerRef.current) return;

      if (
        party.syncVersion &&
        lastAppliedSyncVersionRef.current !== party.syncVersion
      ) {
        lastAppliedSyncVersionRef.current = party.syncVersion;

        const playback = party.playback;
        if (!playback) return;

        try {
          if (
            typeof playback.currentTime === 'number' &&
            Math.abs((playerRef.current.currentTime || 0) - playback.currentTime) > 1
          ) {
            playerRef.current.currentTime = playback.currentTime;
          }

          if (playback.isPlaying) {
            playerRef.current.play?.();
          } else {
            playerRef.current.pause?.();
          }
        } catch (error) {
          console.error('Failed handling resync:', error);
        }
      }
    });

    return () => {
      unsubPlayback?.();
      unsubParty?.();
    };
  }, [enabled, partyCode, mediaId, mediaType, playerRef]);

  useEffect(() => {
    if (!enabled || !partyCode || !playerRef?.current) return;

    const player = playerRef.current;

    const sendState = () => {
      if (ignoreIncomingRef.current || !userIdRef.current) return;

      updatePartyPlaybackState(partyCode, {
        mediaId,
        mediaType,
        currentTime: Number(player.currentTime || 0),
        isPlaying: !player.paused,
        updatedBy: userIdRef.current,
      });
    };

    const handlePlay = () => sendState();
    const handlePause = () => sendState();
    const handleSeeked = () => sendState();

    player.addEventListener?.('play', handlePlay);
    player.addEventListener?.('pause', handlePause);
    player.addEventListener?.('seeked', handleSeeked);

    const interval = setInterval(() => {
      if (!player.paused) {
        sendState();
      }
    }, 3000);

    return () => {
      player.removeEventListener?.('play', handlePlay);
      player.removeEventListener?.('pause', handlePause);
      player.removeEventListener?.('seeked', handleSeeked);
      clearInterval(interval);
    };
  }, [enabled, partyCode, mediaId, mediaType, playerRef]);
}