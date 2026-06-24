import { type ReactNode } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { WifiSlash } from 'phosphor-react-native/src/icons/WifiSlash';

import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { radii } from '../theme/radii';
import { typography } from '../theme/typography';

/**
 * State cards — `EmptyState`, `LoadingState`, `ErrorState`. Three
 * separate components matching Figma `1133:13148` / `1133:13325` /
 * `1133:13326`. Same outer shape (rounded card, 32pt padding, centered
 * content), different fills, copy, and icon treatment.
 *
 *   - `EmptyState`   gray translucent bg + subtle border. Vertical
 *                    Default: icon over headline over description.
 *                    Horizontal Selected: icon left of text column,
 *                    burntgreen bg.
 *   - `LoadingState` no bg / no border (lets parent surface show
 *                    through). Native ActivityIndicator instead of
 *                    Figma's custom spinner SVG. Default copy
 *                    "Charting course..." per Figma.
 *   - `ErrorState`   no bg / no border. Phosphor `WifiSlash` icon as
 *                    a placeholder for the Figma tangled-lightbulb
 *                    illustration — swap to a real SVG when the
 *                    asset is exported. Default copy is the
 *                    network-trouble message per Figma.
 */

// -- EmptyState ------------------------------------------------------------

export function EmptyState({
  icon,
  headline,
  text,
  state = 'default',
  style,
}: {
  icon: ReactNode;
  headline: string;
  text: string;
  state?: 'default' | 'selected';
  style?: ViewStyle;
}) {
  const selected = state === 'selected';
  // Pure fade-in (no slide) — these cards live INSIDE flows where a
  // vertical translate would compete with the surrounding layout
  // (browse-sheet row, search-result list). 220ms ease-out softens
  // the "loading vanished → empty appeared" hand-off so it reads as
  // a state transition, not a hard cut. Reduce Motion → instant.
  const entrance = useEntranceAnimation(0);
  return (
    <Animated.View
      style={[
        styles.card,
        selected ? styles.cardSelected : styles.cardEmptyDefault,
        style,
        entrance.style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${headline}. ${text}`}
    >
      <View style={[styles.content, selected ? styles.contentHorizontal : styles.contentVertical]}>
        <View style={styles.iconWrap}>{icon}</View>
        <View style={selected ? styles.textColumn : styles.textVertical}>
          <Text style={[styles.headline, selected ? styles.textOnDark : styles.textFresh]}>
            {headline}
          </Text>
          <Text
            style={[
              styles.body,
              selected ? styles.bodyOnDark : styles.textFresh,
            ]}
          >
            {text}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

// -- LoadingState ----------------------------------------------------------

export function LoadingState({
  text = 'Charting course…',
  style,
}: {
  text?: string;
  style?: ViewStyle;
}) {
  // 220ms fade-in. The native ActivityIndicator is already animated
  // (it spins regardless of Reduce Motion — that's iOS-native); this
  // adds a soft entrance for the card frame so the wait feels gentle,
  // not abrupt. Skip slide — see EmptyState's note.
  const entrance = useEntranceAnimation(0);
  return (
    <Animated.View
      style={[styles.card, style, entrance.style]}
      accessibilityRole="progressbar"
      accessibilityLabel={text}
      accessibilityState={{ busy: true }}
    >
      <View style={[styles.content, styles.contentVertical]}>
        <View style={styles.iconWrap}>
          <ActivityIndicator size="large" color={colors.labelTertiary} />
        </View>
        <Text style={[styles.body, styles.bodyMuted]}>{text}</Text>
      </View>
    </Animated.View>
  );
}

// -- ErrorState ------------------------------------------------------------

export function ErrorState({
  icon,
  text = "We're having trouble connecting to the internet right now.",
  style,
}: {
  /** Defaults to Phosphor WifiSlash. Figma's tangled-lightbulb illustration belongs here once exported. */
  icon?: ReactNode;
  text?: string;
  style?: ViewStyle;
}) {
  // Same 220ms fade as Empty / Loading — the loading → error
  // hand-off should feel like a state shift, not a hard cut. The
  // alert role still announces immediately for VoiceOver users.
  const entrance = useEntranceAnimation(0);
  return (
    <Animated.View style={[styles.card, style, entrance.style]} accessibilityRole="alert" accessibilityLabel={text}>
      <View style={[styles.content, styles.contentVertical]}>
        <View style={styles.iconWrap}>
          {icon ?? <WifiSlash size={56} color={colors.labelTertiary} weight="duotone" />}
        </View>
        <Text style={[styles.body, styles.bodyMuted]}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 326,
    padding: 32,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  cardEmptyDefault: {
    backgroundColor: colors.fillsSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  cardSelected: {
    backgroundColor: colors.burntgreen,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  content: {
    gap: 16,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentVertical: {
    flexDirection: 'column',
  },
  contentHorizontal: {
    flexDirection: 'row',
  },
  iconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  textVertical: {
    width: '100%',
    alignItems: 'center',
  },
  headline: {
    ...dynamicType(typography.bodyEmphasized),
    textAlign: 'center',
  },
  body: {
    ...dynamicType(typography.bodyRegular),
    textAlign: 'center',
  },
  textFresh: {
    color: colors.freshgreen,
  },
  textOnDark: {
    color: colors.freshgreen,
    textAlign: 'left',
  },
  bodyOnDark: {
    color: colors.wiltedgreen,
    textAlign: 'left',
  },
  bodyMuted: {
    color: colors.labelTertiary,
  },
});
