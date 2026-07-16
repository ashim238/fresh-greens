import type { Coordinate, Zone, ZoneBounds, ZoneSourceId } from '../api/zones';
import { haversineMeters, pathLengthMeters, sampleAlongPath } from '../geo';
import { routePassesZone, routePointsForZoneTest } from '../scoring';
import {
  BBOX_PAD_METERS,
  CARDINAL_TOLERANCE_DEG,
  CLASSIFY_USE_DENSIFIED_POLYLINE,
  CORRIDOR_RADIUS_SPACING_FACTOR,
  GAP_ARC_METERS,
  GAP_MIN_UNCOVERED_METERS,
  HOT_LEG_RADIUS_FACTOR,
  HOT_LEG_ZONE_COUNT,
  LONG_TRIP_METERS,
  MAX_BEARING_DELTA_DEG,
  MAX_GAP_FILLS,
  MAX_SEGMENT_ANCHORS,
  MEGA_TRIP_PATH_METERS,
  MEGA_TRIP_WAVE1_ANCHOR_CAP,
  MIN_STRAIGHT_METERS,
  SEGMENT_MAX_RADIUS_M,
  SEGMENT_MIN_RADIUS_M,
  SEGMENT_TARGET_SPACING_M,
  SUPPORTED_511_STATE_SET,
  WAVE1_ANCHOR_CAP,
} from './constants';
import { dominantUsStateCode } from './dominant-state';
import type { CorridorPlan, CorridorPlanOptions, SampleRequest } from './types';

function corridorSourcesForBbox(
  bounds: ZoneBounds,
  legPoints: Coordinate[] | undefined,
  options: CorridorPlanOptions = {},
): ZoneSourceId[] {
  const sources: ZoneSourceId[] = ['osm-overpass'];
  const state = dominantUsStateCode(bounds, legPoints);
  if (state && SUPPORTED_511_STATE_SET.has(state)) {
    sources.push('dot-511');
  }
  // Mapbox incidents come from Directions `legs[].incidents` on the Route
  // object (lib/api/routes.ts), not corridor bbox samples.
  return sources;
}

/** Bearing degrees 0–360 from a → b. */
export function bearingDeg(a: Coordinate, b: Coordinate): number {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function bearingDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function isCardinal(meanBearing: number, toleranceDeg: number): boolean {
  const cardinals = [0, 90, 180, 270];
  return cardinals.some((c) => bearingDelta(meanBearing, c) <= toleranceDeg);
}

const METERS_PER_DEGREE_LAT = 111_320;
function metersPerDegreeLng(lat: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
}

export function boundsForPathSlice(
  points: Coordinate[],
  padMeters: number,
): ZoneBounds {
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.latitude);
    north = Math.max(north, p.latitude);
    west = Math.min(west, p.longitude);
    east = Math.max(east, p.longitude);
  }
  const midLat = (south + north) / 2;
  const padLat = padMeters / METERS_PER_DEGREE_LAT;
  const padLng = padMeters / metersPerDegreeLng(midLat);
  return {
    south: south - padLat,
    north: north + padLat,
    west: west - padLng,
    east: east + padLng,
  };
}

export type ClassifiedLeg =
  | { kind: 'straight'; points: Coordinate[]; bounds: ZoneBounds; legId: string }
  | { kind: 'curved'; points: Coordinate[]; legId: string };

function pathForClassify(path: Coordinate[]): Coordinate[] {
  return CLASSIFY_USE_DENSIFIED_POLYLINE ? routePointsForZoneTest(path) : path;
}

function circularMeanBearingDeg(sinSum: number, cosSum: number): number {
  return ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
}

export function classifyLegs(path: Coordinate[]): ClassifiedLeg[] {
  return classifyLegsOnPath(pathForClassify(path));
}

function classifyLegsOnPath(path: Coordinate[]): ClassifiedLeg[] {
  if (path.length < 2) return [];
  const legs: ClassifiedLeg[] = [];
  let runStart = 0;
  let runLen = 0;
  let bearingSinSum = 0;
  let bearingCosSum = 0;
  let prevBearing = bearingDeg(path[0], path[1]);

  for (let i = 1; i < path.length; i++) {
    const segBearing = bearingDeg(path[i - 1], path[i]);
    const segLen = pathLengthMeters([path[i - 1], path[i]]);
    const delta = bearingDelta(prevBearing, segBearing);

    if (i === 1 || delta <= MAX_BEARING_DELTA_DEG) {
      runLen += segLen;
      const rad = (segBearing * Math.PI) / 180;
      bearingSinSum += Math.sin(rad);
      bearingCosSum += Math.cos(rad);
      prevBearing = segBearing;
      continue;
    }

    pushLeg(path, runStart, i, runLen, bearingSinSum, bearingCosSum, legs);
    runStart = i - 1;
    runLen = segLen;
    const rad = (segBearing * Math.PI) / 180;
    bearingSinSum = Math.sin(rad);
    bearingCosSum = Math.cos(rad);
    prevBearing = segBearing;
  }
  pushLeg(path, runStart, path.length, runLen, bearingSinSum, bearingCosSum, legs);
  return legs;
}

function pushLeg(
  path: Coordinate[],
  startIdx: number,
  endIdx: number,
  runLen: number,
  bearingSinSum: number,
  bearingCosSum: number,
  legs: ClassifiedLeg[],
): void {
  const points = path.slice(startIdx, endIdx);
  if (points.length < 2) return;
  const legId = `leg-${legs.length}`;
  const meanBearing = circularMeanBearingDeg(bearingSinSum, bearingCosSum);
  if (
    runLen >= MIN_STRAIGHT_METERS &&
    isCardinal(meanBearing, CARDINAL_TOLERANCE_DEG)
  ) {
    legs.push({
      kind: 'straight',
      points,
      bounds: boundsForPathSlice(points, BBOX_PAD_METERS),
      legId,
    });
  } else {
    legs.push({ kind: 'curved', points, legId });
  }
}

export function corridorRadius(pathMeters: number): number {
  const anchorCount = Math.min(
    MAX_SEGMENT_ANCHORS,
    Math.max(8, Math.ceil(pathMeters / SEGMENT_TARGET_SPACING_M)),
  );
  const spacing = pathMeters / Math.max(1, anchorCount);
  const r = Math.floor(spacing * CORRIDOR_RADIUS_SPACING_FACTOR);
  return Math.min(
    SEGMENT_MAX_RADIUS_M,
    Math.max(SEGMENT_MIN_RADIUS_M, r),
  );
}

const LOCAL_COMPLEXITY_RADIUS_M = 5_000;
const DENSE_LOCAL_POINT_COUNT = 6;
const CURVE_SWING_DEG = 45;

function clampCorridorRadius(radiusMeters: number): number {
  return Math.min(
    SEGMENT_MAX_RADIUS_M,
    Math.max(SEGMENT_MIN_RADIUS_M, Math.floor(radiusMeters)),
  );
}

function localPathPoints(
  path: Coordinate[],
  center: Coordinate,
): Coordinate[] {
  return path.filter(
    (point) => haversineMeters(point, center) <= LOCAL_COMPLEXITY_RADIUS_M,
  );
}

function localBearingSwing(points: Coordinate[]): number {
  if (points.length < 3) return 0;
  let swing = 0;
  let previous = bearingDeg(points[0], points[1]);
  for (let i = 2; i < points.length; i++) {
    const current = bearingDeg(points[i - 1], points[i]);
    swing += bearingDelta(previous, current);
    previous = current;
  }
  return swing;
}

/**
 * Adaptive collection radius for one route sample.
 *
 * The base radius still comes from total route length, so alternatives follow
 * the same policy. Local geometry then tunes the radius: dense/curvy areas
 * tighten to avoid collecting evidence from adjacent roads, while sparse
 * long-route stretches can stay broader because there are fewer nearby road
 * ambiguities and fewer samples overall.
 */
export function adaptiveCorridorRadius(
  path: Coordinate[],
  pathMeters: number,
  center: Coordinate,
): number {
  const base = corridorRadius(pathMeters);
  const local = localPathPoints(path, center);
  const swing = localBearingSwing(local);
  let multiplier = 1;

  if (local.length >= DENSE_LOCAL_POINT_COUNT) {
    multiplier *= 0.8;
  }
  if (swing >= CURVE_SWING_DEG) {
    multiplier *= 0.75;
  }
  if (pathMeters > LONG_TRIP_METERS && local.length <= 3 && swing < CURVE_SWING_DEG) {
    multiplier *= 1.15;
  }

  return clampCorridorRadius(base * multiplier);
}

function wave1AnchorCap(pathMeters: number): number {
  return pathMeters > MEGA_TRIP_PATH_METERS
    ? MEGA_TRIP_WAVE1_ANCHOR_CAP
    : WAVE1_ANCHOR_CAP;
}

function wave1Anchors(path: Coordinate[], pathMeters: number): Coordinate[] {
  const anchorCount = Math.min(
    wave1AnchorCap(pathMeters),
    Math.max(8, Math.ceil(pathMeters / SEGMENT_TARGET_SPACING_M)),
    MAX_SEGMENT_ANCHORS,
  );
  const spacing = pathMeters / Math.max(1, anchorCount - 1);
  return sampleAlongPath(path, spacing, anchorCount);
}

function pointCoveredByBboxLeg(
  c: Coordinate,
  legs: ClassifiedLeg[],
): boolean {
  for (const leg of legs) {
    if (leg.kind !== 'straight') continue;
    const b = leg.bounds;
    if (
      c.latitude >= b.south &&
      c.latitude <= b.north &&
      c.longitude >= b.west &&
      c.longitude <= b.east
    ) {
      return true;
    }
  }
  return false;
}

export function planCorridor(
  path: Coordinate[],
  options: CorridorPlanOptions = {},
): CorridorPlan {
  const pathMeters = pathLengthMeters(path);
  const aroundSources: ZoneSourceId[] = ['osm-overpass'];

  if (pathMeters <= LONG_TRIP_METERS) {
    const bounds = boundsForPathSlice(path, 1500);
    return {
      wave1: [
        {
          kind: 'bbox',
          bounds,
          sources: corridorSourcesForBbox(bounds, path, options),
        },
      ],
      wave2: [],
      pathMeters,
    };
  }

  const legs = classifyLegs(path);
  const wave1: SampleRequest[] = [];
  for (const leg of legs) {
    if (leg.kind === 'straight') {
      wave1.push({
        kind: 'bbox',
        bounds: leg.bounds,
        sources: corridorSourcesForBbox(leg.bounds, leg.points, options),
        legId: leg.legId,
      });
    }
  }

  const anchors = wave1Anchors(path, pathMeters);
  for (const center of anchors) {
    if (pointCoveredByBboxLeg(center, legs)) continue;
    wave1.push({
      kind: 'around',
      center,
      radiusMeters: adaptiveCorridorRadius(path, pathMeters, center),
      sources: aroundSources,
    });
  }

  const cappedWave1 = wave1.slice(
    0,
    wave1AnchorCap(pathMeters) + legs.filter((l) => l.kind === 'straight').length,
  );
  return { wave1: cappedWave1, wave2: [], pathMeters };
}

export function planGapFills(
  path: Coordinate[],
  merged: Zone[],
  pathMeters: number,
): SampleRequest[] {
  const out: SampleRequest[] = [];
  let arcStartM = 0;
  while (arcStartM < pathMeters && out.length < MAX_GAP_FILLS) {
    const arcEndM = Math.min(pathMeters, arcStartM + GAP_ARC_METERS);
    if (arcEndM - arcStartM < GAP_MIN_UNCOVERED_METERS) break;
    const slice = slicePathByMeters(path, arcStartM, arcEndM);
    const hit = merged.some((z) => routePassesZone(slice, z));
    if (!hit) {
      const mid = slice[Math.floor(slice.length / 2)] ?? slice[0];
      if (mid) {
        out.push({
          kind: 'around',
          center: mid,
          radiusMeters: adaptiveCorridorRadius(path, pathMeters, mid),
          sources: ['osm-overpass'],
          legId: `gap-${out.length}`,
        });
      }
    }
    arcStartM = arcEndM;
  }
  return out;
}

/** Points along path from startM to endM (inclusive), for gap-fill / navigation arcs. */
export function slicePathByMeters(
  path: Coordinate[],
  startM: number,
  endM: number,
): Coordinate[] {
  if (path.length < 2) return path;
  const total = pathLengthMeters(path);
  const start = Math.max(0, Math.min(startM, total));
  const end = Math.max(start, Math.min(endM, total));
  if (end <= start) return [interpolateAlongPath(path, start)];

  const out: Coordinate[] = [];
  let accumulated = 0;
  for (let i = 1; i < path.length; i++) {
    const segLen = pathLengthMeters([path[i - 1], path[i]]);
    const segStart = accumulated;
    const segEnd = accumulated + segLen;
    if (segEnd < start) {
      accumulated = segEnd;
      continue;
    }
    if (segStart > end) break;
    if (out.length === 0) out.push(interpolateAlongPath(path, start));
    if (segEnd <= end) {
      out.push(path[i]);
    } else {
      out.push(interpolateAlongPath(path, end));
      break;
    }
    accumulated = segEnd;
  }
  if (out.length === 0) out.push(interpolateAlongPath(path, start));
  return out;
}

/** Linear interpolate by distance-along-path (meters). */
export function interpolateAlongPath(
  path: Coordinate[],
  targetM: number,
): Coordinate {
  if (path.length === 0) return { latitude: 0, longitude: 0 };
  if (path.length === 1 || targetM <= 0) return path[0];
  let accumulated = 0;
  for (let i = 1; i < path.length; i++) {
    const segLen = pathLengthMeters([path[i - 1], path[i]]);
    if (accumulated + segLen >= targetM) {
      const t = (targetM - accumulated) / Math.max(segLen, 1);
      return {
        latitude: path[i - 1].latitude + t * (path[i].latitude - path[i - 1].latitude),
        longitude:
          path[i - 1].longitude + t * (path[i].longitude - path[i - 1].longitude),
      };
    }
    accumulated += segLen;
  }
  return path[path.length - 1];
}

export function planHotLegTighten(
  wave1Results: { request: SampleRequest; zones: Zone[] }[],
  pathMeters: number,
): SampleRequest[] {
  const out: SampleRequest[] = [];
  const baseRadius = corridorRadius(pathMeters);
  const tight = Math.max(
    SEGMENT_MIN_RADIUS_M,
    Math.floor(baseRadius * HOT_LEG_RADIUS_FACTOR),
  );
  for (const { request, zones } of wave1Results) {
    if (zones.length < HOT_LEG_ZONE_COUNT) continue;
    if (request.kind === 'around') {
      out.push({ ...request, radiusMeters: tight, legId: `${request.legId ?? 'hot'}-tight` });
    }
  }
  return out;
}
