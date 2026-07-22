import { purgeCalendarResolutionsForAccount } from '../api/calendar-resolutions';
import { purgeCalendarConnectionForAccount } from '../api/calendar';
import { purgeLocalCommunityReportsForAccount } from '../api/community-reports';
import { purgeStoredFuelProfileForAccount } from '../api/fuel';
import { purgeStoredInsuranceProfileForAccount } from '../api/insurance';
import { purgeStoredPreferencesForAccount } from '../api/preferences';
import { purgePreferredStationsForAccount } from '../api/preferred-stations';
import { purgeRecentSearchesForAccount } from '../api/recent-searches';
import { purgeRecordingsForAccount } from '../api/recordings';
import { purgeRegularDestinationsForAccount } from '../api/regular-destinations';
import { purgeStoredRoadsideProfileForAccount } from '../api/roadside';
import { purgeActiveRouteForAccount } from '../api/route-cache';
import { purgeRouteResilienceForAccount } from '../api/route-resilience';
import { purgeSavedPlacesForAccount } from '../api/saved-places';
import { purgeStoredShareSessionForAccount } from '../api/share-session';
import { purgeCommunityReportSyncQueueForAccount } from '../api/sources/community-cloud';
import { purgeTrustedContactForAccount } from '../api/trusted-contact';
import {
  purgeAvatarFilesForAccount,
  purgeStoredUserForAccount,
} from '../api/user';
import { purgeCorridorZonesForAccount } from '../api/zone-cache';
import { purgeZoneTilesForAccount } from '../api/zone-tile-cache';
import { backendAuthRepository } from '../supabase/auth-repository';

export type AccountPurgeEntryKind = 'local' | 'identity' | 'remote';

type AccountPurgeEntryShape = {
  id: string;
  label: string;
  kind: AccountPurgeEntryKind;
  purge(): Promise<void>;
};

export class AccountPurgeRemoteError extends Error {
  constructor(
    readonly reason: string,
    readonly retryable: boolean,
  ) {
    super('The online session could not be confirmed as closed');
    this.name = 'AccountPurgeRemoteError';
  }
}

async function purgeSupabaseRemoteSession(): Promise<void> {
  const result = await backendAuthRepository.signOutGlobal();
  if (result.kind === 'terminal') return;

  throw new AccountPurgeRemoteError(
    result.reason,
    result.kind === 'retryable',
  );
}

export const ACCOUNT_PURGE_MANIFEST = [
  {
    id: 'identity.user',
    label: 'Account identity',
    kind: 'identity',
    purge: purgeStoredUserForAccount,
  },
  {
    id: 'files.avatars',
    label: 'Profile photos',
    kind: 'local',
    purge: purgeAvatarFilesForAccount,
  },
  {
    id: 'identity.trustedContact',
    label: 'Trusted contact',
    kind: 'local',
    purge: purgeTrustedContactForAccount,
  },
  {
    id: 'places.saved',
    label: 'Saved places',
    kind: 'local',
    purge: purgeSavedPlacesForAccount,
  },
  {
    id: 'places.regular',
    label: 'Regular destinations',
    kind: 'local',
    purge: purgeRegularDestinationsForAccount,
  },
  {
    id: 'places.recent',
    label: 'Recent searches',
    kind: 'local',
    purge: purgeRecentSearchesForAccount,
  },
  {
    id: 'places.preferredStations',
    label: 'Preferred stations',
    kind: 'local',
    purge: purgePreferredStationsForAccount,
  },
  {
    id: 'settings.preferences',
    label: 'Account preferences',
    kind: 'local',
    purge: purgeStoredPreferencesForAccount,
  },
  {
    id: 'vehicle.fuel',
    label: 'Fuel profile and reminder',
    kind: 'local',
    purge: purgeStoredFuelProfileForAccount,
  },
  {
    id: 'safety.insurance',
    label: 'Insurance profile',
    kind: 'local',
    purge: purgeStoredInsuranceProfileForAccount,
  },
  {
    id: 'safety.roadside',
    label: 'Roadside profile',
    kind: 'local',
    purge: purgeStoredRoadsideProfileForAccount,
  },
  {
    id: 'safety.shareSession',
    label: 'Active safety share',
    kind: 'local',
    purge: purgeStoredShareSessionForAccount,
  },
  {
    id: 'safety.recordings',
    label: 'Safety recordings',
    kind: 'local',
    purge: purgeRecordingsForAccount,
  },
  {
    id: 'calendar.connection',
    label: 'Calendar connection',
    kind: 'local',
    purge: purgeCalendarConnectionForAccount,
  },
  {
    id: 'calendar.resolutions',
    label: 'Calendar place matches',
    kind: 'local',
    purge: purgeCalendarResolutionsForAccount,
  },
  {
    id: 'reports.local',
    label: 'Local community reports',
    kind: 'local',
    purge: purgeLocalCommunityReportsForAccount,
  },
  {
    id: 'reports.syncQueue',
    label: 'Pending community reports',
    kind: 'local',
    purge: purgeCommunityReportSyncQueueForAccount,
  },
  {
    id: 'navigation.activeRoute',
    label: 'Active route',
    kind: 'local',
    purge: purgeActiveRouteForAccount,
  },
  {
    id: 'navigation.corridor',
    label: 'Route corridor',
    kind: 'local',
    purge: purgeCorridorZonesForAccount,
  },
  {
    id: 'navigation.tiles',
    label: 'Location tile cache',
    kind: 'local',
    purge: purgeZoneTilesForAccount,
  },
  {
    id: 'navigation.resilience',
    label: 'Offline route bundle',
    kind: 'local',
    purge: purgeRouteResilienceForAccount,
  },
  {
    id: 'auth.supabase',
    label: 'Online session',
    kind: 'remote',
    purge: purgeSupabaseRemoteSession,
  },
] as const satisfies readonly AccountPurgeEntryShape[];

export type AccountPurgeManifestId =
  (typeof ACCOUNT_PURGE_MANIFEST)[number]['id'];

export type AccountPurgeEntry = {
  id: AccountPurgeManifestId;
  label: string;
  kind: AccountPurgeEntryKind;
  purge(): Promise<void>;
};

export const ACCOUNT_PURGE_MANIFEST_IDS: readonly AccountPurgeManifestId[] =
  ACCOUNT_PURGE_MANIFEST.map(({ id }) => id);
