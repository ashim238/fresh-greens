import type { ViewStyle } from 'react-native';

/**
 * Universal "pressed" feedback for Pressable components — 70% opacity
 * while the user is pressing. Applied via Pressable's functional style
 * prop:
 *
 *   <Pressable style={({ pressed }) => [styles.btn, pressed && pressedDim]} />
 *
 * Centralizes the value so a future change (different opacity, scale
 * transform, color shift) lands in one place. iOS HIG expects this
 * subtle dim on tap; without it, taps feel inert. Skip on Pressables
 * that already have custom press handling (e.g., color-changing toggles)
 * or that are intentionally inert (the dim would compete with the
 * opacity-0.5 inert state used in /menu).
 */
export const pressedDim: ViewStyle = { opacity: 0.7 };
