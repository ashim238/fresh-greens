# Fresh Greens — Design System Reference

Retroactive documentation of the design tokens, components, and conventions already shipped in the codebase. Intended for designers cross-referencing the Figma file (`7DDh6c7tk7OKF4WiA7pEkp`) against what's actually built.

This is a reference, not a spec. The Figma file leads; the codebase follows. Where the two diverge, **Drift** callouts flag the gap.

For runtime rules, see [`.cursorrules`](../.cursorrules). For the per-PR rhythm, see [`docs/workflow.md`](workflow.md). For architecture, see [`docs/architecture.md`](architecture.md).

---

## Section 1 — Foundation tokens

All design values live in `theme/`. No hex, font size, or spacing value is inlined in a screen (see anti-slop check 2 in `.cursorrules`).

### 1.1 Color (`theme/colors.ts`)

Brand greens are usable freely; reserved colors carry semantic meaning and must not be used for in-flow CTAs or links. The reserved-color rule is enumerated in `.cursorrules` ("Reserved-color rule") with eight documented exceptions.

#### Brand greens

| Token | Hex | Intended use |
|---|---|---|
| `freshgreen` | `#41AD49` | Primary CTA, in-flow links |
| `wiltedgreen` | `#326936` | Secondary CTAs, atmospheric headers, primary-fill button border |
| `burntgreen` | `#003F04` | Deep accents (e.g. turn-card "Then" footer) |
| `fadedgreen` | `#A0D6A4` | Supporting fills, all-clear chip text |

#### Reserved (UI signals only)

| Token | Hex | Semantic role |
|---|---|---|
| `orange` | `#FF9500` | Hazard / speed limit / construction / report flow identity |
| `red` | `#FF3B30` | Alert / inline form-validation errors / recording indicator |
| `yellow` | `#FFCC00` | Caution |
| `pink` | `#FF2D55` | Role TBD — ask before use |
| `navy` | `#041E49` | Safety affordances (en-route shield button) |

#### Daylight gradient (functional, not signaling)

Drives both the route polyline (`lib/daylight.ts`) and the /home bottom-sheet daylight strip — legend and polyline agree by shared name, not just shared values.

| Token | Hex | Anchor |
|---|---|---|
| `daylightDawn` | `#FFB347` | Dawn / dusk warm hour |
| `daylightDusk` | `#C4785A` | Twilight transition |
| `daylightNight` | `#2D1B69` | Night |

#### Neutrals + iOS system

| Token | Value | Notes |
|---|---|---|
| `white` | `#FFFFFF` | |
| `black` | `#000000` | |
| `systemBlue` | `#007AFF` | iOS MKUserLocation tint — user-location pulse + dot |
| `labelSecondary` | `#3C3C43` | Secondary text, icon tints, placeholder copy |
| `labelTertiary` | `#3D3D3D` | Tertiary text |
| `mutedSecondary` | `rgba(60, 60, 67, 0.6)` | Muted secondary text |
| `mutedTertiary` | `rgba(80, 80, 80, 0.7)` | Muted tertiary text |
| `systemGroupedBackground` | `#F2F2F7` | iOS grouped table background |
| `signOutSubtitle` | `#F5F5F5` | Sign-out parting copy — quietly secondary off-white |

#### iOS fills ramp

Mirrors iOS Fills system. Used for inactive controls, tag/chip backgrounds, embedded search bar.

| Token | Value | Canonical use |
|---|---|---|
| `fillsPrimary` | `rgba(120, 120, 128, 0.2)` | Densest tag pill (rating / category chips in browse sheet) |
| `fillsSecondary` | `rgba(120, 120, 128, 0.16)` | Slightly-lighter chip background |
| `fillsTertiary` | `rgba(120, 120, 128, 0.12)` | Search bar gray on flat surface |
| `fillsQuaternary` | `rgba(120, 120, 128, 0.08)` | Weather card backdrop |

#### Edge marker palette

Darker, more saturated than brand orange/green — designed to read against busy map content at 36pt edge-marker size. Used only by `components/EdgeIndicator.tsx`.

| Token | Hex | Use |
|---|---|---|
| `slightlyDarkOrange` | `#D34400` | Off-screen orange marker (report category) |
| `slightlyWiltedGreen` | `#1F8122` | Off-screen green marker (positive category) |

#### Borders, scrims, separators

| Token | Value | Use |
|---|---|---|
| `modalScrim` | `rgba(0, 0, 0, 0.2)` | Dim layer behind /report popup |
| `cardBorderSubtle` | `rgba(0, 0, 0, 0.3)` | Input/card outlines |
| `separatorSubtle` | `rgba(0, 0, 0, 0.1)` | Hairline dividers on light bg |
| `separatorOnFlat` | `rgba(0, 0, 0, 0.08)` | Search bar outline on tap-state |
| `dividerOnDark` | `rgba(160, 214, 164, 0.25)` | Hairline dividers on wiltedgreen |
| `dragHandleBar` | `rgba(128, 128, 128, 0.55)` | Modal sheet drag handle |
| `dividerNeutral` | `rgba(202, 196, 208, 1)` | Vertical/horizontal card dividers |
| `whiteFill12` | `rgba(255, 255, 255, 0.12)` | Active state on dark surfaces (LaneStrip active lane) |

#### Reserved-color exceptions (per `.cursorrules`)

1. Brand/onboarding splash may use reserved colors atmospherically (Welcome screen orange = sunrise).
2. Illustrations are exempt (illustrative navy is not UI navy).
3. Daylight gradient encodes literal daylight color, not signaling.
4. Report flow identity icon (orange) — reporting *is* the safety signal.
5. Recording indicator + waveform red on /pulled-over — universal iconography.
6. En-route safety shield (navy) — canonical safety-affordance blue per Figma 825:3754.
7. Route-preview zone-warning chips (orange) — surfaces real hazard signals along route.
8. Inline form-validation errors (red) — universal iOS/web convention.

Use `ColorToken` type for parameters accepting a color name.

### 1.2 Typography (`theme/typography.ts`)

iOS HIG type ramp at SF Pro. Naming maps 1:1 to Figma's token names. RN only accepts 100-step font weights; Figma's "Semibold" (PostScript 590) maps to RN `'600'`, and "Medium" (510) maps to `'500'` — visually identical at the rendered size.

| Token | fontSize | lineHeight | fontWeight | letterSpacing | Intended use |
|---|---|---|---|---|---|
| `largeTitleEmphasized` | 34 | 41 | `'700'` | 0.4 | Largest hero headers (rare; reserved for marquee moments) |
| `title1Emphasized` | 28 | 34 | `'700'` | 0.38 | Guidance/instruction screens (default heading register) |
| `title1Regular` | 28 | 34 | `'400'` | 0.38 | In-modal user prompts ("Talk to us. What's going on?") — held question, not directive |
| `title2Regular` | 22 | 28 | `'400'` | -0.26 | Section header (regular emphasis) |
| `title2Emphasized` | 22 | 28 | `'700'` | -0.26 | Section header (bold emphasis) |
| `title3Regular` | 20 | 25 | `'400'` | -0.45 | Sub-section header |
| `title3Emphasized` | 20 | 25 | `'600'` | -0.45 | Sub-section header (emphasized) |
| `bodyRegular` | 17 | 22 | `'400'` | -0.43 | Body copy, search bar input |
| `bodyEmphasized` | 17 | 22 | `'600'` | -0.43 | Emphasized body copy |
| `calloutRegular` | 16 | 21 | `'400'` | -0.31 | Callout / inline-emphasized body |
| `subheadlineRegular` | 15 | 20 | `'400'` | -0.23 | Subheadline, supporting copy |
| `subheadlineEmphasized` | 15 | 20 | `'600'` | -0.23 | Button label (default), emphasized subheadline |
| `footnoteRegular` | 13 | 18 | `'400'` | -0.08 | Footnote, metadata |
| `footnoteEmphasized` | 13 | 18 | `'600'` | -0.08 | Emphasized footnote |
| `caption1Regular` | 12 | 16 | `'400'` | 0 | Caption — WCAG 1.4.4 floor for informational content |
| `caption1Emphasized` | 12 | 16 | `'500'` | 0 | Route-preview zone-warning chips (Figma 1109:3264) |
| `caption2Regular` | 11 | 15 | `'400'` | 0.06 | **Ornamental only** — legal fine print, timestamps, copyright. Below WCAG 12pt floor |

Rules:
- **In-modal user prompts use Title1 Regular.** When a modal asks the user something, regular weight reads as a held question rather than a directive.
- **caption2Regular is reserved for ornamental text.** Anything informational (a reader could miss and lose meaning) uses `caption1Regular` at 12pt instead.
- The `caption2Regular` lineHeight was bumped 13 → 15 in `chore/design-token-discipline-pass` for low-vision and stress-state readability.

Use `TypographyToken` type as a parameter type when a function accepts a typography token by name.

### 1.3 Shadows (`theme/shadows.ts`)

Three-tier ramp matching M3 Light elevations Figma uses. Each tier is a spread-ready object: `...shadows.e2` mixes into a StyleSheet entry cleanly. Both iOS shadow props and Android `elevation` ship on the same object (the unused one is a no-op on the opposite platform).

| Tier | shadowColor | shadowOffset | shadowOpacity | shadowRadius | elevation | When to use |
|---|---|---|---|---|---|---|
| `e1` | `#000` | `0, 1` | 0.15 | 3 | 2 | Chrome over map — FAB stack, ETA pill, search bar. Lightest lift. |
| `e2` | `#000` | `0, 2` | 0.18 | 4 | 3 | Bottom sheets, recommendation cards, primary CTAs. Workhorse. |
| `e3` | `#000` | `0, 2` | 0.25 | 4 | 4 | Markers and pins — strongest, reads against busy map content. |
| `dot` | `#000` | `0, 1` | 0.25 | 2 | 2 | Tiny circular markers (user-location blue dot) — e3 is proportionally too heavy on a 24pt circle. |
| `sheet` | `#000` | `0, -4` | 0.15 | 8 | 8 | Bottom sheet — shadow points **up** because the sheet rises from the bottom edge. Directional, not just elevated. |

**Drift:** `FloatingActionButton.tsx:76-80` inlines an e2-ish shadow with `shadowRadius: 6` instead of e2's 4. `SearchBar.tsx:158-161` does the same. Reconcile if a future PR consolidates onto the shadows module.

Use `ShadowName` type for parameters accepting a shadow tier name.

### 1.4 Dynamic Type (`theme/dynamic-type.ts`)

Two helpers for iOS Dynamic Type and WCAG 1.4.4 / 1.4.12 compliance.

#### `dynamicType(token)`

Scales `fontSize` AND `lineHeight` by `PixelRatio.getFontScale()` (the iOS Settings → Display & Text Size multiplier).

**Why this and not `allowFontScaling={true}` alone:** RN scales rendered glyphs by default when `allowFontScaling` is on, but does NOT scale an explicit `lineHeight`. Our typography tokens spread `lineHeight` into every styled Text — without this helper the font grows but the line box stays fixed and lines overlap.

Apply to:
- Multi-line paragraphs
- Bullets, narrative explanations
- Long-read copy where Dynamic Type matters most

Skip on:
- Headers and short labels constrained by layout (scaling can push fixed-position UI off-screen on Pro Max devices with maximum Dynamic Type)
- Logos or text with fixed aspect ratio (per Apple HIG)

Recomputed on every render (cheap; picks up Dynamic Type changes when the user re-focuses the app).

#### `relaxedLineHeight(token)`

Bumps line-height to **1.6× fontSize** for stress-state long reads. Canonical case: `/pulled-over` guidance bullets.

Default iOS body type uses ~1.29× (17/22), which matches the native body register but sits below WCAG 1.4.12 Text Spacing's "remains usable at 1.5× line-height" requirement. Cognitive-load research (Carter et al. 1998, NN Group studies) shows wider line-height reduces line-tracking errors under stress.

**Compose order:** relax first, then scale.
```ts
<Text style={dynamicType(relaxedLineHeight(typography.bodyRegular))}>
```

### 1.5 Interaction primitives (`theme/interaction.ts`)

#### `pressedDim`

```ts
export const pressedDim: ViewStyle = { opacity: 0.7 };
```

Universal "pressed" feedback for `Pressable`. iOS HIG expects this subtle dim on tap; without it, taps feel inert.

```tsx
<Pressable style={({ pressed }) => [styles.btn, pressed && pressedDim]} />
```

Skip on Pressables with custom press handling (color-changing toggles) or intentionally inert state (the dim would compete with the opacity-0.5 inert state used in /menu).

### 1.6 Spacing (`theme/spacing.ts`)

4pt base step ramp. Was implicit through v1 demo polish (yielded stragglers at 5/6/13/18/20/23); module makes the system explicit. When a value isn't on the ramp, prefer the closest step over inventing a new constant. Exceptions worth keeping numeric: anchored pixel-art positions (SVG-faithful insets from Figma frames) and asymmetric padding tuned to specific glyph optics.

| Token | Value |
|---|---|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |
| `xxl` | 48 |

**Note:** The original task brief assumed no `theme/spacing.ts` exists. It does — explicit 4pt ramp.

### 1.7 Map style (`theme/map-style.ts`)

Custom basemap JSON consumed by `<MapView customMapStyle={mapStyle} />` on Android, paired with `mapType="mutedStandard"` on iOS (MapKit honors a subset; `mutedStandard` does most of the dimming).

**Rationale:** Reads as a *navigation product*, not Apple/Google Maps' default "show me every business and POI." Apple Maps, Google Maps, and Waze all dim non-route POIs during active navigation; Fresh Greens applies the same treatment app-wide because it's always-in-navigation-mode by design.

What gets hidden:
- Business POIs (compete with our curated/community pins)
- Transit station icons (we don't surface transit data)
- Park-icon labels (polygon stays, label drops)

What stays visible:
- Road labels (driver reads street names)
- Road geometry + colors (basemap's primary affordance)
- Water + landuse polygons (gives map context)

Residential road labels are simplified + lightened (+25 lightness) so arterial roads pop more — the move that most separates "navigation app" from "drag the map around" Google Maps default.

---

## Section 2 — Components

All reusable components live in `components/`. One component per file unless tightly coupled (per `.cursorrules` "Code conventions").

### 2.1 FloatingActionButton (`components/FloatingActionButton.tsx`)

White circular button used over the map. Consolidates the per-screen `sideBtn` / `menuButton` / `avatarButton` styles into one component.

- **Figma:** `1133:13197`
- **Variants (size):** `'48'` (default, /home top-row overlays — Menu, Avatar; 24pt glyph) · `'56'` (/en-route side column — Volume, Help, Shield, Recenter, Report; 32pt glyph)
- **States:** default · pressed (universal `pressedDim`, 0.7) · disabled (also dimmed)
- **Sizing:** 48×48 or 56×56, fully circular (`borderRadius: 100`)
- **Shadow:** inline elevation (`shadowOffset: 0,2 / opacity 0.15 / radius 6 / elevation 4`) — drift from `shadows.e2` (radius 4 there). See §1.3.
- **Background:** `colors.white`
- **Children:** glyph is passed via `children` — component is icon-agnostic (consumers pass Phosphor / Ionicons / custom SVG)
- **Accessibility:** `accessibilityRole="button"` · `accessibilityLabel` · optional `accessibilityHint` (pairs with label to explain what tapping does; useful when label is a noun like "Change destination" rather than verb phrase) · `accessibilityState={{ disabled }}`

| Prop | Type | Default |
|---|---|---|
| `children` | `ReactNode` | — |
| `onPress` | `() => void` | — |
| `disabled` | `boolean` | `false` |
| `size` | `'48' \| '56'` | `'56'` |
| `accessibilityLabel` | `string` | — |
| `accessibilityHint` | `string` | — |
| `style` | `ViewStyle` | — |

### 2.2 Button (`components/Button.tsx`)

Unified rounded-pill button. Replaces the ad-hoc `scheduleBtn` / `goBtn` / `ctaPrimary` styles.

- **Figma:** `1133:12988`
- **Variant matrix (10 total in Figma):**
  - `type='primary'` × `fill='fill'` — freshgreen bg, wiltedgreen 1pt border, white text, e1-ish shadow
  - `type='primary'` × `fill='outline'` — freshgreen border, freshgreen text
  - `type='primary'` × `fill='transparent'` — no bg/border, white underlined text. Designed for **dark/colored backgrounds only** (onboarding, /trusted-contact-setup); on white the text is invisible. Constraint documented but not type-enforced.
  - `type='secondary'` × `fill='fill'` — wiltedgreen bg, white text, e1-ish shadow
  - `type='secondary'` × `fill='outline'` — wiltedgreen border, wiltedgreen text
  - Pressed is a Figma documentation variant; in code it's a runtime state via `pressedDim`.
  - `type='secondary' × fill='transparent'` is intentionally not a variant (too low-emphasis on most surfaces). Type narrowing enforces this.
- **States:** default · pressed (via `pressedDim`) · disabled · loading (`ActivityIndicator` replaces icon+label; implies disabled)
- **Sizing:** 44pt height (HIG floor), `borderRadius: 1000`, paddingHorizontal 16, gap 8 between icon + label
- **Icon slot:** 24×24, rendered left of label
- **Typography:** label is `typography.subheadlineEmphasized`
- **Why the wiltedgreen border on primary fill:** Lifts button-to-page contrast from freshgreen's 2.88:1 (below WCAG AA 3.0:1 for UI components) up into wiltedgreen's 6.54:1 range. Lets the brand-freshgreen vibrance ship on white surfaces without forcing a wiltedgreen swap on every CTA.
- **Accessibility:** `accessibilityRole="button"` · `accessibilityLabel` defaults to the `text` prop · `accessibilityState={{ disabled, busy: loading }}`

| Prop | Type | Default |
|---|---|---|
| `text` | `string` | — |
| `icon` | `ReactNode` | — |
| `onPress` | `() => void` | — |
| `disabled` | `boolean` | `false` |
| `loading` | `boolean` | `false` |
| `accessibilityLabel` | `string` | `text` |
| `style` | `ViewStyle` | — |
| `type` | `'primary' \| 'secondary'` | `'primary'` |
| `fill` | `'fill' \| 'outline' \| 'transparent'` | `'fill'` |

### 2.3 SearchBar (`components/SearchBar.tsx`)

Three-state search pill. Two layouts: floating over map (white + shadow) vs. embedded on a flat surface (gray, no shadow).

- **Figma:** `1133:13168`
- **States:**
  - `default` — white pill, M3 e2 shadow. Floating over map/imagery. Left: search icon. Right: mic icon. Placeholder text only — taps route to /search.
  - `on-tap` — gray translucent pill (`colors.separatorOnFlat`), no shadow. Pre-typing state on /search after user taps in. Left: back chevron. Right: mic icon.
  - `typing` — gray translucent pill, no shadow. Active-typing state. Left: search icon. Center: live value. Right: clear (X) icon.
- **Layout:** `default` is a `Pressable`; `on-tap` + `typing` use `TextInput` so the keyboard is owned by the search screen, not the floating pill.
- **Sizing:** 56pt height, `borderRadius: 1000`, `paddingHorizontal: 16`, `gap: 16`, stretches to parent width with 8pt horizontal margins
- **Typography:** input + placeholder use `bodyRegular`
- **Default placeholder:** `'Where are you headed?'`
- **Inner icons:** Ionicons `search` (24pt), `mic` (20pt), `chevron-back` (24pt), `close-circle` (24pt) — tinted `labelSecondary`. Icon Pressables have 14pt `hitSlop` on all sides.
- **Shadow:** inline e2-ish (shadow `0,2 / 0.15 / r6 / e4`). Drift from `shadows.e2`.
- **Accessibility:** `accessibilityRole="search"` on the wrapper · `accessibilityLabel` for input + icons

| Prop | Type | Default |
|---|---|---|
| `state` | `'default' \| 'on-tap' \| 'typing'` | `'default'` |
| `placeholder` | `string` | `'Where are you headed?'` |
| `value` | `string` | — |
| `onChangeText` | `(text: string) => void` | — |
| `onSubmit` | `() => void` | — |
| `onPress` | `() => void` | — |
| `onBackPress` | `() => void` | — |
| `onClearPress` | `() => void` | — |
| `onMicPress` | `() => void` | — |
| `autoFocus` | `boolean` | — |
| `style` | `ViewStyle` | — |

### 2.4 LandmarkMarker (`components/LandmarkMarker.tsx`)

Map-pinned community-report marker. Composes pin teardrop + colored Bg circle + per-category illustrated glyph.

- **Figma:** `1044:2667` (Draft tab), with `1133:13418` for selected/unselected sizing, `1255:1060` for identity sub-tag glyphs, `1133:13245` for the trusted-friend variant
- **Variants (pin color = sentiment):**
  - `'black-owned'` — black pin, brand-green inner glyph
  - `'positive'` — brand-green pin (Figma label is "Postive" sic), white inner glyph. Used for `felt-welcome`, `home`, `trusted-friend`
  - `'report'` — orange pin, white inner glyph. Used for `felt-unsafe`, `incident`, `lighting`, `hazard`
- **Removed variant:** A 4th "Local Business" gray variant existed; removed in `chore/design-token-discipline-pass` when nothing routed to it.
- **States:** default · selected (`selected: true` scales 1.33×, `scale(0.75)` from native 96px frame for unselected — keeps RN marker bounds at 96×96 in both states to prevent MapKit bitmap-size jump on tap)
- **Special-case:** `categoryId='trusted-friend'` bypasses the composed layout and renders the bespoke `trusted-friend.svg` (62×51, brand-baked tail + heart). Anchor at the tail tip (4/62, 45.26/51). The off-screen edge marker swaps the heart for a white car glyph to disambiguate from felt-welcome.
- **Sizing:** 96×96 frame (selected size), pin 60×78 inside, Bg circle 48×48, glyph 32×32. Pin tip anchored at bottom-center (`anchor={{ x: 0.5, y: 1 }}`)
- **Shadow:** `shadows.e3` (consolidated tier per shadows.ts; previously inlined as `elevation: 3`, drift of 1)
- **Glyph dispatch:** per-category SVG, with sub-tag override:
  - Identity sub-tags (`Women-owned`, `LGBTQ+ welcoming`, `Open restroom`, `Late-night welcome`) render bespoke multi-color SVGs (Figma 1255:1060)
  - Place-type sub-tags (`Restaurant`, `Bar/Cafe`, `Retail`, `Salon/Barber`, `Services`, `Park/Public space`, `Personal`) render Phosphor duotone icons tinted to the variant's foreground (freshgreen on black-owned, white on positive)
  - Falls through to category-level SVG, then a defensive `GlyphHazard` fallback
- **MapKit bitmap caching:** `tracksViewChanges` starts `true`, flips `false` after 50ms (`useState + setTimeout`). Re-snapshots when `selected` flips so the scaled bitmap matches the visual state. setTimeout(0) is not enough; 50ms covers layout + paint + style commit on iOS and Android.
- **Accessibility:** `accessibilityRole="button"` on the Marker · caller passes `accessibilityLabel` · SVGs marked `accessibilityIgnoresInvertColors`

| Prop | Type | Default |
|---|---|---|
| `latitude` | `number` | — |
| `longitude` | `number` | — |
| `categoryId` | `string` | — |
| `subTag` | `string` | — |
| `accessibilityLabel` | `string` | — |
| `onPress` | `() => void` | — |
| `selected` | `boolean` | `false` |

Export: `variantForCategoryId(id)` maps category id → `Variant`.

### 2.5 DestinationMarker (`components/DestinationMarker.tsx`)

48×48 marker that drops at the active route's endpoint.

- **Figma:** `1245:10977` (home variant) · `296:468` (enroute variant)
- **Variants:**
  - `'home'` — pin teardrop with checkered-flag inset + anchor dot. Used on /home route-preview (pre-departure). Reads as "this is where we're going."
  - `'enroute'` — checkered finish-line flag on a pole. Used on /en-route mid-trip. Reads as "racing toward the finish."
- **Shared vocabulary:** Both use a checker-pattern visual so destination semantic stays consistent across trip lifecycle.
- **Sizing:** 48×48 frame. Anchor differs per variant:
  - `home`: `(0.5, 92/96)` — the SVG's anchor-dot center sits 4pt up from the bottom edge
  - `enroute`: `(10.5/48, 41/48)` — the pole base "stands" on the coordinate
- **Shadow:** `shadows.e3` applied **only** to the `enroute` variant. The `home` SVG bakes its own dual drop-shadow filter; adding RN shadow there would compound.
- **MapKit lifecycle:** Same `tracksViewChanges` true → 50ms → false pattern as LandmarkMarker.
- **`zIndex: 500`** — sits above LandmarkMarker (default) but below UserLocationMarker (1000)
- **Accessibility:** `accessibilityRole="image"` · `accessibilityLabel`: `Destination: {name}` when name set, else `Destination`

| Prop | Type | Default |
|---|---|---|
| `latitude` | `number` | — |
| `longitude` | `number` | — |
| `name` | `string` | — |
| `variant` | `'home' \| 'enroute'` | `'home'` |

### 2.6 EnRouteCarMarker (`components/EnRouteCarMarker.tsx`)

User-location replacement during active navigation. Top-down car that rotates to face direction of travel.

- **Heading:** `expo-location.LocationObjectCoords.heading` (degrees, 0=north, 90=east). SVG ships pointing "up" at 0°, so raw heading rotates it correctly on a north-up camera. `null` heading sits unrotated.
- **Sizing:** 36×48 frame, anchored center
- **Shadow:** none (the SVG carries its own visual weight)
- **`zIndex: 1000`** — at the top of the marker stack
- **MapKit lifecycle:** Same `tracksViewChanges` 50ms settle. Consumer also re-mounts via a heading-derived key (`Math.round(heading)`) when heading changes meaningfully.
- **Accessibility:** `accessibilityRole="image"` · label `'Your car along the route'`

| Prop | Type |
|---|---|
| `latitude` | `number` |
| `longitude` | `number` |
| `heading` | `number \| null` |

### 2.7 UserLocationMarker (`components/UserLocationMarker.tsx`)

iOS-style blue dot. Replaces `react-native-maps`' `showsUserLocation` because that prop can't be assigned a `zIndex`.

- **Visual:** outer white ring (24pt) + inner systemBlue circle (18pt) + pulsing accuracy ring behind (28pt, animated 1.0 → 1.4 scale, 0.35 → 0 opacity, 1.6s loop)
- **Colors:** `systemBlue` (`#007AFF`) for the canonical "iOS blue dot" read
- **Sizing:** 40×40 frame (room for the pulse to expand without clipping). Anchor center.
- **Shadow:** `shadows.dot` on the outer ring (tighter than e3, proportional to a 24pt circle)
- **`zIndex: 1000`** — above LandmarkMarker (default 0)
- **Reduce-motion:** pulse pinned to end-of-cycle (`setValue(1)` → scale 1.4, opacity 0) so it renders as no visible ring. Pinning to 0 would freeze a semi-visible (opacity 0.35) ring that reads as a rendering artifact.
- **MapKit lifecycle:** Same 50ms settle pattern. Pulse stops animating once tracking stops (acceptable trade — pulse is decorative, dot is load-bearing).
- **Accessibility:** `accessibilityRole="image"` · label `'Your location'`

| Prop | Type |
|---|---|
| `latitude` | `number` |
| `longitude` | `number` |

### 2.8 ClusterMarker (`components/ClusterMarker.tsx`)

Small badge shown when several report markers would otherwise stack at low zoom.

- **Visual:** 36×36 wiltedgreen circle, 2pt white border, count text centered
- **Color rationale:** wiltedgreen + white reads as "count badge" without coding as a hazard. Orange would conflict with `.cursorrules` reserved-color rule — this is informational, not a safety signal.
- **Typography:** count uses `footnoteEmphasized` (13/18, weight 600), white
- **Sizing:** 36×36, `borderRadius: 18`. Anchor center.
- **Shadow:** inline e3-ish (`0,2 / 0.25 / r4 / e3`) — drift of 1 from `shadows.e3` elevation 4
- **MapKit lifecycle:** Same 50ms settle. Cluster IDs change per zoom step, so each is a fresh Marker mount.
- **Accessibility:** `accessibilityRole="button"` · label `'{count} community reports nearby — tap to zoom in'`

| Prop | Type |
|---|---|
| `latitude` | `number` |
| `longitude` | `number` |
| `count` | `number` |
| `onPress` | `() => void` |

### 2.9 EdgeIndicator (`components/EdgeIndicator.tsx`)

Off-viewport POI indicator pinned to screen edges, points toward the off-screen marker.

- **Figma:** `1133:13250`
- **Layered composition:**
  1. **Bottom** — colored teardrop polygon (42×62, per variant). Rotated `rotation + 90°` so the polygon's up-pointing tip (21,0) swings to the off-viewport direction.
  2. **Middle** — 36pt solid-fill circle at the polygon's rounded base (`translateY: 9`)
  3. **Top** — 24pt inner glyph (or 22.14×15.03 trusted-friend car). Counter-rotated to stay upright at any wrapper rotation.
- **Variant + categoryId resolution** for circle color:
  - `categoryId='trusted-friend'` → `burntgreen` (matches the on-map dark inner circle)
  - `variant='positive'` → `slightlyWiltedGreen` (`#1F8122`)
  - `variant='report'` → `slightlyDarkOrange` (`#D34400`)
  - `variant='black-owned'` → `black`
- **Edge palette rationale:** Darker, more saturated than brand orange/green — designed to read at the small 36pt edge marker against busy map content (per `colors.ts` comment).
- **Sizing:** 72×72 wrapper at `position: absolute`, positioned by caller via `(x - 36, y - 36)` (so x,y refer to the wrapper center)
- **Animation:** `usePulseOpacity(0.55)` — pulsing opacity on the polygon layer to draw the eye toward off-screen content. Caller-side hook gates on reduce-motion.
- **Shadow:** `shadows.e3` on each layer
- **Count badge:** `count > 1` replaces the inner glyph with the number text (`9+` cap). Inherits variant's circle color.
- **Trusted-friend dispatch:** `categoryId='trusted-friend'` always wins glyph routing; renders the white Car glyph (Figma car SVG) regardless of variant. This is the load-bearing reason this exists — trusted-friend and felt-welcome both map to `positive` variant but need different glyphs.
- **Accessibility:** `accessibilityRole="button"` · `accessibilityLabel` from caller · `hitSlop` 8pt on all sides

| Prop | Type | Default |
|---|---|---|
| `x` | `number` (screen px) | — |
| `y` | `number` (screen px) | — |
| `rotation` | `number` (degrees, atan2 screen-space, 0° = right) | — |
| `variant` | `Variant` (from LandmarkMarker) | — |
| `categoryId` | `string` | — |
| `count` | `number` | — |
| `children` | `ReactNode` (overrides DefaultGlyph) | — |
| `onPress` | `() => void` | — |
| `accessibilityLabel` | `string` | — |

### 2.10 DragHandle (`components/DragHandle.tsx`)

Gray bar atop a modal/bottom-sheet.

- **Visual:** 32pt wide × 4pt tall, `borderRadius: 100`, `colors.dragHandleBar` (`rgba(128,128,128,0.55)`)
- **Layout:** `alignSelf: 'center'` — caller drops in directly atop the sheet content
- **States:** Visual-only; no interaction state (the sheet's gesture handler owns drag behavior)
- **Accessibility:** None applied — purely decorative; the sheet handles a11y at the wrapper level

| Prop | Type |
|---|---|
| (none) | — |

### 2.11 StateCard (`components/StateCard.tsx`)

Three state cards (`EmptyState`, `LoadingState`, `ErrorState`) sharing the same rounded card shape with different fills + icon treatments.

- **Figma:** `1133:13148` (Empty) · `1133:13325` (Loading) · `1133:13326` (Error)
- **Components:**
  - `EmptyState` — `default` (vertical, gray translucent bg + subtle border) or `selected` (horizontal layout, burntgreen bg)
  - `LoadingState` — no bg/border (lets parent surface show through). Native `ActivityIndicator` instead of Figma's custom spinner SVG. Default copy `'Charting course…'`
  - `ErrorState` — no bg/border. Phosphor `WifiSlash` (duotone, 56pt) as placeholder for the Figma tangled-lightbulb illustration. Default copy: `"We're having trouble connecting to the internet right now."`
- **Sizing:** 326pt wide, 32pt padding, `borderRadius: 16`, centered
- **Inner icon slot:** 56×56
- **Typography:**
  - Headline: `bodyEmphasized`, freshgreen (or wiltedgreen on selected bodyOnDark)
  - Body: `bodyRegular`, freshgreen / wiltedgreen / labelTertiary depending on context
- **Accessibility:**
  - EmptyState: `accessibilityRole="text"` · combined headline + text label
  - LoadingState: `accessibilityRole="progressbar"` · `accessibilityState={{ busy: true }}`
  - ErrorState: `accessibilityRole="alert"`
- **Drift:** `ErrorState`'s `WifiSlash` icon is a placeholder until the Figma tangled-lightbulb SVG is exported.

| EmptyState prop | Type | Default |
|---|---|---|
| `icon` | `ReactNode` | — |
| `headline` | `string` | — |
| `text` | `string` | — |
| `state` | `'default' \| 'selected'` | `'default'` |
| `style` | `ViewStyle` | — |

| LoadingState prop | Type | Default |
|---|---|---|
| `text` | `string` | `'Charting course…'` |
| `style` | `ViewStyle` | — |

| ErrorState prop | Type | Default |
|---|---|---|
| `icon` | `ReactNode` | `<WifiSlash size={56} color={labelTertiary} weight="duotone" />` |
| `text` | `string` | `"We're having trouble connecting to the internet right now."` |
| `style` | `ViewStyle` | — |

### 2.12 PageControl (`components/PageControl.tsx`)

iOS-style dot indicator for onboarding/stepped flows.

- **Figma:** `488:54907`
- **Visual:** Row of 8pt circles, gap 8pt, container 44pt tall. Active dot fully opaque, inactive dots 30% opacity.
- **Color:** dot color is controlled by the `color` prop (default `colors.white` for onboarding's dark backgrounds). On light surfaces (e.g. `/menu`'s white Quick Tiles carousel) callers must pass a tinted color — `colors.wiltedgreen` is the canonical pick. Inactive dots use 30% opacity of the same color.
- **Sizing:** 8×8 dots, container `height: 44`, `alignSelf: 'center'`
- **Accessibility:** `accessibilityRole="text"` · label `'Page {N} of {total}'`

| Prop | Type | Default |
|---|---|---|
| `total` | `number` | — |
| `activeIndex` | `number` (zero-based) | — |
| `color` | `string` | `colors.white` |

### 2.13 ReportDetailCard (`components/ReportDetailCard.tsx`)

Bottom-sheet detail card shown when the user taps a community-report pin.

- **Figma:** `1133:13853` (Bottom Sheet — Marker chrome)
- **Composition:**
  - DragHandle on top
  - Symmetric header row: Share FAB left · centered category icon + title + subline · Close FAB right
  - Optional photo (4:3, 12pt corner radius, full-width within 24pt gutter, `resizeMode: cover`)
  - Optional detail body copy
- **Sheet chrome:** `colors.white`, `borderTopLeftRadius/borderTopRightRadius: 28`, `paddingTop: 16`, `paddingBottom: 32` (per `.cursorrules` static-content-modal rule)
- **Shadow:** `shadows.sheet` (directional upward `0,-4` offset)
- **Scrim:** transparent overlay catching outside-taps to dismiss; no bg dim (sheet meant to coexist with the map underneath, not modally block it)
- **Title/subline composition:** Title is resolved place name (from `placeName`) when present; otherwise the category label. Subline carries whatever didn't fit in the title, plus relative time (`Just now` · `Nm ago` · `Nh ago` · `Yesterday` · `Nd ago` · `Nw ago`)
- **FAB icons:** Phosphor `Export` (Share) and `X` (Close), 24pt, `labelSecondary`. Share is a no-op chrome element until a real share path lands.
- **Category icon stack:** 36pt Bg SVG + 24pt glyph centered on it (same composition as LandmarkMarker but flat, no pin)
- **Typography:** title is `title2Emphasized`, subline is `footnoteRegular` (mutedSecondary), detail is `bodyRegular` (mutedSecondary)
- **Accessibility:** sheet is `accessibilityViewIsModal` · scrim has `accessibilityLabel="Dismiss report detail"` · `onStartShouldSetResponder` stops sheet-internal taps from bubbling to scrim
- **Notable Figma divergences (documented inline):**
  - Category icon stays as a central element above the title — community-reports' core information is what kind of report it is.
  - "8 min / Move" CTA pair is omitted — reports are informational, not navigable.

| Prop | Type |
|---|---|
| `categoryId` | `ReportCategoryId` |
| `detail` | `string` |
| `subTag` | `string` |
| `placeName` | `string` (auto-resolved business name from coords at submit time) |
| `photoUri` | `string` (local file URI) |
| `timestamp` | `number` (ms epoch) |
| `onDismiss` | `() => void` |

### 2.14 LaneStrip (`components/LaneStrip.tsx`)

Apple Maps-style lane guidance row shown at the top of the en-route turn card.

- **Spec:** `docs/superpowers/specs/2026-05-27-lane-guidance-design.md`
- **Visual:** Row of lane cells; active lanes get `whiteFill12` background (subtle glow on the dark turn-card surface)
- **Sizing:** Cells `minWidth: 32`, `height: 40`, `borderRadius: 6`. Container `maxHeight: 64` when visible (8pt vertical breathing above the maneuver row below).
- **Cell content:** Lane direction glyphs (24pt for single-direction, 16pt for multi-direction). Active matching direction = 1.0 opacity, non-matching direction in multi-dir lane = 0.5, inactive lane = 0.3.
- **Direction icons:** Phosphor — `ArrowUp` (straight), `ArrowUpLeft`/`ArrowUpRight` (slight-left/right), `ArrowBendUpLeft`/`ArrowBendUpRight` (left/right), `ArrowElbowLeft`/`ArrowElbowRight` (sharp-left/right), `ArrowUUpLeft` (u-turn)
- **Color:** glyphs are `colors.white` (sits on the dark turn-card surface)
- **Bottom hairline divider:** `StyleSheet.hairlineWidth` of `dividerOnDark` between cells row and the maneuver row below
- **Animation:** Visibility tweened (220ms, `Easing.out(Easing.cubic)`) via `maxHeight` + opacity. Reduce-motion gates to instant `setValue` toggle.
- **VoiceOver announcement:** On false→true transition, announces composed label (`"Use leftmost N lanes"` / `"Use middle N lanes"` / `"Use the {Nth} lane from the left"` / `"All lanes go this way"` / etc.) so drivers hear lane decisions as soon as they become relevant.
- **A11y when hidden:** `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"` — suppresses VoiceOver entirely when collapsed (platform-inconsistent without this).

| Prop | Type |
|---|---|
| `lanes` | `Lane[]` (from `lib/api/routes`) |
| `visible` | `boolean` |
| `style` | `ViewStyle` |

### 2.15 HomeBrowseSheet — RecommendationCard contract (`components/HomeBrowseSheet.tsx:845`)

Focus only on the canonical recommendation-card visual contract surfaced inside the browse sheet. (The sheet itself is a 1482-line composite; full audit is out of scope.)

- **Figma reference:** v2 `1114:9047`. The codebase intentionally diverges in two places (documented inline at the styles); both are density/readability trade-offs.
- **Card dimensions:** `CARD_WIDTH = 280`, `CARD_GAP = 12`. Background white, `borderRadius: 12`, `padding: 16`, `gap: 16`, `shadows.e1`.
  - **Drift:** v2 spec is 328pt wide with 24pt padding + 48pt photo→body gap. Codebase ships 280pt at 16pt padding/gap so the carousel peeks comfortably on iPhone viewports.
- **Photo slot:** `aspectRatio: 4 / 3`, full card width, `borderRadius: 8`, `overflow: hidden`.
  - **Drift:** v2 spec is 1:1. 4:3 chosen because (a) 1:1 makes cards ~70pt taller and pushes title/tags below the visible sheet edge on a 6.1" iPhone, (b) Google Places photos are typically horizontal — they frame better at 4:3.
  - **Placeholder fallback:** `fadedgreen` bg with category glyph (per `PhotoPlaceholderGlyph`) when no `photoName` or when Google's photo proxy fails.
- **Overlays on the photo:**
  - **Topline callout** (top-left, max 85% width) — white pill with `shadows.e1`, 6/10pt padding, gap 6. Either Clock icon + closing-soon text, or 20pt fadedgreen avatar circle (with burntgreen initial in `caption1Emphasized`) + attribution text. Text uses `footnoteEmphasized`.
  - **Quote callout** (bottom edge-to-edge with 8pt insets) — white pill with `shadows.e1`, 12pt padding, gap 8. ChatCircle 16pt fill wiltedgreen icon + the curator quote text. Quote uses `dynamicType(relaxedLineHeight(typography.footnoteRegular))` capped at 4 lines (WCAG 1.4.4 + 1.4.12 — long-read editorial copy gets relaxed line-height and Dynamic Type scaling).
- **Card body (below photo):**
  - **Title** — `typography.title3Emphasized` (20pt/25, weight 600), `numberOfLines: 2`, `adjustsFontSizeToFit`, `minimumFontScale: 0.85`.
    - **Drift documented (H7):** Dropped from `title1Emphasized` (28pt) → `title3Emphasized` (20pt). `title1Emphasized` is the guidance-screen register per `.cursorrules`; overkill on a 280pt carousel card. Apple/Google Maps place cards sit at 15-17pt semibold.
  - **Tag rows** — flexWrap, gap 8. Contains:
    - Rating pill: `fillsPrimary` bg, 4pt borderRadius, 4pt padding. Star 14pt fill freshgreen + `footnoteEmphasized` freshgreen number with `fontVariant: ['tabular-nums']` + optional `(N reviews)` in `footnoteRegular` labelTertiary.
      - Documented brand exception: freshgreen rating-text on fillsPrimary is ~2.5:1 (below AA) but the star icon carries meaning and `(N reviews)` resolves ambiguity. Tracked as brand exception, not oversight.
    - Open/closed pill: `openPill` (fadedgreen bg, burntgreen text `footnoteEmphasized`) when open, else generic `tag` (`fillsPrimary` bg, `footnoteRegular` black text).
    - Hours, distance: generic `tag` style. Distance has `tabular-nums`.
  - **Muted tag** — `fillsSecondary` bg, `caption1Regular` `mutedSecondary` text. Used for price tier + free-form `tags` array (label + optional emoji).
- **Skeleton stand-in:** `RecommendationCardSkeleton` matches card dimensions with `fillsPrimary` blocks for photo + title + tag rows. Static (no shimmer) so it doesn't conflict with reduce-motion or the sheet's snap behavior.
- **Accessibility:** Pressable with `accessibilityRole="button"` · composed `a11yLabel` that includes topline a11yPrefix, name, category, rating + review count, open state, hours, distance, and curator quote (was previously truncated to "{name} recommendation — tap to route" which stripped 5+ data points) · `accessibilityHint="Routes to this destination"`.

### 2.16 Hazard (`components/Hazard.tsx`)

Yellow-diamond hazard glyph used across multiple surfaces.

- **Figma:** `1133:13397` / `1133:13297`
- **Variants (`category`):**
  - `'lighting'` — `HazardLighting` SVG
  - `'road-condition'` — `HazardRoadCondition` SVG
  - `'wildlife'` — `HazardWildlife` SVG
  - `'community-alert'` — `HazardCommunityAlert` SVG
- **What the SVG includes:** Full visual (yellow diamond + black stroke + black glyph) baked into the SVG. Callers must NOT wrap this in additional yellow chrome (would double-count the diamond).
- **`color` is not a prop:** Recoloring at runtime is intentionally not supported. For tinted variants, build a separate component.
- **Sizing:** Single `size` prop (default 24pt). Used at multiple scales:
  - /en-route turn-card hazard row (small, inline)
  - EnRouteZone Default badge on map (32pt)
  - EnRouteZone Extended pill (24pt inside pill chrome)
  - /en-route Full bottom-sheet hazard panel (96pt)

| Prop | Type | Default |
|---|---|---|
| `category` | `HazardCategory` | — |
| `size` | `number` | 24 |

### 2.17 EnRouteZone (`components/EnRouteZone.tsx`)

On-map zone marker for hazard polygons/polylines. Swaps between compact badge and extended pill based on driver proximity.

- **Figma:** `1133:13297`
- **Variants (`state`):**
  - `'default'` — 62×50 yellow tail-shape with diamond + glyph baked in. Always rendered for caution/avoid zones in viewport.
  - `'extended'` — 158×50 pill: `[hazard icon] For X mi.`. Shown when user is inside (or near) the zone.
- **Sizing/anchor:**
  - default: `anchor={{ x: 4/62, y: 45/50 }}` — tail tip
  - extended: `anchor={{ x: 4/158, y: 45/50 }}` — same tail position relative to wider frame
- **Per-category SVGs:** 4 default + 4 extended SVGs (light/road/wildlife/community-alert)
- **`tracksViewChanges={false}` from t=0** — caller remounts the Marker (via state-bearing key) when default↔extended flips, so per-frame snapshot cost is avoided in both states.
- **Accessibility:** `accessibilityRole="none"` (passive route-segment annotation, not tappable image content) · `accessibilityLabel`:
  - default: `'{category} zone ahead'`
  - extended: `'Entering a zone. {category} for {lengthMiles} mi.'`
- **Drift (v1 limitation):** Extended SVG has Figma-baked "For 0.5 mi." text. `lengthMiles` is threaded for VoiceOver (real value) but visible text is the baked Figma value until a future PR strips the text path and overlays dynamic `<Text>`.

| Prop | Type |
|---|---|
| `latitude` | `number` |
| `longitude` | `number` |
| `category` | `HazardCategory` |
| `state` | `'default' \| 'extended'` |
| `lengthMiles` | `number` |

---

## Section 3 — Screen surfaces

Brief composition map per screen — which components and tokens each surface composes. Not a flow audit.

### 3.1 `/home` (`app/home.tsx`)

Two co-resident modes:
- **Browse** — full bottom sheet (`HomeBrowseSheet`) with recommendation carousels, weather card, daylight strip, category chips
- **Route preview** — pre-departure route card with destination summary, ETA, zone-warning chips, and a "Go" CTA before transitioning to /en-route

Components: `SearchBar` (default state, top of map) · `FloatingActionButton` (48pt — Menu, Avatar, Report, Recenter, Layers) · `UserLocationMarker` · `LandmarkMarker` (community-report pins) · `ClusterMarker` (low zoom) · `DestinationMarker` (`home` variant, pre-departure) · `EdgeIndicator` (off-viewport report pulse) · `ReportDetailCard` (pin-tap bottom sheet) · `HomeBrowseSheet` (the main browse surface) · `StateCard` (empty/loading/error fallbacks) · `DragHandle` (atop sheets)

Tokens: `colors` (brand greens, edge palette, fills ramp, daylight gradient anchors) · `typography` (body/title2/footnote registers) · `shadows.e1` (FAB stack, ETA pill, recommendation cards) · `shadows.e2` (bottom sheet) · `shadows.sheet` (sheet directional shadow) · `mapStyle` (custom basemap)

### 3.2 `/en-route` (`app/en-route.tsx`)

Active navigation surface. Composes a turn card at top, side button column at right, ETA cluster at bottom, and a hazard/zone overlay system on the map.

Components: `EnRouteCarMarker` (rotating car, replaces user-location dot) · `LandmarkMarker` (route-relevant report pins) · `ClusterMarker` · `DestinationMarker` (`enroute` variant, mid-trip) · `EnRouteZone` (default + extended hazard markers) · `Hazard` (turn-card hazard row, bottom-sheet hazard panel) · `LaneStrip` (atop turn card on multi-lane maneuvers) · `FloatingActionButton` (56pt — Volume, Help, Shield, Recenter, Report) · `ReportDetailCard` · `DragHandle`

Tokens: `colors.navy` (Shield button) · `colors.orange` (Report button) · `colors.red` (Help button) · `colors.burntgreen` (turn-card "Then" footer) · `colors.wiltedgreen` (turn-card surface) · `typography.title1Emphasized` (turn instruction) · `shadows.e1` (ETA pill, side buttons) · `mapStyle`

### 3.3 `/search` (`app/search.tsx`)

Search surface with embedded search bar (on-tap / typing states), result list, and empty/error fallbacks.

Components: `SearchBar` (`on-tap` + `typing` states) · `StateCard` (empty/error)

Tokens: `colors.fillsTertiary` (search bar inset on flat surface) · `typography.bodyRegular` (results) · `typography.footnoteRegular` (subtitle)

### 3.4 `/menu` (`app/menu.tsx`)

Settings menu and onboarding-style stepper.

Components: `PageControl` (onboarding-style step dots)

Tokens: `colors.wiltedgreen` (atmospheric header bg) · `colors.white` · `typography.bodyEmphasized` (row labels) · `typography.title2Emphasized` (section headers)

### 3.5 `/safety` (`app/safety.tsx`)

Modal that surfaces safety affordances during a trip (shield-tap → Trip Summary → Help options).

Components: `DragHandle` (sheet header) — uses inline ad-hoc safety buttons rather than `Button` (legacy structure; predates the unified Button component)

Tokens: `colors.navy` (shield identity color) · `colors.white` (sheet bg) · `shadows.sheet` · `typography.title1Regular` (in-modal user prompt register per `.cursorrules`)

### 3.6 `/report` (`app/report.tsx`)

Community-report submission flow. Picker tile grid → detail/photo form → thank-you confirmation.

Components: `Button` (CTAs)

Tokens: `colors.orange` (alert-circle title icon — "report flow identity") · `colors.modalScrim` (dim layer behind popup) · `typography.title1Regular` (in-modal user prompt) · `typography.bodyRegular` (form labels) · `shadows.e2` (popup card)

### 3.7 `/pulled-over` (`app/pulled-over.tsx`)

Stress-state safety surface during a traffic stop. Live audio waveform recording widget, trusted-contact status, guidance bullets.

Components: `DragHandle` · `TrustedContactStatus`

Tokens: `colors.red` (recording indicator pulse + waveform — universal iconography per `.cursorrules` exception 5) · `colors.wiltedgreen` (atmospheric bg) · `typography.bodyRegular` wrapped in `dynamicType(relaxedLineHeight(...))` for stress-state long-read guidance bullets (per `theme/dynamic-type.ts`)

### 3.8 `/recordings` (`app/recordings.tsx`)

List of saved /pulled-over recordings with playback + delete affordances.

Components: `Button` · `StateCard` (empty/error)

Tokens: `colors.white` (row bg) · `typography.bodyEmphasized` (row title) · `typography.footnoteRegular` (timestamp) · `shadows.e1` (row cards)

---

## Section 4 — Conventions + anti-patterns

### 4.1 Reserved-color rule

Yellow, Red, Orange, Navy, and the daylight gradient are UI signals only. In-flow CTAs and links use freshgreen or wiltedgreen — never the reserved palette.

Eight documented exceptions live in `.cursorrules` ("Reserved-color rule") and are summarized in §1.1. Two short examples:

- The Report button on /home + /en-route is orange because **reporting *is* the safety signal** (intent preserved, not violated)
- Recording-state red on /pulled-over is universal iconography (every camera/voice-recorder app on iOS uses red here) — global enough not to compete with route-data palette

If a use-case feels like it needs reserved color but isn't in the exception list, ask before shipping. The pattern: reserved colors mean something specific; introducing a 9th exception dilutes signal across the app.

### 4.2 4pt grid for spacing

Spacing pulls from `theme/spacing.ts`'s `xs / sm / md / lg / xl / xxl` ramp (4/8/16/24/32/48). When a value isn't on the ramp, prefer the closest step over inventing a new constant.

Exceptions worth keeping numeric:
- Anchored pixel-art positions (SVG-faithful insets from Figma frames)
- Asymmetric padding tuned to specific glyph optics

### 4.3 44pt minimum tap target

Per iOS HIG, every interactive control hits 44×44 pt **on the visual, not just the hit area**. iOS HIG takes precedence over Figma when in conflict — if the design specs a 36pt button, build it at 44pt.

Don't paper over a sub-44pt visual with `hitSlop`. Invisible tap area below the visible affordance is a usability + confidence problem (users tap "near" the button hoping it works).

`hitSlop` is for the narrow case: small icon inside a dense row where 44pt would break the layout, OR a child target inside an already-compliant larger container. Forgiveness padding on top of compliance, not the compliance mechanism.

### 4.4 Tabular-nums on updating digits

Any number that updates in place at the same UI position must use `fontVariant: ['tabular-nums']`. Without it, proportional digit widths cause layout reflow on each update.

Confirmed surfaces:
- Recommendation card rating (`4.2 → 3.8`) and distance (`0.3 mi → 1.2 mi`) — `HomeBrowseSheet.tsx:1427, 1444`
- /pulled-over recording timestamp — `app/pulled-over.tsx:1456, 1616`
- /en-route ETA + distance — per "F7 fix" referenced in HomeBrowseSheet comment

When introducing a new live-updating number, default to tabular-nums.

### 4.5 `useReduceMotion()` gating for all animations

Every animation hook reads `useReduceMotion()` (from `hooks/useReduceMotion.ts`) and renders an instant present/absent toggle when on. Confirmed gating in:
- `UserLocationMarker` pulse
- `LaneStrip` show/hide tween
- `HomeBrowseSheet` snap/scroll
- `trusted-contact-setup`, `menu`, `recordings`

When the user has Reduce Motion enabled, the visual should not animate — `setValue(targetValue)` immediately to the end state. Reduce-motion users get the same final visual; they just skip the transition.

Edge case: in `UserLocationMarker` the pulse pins to `value=1` (end-of-cycle = scale 1.4, opacity 0, i.e. no visible ring) rather than `value=0` (start-of-cycle = visible mid-state) so reduce-motion users don't see a frozen artifact.

### 4.6 Per-variant FAB sizing

`FloatingActionButton` ships two sizes: 48pt (default /home overlays — Menu, Avatar) and 56pt (/en-route side column — Volume, Help, Shield, Recenter, Report). Both hit the 44pt floor with margin.

Don't introduce a 3rd size without checking whether one of these fits.

### 4.7 StyleSheet API only

`.cursorrules` anti-slop check 2: **no hardcoded design values**. Never write a hex color, font size, or spacing value inline in a screen. Pull from `theme/`. If a needed token doesn't exist, **add it to `theme/` first**, then use it.

No Tailwind / NativeWind / styled-components. State management is `useState` + Context (no Redux / Zustand / Jotai).

### 4.8 Every state should be designed

For each user-facing component, expect coverage of:
- default
- loading (where data-bound — see `RecommendationCardSkeleton`, `LoadingState`)
- empty (`EmptyState`)
- error (`ErrorState`)
- disabled (where interactive — `Button`'s disabled + busy `accessibilityState`)
- pressed (`pressedDim` — universal Pressable feedback)
- selected (where stateful — `LandmarkMarker.selected`, `EmptyState.selected`)

When designing a new component, walk through all six and either implement or explicitly document "intentionally not covered, falls through to N." Avoid silent fall-through (a missing empty state usually reads as "broken").

### 4.9 Search-bar contextual treatment

Per `.cursorrules`: SearchBar is white + e2-ish shadow when **floating over map/imagery** (`state='default'`); fills/tertiary gray + no shadow when **embedded on a flat surface** (`state='on-tap' | 'typing'`). The shadow is a physical-metaphor cue, not a fixed style.

### 4.10 Modal user-prompt typography exception

In-modal user prompts use `typography.title1Regular` (28pt **regular weight**), not `title1Emphasized`. When a modal asks the user something — "Talk to us. What's going on?", "Street lights down or dimmer than normal?", "Thanks for submitting." — regular weight reads as a held question rather than a directive.

Same exception covers emotionally charged full-screens (Contact "You're not alone.", Trip Summary arrival).

**Prompt vs. instruction heading — the registers intentionally differ.** This regular-weight rule applies to titles that *ask a question* (`/safety` "What's going on?"). It does **not** apply to action/instruction headings that *name what the screen does* — those keep the default `title1Emphasized` per the guidance-screen rule. So `/report`'s "Report" + per-category titles are **bold**, while `/safety`'s is **regular**, even though both open from the en-route safety column. That weight difference is by design (a question is held, an instruction is asserted), not an inconsistency.

### 4.11 caption2Regular is ornamental

`caption2Regular` (11pt) sits below WCAG 1.4.4's 12pt floor for informational content. Use only for legal fine print, timestamps, copyright lines — anything informational uses `caption1Regular` (12pt) instead.

### 4.12 Dynamic Type for long-read copy

For multi-line paragraphs, narrative explanations, and stress-state guidance, wrap typography tokens in `dynamicType(...)` (scales fontSize + lineHeight) and optionally `relaxedLineHeight(...)` (sets line-height to 1.6× fontSize for stress reads).

Confirmed surfaces: `/pulled-over` guidance bullets, `RecommendationCard` curator quote.

Skip on headers/short labels constrained by layout — scaling can push fixed-position UI off-screen on Pro Max devices at maximum Dynamic Type.

### 4.13 MapKit marker tracksViewChanges lifecycle

Every custom `Marker` component subclass in this codebase ships with this pattern:

```tsx
const [tracking, setTracking] = useState(true);
useEffect(() => {
  const id = setTimeout(() => setTracking(false), 50);
  return () => clearTimeout(id);
}, []);
// ...
<Marker tracksViewChanges={tracking} ... />
```

**Why:** With `tracksViewChanges={false}` from t=0, MapKit snapshots the marker as a bitmap before the `react-native-svg` (or composed View) subtree finishes painting. Result: invisible/empty markers, or markers that disappear on zoom re-evaluation.

`setTimeout(0)` is **not** enough — fires before native paint commits. **50ms ≈ 3 frames** covers layout + paint + style commit on iOS and Android reliably.

LandmarkMarker re-snapshots when `selected` flips to capture the new scaled bitmap (clears `tracking` and re-runs the effect on dep change).

When introducing a new map-marker component, copy this pattern. Cluster markers in particular re-mount on every zoom step.

### 4.14 No silent abstraction premature

Rule of three (`.cursorrules` anti-slop check 3): don't extract a "reusable" abstraction until the same code has appeared inline three times. Premature abstraction is its own slop.

Likewise, **search before creating** (anti-slop check 1): before creating a new component, util, or constant, search `components/` / `theme/` / `lib/` for an existing one. If something close exists, extend rather than parallel.

---

## Section 5 — Where to find more

| Path | Purpose |
|---|---|
| [`.cursorrules`](../.cursorrules) | Design rulebook: color tokens, reserved-color rule, typography, tap-target rule, code conventions, anti-slop checks, out-of-scope items |
| [`docs/architecture.md`](architecture.md) | Project orientation: three-layer architecture (adapters / scoring / screens), tech stack, design rules, shipped-vs-deferred status |
| [`docs/workflow.md`](workflow.md) | Per-PR rhythm: Step 1–13 recipe covering branch → Figma fetch → scope → commit → audit → merge |
| [`docs/learnings.md`](learnings.md) | Running journal of decisions and gotchas, newest at top. Append per PR that taught something non-obvious |
| [`docs/next-session.md`](next-session.md) | Current punch list — open items grouped by visual fidelity, interaction polish, named rounds, accessibility |
| [`docs/figma-mockup-queue.md`](figma-mockup-queue.md) | Pending mockup queue for Figma sync |
| Figma file | `7DDh6c7tk7OKF4WiA7pEkp`, root canvas `825:3161` ("Flow tab"). Use Figma MCP server (`get_design_context`) to pull live nodes. The Figma file leads; this codebase follows. |
| `CLAUDE.md` (project root) | Agent orientation map pointing to all three rulebooks |
| `~/.claude/projects/-Users-mylesashitey-code-fresh-greens/memory/` | Per-session feedback memory: durable rules from past sessions, auto-loaded via `MEMORY.md` |

For a new component or surface, the typical entry sequence is:
1. Read `.cursorrules` (rules)
2. Read this doc (existing tokens + components)
3. Pull the Figma node via MCP (canonical visual)
4. Search `components/` for adjacency (anti-slop check 1)
5. Read `docs/learnings.md` for context on related past decisions




