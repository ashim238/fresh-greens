import { Coffee } from 'phosphor-react-native/src/icons/Coffee';
import { ForkKnife } from 'phosphor-react-native/src/icons/ForkKnife';
import { House } from 'phosphor-react-native/src/icons/House';
import { Scissors } from 'phosphor-react-native/src/icons/Scissors';
import { ShoppingBag } from 'phosphor-react-native/src/icons/ShoppingBag';
import { Tree } from 'phosphor-react-native/src/icons/Tree';
import { Wrench } from 'phosphor-react-native/src/icons/Wrench';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import TrustedFriendMarker from '../assets/illustrations/trusted-friend.svg';
import BgBlackOwned from '../assets/illustrations/mapmarker-bg-blackowned.svg';
import BgPositive from '../assets/illustrations/mapmarker-bg-positive.svg';
import BgReport from '../assets/illustrations/mapmarker-bg-report.svg';
import GlyphBlackOwned from '../assets/illustrations/mapmarker-glyph-black-owned.svg';
import GlyphFeltUnsafe from '../assets/illustrations/mapmarker-glyph-felt-unsafe.svg';
import GlyphFeltWelcome from '../assets/illustrations/mapmarker-glyph-felt-welcome.svg';
import GlyphHazard from '../assets/illustrations/mapmarker-glyph-hazard.svg';
import GlyphIncident from '../assets/illustrations/mapmarker-glyph-incident.svg';
import GlyphLighting from '../assets/illustrations/mapmarker-glyph-lighting.svg';
import GlyphHome from '../assets/illustrations/mapmarker-glyph-home.svg';
import GlyphTrustedFriend from '../assets/illustrations/mapmarker-glyph-trusted-friend.svg';
import PinBlackOwned from '../assets/illustrations/mapmarker-pin-blackowned.svg';
import PinPositive from '../assets/illustrations/mapmarker-pin-positive.svg';
import PinReport from '../assets/illustrations/mapmarker-pin-report.svg';
import { colors } from '../theme/colors';

/**
 * Map landmark marker — based on Figma `1044:2667` (Draft tab).
 * Renders a 48×48 teardrop pin with an inner Bg circle (24×24) and
 * a 16×16 illustrated glyph centered on the Bg.
 *
 * Variants (pin color carries sentiment):
 *   - 'black-owned' — black pin (place identity)
 *   - 'positive'    — brand-green pin (welcoming sentiment)
 *   - 'report'      — orange pin (caution / observation)
 *
 * The Figma component also defines a 4th "Local Business" gray
 * variant; it was removed from code in `chore/design-token-discipline-pass`
 * after `variantForCategoryId` stopped routing anything to it (home
 * moved to `positive` for visual consistency with the otherwise
 * vibrant black/green/orange system). Re-introduce by restoring the
 * union member + asset imports if a non-community-report data source
 * needs the neutral register.
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

export type Variant = 'black-owned' | 'positive' | 'report';

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
    case 'trusted-friend':
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
function GlyphForCategory({
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
    case 'trusted-friend':
      // Unreachable in practice — the special-case render in
      // `LandmarkMarker` below uses the full `trusted-friend.svg`
      // (brand-baked tail + heart) and bypasses this dispatch. Kept
      // as a defensive fallback in case the special case is removed
      // later.
      return <GlyphTrustedFriend width={size} height={size} />;
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
      // Defensive fallback for a categoryId we haven't seen — keeps the
      // marker visible if a new id is added to community-reports.ts but
      // forgotten here. Hazard reads as a sensible "generic report".
      return <GlyphHazard width={size} height={size} />;
  }
}

export function LandmarkMarker({
  latitude,
  longitude,
  categoryId,
  subTag,
  accessibilityLabel,
  onPress,
  selected = false,
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
  /**
   * On-tap visual state per Figma `1133:13418` — when true, scales
   * the marker up ~1.33× to indicate "this pin is the subject of the
   * open detail card." Caller is responsible for clearing it on
   * card dismiss. Approximates the Figma's 72→96pt on-tap variant.
   */
  selected?: boolean;
}) {
  const variant = variantForCategoryId(categoryId);

  // Track-until-first-paint. Also re-snapshots when `selected` flips
  // so MapKit captures the new scaled bitmap rather than rendering a
  // stale snapshot of the previous state. SVG-content markers mounted
  // with `tracksViewChanges={false}` from t=0 race the react-native-svg
  // subtree's paint and MapKit can snapshot empty bitmaps.
  //
  // Settle delay is 50ms (≈3 frames), not setTimeout(0). setTimeout(0)
  // fires in the next macrotask, *before* native paint — for the
  // selected→unselected transition specifically, the scale=1.33 →
  // scale=1.0 transform hadn't committed yet when MapKit snapshotted,
  // so the marker stayed visually "stuck" at the previous scale even
  // after deselect. 50ms covers layout + paint + style commit on
  // both iOS and Android without a perceptible flicker. On rapid
  // taps across markers, each effect's cleanup clears the pending
  // timeout, so `tracking` stays true while taps continue and only
  // settles 50ms after the last tap — all snapshots end up correct.
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const id = setTimeout(() => setTracking(false), 50);
    return () => clearTimeout(id);
  }, [selected]);

  // Trusted Friend has its own Figma-faithful SVG (1133:13245) — green
  // tail-shape marker with the heart glyph baked in. Bypass the
  // composed pin+bg+glyph layout for this one variant; the other map
  // markers continue to compose from the shared three-layer system.
  // Anchor at bottom-left because the tail's tip sits there in the
  // 62×51 frame (per Figma's M4 24.1304 origin path).
  //
  // Note: when this marker leaves the viewport, the EdgeIndicator
  // overlay swaps the heart for a white Phosphor Car glyph (set up
  // by /home passing categoryId='trusted-friend' to EdgeIndicator).
  // The on-map heart stays; the off-screen marker uses the car to
  // disambiguate "trusted friend" from "felt-welcome" report.
  if (categoryId === 'trusted-friend') {
    return (
      <Marker
        coordinate={{ latitude, longitude }}
        anchor={{ x: 4 / 62, y: 45.26 / 51 }}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        tracksViewChanges={tracking}
      >
        <View style={styles.trustedFriendFrame} accessibilityIgnoresInvertColors>
          <TrustedFriendMarker width={62} height={51} />
        </View>
      </Marker>
    );
  }

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 1 }}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      tracksViewChanges={tracking}
    >
      <View
        style={[styles.frame, selected && styles.frameSelected]}
        accessibilityIgnoresInvertColors
      >
        {variant === 'black-owned' && <PinBlackOwned width={45} height={58.5} style={styles.pin} />}
        {variant === 'positive' && <PinPositive width={45} height={58.5} style={styles.pin} />}
        {variant === 'report' && <PinReport width={45} height={58.5} style={styles.pin} />}

        <View style={styles.bgWrap}>
          {variant === 'black-owned' && <BgBlackOwned width={36} height={36} />}
          {variant === 'positive' && <BgPositive width={36} height={36} />}
          {variant === 'report' && <BgReport width={36} height={36} />}

          <View style={styles.glyphWrap}>
            <GlyphForCategory categoryId={categoryId} subTag={subTag} variant={variant} size={24} />
          </View>
        </View>
      </View>
    </Marker>
  );
}

// Layout per Figma 1133:13418. Outer box 72×72; pin (45×58.5) sits
// at inset 9.38%/18.75% (≈ 6.75pt vertical, 13.5pt horizontal);
// inner Bg circle (36×36) centered horizontally with top:12; glyph
// (24×24) centered on the Bg. Scaled 1.5× from the prior 48pt
// design to match Figma's actual marker dimensions.
const styles = StyleSheet.create({
  frame: {
    width: 72,
    height: 72,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  // On-tap state per Figma `1133:13418` — 72→96pt, a 1.33× scale.
  // transformOrigin: 'bottom' anchors the scale at the bottom-center
  // of the frame, which is also where the Marker's anchor lives.
  // Without that, scale grows from the View's geometric center,
  // dragging the visual bottom down by half the growth amount —
  // and when MapKit re-snapshots on deselect, the marker visually
  // "jumps" back up by that drift. Scaling from the bottom keeps
  // the pin's tip pinned at the coord through both transitions.
  frameSelected: {
    transformOrigin: 'bottom',
    transform: [{ scale: 1.33 }],
  },
  pin: {
    position: 'absolute',
    top: 6.75,
    left: 13.5,
  },
  bgWrap: {
    position: 'absolute',
    top: 12,
    left: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphWrap: {
    position: 'absolute',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustedFriendFrame: {
    width: 62,
    height: 51,
  },
});
