// Fresh Greens — share-session adapter.
//
// Single global state for an active "I am sharing my live location with my
// trusted contact" session, of two flavors:
//   - 'unfamiliar'   → started inside /unfamiliar, persists until "I'm safe now"
//   - 'share-location' → started inside /share-location, persists until widget-end
//
// v1 is UI-state simulation — no real SMS or live-tracking; the session reflects
// the user's *intent* to share. Mirrors the existing Roadside / Pulled-over
// share-toggle patterns. Real backend hookup explicitly deferred.
//
// See docs/superpowers/specs/2026-05-31-unfamiliar-and-share-location-design.md.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fresh-greens.share-session.v1';

export type ShareSessionType = 'unfamiliar' | 'share-location';

export type ShareSession = {
  /** Synthetic id (`${type}-${Date.now()}`); stable across app kill, changes on each new startSession. */
  id: string;
  type: ShareSessionType;
  /** Verbatim user selection — "Just in case", "I'm lost", etc. */
  reason: string;
  /** ISO string; anchors the duration counter. */
  startedAtIso: string;
};

/** Returns null when no session active. Same shape as roadside-profile adapter. */
export async function getStoredShareSession(): Promise<ShareSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ShareSession;
  } catch (err) {
    console.warn('getStoredShareSession failed', err);
    return null;
  }
}

export async function setStoredShareSession(
  session: ShareSession,
): Promise<ShareSession> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function clearStoredShareSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
