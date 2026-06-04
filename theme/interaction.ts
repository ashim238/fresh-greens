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

/**
 * 44×44 painted tap target per iOS HIG — the painted floor for icon
 * buttons whose visible glyph is sub-44pt (header back/close X, sheet
 * close buttons, "remove" trash, etc.). The icon centers inside via
 * alignItems/justifyContent.
 *
 *   <Pressable style={tapTarget44}>
 *     <X size={20} ... />
 *   </Pressable>
 *
 * Per `.cursorrules` tap-target rule: "iOS HIG 44×44 pt minimum on both
 * axes — on the visual, not just the hit area." Reaching 44pt via
 * `hitSlop` on a sub-44 visual is forbidden — that's forgiveness padding
 * ON TOP of compliance, not the compliance mechanism. Use this token as
 * the compliance mechanism; reach for hitSlop only as forgiveness on
 * top.
 *
 * Extracted in audit #10 after the same `{ width:44, height:44,
 * alignItems:'center', justifyContent:'center' }` block appeared in 7+
 * files as `headerIconBtn` / `backBtn` / `closeBtn` / similar — a
 * rule-of-three trigger that bit in the audit (a same-file Pressable
 * was left inconsistent because there was no shared shape to reach
 * for). Use this; don't redefine it locally.
 *
 * If you need a wider/asymmetric target (e.g. a text-link with
 * `minHeight: 44` + `paddingHorizontal`), define it locally — this token
 * is the strict 44×44 square only.
 */
export const tapTarget44: ViewStyle = {
  width: 44,
  height: 44,
  alignItems: 'center',
  justifyContent: 'center',
};
