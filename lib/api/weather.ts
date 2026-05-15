// Fresh Greens — weather adapter.
//
// Uses Open-Meteo (https://open-meteo.com/) — free, no API key, no
// auth, no billing. Returns the current temperature in Fahrenheit
// and a derived "driving condition" tier from precipitation +
// visibility + wind.
//
// Why Open-Meteo over OpenWeatherMap or Google Weather: no API key
// means no proxy needed (the recommendations proxy exists because
// Google Places requires a server-side key; Open-Meteo doesn't),
// and the free tier is generous enough for thesis-scale traffic
// (10,000 requests/day, no card required).
//
// The driving condition is derived rather than fetched because no
// public API exposes a single "driving difficulty" tier — the
// metrics that matter (rain, wind, low visibility) are surfaced
// separately and we combine them ourselves.

export type DrivingCondition = 'easy' | 'moderate' | 'tough';

export type CurrentWeather = {
  /** Temperature in Fahrenheit, rounded to nearest integer. */
  temperatureF: number;
  /** Derived driving-condition tier. */
  drivingCondition: DrivingCondition;
  /** Human label for the driving condition (UI-ready). */
  drivingLabel: string;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    visibility?: number;
  };
};

/**
 * Maps raw weather metrics to one of three tiers. Thresholds tuned
 * to driving comfort, not weather severity:
 *
 *   easy     — clear precip, decent visibility, calm wind
 *   moderate — light rain, mild wind, or reduced (≥2km) visibility
 *   tough    — heavy rain, strong wind (>25mph), or fog (<2km vis)
 *
 * `visibility` in Open-Meteo is meters; `precipitation` is mm/h;
 * `wind_speed_10m` defaults to km/h (we request mph below).
 */
function drivingConditionFor(args: {
  precipMm: number;
  windMph: number;
  visibilityMeters: number;
}): DrivingCondition {
  const { precipMm, windMph, visibilityMeters } = args;
  if (precipMm >= 4 || windMph >= 25 || visibilityMeters < 2000) return 'tough';
  if (precipMm >= 0.5 || windMph >= 15 || visibilityMeters < 5000) return 'moderate';
  return 'easy';
}

function labelFor(c: DrivingCondition): string {
  switch (c) {
    case 'easy':
      return 'Easy';
    case 'moderate':
      return 'Moderate';
    case 'tough':
      return 'Tough';
  }
}

/**
 * Fetches current conditions for `(lat, lng)`. Returns null on
 * network / API failure; caller handles fallback (the existing
 * "66° / Moderate" mocked card was the visual placeholder).
 */
export async function getCurrentWeather(
  lat: number,
  lng: number,
): Promise<CurrentWeather | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,precipitation,wind_speed_10m,visibility',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
  });

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as OpenMeteoResponse;
    const c = data.current;
    if (!c || c.temperature_2m == null) return null;
    const drivingCondition = drivingConditionFor({
      precipMm: c.precipitation ?? 0,
      windMph: c.wind_speed_10m ?? 0,
      visibilityMeters: c.visibility ?? 10_000,
    });
    return {
      temperatureF: Math.round(c.temperature_2m),
      drivingCondition,
      drivingLabel: labelFor(drivingCondition),
    };
  } catch {
    return null;
  }
}
