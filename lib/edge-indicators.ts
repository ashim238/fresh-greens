// Fresh Greens — edge-indicator math.
//
// Pure utilities for computing where to place an off-screen-POI
// arrow on the screen edge. No I/O, no React imports — same shape
// as lib/scoring.ts and lib/daylight.ts.
//
// The map screen uses these to: (1) decide whether a POI is in the
// viewport, (2) for off-viewport POIs, find the point on the screen
// rectangle the arrow sits at, and (3) the angle the arrow rotates
// to point at the POI.

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type Region = LatLng & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type EdgePosition = {
  /** Screen-space x in pt. */
  x: number;
  /** Screen-space y in pt. */
  y: number;
  /** Rotation in degrees, 0 = pointing right (toward +x). */
  rotation: number;
};

/**
 * Whether a lat/lng falls inside the visible map region. Compares
 * directly against the region's lat/lng bounds.
 */
export function isPointInRegion(point: LatLng, region: Region): boolean {
  const latMin = region.latitude - region.latitudeDelta / 2;
  const latMax = region.latitude + region.latitudeDelta / 2;
  const lngMin = region.longitude - region.longitudeDelta / 2;
  const lngMax = region.longitude + region.longitudeDelta / 2;
  return (
    point.latitude >= latMin &&
    point.latitude <= latMax &&
    point.longitude >= lngMin &&
    point.longitude <= lngMax
  );
}

/**
 * Where on the screen rectangle (inset by `padding`) does the ray
 * from screen center to the POI exit? Returns x/y in screen-space pt
 * plus the rotation needed to point an arrow toward the POI.
 *
 * The POI's lat/lng is converted to a screen-space point relative to
 * the region's center (which we treat as the screen center). We then
 * compute the bearing in screen pixels and clamp to the viewport
 * rectangle inset by `padding`.
 *
 * `insets` keeps the indicator off the absolute edge. Either a
 * uniform number (legacy callers) or per-side `{ top, right,
 * bottom, left }` for screens with asymmetric chrome — /home, for
 * example, has the search bar + menu button stacked at the top and
 * the Report/Recenter FAB stack on the right, so edge markers
 * landing in those regions would render BEHIND the chrome and read
 * as missing. Per-side insets push markers off those zones while
 * still letting them sit close to the unobstructed edges.
 */
export type EdgeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function edgePositionForPoint(
  point: LatLng,
  region: Region,
  viewport: ViewportSize,
  insets: EdgeInsets | number = 32,
): EdgePosition {
  // Normalize the legacy number form to a uniform inset object.
  const i: EdgeInsets =
    typeof insets === 'number'
      ? { top: insets, right: insets, bottom: insets, left: insets }
      : insets;

  // Convert point to screen-space relative to viewport center.
  // 1° of lat ≈ 1° of region.latitudeDelta = full viewport height.
  // Ditto for longitude.
  const dxLng = point.longitude - region.longitude;
  const dyLat = point.latitude - region.latitude;
  // Screen y inverts: higher latitude = lower y on screen.
  const dx = (dxLng / region.longitudeDelta) * viewport.width;
  const dy = -(dyLat / region.latitudeDelta) * viewport.height;

  // Rectangle clamp with per-side extents. The bearing's sign picks
  // which side it hits (right vs left for dx; bottom vs top for dy),
  // and the corresponding inset shortens that side's half-extent.
  const halfW = dx >= 0
    ? viewport.width / 2 - i.right
    : viewport.width / 2 - i.left;
  const halfH = dy >= 0
    ? viewport.height / 2 - i.bottom
    : viewport.height / 2 - i.top;
  const tx = halfW / Math.abs(dx || 1e-9);
  const ty = halfH / Math.abs(dy || 1e-9);
  const t = Math.min(tx, ty);
  const edgeDx = dx * t;
  const edgeDy = dy * t;

  return {
    x: viewport.width / 2 + edgeDx,
    y: viewport.height / 2 + edgeDy,
    rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

export type EdgeGroup<T> = {
  edge: EdgePosition;
  items: T[];
};

const ANGLE_THRESHOLD_DEG = 15;

/**
 * Groups off-screen items whose bearings fall within ANGLE_THRESHOLD_DEG
 * of each other into a single edge indicator. Returns the edge position
 * of the first item in each group (closest angular neighbor) plus all
 * members. Single-item groups are returned as-is.
 */
export function groupEdgeIndicators<T>(
  items: { item: T; edge: EdgePosition }[],
): EdgeGroup<T>[] {
  if (items.length === 0) return [];

  const used = new Set<number>();
  const groups: EdgeGroup<T>[] = [];

  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const group: T[] = [items[i].item];
    const anchor = items[i].edge;

    for (let j = i + 1; j < items.length; j++) {
      if (used.has(j)) continue;
      let delta = Math.abs(items[j].edge.rotation - anchor.rotation);
      if (delta > 180) delta = 360 - delta;
      if (delta <= ANGLE_THRESHOLD_DEG) {
        used.add(j);
        group.push(items[j].item);
      }
    }
    groups.push({ edge: anchor, items: group });
  }
  return groups;
}
