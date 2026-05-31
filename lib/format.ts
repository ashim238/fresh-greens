// Fresh Greens — display formatters.
//
// Pure functions for the user-visible strings that show up across
// /home, /en-route, and (eventually) trip-history surfaces. Same
// "no I/O, deterministic" shape as lib/scoring.ts and lib/daylight.ts.

/**
 * Trip duration. < 60 minutes shows as `"45 min"`. ≥ 60 minutes
 * switches to hours-and-minutes (`"1 hr 5 min"`); when the minute
 * remainder is zero, drops the "min" segment (`"2 hr"`). Matches
 * Apple/Google Maps wording.
 */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const remainder = m % 60;
  if (remainder === 0) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

/**
 * Trip distance in miles. < 1000 mi shows one decimal (`"12.4 mi."`).
 * ≥ 1000 mi rounds to the nearest mile, drops the decimal, and adds
 * a thousands separator (`"1,203 mi."`) — caps the readable distance
 * at four digits before the unit label and matches Apple/Google Maps
 * grouping for long trips.
 */
export function formatDistance(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return '—';
  if (miles >= 1000) return `${Math.round(miles).toLocaleString('en-US')} mi.`;
  return `${miles.toFixed(1)} mi.`;
}

/**
 * "X mi away" — recommendation-card proximity pill. Distinct from
 * `formatDistance` (trip metric) because the card variant:
 *   - Floors at 0.1mi as "<0.1 mi away" (GPS at urban density isn't
 *     precise enough to promise sub-tenth granularity to a driver)
 *   - Rounds to a whole at 10mi (not 1000) — Around Me cards
 *     surface places within ~10mi, so the decimal is meaningful
 *     under 10 and noise above it
 *   - Adds the "away" suffix that the en-route variant doesn't
 *     need (en-route distance reads as a trip metric, not a
 *     proximity statement)
 */
export function formatDistanceAway(miles: number): string {
  if (miles < 0.1) return '<0.1 mi away';
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}

/**
 * Time of day in 12-hour `"7:38 AM"` form — matches Figma's
 * "Schedule for X:XX AM" copy on /home and the iOS-native register
 * users see in Maps and Calendar. Uses Intl rather than hand-rolling
 * to inherit locale-correct AM/PM ordering and zero-padding.
 */
export function formatTimeOfDay(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format an elapsed-seconds count for a share-session duration display.
 *  < 60 min → "MM:SS"
 *  ≥ 60 min → "Hh MMm" (e.g. "1h 23m", "2h 04m")
 *
 * Stopwatch-honest at short durations; reads warmer than HH:MM:SS for
 * long-running sessions where the seconds are noise.
 *
 * Named `formatElapsedDuration` (not `formatDuration`) to coexist with
 * the existing minutes-based trip-duration formatter above.
 */
export function formatElapsedDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours === 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
}
