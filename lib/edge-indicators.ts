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
 * `padding` keeps the indicator off the absolute edge — useful for
 * notches, status bars, and just visually pleasant breathing room.
 */
export function edgePositionForPoint(
  point: LatLng,
  region: Region,
  viewport: ViewportSize,
  padding = 32,
): EdgePosition {
  // Convert point to screen-space relative to viewport center.
  // 1° of lat ≈ 1° of region.latitudeDelta = full viewport height.
  // Ditto for longitude.
  const dxLng = point.longitude - region.longitude;
  const dyLat = point.latitude - region.latitude;
  // Screen y inverts: higher latitude = lower y on screen.
  const dx = (dxLng / region.longitudeDelta) * viewport.width;
  const dy = -(dyLat / region.latitudeDelta) * viewport.height;

  // Rectangle clamp: scale (dx, dy) so the result lands on the
  // padded viewport edge. The half-extents are (W/2 - padding,
  // H/2 - padding); the scale factor is the smaller of how far we'd
  // travel along each axis to hit its respective edge.
  const halfW = viewport.width / 2 - padding;
  const halfH = viewport.height / 2 - padding;
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
