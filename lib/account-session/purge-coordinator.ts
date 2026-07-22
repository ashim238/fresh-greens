import { backendAuthRepository } from '../supabase/auth-repository';
import {
  ACCOUNT_PURGE_MANIFEST,
  AccountPurgeRemoteError,
  type AccountPurgeEntry,
  type AccountPurgeManifestId,
} from './purge-manifest';
import {
  readPendingAccountPurge,
  removePendingAccountPurge,
  writePendingAccountPurge,
  type PendingAccountPurge,
} from './purge-marker';

export { AccountPurgeRemoteError } from './purge-manifest';

export type AccountPurgeFailure = {
  id: AccountPurgeManifestId;
  errorName: string;
  scope: 'local' | 'remote';
  retryable: boolean;
};

export type AccountPurgeResult =
  | { status: 'completed'; failures: [] }
  | { status: 'completed-locally'; failures: [] }
  | { status: 'failed'; failures: AccountPurgeFailure[] }
  | { status: 'not-needed'; failures: [] };

export class AccountPurgeFinishNotAllowedError extends Error {
  constructor() {
    super('Finishing on this device is not available');
    this.name = 'AccountPurgeFinishNotAllowedError';
  }
}

export type AccountPurgeCoordinatorDependencies = {
  entries: readonly AccountPurgeEntry[];
  clearLocalCloudSession(): Promise<void>;
  now(): number;
};

function failureFor(
  entry: AccountPurgeEntry,
  reason: unknown,
  scope: AccountPurgeFailure['scope'] =
    entry.kind === 'remote' ? 'remote' : 'local',
): AccountPurgeFailure {
  const error = reason instanceof Error ? reason : new Error('Account purge failed');
  return {
    id: entry.id,
    errorName: error.name,
    scope,
    retryable:
      error instanceof AccountPurgeRemoteError ? error.retryable : true,
  };
}

function uniqueFailures(
  entries: readonly AccountPurgeEntry[],
  failures: readonly AccountPurgeFailure[],
): AccountPurgeFailure[] {
  const byId = new Map(failures.map((failure) => [failure.id, failure]));
  return entries.flatMap((entry) => {
    const failure = byId.get(entry.id);
    return failure ? [failure] : [];
  });
}

export function createAccountPurgeCoordinator(
  dependencies: AccountPurgeCoordinatorDependencies,
) {
  let inFlight: Promise<AccountPurgeResult> | null = null;
  let cloudRevocationAccepted = false;
  let localFinishAvailable = false;

  const share = (operation: () => Promise<AccountPurgeResult>) => {
    if (inFlight) return inFlight;
    const pending = operation().finally(() => {
      if (inFlight === pending) inFlight = null;
    });
    inFlight = pending;
    return pending;
  };

  const execute = async (
    marker: PendingAccountPurge,
    completionStatus: 'completed' | 'completed-locally' = 'completed',
  ): Promise<AccountPurgeResult> => {
    const selectedIds =
      marker.failedIds.length === 0 ? null : new Set(marker.failedIds);
    const stageTwo = dependencies.entries.filter(
      (entry) =>
        entry.kind !== 'identity' &&
        !(entry.kind === 'remote' && cloudRevocationAccepted) &&
        (selectedIds === null || selectedIds.has(entry.id)),
    );
    const stageTwoResults = await Promise.allSettled(
      stageTwo.map((entry) => entry.purge()),
    );
    const failures = stageTwoResults.flatMap((result, index) =>
      result.status === 'rejected'
        ? [failureFor(stageTwo[index], result.reason)]
        : [],
    );
    if (
      stageTwo.some(
        (entry, index) =>
          entry.kind === 'remote' && stageTwoResults[index].status === 'fulfilled',
      )
    ) {
      cloudRevocationAccepted = true;
    }

    if (failures.length > 0) {
      const ordered = uniqueFailures(dependencies.entries, failures);
      localFinishAvailable =
        ordered.length === 1 &&
        ordered[0].id === 'auth.supabase' &&
        ordered[0].scope === 'remote' &&
        ordered[0].retryable;
      await writePendingAccountPurge({
        ...marker,
        failedIds: ordered.map(({ id }) => id),
      });
      return { status: 'failed', failures: ordered };
    }

    const identityEntries = dependencies.entries.filter(
      (entry) => entry.kind === 'identity',
    );
    const identityResults = await Promise.allSettled(
      identityEntries.map((entry) => entry.purge()),
    );
    const commitFailures = identityResults.flatMap((result, index) =>
      result.status === 'rejected'
        ? [failureFor(identityEntries[index], result.reason)]
        : [],
    );

    const authEntry = dependencies.entries.find(
      (entry) => entry.id === 'auth.supabase',
    );
    if (commitFailures.length === 0 && authEntry) {
      try {
        await dependencies.clearLocalCloudSession();
      } catch (error) {
        commitFailures.push(failureFor(authEntry, error, 'local'));
      }
    }

    if (commitFailures.length > 0) {
      const ordered = uniqueFailures(dependencies.entries, commitFailures);
      localFinishAvailable = false;
      await writePendingAccountPurge({
        ...marker,
        failedIds: ordered.map(({ id }) => id),
      });
      return { status: 'failed', failures: ordered };
    }

    await removePendingAccountPurge();
    localFinishAvailable = false;
    return { status: completionStatus, failures: [] };
  };

  return {
    begin(
      onQuarantined?: () => void | Promise<void>,
    ): Promise<AccountPurgeResult> {
      return share(async () => {
        cloudRevocationAccepted = false;
        localFinishAvailable = false;
        const marker: PendingAccountPurge = {
          version: 1,
          startedAt: new Date(dependencies.now()).toISOString(),
          failedIds: [],
        };
        await writePendingAccountPurge(marker);
        await onQuarantined?.();
        return execute(marker);
      });
    },

    recover(): Promise<AccountPurgeResult> {
      return share(async () => {
        const marker = await readPendingAccountPurge();
        return marker === null
          ? { status: 'not-needed', failures: [] }
          : execute(marker);
      });
    },

    finishOnDevice(): Promise<AccountPurgeResult> {
      return share(async () => {
        if (!localFinishAvailable) {
          throw new AccountPurgeFinishNotAllowedError();
        }
        const marker = await readPendingAccountPurge();
        if (marker === null) {
          localFinishAvailable = false;
          throw new AccountPurgeFinishNotAllowedError();
        }
        cloudRevocationAccepted = true;
        localFinishAvailable = false;
        return execute(marker, 'completed-locally');
      });
    },
  };
}

export const accountPurgeCoordinator = createAccountPurgeCoordinator({
  entries: ACCOUNT_PURGE_MANIFEST,
  clearLocalCloudSession: () => backendAuthRepository.signOutLocal(),
  now: () => Date.now(),
});
