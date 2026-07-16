const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const homeSource = readFileSync('app/home.tsx', 'utf8');
const enRouteSource = readFileSync('app/en-route.tsx', 'utf8');

describe('corridor collection source contracts', () => {
  test('screens collect preview corridor evidence across route alternatives, not only the first route', () => {
    expect(homeSource).toContain('getZonesForRouteAlternatives');
    expect(enRouteSource).toContain('getZonesForRouteAlternatives');

    expect(homeSource).not.toContain(
      'getZonesForTrip(\n            center,\n            destination,\n            fetchedResult.routes[0]?.coordinates',
    );
    expect(enRouteSource).not.toContain(
      'getZonesForTrip(\n              center,\n              destination,\n              coords,',
    );
  });
});
