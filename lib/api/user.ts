// Fresh Greens — user / auth adapter.
//
// Persists the signed-in user identity. Mock-first in the same sense the
// community-reports adapter is: AsyncStorage-backed today; a real backend
// (Supabase/Firestore/custom API) would slot in by replacing the read/
// write internals here. Public surface (`getStoredUser`, `setStoredUser`,
// `clearStoredUser`) keeps the same signatures regardless of where the
// identity actually lives.
//
// Identity model is intentionally minimal: a stable provider-issued user
// ID plus optional display name and email. Apple Sign In returns
// `fullName` and `email` only on the user's first sign-in to the app —
// after that, only the stable `id` comes back. We cache the
// first-sign-in details here so subsequent sessions still know who the
// user is.
//
// `initials` is precomputed at sign-in (rather than derived on every
// render) so the contact-style avatars across the app — currently the
// hardcoded "MA" placeholder on /pulled-over's contact phase — can read
// straight off the stored value.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_KEY = 'fresh-greens.user.v1';

export type AuthProvider = 'apple' | 'google' | 'email';

/**
 * The signed-in user. `id` is the only required field after sign-in;
 * `displayName` and `email` may be null for returning Apple sign-ins
 * (Apple only returns those on the first sign-in by design).
 */
export type User = {
  id: string;
  provider: AuthProvider;
  displayName: string | null;
  email: string | null;
  /** Two-letter avatar string. Derived from displayName at sign-in. */
  initials: string;
  /** documentDirectory URI of a user-set avatar photo, or null/undefined
      for the illustrated placeholder. Set via the /menu profile editor;
      preserved across sign-in merges so re-auth doesn't wipe it. */
  avatarUri?: string | null;
  /** ms timestamp of the latest successful sign-in. */
  signedInAt: number;
};

export type StoredUserRead =
  | { kind: 'missing' }
  | { kind: 'found'; user: User };

export type UserProfilePatch = Partial<
  Pick<User, 'displayName' | 'avatarUri'>
>;

export class StoredUserCorruptError extends Error {
  constructor() {
    super('Stored account identity is invalid');
    this.name = 'StoredUserCorruptError';
  }
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    user.id.trim().length > 0 &&
    (user.provider === 'apple' ||
      user.provider === 'google' ||
      user.provider === 'email') &&
    (typeof user.displayName === 'string' || user.displayName === null) &&
    (typeof user.email === 'string' || user.email === null) &&
    typeof user.initials === 'string' &&
    typeof user.signedInAt === 'number'
  );
}

// --- Public surface ------------------------------------------------------

/** Reads the stored user, or null if no one is signed in. */
export async function getStoredUser(): Promise<User | null> {
  const read = await readStoredUserStrict();
  return read.kind === 'found' ? read.user : null;
}

export async function readStoredUserStrict(): Promise<StoredUserRead> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { kind: 'missing' };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isUser(parsed)) throw new StoredUserCorruptError();
    return { kind: 'found', user: parsed };
  } catch (error) {
    if (error instanceof StoredUserCorruptError) throw error;
    throw new StoredUserCorruptError();
  }
}

/** Persists the user and returns the stored copy. */
export async function setStoredUser(user: User): Promise<User> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export async function persistSignedInUser(user: User): Promise<User> {
  return setStoredUser(user);
}

/** Removes the stored user (sign-out). */
export async function clearStoredUser(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function purgeStoredUserForAccount(): Promise<void> {
  await clearStoredUser();
}

/** Removes app-owned profile avatar files, including orphaned prior versions. */
export async function purgeAvatarFilesForAccount(): Promise<void> {
  await FileSystem.deleteAsync(`${FileSystem.documentDirectory}avatars/`, {
    idempotent: true,
  });
}

/**
 * Merges new auth data with any existing stored user. The merge is
 * "newest-wins, but don't overwrite a real value with null" — important
 * for Apple's first-sign-in / returning-sign-in behavior, where the
 * second sign-in returns `null` for fullName/email and we want to keep
 * the cached values from the first one.
 */
export async function upsertUser(
  partial: Pick<User, 'id' | 'provider'> &
    Partial<Pick<User, 'displayName' | 'email'>>,
  options: { migrateFromId?: string } = {},
): Promise<User> {
  const existing = await getStoredUser();
  const sameAccount =
    existing?.id === partial.id || existing?.id === options.migrateFromId;
  const displayName = partial.displayName ?? (sameAccount ? existing?.displayName : null) ?? null;
  const email = partial.email ?? (sameAccount ? existing?.email : null) ?? null;
  return setStoredUser({
    id: partial.id,
    provider: partial.provider,
    displayName,
    email,
    initials: deriveInitials(displayName, email),
    // Keep a user-set avatar across re-auth — the same newest-wins-but-
    // don't-clobber logic as displayName/email.
    avatarUri: sameAccount ? existing?.avatarUri ?? null : null,
    signedInAt: Date.now(),
  });
}

/**
 * Patches the stored user's editable profile fields — display name
 * and/or avatar photo — without touching auth identity. Re-derives
 * initials when the name changes. Returns the updated user, or null if
 * no user is stored. Passing a field is opt-in: an omitted key is left
 * unchanged; a trimmed-empty displayName clears the name back to null
 * (greeting falls through to email local-part, then "friend").
 */
export async function updateUserProfile(patch: {
  displayName?: string | null;
  avatarUri?: string | null;
}): Promise<User | null> {
  const existing = await getStoredUser();
  if (!existing) return null;
  return updateStoredUserProfile(existing.id, patch);
}

export async function updateStoredUserProfile(
  userId: string,
  patch: UserProfilePatch,
): Promise<User> {
  const existing = await getStoredUser();
  if (!existing || existing.id !== userId) {
    throw new Error('Cannot update profile for a different signed-in user');
  }
  const displayName =
    patch.displayName !== undefined
      ? patch.displayName?.trim() || null
      : existing.displayName;
  const avatarUri =
    patch.avatarUri !== undefined ? patch.avatarUri : existing.avatarUri ?? null;
  const merged: User = {
    ...existing,
    displayName,
    avatarUri,
    initials: deriveInitials(displayName, existing.email),
  };
  return setStoredUser(merged);
}

// --- Helpers -------------------------------------------------------------

/**
 * Two-letter avatar string. Tries the display name first ("Myles
 * Ashitey" → "MA"); falls back to the first two letters of the email
 * local-part; falls back to "?" if we have neither (rare — usually means
 * a returning Apple sign-in for someone who never had a name on file).
 */
export function deriveInitials(
  displayName: string | null,
  email: string | null,
): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }
  if (email) {
    const local = email.split('@')[0] ?? '';
    if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  }
  return '?';
}
