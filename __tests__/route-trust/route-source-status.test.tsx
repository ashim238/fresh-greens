import { render, screen } from '@testing-library/react-native';
import { RouteSourceStatus } from '../../components/RouteSourceStatus';
import { clearActiveRoute, saveActiveRoute } from '../../lib/api/route-cache';
import { getRoutesBetween, type Route } from '../../lib/api/routes';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

test('shows saved-route status only while cached directions are in use', async () => {
  const { rerender } = await render(<RouteSourceStatus source="mapbox" cacheAgeMs={null} />);
  expect(screen.toJSON()).toBeNull();
  await rerender(<RouteSourceStatus source="cache" cacheAgeMs={3_600_000} />);
  expect(screen.getByText('Using saved route')).toBeTruthy();
  expect(screen.getByLabelText('Using saved route, 1h old. Live rerouting unavailable.')).toBeTruthy();
  expect(screen.getByText('1h old')).toBeTruthy();
  await rerender(<RouteSourceStatus source="osrm" cacheAgeMs={3_600_000} />);
  expect(screen.toJSON()).toBeNull();
  await rerender(<RouteSourceStatus source="no-route" cacheAgeMs={null} />);
  expect(screen.toJSON()).toBeNull();
});

test('distinguishes a freshly cached route from a demo with no saved directions', async () => {
  const { rerender } = await render(<RouteSourceStatus source="cache" cacheAgeMs={0} />);
  expect(screen.getByLabelText('Using saved route. Live rerouting unavailable.')).toBeTruthy();
  await rerender(<RouteSourceStatus source="mock" cacheAgeMs={null} />);
  expect(screen.getByText('Demo route')).toBeTruthy();
  expect(screen.queryByText('Using saved route')).toBeNull();
});

test('a failed live lookup uses the stored trip and displays its status', async () => {
  const origin = { latitude: 40.66925, longitude: -73.93105 };
  const destination = { latitude: 40.67363, longitude: -73.92513 };
  const route: Route = {
    id: 'weeksville',
    label: 'Via Park Place',
    coordinates: [origin, destination],
    estimatedMinutes: 4,
    distanceMeters: 960,
    steps: [{
      name: 'Park Place',
      instruction: 'Continue on Park Place',
      kind: 'straight',
      maneuverLocation: origin,
      distanceMeters: 960,
    }],
  };
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network unavailable'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    await saveActiveRoute([route], destination);
    const result = await getRoutesBetween(origin, destination);
    expect(result.routes).toEqual([route]);
    await render(<RouteSourceStatus source={result.source} cacheAgeMs={result.cacheAgeMs ?? null} />);
    expect(screen.getByText('Using saved route')).toBeTruthy();
  } finally {
    jest.restoreAllMocks();
    await clearActiveRoute();
  }
});
