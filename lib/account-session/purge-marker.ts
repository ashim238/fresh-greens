import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ACCOUNT_PURGE_MANIFEST_IDS,
  type AccountPurgeManifestId,
} from './purge-manifest';

export const PENDING_ACCOUNT_PURGE_KEY =
  'fresh-greens.pending-account-purge.v1';

export type PendingAccountPurge = {
  version: 1;
  startedAt: string;
  failedIds: AccountPurgeManifestId[];
};

export class PendingAccountPurgeMarkerError extends Error {
  constructor(message = 'Pending account purge marker is malformed') {
    super(message);
    this.name = 'PendingAccountPurgeMarkerError';
  }
}

const manifestIds = new Set<string>(ACCOUNT_PURGE_MANIFEST_IDS);

function decodeMarker(raw: string): PendingAccountPurge {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new PendingAccountPurgeMarkerError();
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PendingAccountPurgeMarkerError();
  }
  const marker = value as Record<string, unknown>;
  const keys = Object.keys(marker);
  if (
    keys.length !== 3 ||
    !keys.every((key) => ['version', 'startedAt', 'failedIds'].includes(key)) ||
    marker.version !== 1 ||
    typeof marker.startedAt !== 'string' ||
    !Number.isFinite(Date.parse(marker.startedAt)) ||
    !Array.isArray(marker.failedIds) ||
    !marker.failedIds.every(
      (id): id is AccountPurgeManifestId =>
        typeof id === 'string' && manifestIds.has(id),
    ) ||
    new Set(marker.failedIds).size !== marker.failedIds.length
  ) {
    throw new PendingAccountPurgeMarkerError();
  }

  return {
    version: 1,
    startedAt: marker.startedAt,
    failedIds: marker.failedIds,
  };
}

export async function readPendingAccountPurge(): Promise<PendingAccountPurge | null> {
  const raw = await AsyncStorage.getItem(PENDING_ACCOUNT_PURGE_KEY);
  return raw === null ? null : decodeMarker(raw);
}

export async function writePendingAccountPurge(
  marker: PendingAccountPurge,
): Promise<void> {
  await AsyncStorage.setItem(PENDING_ACCOUNT_PURGE_KEY, JSON.stringify(marker));
}

export async function removePendingAccountPurge(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_ACCOUNT_PURGE_KEY);
}
