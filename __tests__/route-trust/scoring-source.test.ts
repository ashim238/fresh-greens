const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const scoringSource = readFileSync('lib/scoring.ts', 'utf8');
const homeSource = readFileSync('app/home.tsx', 'utf8');
const enRouteSource = readFileSync('app/en-route.tsx', 'utf8');

describe('route scoring source contracts', () => {
  test('scoring APIs require an explicit departure time', () => {
    expect(scoringSource).not.toContain('departureTime: Date = new Date()');
    expect(scoringSource).toContain('departureTime: Date');
  });

  test('screens do not merge route-owned Mapbox incidents into shared zones', () => {
    expect(homeSource).not.toContain('rawRoutes.flatMap((r) => r.mapboxIncidentZones ?? [])');
    expect(enRouteSource).not.toContain('rawRoutes.flatMap((r) => r.mapboxIncidentZones ?? [])');
  });
});
