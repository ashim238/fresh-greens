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
 * ≥ 1000 mi rounds to the nearest mile and drops the decimal
 * (`"1203 mi."`) — caps the readable distance at four digits before
 * the unit label.
 */
export function formatDistance(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return '—';
  if (miles >= 1000) return `${Math.round(miles)} mi.`;
  return `${miles.toFixed(1)} mi.`;
}
