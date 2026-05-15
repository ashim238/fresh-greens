import { useEffect, useState } from 'react';

import { getCurrentWeather, type CurrentWeather } from '../lib/api/weather';

/**
 * Reactive wrapper around the Open-Meteo weather adapter. Fetches
 * current temperature + driving condition for the user's lat/lng.
 * Returns null while in flight or on API failure — the consumer
 * (HomeBrowseSheet WeatherDrivingCard) decides what to render in
 * that case (typically the prior mocked "66° / Moderate" still
 * showed something; we keep that as the loading-state fallback so
 * the card never disappears).
 *
 * Re-fetches on a ~0.5mi geo-grid bucket (same rounding strategy as
 * useRecommendations) so jittery GPS doesn't trigger redundant API
 * calls.
 */
export function useWeather(
  userLocation: { latitude: number; longitude: number } | null | undefined,
) {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [loading, setLoading] = useState(false);

  const gridLat = userLocation ? Math.round(userLocation.latitude * 200) / 200 : null;
  const gridLng = userLocation ? Math.round(userLocation.longitude * 200) / 200 : null;

  useEffect(() => {
    if (!userLocation) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const w = await getCurrentWeather(userLocation.latitude, userLocation.longitude);
      if (!cancelled) {
        setWeather(w);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridLat, gridLng]);

  return { weather, loading };
}
