import { StyleSheet, Text, View } from 'react-native';
import { WifiSlash } from 'phosphor-react-native/src/icons/WifiSlash';
import type { RouteSource } from '../lib/api/routes';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { MetaSeparator } from './MetaSeparator';

function cacheAgeLabel(ms: number | null) {
  if (ms == null || ms < 60_000) return null;
  const minutes = Math.floor(ms / 60_000);
  return minutes < 60 ? `${minutes}m old` : `${Math.floor(minutes / 60)}h old`;
}

export function RouteSourceStatus({ source, cacheAgeMs }: {
  source: RouteSource;
  cacheAgeMs: number | null;
}) {
  if (source !== 'cache' && source !== 'mock') return null;

  const saved = source === 'cache';
  const age = saved ? cacheAgeLabel(cacheAgeMs) : null;
  const label = saved ? 'Using saved route' : 'Demo route';
  const description = saved
    ? `${label}${age ? `, ${age}` : ''}. Live rerouting unavailable.`
    : 'Demo route. Network and saved route both unavailable. Approximate path shown.';

  return (
    <View style={styles.pill} accessible accessibilityRole="text" accessibilityLabel={description}>
      <WifiSlash size={14} color={colors.white} weight="regular" />
      <View style={styles.labels}>
        <Text style={styles.text} maxFontSizeMultiplier={1.5}>{label}</Text>
        {age && (
          <>
            <MetaSeparator style={styles.text} maxFontSizeMultiplier={1.5} />
            <Text style={styles.text} maxFontSizeMultiplier={1.5}>{age}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.whiteFill20,
  },
  labels: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  text: {
    ...typography.footnoteEmphasized,
    color: colors.white,
  },
});
