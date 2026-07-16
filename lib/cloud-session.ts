import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type CloudSessionRead =
  | { kind: 'missing' }
  | { kind: 'found' };

export type CloudRevokeResult =
  | { kind: 'terminal'; reason: 'revoked' | 'no-session' | 'auth-invalid' }
  | { kind: 'retryable'; reason: 'network' | 'server'; error: Error }
  | {
      kind: 'required-failure';
      reason: 'unexpected-client';
      error: Error;
    };

export interface CloudSessionOwner {
  hydrateLocalSession(): Promise<CloudSessionRead>;
  ensureSession(signal?: AbortSignal): Promise<void>;
  revokeCurrentSession(signal?: AbortSignal): Promise<CloudRevokeResult>;
  clearLocalSession(): Promise<void>;
}

export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; is_anonymous?: boolean };
};

export const SUPABASE_SECURE_SESSION_KEY =
  'fresh-greens.supabase-session.v2';
export const SUPABASE_LEGACY_SESSION_KEY =
  'fresh-greens.supabase-session.v1';

type CloudSessionOperation =
  | 'local'
  | 'refresh'
  | 'signup'
  | 'abort'
  | 'stale';

export class CloudSessionError extends Error {
  readonly code = 'CLOUD_SESSION_ERROR';

  constructor(
    message: string,
    readonly operation: CloudSessionOperation,
  ) {
    super(message);
    this.name = 'CloudSessionError';
  }
}

const SESSION_KEYS = [
  'access_token',
  'refresh_token',
  'expires_at',
  'user',
] as const;
const USER_KEYS = ['id', 'is_anonymous'] as const;
const EXPIRY_SKEW_SECONDS = 60;

let currentSession: SupabaseSession | null = null;
let ownerGeneration = 0;
let localClearRequired = false;
let mutationTail: Promise<void> = Promise.resolve();
let decisionTail: Promise<void> = Promise.resolve();

type RevokeFlight = {
  generation: number;
  controller: AbortController;
  promise: Promise<CloudRevokeResult>;
  subscribers: number;
  settled: boolean;
};

let revokeFlight: RevokeFlight | null = null;

function authBase(): string {
  return `${process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')}/auth/v1`;
}

function anonKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidExpiry(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0
  );
}

function decodeStoredSession(raw: string): SupabaseSession {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new CloudSessionError(
      'Stored cloud session is malformed',
      'local',
    );
  }

  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, SESSION_KEYS) ||
    !isNonEmptyString(value.access_token) ||
    !isNonEmptyString(value.refresh_token) ||
    !isValidExpiry(value.expires_at) ||
    !isRecord(value.user) ||
    !hasOnlyKeys(value.user, USER_KEYS) ||
    !isNonEmptyString(value.user.id) ||
    (value.user.is_anonymous !== undefined &&
      typeof value.user.is_anonymous !== 'boolean')
  ) {
    throw new CloudSessionError(
      'Stored cloud session is malformed',
      'local',
    );
  }

  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_at: value.expires_at,
    user: {
      id: value.user.id,
      ...(value.user.is_anonymous === undefined
        ? {}
        : { is_anonymous: value.user.is_anonymous }),
    },
  };
}

function decodeAuthResponse(value: unknown): SupabaseSession {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.access_token) ||
    !isNonEmptyString(value.refresh_token) ||
    !isRecord(value.user) ||
    !isNonEmptyString(value.user.id) ||
    (value.user.is_anonymous !== undefined &&
      typeof value.user.is_anonymous !== 'boolean') ||
    (value.expires_at !== undefined && !isValidExpiry(value.expires_at))
  ) {
    throw new CloudSessionError(
      'Cloud auth response was invalid',
      'signup',
    );
  }

  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_at:
      value.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: value.user.id,
      is_anonymous: value.user.is_anonymous ?? true,
    },
  };
}

function isUsable(session: SupabaseSession): boolean {
  return session.expires_at > Date.now() / 1000 + EXPIRY_SKEW_SECONDS;
}

function assertActive(
  generation: number,
  signal?: AbortSignal,
): void {
  if (generation !== ownerGeneration) {
    throw new CloudSessionError(
      'Cloud session operation became stale',
      'stale',
    );
  }
  if (localClearRequired) {
    throw new CloudSessionError(
      'Local cloud session clearing is required',
      'local',
    );
  }
  if (signal?.aborted) {
    throw new CloudSessionError('Cloud session operation was aborted', 'abort');
  }
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationTail.then(operation, operation);
  mutationTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function enqueueDecision<T>(
  generation: number,
  signal: AbortSignal | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    assertActive(generation, signal);
  } catch (error) {
    return Promise.reject(error);
  }

  let started = false;
  const run = async () => {
    started = true;
    assertActive(generation, signal);
    return operation();
  };
  const result = decisionTail.then(run, run);
  decisionTail = result.then(
    () => undefined,
    () => undefined,
  );
  if (!signal) return result;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (complete: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      complete();
    };
    const onAbort = () => {
      if (started) return;
      finish(() =>
        reject(
          new CloudSessionError(
            'Cloud session operation was aborted',
            'abort',
          ),
        ),
      );
    };

    signal.addEventListener('abort', onAbort, { once: true });
    result.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

function secureStoreOptions(): SecureStore.SecureStoreOptions {
  return {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  };
}

async function rollbackAbortedWrite(previousRaw: string | null): Promise<void> {
  try {
    if (previousRaw === null) {
      await SecureStore.deleteItemAsync(SUPABASE_SECURE_SESSION_KEY);
    } else {
      await SecureStore.setItemAsync(
        SUPABASE_SECURE_SESSION_KEY,
        previousRaw,
        secureStoreOptions(),
      );
    }
  } catch {
    throw new CloudSessionError(
      'Unable to restore the local cloud session after cancellation',
      'local',
    );
  }
}

async function persistSession(
  session: SupabaseSession,
  generation: number,
  signal: AbortSignal | undefined,
  previousRaw: string | null,
): Promise<void> {
  const encoded = JSON.stringify(session);
  await enqueueMutation(async () => {
    assertActive(generation, signal);
    try {
      await SecureStore.setItemAsync(
        SUPABASE_SECURE_SESSION_KEY,
        encoded,
        secureStoreOptions(),
      );
    } catch {
      throw new CloudSessionError(
        'Unable to persist the local cloud session',
        'local',
      );
    }

    if (generation !== ownerGeneration) {
      throw new CloudSessionError(
        'Cloud session operation became stale',
        'stale',
      );
    }
    if (signal?.aborted) {
      await rollbackAbortedWrite(previousRaw);
      throw new CloudSessionError(
        'Cloud session operation was aborted',
        'abort',
      );
    }
    currentSession = session;
  });
}

async function readSecureSession(
  generation: number,
): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(SUPABASE_SECURE_SESSION_KEY);
    assertActive(generation);
    return raw;
  } catch (error) {
    if (error instanceof CloudSessionError) throw error;
    throw new CloudSessionError(
      'Unable to read the local cloud session',
      'local',
    );
  }
}

async function readLegacySession(
  generation: number,
): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SUPABASE_LEGACY_SESSION_KEY);
    assertActive(generation);
    return raw;
  } catch (error) {
    if (error instanceof CloudSessionError) throw error;
    throw new CloudSessionError(
      'Unable to read the legacy cloud session',
      'local',
    );
  }
}

async function removeLegacySession(generation: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(SUPABASE_LEGACY_SESSION_KEY);
    assertActive(generation);
  } catch (error) {
    if (error instanceof CloudSessionError) throw error;
    throw new CloudSessionError(
      'Unable to finish cloud session migration',
      'local',
    );
  }
}

async function readErrorPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const AUTH_INVALID_CODES = new Set([
  'access_token_expired',
  'bad_jwt',
  'invalid_access_token',
  'invalid_jwt',
  'invalid_refresh_token',
  'invalid_session',
  'jwt_expired',
  'refresh_token_expired',
  'refresh_token_not_found',
  'session_expired',
  'session_not_found',
  'session_revoked',
]);

const AUTH_INVALID_PHRASES = [
  /^(?:the )?session is invalid[.!]?$/i,
  /^(?:the )?session (?:has )?expired[.!]?$/i,
  /^(?:the )?session (?:is |was )?revoked[.!]?$/i,
  /^invalid jwt[.!]?$/i,
  /^jwt (?:is )?(?:invalid|expired)[.!]?$/i,
  /^(?:access|bearer|refresh) token (?:is |was )?(?:invalid|expired|revoked|not found)[.!]?$/i,
];

function isInvalidAuthPayload(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  const codes = [payload.code, payload.error_code, payload.error]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase());
  if (codes.some((code) => AUTH_INVALID_CODES.has(code))) return true;

  const phrases = [
    payload.error,
    payload.message,
    payload.msg,
    payload.error_description,
  ].filter((value): value is string => typeof value === 'string');
  return phrases.some((phrase) =>
    AUTH_INVALID_PHRASES.some((pattern) => pattern.test(phrase.trim())),
  );
}

function isNativeAbort(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function subscribeToRevokeFlight(
  flight: RevokeFlight,
  signal?: AbortSignal,
): Promise<CloudRevokeResult> {
  if (signal?.aborted) {
    return Promise.reject(
      new CloudSessionError('Cloud session operation was aborted', 'abort'),
    );
  }

  flight.subscribers += 1;
  return new Promise<CloudRevokeResult>((resolve, reject) => {
    let callerSettled = false;
    const finish = (complete: () => void, aborted = false) => {
      if (callerSettled) return;
      callerSettled = true;
      signal?.removeEventListener('abort', onAbort);
      flight.subscribers -= 1;
      if (aborted && flight.subscribers === 0 && !flight.settled) {
        if (revokeFlight === flight) revokeFlight = null;
        flight.controller.abort();
      }
      complete();
    };
    const onAbort = () =>
      finish(
        () =>
          reject(
            new CloudSessionError(
              'Cloud session operation was aborted',
              'abort',
            ),
          ),
        true,
      );

    signal?.addEventListener('abort', onAbort, { once: true });
    flight.promise.then(
      (result) => finish(() => resolve(result)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

async function fetchAuth(
  path: string,
  body: Record<string, unknown>,
  generation: number,
  operation: 'refresh' | 'signup',
  signal?: AbortSignal,
): Promise<Response> {
  assertActive(generation, signal);
  try {
    const result = await fetch(`${authBase()}${path}`, {
      method: 'POST',
      headers: {
        apikey: anonKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    assertActive(generation, signal);
    return result;
  } catch (error) {
    if (error instanceof CloudSessionError) throw error;
    if (isNativeAbort(error, signal)) {
      throw new CloudSessionError(
        'Cloud session operation was aborted',
        'abort',
      );
    }
    throw new CloudSessionError('Cloud auth request failed', operation);
  }
}

async function responseSession(
  response: Response,
  operation: 'refresh' | 'signup',
): Promise<SupabaseSession> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CloudSessionError('Cloud auth response was invalid', operation);
  }

  try {
    return decodeAuthResponse(payload);
  } catch {
    throw new CloudSessionError('Cloud auth response was invalid', operation);
  }
}

async function refreshSession(
  session: SupabaseSession,
  generation: number,
  signal?: AbortSignal,
): Promise<SupabaseSession | null> {
  const response = await fetchAuth(
    '/token?grant_type=refresh_token',
    { refresh_token: session.refresh_token },
    generation,
    'refresh',
    signal,
  );

  if (!response.ok) {
    if (response.status >= 500) {
      throw new CloudSessionError('Cloud auth server is unavailable', 'refresh');
    }
    const payload = await readErrorPayload(response);
    assertActive(generation, signal);
    if (
      response.status === 401 ||
      response.status === 403 ||
      isInvalidAuthPayload(payload)
    ) {
      currentSession = null;
      return null;
    }
    throw new CloudSessionError('Cloud auth refresh was rejected', 'refresh');
  }

  const refreshed = await responseSession(response, 'refresh');
  assertActive(generation, signal);
  await persistSession(
    refreshed,
    generation,
    signal,
    JSON.stringify(session),
  );
  return refreshed;
}

async function hydrateLocalSessionUnlocked(
  generation: number,
): Promise<CloudSessionRead> {
  assertActive(generation);
  const secureRaw = await readSecureSession(generation);
  if (secureRaw !== null) {
    const session = decodeStoredSession(secureRaw);
    assertActive(generation);
    currentSession = session;
    await removeLegacySession(generation);
    return { kind: 'found' };
  }

  const legacyRaw = await readLegacySession(generation);
  if (legacyRaw === null) {
    currentSession = null;
    return { kind: 'missing' };
  }

  const session = decodeStoredSession(legacyRaw);
  await persistSession(session, generation, undefined, null);
  await removeLegacySession(generation);
  return { kind: 'found' };
}

async function getCloudSessionUnlocked(
  generation: number,
  signal?: AbortSignal,
): Promise<SupabaseSession | null> {
  assertActive(generation, signal);
  if (currentSession && isUsable(currentSession)) return currentSession;
  if (!currentSession) {
    await hydrateLocalSessionUnlocked(generation);
  }

  assertActive(generation, signal);
  const stored = currentSession;
  if (!stored) return null;
  if (isUsable(stored)) return stored;
  return refreshSession(stored, generation, signal);
}

export async function getCloudSession(
  signal?: AbortSignal,
): Promise<SupabaseSession | null> {
  const generation = ownerGeneration;
  return enqueueDecision(generation, signal, () =>
    getCloudSessionUnlocked(generation, signal),
  );
}

export async function ensureCloudSession(
  signal?: AbortSignal,
): Promise<SupabaseSession> {
  const generation = ownerGeneration;
  return enqueueDecision(generation, signal, async () => {
    const existing = await getCloudSessionUnlocked(generation, signal);
    assertActive(generation, signal);
    if (existing) return existing;

    const response = await fetchAuth(
      '/signup',
      {},
      generation,
      'signup',
      signal,
    );
    if (!response.ok) {
      throw new CloudSessionError(
        'Anonymous cloud signup was rejected',
        'signup',
      );
    }

    const created = await responseSession(response, 'signup');
    assertActive(generation, signal);
    await persistSession(created, generation, signal, null);
    return created;
  });
}

class SupabaseCloudSessionOwner implements CloudSessionOwner {
  async hydrateLocalSession(): Promise<CloudSessionRead> {
    const generation = ownerGeneration;
    return enqueueDecision(generation, undefined, () =>
      hydrateLocalSessionUnlocked(generation),
    );
  }

  async ensureSession(signal?: AbortSignal): Promise<void> {
    await ensureCloudSession(signal);
  }

  revokeCurrentSession(
    signal?: AbortSignal,
  ): Promise<CloudRevokeResult> {
    const generation = ownerGeneration;
    try {
      assertActive(generation, signal);
    } catch (error) {
      return Promise.reject(error);
    }

    let flight = revokeFlight;
    if (!flight || flight.generation !== generation) {
      const controller = new AbortController();
      const pending = enqueueDecision(generation, controller.signal, () =>
        this.revokeCurrentSessionUnlocked(
          generation,
          controller.signal,
        ),
      );
      const createdFlight = {
        generation,
        controller,
        promise: undefined as unknown as Promise<CloudRevokeResult>,
        subscribers: 0,
        settled: false,
      };
      createdFlight.promise = pending.then(
        (result) => {
          createdFlight.settled = true;
          if (revokeFlight === createdFlight) revokeFlight = null;
          return result;
        },
        (error: unknown) => {
          createdFlight.settled = true;
          if (revokeFlight === createdFlight) revokeFlight = null;
          throw error;
        },
      );
      revokeFlight = createdFlight;
      flight = createdFlight;
    }

    return subscribeToRevokeFlight(flight, signal);
  }

  private async revokeCurrentSessionUnlocked(
    generation: number,
    signal?: AbortSignal,
  ): Promise<CloudRevokeResult> {
    assertActive(generation, signal);
    if (!currentSession) {
      await hydrateLocalSessionUnlocked(generation);
    }
    assertActive(generation, signal);
    const session = currentSession;
    if (!session) return { kind: 'terminal', reason: 'no-session' };

    let response: Response;
    try {
      response = await fetch(`${authBase()}/logout`, {
        method: 'POST',
        headers: {
          apikey: anonKey(),
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        signal,
      });
      assertActive(generation, signal);
    } catch (error) {
      if (error instanceof CloudSessionError) throw error;
      if (isNativeAbort(error, signal)) {
        throw new CloudSessionError(
          'Cloud session operation was aborted',
          'abort',
        );
      }
      return {
        kind: 'retryable',
        reason: 'network',
        error: new CloudSessionError(
          'Cloud session revocation request failed',
          'refresh',
        ),
      };
    }

    if (response.ok) return { kind: 'terminal', reason: 'revoked' };
    if (response.status === 401 || response.status === 403) {
      return { kind: 'terminal', reason: 'auth-invalid' };
    }
    if (response.status >= 500) {
      return {
        kind: 'retryable',
        reason: 'server',
        error: new CloudSessionError(
          `Cloud session revocation server failure (${response.status})`,
          'refresh',
        ),
      };
    }

    const payload = await readErrorPayload(response);
    assertActive(generation, signal);
    if (isInvalidAuthPayload(payload)) {
      return { kind: 'terminal', reason: 'auth-invalid' };
    }
    return {
      kind: 'required-failure',
      reason: 'unexpected-client',
      error: new CloudSessionError(
        `Cloud session revocation was rejected (${response.status})`,
        'refresh',
      ),
    };
  }

  clearLocalSession(): Promise<void> {
    localClearRequired = true;
    ownerGeneration += 1;
    const clearGeneration = ownerGeneration;
    currentSession = null;
    return enqueueMutation(async () => {
      const results = await Promise.allSettled([
        SecureStore.deleteItemAsync(SUPABASE_SECURE_SESSION_KEY),
        AsyncStorage.removeItem(SUPABASE_LEGACY_SESSION_KEY),
      ]);
      const failureCount = results.filter(
        (result) => result.status === 'rejected',
      ).length;
      if (failureCount > 0) {
        throw new CloudSessionError(
          `Unable to clear local cloud session (${failureCount} storage operation${
            failureCount === 1 ? '' : 's'
          } failed)`,
          'local',
        );
      }
      if (ownerGeneration === clearGeneration) {
        localClearRequired = false;
      }
    });
  }
}

export const supabaseCloudSessionOwner: CloudSessionOwner =
  new SupabaseCloudSessionOwner();
