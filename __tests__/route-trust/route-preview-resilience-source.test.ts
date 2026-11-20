const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const routePreviewSource = readFileSync('components/RoutePreviewCard.tsx', 'utf8');
const enRouteSource = readFileSync('app/en-route.tsx', 'utf8');

describe('RoutePreviewCard resilience handoff contract', () => {
  test('prepares the offline route bundle before opening en-route navigation', () => {
    expect(routePreviewSource).toContain('prepareRouteResilienceBundle');
    const prepareIndex = routePreviewSource.indexOf(
      'await prepareRouteResilienceBundle',
    );
    const pushIndex = routePreviewSource.indexOf('router.push({', prepareIndex);
    expect(prepareIndex).toBeGreaterThanOrEqual(0);
    expect(pushIndex).toBeGreaterThan(prepareIndex);
  });

  test('shows preparation feedback on the Go button before the trip starts', () => {
    expect(routePreviewSource).toContain('Preparing route for weak signal');
    expect(routePreviewSource).toContain('Preparing…');
  });

  test('uses the source of the displayed directions for driving status', () => {
    expect(enRouteSource).toContain('<RouteSourceStatus source={routeSource} cacheAgeMs={cacheAgeMs} />');
    expect(enRouteSource).not.toContain('routePrepStatus');
  });
});
