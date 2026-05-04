// Fresh Greens — zone data adapter (mock).
//
// This is the first inhabitant of the data layer. Every screen that needs
// external data will go through an adapter like this one, with the same
// shape:
//   - Typed inputs and outputs (no `any`).
//   - async function signature, even when mock — matches eventual real API.
//   - Mock returns can swap to real fetch() calls without touching consumers.
//
// When the real zone API is ready, replace the body of getZonesForRegion
// with a fetch() call. The function signature, the Zone type, and the
// rendering code in app/home.tsx don't change.

export type ZoneType = 'safe' | 'caution' | 'avoid';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type Zone = {
  id: string;
  type: ZoneType;
  label: string;
  /** Polygon perimeter — closed loop of lat/lng points */
  coordinates: Coordinate[];
};

/**
 * Fetches safety zones around a given map center.
 *
 * Returns mock data for now. The 100ms simulated delay matches what
 * a real network call would feel like, so any loading-state behavior
 * we build against this adapter still works once we swap to a real API.
 */
export async function getZonesForRegion(center: Coordinate): Promise<Zone[]> {
  await delay(100);

  return [
    {
      id: 'mock-safe-1',
      type: 'safe',
      label: 'Well-lit residential area',
      coordinates: rectangleNear(center, 0.001, 0.001, 0.005, 0.005),
    },
    {
      id: 'mock-caution-1',
      type: 'caution',
      label: 'Moderate visibility, weekend traffic',
      coordinates: rectangleNear(center, -0.005, 0.001, -0.001, 0.005),
    },
    {
      id: 'mock-avoid-1',
      type: 'avoid',
      label: 'Recent incident reports',
      coordinates: rectangleNear(center, -0.003, -0.005, 0.001, -0.001),
    },
  ];
}

/**
 * Display colors for each zone type. Reserved colors used here as
 * legitimate UI safety signals (per .cursorrules — that's exactly
 * the use case the reserved-color rule allows).
 *
 * Fill is translucent so the map underneath stays readable; stroke
 * is more opaque so zone boundaries are visible.
 */
export const zoneColors: Record<ZoneType, { fill: string; stroke: string }> = {
  safe: {
    fill: 'rgba(65, 173, 73, 0.25)', // freshgreen
    stroke: 'rgba(65, 173, 73, 0.7)',
  },
  caution: {
    fill: 'rgba(255, 204, 0, 0.25)', // yellow
    stroke: 'rgba(255, 204, 0, 0.7)',
  },
  avoid: {
    fill: 'rgba(255, 59, 48, 0.25)', // red
    stroke: 'rgba(255, 59, 48, 0.7)',
  },
};

// --- Helpers ----------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds a rectangular polygon (4 corners) near a center point, using
 * degree offsets. 0.001 degree of latitude ≈ 111 meters.
 */
function rectangleNear(
  center: Coordinate,
  swLatOffset: number,
  swLngOffset: number,
  neLatOffset: number,
  neLngOffset: number,
): Coordinate[] {
  return [
    {
      latitude: center.latitude + swLatOffset,
      longitude: center.longitude + swLngOffset,
    },
    {
      latitude: center.latitude + neLatOffset,
      longitude: center.longitude + swLngOffset,
    },
    {
      latitude: center.latitude + neLatOffset,
      longitude: center.longitude + neLngOffset,
    },
    {
      latitude: center.latitude + swLatOffset,
      longitude: center.longitude + neLngOffset,
    },
  ];
}
