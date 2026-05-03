import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

type Props = {
  /** Total number of dots. */
  total: number;
  /** Zero-based index of the active dot. */
  activeIndex: number;
};

/**
 * iOS-style page-control dots — used at the top of onboarding screens to
 * show progress through a stepped flow. Active dot is fully opaque; inactive
 * dots are 30% white.
 *
 * Figma node: 488:54907 (Page Control component instance).
 *
 * Usage:
 *   <PageControl total={4} activeIndex={1} />  // step 2 of 4
 */
export function PageControl({ total, activeIndex }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i !== activeIndex && styles.dotInactive]}
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
    backgroundColor: colors.white,
  },
  dotInactive: {
    opacity: 0.3,
  },
});
