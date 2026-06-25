// Fresh Greens — marker clustering.
//
// Pure functions for grouping nearby point-geometry zones into
// clusters at low zoom levels. Same shape as lib/scoring.ts and
// lib/edge-indicators.ts — no I/O, no React imports, deterministic.
//
// Clustering prevents overlapping markers from turning a dense
// neighborhood into visual noise. At high zoom, markers render
// individually. At low zoom, nearby markers collapse into a single
// cluster with a count badge.

import type { Coordinate, Zone } from './api/zones';
import type { Region } from './edge-indicators';

export type Cluster = {
  id: string;
  center: Coordinate;
  zones: Zone[];
  count: number;
};

export type ClusterOrZone =
  | { kind: 'zone'; zone: Zone }
  | { kind: 'cluster'; cluster: Cluster };

const CLUSTER_RADIUS_PX = 60;

export { CLUSTER_RADIUS_PX };

function lngDegreesPerPixel(region: Region, viewportWidth: number): number {
  return region.longitudeDelta / viewportWidth;
}

function latDegreesPerPixel(region: Region, viewportHeight: number): number {
  return region.latitudeDelta / viewportHeight;
}

/**
 * Groups nearby point zones into clusters based on screen-space
 * proximity. Two points within CLUSTER_RADIUS_PX pixels of each
 * other at the current zoom level merge into one cluster.
 *
 * Uses a greedy single-pass approach: iterate zones, assign each to
 * the first cluster whose center is within radius, or start a new
 * cluster. O(n×k) where k is the number of clusters — fine for the
 * expected report density (dozens, not thousands).
 */
export function clusterPointZones(
  zones: Zone[],
  region: Region,
  viewportWidth: number,
  viewportHeight: number,
): ClusterOrZone[] {
  const pointZones = zones.filter(
    (z) => z.geometry === 'point' && z.coordinates.length > 0,
  );

  if (pointZones.length === 0) return [];

  const dLng = lngDegreesPerPixel(region, viewportWidth);
  const dLat = latDegreesPerPixel(region, viewportHeight);
  const radiusLng = CLUSTER_RADIUS_PX * dLng;
  const radiusLat = CLUSTER_RADIUS_PX * dLat;

  const clusters: Cluster[] = [];

  for (const zone of pointZones) {
    const pt = zone.coordinates[0];
    let merged = false;

    for (const cluster of clusters) {
      const dlat = Math.abs(pt.latitude - cluster.center.latitude);
      const dlng = Math.abs(pt.longitude - cluster.center.longitude);

      if (dlat <= radiusLat && dlng <= radiusLng) {
        cluster.zones.push(zone);
        cluster.count = cluster.zones.length;
        // Recenter on the mean of all points in the cluster.
        let sumLat = 0;
        let sumLng = 0;
        for (const z of cluster.zones) {
          sumLat += z.coordinates[0].latitude;
          sumLng += z.coordinates[0].longitude;
        }
        cluster.center = {
          latitude: sumLat / cluster.zones.length,
          longitude: sumLng / cluster.zones.length,
        };
        merged = true;
        break;
      }
    }

    if (!merged) {
      clusters.push({
        id: `cluster-${zone.id}`,
        center: { ...pt },
        zones: [zone],
        count: 1,
      });
    }
  }

  return clusters.map((c) =>
    c.count === 1
      ? { kind: 'zone' as const, zone: c.zones[0] }
      : { kind: 'cluster' as const, cluster: c },
  );
}

/**
 * Camera region that zooms tight enough for greedy clustering to split
 * members apart on the next frame. Replaces the old `max(span*1.5, 0.005)`
 * floor, which kept dense clusters merged after tap.
 */
export function regionToRevealCoordinates(
  coordinates: Coordinate[],
  viewportWidth: number,
  viewportHeight: number,
): Region {
  if (coordinates.length === 0) {
    throw new Error('regionToRevealCoordinates requires at least one point');
  }

  const lats = coordinates.map((c) => c.latitude);
  const lngs = coordinates.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const spanLat = maxLat - minLat;
  const spanLng = maxLng - minLng;

  const minPxSeparation = CLUSTER_RADIUS_PX * 2.2;
  const paddingFactor = 1.6;

  const latDeltaFromSpan =
    spanLat > 0
      ? (spanLat * viewportHeight * paddingFactor) / minPxSeparation
      : 0;
  const lngDeltaFromSpan =
    spanLng > 0
      ? (spanLng * viewportWidth * paddingFactor) / minPxSeparation
      : 0;

  // Coincident pins can't split without spiderfy — block-scale zoom at least.
  const streetLatDelta = 0.0008;
  const streetLngDelta = 0.0008;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(latDeltaFromSpan, streetLatDelta),
    longitudeDelta: Math.max(lngDeltaFromSpan, streetLngDelta),
  };
}

export function regionToRevealCluster(
  cluster: Cluster,
  viewportWidth: number,
  viewportHeight: number,
): Region {
  return regionToRevealCoordinates(
    cluster.zones.map((z) => z.coordinates[0]),
    viewportWidth,
    viewportHeight,
  );
}
