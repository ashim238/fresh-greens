// Fresh Greens — Mapbox traffic incidents (B5).
//
// Primary path: parse `legs[].incidents` from the Directions API response
// we already fetch in lib/api/routes.ts (same EXPO_PUBLIC_MAPBOX_TOKEN,
// driving-traffic profile). No second HTTP call.

import { pathLengthMeters } from '../../geo';
import type { Coordinate, Zone, ZoneType } from '../zones';

/** Minimum span along the route polyline so incident length reads on the pill. */
const MIN_INCIDENT_SPAN_METERS = 160;

type MapboxLegIncident = {
  id?: string;
  type?: string;
  description?: string;
  long_description?: string;
  impact?: string;
  geometry_index_start?: number;
  geometry_index_end?: number;
};

type MapboxLeg = {
  incidents?: MapboxLegIncident[];
};

function impactToZoneType(impact?: string, incidentType?: string): ZoneType {
  switch (impact) {
    case 'critical':
    case 'major':
      return 'avoid';
    case 'minor':
    case 'low':
      return 'caution';
    default:
      break;
  }
  switch (incidentType) {
    case 'road_closure':
    case 'construction':
    case 'accident':
      return 'avoid';
    default:
      return 'caution';
  }
}

/**
 * Slice the route polyline for a Mapbox incident span. When start === end
 * (common), grow the slice along the route until it has a readable length.
 */
function sliceRouteCoordinates(
  coordinates: Coordinate[],
  startIdx: number,
  endIdx: number,
): Coordinate[] {
  if (coordinates.length === 0) return [];
  let start = Math.max(0, Math.min(startIdx, coordinates.length - 1));
  let end = Math.max(start, Math.min(endIdx, coordinates.length - 1));
  let slice = coordinates.slice(start, end + 1);

  while (
    pathLengthMeters(slice) < MIN_INCIDENT_SPAN_METERS &&
    (start > 0 || end < coordinates.length - 1)
  ) {
    if (end < coordinates.length - 1) {
      end += 1;
    } else if (start > 0) {
      start -= 1;
    } else {
      break;
    }
    slice = coordinates.slice(start, end + 1);
  }

  if (slice.length < 2 && coordinates.length >= 2) {
    start = Math.min(start, coordinates.length - 2);
    return coordinates.slice(start, start + 2);
  }
  return slice.length > 0 ? slice : [coordinates[start]];
}

function incidentLabel(inc: MapboxLegIncident): string {
  const text =
    inc.description?.trim() ||
    inc.long_description?.trim() ||
    inc.type?.replace(/_/g, ' ') ||
    'Traffic incident';
  const impact = inc.impact ? ` (${inc.impact})` : '';
  return `Traffic: ${text}${impact}`;
}

function incidentsOnCoordinates(
  incidents: MapboxLegIncident[],
  coordinates: Coordinate[],
  indexOffset: number,
): Zone[] {
  const zones: Zone[] = [];
  for (const inc of incidents) {
    if (!inc.id) continue;
    const start =
      indexOffset + (inc.geometry_index_start ?? 0);
    const end =
      indexOffset +
      (inc.geometry_index_end ?? inc.geometry_index_start ?? 0);
    const slice = sliceRouteCoordinates(coordinates, start, end);
    zones.push({
      id: `mapbox-inc-${inc.id}`,
      source: 'mapbox-incidents',
      type: impactToZoneType(inc.impact, inc.type),
      label: incidentLabel(inc),
      geometry: slice.length <= 1 ? 'point' : 'polyline',
      coordinates: slice,
      category: 'road-condition',
    });
  }
  return zones;
}

/**
 * Mapbox Directions `legs[].incidents` → zones on the route polyline.
 * Geometry indices are relative to each leg; we offset by prior leg
 * vertex counts (Fresh Greens trips are almost always a single leg).
 */
export function zonesFromMapboxLegIncidents(
  legs: MapboxLeg[],
  routeCoordinates: Coordinate[],
): Zone[] {
  if (routeCoordinates.length < 1 || legs.length === 0) return [];

  if (legs.length === 1) {
    return incidentsOnCoordinates(legs[0].incidents ?? [], routeCoordinates, 0);
  }

  const zones: Zone[] = [];
  const perLeg = Math.max(1, Math.floor(routeCoordinates.length / legs.length));
  let indexOffset = 0;
  for (const leg of legs) {
    zones.push(
      ...incidentsOnCoordinates(
        leg.incidents ?? [],
        routeCoordinates,
        indexOffset,
      ),
    );
    indexOffset += perLeg;
  }
  return zones;
}

/** Corridor bbox path retired — incidents come from Directions only. */
export async function fetchMapboxIncidentsForBbox(): Promise<Zone[]> {
  return [];
}

export function isMapboxIncidentsAvailable(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim());
}
