import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { typography } from '../theme/typography';

import { type Variant, variantForCategoryId } from './LandmarkMarker';

const BG_FOR_VARIANT: Record<Variant, typeof BgReport> = {
  'black-owned': BgBlackOwned,
  positive: BgPositive,
  report: BgReport,
};

function GlyphForCategory({ categoryId }: { categoryId: ReportCategoryId }) {
  switch (categoryId) {
    case 'black-owned':
      return <GlyphBlackOwned width={16} height={16} />;
    case 'felt-welcome':
      return <GlyphFeltWelcome width={16} height={16} />;
    case 'felt-unsafe':
      return <GlyphFeltUnsafe width={16} height={16} />;
    case 'incident':
      return <GlyphIncident width={16} height={16} />;
    case 'lighting':
      return <GlyphLighting width={16} height={16} />;
    case 'hazard':
      return <GlyphHazard width={16} height={16} />;
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
  timestamp,
  onDismiss,
}: {
  categoryId: ReportCategoryId;
  detail?: string;
  subTag?: string;
  timestamp: number;
  onDismiss: () => void;
}) {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return null;

  const variant = variantForCategoryId(categoryId);
  const BgSvg = BG_FOR_VARIANT[variant];

  return (
    <Pressable
      style={styles.scrim}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Dismiss report detail"
    >
      <View
        style={styles.card}
        accessibilityViewIsModal
        onStartShouldSetResponder={() => true}
      >
        {/* Header: icon + category label */}
        <View style={styles.header}>
          <View style={styles.iconWrap} accessibilityIgnoresInvertColors>
            <BgSvg width={28} height={28} />
            <View style={styles.iconGlyph}>
              <GlyphForCategory categoryId={categoryId} />
            </View>
          </View>
          <Text
            style={styles.categoryLabel}
            accessibilityRole="header"
          >
            {category.label}
          </Text>
        </View>

        {/* Detail text (optional) */}
        {detail ? (
          <Text style={styles.detail} numberOfLines={3}>
            {detail}
          </Text>
        ) : null}

        {/* Footer: subTag + timestamp */}
        <View style={styles.footer}>
          {subTag && subTag !== 'Other' ? (
            <Text style={styles.footerText}>{subTag}  ·  </Text>
          ) : null}
          <Text style={styles.footerText}>{relativeTime(timestamp)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    position: 'absolute',
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
    flexShrink: 1,
  } as const,
  detail: {
    ...typography.bodyRegular,
    color: colors.mutedSecondary,
    marginTop: 8,
  } as const,
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    ...typography.caption1Regular,
    color: colors.mutedSecondary,
  } as const,
});
