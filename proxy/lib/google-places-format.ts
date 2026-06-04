// Shared Google Places display helpers for proxy adapters.
// Extracted so place-details and searchText recs share one copy.

export function compactHoursLabel(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/closed/i.test(raw)) return 'Closed today';
  if (/24 hours|all day/i.test(raw)) return 'Open 24/7';
  const afterColon = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw;
  const m = afterColon.match(/–\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return raw;
  const closeHour = m[1];
  const closeMins = m[2] && m[2] !== '00' ? `:${m[2]}` : '';
  const ampm = m[3].toUpperCase();
  const isLateNight = ampm === 'AM' || (ampm === 'PM' && parseInt(closeHour, 10) >= 9);
  const prefix = isLateNight ? 'Open until' : 'Closes';
  return `${prefix} ${closeHour}${closeMins} ${ampm}`;
}

export function priceTierFor(
  level?:
    | 'PRICE_LEVEL_INEXPENSIVE'
    | 'PRICE_LEVEL_MODERATE'
    | 'PRICE_LEVEL_EXPENSIVE'
    | 'PRICE_LEVEL_VERY_EXPENSIVE',
): string | undefined {
  switch (level) {
    case 'PRICE_LEVEL_INEXPENSIVE':
      return '$';
    case 'PRICE_LEVEL_MODERATE':
      return '$$';
    case 'PRICE_LEVEL_EXPENSIVE':
      return '$$$';
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return '$$$$';
    default:
      return undefined;
  }
}
