import { House } from 'phosphor-react-native/src/icons/House';
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
import GlyphLateNight from '../assets/illustrations/mapmarker-glyph-late-night.svg';
import GlyphLgbtq from '../assets/illustrations/mapmarker-glyph-lgbtq.svg';
import GlyphLighting from '../assets/illustrations/mapmarker-glyph-lighting.svg';
import GlyphRestroom from '../assets/illustrations/mapmarker-glyph-restroom.svg';
import GlyphTrustedFriend from '../assets/illustrations/mapmarker-glyph-trusted-friend.svg';
import GlyphWomenOwned from '../assets/illustrations/mapmarker-glyph-womenowned.svg';
import PinBlackOwned from '../assets/illustrations/mapmarker-pin-blackowned.svg';
import PinPositive from '../assets/illustrations/mapmarker-pin-positive.svg';
import PinReport from '../assets/illustrations/mapmarker-pin-report.svg';
import { MarkerGlyph } from './MarkerGlyph';
import { colors } from '../theme/colors';
import { markerCircleBgFor, MARKER_GLYPH_STROKE_WOMEN_OWNED } from '../theme/marker-glyph';
import { shadows } from '../theme/shadows';

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
 * The illustrated glyph for a given category — same SVG the
 * /report picker tile renders, scaled down to 16pt for the marker.
 *
 * Dispatch rule (kept narrow on purpose):
 *   - SubTag bespoke SVGs are reserved for the four identity tags
 *     that ALSO have matching chips in the recommendation sheet:
 *     Women-owned, LGBTQ+ welcoming, Open restroom, Late-night
 *     welcome. Marker glyph ↔ browse-sheet chip alignment is the
 *     load-bearing reason this dispatch exists — so a pin a user
 *     dropped surfaces under the same icon they'll later tap in
 *     the Around Me sheet to find it. (HomeBrowseSheet renders
 *     the same SVGs in its recommendation cards.)
 *   - Every other subTag — place-type (Restaurant, Bar/Cafe,
 *     Retail, Park/Public space, Residential), `'Other'`, or unset
 *     — falls through to the category-level glyph (the bespoke
 *     felt-welcome heart for felt-welcome reports, etc.). Earlier
 *     rev dispatched place-type subTags to Phosphor icons (Coffee,
 *     ForkKnife, etc.) for visual differentiation between same-
 *     variant pins, but those icons had no companion in the
 *     recommendation sheet — picker, marker, and browse drifted —
 *     so the per-type dispatch was removed in favor of category-
 *     level consistency. Don't reintroduce place-type dispatches
 *     unless the browse sheet grows matching chips.
 *
 * The saved-places `'home'` category renders the Phosphor House
 * duotone (not a bespoke SVG) — the iOS-universal house affordance
 * reads instantly without paying for a dedicated illustration.
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
  // Identity-tag bespoke SVGs (multi-color illustrative, per Figma
  // 1255:1060) — same icons HomeBrowseSheet uses in the
  // recommendation-card placeholder, so chip / picker / marker
  // glyphs all line up visually for the four browse-sheet
  // identity chips. Place-type subTags (Restaurant, etc.) don't
  // appear here — they fall through to the category glyph.
  // Stroked paths use `currentColor`; MarkerGlyph paints a fixed black
  // outline for readability on wiltedgreen and other fills.
  switch (subTag) {
    case 'Women-owned':
      return (
        <MarkerGlyph
          Glyph={GlyphWomenOwned}
          width={size}
          stroke={MARKER_GLYPH_STROKE_WOMEN_OWNED}
        />
      );
    case 'LGBTQ+ welcoming':
      return <MarkerGlyph Glyph={GlyphLgbtq} width={size} />;
    case 'Open restroom':
      return <MarkerGlyph Glyph={GlyphRestroom} width={size} />;
    case 'Late-night welcome':
      return <MarkerGlyph Glyph={GlyphLateNight} width={size} />;
  }

  switch (categoryId) {
    case 'home': {
      // Phosphor duotone House — universal iOS "home" affordance.
      // Brand green on black-owned; fixed black stroke elsewhere.
      const color =
        variant === 'black-owned' ? colors.freshgreen : colors.black;
      return <House size={size} color={color} weight="duotone" />;
    }
    case 'trusted-friend':
      // Unreachable in practice — the special-case render in
      // `LandmarkMarker` below uses the full `trusted-friend.svg`
      // (brand-baked tail + heart) and bypasses this dispatch. Kept
      // as a defensive fallback in case the special case is removed
      // later.
      return <GlyphTrustedFriend width={size} height={size} />;
    case 'black-owned':
      return <MarkerGlyph Glyph={GlyphBlackOwned} width={size} />;
    case 'felt-welcome':
      return <MarkerGlyph Glyph={GlyphFeltWelcome} width={size} />;
    case 'felt-unsafe':
      return <MarkerGlyph Glyph={GlyphFeltUnsafe} width={size} />;
    case 'incident':
      return <MarkerGlyph Glyph={GlyphIncident} width={size} />;
    case 'lighting':
      return <MarkerGlyph Glyph={GlyphLighting} width={size} />;
    case 'hazard':
      return <MarkerGlyph Glyph={GlyphHazard} width={size} />;
    default:
      // Defensive fallback for a categoryId we haven't seen — keeps the
      // marker visible if a new id is added to community-reports.ts but
      // forgotten here. Hazard reads as a sensible "generic report".
      return <MarkerGlyph Glyph={GlyphHazard} width={size} />;
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
  const circleBg = markerCircleBgFor(variant, categoryId, 'landmark');

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
        zIndex={550}
        accessibilityRole="button"
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
      zIndex={550}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      tracksViewChanges={tracking}
    >
      <View
        style={[styles.frame, !selected && styles.frameUnselected]}
        accessibilityIgnoresInvertColors
      >
        {variant === 'black-owned' && <PinBlackOwned width={60} height={78} style={styles.pin} />}
        {variant === 'positive' && <PinPositive width={60} height={78} style={styles.pin} />}
        {variant === 'report' && <PinReport width={60} height={78} style={styles.pin} />}

        <View style={styles.bgWrap}>
          {variant === 'black-owned' && <BgBlackOwned width={48} height={48} />}
          {variant === 'positive' && <BgPositive width={48} height={48} />}
          {variant === 'report' && <BgReport width={48} height={48} />}

          <View style={styles.glyphWrap}>
            <GlyphForCategory
              categoryId={categoryId}
              subTag={subTag}
              variant={variant}
              size={32}
            />
          </View>
        </View>
      </View>
    </Marker>
  );
}

// Layout per Figma 1133:13418. The frame is **always 96×96** (the
// selected size) — content renders at native 96-scale by default
// and unselected state scales the whole frame down to 0.65× (visual
// ~62; pin ~39×51) from the bottom edge.
//
// Why 0.65 and not the Figma-spec 0.75: the destination/finish pin
// renders its 60×78 teardrop at ~45×58.5, and at 0.75 these report
// pins matched it exactly — no hierarchy. 0.65 makes the report pins
// a notch smaller so the finish pin reads as the more important
// marker (user-flagged 2026-06-03). Selection still pops to native
// 96-scale, so a tapped pin is emphasized above everything as before.
//
// Why the frame doesn't grow on selection: React Native's
// `transform: scale(...)` scales the rendered pixels but does NOT
// grow the View's `bounds`. react-native-maps caches the marker as
// a bitmap sized from `self.bounds`; when MapKit re-snapshots on
// the tracking flip, the bitmap size changes between selected
// (live 96×96 render) and unselected (72×72 cached) — and that
// bitmap-size mismatch is what makes the pin appear to "jump" by
// ~24pt on tap/deselect. transformOrigin (PR #139) and the 50ms
// settle (PR #147) couldn't fix that because the cause is
// geometric, not temporal.
//
// Fix: keep bounds at 96×96 for both states; downscale unselected
// content via transform. Bounds never change → no bitmap mismatch
// → no jump. Pin/bg/glyph dimensions are 1.33× the prior 72-frame
// values (60×78 pin, 48×48 bg, 32×32 glyph) so the on-screen
// visual at native 96-scale matches Figma's selected variant
// exactly. transformOrigin: 'bottom' keeps the pin's tip pinned
// at the coord through the scale, as before.
const styles = StyleSheet.create({
  frame: {
    width: 96,
    height: 96,
    // e3 is the canonical tier for "markers and pins" per shadows.ts.
    // Previously inlined with elevation: 3 (vs e3's 4) — Android-only
    // delta of 1, drift not divergence.
    ...shadows.e3,
  },
  frameUnselected: {
    transformOrigin: 'bottom',
    transform: [{ scale: 0.65 }],
  },
  pin: {
    position: 'absolute',
    top: 9,
    left: 18,
  },
  bgWrap: {
    position: 'absolute',
    top: 16,
    left: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphWrap: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustedFriendFrame: {
    width: 62,
    height: 51,
  },
});
