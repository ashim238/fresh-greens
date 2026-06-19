import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import { useCallback } from 'react';

import {
  clearTrustedContact,
  deriveContactInitials,
  deriveContactName,
  getTrustedContact,
  pickPrimaryPhoneNumber,
  setTrustedContact,
  type TrustedContact,
} from '../lib/api/trusted-contact';
import { useHydratedState } from './useHydratedState';

/**
 * Tries to geocode the first postal address on a Contact. Requests
 * Contacts read permission to re-fetch the contact with Addresses
 * (the picker doesn't return addresses by default). All failure
 * modes — permission denied, no address, geocode fail — degrade
 * silently to "no location captured." The hook ships the contact
 * either way.
 */
async function tryCaptureContactLocation(
  contactId: string,
): Promise<{ latitude: number; longitude: number; addressLabel?: string } | null> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== Contacts.PermissionStatus.GRANTED) return null;

    const detailed = await Contacts.getContactByIdAsync(contactId, [
      Contacts.Fields.Addresses,
    ]);
    const address = detailed?.addresses?.[0];
    if (!address) return null;

    // Compose a single-line query out of whatever fields the contact has.
    // expo-location's geocoder accepts free-form text so partials still
    // resolve (a contact with only "City, State" geocodes to the city).
    const query = [
      address.street,
      address.city,
      address.region,
      address.postalCode,
      address.country,
    ]
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(', ');
    if (!query) return null;

    const results = await Location.geocodeAsync(query);
    const hit = results[0];
    if (!hit) return null;

    return {
      latitude: hit.latitude,
      longitude: hit.longitude,
      addressLabel: address.label ?? undefined,
    };
  } catch (err) {
    console.warn('tryCaptureContactLocation failed', err);
    return null;
  }
}

/**
 * Reactive wrapper around the trusted-contact adapter. Hydrates from
 * AsyncStorage on mount (and re-reads on focus) via useHydratedState.
 * Returns a discriminated union on the `ready` flag so callers cannot
 * accidentally read `.contact` before hydration settles — the flash bug
 * is a compile error rather than a convention.
 *
 * Usage:
 *   const state = useTrustedContact();
 *   if (!state.ready) return; // hydrating
 *   const { contact, pickContact, clearContact } = state;
 *
 * `pickContact` returns:
 *   - the freshly-stored TrustedContact on success
 *   - `null` if the user dismissed the picker without selecting
 *   - throws on a real failure (rare — picker errors are unusual)
 *
 * The caller decides what to do post-pick. The hook just owns identity.
 *
 * Note: presentContactPickerAsync is iOS-only. On Android the picker
 * promise resolves to null. A future Android-friendly path would
 * request CONTACTS permission and roll its own picker UI; not in
 * scope while we're iPhone-first per docs/architecture.md.
 */
type TrustedContactWrites = {
  pickContact: () => Promise<TrustedContact | null>;
  clearContact: () => Promise<void>;
};

export type TrustedContactState = TrustedContactWrites &
  ({ ready: false } | { ready: true; contact: TrustedContact | null });

export function useTrustedContact(): TrustedContactState {
  const hydrated = useHydratedState<TrustedContact | null>(getTrustedContact);

  const pickContact = useCallback(async (): Promise<TrustedContact | null> => {
    const picked = await Contacts.presentContactPickerAsync();
    if (!picked) return null;

    const phoneNumber = pickPrimaryPhoneNumber(picked.phoneNumbers);
    if (!phoneNumber) {
      throw new Error(
        'Selected contact has no phone number. Pick a different contact.',
      );
    }

    const name = deriveContactName(
      picked.name,
      picked.firstName,
      picked.lastName,
      phoneNumber,
    );

    // Best-effort: try to capture the contact's home location for the
    // Trusted Friend marker on /home. Runs after picking so we never
    // block the picker UX on permission prompts. If it succeeds, lat/
    // lng get persisted alongside the rest of the contact identity.
    const location = await tryCaptureContactLocation(picked.id);

    const stored = await setTrustedContact({
      id: picked.id,
      name,
      initials: deriveContactInitials(
        name,
        picked.firstName,
        picked.lastName,
      ),
      phoneNumber,
      setAt: Date.now(),
      latitude: location?.latitude,
      longitude: location?.longitude,
      addressLabel: location?.addressLabel,
    });

    hydrated.setData(stored);
    return stored;
  }, [hydrated.setData]);

  const clearContact = useCallback(async () => {
    // Await-first (clear storage, then drop local state) preserves the
    // original hook's ordering. Note usePreferences.clearAll is optimistic
    // (setData first) — each hook keeps its own prior order; don't unify.
    await clearTrustedContact();
    hydrated.setData(null);
  }, [hydrated.setData]);

  if (!hydrated.ready) {
    return { ready: false, pickContact, clearContact };
  }
  return { ready: true, contact: hydrated.data, pickContact, clearContact };
}
