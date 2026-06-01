// hooks/useCalendarConnection.ts
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  getCalendarConnection,
  requestCalendarPermission,
  setCalendarConnected,
} from '../lib/api/calendar';

/**
 * Reactive wrapper over the calendar connection flag. Re-reads on focus
 * (matching usePreferences) so the /menu carousel tile + /search
 * Upcoming section both reflect a connection made elsewhere.
 *
 * connect() runs the OS permission prompt; on grant it persists
 * connected=true, on denial it surfaces the standard "enable in
 * Settings" Alert and leaves connected=false (honest — we didn't get
 * access). disconnect() flips the flag off (the OS permission itself is
 * managed in iOS Settings; this is the app-level opt-out).
 */
export function useCalendarConnection() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const c = await getCalendarConnection();
        if (!cancelled) {
          setConnected(c.connected);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const connect = useCallback(async () => {
    const granted = await requestCalendarPermission();
    if (!granted) {
      Alert.alert(
        'Calendar access needed',
        'Allow Calendar access for Fresh Greens in Settings to see your upcoming events as destinations.',
      );
      return false;
    }
    await setCalendarConnected(true);
    setConnected(true);
    return true;
  }, []);

  const disconnect = useCallback(async () => {
    await setCalendarConnected(false);
    setConnected(false);
  }, []);

  return { connected, loading, connect, disconnect };
}
