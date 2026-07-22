import { processLock } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const supabaseAuthStorage = {
  getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(key, value, options);
  },
  removeItem(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  },
};

type SupabaseEnvironment = Record<string, string | undefined>;

export type LocalSessionCompareClearResult =
  | 'cleared'
  | 'absent'
  | 'changed';

export function getSupabaseAuthStorageKey(url: string): string {
  const hostname = new URL(url).hostname;
  return `sb-${hostname.split('.')[0]}-auth-token`;
}

function configuredStorageKey(
  env: SupabaseEnvironment = process.env,
): string | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  return url ? getSupabaseAuthStorageKey(url) : null;
}

function storageKeys(storageKey: string): string[] {
  return [storageKey, `${storageKey}-code-verifier`, `${storageKey}-user`];
}

async function removeAndVerify(storageKey: string): Promise<void> {
  const keys = storageKeys(storageKey);
  await Promise.all(keys.map((key) => supabaseAuthStorage.removeItem(key)));
  const remaining = await Promise.all(
    keys.map((key) => supabaseAuthStorage.getItem(key)),
  );
  if (remaining.some((value) => value !== null)) {
    throw new Error('Supabase local auth storage was not cleared');
  }
}

export async function ensureSupabaseLocalSessionStorageCleared(
  env: SupabaseEnvironment = process.env,
): Promise<void> {
  const storageKey = configuredStorageKey(env);
  if (!storageKey) return;
  await processLock(`lock:${storageKey}`, -1, () => removeAndVerify(storageKey));
}

export async function clearSupabaseLocalSessionIfAccessTokenMatches(
  accessToken: string,
  env: SupabaseEnvironment = process.env,
): Promise<LocalSessionCompareClearResult> {
  const storageKey = configuredStorageKey(env);
  if (!storageKey) return 'absent';

  return processLock(`lock:${storageKey}`, -1, async () => {
    const raw = await supabaseAuthStorage.getItem(storageKey);
    if (raw === null) {
      await removeAndVerify(storageKey);
      return 'absent';
    }

    let stored: unknown;
    try {
      stored = JSON.parse(raw);
    } catch {
      return 'changed';
    }
    if (
      typeof stored !== 'object' ||
      stored === null ||
      Array.isArray(stored) ||
      (stored as Record<string, unknown>).access_token !== accessToken
    ) {
      return 'changed';
    }

    await removeAndVerify(storageKey);
    return 'cleared';
  });
}
