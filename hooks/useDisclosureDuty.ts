import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import {
  detectUserState,
  getDisclosureDuty,
  type DisclosureDuty,
} from '../lib/api/gun-laws';

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

/**
 * Reactive wrapper around the gun-laws adapter. On mount, fetches the
 * device's current position (one-shot, not a watcher), reverse-geocodes
 * it to a US state code, and resolves to a `DisclosureDuty` variant the
 * `/pulled-over` flow consumes.
 *
 * Defaults to `'duty-to-inform'` while loading and on every failure
 * path (no permission, no fix, mid-ocean, geocoder error, outside the
 * US). See `getDisclosureDuty`'s JSDoc for the safer-default
 * rationale: in the duty-to-inform/no-duty asymmetry, following duty-
 * to-inform copy in a no-duty state is legal-but-unnecessary, while
 * following no-duty copy in a duty-to-inform state is unlawful.
 *
 * Why self-fetch rather than accept coords as a prop:
 *   `/pulled-over` doesn't have a parent that already holds the
 *   user's coordinates — it's a modal entered directly from /safety.
 *   When a future consumer DOES have coords on hand (e.g. wired into
 *   the home-screen route context), we can add an overload that
 *   accepts them, but for the current single consumer there's no
 *   coord source to thread through.
 *
 * Permission posture:
 *   Location permission was already requested during /permissions
 *   (onboarding). If the user denied it, `getCurrentPositionAsync`
 *   rejects, we swallow the error, and the hook stays on the
 *   safer-default variant. No re-prompt mid-stop — that would be
 *   intrusive and out-of-context.
 */
export function useDisclosureDuty(): {
  duty: DisclosureDuty;
  loading: boolean;
  stateName: string | null;
} {
  const [duty, setDuty] = useState<DisclosureDuty>('duty-to-inform');
  const [loading, setLoading] = useState(true);
  const [stateName, setStateName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Low-accuracy fix is sufficient — we only need state-level
        // resolution, and Lowest avoids spinning up high-power GPS for
        // a ~3km+ accuracy use case. Falls back to whatever cached
        // fix the OS has if a fresh one isn't immediately available.
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Lowest,
        });
        if (cancelled) return;
        const stateCode = await detectUserState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (cancelled) return;
        setDuty(getDisclosureDuty(stateCode));
        setStateName(stateCode ? (STATE_NAMES[stateCode] ?? stateCode) : null);
      } catch (err) {
        // Soft-fail: stay on the safer default.
        console.warn('[useDisclosureDuty] could not resolve state', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { duty, loading, stateName };
}
