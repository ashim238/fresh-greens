import {
  asyncStorageState,
  fileSystemState,
  notificationsState,
  resetTestHarness,
} from './test-harness';

jest.mock('../../lib/supabase/auth-repository', () => ({
  backendAuthRepository: {
    signOutGlobal: jest.fn(),
    signOutLocal: jest.fn(),
  },
}));

const { backendAuthRepository } = jest.mocked(
  require('../../lib/supabase/auth-repository'),
);
const AsyncStorage = require(
  '@react-native-async-storage/async-storage',
).default as typeof import('@react-native-async-storage/async-storage').default;
const SecureStore = require(
  'expo-secure-store',
) as typeof import('expo-secure-store');
const {
  ACCOUNT_PURGE_MANIFEST,
  AccountPurgeRemoteError,
} = require('../../lib/account-session/purge-manifest') as typeof import('../../lib/account-session/purge-manifest');
const {
  retireLegacySupabaseSession,
} = require('../../lib/supabase/legacy-session') as typeof import('../../lib/supabase/legacy-session');

const {
  purgeRecentSearchesForAccount,
} = require('../../lib/api/recent-searches') as typeof import('../../lib/api/recent-searches');
const {
  purgeActiveRouteForAccount,
} = require('../../lib/api/route-cache') as typeof import('../../lib/api/route-cache');
const {
  purgeCorridorZonesForAccount,
} = require('../../lib/api/zone-cache') as typeof import('../../lib/api/zone-cache');
const {
  purgeZoneTilesForAccount,
} = require('../../lib/api/zone-tile-cache') as typeof import('../../lib/api/zone-tile-cache');
const {
  purgeCommunityReportSyncQueueForAccount,
} = require('../../lib/api/sources/community-cloud') as typeof import('../../lib/api/sources/community-cloud');
const {
  purgeRecordingsForAccount,
} = require('../../lib/api/recordings') as typeof import('../../lib/api/recordings');
const {
  purgeLocalCommunityReportsForAccount,
} = require('../../lib/api/community-reports') as typeof import('../../lib/api/community-reports');
const {
  purgeAvatarFilesForAccount,
} = require('../../lib/api/user') as typeof import('../../lib/api/user');
const {
  DEFAULT_FUEL_PROFILE,
  purgeStoredFuelProfileForAccount,
} = require('../../lib/api/fuel') as typeof import('../../lib/api/fuel');
const {
  purgeTrustedContactForAccount,
} = require('../../lib/api/trusted-contact') as typeof import('../../lib/api/trusted-contact');
const {
  purgeSavedPlacesForAccount,
} = require('../../lib/api/saved-places') as typeof import('../../lib/api/saved-places');
const {
  purgeRegularDestinationsForAccount,
} = require('../../lib/api/regular-destinations') as typeof import('../../lib/api/regular-destinations');
const {
  purgePreferredStationsForAccount,
} = require('../../lib/api/preferred-stations') as typeof import('../../lib/api/preferred-stations');
const {
  purgeStoredPreferencesForAccount,
} = require('../../lib/api/preferences') as typeof import('../../lib/api/preferences');
const {
  purgeStoredInsuranceProfileForAccount,
} = require('../../lib/api/insurance') as typeof import('../../lib/api/insurance');
const {
  purgeStoredRoadsideProfileForAccount,
} = require('../../lib/api/roadside') as typeof import('../../lib/api/roadside');
const {
  purgeStoredShareSessionForAccount,
} = require('../../lib/api/share-session') as typeof import('../../lib/api/share-session');
const {
  purgeCalendarConnectionForAccount,
} = require('../../lib/api/calendar') as typeof import('../../lib/api/calendar');
const {
  purgeCalendarResolutionsForAccount,
} = require('../../lib/api/calendar-resolutions') as typeof import('../../lib/api/calendar-resolutions');
const {
  purgeRouteResilienceForAccount,
} = require('../../lib/api/route-resilience') as typeof import('../../lib/api/route-resilience');

describe('account isolation purge adapters', () => {
  beforeEach(() => {
    resetTestHarness();
  });

  afterEach(() => {
    resetTestHarness();
  });

  test('accepts terminal SDK sign-out before identity deletion', async () => {
    backendAuthRepository.signOutGlobal.mockResolvedValue({
      kind: 'terminal',
      reason: 'signed-out',
    });
    const authPurgeEntry = ACCOUNT_PURGE_MANIFEST.find(
      ({ id }) => id === 'auth.supabase',
    );

    await expect(authPurgeEntry?.purge()).resolves.toBeUndefined();
    expect(backendAuthRepository.signOutGlobal).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['network', true],
    ['unexpected-client', false],
  ] as const)(
    'maps SDK %s sign-out without exposing SDK error details',
    async (reason, retryable) => {
      backendAuthRepository.signOutGlobal.mockResolvedValue(
        retryable
          ? { kind: 'retryable', reason }
          : { kind: 'required-failure', reason },
      );
      const authPurgeEntry = ACCOUNT_PURGE_MANIFEST.find(
        ({ id }) => id === 'auth.supabase',
      );

      await expect(authPurgeEntry?.purge()).rejects.toMatchObject({
        name: AccountPurgeRemoteError.name,
        message: 'The online session could not be confirmed as closed',
        reason,
        retryable,
      });
    },
  );

  test('deletes both legacy custom-session keys without parsing tokens', async () => {
    await retireLegacySupabaseSession();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'fresh-greens.supabase-session.v2',
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      'fresh-greens.supabase-session.v1',
    );
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  test.each([
    [
      'recent searches',
      'fresh-greens.recent-searches.v1',
      purgeRecentSearchesForAccount,
    ],
    [
      'active route cache',
      '@fresh-greens/active-route-cache',
      purgeActiveRouteForAccount,
    ],
    [
      'corridor zones cache',
      '@fresh-greens/corridor-zones-cache',
      purgeCorridorZonesForAccount,
    ],
    [
      'zone tile cache',
      '@fresh-greens/zone-tiles-v1',
      purgeZoneTilesForAccount,
    ],
    [
      'community report sync queue',
      'fresh-greens.community-reports.sync-queue.v1',
      purgeCommunityReportSyncQueueForAccount,
    ],
    [
      'trusted contact',
      'fresh-greens.trusted-contact.v1',
      purgeTrustedContactForAccount,
    ],
    [
      'saved places',
      'fresh-greens.saved-places.v1',
      purgeSavedPlacesForAccount,
    ],
    [
      'regular destinations',
      'fresh-greens.regular-destinations.v1',
      purgeRegularDestinationsForAccount,
    ],
    [
      'preferred stations',
      'fresh-greens.preferred-stations.v1',
      purgePreferredStationsForAccount,
    ],
    [
      'preferences',
      'fresh-greens.preferences.v1',
      purgeStoredPreferencesForAccount,
    ],
    [
      'insurance profile',
      'fresh-greens.insurance.v1',
      purgeStoredInsuranceProfileForAccount,
    ],
    [
      'roadside profile',
      'fresh-greens.roadside.v1',
      purgeStoredRoadsideProfileForAccount,
    ],
    [
      'share session',
      'fresh-greens.share-session.v1',
      purgeStoredShareSessionForAccount,
    ],
    [
      'calendar connection',
      'fresh-greens.calendar.v1',
      purgeCalendarConnectionForAccount,
    ],
    [
      'calendar resolutions',
      'fresh-greens.calendar-resolutions.v1',
      purgeCalendarResolutionsForAccount,
    ],
  ])(
    'purging %s succeeds when the store is already absent',
    async (_label, key, purge) => {
      await expect(purge()).resolves.toBeUndefined();
      expect(asyncStorageState.values.has(key)).toBe(false);
    },
  );

  test.each([
    [
      'recent searches',
      'fresh-greens.recent-searches.v1',
      purgeRecentSearchesForAccount,
    ],
    [
      'active route cache',
      '@fresh-greens/active-route-cache',
      purgeActiveRouteForAccount,
    ],
    [
      'corridor zones cache',
      '@fresh-greens/corridor-zones-cache',
      purgeCorridorZonesForAccount,
    ],
    [
      'zone tile cache',
      '@fresh-greens/zone-tiles-v1',
      purgeZoneTilesForAccount,
    ],
    [
      'community report sync queue',
      'fresh-greens.community-reports.sync-queue.v1',
      purgeCommunityReportSyncQueueForAccount,
    ],
    [
      'trusted contact',
      'fresh-greens.trusted-contact.v1',
      purgeTrustedContactForAccount,
    ],
    [
      'saved places',
      'fresh-greens.saved-places.v1',
      purgeSavedPlacesForAccount,
    ],
    [
      'regular destinations',
      'fresh-greens.regular-destinations.v1',
      purgeRegularDestinationsForAccount,
    ],
    [
      'preferred stations',
      'fresh-greens.preferred-stations.v1',
      purgePreferredStationsForAccount,
    ],
    [
      'preferences',
      'fresh-greens.preferences.v1',
      purgeStoredPreferencesForAccount,
    ],
    [
      'insurance profile',
      'fresh-greens.insurance.v1',
      purgeStoredInsuranceProfileForAccount,
    ],
    [
      'roadside profile',
      'fresh-greens.roadside.v1',
      purgeStoredRoadsideProfileForAccount,
    ],
    [
      'share session',
      'fresh-greens.share-session.v1',
      purgeStoredShareSessionForAccount,
    ],
    [
      'calendar connection',
      'fresh-greens.calendar.v1',
      purgeCalendarConnectionForAccount,
    ],
    [
      'calendar resolutions',
      'fresh-greens.calendar-resolutions.v1',
      purgeCalendarResolutionsForAccount,
    ],
  ])(
    'purging %s removes persisted data',
    async (_label, key, purge) => {
      asyncStorageState.values.set(key, JSON.stringify({ stale: true }));

      await expect(purge()).resolves.toBeUndefined();

      expect(asyncStorageState.values.has(key)).toBe(false);
    },
  );

  test.each([
    [
      'recent searches',
      'fresh-greens.recent-searches.v1',
      purgeRecentSearchesForAccount,
    ],
    [
      'active route cache',
      '@fresh-greens/active-route-cache',
      purgeActiveRouteForAccount,
    ],
    [
      'corridor zones cache',
      '@fresh-greens/corridor-zones-cache',
      purgeCorridorZonesForAccount,
    ],
    [
      'zone tile cache',
      '@fresh-greens/zone-tiles-v1',
      purgeZoneTilesForAccount,
    ],
    [
      'community report sync queue',
      'fresh-greens.community-reports.sync-queue.v1',
      purgeCommunityReportSyncQueueForAccount,
    ],
    [
      'trusted contact',
      'fresh-greens.trusted-contact.v1',
      purgeTrustedContactForAccount,
    ],
    [
      'saved places',
      'fresh-greens.saved-places.v1',
      purgeSavedPlacesForAccount,
    ],
    [
      'regular destinations',
      'fresh-greens.regular-destinations.v1',
      purgeRegularDestinationsForAccount,
    ],
    [
      'preferred stations',
      'fresh-greens.preferred-stations.v1',
      purgePreferredStationsForAccount,
    ],
    [
      'preferences',
      'fresh-greens.preferences.v1',
      purgeStoredPreferencesForAccount,
    ],
    [
      'insurance profile',
      'fresh-greens.insurance.v1',
      purgeStoredInsuranceProfileForAccount,
    ],
    [
      'roadside profile',
      'fresh-greens.roadside.v1',
      purgeStoredRoadsideProfileForAccount,
    ],
    [
      'share session',
      'fresh-greens.share-session.v1',
      purgeStoredShareSessionForAccount,
    ],
    [
      'calendar connection',
      'fresh-greens.calendar.v1',
      purgeCalendarConnectionForAccount,
    ],
    [
      'calendar resolutions',
      'fresh-greens.calendar-resolutions.v1',
      purgeCalendarResolutionsForAccount,
    ],
  ])(
    'purging %s surfaces storage failures instead of swallowing them',
    async (_label, key, purge) => {
      const error = new Error(`remove failed for ${key}`);
      asyncStorageState.values.set(key, JSON.stringify({ stale: true }));
      asyncStorageState.failNext('removeItem', error);

      await expect(purge()).rejects.toThrow(error.message);
      expect(asyncStorageState.values.get(key)).toBe(JSON.stringify({ stale: true }));
    },
  );

  test.each([
    [
      'recordings',
      'fresh-greens.recordings.v1',
      'file:///documents/recordings',
      purgeRecordingsForAccount,
    ],
    [
      'local community reports',
      'fresh-greens.community-reports.v1',
      'file:///documents/reports',
      purgeLocalCommunityReportsForAccount,
    ],
  ])(
    'purging %s removes metadata and orphaned files',
    async (_label, key, directoryUri, purge) => {
      asyncStorageState.values.set(key, JSON.stringify([{ id: 'old' }]));
      fileSystemState.seedDirectory(directoryUri);
      fileSystemState.seedDirectory(`${directoryUri}/nested`);
      fileSystemState.seedFile(`${directoryUri}/nested/private.dat`, 'private');

      await expect(purge()).resolves.toBeUndefined();

      expect(asyncStorageState.values.has(key)).toBe(false);
      expect(fileSystemState.directories.has(directoryUri)).toBe(false);
      expect(fileSystemState.files.has(`${directoryUri}/nested/private.dat`)).toBe(false);
    },
  );

  test.each([
    [
      'recordings',
      'fresh-greens.recordings.v1',
      'file:///documents/recordings',
      purgeRecordingsForAccount,
    ],
    [
      'local community reports',
      'fresh-greens.community-reports.v1',
      'file:///documents/reports',
      purgeLocalCommunityReportsForAccount,
    ],
  ])(
    'purging %s surfaces metadata removal failures before deleting files',
    async (_label, key, directoryUri, purge) => {
      const error = new Error(`remove failed for ${key}`);
      asyncStorageState.values.set(key, JSON.stringify([{ id: 'old' }]));
      fileSystemState.seedDirectory(directoryUri);
      fileSystemState.seedFile(`${directoryUri}/private.dat`, 'private');
      asyncStorageState.failNext('removeItem', error);

      await expect(purge()).rejects.toThrow(error.message);

      expect(asyncStorageState.values.has(key)).toBe(true);
      expect(fileSystemState.files.has(`${directoryUri}/private.dat`)).toBe(true);
    },
  );

  test.each([
    [
      'recordings',
      'fresh-greens.recordings.v1',
      'file:///documents/recordings',
      purgeRecordingsForAccount,
    ],
    [
      'local community reports',
      'fresh-greens.community-reports.v1',
      'file:///documents/reports',
      purgeLocalCommunityReportsForAccount,
    ],
  ])(
    'purging %s surfaces directory deletion failures',
    async (_label, key, directoryUri, purge) => {
      const error = new Error(`delete failed for ${directoryUri}`);
      asyncStorageState.values.set(key, JSON.stringify([{ id: 'old' }]));
      fileSystemState.seedDirectory(directoryUri);
      fileSystemState.seedFile(`${directoryUri}/private.dat`, 'private');
      fileSystemState.failNext('deleteAsync', error);

      await expect(purge()).rejects.toThrow(error.message);

      expect(asyncStorageState.values.has(key)).toBe(false);
      expect(fileSystemState.files.has(`${directoryUri}/private.dat`)).toBe(true);
    },
  );

  test('purging avatar files removes orphaned profile photos', async () => {
    fileSystemState.seedDirectory('file:///documents/avatars');
    fileSystemState.seedFile('file:///documents/avatars/profile.jpg', 'private');

    await expect(purgeAvatarFilesForAccount()).resolves.toBeUndefined();

    expect(fileSystemState.directories.has('file:///documents/avatars')).toBe(false);
    expect(fileSystemState.files.has('file:///documents/avatars/profile.jpg')).toBe(false);
  });

  test('purging avatar files succeeds when the avatar directory is already absent', async () => {
    await expect(purgeAvatarFilesForAccount()).resolves.toBeUndefined();
  });

  test('purging avatar files surfaces directory deletion failures', async () => {
    const error = new Error('avatar delete failed');
    fileSystemState.seedDirectory('file:///documents/avatars');
    fileSystemState.seedFile('file:///documents/avatars/profile.jpg', 'private');
    fileSystemState.failNext('deleteAsync', error);

    await expect(purgeAvatarFilesForAccount()).rejects.toThrow(error.message);
    expect(fileSystemState.files.has('file:///documents/avatars/profile.jpg')).toBe(true);
  });

  test('purging route resilience removes metadata and orphaned offline files', async () => {
    asyncStorageState.values.set(
      'fresh-greens.route-resilience.v1',
      JSON.stringify({ routeId: 'private-route' }),
    );
    fileSystemState.seedDirectory('file:///documents/route-resilience');
    fileSystemState.seedFile(
      'file:///documents/route-resilience/offline-route.json',
      'private',
    );

    await expect(purgeRouteResilienceForAccount()).resolves.toBeUndefined();

    expect(
      asyncStorageState.values.has('fresh-greens.route-resilience.v1'),
    ).toBe(false);
    expect(
      fileSystemState.files.has(
        'file:///documents/route-resilience/offline-route.json',
      ),
    ).toBe(false);
  });

  test('purging route resilience succeeds when storage is already absent', async () => {
    await expect(purgeRouteResilienceForAccount()).resolves.toBeUndefined();
  });

  test('purging fuel succeeds when no fuel profile exists', async () => {
    await expect(purgeStoredFuelProfileForAccount()).resolves.toBeUndefined();
    expect(asyncStorageState.values.has('fresh-greens.fuel.v1')).toBe(false);
  });

  test('purging fuel cancels the stored notification before removing the profile', async () => {
    asyncStorageState.values.set(
      'fresh-greens.fuel.v1',
      JSON.stringify({
        ...DEFAULT_FUEL_PROFILE,
        remindersEnabled: true,
        notificationId: 'fuel-reminder-1',
      }),
    );
    notificationsState.scheduled.set('fuel-reminder-1', {
      identifier: 'fuel-reminder-1',
      content: {},
      trigger: null,
    });

    await expect(purgeStoredFuelProfileForAccount()).resolves.toBeUndefined();

    expect(notificationsState.scheduled.has('fuel-reminder-1')).toBe(false);
    expect(asyncStorageState.values.has('fresh-greens.fuel.v1')).toBe(false);
  });

  test('purging fuel removes every tagged personal notification and retains unrelated ones', async () => {
    notificationsState.scheduled.set('departure-reminder', {
      identifier: 'departure-reminder',
      content: {
        data: { freshGreensOwner: 'personal', kind: 'departure' },
      },
      trigger: null,
    });
    notificationsState.scheduled.set('orphan-refuel-reminder', {
      identifier: 'orphan-refuel-reminder',
      content: {
        data: { freshGreensOwner: 'personal', kind: 'refuel' },
      },
      trigger: null,
    });
    notificationsState.scheduled.set('unrelated-reminder', {
      identifier: 'unrelated-reminder',
      content: { data: { owner: 'another-feature' } },
      trigger: null,
    });

    await expect(purgeStoredFuelProfileForAccount()).resolves.toBeUndefined();

    expect(notificationsState.scheduled.has('departure-reminder')).toBe(false);
    expect(notificationsState.scheduled.has('orphan-refuel-reminder')).toBe(false);
    expect(notificationsState.scheduled.has('unrelated-reminder')).toBe(true);
  });

  test('purging fuel keeps the profile when notification cancellation fails', async () => {
    const error = new Error('notification cancel failed');
    asyncStorageState.values.set(
      'fresh-greens.fuel.v1',
      JSON.stringify({
        ...DEFAULT_FUEL_PROFILE,
        remindersEnabled: true,
        notificationId: 'fuel-reminder-1',
      }),
    );
    notificationsState.scheduled.set('fuel-reminder-1', {
      identifier: 'fuel-reminder-1',
      content: {},
      trigger: null,
    });
    notificationsState.failNext('cancelScheduledNotificationAsync', error);

    await expect(purgeStoredFuelProfileForAccount()).rejects.toThrow(error.message);

    expect(notificationsState.scheduled.has('fuel-reminder-1')).toBe(true);
    expect(asyncStorageState.values.has('fresh-greens.fuel.v1')).toBe(true);
  });

  test('purging fuel surfaces profile removal failures after cancelling the notification', async () => {
    const error = new Error('fuel remove failed');
    asyncStorageState.values.set(
      'fresh-greens.fuel.v1',
      JSON.stringify({
        ...DEFAULT_FUEL_PROFILE,
        remindersEnabled: true,
        notificationId: 'fuel-reminder-1',
      }),
    );
    notificationsState.scheduled.set('fuel-reminder-1', {
      identifier: 'fuel-reminder-1',
      content: {},
      trigger: null,
    });
    asyncStorageState.failNext('removeItem', error);

    await expect(purgeStoredFuelProfileForAccount()).rejects.toThrow(error.message);

    expect(notificationsState.scheduled.has('fuel-reminder-1')).toBe(false);
    expect(asyncStorageState.values.has('fresh-greens.fuel.v1')).toBe(true);
  });
});
