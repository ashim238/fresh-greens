import * as Contacts from 'expo-contacts';
import { useCallback, useEffect, useState } from 'react';

import {
  clearTrustedContact,
  deriveContactInitials,
  deriveContactName,
  getTrustedContact,
  pickPrimaryPhoneNumber,
  setTrustedContact,
  type TrustedContact,
} from '../lib/api/trusted-contact';

/**
 * Reactive wrapper around the trusted-contact adapter. Loads the stored
 * contact on mount and exposes a picker helper that opens iOS's native
 * contact picker, normalizes the response into our `TrustedContact`
 * shape, and persists it.
 *
 * Usage:
 *   const { contact, loading, pickContact, clearContact } = useTrustedContact();
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
 * scope while we're iPhone-first per CLAUDE.md.
 */
export function useTrustedContact() {
  const [contact, setContact] = useState<TrustedContact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getTrustedContact();
      if (!cancelled) {
        setContact(stored);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    });

    setContact(stored);
    return stored;
  }, []);

  const clearContact = useCallback(async () => {
    await clearTrustedContact();
    setContact(null);
  }, []);

  return { contact, loading, pickContact, clearContact };
}
