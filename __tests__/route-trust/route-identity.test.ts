import { matchRouteGeometry, routeGeometryFingerprint } from '../../lib/route-identity';

const start = { latitude: 40.72, longitude: -74 };
const end = { latitude: 40.72, longitude: -73.98 };
const north = [start, { latitude: 40.73, longitude: -73.99 }, end];
const direct = [start, end];

describe('route selection across the preview and navigation fetches', () => {
  test('follows geometry after alternatives exchange response slots', () => {
    const preview = routeGeometryFingerprint(north);
    const navigation = new Map([
      ['osrm-route-0', routeGeometryFingerprint(direct)],
      ['osrm-route-1', routeGeometryFingerprint(north)],
    ]);
    expect(matchRouteGeometry(navigation, preview)).toBe('osrm-route-1');
  });

  test('recognizes the same path with additional intermediate vertices', () => {
    const preview = routeGeometryFingerprint(direct);
    const detailed = routeGeometryFingerprint([start, { latitude: 40.72, longitude: -73.99 }, end]);
    expect(detailed).not.toBe(preview);
    expect(matchRouteGeometry(new Map([['new-slot', detailed]]), preview)).toBe('new-slot');
  });

  test('declines a shape-only match when several alternatives share it', () => {
    const preview = routeGeometryFingerprint(direct);
    const shape = preview.split('.')[1];
    const navigation = new Map([['a', `first.${shape}`], ['b', `second.${shape}`]]);
    expect(matchRouteGeometry(navigation, preview)).toBeUndefined();
    expect(matchRouteGeometry(navigation, 'missing-key')).toBeUndefined();
  });
});
