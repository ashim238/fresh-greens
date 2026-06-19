import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const PREFIX = '@fg:coach:';

/**
 * One-time coach mark flag backed by AsyncStorage. Returns
 * `visible` (true until dismissed) and `dismiss` (persists the
 * dismissal so subsequent mounts start hidden).
 */
export function useCoachMark(key: string) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seen = await AsyncStorage.getItem(PREFIX + key);
      if (!cancelled && seen == null) setVisible(true);
    })();
    return () => { cancelled = true; };
  }, [key]);

  const dismiss = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(PREFIX + key, '1').catch(() => {});
  }, [key]);

  return { visible, dismiss };
}
