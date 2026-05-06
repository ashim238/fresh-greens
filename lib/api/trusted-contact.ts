// Fresh Greens — trusted-contact adapter.
//
// Persists the user's chosen trusted contact — the person who gets
// notified during the safety / pulled-over flow and whose number the
// Call/Text buttons dial. Same architectural pattern as user.ts and
// community-reports.ts: typed `TrustedContact` shape, async public
// surface, AsyncStorage internals as the v1 backing store, with the
// backend-swap point clearly marked.
//
// Identity model is intentionally minimal. We store *only* what the
// app needs to display + dial — name, initials, phone number. We don't
// cache the full Contact returned by expo-contacts because:
//   1. That object can be huge (addresses, photos, social profiles —
//      irrelevant to safety dialing)
//   2. The OS contact may change after we cache it (renamed, number
//      updated). On every safety-flow entry we use what we stored;
//      a future "re-sync from OS" is its own concern.
//   3. Privacy. Less is more.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fresh-greens.trusted-contact.v1';

/**
 * The persisted trusted contact. `id` mirrors the contact's OS-assigned
 * identifier (returned by expo-contacts) so a future "re-sync" can map
 * back to the source. `phoneNumber` is whatever the OS gave us — usually
 * formatted (`+1 (212) 555-0123`), which `tel:` and `sms:` URIs accept
 * either way.
 */
export type TrustedContact = {
  id: string;
  name: string;
  /** Two-letter avatar string, derived at save time. */
  initials: string;
  phoneNumber: string;
  /** ms timestamp of when the user picked / last updated this contact. */
  setAt: number;
};

// --- Public surface ------------------------------------------------------

/** Reads the stored trusted contact, or null if none is set. */
export async function getTrustedContact(): Promise<TrustedContact | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrustedContact;
    if (!parsed.id || !parsed.phoneNumber) return null; // shape sanity-check
    return parsed;
  } catch (err) {
    console.warn('getTrustedContact failed', err);
    return null;
  }
}

/** Persists the trusted contact and returns the stored copy. */
export async function setTrustedContact(
  contact: TrustedContact,
): Promise<TrustedContact> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(contact));
  return contact;
}

/** Removes the stored trusted contact. */
export async function clearTrustedContact(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// --- Helpers -------------------------------------------------------------

/**
 * Two-letter avatar string from a contact's name. Tries given/family
 * (preferred — matches how users think of names), falls back to the
 * full-name string ("Myles A." or single-word names), falls back to "?"
 * if we have nothing usable.
 *
 * Mirrors lib/api/user.ts's deriveInitials but lives here because the
 * input shape is different (Contact has firstName/lastName as separate
 * fields; User stores them merged in displayName).
 */
export function deriveContactInitials(
  name: string,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f.length >= 2) return f.slice(0, 2).toUpperCase();
  // Fall back to parsing the full name — when the OS gave us only `name`
  // (no first/last split), e.g. some imported contacts.
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return '?';
}

/**
 * Picks the most-callable phone number from a contact's list. Prefers
 * the OS-flagged primary; falls back to the first entry with a number.
 * Returns null if the contact has no phones at all (rare but possible —
 * the picker doesn't filter on phone presence, so a contact with only
 * an email could come through).
 */
export function pickPrimaryPhoneNumber(
  phoneNumbers: { number?: string; isPrimary?: boolean }[] | undefined,
): string | null {
  if (!phoneNumbers || phoneNumbers.length === 0) return null;
  const primary = phoneNumbers.find((p) => p.isPrimary && p.number);
  if (primary?.number) return primary.number;
  const firstWithNumber = phoneNumbers.find((p) => p.number);
  return firstWithNumber?.number ?? null;
}
