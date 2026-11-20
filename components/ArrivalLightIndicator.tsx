import { CloudSun } from 'phosphor-react-native/src/icons/CloudSun';
import { SunHorizon } from 'phosphor-react-native/src/icons/SunHorizon';
import { StyleSheet, Text, View } from 'react-native';

import DaylightMoon from '../assets/illustrations/daylight-moon.svg';
import DaylightSun from '../assets/illustrations/daylight-sun.svg';
import type { ArrivalLight } from '../lib/daylight';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const glyphs = {
  Daylight: <DaylightSun width={16} height={16} />,
  'Low light': <CloudSun size={16} color={colors.labelSecondary} weight="bold" />,
  Dusk: <SunHorizon size={16} color={colors.labelSecondary} weight="bold" />,
  'After dark': <DaylightMoon width={16} height={16} />,
} satisfies Record<ArrivalLight, React.ReactElement>;

/** Both ETA clusters announce the light with the time as a single reading. */
export function ArrivalLightIndicator({ light }: { light: ArrivalLight }) {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {glyphs[light]}
      <Text style={styles.label} maxFontSizeMultiplier={2}>{light}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...dynamicType(typography.footnoteEmphasized, 2),
    color: colors.labelSecondary,
    flexShrink: 1,
  },
});
