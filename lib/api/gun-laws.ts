// Fresh Greens — gun-laws adapter.
//
// Maps a US state → the firearm-disclosure duty that applies during a
// traffic stop. The `/pulled-over` flow reads from this to pick which
// firearm-related guidance copy to show in its "Read the following"
// bullets and the "What to Say" review sub-view.
//
// Why this exists as an adapter:
//   The v1 firearm copy was written for Alabama best-practice (a
//   duty-to-inform state — proactive disclosure is expected). That
//   register is actively wrong in no-duty states (California, NY, IL,
//   etc.) where volunteering firearm presence can escalate an
//   otherwise routine stop. State law is the new input dimension; the
//   pulled-over copy dispatch already branches on `armed=yes` vs
//   `armed=no`, so disclosure-duty slots in as a second branch.
//
// Why static + no network call:
//   Gun-disclosure law is statutory — it changes on a legislative
//   timescale (years), not a real-time one. Encoding it as a Record
//   means we get type-system coverage that every US state is mapped,
//   no API rate limits, no offline-failure mode in the middle of a
//   stress flow, and zero new dependencies. The maintenance cost of
//   keeping a static map up to date is far below the cost of operating
//   a real lookup service for thesis-demo traffic.
//
// Privacy:
//   The user's state is derived from on-device coordinates via
//   `Location.reverseGeocodeAsync` (Apple's local geocoder on iOS).
//   No external service sees the coords; the only output of this
//   module is a 2-letter state code, which the caller maps to a
//   guidance variant locally.

import * as Location from 'expo-location';

/**
 * The three disclosure regimes the app distinguishes between. Narrower
 * categorizations exist in the legal literature (permit-conditional,
 * stop-and-identify interactions, etc.) but this triad is what the
 * pulled-over copy dispatch actually consumes — adding more would
 * require copy variants we don't have.
 */
export type DisclosureDuty = 'duty-to-inform' | 'no-duty' | 'asked-only';

/**
 * All 50 states + DC, as 2-letter postal codes. Internal — exposed to
 * the module only to type the `STATE_DUTIES` record so the compiler
 * enforces "every state is mapped exactly once."
 */
type USStateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL'
  | 'GA' | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME'
  | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH'
  | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI'
  | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI'
  | 'WY';

/**
 * Statutory disclosure duty by state. Sourced from state concealed-
 * carry statutes (current as of 2026-05). Every state appears exactly
 * once — using `Record<USStateCode, DisclosureDuty>` makes "add a new
 * state to the union, forget to map it" a compile-time error.
 *
 * Buckets:
 *   - duty-to-inform: proactive disclosure required by statute when
 *     stopped while carrying.
 *   - no-duty: no statutory disclosure duty; volunteering firearm
 *     presence can escalate the stop and is widely advised against
 *     by no-duty-state CCW instructors.
 *   - asked-only: no statutory duty to proactively inform, but the
 *     driver must answer honestly if directly asked. Default
 *     pragmatic posture for states with no explicit statute.
 */
const STATE_DUTIES: Record<USStateCode, DisclosureDuty> = {
  // duty-to-inform — statutory proactive disclosure
  AL: 'duty-to-inform',
  AK: 'duty-to-inform',
  AZ: 'duty-to-inform',
  AR: 'duty-to-inform',
  LA: 'duty-to-inform',
  MI: 'duty-to-inform',
  MS: 'duty-to-inform',
  NC: 'duty-to-inform',
  NE: 'duty-to-inform',
  ND: 'duty-to-inform',
  OH: 'duty-to-inform',
  OK: 'duty-to-inform',
  SC: 'duty-to-inform',
  TN: 'duty-to-inform',
  TX: 'duty-to-inform',
  // no-duty — proactive disclosure not required; can escalate
  CA: 'no-duty',
  NY: 'no-duty',
  IL: 'no-duty',
  NJ: 'no-duty',
  MA: 'no-duty',
  MD: 'no-duty',
  CT: 'no-duty',
  HI: 'no-duty',
  RI: 'no-duty',
  DE: 'no-duty',
  MN: 'no-duty',
  IA: 'no-duty',
  OR: 'no-duty',
  WA: 'no-duty',
  CO: 'no-duty',
  NV: 'no-duty',
  NM: 'no-duty',
  VA: 'no-duty',
  DC: 'no-duty',
  // asked-only — no proactive duty, must answer if asked
  FL: 'asked-only',
  GA: 'asked-only',
  ID: 'asked-only',
  IN: 'asked-only',
  KS: 'asked-only',
  KY: 'asked-only',
  ME: 'asked-only',
  MO: 'asked-only',
  MT: 'asked-only',
  NH: 'asked-only',
  PA: 'asked-only',
  SD: 'asked-only',
  UT: 'asked-only',
  VT: 'asked-only',
  WV: 'asked-only',
  WI: 'asked-only',
  WY: 'asked-only',
};

/**
 * Look up the disclosure duty for a US state code. Accepts unknown /
 * non-state strings (foreign territories, blank values, garbled
 * reverse-geocode output) and falls through to the conservative
 * default — see `getDisclosureDuty` JSDoc for the rationale.
 *
 * The signature accepts `string | null | undefined` instead of
 * `USStateCode` because the input crosses an external boundary
 * (reverse-geocoding output) and isn't pre-validated.
 */
export function getDisclosureDuty(
  stateCode: string | null | undefined,
): DisclosureDuty {
  // Safer-default rationale: when we don't know the law, the
  // duty-to-inform copy ("Tell the officer you have a firearm and
  // where it is") is conservative — it errs toward over-compliance
  // with police authority rather than toward silence. In a no-duty
  // state, following duty-to-inform copy is unnecessary but legal;
  // in a duty-to-inform state, following no-duty copy is unlawful and
  // can result in a separate charge. Asymmetric error cost → default
  // to over-disclosure when uncertain.
  if (!stateCode) return 'duty-to-inform';
  const upper = stateCode.toUpperCase();
  if (upper in STATE_DUTIES) {
    return STATE_DUTIES[upper as USStateCode];
  }
  return 'duty-to-inform';
}

/**
 * Resolves the user's current US state code from coordinates using
 * the OS-level reverse geocoder. Returns null if:
 *   - no coords were provided
 *   - permission isn't granted (caller's responsibility to handle)
 *   - the geocoder returned no results (mid-ocean, etc.)
 *   - the result is outside the US (no `region` we recognize)
 *
 * Null is the explicit "unknown" signal so the caller can route it
 * through `getDisclosureDuty(null)` and get the safer default.
 *
 * Side-effects:
 *   - Calls `Location.reverseGeocodeAsync`, which on iOS hits the OS-
 *     level CLGeocoder. No external network service sees the coords.
 */
export async function detectUserState(
  coords?: { latitude: number; longitude: number },
): Promise<string | null> {
  if (!coords) return null;
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    // `region` on iOS is the state name ("Alabama") OR the postal
    // abbreviation ("AL") depending on locale; we normalize either to
    // a 2-letter code if possible.
    const region = results[0]?.region;
    if (!region) return null;
    const trimmed = region.trim();
    if (trimmed.length === 2) return trimmed.toUpperCase();
    const fromName = STATE_NAME_TO_CODE[trimmed.toLowerCase()];
    return fromName ?? null;
  } catch (err) {
    console.warn('[gun-laws] detectUserState failed', err);
    return null;
  }
}

/**
 * Lowercased state-name → postal-code map. Locale-tolerant lookup for
 * geocoders that return the full state name in `region` rather than
 * the abbreviation. DC is included because Location's `region` field
 * sometimes uses "District of Columbia" verbatim.
 */
const STATE_NAME_TO_CODE: Record<string, USStateCode> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR',
  california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME',
  maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE',
  nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

// --- Copy variants -------------------------------------------------------

/**
 * Firearm guidance copy, one variant per disclosure duty. Parallel
 * structure across all three: each opens with the same "hands visible
 * on the steering wheel" instruction, then the disclosure language
 * varies by duty.
 *
 * Single source of truth — both the guidance phase and the What-to-
 * Say review sub-view in `/pulled-over` consume from this same record,
 * so the copy can't drift between the two surfaces.
 *
 * Fields:
 *   - guidanceBullet: shown as a single bullet on the guidance phase,
 *     short enough to scan during the moment of the stop.
 *   - sayBullets: shown as 1–2 bullets on the "What to Say" review
 *     sub-view. Slightly more script-flavored — these are quotables
 *     the user can re-read after the stop. The first entry is the
 *     primary script; the second (if present) is a paired
 *     instruction. Splitting into two bullets matches the existing
 *     "quote then instruction" shape the v1 What-to-Say view used.
 */
/**
 * A `sayBullet` is either a plain string or a structured segment with
 * one emphasized fragment flanked by optional unstyled lead/trail
 * text. The structured shape lets us bold the literal phrase the user
 * should speak (e.g. the exact disclosure script) while keeping the
 * surrounding context regular — single-fragment emphasis only, since
 * multiple-bold within a stress-state bullet collapses to noise.
 */
export type SayBullet =
  | string
  | { lead?: string; emphasized: string; trail?: string };

type FirearmGuidance = {
  guidanceBullet: string;
  sayBullets: SayBullet[];
};

export const FIREARM_GUIDANCE: Record<DisclosureDuty, FirearmGuidance> = {
  'duty-to-inform': {
    guidanceBullet:
      "Keep both hands visible on the steering wheel. Tell the officer you have a firearm and where it is.",
    sayBullets: [
      'Keep both hands visible on the steering wheel.',
      {
        // Emphasizes the exact words the driver should say so the eye
        // catches the script-line under stress; surrounding instruction
        // stays regular. Single-emphasis only — see SayBullet docstring.
        emphasized:
          '"Officer, I have a valid concealed carry permit and am currently carrying a firearm."',
        trail:
          ' Tell the officer exactly where it is before reaching for anything.',
      },
    ],
  },
  'no-duty': {
    guidanceBullet:
      "Keep both hands visible on the steering wheel. You're not required to volunteer information about a firearm. If asked, answer honestly and calmly.",
    sayBullets: [
      "You're not required to volunteer information about a firearm. Keep both hands visible on the steering wheel.",
      'If the officer asks, answer honestly and tell them where it is before reaching for anything.',
    ],
  },
  'asked-only': {
    guidanceBullet:
      "Keep both hands visible on the steering wheel. If the officer asks about a firearm, answer honestly and tell them where it is before reaching for anything.",
    sayBullets: [
      'Keep both hands visible on the steering wheel.',
      'If the officer asks about a firearm, answer honestly and tell them where it is before reaching for anything.',
    ],
  },
};
