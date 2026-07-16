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

  test('surfaces route-backup preparation as an explicit user state', () => {
    expect(routePreviewSource).toContain('useState<\'idle\' | \'preparing\'>');
    expect(routePreviewSource).toContain('Preparing route for weak signal');
    expect(routePreviewSource).toContain('Preparing…');
    expect(routePreviewSource).toContain('routePrepStatus');
    expect(routePreviewSource).toContain("'ready'");
    expect(routePreviewSource).toContain("'degraded'");
  });

  test('shows ready or degraded route-backup status after navigation starts', () => {
    expect(enRouteSource).toContain('params.routePrepStatus === \'ready\'');
    expect(enRouteSource).toContain('Route saved for weak signal');
    expect(enRouteSource).toContain('Route backup limited');
    expect(enRouteSource).toContain('Backup limited');
  });
});
