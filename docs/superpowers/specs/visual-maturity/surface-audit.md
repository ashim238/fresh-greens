# Visual Maturity — Surface Audit

**Date:** 2026-06-23
**Spec:** [`../2026-06-23-visual-maturity-program-design.md`](../2026-06-23-visual-maturity-program-design.md)
**Status:** Phase 0 deliverable

Per-screen catalog of every surface that the Visual Maturity Program
will touch. Drives Phase 1 (material migration) and Phase 2 (polish)
sequencing. Each row names:

- **Surface** — the component or named element on the screen
- **Current** — what it renders as today (solid bg + token)
- **Tier** — the MaterialSurface tier it adopts in Phase 1 (or "no change")
- **Polish** — Phase 2 changes (SquircleIcon, gradient, density)
- **Motion** — Phase 3 candidates (hero or foundation only)

Tier vocabulary:
- `chrome` — over-map FABs, search bar, side-column controls
- `sheet` — bottom sheets and modal sheets (rise from bottom over map / page)
- `card` — inline cards on light-gray settings pages (decorative blur)
- `modal` — centered overlay cards over heavily-styled content (Lifeline, /emergency disc)
- `no change` — 3D map markers, polylines, and identity-bearing illustrations that should NOT migrate

Universe: the 25 screens from the [Design Health Program closeout](../phase-1-findings/2026-06-20-design-health-program-closeout.md) §1. The `app/index.tsx` welcome route and `app/dev-visual-maturity.tsx` smoke route are out of scope (welcome is brand-illustration chrome on a fixed-gradient backdrop, not map-overlay surfaces; smoke is a temporary verifier that the Phase 0 acceptance checklist requires removed before merge).

---

## /home (`app/home.tsx`)

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| FloatingActionButton — Menu (top-left) | colors.white + shadows.e2 | chrome | — | useSpringPress |
| FloatingActionButton — Avatar (top-right) | colors.white + shadows.e2 | chrome | — | useSpringPress |
| FloatingActionButton — Report (side column, when shown) | colors.white + shadows.e2 | chrome | — | useSpringPress |
| FloatingActionButton — Recenter (side column) | colors.white + shadows.e2 | chrome | — | useSpringPress |
| SearchBar (default state, over map) | colors.white + shadows.e2 | chrome | — | — |
| HomeBrowseSheet | colors.white + shadows.sheet | sheet | density regularization (8/16/24/32 sweep), staggered recommendation cards | sheet spring rise; staggered list mount (50ms cascade, `settle`) |
| ReportDetailCard | colors.white + shadows.sheet | sheet | SquircleIcon header (replaces inline iconWrap with BgSvg + GlyphForCategory composition) | sheet spring rise |
| ZoneDetailCard | colors.white + shadows.sheet | sheet | density regularization | sheet spring rise |
| RouteHazardDetailCard | colors.white + shadows.sheet | sheet | SquircleIcon header | sheet spring rise |
| RouteComparisonSheet | colors.white + shadows.sheet | sheet | density regularization | sheet spring rise |
| FuelStopsSheet | colors.white + shadows.sheet | sheet | density regularization | sheet spring rise |
| LiveSafetySheet (embedded when share session active) | colors.white + shadows.sheet | sheet | density regularization | sheet spring rise |
| LifelineModal (rendered when triggered) | colors.white + scrim | modal | — | — |
| Daylight-key gradient legend (sun/moon glyphs) | LinearGradient + colors.white card | card? | — | — |
| EdgeIndicator (off-screen marker chip) | colors.white circle + colors-coded polygon | no change ¹ | — | — |
| Placement-mode confirm bar (when adding a saved place) | colors.white + shadows.sheet | sheet | unify with painted-X dismissal convention (Phase 2 carryover from Design Health) | sheet spring rise |
| LandmarkMarker (community report pins) | composed pin + bg + glyph SVGs | no change | replace inner bg+glyph with SquircleIcon — **NO**, marker keeps teardrop shape (SquircleIcon is for flat-card use only) | marker drop-in cascade (hero) |
| Route polyline (selected route) | daylight gradient | no change | — | route line draws on (hero) |
| Trusted-friend marker (when location update incoming) | TrustedFriendMarker SVG (via UserLocationMarker variant) | no change | — | trusted-friend trail afterglow (hero) |
| Destination marker | DestinationMarker SVG | no change | — | — |
| User location marker | UserLocationMarker SVG + halo | no change | — | — |
| Cluster marker (zoomed out) | ClusterMarker SVG + count badge | no change | — | — |
| Saved-place bookmark marker | SavedPlaceBookmark SVG | no change | — | — |
| Zone polygons | colored Polygon fills + dash patterns | no change | — | — |

¹ EdgeIndicator wraps a polygon arrow + a small floating chip. The chip surface itself is candidate for `chrome` tier, but its motion (rotation tracking the off-screen marker bearing) and tight size budget argue against a translucent material wrapper. Phase 1 design question.

---

## /en-route (`app/en-route.tsx`)

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| FloatingActionButton — SOS (side column) | colors.white + shadows.e2 | chrome | — | useSpringPress |
| FloatingActionButton — Safety/Shield (side column) | colors.white + shadows.e2 | chrome | — | useSpringPress |
| FloatingActionButton — Recenter (side column) | colors.white + shadows.e2 | chrome | — | useSpringPress |
| FloatingActionButton — Report (side column) | colors.white + shadows.e2 | chrome | — | useSpringPress |
| FloatingActionButton — Help/Question coach FAB | colors.white + shadows.e2 | chrome | — | useSpringPress |
| FloatingActionButton — Volume (side column) | colors.white + shadows.e2 | chrome | — | useSpringPress |
| ETA pill / status chip | colors.white + shadows.e2 | chrome | — | — |
| LaneStrip (top-of-screen lane guidance host) | colors.white + shadows.e2 | chrome | density regularization (11pt coach labels — Dynamic Type carryover) | — |
| EnRouteZone overlay (entering zone banner) | colors.white | card ² | density regularization | — |
| ReportDetailCard (when tapping a marker en-route) | colors.white + shadows.sheet | sheet | SquircleIcon header | sheet spring rise |
| RouteComparisonSheet (re-route prompt) | colors.white + shadows.sheet | sheet | density regularization | sheet spring rise |
| FuelStopsSheet (mid-route refuel) | colors.white + shadows.sheet | sheet | density regularization | sheet spring rise |
| LiveSafetySheet (when share session active) | colors.white + shadows.sheet | sheet | density regularization | sheet spring rise |
| Hazard tile (in-stream upcoming-hazard badge) | colors.white + colors-coded chip | chrome? | — | — |
| Off-route recovery banner / disconnect chip | colors.white + shadows.e2 | chrome | — | — |
| EnRouteCarMarker | composed SVG | no change | — | — |
| LandmarkMarker (en-route render of community pins) | composed pin + bg + glyph SVGs | no change | — | marker drop-in cascade (hero, on first paint of route) |
| Route polyline | daylight gradient | no change | — | route line draws on (hero) |
| Daylight-arrival pill (sun/moon) | colors.white + shadows.e2 | chrome | — | — |

² EnRouteZone is a card-sized overlay that floats over the map (not a sheet from the bottom). It reads as map-chrome more than a flat-card surface — Phase 1 design question whether `chrome` (lighter blur) fits better than `card` (decorative blur).

---

## /safety (`app/safety.tsx`)

Modal slide-up over /home or /en-route via `presentation: 'modal'`.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Modal shell (DragHandle + tile grid + SOS bar) | colors.white + shadows.sheet (rounded top) | sheet | density regularization | sheet spring rise |
| Safety tile (Pulled-over, Roadside, Unfamiliar, Share location) | colors.white tile + colored SVG | no change ³ | — | useSpringPress |
| SOS bar (bottom of modal, opens /emergency) | colors.white row + red Asterisk | no change ³ | — | useSpringPress |
| DragHandle (decorative) | grey pill | no change | — | — |

³ The four tiles use bundled bespoke SVGs (blue siren, pipe wrench, red-diamond compass, share-network + green pin) — these are illustration-grade, not the squircle-icon pattern. Leave as-is. The tiles sit on the modal sheet surface; their interior fill stays solid white so the illustrations read cleanly.

---

## /safety-settings (`app/safety-settings.tsx`)

Settings register — SettingsHeader chrome over grouped-gray page; one RowGroup of three rows.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| SettingsHeader (back + close chrome) | colors.white card + chevron | chrome ⁴ | — | useSpringPress (on back + close Pressables) |
| Grouped-gray page background | colors.fillsTertiary | no change | — | — |
| RowGroup card (3 rows: Emergency SOS, Trusted Contact, Recordings) | colors.white + radii.md | card | — | useSpringPress (on each SettingsRow) |
| SettingsRow — Emergency SOS (red Asterisk in iconWrap) | colors.white row + Phosphor Asterisk | card | — | useSpringPress |
| SettingsRow — Trusted Contact (UserCircle in iconWrap) | colors.white row + Phosphor UserCircle | card | — | useSpringPress |
| SettingsRow — Recordings (Microphone in iconWrap) | colors.white row + Phosphor Microphone | card | — | useSpringPress |

⁴ Settings headers live on a grouped-gray page (NOT the map). The `chrome` tier's blur is functional over the map; over a static gray page it's decorative. Tier choice may collapse to `card` or no-change depending on how SettingsHeader gets parameterized. Phase 1 design question.

> Note: the Design Health Program closeout's "settings-screen visual changes" callout in `2026-06-23-visual-maturity-program-design.md` Out-of-scope says "it already uses the iOS native register cleanly — leave it alone." That guards against substantive settings redesign. SquircleIcon and useSpringPress are out-of-scope-for-settings-redesign but in-scope for the cross-cutting polish primitives — they touch the components, not the settings register itself.

---

## /pulled-over (`app/pulled-over.tsx`)

Consolidated modal state-machine: armed → transition → guidance → contact → review.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Modal shell (full pulled-over flow) | colors.white + rounded top | sheet | density regularization, add visible-lock affordance on DragHandle when `hasActiveRecording` (Design Health carryover P0) | sheet spring rise |
| DragHandle | grey pill | no change | — | — |
| RecordingSaveErrorBanner (when recording save fails) | colors.white + red border + iconWrap | card? | replace iconWrap circle-glyph with SquircleIcon report variant | — |
| TrustedContactStatus footer | colors.white + shadows.e2 | card | — | — |
| Phone/ChatCircle CTA pair (contact phase) | colors.white + button styles | no change ⁵ | — | useSpringPress |
| Stop-recording button | colors.white at 44pt | no change ⁵ | — | useSpringPress |
| TrooperHatBadge illustration | bespoke SVG | no change | — | — |

⁵ The pulled-over flow's CTAs sit inside the sheet body — they are not over-map chrome and don't need a separate material tier. They consume the sheet's surface as background. The CTA `Pressable` itself picks up useSpringPress for the press-down spring.

---

## /recordings (`app/recordings.tsx`)

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Header chrome (back chevron + title) | colors.white | chrome ⁴ | — | useSpringPress |
| Page background (grouped-gray) | colors.fillsTertiary | no change | — | — |
| Recording row card | colors.white card | card | — | useSpringPress |
| Play/Pause button (freshgreen circle + Phosphor Play/Pause) | freshgreen circle (1000 radius) + white glyph | no change ⁶ | — | useSpringPress |
| Share Pressable (Phosphor Share, per-row) | colors.white + 44pt hit | no change ⁶ | — | useSpringPress |
| Trash Pressable (Phosphor Trash, per-row) | colors.white + red glyph | no change ⁶ | — | useSpringPress |
| Empty state card (StateCard EmptyState) | colors.white + Microphone in iconWrap | card | replace StateCard iconWrap circle-glyph with SquircleIcon (positive variant) | — |
| Destructive-confirm Modal (in-app Modal for delete-all / single delete) | colors.white card + scrim | modal | — | — |
| SafetyErrorMessage (above primary Button) | colors.white + red border + iconWrap | card | — | — |
| "Delete all recordings" Primary Button | wiltedgreen fill | no change | — | useSpringPress |

⁶ The per-row Play/Share/Trash affordances are inline buttons inside the recording row card. They inherit the row's surface and don't get their own material tier — the row is the card-tier carrier.

---

## /share-location (`app/share-location.tsx`)

Modal page-sheet, single step (reason picker) OR active-session view.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Modal shell | colors.white + rounded top | sheet | density regularization | sheet spring rise |
| DragHandle | grey pill | no change | — | — |
| Reason picker card (4 reason options) | colors.white card | card | — | useSpringPress |
| Active session card (with End-sharing CTA + NotifyingPulse) | colors.white card | card | — | useSpringPress |
| NotifyingPulse | freshgreen radial pulse | no change | — | trusted-friend trail afterglow (hero, sibling concept) |

---

## /unfamiliar (`app/unfamiliar.tsx`)

Modal page-sheet, three-step (problem → destination → active).

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Modal shell | colors.white + rounded top | sheet | density regularization | sheet spring rise |
| DragHandle | grey pill | no change | — | — |
| Problem picker card (3 problem options) | colors.white card | card | — | useSpringPress |
| Destination picker card (3 destination options w/ iconCircle) | colors.white card + freshgreen iconCircle | card | replace iconCircle (white circle with Phosphor Lightbulb/GasPump/RoadHorizon) with SquircleIcon (positive variant) | useSpringPress |
| Active session card (with End-sharing CTA + NotifyingPulse) | colors.white card | card | — | useSpringPress |
| LifelineModal (when Lifeline is invoked from this flow) | colors.white card + scrim | modal | — | — |

---

## /roadside (`app/roadside.tsx`)

Modal page-sheet with internal state machine: problem → action → status. **Six** instances of `iconCircle` pattern in the file — the densest SquircleIcon migration target.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Modal shell | colors.white + rounded top | sheet | density regularization | sheet spring rise |
| DragHandle | grey pill | no change | — | — |
| Step 1 problem-picker row (iconCircle + label, 5 problems) | colors.white row + freshgreen iconCircle + Phosphor problem icon | card | replace iconCircle with SquircleIcon (positive variant) | useSpringPress |
| Step 2 action-detail card (iconCircle headers, 4 contexts: tow row, share toggle, alert toggle, etc.) | colors.white card + iconCircle | card | replace iconCircle with SquircleIcon (positive variant) | useSpringPress |
| Step 3 status card (iconCircle on confirmation) | colors.white card + iconCircle | card | replace iconCircle with SquircleIcon (positive variant) | useSpringPress |
| Wrong-spot Modal (X dismiss + edit form) | colors.white + scrim | modal | — | — |
| SOS row (at bottom of Step 3 status) | colors.white row + red Asterisk | card | — | useSpringPress |

---

## /zone-preferences (`app/zone-preferences.tsx`)

Settings register — SettingsHeader chrome over grouped-gray page; two RowGroups of toggle rows.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| SettingsHeader | colors.white card + chevron + close | chrome ⁴ | — | useSpringPress |
| Grouped-gray page background | colors.fillsTertiary | no change | — | — |
| RowGroup 1 — Show zones overlay (single toggle) | colors.white + radii.md | card | — | useSpringPress |
| RowGroup 2 — "What we flag" (3 toggles + footer caption) | colors.white + radii.md | card | density regularization (footer caption spacing) | useSpringPress |
| Switch component (RN core) | RN system switch | no change | — | — |

---

## /fuel (`app/fuel.tsx`)

Settings register — SettingsHeader chrome over grouped-gray page; multiple RowGroups (fuel-type picker, range bucket picker, etc.).

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| SettingsHeader | colors.white card + chevron | chrome ⁴ | — | useSpringPress |
| Grouped-gray page background | colors.fillsTertiary | no change | — | — |
| Fuel-type pill row (Gas/Diesel/Hybrid/Electric, Phosphor icons) | colors.white pill + freshgreen border when selected | no change ⁷ | reserved-color carryover: `fillBtn` borders still use freshgreen (Design Health P2) | useSpringPress |
| Range-bucket card (vehicle-class label + miles) | colors.white card | card | — | useSpringPress |
| Plus/Minus stepper for days-between-refuel | colors.white | card | — | useSpringPress |
| TextInput for custom range | colors.white card | card | — | — |

⁷ The pill-shaped picker uses an inline `freshgreen` border on selected — preserved per the Design Health closeout's reserved-color discipline carryover.

---

## /trip-summary (`app/trip-summary.tsx`)

Pop-up modal on arrival. Hosts inference-validation loop + route-disposition actions.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Modal shell | colors.white + rounded top | sheet | density regularization | sheet spring rise |
| DragHandle | grey pill | no change | — | — |
| Inference-validation card (per-zone confirm/dismiss row) | colors.white card | card | — | useSpringPress |
| Per-zone Check/X Pressables | colors.white + Phosphor Check/X | card | — | useSpringPress |
| "Set as default" Primary Button (fill) | wiltedgreen fill | no change | reserved-color carryover: `inferenceBtnAccept` still wiltedgreen (Design Health P1) | useSpringPress |
| "Keep current route" Secondary Button (outline) | wiltedgreen outline | no change | — | useSpringPress |

---

## /legal (`app/legal.tsx`)

Settings register — SettingsHeader chrome over grouped-gray page; sticky tab pill row + white card with body copy.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| SettingsHeader | colors.white card + chevron | chrome ⁴ | — | useSpringPress |
| Grouped-gray page background | colors.fillsTertiary | no change | — | — |
| Sticky tab pill row (Privacy / Terms / Limitations) | colors.white + active pill in freshgreen | chrome ⁸ | — | useSpringPress |
| Legal-body card (one per section, anchored) | colors.white card | card | — | — |

⁸ The sticky tab row sits over the scrolling body — it has the same "translucent chrome over scrolling content" relationship that the map FABs have over the map. `chrome` tier candidate, but it's over a static gray page, not the map. Phase 1 design question — may collapse to a solid pill row with the new hairline border treatment.

---

## /menu (`app/menu.tsx`)

Settings hub root — SettingsHeader (large) over grouped-gray page; profile card + carousel tiles + multiple RowGroups.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| SettingsHeader (`large` variant: big title + Gear + close) | colors.white + Gear icon | chrome ⁴ | — | useSpringPress |
| Grouped-gray page background | colors.fillsTertiary | no change | — | — |
| Profile card (avatar + "Hey there, {name}") | colors.white card | card | — | — |
| Carousel tile — "Set up refuel reminders" (Map guide row, etc.) | colors.white tile + Phosphor icon in tileIcon | card | replace tileIcon circle pattern with SquircleIcon (positive variant) for the in-product affordances | useSpringPress |
| RowGroup — settings rows (Safety, Zone Preferences, Saved places, Fuel, Calendar, Legal, Help) | colors.white + radii.md | card | — | useSpringPress |
| SettingsRow with Phosphor icon (iconWrap pattern, e.g. Bookmark, GasPump, Shield) | colors.white row + Phosphor glyph | card | — ⁹ | useSpringPress |
| Sign-out row (destructive-red label, Exception #11) | colors.white + red label | no change | — | useSpringPress |

⁹ SettingsRow's iconWrap is a 24pt slot for a Phosphor icon — it's NOT a circle-bg-with-glyph composition (no rounded background fill). The SquircleIcon migration targets composed icon-on-circle patterns; SettingsRow's iconWrap is a plain icon slot and stays as-is.

---

## /saved-places (`app/saved-places.tsx`)

Settings register — SettingsHeader chrome over grouped-gray page; RowGroup of saved-place rows with per-row Trash.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| SettingsHeader | colors.white card + chevron | chrome ⁴ | — | useSpringPress |
| Grouped-gray page background | colors.fillsTertiary | no change | — | — |
| RowGroup — saved-place rows | colors.white + radii.md | card | — | useSpringPress |
| SettingsRow with House/MapPin Phosphor icon | colors.white row + Phosphor glyph | card | — ⁹ | useSpringPress |
| Per-row Trash Pressable (destructive) | colors.white + red Trash | no change | — | useSpringPress |
| Empty state | StateCard EmptyState pattern | card | replace StateCard iconWrap circle-glyph with SquircleIcon | — |

---

## /emergency (`app/emergency.tsx`)

Centered transparent-modal card over /en-route or /safety. Two states: idle and countdown.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Centered idle card (Asterisk + "Need help?" + 2 buttons + X) | colors.white card + scrim (20% black) | modal | — | — |
| Centered countdown card (red disc + numeral + X "Stop") | colors.white card + scrim | modal | — | SOS countdown pulse (hero — disc breathes 1.0→1.04→1.0 each second) |
| Asterisk header glyph (red) | Phosphor Asterisk | no change | — | — |
| Call [Trusted Contact] Button (fill) | wiltedgreen fill | no change | — | useSpringPress |
| Call 911 Button | red fill (reserved alert) | no change | — | useSpringPress |
| Close X Pressable | colors.white + Phosphor X | no change | — | useSpringPress |
| Scrim (20% black, taps pass through to the X) | rgba(0,0,0,0.20) | no change | — | — |

---

## /permissions (`app/permissions.tsx`)

Onboarding step 4 of 5. Brand-dark background with pager dots + illustration + Continue button.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Page background (brand-dark / wiltedgreen) | colors.wiltedgreen | no change | — | — |
| Permissions illustration (location pin + car SVGs) | bespoke SVGs | no change | — | — |
| Primary "Continue" Button (fill) | wiltedgreen fill | no change | — | useSpringPress |
| Recovery footnote-link Pressable (when iOS won't re-prompt) | colors.white + underline | no change | — | useSpringPress |
| PageControl (5 dots) | small dots, current freshgreen | no change | — | — |

> No translucent-material surfaces on onboarding — the brand-dark backdrop is the visual register and stays as-is. Polish here is purely useSpringPress on the Pressables.

---

## /onboarding (`app/onboarding.tsx`)

Three swipeable panels on a brand-dark backdrop. Same register as /permissions.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Page background (brand-dark / wiltedgreen) | colors.wiltedgreen | no change | — | — |
| Panel illustration SVGs (3 layered illustrations) | bespoke SVGs | no change | — | — |
| Title / body Text | typography.title1 / .body | no change | — | — |
| Primary "Continue" Button (fill, advances pager OR routes to /permissions on last panel) | wiltedgreen fill | no change | — | useSpringPress |
| PageControl (5 dots) | small dots | no change | — | — |

---

## /sign-out (`app/sign-out.tsx`)

Brand-dark farewell screen. Goodbye copy + illustration + "Log back in" Button.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Page background (brand-dark / wiltedgreen) | colors.wiltedgreen | no change | — | — |
| Illustration (location pin + car SVGs) | bespoke SVGs | no change | — | — |
| "You've been logged out." / "Drive safe." Text | typography.title1 / .footnote | no change | — | — |
| "Log back in" Primary Button (fill) | wiltedgreen fill | no change | — | useSpringPress |

---

## /trusted-contact-setup (`app/trusted-contact-setup.tsx`)

Two-state screen: empty (pick a contact) or preview (avatar + Continue). Visual register flips dark/light based on `from` query param (onboarding=dark, in-app=light).

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Page background — onboarding mode | colors.wiltedgreen | no change | — | — |
| Page background — in-app mode | colors.white | no change | — | — |
| Empty-state card (UserPlus glyph + CTA + Skip option) | StateCard EmptyState pattern | card | replace StateCard iconWrap circle-glyph with SquircleIcon (positive variant) | — |
| Preview card (avatar + contact name + Continue) | colors.white card | card | — | useSpringPress |
| Header back Pressable (when in-app mode) | colors.white + CaretLeft | chrome ⁴ | — | useSpringPress |
| "Pick a contact" Primary Button | freshgreen fill | no change | — | useSpringPress |
| "Skip" Pressable (when in onboarding) | text-only | no change | — | — |
| PageControl (5 dots, when in onboarding) | small dots | no change | — | — |

---

## /report (`app/report.tsx`)

Modal page-sheet, two views (Category picker grid, Detail form).

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Modal shell | colors.white + rounded top | sheet | density regularization | sheet spring rise |
| DragHandle | grey pill | no change | — | — |
| Header X (close) | colors.white + Phosphor X | no change | — | useSpringPress |
| Picker grid (3 rows × 2 tiles, 6 categories) — `tileIconBox` wraps CategoryGlyph at 48pt | colors.white tile + glyph-on-background composition (CategoryGlyph renders BgSvg + GlyphForCategory) | card | **replace tileIconBox CategoryGlyph composition with SquircleIcon** at size 48 — this is the canonical SquircleIcon target site | useSpringPress |
| Detail-view form card | colors.white card | card | — | — |
| Detail-view header back chevron + close X | colors.white + Phosphor | no change | — | useSpringPress |
| Photo-attach Pressable / preview | colors.white card + Camera glyph | card | — | useSpringPress |
| SafetyErrorMessage (submit failed) | colors.white + red border + iconWrap | card | — | — |
| Submit Button (primary fill) | wiltedgreen | no change | — | useSpringPress |
| Sub-tag chip row (the deferred multi-select round; not yet shipped) | n/a | n/a | sequence after Visual Maturity (per spec Adjacent work note) | — |

---

## /search (`app/search.tsx`)

Five-state machine (landing / typing / loading / results / error). Sits on a static white page (no map underneath).

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| SearchBar (active, typing state) | colors.white + shadows.e2 | chrome ⁸ | — | — |
| Page background | colors.white | no change | — | — |
| Quick Tools row (Saved / Food / Gas / Parking, illustration tiles) | bespoke illustration SVGs over colors.white | no change | — | useSpringPress |
| Fuel section card (preferred stations + fuel CTA) | colors.white card | card | — | useSpringPress |
| Recent searches list (rows with Clock icon) | colors.white rows | card | — | useSpringPress |
| Saved-places list (rows with PreferredStar / SavedPlaceBookmark) | colors.white rows | card | — | useSpringPress |
| Upcoming destinations list (Calendar) | colors.white rows | card | — | useSpringPress |
| Results list (POI rows with MapPin) | colors.white rows | card | — | useSpringPress |
| LoadingState / ErrorState (StateCard variants) | colors.white card + iconWrap | card | replace StateCard iconWrap circle-glyph with SquircleIcon | — |
| CalendarPickSheet (when present) | colors.white + shadows.sheet | sheet | density regularization | sheet spring rise |

---

## /roadside-setup (`app/roadside-setup.tsx`)

Settings-modal pattern (chevron dismisses, no DragHandle). Captures service name + phone.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Header (back chevron + title) | colors.white + CaretLeft | chrome ⁴ | — | useSpringPress |
| Page background (grouped-gray) | colors.fillsTertiary | no change | — | — |
| Form card (Name TextInput + Phone TextInput) | colors.white card | card | — | — |
| Save Button (Primary fill) | wiltedgreen | no change | — | useSpringPress |

---

## /login (`app/login.tsx`)

Returning-user auth entry. Same visual register as /get-started.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Page background (wiltedgreen sky over burntgreen ground) | brand gradient | no change | — | — |
| Welcome illustration cluster | bespoke SVGs (clouds + sun + hill) | no change | — | — |
| "Sign in with Apple" Button | colors.black + LogoApple SVG | no change | — | useSpringPress |
| "Don't have an account? Sign up" link Pressable | colors.white + underline | no change | — | useSpringPress |
| Error toast/inline (when sign-in fails) | colors.white + red text | no change | — | — |

---

## /get-started (`app/get-started.tsx`)

First-time-user auth entry. Same visual register as /login.

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Page background (wiltedgreen sky over burntgreen ground) | brand gradient | no change | — | — |
| Welcome illustration cluster | bespoke SVGs (clouds + sun + hill) | no change | — | — |
| "Sign in with Apple" Button | colors.black + LogoApple SVG | no change | — | useSpringPress |
| "Already have an account? Log in" link Pressable | colors.white + underline | no change | — | useSpringPress |
| Error toast/inline (when sign-in fails) | colors.white + red text | no change | — | — |

---

## Summary counts

After filling: every distinct surface across the 25 screens, grouped by tier. Reuse (same component on multiple screens) is counted ONCE per screen-instance, since each occurrence needs its own migration verification.

| Tier | Count | Phase 1 sizing note |
|---|---|---|
| chrome | 30 | Mostly FABs (top-row + side-column) on /home and /en-route; SettingsHeader chrome on every settings screen; SearchBar instances. Single PR can cover FloatingActionButton + SearchBar primitives — every consumer picks up the change for free. |
| sheet | 19 | Bottom sheets and modal sheets. Group by component for PR rhythm: ReportDetailCard/ZoneDetailCard/RouteHazardDetailCard (one PR), HomeBrowseSheet (one PR), Route/Fuel/CalendarPick sheets (one PR), modal-shell screens (pulled-over, roadside, unfamiliar, share-location, trip-summary, report — one PR each or grouped). |
| card | 36 | Settings-page cards (RowGroup, SettingsRow), inline form cards, picker cards, StateCard variants, list rows. The decorative-blur layer. Heaviest count; lowest blast radius per instance. |
| modal | 5 | LifelineModal (on /home + /unfamiliar = 2 instances), in-app destructive-confirm Modal on /recordings, wrong-spot Modal on /roadside, /emergency idle + countdown cards. |
| no change | 47 | 3D map markers (LandmarkMarker, EnRouteCarMarker, ClusterMarker, UserLocationMarker, DestinationMarker, SavedPlaceBookmark, trusted-friend marker, FuelStopMarker), polylines, zone polygons, bespoke illustrations (onboarding panels, welcome scene, safety tiles, permissions illustrations, sign-out farewell illustration), brand-dark page backgrounds, color-reserved buttons (Primary fill, destructive Trash), inline RN system widgets (Switch, TextInput), and decorative grey pills (DragHandle). |

(Counts approximate — surfaces that occur on multiple screens are counted per-screen-instance; the migration work scales with PR count, not unique-component count, and most of the cost is borne by 4 primitives: FloatingActionButton, SearchBar, the sheet wrappers, and SettingsHeader.)

---

## SquircleIcon migration sites

Every site currently rendering the circle-bg-with-glyph pattern that SquircleIcon replaces in Phase 2. Grounded in `rg "iconCircle\|tileIconBox\|tileIcon\|iconWrap"` results across `app/` + `components/`.

**High-confidence migration targets** (composed circle-bg + glyph, exactly the SquircleIcon use case):

1. **`app/report.tsx:459`** — `tileIconBox` in the category-picker grid. CategoryGlyph (BgSvg + GlyphForCategory composition) at size 48. **The canonical SquircleIcon site** — this is the surface the spec explicitly names.
2. **`components/ReportDetailCard.tsx:199`** — `iconWrap` in the symmetric header. BgSvg + GlyphForCategory composition at 36pt. Replace with SquircleIcon variant (positive / report / black-owned based on `categoryId`).
3. **`app/unfamiliar.tsx:343,528`** — `iconCircle` style on the destination picker tiles (Step 2). White circle + Phosphor Lightbulb/GasPump/RoadHorizon. Replace with SquircleIcon (positive variant).
4. **`app/roadside.tsx:270,403,422,438,457,549,755`** — `iconCircle` style across Step 1 (problem picker, 5 problems with Tire/CarBattery/GasPump/Lock/Wrench), Step 2 (action contexts), and Step 3 (status confirmation). **Six sites in one file** — the densest migration. Replace each with SquircleIcon (positive variant).
5. **`components/StateCard.tsx:57,93,117,158`** — `iconWrap` in StateCard's LoadingState / ErrorState / EmptyState variants. Consumers: /recordings (empty), /trusted-contact-setup (empty), /search (loading + error), /saved-places (empty). Replace the iconWrap circle-glyph with SquircleIcon (positive variant) at the appropriate size. **One primitive edit propagates to ~6 consumer screens.**

**Skipped (NOT migration targets)** — surfaces grep matched but aren't the SquircleIcon pattern:

- **`components/FuelStopMarker.tsx:47-87`** — `iconCircle` / `iconCirclePreferred` / `iconCircleSelected`. This is a 3D map marker, not a flat-card icon. Stays solid; SquircleIcon is for flat-card use only.
- **`components/FloatingActionButton.tsx:104,76`** — `iconWrap` is a 24/32pt slot inside the FAB. No background fill of its own — it's just a centering wrapper for the FAB's children. Plain icon slot, stays as-is.
- **`components/Button.tsx:115,147`** — `iconWrap` is the left-of-label icon slot for a Button. Plain icon slot, stays as-is.
- **`components/SearchBar.tsx:141,148,218`** — `iconWrap` is the leading/trailing icon slot in the SearchBar pill (magnifying glass, mic). Plain icon slot, stays as-is.
- **`components/settings/SettingsRow.tsx:78,149`** — `iconWrap` is the 24pt slot for a Phosphor icon. NOT a circle-bg-with-glyph composition (no rounded background fill). Plain icon slot, stays as-is.
- **`components/RecordingSaveErrorBanner.tsx:47,87`** — `iconWrap` is the leading-icon slot in the banner. Plain icon slot, stays as-is.
- **`components/EdgeIndicator.tsx`** — `circle` is the rotating polygon component, not a flat icon. Stays as-is.

**Net SquircleIcon migration footprint:** 5 sites (`report.tsx` × 1, `ReportDetailCard.tsx` × 1, `unfamiliar.tsx` × 1, `roadside.tsx` × 6, `StateCard.tsx` × 1 primitive) — counted by file. By call-site, ~10 individual JSX replacements. By consumer-screen blast radius via StateCard alone: ~6 screens pick up the polish for free once the primitive is migrated.

---

## Hero motion target sites

1. **Route line draws on** — `app/home.tsx` `selectedRoute` polyline render (the `Polyline` component on the MapView). Polyline animates from origin to destination over 700ms using the daylight gradient on first paint. Implementation hint: react-native-maps' `Polyline` doesn't support animated stroke-dasharray; an SVG overlay sized to the route bounds is the prototype path. Same hero applies on `app/en-route.tsx` polyline (the user is already on this route — animate on re-route selection, not on mount).

2. **Marker drop-in cascade** — `app/home.tsx` `LandmarkMarker` render loop (community report pins). Each marker receives an `entranceIndex` prop; first-cohort mount staggers 50ms between pins with a bounce-free `settle` spring on `translateY`. Subsequent new-mounts (post-`addCommunityReport`) get index 0 (no stagger — they pop in instantly). Same component runs on `app/en-route.tsx` — cascade on en-route's first paint as the route reveals.

3. **SOS countdown pulse** — `app/emergency.tsx` countdown disc. The red disc breathes 1.0→1.04→1.0 each second synced to the countdown numeral tick. Spring loop driven by the existing countdown timer state. Adds emotional gravity; signals "the system is alive and counting."

4. **Trusted-friend trail afterglow** — `app/home.tsx` trusted-friend marker render (when the trusted-contact location update arrives via `useShareSession`). A soft freshgreen radial gradient afterglow (alpha 0.3 → 0) fades over the last known position for ~1.5s on each update. Costs almost nothing, communicates "we're keeping watch." Sibling concept on `app/en-route.tsx` `LiveSafetySheet` (trusted-friend pin renders there too while sharing is active).

Each hero respects `useReduceMotion()` and degrades to instant state-swaps.

---

## Open Phase 1 design questions

Marked with `?` or footnote markers above:

1. **EdgeIndicator chip tier** (¹) — material wrap on the off-screen marker chip vs. leave as-is. Tight size budget + rotation tracking argues against translucent material. Default: leave as-is until Phase 1 visual smoke.
2. **EnRouteZone tier** (²) — `chrome` (over-map register) vs `card` (decorative blur). Functionally it's over-map; visually it's a flat status card. Default: `card` with a Phase 1 design review.
3. **Safety tile interior surfaces** (³) — keep solid white tiles inside the modal sheet, or migrate the tiles themselves? Default: keep tiles solid; the modal sheet beneath them is what carries the material register.
4. **SettingsHeader tier** (⁴) — `chrome` works for "translucent header" semantics, but settings pages don't have a map underneath, so the blur is decorative. Default: `chrome` for consistency with map-context headers; revisit if the static-gray-page case reads as over-engineered. Same question for /legal's sticky tab row (⁸).
5. **Pulled-over CTA surface** (⁵) — embedded buttons inside a sheet inherit the sheet's surface; no separate tier. Confirmed default.
6. **Recordings row inline affordances** (⁶) — Play/Share/Trash inherit row surface; no separate tier. Confirmed default.
7. **Fuel pill selection border** (⁷) — `freshgreen` border on selected pills is a reserved-color carryover from Design Health (P2). Decide in Phase 2 whether the new SquircleIcon gradient pass also adjusts these.
8. **SettingsRow iconWrap polish** (⁹) — leave as plain icon slot, or upgrade selectively (e.g., the "Safety" row to use a squircle icon)? Default: leave as plain icon slot — settings register is explicitly out-of-scope for redesign per the program spec, and SettingsRow's iconWrap isn't the circle-bg-with-glyph pattern.

These resolve into Phase 1 PRs (the `chrome` / `sheet` / `card` / `modal` tier decisions) or Phase 2 PRs (the SquircleIcon-vs-leave decisions on settings-context surfaces).

---

## Cross-references

- **Phase 0 plan** — `docs/superpowers/plans/2026-06-23-visual-maturity-phase-0.md` (Task 11)
- **Program spec** — [`../2026-06-23-visual-maturity-program-design.md`](../2026-06-23-visual-maturity-program-design.md)
- **25-screen universe** — [`../phase-1-findings/2026-06-20-design-health-program-closeout.md`](../phase-1-findings/2026-06-20-design-health-program-closeout.md) §1
- **Reserved-color discipline carryovers** — same doc §2 (trip-summary `inferenceBtnAccept`, fuel pill `fillBtn` borders)
- **Dismissal/painted-X carryovers** — same doc §3.1 (pulled-over visible-lock affordance — folded into the pulled-over row above)
