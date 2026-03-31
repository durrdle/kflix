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
export const PARTY_MEMBER_TIMEOUT_MS = 45 * 1000;
export const RECENT_LOGOUT_WINDOW_MS = 5 * 60 * 1000;
export const HOST_LOGOUT_GRACE_MS = 5 * 60 * 1000;
export const MEMBER_LOGOUT_GRACE_MS = 60 * 1000;

export async function getSyncedDisplayName(userId) {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const resolvedUserId = userId || currentUser?.uid || '';
  if (!resolvedUserId) return 'User Guest';

  try {
    const profileSnap = await get(ref(db, `users/${resolvedUserId}/profile`));
    const profile = profileSnap.exists() ? profileSnap.val() || {} : {};

    if (typeof profile.displayName === 'string' && profile.displayName.trim()) {
      return profile.displayName.trim();
    }
  } catch (error) {
    console.error('Failed to read synced display name:', error);
  }

  if (currentUser && String(currentUser.uid) === String(resolvedUserId)) {
    return (
      currentUser.displayName ||
      (currentUser.email
        ? currentUser.email.split('@')[0]
        : `User ${currentUser.uid.slice(0, 6)}`)
    );
  }

  return `User ${String(resolvedUserId).slice(0, 6)}`;
}

export function buildPartyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function generateUniquePartyCode(maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = buildPartyCode();
    const snapshot = await get(ref(db, `parties/${code}`));
    if (!snapshot.exists()) {
      return code;
    }
  }

  throw new Error('Failed to generate a unique party code.');
}

export async function createParty(code, hostId) {
  const partyRef = ref(db, `parties/${code}`);
  const hostName = await getSyncedDisplayName(hostId);

  await set(partyRef, {
    code,
    hostId,
    createdAt: Date.now(),
    status: 'active',
    syncVersion: Date.now(),
    syncRequestedAt: 0,
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
      route: '',
      sourceIndex: 0,
      streamIndex: 0,
      sourcesParam: '',
    },
    members: {
      [hostId]: {
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        isHost: true,
        name: hostName,
        loggedOutAt: null,
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

  const partyData = snapshot.val() || {};
  if (partyData.status === 'closed') {
    throw new Error('Party is closed');
  }

  const isHost = String(partyData.hostId || '') === String(userId);
  const displayName = await getSyncedDisplayName(userId);

  await update(ref(db, `parties/${code}/members/${userId}`), {
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    isHost,
    name: displayName,
    loggedOutAt: null,
  });

  return true;
}

export async function ensureHostMembership(code, hostId) {
  const hostName = await getSyncedDisplayName(hostId);

  await update(ref(db, `parties/${code}/members/${hostId}`), {
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    isHost: true,
    name: hostName,
    loggedOutAt: null,
  });
}

export async function touchPartyMember(code, userId) {
  if (!code || !userId) return;

  await update(ref(db, `parties/${code}/members/${userId}`), {
    lastSeenAt: Date.now(),
    loggedOutAt: null,
  });
}

export async function syncPartyMemberProfile(code, userId) {
  if (!code || !userId) return;

  const displayName = await getSyncedDisplayName(userId);

  await update(ref(db, `parties/${code}/members/${userId}`), {
    name: displayName,
    lastSeenAt: Date.now(),
    loggedOutAt: null,
  });
}

export async function leaveParty(code, userId) {
  if (!code || !userId) return;

  const partyRef = ref(db, `parties/${code}`);
  const snapshot = await get(partyRef);

  if (!snapshot.exists()) return;

  const partyData = snapshot.val() || {};
  const hostId = partyData.hostId || null;

  if (String(hostId) === String(userId)) {
    await remove(partyRef);
    return;
  }

  await remove(ref(db, `parties/${code}/members/${userId}`));
  await update(partyRef, {
    lastLeaveAt: Date.now(),
  });
}

export async function markPartyLogoutGrace(code, userId) {
  if (!code || !userId) return;

  const memberRef = ref(db, `parties/${code}/members/${userId}`);
  const snapshot = await get(memberRef);

  if (!snapshot.exists()) return;

  await update(memberRef, {
    loggedOutAt: Date.now(),
    lastSeenAt: Date.now(),
  });
}

export async function revivePartyMember(code, userId) {
  if (!code || !userId) return;

  const memberRef = ref(db, `parties/${code}/members/${userId}`);
  const snapshot = await get(memberRef);

  if (!snapshot.exists()) return;

  await update(memberRef, {
    loggedOutAt: null,
    lastSeenAt: Date.now(),
  });
}

export async function cleanupExpiredPartyMembers(code) {
  if (!code) return;

  const partyRef = ref(db, `parties/${code}`);
  const snapshot = await get(partyRef);

  if (!snapshot.exists()) return;

  const party = snapshot.val() || {};
  const members = party.members || {};
  const now = Date.now();

  for (const [memberId, member] of Object.entries(members)) {
    const loggedOutAt = Number(member?.loggedOutAt || 0);
    if (!loggedOutAt) continue;

    const timeout = member?.isHost ? HOST_LOGOUT_GRACE_MS : MEMBER_LOGOUT_GRACE_MS;
    const expired = now - loggedOutAt >= timeout;

    if (!expired) continue;

    if (member?.isHost) {
      await remove(partyRef);
      return;
    }

    await remove(ref(db, `parties/${code}/members/${memberId}`));
  }
}

export async function promotePartyHost(code, currentHostId, nextHostId) {
  if (!code || !currentHostId || !nextHostId) return;

  const partyRef = ref(db, `parties/${code}`);
  const snapshot = await get(partyRef);

  if (!snapshot.exists()) {
    throw new Error('Party not found');
  }

  const party = snapshot.val() || {};
  const currentHost = String(party.hostId || '');

  if (currentHost !== String(currentHostId)) {
    throw new Error('Only the current host can promote another member.');
  }

  const members = party.members || {};
  if (!members[nextHostId]) {
    throw new Error('Selected member is not in the party.');
  }

  const nextHostName = await getSyncedDisplayName(nextHostId);

  const updates = {};
  updates[`parties/${code}/hostId`] = nextHostId;
  updates[`parties/${code}/members/${currentHostId}/isHost`] = false;
  updates[`parties/${code}/members/${nextHostId}/isHost`] = true;
  updates[`parties/${code}/members/${nextHostId}/name`] = nextHostName;
  updates[`parties/${code}/members/${nextHostId}/loggedOutAt`] = null;
  updates[`parties/${code}/syncVersion`] = Date.now();

  await update(ref(db), updates);
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
  const senderName = await getSyncedDisplayName(userId);

  await set(messageRef, {
    sender: userId,
    senderName,
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
    route: payload.route ?? '',
    sourceIndex: payload.sourceIndex ?? 0,
    streamIndex: payload.streamIndex ?? 0,
    sourcesParam: payload.sourcesParam ?? '',
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
    const now = Date.now();

    const cleaned = Object.entries(raw || {}).filter(([_, value]) => {
      const loggedOutAt = Number(value?.loggedOutAt || 0);

      if (loggedOutAt > 0) {
        const timeout = value?.isHost ? HOST_LOGOUT_GRACE_MS : MEMBER_LOGOUT_GRACE_MS;
        return now - loggedOutAt < timeout;
      }

      const lastSeen = Number(value?.lastSeenAt || 0);
      return now - lastSeen < PARTY_MEMBER_TIMEOUT_MS;
    });

    const list = cleaned.map(([id, value]) => {
      const loggedOutAt = Number(value?.loggedOutAt || 0);
      const timeout = value?.isHost ? HOST_LOGOUT_GRACE_MS : MEMBER_LOGOUT_GRACE_MS;
      const remainingMs =
        loggedOutAt > 0 ? Math.max(0, timeout - (now - loggedOutAt)) : 0;

      return {
        id,
        ...value,
        isOffline: loggedOutAt > 0,
        remainingMs,
      };
    });

    list.sort((a, b) => {
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;

      const aOffline = a.isOffline ? 1 : 0;
      const bOffline = b.isOffline ? 1 : 0;
      if (aOffline !== bOffline) return aOffline - bOffline;

      const aSeen = Number(a?.lastSeenAt || 0);
      const bSeen = Number(b?.lastSeenAt || 0);

      return bSeen - aSeen;
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

export function markRecentPartyLogout(code = '') {
  try {
    localStorage.setItem(
      'kflix_recent_party_logout',
      JSON.stringify({
        code: code || '',
        at: Date.now(),
      })
    );
  } catch {}
}

export function getRecentPartyLogout() {
  try {
    const raw = localStorage.getItem('kflix_recent_party_logout');
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const at = Number(parsed?.at || 0);

    if (!Number.isFinite(at) || at <= 0) return null;

    return {
      code: typeof parsed?.code === 'string' ? parsed.code : '',
      at,
    };
  } catch {
    return null;
  }
}

export function clearRecentPartyLogout() {
  try {
    localStorage.removeItem('kflix_recent_party_logout');
  } catch {}
}

export function isRecentPartyLogoutActive() {
  const entry = getRecentPartyLogout();
  if (!entry) return false;
  return Date.now() - entry.at < RECENT_LOGOUT_WINDOW_MS;
}

export function setLastPartySession(value) {
  try {
    localStorage.setItem('kflix_last_party_session', JSON.stringify(value));
  } catch {}
}

export function getLastPartySession() {
  try {
    const raw = localStorage.getItem('kflix_last_party_session');
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      code: typeof parsed.code === 'string' ? parsed.code : '',
      userId: typeof parsed.userId === 'string' ? parsed.userId : '',
      isHost: Boolean(parsed.isHost),
      logoutAt: Number(parsed.logoutAt || 0),
    };
  } catch {
    return null;
  }
}

export function clearLastPartySession() {
  try {
    localStorage.removeItem('kflix_last_party_session');
  } catch {}
}

export function leavePartyOnUnload() {
  // intentionally unused
}