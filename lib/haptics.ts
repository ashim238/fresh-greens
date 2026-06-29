import * as Haptics from 'expo-haptics';

/** Lightweight tap acknowledgment — selections, toggles, navigation. */
export function tap() {
  Haptics.selectionAsync().catch(() => {});
}

/** State transition — sheet expand/collapse, mode change, chip jump. */
export function shift() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Focused attention — map marker select, detail card open. */
export function focus() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Decisive action — placement confirm, long-press commit. */
export function commit() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/** Positive outcome — bookmark saved, notification scheduled, report submitted. */
export function confirm() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Something went wrong — permission denied, fetch failure. */
export function warn() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
