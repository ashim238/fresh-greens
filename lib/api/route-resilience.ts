import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { Route } from './routes';
import type { Zone } from './zones';

export const ROUTE_RESILIENCE_STORAGE_KEY =
  'fresh-greens.route-resilience.v1';

export type RouteResilienceBundle = {
  schemaVersion: 1;
  tripKey: string;
  routeKey: string;
  routeSetKey: string;
  corridorPolicyVersion: 'adaptive-corridor-v1';
  departureTimeMs: number;
  route: Route;
  validatedEvidence: Zone[];
  knownWeakSignalZones: [];
  createdAtMs: number;
  enrichedAreas: [];
};

export type RouteResilienceInput = {
  route: Route;
  routes: Route[];
  validatedEvidence: Zone[];
  departureTimeMs: number;
  createdAtMs?: number;
};

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function routeIdentity(route: Route): string {
  return route.id;
}

function routeSetIdentity(routes: Route[]): string {
  return stableHash(routes.map(routeIdentity).sort().join('|'));
}

export function createRouteResilienceBundle(
  input: RouteResilienceInput,
): RouteResilienceBundle {
  const routeKey = routeIdentity(input.route);
  const routeSetKey = routeSetIdentity(input.routes);
  const departureTimeMs = input.departureTimeMs;
  return {
    schemaVersion: 1,
    tripKey: stableHash(`${routeSetKey}:${routeKey}:${departureTimeMs}`),
    routeKey,
    routeSetKey,
    corridorPolicyVersion: 'adaptive-corridor-v1',
    departureTimeMs,
    route: input.route,
    validatedEvidence: input.validatedEvidence,
    knownWeakSignalZones: [],
    createdAtMs: input.createdAtMs ?? Date.now(),
    enrichedAreas: [],
  };
}

export async function saveRouteResilienceBundle(
  bundle: RouteResilienceBundle,
): Promise<void> {
  await AsyncStorage.setItem(
    ROUTE_RESILIENCE_STORAGE_KEY,
    JSON.stringify(bundle),
  );
}

export async function prepareRouteResilienceBundle(
  input: RouteResilienceInput,
): Promise<RouteResilienceBundle> {
  const bundle = createRouteResilienceBundle(input);
  await saveRouteResilienceBundle(bundle);
  return bundle;
}

/**
 * Account-isolation boundary for the route-trust offline bundle. The store is
 * inside the authoritative account manifest.
 */
export async function purgeRouteResilienceForAccount(): Promise<void> {
  await AsyncStorage.removeItem(ROUTE_RESILIENCE_STORAGE_KEY);
  await FileSystem.deleteAsync(
    `${FileSystem.documentDirectory}route-resilience/`,
    { idempotent: true },
  );
}
