import {
  asyncStorageState,
  deferred,
  notificationsState,
  resetTestHarness,
} from './test-harness';

const {
  accountOperationGate,
} = require('../../lib/account-session/operation-gate') as typeof import('../../lib/account-session/operation-gate');
const {
  purgeActiveRouteForAccount,
  saveActiveRoute,
} = require('../../lib/api/route-cache') as typeof import('../../lib/api/route-cache');
const {
  scheduleDepartureNotification,
} = require('../../lib/notifications') as typeof import('../../lib/notifications');

describe('detached personal writers', () => {
  beforeEach(resetTestHarness);
  afterEach(resetTestHarness);

  test('sign-out drains cache and notification work before purge runs last', async () => {
    const routeWrite = deferred<void>();
    const notificationSchedule = deferred<void>();
    asyncStorageState.deferNext('setItem', routeWrite);
    notificationsState.deferNext(
      'scheduleNotificationAsync',
      notificationSchedule,
    );

    const route = saveActiveRoute([], { latitude: 40.7, longitude: -74 });
    const notification = scheduleDepartureNotification(
      new Date(Date.now() + 60_000),
      'Home',
    );
    await Promise.resolve();
    await Promise.resolve();

    accountOperationGate.seal(0);
    const draining = accountOperationGate.drain(0, 100);
    let settled = false;
    void draining.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    notificationSchedule.resolve();
    await notification;
    await Promise.resolve();
    expect(settled).toBe(false);

    routeWrite.resolve();
    await route;
    await expect(draining).resolves.toEqual({ kind: 'drained' });

    await purgeActiveRouteForAccount();
    expect(
      asyncStorageState.values.has('@fresh-greens/active-route-cache'),
    ).toBe(false);
    expect(notificationsState.scheduled.size).toBe(0);
  });
});
