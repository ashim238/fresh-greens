import { useEffect } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { X } from 'phosphor-react-native/src/icons/X';

import { useEntranceAnimation } from '../hooks/useEntranceAnimation';

import {
  glyphColorForZoneType,
  zoneCategoryContent,
} from './zoneCategoryContent';
import { DragHandle } from './DragHandle';
import { FloatingActionButton } from './FloatingActionButton';
import type { Zone } from '../lib/api/zones';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Zone-overlay detail bottom sheet — appears when the user taps a
 * polygon or polyline zone overlay on /home. Sibling of
 * ReportDetailCard (which handles community-report point taps); both
 * use the same scrim + sheet + drag handle chrome so "tap a thing on
 * the map" reads with one voice.
 *
 * Content per category is owned by `zoneCategoryContent` — this
 * component is purely the rendering surface. Categories without card
 * content (community-report, unknown) return null, so the card never
 * renders for surfaces that have their own detail flow.
 *
 * Spec: docs/archive/superpowers/specs/2026-06-01-zone-overlay-tap-info-design.md
 */
export function ZoneDetailCard({
  zone,
  onDismiss,
}: {
  zone: Zone;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const content = zoneCategoryContent(zone.category, zone.type);
  // Sibling chrome to ReportDetailCard / RouteHazardDetailCard:
  // tapping a zone polygon should morph this card up from the
  // bottom edge, not snap it in. Same 220ms ease-out family;
  // Reduce Motion skips the slide+fade.
  const entrance = useEntranceAnimation();

  // Announce the card's new content to VoiceOver users on open so the
  // sheet's appearance is unambiguous — without it, a non-sighted user
  // would see no state change beyond a focus shift.
  useEffect(() => {
    if (!content) return;
    AccessibilityInfo.announceForAccessibility(
      `${content.title}. ${content.dataSource}`,
    );
  }, [zone.id]);

  if (!content) return null;
  const { title, Glyph, dataSource, affectsRoutes, preferenceLink } = content;
  const glyphColor = glyphColorForZoneType(zone.type);

  function handleManagePress() {
    onDismiss();
    router.push('/zone-preferences');
  }

  return (
    <Pressable
      style={styles.scrim}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Dismiss zone detail"
    >
      <Animated.View
        style={[styles.sheet, entrance.style]}
        accessibilityViewIsModal
        // Stop taps inside the sheet from bubbling to the scrim's
        // dismiss handler. Without this, tapping anywhere on the
        // sheet's contents would close it. Mirrors ReportDetailCard.
        onStartShouldSetResponder={() => true}
      >
        <DragHandle />

        {/* Close X on the right. The drag handle above is the primary
            dismissal affordance (swipe-down); the close button gives
            an explicit tap path for non-gesture users. */}
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <FloatingActionButton
            size="48"
            onPress={onDismiss}
            accessibilityLabel="Close zone detail"
          >
            <X size={24} color={colors.labelSecondary} weight="regular" />
          </FloatingActionButton>
        </View>

        <View style={styles.bodyWrap}>
          <View style={styles.glyphWrap} accessibilityIgnoresInvertColors>
            <Glyph size={48} color={glyphColor} weight="duotone" />
          </View>

          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>

          <Text style={styles.paragraph}>{dataSource}</Text>
          <Text style={styles.paragraph}>{affectsRoutes}</Text>

          {preferenceLink && (
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
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Full-screen scrim — taps outside the sheet dismiss. No bg dim
  // (mirrors ReportDetailCard — the map underneath stays visible).
  scrim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
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
  // Reserves left-side width equal to the right-side FAB so the close
  // button sits at the right edge without throwing the layout off-axis.
  // Mirrors ReportDetailCard's symmetric header without needing a
  // second FAB; the drag handle above carries the centered weight.
  headerSpacer: {
    flex: 1,
  },
  bodyWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  // 48pt glyph centered, mirroring ReportDetailCard's category-glyph
  // weight (the category IS the most-important affordance to recognize).
  glyphWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
    textAlign: 'center',
  },
  // bodyRegular per the 2026-06-01 text-size audit — body content
  // deserves the iOS-norm 17pt register, with relaxedLineHeight for
  // multi-line reading. Left-aligned: title sits centered, but the
  // body's job is reading, where left-aligned is the standard.
  paragraph: {
    ...dynamicType(relaxedLineHeight(typography.bodyRegular)),
    color: colors.labelSecondary,
    alignSelf: 'stretch',
  },
  // Canonical in-flow link register — freshgreen + underline.
  // Only renders for toggleable categories (lighting, police).
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
