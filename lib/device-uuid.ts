import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORE_KEY = 'fresh-greens.device-uuid.v1';

let cached: string | null = null;

export async function getDeviceUUID(): Promise<string> {
  if (cached) return cached;

  const stored = await SecureStore.getItemAsync(STORE_KEY);
  if (stored) {
    cached = stored;
    return stored;
  }

  const uuid = generateUUID();
  await SecureStore.setItemAsync(STORE_KEY, uuid, {
    keychainAccessible:
      Platform.OS === 'ios'
        ? SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
        : undefined,
  });
  cached = uuid;
  return uuid;
}

function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
