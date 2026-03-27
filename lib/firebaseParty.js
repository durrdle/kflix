// lib/firebaseParty.js
'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  update,
  push,
  onValue,
  off,
  serverTimestamp,
} from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const DATABASE_URL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
export const db = getDatabase(app, DATABASE_URL);

export const PARTY_STAY_PROMPT_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function getLocalDisplayName() {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  if (currentUser?.uid) {
    return (
      localStorage.getItem(`kflix_profile_name_${currentUser.uid}`) ||
      currentUser.displayName ||
      `User ${currentUser.uid.slice(0, 6)}`
    );
  }

  return `User Guest`;
}

export function buildPartyCode(userId) {
  const now = Date.now();
  const seed = Math.floor(now / (1000 * 60 * 60 * 12));

  const userHash = String(userId || '')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return String(((seed * 7919) + userHash) % 900000 + 100000).slice(0, 6);
}

export async function createParty(code, hostId) {
  const partyRef = ref(db, `parties/${code}`);

  await set(partyRef, {
    code,
    hostId,
    createdAt: Date.now(),
    status: 'active',
    syncVersion: Date.now(),
    syncRequestedAt: Date.now(),
    syncRequestedBy: hostId,
    playback: {
      mediaId: null,
      mediaType: null,
      season: null,
      episode: null,
      currentTime: 0,
      isPlaying: false,
      updatedAt: Date.now(),
      updatedBy: hostId,
    },
    members: {
      [hostId]: {
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        isHost: true,
        name: getLocalDisplayName(),
      },
    },
  });

  return code;
}

export async function joinParty(code, userId) {
  const partyRef = ref(db, `parties/${code}`);
  const snapshot = await get(partyRef);

  if (!snapshot.exists()) {
    throw new Error('Party not found');
  }

  const partyData = snapshot.val();
  if (partyData?.status === 'closed') {
    throw new Error('Party is closed');
  }

  await update(ref(db, `parties/${code}/members/${userId}`), {
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    isHost: false,
    name: getLocalDisplayName(),
  });

  return true;
}

export async function ensureHostMembership(code, hostId) {
  await update(ref(db, `parties/${code}/members/${hostId}`), {
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    isHost: true,
    name: getLocalDisplayName(),
  });
}

export async function touchPartyMember(code, userId) {
  if (!code || !userId) return;

  await update(ref(db, `parties/${code}/members/${userId}`), {
    lastSeenAt: Date.now(),
    name: getLocalDisplayName(),
  });
}

export async function leaveParty(code, userId) {
  if (!code || !userId) return;

  const partyRef = ref(db, `parties/${code}`);
  const snapshot = await get(partyRef);

  if (!snapshot.exists()) return;

  const partyData = snapshot.val() || {};
  const hostId = partyData.hostId || null;

  await remove(ref(db, `parties/${code}/members/${userId}`));

  if (hostId === userId) {
    await remove(partyRef);
  } else {
    await update(partyRef, {
      lastLeaveAt: Date.now(),
    });
  }
}

export async function requestResync(code, userId) {
  await update(ref(db, `parties/${code}`), {
    syncVersion: Date.now(),
    syncRequestedAt: Date.now(),
    syncRequestedBy: userId,
  });
}

export async function sendPartyMessage(code, userId, text) {
  const messagesRef = ref(db, `parties/${code}/messages`);
  const messageRef = push(messagesRef);

  await set(messageRef, {
    sender: userId,
    senderName: getLocalDisplayName(),
    text,
    createdAt: Date.now(),
    serverTime: serverTimestamp(),
  });
}

export async function updatePartyPlaybackState(code, payload) {
  if (!code) return;

  await update(ref(db, `parties/${code}/playback`), {
    ...payload,
    updatedAt: Date.now(),
  });
}

export async function setPartyMedia(code, payload) {
  if (!code) return;

  await update(ref(db, `parties/${code}/playback`), {
    mediaId: payload.mediaId ?? null,
    mediaType: payload.mediaType ?? null,
    season: payload.season ?? null,
    episode: payload.episode ?? null,
    currentTime: payload.currentTime ?? 0,
    isPlaying: payload.isPlaying ?? false,
    updatedBy: payload.updatedBy ?? null,
    updatedAt: Date.now(),
  });
}

export function subscribeToParty(code, callback) {
  const partyRef = ref(db, `parties/${code}`);

  const handler = (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  };

  onValue(partyRef, handler);

  return () => {
    off(partyRef, 'value', handler);
  };
}

export function subscribeToMessages(code, callback) {
  const messagesRef = ref(db, `parties/${code}/messages`);

  const handler = (snapshot) => {
    const raw = snapshot.exists() ? snapshot.val() : {};
    const list = Object.entries(raw || {}).map(([id, value]) => ({
      id,
      ...value,
    }));

    list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    callback(list);
  };

  onValue(messagesRef, handler);

  return () => {
    off(messagesRef, 'value', handler);
  };
}

export function subscribeToPlayback(code, callback) {
  const playbackRef = ref(db, `parties/${code}/playback`);

  const handler = (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  };

  onValue(playbackRef, handler);

  return () => {
    off(playbackRef, 'value', handler);
  };
}

export function subscribeToMembers(code, callback) {
  const membersRef = ref(db, `parties/${code}/members`);

  const handler = (snapshot) => {
    const raw = snapshot.exists() ? snapshot.val() : {};
    const list = Object.entries(raw || {}).map(([id, value]) => ({
      id,
      ...value,
    }));

    list.sort((a, b) => {
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      return (a.joinedAt || 0) - (b.joinedAt || 0);
    });

    callback(list);
  };

  onValue(membersRef, handler);

  return () => {
    off(membersRef, 'value', handler);
  };
}

export function schedulePartyStayPrompt() {
  const nextAt = Date.now() + PARTY_STAY_PROMPT_INTERVAL_MS;
  localStorage.setItem('kflix_party_prompt_at', String(nextAt));
}

export function clearPartyStayPrompt() {
  localStorage.removeItem('kflix_party_prompt_at');
}

export function getPartyStayPromptAt() {
  const raw = localStorage.getItem('kflix_party_prompt_at');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function leavePartyOnUnload(code, userId, isHost = false) {
  if (!code || !userId) return;

  const encodedCode = encodeURIComponent(code);
  const encodedUserId = encodeURIComponent(userId);

  const url = isHost
    ? `${DATABASE_URL}/parties/${encodedCode}.json`
    : `${DATABASE_URL}/parties/${encodedCode}/members/${encodedUserId}.json`;

  try {
    fetch(url, {
      method: 'DELETE',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // best effort on unload
  }
}