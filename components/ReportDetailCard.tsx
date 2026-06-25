import { Animated, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { useEntranceAnimation } from '../hooks/useEntranceAnimation';

// Phosphor deep-imports — see app/trusted-contact-setup.tsx for the
// note on why we bypass the package's barrel index.
import { Export } from 'phosphor-react-native/src/icons/Export';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { X } from 'phosphor-react-native/src/icons/X';

import BgBlackOwned from '../assets/illustrations/mapmarker-bg-blackowned.svg';
import BgPositive from '../assets/illustrations/mapmarker-bg-positive.svg';
import BgReport from '../assets/illustrations/mapmarker-bg-report.svg';
import GlyphBlackOwned from '../assets/illustrations/mapmarker-glyph-black-owned.svg';
import GlyphFeltUnsafe from '../assets/illustrations/mapmarker-glyph-felt-unsafe.svg';
import GlyphFeltWelcome from '../assets/illustrations/mapmarker-glyph-felt-welcome.svg';
import GlyphHazard from '../assets/illustrations/mapmarker-glyph-hazard.svg';
import GlyphIncident from '../assets/illustrations/mapmarker-glyph-incident.svg';
import GlyphLighting from '../assets/illustrations/mapmarker-glyph-lighting.svg';
import {
  CATEGORIES,
  type ReportCategoryId,
} from '../lib/api/community-reports';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

import { pressedDim } from '../theme/interaction';

import { DragHandle } from './DragHandle';
import { FloatingActionButton } from './FloatingActionButton';
import { type Variant, variantForCategoryId } from './LandmarkMarker';

/**
 * Community-report detail bottom sheet — appears when the user taps a
 * report pin on /home. Adapts the v2 Bottom Sheet (Marker) chrome from
 * Figma `1133:13853`:
 *
 *   - slides up from the bottom edge (vs. v1's centered card)
 *   - drag handle + symmetric FAB header row (Share / center copy / Close)
 *   - rounded top corners + M3 Elevation 3 drop shadow
 *
 * Differences from the Figma template, which depicts a generic location
 * marker (address title + "Drive there" CTAs):
 *   - The category icon stays as a central visual element above the
 *     title. Community reports' core information is what kind of report
 *     it is — losing the icon to match the icon-less Figma title row
 *     would strip the most-important affordance.
 *   - The "8 min / Move" CTA pair is omitted. Community reports are
 *     informational, not navigable destinations — neither CTA maps to
 *     a real action for a report-tap intent.
 *   - Share FAB opens the system share sheet with a plain-text summary.
 */

const BG_FOR_VARIANT: Record<Variant, typeof BgReport> = {
  'black-owned': BgBlackOwned,
  positive: BgPositive,
  report: BgReport,
};

function GlyphForCategory({ categoryId }: { categoryId: ReportCategoryId }) {
  switch (categoryId) {
    case 'black-owned':
      return <GlyphBlackOwned width={32} height={32} />;
    case 'felt-welcome':
      return <GlyphFeltWelcome width={32} height={32} />;
    case 'felt-unsafe':
      return <GlyphFeltUnsafe width={32} height={32} />;
    case 'incident':
      return <GlyphIncident width={32} height={32} />;
    case 'lighting':
      return <GlyphLighting width={32} height={32} />;
    case 'hazard':
      return <GlyphHazard width={32} height={32} />;
    default:
      return null;
  }
}

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWk = Math.floor(diffDay / 7);
  return `${diffWk}w ago`;
}

export function ReportDetailCard({
  categoryId,
  detail,
  subTag,
  placeName,
  photoUri,
  timestamp,
  routeContextLine,
  onDismiss,
  onRemove,
}: {
  categoryId: ReportCategoryId;
  detail?: string;
  subTag?: string;
  /**
   * Auto-resolved business name from the report's coords (set at
   * submit time via the proxy's /api/nearby lookup). When present,
   * renders as the card's primary title; the category becomes the
   * subline. Falls back to category.label when not set.
   */
  placeName?: string;
  /**
   * Local file URI for the photo the user attached at submit time.
   * Renders inline above the detail copy when present. Undefined
   * for the vast majority of reports — most categories don't even
   * expose the photo affordance, and even on `hasPhoto` categories
   * it's optional.
   */
  photoUri?: string;
  timestamp: number;
  /** One calm line when this report sits on the selected route preview. */
  routeContextLine?: string;
  onDismiss: () => void;
  /** When provided, shows a "Remove" button — only pass for author-owned reports. */
  onRemove?: () => void;
}) {
  // Detail-card morph-in: tapping a community-report pin on /home (or
  // a report on the /en-route hazard layer) now slides this card up
  // from the bottom edge with a 220ms ease-out fade, instead of
  // snapping it on instantly. Pairs with the calm-companion voice —
  // the card *arrives* (it answers a tap) rather than barging in.
  // Reduce Motion users see the resolved state immediately.
  const entrance = useEntranceAnimation();
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return null;

  const variant = variantForCategoryId(categoryId);
  const BgSvg = BG_FOR_VARIANT[variant];

  // Title is the resolved place name when we have it; otherwise the
  // category label (the v1 behavior). Subline carries whatever
  // didn't fit in the title — category when placeName is the title,
  // sub-tag otherwise, plus relative time.
  const title = placeName ?? category.label;
  const subline = placeName
    ? `${category.label}${subTag && subTag !== 'Other' ? ` · ${subTag}` : ''} · ${relativeTime(timestamp)}`
    : subTag && subTag !== 'Other'
      ? `${subTag} · ${relativeTime(timestamp)}`
      : relativeTime(timestamp);

  async function handleShare() {
    const lines = [
      `Fresh Greens community report`,
      title,
      subline,
      detail?.trim(),
    ].filter((line): line is string => Boolean(line && line.length > 0));
    try {
      await Share.share({ message: lines.join('\n') });
    } catch (err) {
      console.warn('ReportDetailCard share failed', err);
    }
  }

  const hasBody = Boolean(routeContextLine || detail || photoUri);

  return (
    <Pressable
      style={styles.scrim}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Dismiss report detail"
    >
      <Animated.View
        style={[styles.sheet, entrance.style]}
        accessibilityViewIsModal
        onStartShouldSetResponder={() => true}
      >
        <DragHandle />

        <View style={styles.headerRow}>
          <FloatingActionButton
            size="48"
            onPress={() => {
              void handleShare();
            }}
            accessibilityLabel="Share this report"
            accessibilityHint="Opens the system share sheet"
          >
            <Export size={24} color={colors.labelSecondary} weight="regular" />
          </FloatingActionButton>
          <View style={styles.headerSpacer} />
          <FloatingActionButton
            size="48"
            onPress={onDismiss}
            accessibilityLabel="Close report detail"
          >
            <X size={24} color={colors.labelSecondary} weight="regular" />
          </FloatingActionButton>
        </View>

        <View style={styles.identityBlock}>
          <View style={styles.iconWrap} accessibilityIgnoresInvertColors>
            <BgSvg width={48} height={48} />
            <View style={styles.iconGlyph}>
              <GlyphForCategory categoryId={categoryId} />
            </View>
          </View>
          <Text
            style={styles.categoryLabel}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text style={styles.subline} numberOfLines={1}>
            {subline}
          </Text>
        </View>

        {hasBody && (
          <View style={styles.bodyWrap}>
            {routeContextLine ? (
              <Text style={styles.routeContext}>{routeContextLine}</Text>
            ) : null}
            {detail ? (
              <Text style={styles.detail}>{detail}</Text>
            ) : null}
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.photo}
                accessibilityIgnoresInvertColors
                accessibilityRole="image"
                accessibilityLabel="Photo attached to this report"
              />
            ) : null}
          </View>
        )}

        {onRemove && (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel="Remove this report"
            style={({ pressed }) => [
              styles.removeRow,
              pressed && pressedDim,
            ]}
          >
            <Trash size={24} color={colors.red} weight="bold" />
            <Text style={styles.removeText}>Remove my report</Text>
          </Pressable>
        )}

      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Full-screen scrim — taps outside the sheet dismiss. No bg dim
  // (the v2 marker sheet is meant to coexist with the map underneath,
  // not modally block it). pointerEvents stay default so the scrim
  // catches outside taps; the sheet stops propagation via its
  // responder.
  scrim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingTop: spacing.md,
    // 32pt bottom padding per .cursorrules static-content-modal rule
    // (16pt = tab/grid modals, 32pt = static content). The card has
    // no grid or tab layout, so it's static content.
    paddingBottom: spacing.xl,
    gap: spacing.md,
    // shadows.sheet bundles the directional upward offset (-4y) used
    // by every bottom-anchored card in the app.
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
  identityBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
    textAlign: 'center',
  } as const,
  subline: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.mutedSecondary,
    textAlign: 'center',
  } as const,
  bodyWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  routeContext: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.wiltedgreen,
  } as const,
  detail: {
    ...dynamicType(relaxedLineHeight(typography.bodyRegular)),
    color: colors.labelSecondary,
  } as const,
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radii.md,
    backgroundColor: colors.fadedgreen,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  } as const,
  removeText: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.red,
  } as const,
});
