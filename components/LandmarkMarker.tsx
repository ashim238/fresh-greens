import { Coffee } from 'phosphor-react-native/src/icons/Coffee';
import { ForkKnife } from 'phosphor-react-native/src/icons/ForkKnife';
import { House } from 'phosphor-react-native/src/icons/House';
import { Scissors } from 'phosphor-react-native/src/icons/Scissors';
import { ShoppingBag } from 'phosphor-react-native/src/icons/ShoppingBag';
import { Tree } from 'phosphor-react-native/src/icons/Tree';
import { Wrench } from 'phosphor-react-native/src/icons/Wrench';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import BgBlackOwned from '../assets/illustrations/mapmarker-bg-blackowned.svg';
import BgLocalBusiness from '../assets/illustrations/mapmarker-bg-localbusiness.svg';
import BgPositive from '../assets/illustrations/mapmarker-bg-positive.svg';
import BgReport from '../assets/illustrations/mapmarker-bg-report.svg';
import GlyphBlackOwned from '../assets/illustrations/mapmarker-glyph-black-owned.svg';
import GlyphFeltUnsafe from '../assets/illustrations/mapmarker-glyph-felt-unsafe.svg';
import GlyphFeltWelcome from '../assets/illustrations/mapmarker-glyph-felt-welcome.svg';
import GlyphHazard from '../assets/illustrations/mapmarker-glyph-hazard.svg';
import GlyphIncident from '../assets/illustrations/mapmarker-glyph-incident.svg';
import GlyphLighting from '../assets/illustrations/mapmarker-glyph-lighting.svg';
import GlyphHome from '../assets/illustrations/mapmarker-glyph-home.svg';
import GlyphLocalBusiness from '../assets/illustrations/mapmarker-glyph-localbusiness.svg';
import PinBlackOwned from '../assets/illustrations/mapmarker-pin-blackowned.svg';
import PinLocalBusiness from '../assets/illustrations/mapmarker-pin-localbusiness.svg';
import PinPositive from '../assets/illustrations/mapmarker-pin-positive.svg';
import PinReport from '../assets/illustrations/mapmarker-pin-report.svg';
import { colors } from '../theme/colors';

/**
 * Map landmark marker — the four-state component from Figma
 * `1044:2667` (Draft tab). Renders a 48×48 teardrop pin with an
 * inner Bg circle (24×24) and a 16×16 illustrated glyph centered
 * on the Bg.
 *
 * Variants (pin color carries sentiment):
 *   - 'black-owned'    — black pin (place identity)
 *   - 'positive'       — brand-green pin (welcoming sentiment)
 *   - 'local-business' — gray pin (neutral business; reserved for
 *                        future non-community-report data sources)
 *   - 'report'         — orange pin (caution / observation)
 *
 * Inner glyph is per-category and matches the /report picker tile
 * for the same submission, so the picker tile and the resulting
 * marker glyph read identically.
 *
 * The Figma component spells the green variant "Postive" (sic) —
 * we use the corrected `positive` in code and reference Figma's
 * label here so future readers can find the link.
 *
 * Anchored at bottom-center so the pin's tip sits on the
 * coordinate. `tracksViewChanges={false}` stops react-native-maps
 * from re-rendering on every pan/zoom.
 */

export type Variant = 'black-owned' | 'local-business' | 'positive' | 'report';

/**
 * Maps a community-report category id to the marker variant.
 * Unknown categories fall through to the generic Report state.
 */
export function variantForCategoryId(categoryId: string | undefined): Variant {
  switch (categoryId) {
    case 'black-owned':
      return 'black-owned';
    case 'felt-welcome':
      return 'positive';
    case 'home':
      return 'positive';
    case 'felt-unsafe':
    case 'incident':
    case 'lighting':
    case 'hazard':
      return 'report';
    default:
      return 'report';
  }
}

/**
 * Phosphor (duotone) icon component per place sub-tag — only the
 * place categories (`black-owned`, `felt-welcome`) define sub-tags
 * in `community-reports.ts`'s CATEGORIES table, so this map only
 * needs to cover what those whitelists allow. `'Other'` and any
 * unrecognized value return null so the caller can fall back to
 * the category-level SVG glyph.
 */
function phosphorForSubTag(subTag: string | undefined) {
  switch (subTag) {
    case 'Restaurant':
      return ForkKnife;
    case 'Bar/Cafe':
      return Coffee;
    case 'Retail':
      return ShoppingBag;
    case 'Salon/Barber':
      return Scissors;
    case 'Services':
      return Wrench;
    case 'Park/Public space':
      return Tree;
    case 'Personal':
      return House;
    default:
      return null;
  }
}

/**
 * The illustrated glyph for a given category — same SVG the
 * /report picker tile renders, scaled down to 16pt for the marker.
 *
 * When a `subTag` is set on a place-category report (e.g. a
 * felt-welcome restaurant), the marker swaps in a per-type
 * Phosphor duotone icon so a barber and a cafe read distinctly
 * even when both fall under the same sentiment variant. The
 * Phosphor color matches the variant's high-contrast foreground:
 * brand green inside the black-owned pin's black bg, white inside
 * the positive pin's wiltedgreen bg.
 *
 * `'Other'` and unset sub-tags fall through to the original
 * category SVG glyph — the same illustration the picker tile
 * renders — so the marker stays legible without a typed icon.
 */
export function GlyphForCategory({
  categoryId,
  subTag,
  variant,
  size = 16,
}: {
  categoryId?: string;
  subTag?: string;
  variant: Variant;
  size?: number;
}) {
  const PhosphorIcon = phosphorForSubTag(subTag);
  if (PhosphorIcon) {
    const color = variant === 'black-owned' ? colors.freshgreen : colors.white;
    return <PhosphorIcon size={size} color={color} weight="duotone" />;
  }

  switch (categoryId) {
    case 'home':
      return <GlyphHome width={size} height={size} />;
    case 'black-owned':
      return <GlyphBlackOwned width={size} height={size} />;
    case 'felt-welcome':
      return <GlyphFeltWelcome width={size} height={size} />;
    case 'felt-unsafe':
      return <GlyphFeltUnsafe width={size} height={size} />;
    case 'incident':
      return <GlyphIncident width={size} height={size} />;
    case 'lighting':
      return <GlyphLighting width={size} height={size} />;
    case 'hazard':
      return <GlyphHazard width={size} height={size} />;
    default:
      return <GlyphLocalBusiness width={size} height={size} />;
  }
}

export function LandmarkMarker({
  latitude,
  longitude,
  categoryId,
  subTag,
  accessibilityLabel,
  onPress,
}: {
  latitude: number;
  longitude: number;
  /** Community-report category id (or undefined for a generic report pin). */
  categoryId?: string;
  /**
   * Place-type sub-tag (e.g. 'Restaurant', 'Salon/Barber'). When set
   * on a place-category report, swaps the inner glyph for a per-type
   * Phosphor duotone icon so similar pins read distinctly. `'Other'`
   * or undefined keeps the category-level SVG glyph.
   */
  subTag?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  const variant = variantForCategoryId(categoryId);

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 1 }}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      tracksViewChanges={false}
    >
      <View style={styles.frame} accessibilityIgnoresInvertColors>
        {variant === 'black-owned' && <PinBlackOwned width={30} height={39} style={styles.pin} />}
        {variant === 'positive' && <PinPositive width={30} height={39} style={styles.pin} />}
        {variant === 'local-business' && <PinLocalBusiness width={30} height={39} style={styles.pin} />}
        {variant === 'report' && <PinReport width={30} height={39} style={styles.pin} />}

        <View style={styles.bgWrap}>
          {variant === 'black-owned' && <BgBlackOwned width={24} height={24} />}
          {variant === 'positive' && <BgPositive width={24} height={24} />}
          {variant === 'local-business' && <BgLocalBusiness width={24} height={24} />}
          {variant === 'report' && <BgReport width={24} height={24} />}

          <View style={styles.glyphWrap}>
            <GlyphForCategory categoryId={categoryId} subTag={subTag} variant={variant} />
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
