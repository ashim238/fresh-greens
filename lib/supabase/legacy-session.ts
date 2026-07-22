import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const LEGACY_SECURE_SESSION_KEY = 'fresh-greens.supabase-session.v2';
const LEGACY_ASYNC_SESSION_KEY = 'fresh-greens.supabase-session.v1';

export async function retireLegacySupabaseSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(LEGACY_SECURE_SESSION_KEY),
    AsyncStorage.removeItem(LEGACY_ASYNC_SESSION_KEY),
  ]);
}
