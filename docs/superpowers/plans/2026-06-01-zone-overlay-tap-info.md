# Zone Overlay Tap-Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user tap a polygon or polyline zone overlay on `/home` and see a bottom-sheet card explaining what the overlay represents, where the data came from, and how it affects Fresh Greens' route scoring.

**Architecture:** Two new files (a per-category content adapter and a `ZoneDetailCard` bottom-sheet component) plus a small state addition to `/home` that wires `onPress` on every `Polygon`/`Polyline` to surface the card. The card mirrors `ReportDetailCard`'s register so "tap a thing on the map" speaks with one voice. Community-report **point** zones keep their existing `ReportDetailCard` flow — out of scope here.

**Tech Stack:** React Native + Expo + TypeScript, `expo-router` for navigation, `react-native-maps` `Polygon`/`Polyline` `onPress` handlers, Phosphor deep-imported icons, theme tokens from `theme/{colors,spacing,typography,shadows,radii}`.

**Spec:** [docs/superpowers/specs/2026-06-01-zone-overlay-tap-info-design.md](../specs/2026-06-01-zone-overlay-tap-info-design.md)

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `components/zoneCategoryContent.ts` | create | Per-category content adapter — maps a `ZoneCategory` to its title, glyph component, copy strings, and toggleable flag. Pure data + types, no JSX. |
| `components/ZoneDetailCard.tsx` | create | The bottom-sheet component. Renders chrome (scrim + sheet + drag handle + close X), glyph, title, two body paragraphs, optional "Manage in Zone Preferences →" link. Mirrors `ReportDetailCard`'s structural pattern. |
| `app/home.tsx` | modify | Add `selectedZone` state, wire `onPress` on Polygon + Polyline render calls, render `ZoneDetailCard` conditionally, integrate mutual-exclusion with the existing `selectedReport` flow, extend `handleMapPress` to clear `selectedZone` on map taps. |

---

## Task 1: Per-category content adapter

Pure data file. No JSX, no rendering — just a `ZoneCategory → ZoneContent` function plus a `ZoneType → color` helper. Keeps content decisions out of the rendering component so the matrix is readable in one place.

**Files:**
- Create: `components/zoneCategoryContent.ts`

- [ ] **Step 1: Create the file with the type + adapter**

```tsx
// components/zoneCategoryContent.ts
//
// Per-category content adapter for ZoneDetailCard. Pure data: each
// recognized ZoneCategory maps to a title, a Phosphor glyph component,
// two copy strings (data source + how-it-affects-routes), and a flag
// for whether the card should show a "Manage in Zone Preferences →"
// footer link.
//
// Honesty-of-disclosure: only categories with a user-controllable
// toggle in usePreferences (lighting, police) set preferenceLink: true.
// The other categories (park, landuse, wildlife, road-condition) are
// always-on contributors to route scoring; their cards explain *why*
// they factor in without implying they can be toggled. Spec:
// docs/superpowers/specs/2026-06-01-zone-overlay-tap-info-design.md.

import type { ComponentType } from 'react';
import type { IconProps } from 'phosphor-react-native/src/lib';

import { Buildings } from 'phosphor-react-native/src/icons/Buildings';
import { Lightbulb } from 'phosphor-react-native/src/icons/Lightbulb';
import { PawPrint } from 'phosphor-react-native/src/icons/PawPrint';
import { Shield } from 'phosphor-react-native/src/icons/Shield';
import { Tree } from 'phosphor-react-native/src/icons/Tree';
import { Warning } from 'phosphor-react-native/src/icons/Warning';

import type { ZoneCategory, ZoneType } from '../lib/api/zones';
import { colors } from '../theme/colors';

export type ZoneContent = {
  title: string;
  Glyph: ComponentType<IconProps>;
  dataSource: string;
  affectsRoutes: string;
  /** Whether to render the "Manage in Zone Preferences →" footer link. */
  preferenceLink: boolean;
};

/**
 * Returns the card content for a given category, or null when the
 * category has no card (community-report — handled by ReportDetailCard
 * — or an unknown category from a future fixture).
 */
export function zoneCategoryContent(
  category: ZoneCategory | undefined,
): ZoneContent | null {
  switch (category) {
    case 'lighting':
      return {
        title: 'Low lighting',
        Glyph: Lightbulb,
        dataSource:
          'Streets here are tagged as below-average lighting in OpenStreetMap data.',
        affectsRoutes:
          'Fresh Greens routes around low-lit areas when Low-light areas is on in Zone Preferences.',
        preferenceLink: true,
      };
    case 'police':
      return {
        title: 'Police presence',
        Glyph: Shield,
        dataSource:
          'A police station, speed camera, or other police facility is mapped here in OpenStreetMap.',
        affectsRoutes:
          'Fresh Greens routes around police presence when Police presence is on in Zone Preferences.',
        preferenceLink: true,
      };
    case 'park':
      return {
        title: 'Park or green space',
        Glyph: Tree,
        dataSource: 'Mapped as a park in OpenStreetMap data.',
        affectsRoutes:
          'Fresh Greens factors green spaces into safety scoring — they generally read as safer during daylight.',
        preferenceLink: false,
      };
    case 'landuse':
      return {
        title: 'Commercial / residential area',
        Glyph: Buildings,
        dataSource: 'OpenStreetMap land-use tag.',
        affectsRoutes:
          'Fresh Greens factors land-use type into routing — commercial corridors typically have more pedestrians.',
        preferenceLink: false,
      };
    case 'wildlife':
      return {
        title: 'Wildlife crossing zone',
        Glyph: PawPrint,
        dataSource: 'Mapped as a wildlife corridor in OpenStreetMap data.',
        affectsRoutes:
          'Fresh Greens routes around wildlife zones during dawn and dusk when collision risk is highest.',
        preferenceLink: false,
      };
    case 'road-condition':
      return {
        title: 'Road condition zone',
        Glyph: Warning,
        dataSource:
          'Tagged in OpenStreetMap as having degraded surface condition.',
        affectsRoutes: 'Fresh Greens factors road condition into route scoring.',
        preferenceLink: false,
      };
    case 'community-report':
    default:
      return null;
  }
}

/**
 * Glyph color follows the zone's type signal — safe / caution / avoid
 * map onto the reserved-color rule (freshgreen / yellow / red).
 * Consistent across all categories; the type carries the severity
 * register, the category carries the role.
 */
export function glyphColorForZoneType(type: ZoneType): string {
  switch (type) {
    case 'safe':
      return colors.freshgreen;
    case 'caution':
      return colors.yellow;
    case 'avoid':
      return colors.red;
  }
}
```

- [ ] **Step 2: Verify the file typechecks**

Run: `npx tsc --noEmit 2>&1 | grep zoneCategoryContent`

Expected: empty output (no errors specific to this file). Pre-existing errors elsewhere (avatar.png, @vercel/node) are fine.

- [ ] **Step 3: Commit**

```bash
git add components/zoneCategoryContent.ts
git commit -m "feat(zone-card): per-category content adapter

Pure-data module mapping ZoneCategory → display content for the
upcoming ZoneDetailCard. Each entry has a title, a Phosphor glyph
component, a data-source sentence, an affects-routes sentence, and a
boolean for whether the card should show a 'Manage in Zone
Preferences →' footer (only toggleable categories: lighting,
police).

community-report and unknown categories return null — ReportDetailCard
handles report taps; unknown is a defensive future-fixture fallback.

glyphColorForZoneType maps the zone's ZoneType to the reserved-color
severity register (safe → freshgreen, caution → yellow, avoid → red).
Single source of truth for zone visual severity.

Spec: docs/superpowers/specs/2026-06-01-zone-overlay-tap-info-design.md"
```

---

## Task 2: ZoneDetailCard component

The bottom-sheet card. Mirrors `ReportDetailCard`'s structural pattern (scrim Pressable + sheet View with drag handle + tap-outside-to-dismiss). Smaller than `ReportDetailCard` because zones don't carry photos or user-written details.

**Files:**
- Create: `components/ZoneDetailCard.tsx`

- [ ] **Step 1: Create the component file**

```tsx
// components/ZoneDetailCard.tsx
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { X } from 'phosphor-react-native/src/icons/X';

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
 * Spec: docs/superpowers/specs/2026-06-01-zone-overlay-tap-info-design.md
 */
export function ZoneDetailCard({
  zone,
  onDismiss,
}: {
  zone: Zone;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const content = zoneCategoryContent(zone.category);

  // Announce the card's new content to VoiceOver users on open so the
  // sheet's appearance is unambiguous — without it, a non-sighted user
  // would see no state change beyond a focus shift.
  useEffect(() => {
    if (!content) return;
    AccessibilityInfo.announceForAccessibility(
      `${content.title}. ${content.dataSource}`,
    );
  }, [content]);

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
      <View
        style={styles.sheet}
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
      </View>
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "ZoneDetailCard|zoneCategoryContent" | head`

Expected: empty (no new errors).

- [ ] **Step 3: Commit**

```bash
git add components/ZoneDetailCard.tsx
git commit -m "feat(zone-card): ZoneDetailCard bottom-sheet component

Sibling to ReportDetailCard for zone-overlay taps. Same scrim + sheet
+ drag handle chrome so 'tap a thing on the map' reads with one voice.

Renders the per-category content from zoneCategoryContent:
  - 48pt Phosphor duotone glyph tinted by zone.type (severity register)
  - title2Emphasized title (centered)
  - two bodyRegular paragraphs (data source + how-it-affects-routes)
  - optional 'Manage in Zone Preferences →' link footer (toggleable
    categories only — honesty-of-disclosure)

VoiceOver: announceForAccessibility on mount speaks title + data
source so the sheet's appearance is unambiguous for non-sighted users.

Spec: docs/superpowers/specs/2026-06-01-zone-overlay-tap-info-design.md"
```

---

## Task 3: `/home` state + tap wiring + render

Add the `selectedZone` state, wire `onPress` on the existing `Polygon`/`Polyline` render at `app/home.tsx:1089-1108`, extend `handleMapPress` to clear `selectedZone`, render `ZoneDetailCard` at the bottom-overlay layer, and add mutual exclusion with `selectedReport`.

**Files:**
- Modify: `app/home.tsx` (imports + state + render-loop onPress + map-press handler + bottom-layer render)

- [ ] **Step 1: Add the ZoneDetailCard import**

Open `app/home.tsx`. Locate the existing import group around `ReportDetailCard` (search for `import { ReportDetailCard }`). Add immediately below it:

```tsx
import { ZoneDetailCard } from '../components/ZoneDetailCard';
```

Locate the `import type` for `Zone` near the existing zones-adapter imports (search for `from '../lib/api/zones'`). The `Zone` type should already be imported there; if it isn't, add it to that import.

- [ ] **Step 2: Add the selectedZone state**

Search `app/home.tsx` for `const [selectedReport, setSelectedReport]` — this is the existing pattern this state mirrors. Immediately below that line, add:

```tsx
// Tapped zone-overlay state — mirrors selectedReport. The two are
// mutually exclusive (opening one clears the other); both clear on
// map tap. Spec:
// docs/superpowers/specs/2026-06-01-zone-overlay-tap-info-design.md
const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
```

- [ ] **Step 3: Wire onPress + tappable on Polyline + Polygon**

Locate the existing render loop at `app/home.tsx:1081-1113` (search for `enabledOsmZones.map((zone)`). Replace its body with:

```tsx
        {showZones &&
          zonesVisibleAtZoom &&
          enabledOsmZones.map((zone) => {
            // Polyline zones (real OSM lit-street data) render as colored
            // street overlays — stroke only, no fill. Polygon zones (mock
            // fallback OR landuse from OSM) render as filled areas.
            // Tap on either → opens ZoneDetailCard; clears any open
            // selectedReport for mutual exclusion. tappable required
            // on Polyline (Polygon is tappable by default in
            // react-native-maps).
            const handleZonePress = () => {
              setSelectedReport(null);
              setSelectedZone(zone);
            };
            if (zone.geometry === 'polyline') {
              return (
                <Polyline
                  key={zone.id}
                  coordinates={zone.coordinates}
                  strokeColor={zoneColors[zone.type].stroke}
                  strokeWidth={4}
                  lineDashPattern={zoneDashPattern[zone.type]}
                  tappable
                  onPress={handleZonePress}
                />
              );
            }
            if (zone.geometry === 'polygon') {
              return (
                <Polygon
                  key={zone.id}
                  coordinates={zone.coordinates}
                  fillColor={zoneColors[zone.type].fill}
                  strokeColor={zoneColors[zone.type].stroke}
                  strokeWidth={2}
                  lineDashPattern={zoneDashPattern[zone.type]}
                  tappable
                  onPress={handleZonePress}
                />
              );
            }
            // OSM adapter never returns 'point' geometry — community
            // reports do, and they're rendered separately below.
            return null;
          })}
```

- [ ] **Step 4: Extend handleMapPress to clear selectedZone**

Search `app/home.tsx` for `function handleMapPress` (the `MapView`'s `onPress` handler — taps on empty map area). Inside that function, add `setSelectedZone(null);` next to wherever `setSelectedReport(null)` is called. Example diff (the exact surrounding code may have other lines; preserve them):

```tsx
function handleMapPress() {
  // ... existing logic ...
  setSelectedReport(null);
  setSelectedZone(null);
  // ... existing logic ...
}
```

If `handleMapPress` doesn't currently clear `selectedReport`, add both lines. If it has other unrelated logic (placement mode, etc.), don't disturb that — add the clears alongside whatever else fires on a map-empty tap.

- [ ] **Step 5: Render ZoneDetailCard at the bottom-overlay layer**

Search `app/home.tsx` for the existing `<ReportDetailCard ... />` render (around `app/home.tsx:2140`). Immediately below the closing tag of that render, add:

```tsx
{selectedZone && (
  <ZoneDetailCard
    zone={selectedZone}
    onDismiss={() => setSelectedZone(null)}
  />
)}
```

The mutual-exclusion guarantee from Step 3 (and the dismiss-on-map-press from Step 4) means only one of `ReportDetailCard` / `ZoneDetailCard` is mounted at a time — they cannot stack.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"`

Expected: empty (no NEW errors). Pre-existing `avatar.png` and `@vercel/node` errors are fine — they're untouched module-resolution baselines.

- [ ] **Step 7: Commit**

```bash
git add app/home.tsx
git commit -m "feat(home): tap zone overlays to open ZoneDetailCard

Adds selectedZone state on /home (mirrors selectedReport), wires
onPress on every Polygon + Polyline zone overlay to open the new
ZoneDetailCard bottom sheet. Mutual exclusion with selectedReport
(opening one clears the other; map tap clears both). The community-
report point tap flow stays unchanged — ReportDetailCard handles those.

Polyline overlays need an explicit \`tappable\` prop in
react-native-maps for onPress to fire; Polygon overlays are
tappable by default.

Spec: docs/superpowers/specs/2026-06-01-zone-overlay-tap-info-design.md"
```

---

## Task 4: Verification

End-to-end check on a real device or simulator. No code change, just verification + a final commit gating the feature as ship-ready.

**Files:** none modified.

- [ ] **Step 1: Run the typecheck baseline once more**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"; echo "tsc done"`

Expected: empty output, then `tsc done`. If anything new appears, fix it before continuing.

- [ ] **Step 2: Run the dev server**

Run: `npx expo start --ios` (or your usual launch command)

Wait for the simulator (or device) to attach to `/home` with zones enabled in `Zone Preferences`.

- [ ] **Step 3: Verify each category renders a card**

For each of the six categories listed in the spec (`lighting`, `police`, `park`, `landuse`, `wildlife`, `road-condition`), tap a corresponding zone overlay on `/home` and confirm:

1. The bottom sheet slides up from the bottom edge.
2. The glyph color matches the zone's type (caution → yellow, avoid → red, safe → freshgreen).
3. The title, data-source line, and affects-routes line all read coherently.
4. For `lighting` and `police` only: the "Manage in Zone Preferences →" link is visible at the bottom. Tap it → modal dismisses, `/zone-preferences` opens.
5. For `park`, `landuse`, `wildlife`, `road-condition`: NO Manage link is visible (always-on categories don't link).

If a category fixture isn't reachable in your dev seed, note which and confirm the others work — the missing one is a fixture issue, not a code issue.

- [ ] **Step 4: Verify mutual exclusion**

1. Tap a community-report pin → `ReportDetailCard` opens.
2. Without dismissing, tap a zone overlay → `ZoneDetailCard` should replace `ReportDetailCard`.
3. Without dismissing, tap another community-report pin → `ZoneDetailCard` closes, `ReportDetailCard` reopens.
4. Tap an empty area of the map → both close.

- [ ] **Step 5: Verify dismissal paths**

With `ZoneDetailCard` open:
1. Tap the close X → dismisses.
2. Re-open. Tap outside the sheet (on the scrim or map) → dismisses.
3. Re-open. Use the system back gesture (swipe from left edge) → either dismisses or behaves as the map's normal back gesture (depending on screen stack state). Either is acceptable; the explicit close paths above are the supported dismissal flows.

- [ ] **Step 6: VoiceOver check (optional but recommended)**

Enable VoiceOver. Open `ZoneDetailCard`. Confirm that on open, VoiceOver speaks the title and data-source line as one continuous announcement.

- [ ] **Step 7: Commit the feature as complete**

If everything verified, run:

```bash
git log --oneline -3
```

Confirm the three feature commits from Tasks 1-3 are at the top of `main` (or your feature branch). No final commit required — the feature shipped across Tasks 1-3.

If verification surfaced visual regressions or behavior issues, fix them as new commits before considering the plan complete.

---

## Self-review (writing-plans skill)

**Spec coverage check** — each section of the spec maps to a task:

- Spec § Goal / User flow — Tasks 1-3 collectively deliver the flow.
- Spec § Architecture / Component → Task 2.
- Spec § Architecture / `/home` state additions → Task 3 Step 2.
- Spec § Architecture / Tap wiring → Task 3 Step 3.
- Spec § Architecture / Dismissal → Task 3 Step 4 + Task 2's scrim handler.
- Spec § Architecture / Routing to Zone Preferences → Task 2 `handleManagePress`.
- Spec § Per-category content matrix → Task 1.
- Spec § Layout + visual register → Task 2 styles + glyph color helper in Task 1.
- Spec § Accessibility → Task 2 `useEffect` announcement + role props.
- Spec § Honesty-of-disclosure → encoded in Task 1's `preferenceLink: false` for always-on categories.
- Spec § Deferred follow-ups → no task; correctly out of scope.

**Placeholder scan** — no `TBD`, `TODO`, `implement later`, vague "handle edge cases" instructions. Every code step has the actual code; every command step has the actual command + expected output.

**Type consistency** — `ZoneContent`, `zoneCategoryContent`, `glyphColorForZoneType`, `Zone`, `ZoneCategory`, `ZoneType` referenced consistently across tasks. The component prop signature `{ zone, onDismiss }` matches between Task 2's definition and Task 3 Step 5's call site.

No gaps found. Plan complete.
