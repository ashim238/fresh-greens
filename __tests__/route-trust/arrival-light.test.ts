import { arrivalLightAt, gradientSegments } from '../../lib/daylight';

const manhattan = { latitude: 40.729, longitude: -73.996 };

describe('arrival light at the route destination', () => {
  test.each([
    ['2026-06-20T18:30:00-04:00', 'Daylight'],
    ['2026-06-20T20:10:00-04:00', 'Dusk'],
    ['2026-06-20T21:00:00-04:00', 'After dark'],
    ['2026-11-20T16:55:00-05:00', 'After dark'],
    ['2026-11-20T05:15:00-05:00', 'After dark'],
  ])('classifies an arrival in Manhattan at %s as %s', (isoTime, expected) => {
    expect(arrivalLightAt(manhattan, new Date(isoTime))).toBe(expected);
  });

  test('uses sunset at the destination for the same instant', () => {
    const instant = new Date('2026-06-21T01:00:00Z');
    const losAngeles = { latitude: 34.05, longitude: -118.24 };
    expect(arrivalLightAt(manhattan, instant)).toBe('After dark');
    expect(arrivalLightAt(losAngeles, instant)).toBe('Daylight');
  });

  test('heavy cloud qualifies daylight without changing the dusk band', () => {
    expect(arrivalLightAt(manhattan, new Date('2026-06-20T18:30:00-04:00'), 60)).toBe('Low light');
    expect(arrivalLightAt(manhattan, new Date('2026-06-20T20:10:00-04:00'), 100)).toBe('Dusk');
  });

  test('withholds light when the destination, solar times or ETA are unavailable', () => {
    const arrival = new Date('2026-11-20T16:55:00-05:00');
    expect(arrivalLightAt(undefined, arrival)).toBeNull();
    expect(arrivalLightAt({ latitude: NaN, longitude: NaN }, arrival)).toBeNull();
    expect(arrivalLightAt({ latitude: 89.99, longitude: 0 }, arrival)).toBeNull();
    expect(arrivalLightAt(manhattan, new Date(NaN))).toBeNull();
  });
});

describe('route line continuity', () => {
  const coordinates = Array.from({ length: 48 }, (_, i) => ({
    latitude: manhattan.latitude,
    longitude: manhattan.longitude + i / 10000,
  }));
  const route = { id: 'trip', label: 'Trip', estimatedMinutes: 6, distanceMeters: 800, coordinates };

  test('keeps after-dark dots continuous through every waypoint', () => {
    const segments = gradientSegments(route, new Date('2026-11-20T21:00:00-05:00'));
    expect(segments).toHaveLength(1);
    expect(segments[0].band).toBe('night');
    expect(segments[0].coordinates).toEqual(coordinates);
  });

  test('keeps real daylight transitions, including their shared boundary points', () => {
    const segments = gradientSegments(
      { ...route, estimatedMinutes: 160 },
      new Date('2026-06-20T18:40:00-04:00'),
    );
    expect([...new Set(segments.map(segment => segment.band))]).toEqual(['day', 'twilight', 'night']);
    const path = segments.flatMap((segment, index) => index ? segment.coordinates.slice(1) : segment.coordinates);
    expect(path).toEqual(coordinates);
  });
});
