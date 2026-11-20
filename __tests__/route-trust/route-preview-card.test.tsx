import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { RoutePreviewCard } from '../../components/RoutePreviewCard';
import type { Route } from '../../lib/api/routes';
import * as daylight from '../../lib/daylight';
import { formatTimeOfDay } from '../../lib/format';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockPrepare = jest.fn().mockResolvedValue(undefined);
const mockSave = jest.fn();
const mockSchedule = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('../../hooks/useRegularDestinations', () => ({
  useRegularDestinations: () => ({ regulars: [], markRegular: mockSave }),
}));
jest.mock('../../lib/api/route-resilience', () => ({
  prepareRouteResilienceBundle: (...args: unknown[]) => mockPrepare(...args),
}));
jest.mock('../../lib/notifications', () => ({
  scheduleDepartureNotification: (...args: unknown[]) => mockSchedule(...args),
}));
jest.mock('../../lib/haptics', () => ({ tap: jest.fn(), confirm: jest.fn() }));
jest.mock('../../assets/illustrations/daylight-sun.svg', () => () => null);
jest.mock('../../assets/illustrations/daylight-moon.svg', () => () => null);

const destination = { latitude: 40.729, longitude: -73.996 };
const route: Route = {
  id: 'first', label: 'Primary route', estimatedMinutes: 10, distanceMeters: 1609.344,
  coordinates: [{ latitude: 40.7, longitude: -74 }, destination],
  steps: [{ name: 'Broadway', instruction: 'Continue on Broadway', kind: 'straight', distanceMeters: 1609.344, maneuverLocation: destination }],
};
const alternate: Route = {
  ...route, id: 'second', estimatedMinutes: 50,
  steps: [{ ...route.steps![0], name: 'Houston Street' }],
};
const destinationName = 'Washington Square Park';
const props: ComponentProps<typeof RoutePreviewCard> = {
  routes: [route], selectedRoute: route, recommended: route, enabledZones: [],
  params: { destName: destinationName, destLat: String(destination.latitude), destLng: String(destination.longitude) },
  onSelectRoute: jest.fn(), cloudCoverPct: 0, isCalculatingRoute: false, routeFetchSource: 'osrm',
  tripZonesStatus: 'ready', tripZonesFetchFailed: false, tripZonesCorridorComplete: true,
  onCorridorRetry: jest.fn(), onHazardChipPress: jest.fn(), onSafeChipPress: jest.fn(), preferredStations: [],
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test('one route keeps the road, metric pairs and destination actions available without a switcher', async () => {
  const evening = new Date('2026-11-20T16:45:00-05:00');
  jest.spyOn(Date, 'now').mockReturnValue(evening.getTime());
  await render(<RoutePreviewCard {...props} />);

  expect(screen.getByRole('header', { name: destinationName })).toBeTruthy();
  expect(screen.getByText('Via Broadway')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Next route' })).toBeNull();
  expect(screen.getByLabelText('10 min, 1.0 mi.')).toBeTruthy();
  expect(screen.getByLabelText(`Arrive at ${formatTimeOfDay(new Date(+evening + 600_000))}, After dark`)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save as a regular destination' }));
  expect(mockSave).toHaveBeenCalledWith({ ...destination, name: destinationName });
  await fireEvent.press(screen.getByRole('button', { name: 'Clear destination and return to browsing' }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/home', params: {} });
});

test('cycling routes updates the displayed road and arrival light before Go starts the chosen route', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(+new Date('2026-11-20T16:00:00-05:00'));
  const choices = { ...props, routes: [route, alternate] };
  const { rerender } = await render(<RoutePreviewCard {...choices} />);
  expect(screen.getByLabelText('Route 1 of 2')).toBeTruthy();
  expect(screen.getByText('Via Broadway')).toBeTruthy();
  expect(screen.getByLabelText(/Arrive at .*Dusk/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Next route' }));
  expect(props.onSelectRoute).toHaveBeenCalledWith('second');

  await rerender(<RoutePreviewCard {...choices} selectedRoute={alternate} />);
  expect(screen.getByLabelText('Route 2 of 2')).toBeTruthy();
  expect(screen.getByText('Via Houston Street')).toBeTruthy();
  expect(screen.getByLabelText(/Arrive at .*After dark/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Start navigation' }));
  expect(mockPrepare).toHaveBeenCalledWith(expect.objectContaining({ route: alternate }));
  expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
    params: expect.objectContaining({ destRouteRank: '1', destArrivalLight: 'After dark' }),
  }));
});

test('loading, absent and unroutable results retain the destination header and withhold Go', async () => {
  const { rerender } = await render(<RoutePreviewCard {...props} isCalculatingRoute />);
  expect(screen.queryByRole('button', { name: 'Start navigation' })).toBeNull();
  await rerender(<RoutePreviewCard {...props} selectedRoute={undefined} routes={[]} routeFetchSource={null} />);
  expect(screen.getByLabelText('Route unavailable. Check your location access and try again.')).toBeTruthy();
  expect(screen.queryByLabelText(/couldn't find a driving route/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Start navigation' })).toBeNull();
  await rerender(<RoutePreviewCard {...props} routeFetchSource="no-route" />);
  expect(screen.getByRole('header', { name: destinationName })).toBeTruthy();
  expect(screen.getByLabelText(/No route available/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Start navigation' })).toBeNull();
});

test('scheduling stays available while Go retains its own full-width footer', async () => {
  jest.spyOn(daylight, 'suggestedDepartureForDaylight').mockReturnValue(new Date('2026-11-20T07:05:00-05:00'));
  await render(<RoutePreviewCard {...props} />);
  const go = screen.getByRole('button', { name: 'Start navigation' });
  expect(screen.getByRole('button', { name: /^Schedule trip for/ })).toBeTruthy();
  expect(go.parent?.children).toHaveLength(1);
});

test('closing the sheet during preparation cancels navigation', async () => {
  let finish = () => {};
  mockPrepare.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  await render(<RoutePreviewCard {...props} />);
  const pressing = fireEvent.press(screen.getByRole('button', { name: 'Start navigation' }));
  const preparing = await screen.findByRole('button', { name: 'Preparing route for weak signal' });
  expect(preparing.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Clear destination and return to browsing' }));
  finish();
  await pressing;
  expect(mockPush).not.toHaveBeenCalled();
});

test.each(['Go', 'Close', 'route change'])('a pending Schedule runs once and suppresses its alert after %s', async (change) => {
  jest.spyOn(daylight, 'suggestedDepartureForDaylight').mockReturnValue(new Date('2026-11-20T07:05:00-05:00'));
  const alert = jest.spyOn(Alert, 'alert');
  let finish = () => {};
  mockSchedule.mockReturnValueOnce(new Promise((resolve) => {
    finish = () => resolve({ ok: true, identifier: 'reminder' });
  }));
  const { rerender } = await render(<RoutePreviewCard {...props} />);
  const pressing = fireEvent.press(screen.getByRole('button', { name: /^Schedule trip for/ }));
  const busy = await screen.findByRole('button', { name: 'Scheduling departure reminder' });
  expect(busy.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  await fireEvent.press(busy);
  expect(mockSchedule).toHaveBeenCalledTimes(1);
  if (change === 'route change') {
    await rerender(<RoutePreviewCard {...props} selectedRoute={alternate} routes={[route, alternate]} />);
  } else {
    const name = change === 'Go' ? 'Start navigation' : 'Clear destination and return to browsing';
    await fireEvent.press(screen.getByRole('button', { name }));
  }
  finish();
  await pressing;
  expect(alert).not.toHaveBeenCalled();
});
