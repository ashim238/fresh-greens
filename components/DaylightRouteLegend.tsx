import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import DaylightMoon from '../assets/illustrations/daylight-moon.svg';
import DaylightSun from '../assets/illustrations/daylight-sun.svg';
import {
  cloudDesaturate,
  DAYLIGHT_LEGEND_A11Y_LABEL,
  DAYLIGHT_LEGEND_ANCHORS,
  type DaylightBand,
} from '../lib/daylight';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';

/**
 * Route daylight key — color gradient + line-style swatches that mirror
 * the map polyline's WCAG 1.4.1 dash patterns (solid → dashed → dotted
 * = more → less light). Shared by /home's route-preview card and
 * /en-route's expanded bottom sheet.
 */
export function DaylightRouteLegend({
  cloudCoverPct,
  style,
}: {
  cloudCoverPct?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const gradientColors = DAYLIGHT_LEGEND_ANCHORS.map(({ color }) =>
    cloudDesaturate(color, cloudCoverPct),
  ) as [string, string, string];

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={DAYLIGHT_LEGEND_A11Y_LABEL}
      accessibilityIgnoresInvertColors
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientBar}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
      <View
        style={styles.patternRow}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {DAYLIGHT_LEGEND_ANCHORS.map(({ band, color }, idx) => (
          <PatternSwatch key={band} band={band} color={gradientColors[idx]} />
        ))}
      </View>
      <View
        style={styles.iconRow}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        <DaylightSun width={16} height={16} />
        <DaylightMoon width={16} height={16} />
      </View>
    </View>
  );
}

function PatternSwatch({ band, color }: { band: DaylightBand; color: string }) {
  switch (band) {
    case 'day':
      return <View style={[styles.solidSwatch, { backgroundColor: color }]} />;
    case 'twilight':
      return (
        <View style={styles.patternCell}>
          {TWILIGHT_DASHES.map((i) => (
            <View key={i} style={[styles.dashMark, { backgroundColor: color }]} />
          ))}
        </View>
      );
    case 'night':
      return (
        <View style={styles.patternCell}>
          {NIGHT_DOTS.map((i) => (
            <View key={i} style={[styles.dotMark, { backgroundColor: color }]} />
          ))}
        </View>
      );
  }
}

const TWILIGHT_DASHES = [0, 1, 2, 3] as const;
const NIGHT_DOTS = [0, 1, 2, 3, 4] as const;

const styles = StyleSheet.create({
  container: {
    // Fixed 96pt right-column width per Figma — parent rows pair this
    // with a flexing label on the left (/home via row, en-route expanded).
    width: 96,
    gap: spacing.xs,
  },
  gradientBar: {
    height: 4,
    borderRadius: radii.pill,
  },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  patternCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  solidSwatch: {
    flex: 1,
    height: 3,
    borderRadius: radii.pill,
  },
  dashMark: {
    width: 5,
    height: 3,
    borderRadius: radii.pill,
  },
  dotMark: {
    width: 2,
    height: 2,
    borderRadius: 1,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
