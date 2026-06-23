import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { BlurView } from 'expo-blur';

import { useReduceTransparency } from '../hooks/useReduceTransparency';
import { materials, type MaterialTier } from '../theme/materials';

/**
 * Universal material surface — wraps `expo-blur`'s `BlurView` with the
 * Fresh Greens tier system. Carries a 0.5pt hairline border by default
 * (the Apple signature on every UIVisualEffect). Falls back to a solid
 * surface when:
 *   - iOS user has Reduce Transparency on
 *   - Android (expo-blur on Android is best-effort; we render solid for
 *     deterministic UX rather than trust the platform fallback)
 *
 * Tiers (see `theme/materials.ts`):
 *   - chrome → FABs, search bar over map
 *   - sheet  → bottom sheets
 *   - card   → embedded cards on light-gray pages
 *   - modal  → full-screen modals
 *
 * Usage:
 *   <MaterialSurface tier="sheet" style={{ borderRadius: radii.xl }}>
 *     {children}
 *   </MaterialSurface>
 *
 * NOTE: Consumers control `borderRadius` via `style` — the surface
 * itself is shape-agnostic. The hairline border + blur respect whatever
 * radius the consumer applies. This is intentional: a FAB wants pill,
 * a sheet wants 28pt top corners, a card wants 16pt — one component
 * shouldn't bake the shape in.
 */
export function MaterialSurface({
  tier,
  children,
  style,
  hairline = true,
  ...viewProps
}: {
  tier: MaterialTier;
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Set false to suppress the 0.5pt hairline (rare — only when the
   *  consumer is handling its own border). Defaults true. */
  hairline?: boolean;
} & Omit<ViewProps, 'style'>) {
  const reduceTransparency = useReduceTransparency();
  const cfg = materials[tier];

  const borderStyle: ViewStyle | undefined = hairline
    ? { borderWidth: StyleSheet.hairlineWidth, borderColor: cfg.hairline }
    : undefined;

  if (reduceTransparency) {
    return (
      <View
        {...viewProps}
        style={[styles.fallback, { backgroundColor: cfg.fallback }, borderStyle, style]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      {...viewProps}
      intensity={cfg.intensity}
      tint={cfg.tint}
      style={[styles.blur, borderStyle, style]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    // BlurView clips its children to its bounds — consumers control
    // borderRadius via `style`. overflow:'hidden' is required because
    // BlurView's native impl doesn't always honor borderRadius without it.
    overflow: 'hidden',
  },
  fallback: {
    overflow: 'hidden',
  },
});
