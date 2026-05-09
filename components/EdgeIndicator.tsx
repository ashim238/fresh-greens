import { type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import PinBlackOwned from '../assets/illustrations/mapmarker-pin-blackowned.svg';
import PinLocalBusiness from '../assets/illustrations/mapmarker-pin-localbusiness.svg';
import PinPositive from '../assets/illustrations/mapmarker-pin-positive.svg';
import PinReport from '../assets/illustrations/mapmarker-pin-report.svg';
import { usePulseOpacity } from '../hooks/usePulseOpacity';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

import { type Variant } from './LandmarkMarker';

const PIN_SVGS: Record<Variant, typeof PinReport> = {
  'black-owned': PinBlackOwned,
  positive: PinPositive,
  'local-business': PinLocalBusiness,
  report: PinReport,
};

export function EdgeIndicator({
  x,
  y,
  rotation,
  variant,
  count,
  surfaceColor = colors.white,
  borderColor = colors.cardBorderSubtle,
  arrowColor = colors.labelSecondary,
  children,
  onPress,
  accessibilityLabel,
}: {
  x: number;
  y: number;
  rotation: number;
  variant?: Variant;
  count?: number;
  surfaceColor?: string;
  borderColor?: string;
  arrowColor?: string;
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const pulse = usePulseOpacity(0.55);
  const PinSvg = variant ? PIN_SVGS[variant] : null;
  const showBadge = count != null && count > 1;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.wrap,
        { left: x - 16, top: y - 16, transform: [{ rotate: `${rotation}deg` }] },
        pressed && pressedDim,
      ]}
    >
      {PinSvg ? (
        <Animated.View style={[styles.pinWrap, { opacity: pulse }]}>
          <PinSvg width={24} height={32} />
          {showBadge && (
            <View
              style={[
                styles.badge,
                { transform: [{ rotate: `${-rotation}deg` }] },
              ]}
            >
              <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
            </View>
          )}
        </Animated.View>
      ) : (
        <>
          <View
            style={[
              styles.pill,
              { backgroundColor: surfaceColor, borderColor },
            ]}
          >
            <View style={{ transform: [{ rotate: `${-rotation}deg` }] }}>
              {children}
            </View>
          </View>
          <View style={[styles.tip, { borderLeftColor: arrowColor }]} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.burntgreen,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    ...typography.caption2Regular,
    color: colors.burntgreen,
    fontWeight: '700',
    lineHeight: 14,
  },
  pill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  tip: {
    position: 'absolute',
    right: -6,
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});
