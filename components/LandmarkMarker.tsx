import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import BgBlackOwned from '../assets/illustrations/mapmarker-bg-blackowned.svg';
import BgLocalBusiness from '../assets/illustrations/mapmarker-bg-localbusiness.svg';
import BgReport from '../assets/illustrations/mapmarker-bg-report.svg';
import GlyphBlackOwned from '../assets/illustrations/mapmarker-glyph-blackowned.svg';
import GlyphFeltUnsafe from '../assets/illustrations/mapmarker-glyph-felt-unsafe.svg';
import GlyphLocalBusiness from '../assets/illustrations/mapmarker-glyph-localbusiness.svg';
import PinBlackOwned from '../assets/illustrations/mapmarker-pin-blackowned.svg';
import PinLocalBusiness from '../assets/illustrations/mapmarker-pin-localbusiness.svg';
import PinReport from '../assets/illustrations/mapmarker-pin-report.svg';
import { colors } from '../theme/colors';

/**
 * Map landmark marker — the three-state component from Figma
 * `1044:2667` (Draft tab). Renders a 48×48 teardrop pin with an
 * inner Bg circle (24×24) and a 16×16 glyph centered on the Bg.
 *
 * Variants:
 *   - 'black-owned'    — black pin + brand-green storefront glyph
 *   - 'local-business' — gray pin + white menu glyph
 *   - 'report'         — orange pin + per-category Ionicons glyph
 *                        (felt-unsafe uses the Figma eye SVG; the
 *                        other report categories use the same
 *                        Ionicons names the report-modal picker
 *                        already shows, so the marker glyph and the
 *                        modal tile match for the same submission)
 *
 * Anchored at bottom-center so the pin's tip sits on the coordinate
 * (matches native iOS pin behavior). `tracksViewChanges={false}`
 * stops react-native-maps from re-rendering on every pan/zoom.
 */

export type ReportCategoryGlyph =
  | 'incident'
  | 'felt-unsafe'
  | 'lighting'
  | 'hazard';

type Variant = 'black-owned' | 'local-business' | 'report';

/**
 * Maps a community-report category id to the marker variant +
 * glyph the design system uses for that submission. Unknown
 * categories fall through to the generic Report state with a
 * megaphone glyph.
 */
export function variantForCategoryId(categoryId: string | undefined): {
  variant: Variant;
  reportGlyph?: ReportCategoryGlyph;
} {
  switch (categoryId) {
    case 'black-owned':
      return { variant: 'black-owned' };
    case 'felt-welcome':
      return { variant: 'local-business' };
    case 'felt-unsafe':
    case 'incident':
    case 'lighting':
    case 'hazard':
      return { variant: 'report', reportGlyph: categoryId };
    default:
      return { variant: 'report' };
  }
}

// Ionicons names per report category — match the picker tiles in
// /report so the same submission reads the same way on the map and
// in the modal. Felt-unsafe is the only category whose glyph is a
// Figma SVG (intentional, since the eye icon doesn't have a clean
// Ionicons equivalent that matches the brand register).
const REPORT_IONICONS: Record<
  Exclude<ReportCategoryGlyph, 'felt-unsafe'>,
  React.ComponentProps<typeof Ionicons>['name']
> = {
  incident: 'flag',
  lighting: 'bulb',
  hazard: 'warning',
};

export function LandmarkMarker({
  latitude,
  longitude,
  categoryId,
  accessibilityLabel,
  onPress,
}: {
  latitude: number;
  longitude: number;
  /** Community-report category id (or undefined for a generic report pin). */
  categoryId?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  const { variant, reportGlyph } = variantForCategoryId(categoryId);

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 1 }}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      tracksViewChanges={false}
    >
      <View style={styles.frame}>
        {variant === 'black-owned' && <PinBlackOwned width={30} height={39} style={styles.pin} />}
        {variant === 'local-business' && <PinLocalBusiness width={30} height={39} style={styles.pin} />}
        {variant === 'report' && <PinReport width={30} height={39} style={styles.pin} />}

        <View style={styles.bgWrap}>
          {variant === 'black-owned' && <BgBlackOwned width={24} height={24} />}
          {variant === 'local-business' && <BgLocalBusiness width={24} height={24} />}
          {variant === 'report' && <BgReport width={24} height={24} />}

          <View style={styles.glyphWrap}>
            {variant === 'black-owned' && (
              <GlyphBlackOwned width={16} height={16} />
            )}
            {variant === 'local-business' && (
              <GlyphLocalBusiness width={16} height={16} />
            )}
            {variant === 'report' && reportGlyph === 'felt-unsafe' && (
              <GlyphFeltUnsafe width={16} height={16} />
            )}
            {variant === 'report' && reportGlyph && reportGlyph !== 'felt-unsafe' && (
              <Ionicons
                name={REPORT_IONICONS[reportGlyph]}
                size={14}
                color={colors.white}
              />
            )}
            {variant === 'report' && !reportGlyph && (
              <Ionicons name="megaphone" size={14} color={colors.white} />
            )}
          </View>
        </View>
      </View>
    </Marker>
  );
}

// Layout per Figma 1044:2667. Outer box 48×48; pin (30×39) sits at
// inset 9.38%/18.75% (≈ 4.5pt vertical, 9pt horizontal); inner Bg
// circle (24×24) is centered horizontally with top:8 and bottom:16
// per Figma's `bottom-[33.33%] left-1/4 right-1/4 top-[16.67%]`.
// Glyph (16×16) is centered on the Bg.
const styles = StyleSheet.create({
  frame: {
    width: 48,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  pin: {
    position: 'absolute',
    top: 4.5,
    left: 9,
  },
  bgWrap: {
    position: 'absolute',
    top: 8,
    left: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphWrap: {
    position: 'absolute',
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
