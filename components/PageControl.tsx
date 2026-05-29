import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

type Props = {
  /** Total number of dots. */
  total: number;
  /** Zero-based index of the active dot. */
  activeIndex: number;
  /**
   * Dot color. Defaults to `colors.white` for the onboarding register
   * (this component's original home — dark/colored backgrounds where
   * white dots have contrast). On light surfaces (e.g. /menu's white
   * Quick Tiles carousel) callers must pass a tinted color
   * (`colors.wiltedgreen` is the canonical pick) — white-on-white was
   * the actual bug that motivated this prop (M7 of the /menu audit).
   */
  color?: string;
};

/**
 * iOS-style page-control dots — used at the top of onboarding screens to
 * show progress through a stepped flow. Active dot is fully opaque; inactive
 * dots are 30% of the same color.
 *
 * Figma node: 488:54907 (Page Control component instance).
 *
 * Usage:
 *   <PageControl total={4} activeIndex={1} />                          // onboarding (white default)
 *   <PageControl total={3} activeIndex={0} color={colors.wiltedgreen} /> // light surface
 */
export function PageControl({ total, activeIndex, color = colors.white }: Props) {
  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={`Page ${activeIndex + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: color },
            i !== activeIndex && styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Matches Figma "Page Control" wrapper: h-44 with dots centered vertically.
    // Letting the wrapper own the height (instead of using paddingVertical)
    // matches the design system's structure 1:1 — the dots get exactly the
    // breathing room the wrapper gives them, no math required.
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    // backgroundColor applied inline from the `color` prop.
  },
  dotInactive: {
    opacity: 0.3,
  },
});
