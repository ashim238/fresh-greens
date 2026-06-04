import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { X } from 'phosphor-react-native/src/icons/X';

import type { HazardCategory } from '../lib/scoring';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

import { DragHandle } from './DragHandle';
import { FloatingActionButton } from './FloatingActionButton';
import {
  formatRouteHazardLength,
  routeHazardDetailContent,
} from './routeHazardDetailContent';

/**
 * Lightweight detail sheet for yellow hazard teardrops on /home route
 * preview only. Sibling chrome to ReportDetailCard / ZoneDetailCard.
 */
export function RouteHazardDetailCard({
  category,
  lengthMiles,
  hazardIndex,
  hazardCount,
  onPrevious,
  onNext,
  onDismiss,
}: {
  category: HazardCategory;
  lengthMiles: number;
  hazardIndex: number;
  hazardCount: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const content = routeHazardDetailContent(category);
  const showPager = hazardCount > 1;

  useEffect(() => {
    const position =
      showPager ? ` Hazard ${hazardIndex + 1} of ${hazardCount}.` : '';
    AccessibilityInfo.announceForAccessibility(
      `${content.title}.${position} ${formatRouteHazardLength(lengthMiles)}`,
    );
  }, [
    category,
    content.title,
    hazardCount,
    hazardIndex,
    lengthMiles,
    showPager,
  ]);

  function handleManagePress() {
    onDismiss();
    router.push('/zone-preferences');
  }

  return (
    <Pressable
      style={styles.scrim}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Dismiss hazard detail"
    >
      <View
        style={styles.sheet}
        accessibilityViewIsModal
        onStartShouldSetResponder={() => true}
      >
        <DragHandle />

        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <FloatingActionButton
            size="48"
            onPress={onDismiss}
            accessibilityLabel="Close hazard detail"
          >
            <X size={24} color={colors.labelSecondary} weight="regular" />
          </FloatingActionButton>
        </View>

        <View style={styles.bodyWrap}>
          <Text style={styles.title} accessibilityRole="header">
            {content.title}
          </Text>
          <Text style={styles.lengthLine}>{formatRouteHazardLength(lengthMiles)}</Text>
          <Text style={styles.paragraph}>{content.dataSource}</Text>
          <Text style={styles.paragraph}>{content.affectsRoutes}</Text>

          {content.preferenceLink && (
            <Pressable
              onPress={handleManagePress}
              accessibilityRole="link"
              accessibilityLabel="Manage in Zone Preferences"
              hitSlop={8}
              style={({ pressed }) => [styles.linkBtn, pressed && pressedDim]}
            >
              <Text style={styles.linkText}>Manage in Zone Preferences →</Text>
            </Pressable>
          )}
        </View>

        {showPager && (
          <View
            style={styles.pagerRow}
            accessibilityRole="toolbar"
            accessibilityLabel={`Navigate hazards on route, ${hazardIndex + 1} of ${hazardCount}`}
          >
            <Pressable
              onPress={onPrevious}
              disabled={!onPrevious}
              style={({ pressed }) => [
                tapTarget44,
                styles.pagerBtn,
                pressed && onPrevious ? pressedDim : null,
                !onPrevious && styles.pagerBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Previous hazard on route"
              accessibilityState={{ disabled: !onPrevious }}
            >
              <CaretLeft
                size={24}
                color={onPrevious ? colors.black : colors.labelTertiary}
                weight="regular"
              />
            </Pressable>
            <Text
              style={styles.pagerLabel}
              accessibilityRole="text"
              accessibilityLabel={`Hazard ${hazardIndex + 1} of ${hazardCount}`}
            >
              {hazardIndex + 1} of {hazardCount}
            </Text>
            <Pressable
              onPress={onNext}
              disabled={!onNext}
              style={({ pressed }) => [
                tapTarget44,
                styles.pagerBtn,
                pressed && onNext ? pressedDim : null,
                !onNext && styles.pagerBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next hazard on route"
              accessibilityState={{ disabled: !onNext }}
            >
              <CaretRight
                size={24}
                color={onNext ? colors.black : colors.labelTertiary}
                weight="regular"
              />
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    ...shadows.sheet,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  headerSpacer: {
    flex: 1,
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separatorSubtle,
    paddingTop: spacing.md,
  },
  pagerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerBtnDisabled: {
    opacity: 0.35,
  },
  pagerLabel: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.labelSecondary,
    minWidth: 72,
    textAlign: 'center',
  },
  bodyWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  title: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
    textAlign: 'center',
  },
  lengthLine: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.wiltedgreen,
    textAlign: 'center',
  },
  paragraph: {
    ...dynamicType(relaxedLineHeight(typography.bodyRegular)),
    color: colors.labelSecondary,
    alignSelf: 'stretch',
  },
  linkBtn: {
    paddingVertical: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  linkText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.freshgreen,
    textDecorationLine: 'underline',
  },
});
