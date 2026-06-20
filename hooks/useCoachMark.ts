import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const PREFIX = '@fg:coach:';

/**
 * One-time coach mark flag backed by AsyncStorage.
 *
 * Returns:
 *   - `visible` — true until dismissed (one-shot by default: a
 *     persisted dismissal keeps subsequent mounts hidden).
 *   - `dismiss()` — hides + persists the dismissal.
 *   - `show()` — transient in-session re-display. Sets `visible` true
 *     WITHOUT touching storage, so the persisted "they've seen it"
 *     truth stays accurate. For an in-the-moment "show me again" peek.
 *
 * For a persistent global re-arm (forget all marks so they show fresh
 * on next mount), use the standalone `resetCoachMarks()` below.
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

  const show = useCallback(() => setVisible(true), []);

  return { visible, dismiss, show };
}

/**
 * Persistent global re-arm — clears every stored coach-mark flag so
 * each coach-marked screen shows its mark fresh on the next mount.
 * Fire-and-forget; errors swallowed (same posture as `dismiss`).
 *
 * Distinct from `show()`: `show()` is a transient in-session peek that
 * leaves the persisted seen-state intact; `resetCoachMarks()` forgets
 * the seen-state entirely.
 */
export async function resetCoachMarks(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const coachKeys = keys.filter((k) => k.startsWith(PREFIX));
    if (coachKeys.length > 0) await AsyncStorage.multiRemove(coachKeys);
  } catch {
    // best-effort — same posture as dismiss()
  }
}
