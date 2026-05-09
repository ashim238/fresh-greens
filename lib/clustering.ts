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
