# Next-session punch list

Post-`v1.0-thesis` iteration backlog, captured at the end of the thesis push (2026-05-13). Items roughly grouped by type. Each line is the user's note verbatim, lightly annotated with the file or pattern most likely to touch the fix.

## Supabase M1.1 — shipped

**Commits on `main`:**
- `174373c` — plain composite index replacing IMMUTABLE-rejected partial index
- `7edc1ca` — device-UUID, anon auth, community-cloud M1.1 wiring
- `6636bf5` — error-code UI, moderator role hook, `/moderation` route
- `2c534c5` — investigation panels (submitter history, nearby reports, flag breakdown)
- `c5f4c14` — ~~bulk mode~~ multi-select hide/remove for `/moderation` queue

**Blocked (Apple / Supabase config):** Apple Sign-in (requires Apple Developer Program), Phone OTP (Supabase SMS provider), moderator role bootstrap (manual `auth.users` update), M1.2 push notifications.

**Unblocked enhancements (remaining):** ~~bulk mode~~, push notifications (M1.2), transparency page.

## Pre-Supabase visual closure

**Gate:** ✅ **Met** (2026-06-25) — batch 5 merged **#270** (`9039edc`). Batches 1–4: #266–#269. Rollup: [`.impeccable/VISUAL-CLOSURE-SYNTHESIS.md`](../.impeccable/VISUAL-CLOSURE-SYNTHESIS.md). **0 open P0/P1** across audit, critique, and visual-pass. **Supabase M1.1 pivot cleared.**

> **Post-closure independent audit (2026-06-25, `fix/post-cursor-audit-followups`):** a fresh Opus pass over the batches found the gate's "0 P0/P1" wasn't quite true — two sub-44pt tap targets slipped through behind false "meets 44pt" comments (see [`docs/learnings.md`](learnings.md)). **Fixed:** `/en-route` sheet-toggle 36→44pt; `/report` photo-remove moved from a 40pt corner badge to a ≥44pt labeled row; `/roadside` WrongSpotModal error missing `accessibilityLiveRegion`; two hardcoded radii; a "Tap to" hint; a conflated label/hint; dead `gridGroupHeader` style; severity-chip `rgba()` → tokens. **Deferred (deliberate, not violations):** `/search` fuel-subtitle prose middot + dangling "on" (copy review, not a meta-row); `/search` result-row separator dims-on-press (cosmetic, restructure risk > benefit); two `/roadside` `Alert.alert` paths (valid native confirm / edge-error); `/share-location` non-interactive footer `minHeight` drift.
>
> **Then `/impeccable critique` + `/impeccable audit` (same branch):** audit 19/20; critique ~30/40 ("Good"), all four flow-groups PASS the calm-companion slop bar. **Honesty-of-disclosure cluster fixed** (Principle #4): CalendarPickSheet error-as-"No matches" → distinct error + retry; roadside "Locating…" no-terminal-state → 8s timeout fallback; stale `search` "visual-only" comment corrected. **Critique design findings — grilled to decisions (2026-06-25):** (1) **home route-card density → NO CHANGE** — grounding showed the dense rows are conditional, the 34pt is a deliberate Maps-convention anchor (H12), and Go is already the only filled CTA; the hierarchy is sound, the critique over-flagged. (2) **en-route 5 icon-only FABs → NO CHANGE** — labels already exist via the Guide coach-mark; persistent labels were smoke-tested (2026-06-21) and rejected as jarring; the symbols are universal. (3) **cross-flow consistency → fixed the real part** — back-placeholder set to 44 in share-location + roadside (stale 32 left after audit #10 bumped the chevron); card treatments kept role-appropriate (picker lifts, nav-row flat — deliberate, not debt); the roadside live-status `X` is a sanctioned top-right dismissal per `.cursorrules` ## Dismissal, kept as-is. (4) **emotional payoff → trusted-contact payoff line added; share-location "silent dismiss" → NO CHANGE** — the persistent `LiveSafetySheet` on home + en-route already carries active-session reassurance + global End-sharing. (5) **`/report` disabled-Submit → FIXED (A+)** — legible "Finding your location…" + terminal "Location needed to post this report" fallback (same hang-guard as roadside).

~~**Still open — WCAG 1.4.1 severity-chip color-only signaling**~~ — **resolved 2026-06-26 (`fix/severity-chip-a11y-cue`).** Added a 14pt filled `WarningDiamond` glyph before the chip label whenever the sub-tag carries a severity level (the existing hazard glyph from /home route-preview chips, kept consistent). Color tracks the existing chip-label hue (no new color information). VoiceOver labels gain "avoid-level"/"caution-level". Calm-by-design — no severity words on the chip, preserving the .cursorrules carve-out #12 intent. **Correction noted above (2026-06-26):** an earlier batch-with-daylight plan was wrong; daylight already shipped `DAYLIGHT_DASH_PATTERN` (`lib/daylight.ts`), so this was always the only real color-only gap.
>
> **On-device sweep (2026-06-26, iOS 26.3 sim):** verified via `simctl openurl` + screenshots — **home, /report picker, /trusted-contact-setup, /roadside, /share-location, /search** all render clean and on-brand; the safety-flow **title baselines now align** across roadside + share-location (the placeholder fix, visible), roadside **location resolved** ("Union Square, SF" — locating path healthy), and the SearchBar **embedded treatment** (flat tertiary, no shadow) is correct. **Not reachable by deep-link (need tap-driven state, computer-use was unresponsive):** /report *detail* view (photo-remove row + severity chips), /trusted-contact *filled* state (payoff line), /search reminders-*enabled* fuel copy, /en-route *active* sheet (the 36→44 toggle), CalendarPickSheet *error* state. These are tsc-clean, additive/low-risk — verify visually next time the app is driven through those sub-states.

*The route catalog, batching table, and three-pass checklist below are **historical reference** for how closure was executed — not an open work queue.*

**Closed with #264 + stroke follow-up:** Map marker identity-glyph strokes — situational white/black from #262 reverted; default identity glyphs use `MARKER_GLYPH_STROKE` (black). **Women-owned** uses saturated-fill treatment (`MARKER_GLYPH_STROKE_WOMEN_OWNED`, darker than `#FF2D55` fill). **Felt-welcome heart** keeps black stroke.

### Three passes (all screens)

| Pass | Command | Scope | Artifact |
| ---- | ------- | ----- | -------- |
| Technical audit | `/impeccable audit` | Every `app/**/*.tsx` route file + key `components/` (see below) | Audit scorecard per route (workflow §12c) |
| UX critique | `/impeccable critique` | Every hub + settings/onboarding/safety sub-flow | `.impeccable/critique/<timestamp>__<file>.md` |
| Optical layout | `/visual-pass round` | Full 13 categories (`.cursor/skills/visual-pass/SKILL.md` §Checklist) on exhaustive route list | `.impeccable/VISUAL-PASS-<YYYY-MM-DD>.md` |

**Key components** (audit all; visual-pass where meta/chips/sheets apply): `HomeBrowseSheet`, `LiveSafetySheet`, `RouteComparisonSheet`, `FuelStopsSheet`, `ReportDetailCard`, `RoadsideTowPick`, `LifelineModal`, `NotifyingPulse`, `MetaSeparator`, `DaylightRouteLegend`, `LandmarkMarker`, `EdgeIndicator`, `ClusterMarker`, `FuelStopMarker`, `EnRouteZone`, `settings/SettingsRow`, `settings/RowGroup`, `settings/SettingsHeader`, `SearchBar`, `Button`, `FloatingActionButton`, `StateCard`, `ZoneDetailCard`, `RouteHazardDetailCard`, `CalendarPickSheet`, `TrustedContactStatus`, `RecordingSaveErrorBanner`.

### Full `app/` route catalog (27 screens)

Expo-router file routes — flat `app/` tree (no nested route folders today). Each row is one auditable screen; presentation from `app/_layout.tsx`.

| # | Route | File | Presentation | Flow |
| - | ----- | ---- | ------------ | ---- |
| 1 | `/` | `app/index.tsx` | stack | Welcome / brand splash |
| 2 | `/get-started` | `app/get-started.tsx` | stack | Onboarding entry |
| 3 | `/onboarding` | `app/onboarding.tsx` | stack | Onboarding pager |
| 4 | `/login` | `app/login.tsx` | stack | Auth |
| 5 | `/permissions` | `app/permissions.tsx` | stack | Location permission |
| 6 | `/home` | `app/home.tsx` | stack | Primary map hub |
| 7 | `/search` | `app/search.tsx` | stack | Destination search |
| 8 | `/en-route` | `app/en-route.tsx` | stack | Live navigation hub |
| 9 | `/report` | `app/report.tsx` | transparentModal | Community report overlay |
| 10 | `/trip-summary` | `app/trip-summary.tsx` | modal | Post-trip recap |
| 11 | `/fuel` | `app/fuel.tsx` | stack | Vehicle / fuel settings |
| 12 | `/safety` | `app/safety.tsx` | modal | Safety toolkit picker |
| 13 | `/emergency` | `app/emergency.tsx` | transparentModal | SOS countdown overlay |
| 14 | `/pulled-over` | `app/pulled-over.tsx` | modal | Pulled-over state machine |
| 15 | `/share-location` | `app/share-location.tsx` | modal | Proactive share sub-flow |
| 16 | `/unfamiliar` | `app/unfamiliar.tsx` | modal | Unfamiliar-area sub-flow |
| 17 | `/roadside` | `app/roadside.tsx` | modal | Roadside assistance sub-flow |
| 18 | `/menu` | `app/menu.tsx` | stack | Settings hub |
| 19 | `/safety-settings` | `app/safety-settings.tsx` | stack | Safety preferences |
| 20 | `/zone-preferences` | `app/zone-preferences.tsx` | stack | Hazard-zone toggles |
| 21 | `/trusted-contact-setup` | `app/trusted-contact-setup.tsx` | stack | Lifeline contact setup |
| 22 | `/roadside-setup` | `app/roadside-setup.tsx` | modal | Roadside service setup |
| 23 | `/insurance-setup` | `app/insurance-setup.tsx` | stack | Insurance card / OCR |
| 24 | `/saved-places` | `app/saved-places.tsx` | stack | Saved places list |
| 25 | `/recordings` | `app/recordings.tsx` | stack | Pulled-over recordings |
| 26 | `/sign-out` | `app/sign-out.tsx` | stack | Sign-out confirmation |
| 27 | `/legal` | `app/legal.tsx` | stack | Privacy / terms |

**Shell only (skip three-pass UI audit):** `app/_layout.tsx` — root `Stack` + modal presentation options.

**Sub-flow note:** Modal routes (`/safety`, `/pulled-over`, `/share-location`, `/unfamiliar`, `/roadside`, `/roadside-setup`, `/trip-summary`) and transparent overlays (`/report`, `/emergency`) are first-class screens — not children of hub files — and each gets its own audit/critique/visual-pass pass.

### Suggested batching (5 PRs — every screen assigned)

| PR | Branch theme | Routes (all `app/*.tsx` in batch) | Components |
| -- | ------------ | --------------------------------- | ---------- |
| 1 | `chore/visual-closure-map-hubs` | `/home`, `/search`, `/en-route`, `/report`, `/trip-summary`, `/fuel` | `HomeBrowseSheet`, `RouteComparisonSheet`, `FuelStopsSheet`, `LandmarkMarker`, `EdgeIndicator`, `ClusterMarker`, `FuelStopMarker`, `EnRouteZone`, `DaylightRouteLegend`, `ZoneDetailCard`, `RouteHazardDetailCard` |
| 2 | `chore/visual-closure-safety` | `/safety`, `/emergency`, `/pulled-over`, `/share-location`, `/unfamiliar`, `/roadside` | `RoadsideTowPick`, `LiveSafetySheet`, `LifelineModal`, `NotifyingPulse`, `RecordingSaveErrorBanner`, `TrustedContactStatus` |
| 3 | `chore/visual-closure-settings` | `/menu`, `/safety-settings`, `/zone-preferences`, `/trusted-contact-setup`, `/roadside-setup`, `/insurance-setup`, `/saved-places`, `/recordings`, `/sign-out`, `/legal` | `settings/SettingsRow`, `settings/RowGroup`, `settings/SettingsHeader`, `ReportDetailCard`, `PreferredStar`, `CalendarPickSheet` |
| 4 | `chore/visual-closure-onboarding` | `/`, `/get-started`, `/onboarding`, `/login`, `/permissions` | `PageControl`, `Button`, `StateCard` |
| 5 | `chore/visual-closure-synthesis` | Cross-cutting P0/P1 from batches 1–4; re-spot-check any shared component touched in multiple batches | `MetaSeparator`, `SearchBar`, `FloatingActionButton`, `DragHandle` + synthesis doc |

**Coverage check:** 6 + 6 + 10 + 5 = **27 screens** (matches route catalog). `_layout.tsx` reviewed only for presentation consistency in batch 5 if needed.

Each PR: run all three passes on its routes → fix-forward P0/P1 → `npx tsc --noEmit` → append learnings.

### Success criteria

- ~~**Zero open P0 or P1** across audit, critique, and visual-pass findings before Supabase M1.1~~ — ✅ met batch 5 synthesis (0/0)
- ~~P2/P3 logged in this file or synthesis doc with explicit defer rationale~~ — ✅ `.impeccable/VISUAL-CLOSURE-SYNTHESIS.md` §P2/P3
- ~~Snapshot trail complete: critique files per route, visual-pass synthesis dated, audit scorecards archived~~ — ✅ batches 1–4 + prior VISUAL-PASS rounds
- ~~`npx tsc --noEmit` clean on `main` after synthesis PR merge~~ — ✅ verified on synthesis branch

### Visual-pass round checklist (13 categories)

Meta separators · mixed-weight rhythm · flex gap vs optical spacing · label/value rows · multi-part meta rows · chip/pill padding · sheet title blocks · list row density · truncation balance · icon+text rows · map-overlay padding · modal prompt typography · search bar contextual treatment

## Backlog hygiene (2026-06-25)

Code audit of open `🟣` / audit-tail items still marked open but resolved or mis-aimed in code:


| Item                                                     | Verdict                                                                                                                                             | Action                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Insurance number autofill (`/roadside-setup`)            | **Mis-aimed** — OCR shipped on `/insurance-setup` (`6d03c7f`, expo-text-extractor). `/roadside-setup` is service name + phone only.                 | Retarget or strike below. |
| Phase 0b "inert" `/safety` + `/menu` tiles               | **Stale** — all four safety tiles wired (`safety.tsx`); menu Fuel tile wired (`showFuelTile` → `/fuel`).                                            | Strike deferral note.     |
| Accessibility "only ~3 `dynamicType()`"                  | **Stale** — 200+ call sites post typography PR #252.                                                                                                | Strike.                   |
| Audit `/home` F10 raw typography                         | **Stale** — fixed in #252.                                                                                                                          | Strike.                   |
| Audit `/en-route` F4 hardcoded 25 mph                    | **Stale** — posted limit sign removed; current-speed pill only (`en-route.tsx` docblock).                                                           | Strike.                   |
| Audit `/roadside` F1 WrongSpotModal input                | **Stale** — `input` uses `dynamicType(typography.bodyRegular)`.                                                                                     | Strike.                   |
| Audit `/unfamiliar` F1 "Saves your journey periodically" | **Stale** — copy no longer in `unfamiliar.tsx`.                                                                                                     | Strike.                   |
| Audit `/trip-summary` F2 "Set as default"                | **Partially stale** — CTA is "Remember this destination"; silent no-op when `destLat`/`destLng` absent still possible (`trip-summary.tsx:181-200`). | Retitle, keep open.       |
| Saved places empty after saves                           | **Still valid** — no `savedPlaces.add` call sites; feature not built.                                                                               | Keep.                     |
| Report card subTags overhaul                             | **Still valid** — no code change.                                                                                                                   | Keep.                     |
| Distance-aware refuel Phase 1 device-test                | **Still valid** — UNVERIFIED-IN-RUNTIME.                                                                                                            | Keep.                     |


**Spike shipped:** tow-pick merged PR #253 (`d0d747a` on `main`). MKLocalSearch phone enrichment + `docs/spike/mklocalsearch-tow-phone.md`; iOS dev build verified.

## Design Round 7 critique tail (2026-06-25)

Post tow-pick merge hub sweep per workflow §12b. Historical synthesis: [`.impeccable/archive/ROUND-7-SYNTHESIS.md`](../.impeccable/archive/ROUND-7-SYNTHESIS.md). Snapshots: `.impeccable/critique/2026-06-25T17-31-*.md`. **Closure:** all P1s fixed in batches 1–2; remaining P2s rolled into [`.impeccable/VISUAL-CLOSURE-SYNTHESIS.md`](../.impeccable/VISUAL-CLOSURE-SYNTHESIS.md) §P2/P3 (not blocking Supabase).


| Tier | Item | Surface | Notes |
| ---- | ---- | ------- | ----- |
| ~~P1~~ | ~~**Share toggle auto-advances to status**~~ | `/roadside` Step 2 | ~~Fixed batch 2 — toggle arms share only; `markActionTaken()` on call/tow paths.~~ |
| ~~P1~~ | ~~**Toolkit tiles missing hints + session invisible**~~ | `/safety` | ~~Fixed batch 2 — `accessibilityHint` on tiles + session banner when active.~~ |
| ~~P1~~ | ~~**No-route turn-card = mock fallback copy**~~ | `/en-route` | ~~Fixed batch 1 — `Following route to` for mock/cache; live `Heading toward` separate.~~ |
| ~~P1~~ | ~~**Inert mic looks tappable**~~ | `/search` | ~~Fixed batch 1 — SearchBar omits mic when `onMicPress` undefined.~~ |
| P2 | **Tow-pick simulator copy in production error** | `RoadsideTowPick` | Empty-state mentions Xcode simulator. |
| ~~P2~~ | ~~**WrongSpotModal no in-card Cancel**~~ | `/roadside` | ~~Deferred — synthesis §P2/P3 (scrim dismiss; VoiceOver escape gap).~~ |
| P2 | **"I figured it out" one-tap dismiss** | `/roadside` | Stress-state accidental back. |
| ~~P2~~ | ~~**Calendar tile no connect feedback**~~ | `/menu` | ~~Deferred — synthesis §P2/P3 (success = tile removal on refocus).~~ |
| ~~P2~~ | ~~**MapCoach one-shot**~~ | `/home` | ~~Deferred — synthesis §P2/P3 (onboarding cross-cut).~~ |
| ~~P2~~ | ~~**No long-press FAB label flash**~~ | `/en-route` | ~~Deferred — synthesis §P2/P3 (discoverability polish).~~ |

**P0 gate:** None — met at batch 5 (#270).

## Safety flow critique sweep (2026-06-24)

Surfaced from `/impeccable` critique passes on all six safety screens (`/en-route`, `/emergency`, `/pulled-over`, `/share-location`, `/unfamiliar`, `/roadside`). All 12 tasks shipped in two commits on `main` (`a5f1b67` + `03e57fb`). Critiques at `.impeccable/critique/2026-06-24T01-57-*.md`.


| Tier   | Item                                                                             | Surface                    | Notes                                                                                                                                                                                                        |
| ------ | -------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~P0~~ | ~~`**sosHoldHint` below 12pt floor (caption2Regular 11pt)**~~                    | `/en-route`                | ~~Fixed 2026-06-24: bumped to `caption1Regular` (12pt). Clears the Floor Rule.~~                                                                                                                             |
| ~~P0~~ | ~~**Countdown disc shows bare numeral with no unit**~~                           | `/emergency`               | ~~Fixed 2026-06-24: "sec" label added below numeral (`countdownUnit` style, `caption1Regular`, 70% white). `lineHeight:40` on numeral gives room. emergency.tsx:119-120.~~                                   |
| ~~P1~~ | ~~**No sheet-lock signal during active recording**~~                             | `/pulled-over`             | ~~Fixed 2026-06-24: `Lock` badge (Phosphor, size 14, `labelTertiary`) at absolute-right of `dragWrapper` when `hasActiveRecording`. accessibilityLabel: "Sheet locked while recording". pulled-over.tsx.~~   |
| ~~P1~~ | ~~**"Stop recording" rendered as underlined text — below 44pt floor**~~          | `/pulled-over`             | ~~Fixed 2026-06-24: promoted to pill button (`footnoteEmphasized`, `radii.pill`, 1pt `labelTertiary` border, `minHeight:44`). pulled-over.tsx.~~                                                             |
| ~~P0~~ | ~~**No per-row loading state after reason tap**~~                                | `/share-location`          | ~~Fixed 2026-06-24: `busyReasonId: string                                                                                                                                                                    |
| ~~P0~~ | ~~`**handleEnd` failure shows Alert — interrupts calm companion register**~~     | `/share-location`          | ~~Fixed 2026-06-24: `endError: string                                                                                                                                                                        |
| ~~P1~~ | ~~**Eyebrow copy premature ("On it. Sharing your location now.") before pick**~~ | `/share-location`          | ~~Fixed 2026-06-24: "You choose. We'll tell them." (picker register) vs "Already on it." (active register). share-location.tsx:138.~~                                                                        |
| ~~P0~~ | ~~**No loading state during destination search**~~                               | `/unfamiliar`              | ~~Confirmed pre-existing fix 2026-06-24: `loadingDestId` + ActivityIndicator already wired (unfamiliar.tsx:106). Task closed.~~                                                                              |
| ~~P0~~ | ~~`**handleDestinationPick` errors surface as Alert.alert**~~                    | `/unfamiliar`              | ~~Fixed 2026-06-24: three Alert.alert calls replaced with `setDestError()`; inline `destError` renders below destination list (`footnoteRegular/red`, `accessibilityLiveRegion="polite"`). unfamiliar.tsx.~~ |
| ~~P0~~ | ~~**Step 3 has no visible escape affordance**~~                                  | `/roadside`                | ~~Confirmed pre-existing fix 2026-06-24: X button (line 522-531) calls `onBackToActions` → `handleBackToActions` (non-committing). Task closed.~~                                                            |
| ~~P1~~ | ~~**"If this gets worse" section label too light**~~                             | `/roadside`                | ~~Fixed 2026-06-24: `sectionLabel` bumped from `subheadlineRegular/labelSecondary` to `subheadlineEmphasized/black` + `marginTop:spacing.lg`. roadside.tsx.~~                                                |
| ~~P1~~ | ~~**WrongSpotModal missing Cancel button**~~                                     | `/roadside`                | ~~Stale finding — WrongSpotModal does not exist in current codebase. Closed as non-issue.~~                                                                                                                  |
| ~~P1~~ | ~~**"What you shared" past-tense for a live moment**~~                           | `/roadside` Step 3         | ~~Fixed 2026-06-24: title → "What they know"; bullet string → labeled `Problem / Location / Contact` rows (`sharedRow/sharedRowLabel/sharedRowValue` styles). roadside.tsx:508-536.~~                        |
| ~~P1~~ | ~~**Weather card shows `—°` during load (identical to error state)**~~           | `/home` WeatherDrivingCard | ~~Fixed 2026-06-24: `loading && !weather` branch now shows `ActivityIndicator` (freshgreen, minHeight 44). `—°` now unambiguously means "broken + tap to retry." HomeBrowseSheet.tsx:828-835.~~              |


**En-route search icon (🟡 from device-smoke list):** Investigated 2026-06-24 — magnifying glass is correct. The action is `router.push('/search?from=enroute')` (mid-trip destination change). Icon matches intent. Closed as non-issue.

## Impeccable arc punch list (2026-06-23)

Surfaced during the `polish/impeccable-pass` critique sweep (clarify + typeset + bolder + animate + 4 layout restructures). All four restructured screens (home/en-route/report/menu) PASS the critique; these are follow-up findings worth tracking but not blockers. Snapshots at `.impeccable/critique/2026-06-24T01-57-*.md`.


| Tier   | Item                                                     | Surface                | Notes                                                                                                                                                                                                                          |
| ------ | -------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~P1~~ | ~~**Side-FAB label tier below 12pt Floor Rule**~~        | `/en-route` SideFabRow | ~~Fixed 2026-06-23 (`polish/follow-up-sweep`): caption2Regular 11pt → dynamicType(footnoteRegular) 13pt. Clears the Floor + scales with Larger Text.~~                                                                         |
| ~~P1~~ | ~~**Sign-out has no confirmation dialog**~~              | `/menu`                | ~~Fixed 2026-06-23 (`polish/follow-up-sweep`): added confirmSignOut wrapper with Alert.alert destructive style. Cancel default; Sign out destructive.~~                                                                        |
| ~~P2~~ | ~~**Long route-preview stack overflows at AX5**~~        | `/home`                | ~~Fixed 2026-06-23 (`polish/follow-up-sweep`): wrapped bottomSheetContent in a ScrollView with flexShrink:1. Content scrolls within the sheet at AX5; Go button stays sticky-pinned at the bottom as the actionsRow sibling.~~ |
| ~~P2~~ | ~~**FAB-stack bottom math uses magic numbers**~~         | `/home`                | ~~Fixed 2026-06-23 (`polish/follow-up-sweep`): extracted FAB_ANCHOR_GAP, FAB_HEIGHT, FAB_STACK_GAP at module scope. Bottom expressions now read as composition rather than magic arithmetic.~~                                 |
| ~~P2~~ | ~~**No discard-report confirmation on mid-flow X-tap**~~ | `/report`              | ~~Fixed 2026-06-23 (`polish/follow-up-sweep`): added handleCloseFromDetail wrapper. Empty form closes silently; partial form triggers Alert.alert ('Discard report?' / 'Keep editing' / 'Discard'-destructive).~~              |


## Device-smoke punch list (2026-06-21)

Surfaced during real-device smoke immediately after the Design Health Program closeout audit (see `[docs/archive/superpowers/specs/phase-1-findings/2026-06-20-design-health-program-closeout.md](archive/superpowers/specs/phase-1-findings/2026-06-20-design-health-program-closeout.md)`). The closeout audit was code-reading; these only surface at the interaction layer. Tier tags: 🔴 real bug / 🟡 discoverability / 🟠 visual-layout / 🟣 feature-strategic.


| Tier   | Item                                                                                            | Surface                           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~🔴~~ | ~~**SOS hold has no visible affordance for sighted users**~~                                    | `/en-route` SOS FAB               | ~~Confirmed resolved 2026-06-24: `useHoldToConfirm` wires a red ring (opacity 0→1 on press-in) + "Hold" caption below FAB (gated on `sideFabCoach.visible`, same coach-mark path). Code comments at en-route.tsx:315–321 document the fix. accessibilityHint also updated to non-VoiceOver path.~~                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 🟣     | **Saved places empty even after saves — NOT a regression: no production write-path exists yet** | `/saved-places`                   | Investigated 2026-06-21. The `useSavedPlaces` hook is well-architected (optimistic + reconcile + rollback). `app/home.tsx`'s `handleLongPress` only removes author-owned community reports — no add-home flow. Zero call sites of `savedPlacesState.add` in `app/home.tsx`. **The empty state is correct.** The Search tap-to-bookmark feature was specced earlier and never built. Promoting from 🔴 to 🟣 — this is a *feature build*, not a fix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ~~🔴~~ | ~~**Coach-mark text vs long-press behavior mismatch**~~                                         | `/home` map-guide                 | ~~Fixed 2026-06-23: copy clarified — "Long-press anywhere on the map to save that spot as your home." Behavior was correct (saves home); copy was misleading ("add what you know" implied community report).~~                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ~~🔴~~ | ~~**FAB column shifts out of alignment on Guide tap**~~                                         | `/en-route` Guide "?" FAB         | ~~Confirmed resolved 2026-06-24: labelPill is `position: 'absolute'` with `right: '100%'` — floats left of the FAB without participating in flex sizing. FAB x-position is fixed regardless of showLabel state. Code comment at en-route.tsx:315–321.~~                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ~~🔴~~ | ~~**Long-press on own community pin doesn't trigger Remove Alert**~~                            | `/home`                           | ~~Fixed 2026-06-23: widened hit-test radius from 30px→50px.~~                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ~~🟡~~ | ~~Safety best-practices scroll has no cue~~                                                     | `/pulled-over` (guidance phase)   | ~~Fixed 2026-06-23: wrapped guidance content in ScrollView with visible indicator; Continue button pinned below.~~                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ~~🟡~~ | ~~Trusted Contact tap on "Set your Trusted Contact" page is a no-op~~                           | `/trusted-contact-setup`          | ~~Fixed 2026-06-23: populated contact card now wrapped in Pressable→handlePickContact (was only the empty state).~~                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ~~🟡~~ | ~~Search icon on destination ETA sheet should be a back-caret~~                                 | `/en-route` destination/ETA sheet | ~~Confirmed non-issue 2026-06-24: action is `router.push('/search?from=enroute')` (mid-trip destination change). Magnifying glass is semantically correct. Closed.~~                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ~~🟠~~ | ~~Save button on destination sheet may be sub-44pt~~                                            | `/en-route` destination sheet     | ~~Investigated 2026-06-23: no save button exists on the destination sheet. Fuel stops entry row already has minHeight:44. Closing as non-issue.~~                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ~~🟠~~ | ~~Guide button on ETA page left-justified looks strange~~                                       | `/en-route`                       | ~~Fixed 2026-06-23: Guide FAB was size 48 while the other 4 column FABs were 56. Bumped to 56 so the column aligns.~~                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ~~🟠~~ | ~~Wrench "Road" icon on ETA page ambiguous~~                                                    | `/en-route` ETA card              | ~~Investigated 2026-06-23: icon is a car on rocky terrain, not a wrench. Reads correctly as "road condition." Punch list description was inaccurate. Closing.~~                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ~~🟠~~ | ~~Yellow zone icons should be gray when inactive~~                                              | route preview / en-route          | ~~Fixed 2026-06-23: default (not-yet-entered) zone markers now render at 50% opacity. Extended (entered) markers stay full opacity.~~                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 🟣     | Report card contextual overhaul — multi-select subTags + per-category gaps                      | `/report`                         | `felt-welcome` mixes place-type and identity-signal into single-select; forces user to choose between "Restaurant" and "Women-owned." Fix: separate dimensions (place-type × identity-tags, multi-select on identity group). Also: some categories (`felt-unsafe`, `incident`, `hazard`, `lighting`) have no subTags at all — may benefit from lightweight context tags. Bounded spec: storage, picker UI, marker glyph dispatch, recommendation routing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 🟣     | Insurance card OCR (policy autofill)                                                            | `/insurance-setup`                | ~~Was listed as `/roadside-setup`.~~ Shipped `6d03c7f` — on-device card scan fills carrier + policy. Remaining gap: autofill from saved credentials / keychain (optional).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ~~🟣~~ | ~~**Roadside `tow-pick` sub-step (call-first)**~~ | `/roadside` | ~~Shipped PR #253 (`d0d747a`). In-app tow-pick: Mapbox rank + MKLocalSearch phone enrichment; progressive rows; status **Contacted** row. Round 7 tail: share-toggle auto-advance (P1), simulator error copy (P2).~~ |
| ~~🟣~~ | ~~Why does the app jump to Apple Maps for nearby resources?~~                                   | `/roadside` tow search            | ~~Folded into tow-pick spec above — no Maps handoff; in-app call-first.~~                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |


**First cluster shipped (2026-06-21):** SOS Hold affordance + coach-mark honesty + FAB alignment landed as one PR. Saved-places was investigated and promoted to 🟣 (no regression — feature not yet built; awaits Search tap-to-bookmark). Destination sheet height also trimmed (duplicate hint removed + gap tightening).

**Second cluster shipped (2026-06-23):** Pin hit-test radius widened (30→50px), guidance scroll cue (ScrollView), trusted-contact card tappable when populated. Search icon deferred — action is genuinely search, icon may be correct.

## Design Health Phase 1 — per-screen critique tail (2026-06-19)

From `docs/archive/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md` Section 5. These are screen-specific issues that cannot be addressed by Phase 2 design-system extraction — each must be fixed in the touched screen. Priority-ordered within tier. Snapshots that ground each entry live in `.impeccable/critique/`.


| Screen Slug                  | Issue Title                                                        | Priority           | Note                                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~app-recordings-tsx~~       | ~~No share / export path for recordings~~                          | ~~P0~~             | ~~Confirmed resolved 2026-06-24: `expo-sharing` imported; `handleShare` calls `Sharing.shareAsync(uri, { dialogTitle, mimeType: 'audio/m4a' })`. Share icon in every RecordingCard row (recordings.tsx:449–456).~~                                                            |
| ~~app-en-route-tsx~~         | ~~SOS button one-tap to emergency — no confirmation~~              | ~~P0~~             | ~~Confirmed resolved 2026-06-24: `useHoldToConfirm` (800ms threshold) gates `router.push('/emergency')` with animated red ring + haptic ramp. VoiceOver gets single-tap bypass per .cursorrules safety-critical interactions rule.~~                                          |
| ~~app-roadside-tsx~~         | ~~Step 3 dismissal trap — no visible escape~~                      | ~~P0~~             | ~~Confirmed resolved 2026-06-24: `handleBackToActions` (roadside.tsx:153) returns to Step 2 without committing state; wired to `onBackToActions` prop on the Step 3 panel (line 219). Code comment explicitly references P0-3 fix.~~                                          |
| ~~app-recordings-tsx~~       | ~~Single-row delete has no confirmation for evidence~~             | ~~P0~~             | ~~Confirmed resolved 2026-06-24: `ConfirmRequest` discriminated union covers `'single'` (per-row) and `'all'` (bulk) modes. Trash tap opens the same full Modal with recording date, X close, and "Yes, delete" CTA (recordings.tsx:51–57, 146–148).~~                        |
| ~~app-unfamiliar-tsx~~       | ~~Silent async during destination search — no loading state~~      | ~~P0~~             | ~~Confirmed resolved 2026-06-24: per-row `ActivityIndicator` on `loadingDestId` match; other rows dim to 50% opacity; `accessibilityState={{ busy: isLoading }}` (unfamiliar.tsx:106–346).~~                                                                                  |
| ~~app-fuel-tsx~~             | ~~Save with distance enabled but no range silently misconfigures~~ | ~~P0~~             | ~~Confirmed resolved 2026-06-24: `canSave = !saving && !(distanceEnabled && rangeMiles === null)` (fuel.tsx:219) disables Save; accessibilityHint says "Pick a tank range to enable Save" in that state.~~                                                                    |
| ~~app-safety-settings-tsx~~  | ~~Emergency SOS row one tap from emergency flow~~                  | ~~P0~~             | ~~Confirmed resolved 2026-06-24: SOS is already its own isolated RowGroup (footer: "One tap to reach your trusted contact or 911."). Trusted Contact + Recordings are in a separate RowGroup below.~~                                                                         |
| ~~app-legal-tsx~~            | ~~Tab pills 28pt painted — 36% below floor~~                       | ~~P0 (component)~~ | ~~Confirmed resolved 2026-06-24: tab style has `minHeight: 44` + `justifyContent: 'center'` (legal.tsx:371–372). 44pt floor met.~~                                                                                                                                            |
| ~~app-en-route-tsx~~         | ~~Auto-expand hazard sheet on zone entry too aggressive~~          | ~~P1~~             | ~~Confirmed resolved 2026-06-24: code comment at en-route.tsx:967 explicitly removed auto-expand ("DON'T auto-expand the sheet. The v1 auto-expand + 5s auto-collapse yanked driver eyes off the road").~~                                                                    |
| ~~app-en-route-tsx~~         | ~~Static speed-limit sign permanently shows "—"~~                  | ~~P1~~             | ~~Confirmed resolved 2026-06-24: speed limit card removed; only current-speed pill remains (`speedLimitCurrentPill`). Three speedLimit styles total — no limit-card style exists. Repurposed for current speed only.~~                                                        |
| ~~app-pulled-over-tsx~~      | ~~"Add a contact" mid-stop recovery too subtle~~                   | ~~P1~~             | ~~Confirmed resolved 2026-06-24 (Phase 1 P1-11): `avatarCircleEmpty` flips to outline register (transparent + freshgreen border); UserPlus icon + "Add a contact" text both freshgreen. Fill→outline convention signals invitation vs. identity. pulled-over.tsx:2050–2064.~~ |
| ~~app-sign-out-tsx~~         | ~~Copy register mismatch — "Thank you for stopping by!"~~          | ~~P1~~             | ~~Confirmed resolved 2026-06-24: sign-out.tsx:47 reads "Drive safe."~~                                                                                                                                                                                                        |
| ~~app-trip-summary-tsx~~     | ~~"Set as default" CTA — mental model mismatch~~                   | ~~P1~~             | ~~Confirmed resolved 2026-06-24: trip-summary.tsx:373 reads "Remember this destination".~~                                                                                                                                                                                    |
| ~~app-zone-preferences-tsx~~ | ~~Silent degradation when all safety flags disabled~~              | ~~P1~~             | ~~Confirmed resolved 2026-06-24: `allFlagsOff` guard replaces footer with "All three off — routes are scored on distance and time only. No safety signals factor in." zone-preferences.tsx:59–62.~~                                                                           |
| ~~app-unfamiliar-tsx~~       | ~~Lifeline modal overstates live-location capability~~             | ~~P1~~             | ~~Confirmed resolved 2026-06-24: unfamiliar.tsx:323 reads "Your contact already has a text draft in Messages." — correctly describes Messages-draft model, not live push.~~                                                                                                   |


## Distance-aware refuel — Phase 2 queued (2026-06-17)

**⚠ Phase 1 device-test still owed** (merged to main `e70ab1c`, NOT yet verified on a real device/sim). Recipe: iOS Simulator (or dev build) → `/fuel` → enable reminders, Tank range = **Custom 2 mi**, fuelType gas → start navigation → Xcode **Features → Location → Freeway Drive** (or a GPX of Clinton Hill / Fort Greene) → after ~2 simulated miles the distance notification should fire (naming a trusted on-route stop) + the `FuelStopsSheet` `refuelDue` banner. Tap "I filled up" → ½ → banner clears, `milesSinceFilled` resets to half-range, next cadence shortens. Zero-movement smoke test: call `addMilesSinceFilled(2)` then `checkRefuelTriggers()` from a temp affordance. The pure logic is verified (tsc + node assertions + 2-reviewer audit); only on-device behavior is unverified. Native module → needs a dev build, not Expo Go.

Phase 1 shipped on `feat/distance-aware-refuel-phase1` (route-progress odometer + earliest-of(time, distance) + tier-bucket range + fraction-button fill-up + station-aware distance notification). **Phase 2** is fully specced in `docs/archive/superpowers/specs/2026-06-12-distance-aware-refuel-design.md` (the `# PHASE 2` section) but NOT built: the EPA fueleconomy.gov proxy endpoint (`proxy/api/vehicles.ts`, cascading year→make→model + class-tank range), the generic `OptionPickSheet` extraction (refactor `CalendarPickSheet` to consume it), `hooks/useVehicleLookup.ts`, and the **dollar-input → "about ⅓ tank" subtext** fill-up register for gas/diesel (gated on real station prices; EVs + Phase 1 keep fraction buttons). Writes the same `rangeMiles`/`rangeSource` fields Phase 1 already owns — pure enrichment of the range-input step, the trigger engine is untouched. Also open (design decision, separate spec): **pull `felt-welcome`/`black-owned` out of `scoreRoute`'s path scoring** — they're destination signals, not passage safety (Jacobs "whose eyes" thread, 2026-06-17); fixes an existing score-vs-chip divergence where felt-welcome gives +2 to the path but never shows on the safe-chips.

## Audit-10 follow-up — `tapTarget44` migration sweep (2026-06-04)

~~**9 pre-existing bare-form duplicates remain**~~ — ✅ **Done** (`chore/polish-app-wide` / impeccable polish pass 2026-06): emergency close, home route-cycle chevrons, pulled-over review chevrons, recordings back/delete/confirm-close, saved-places remove, trusted-contact back, CalendarPickSheet close, SettingsHeader controls. Removed redundant `hitSlop` where the painted target is now 44pt.

**Decorated variants to LEAVE local** (have `borderRadius` / `backgroundColor` beyond the bare shape): `app/emergency.tsx` `stopChrome`, `app/home.tsx` `routeClearBtn`, `app/trip-summary.tsx` `inferenceBtn`. All three previously had `borderRadius: 22`; `polish/spacing-radii-pass` (2026-06-23) snapped them to `radii.xl` (20pt — 2pt visual delta, sub-perception). If a second token like `tapTarget44Circle` (44pt + `radii.xl` + neutral fill) ever gets extracted, these three are its consumers — but not yet (rule-of-three on the circular variant isn't hit).

## Session arc closures (2026-06-04)

Shipped on `main` from the map-sheet / gas-prices / hazard-marker session. Strike-through for grep; supersede any overlapping open bullets elsewhere.

- ~~**Gas search demo prices**~~ — ✅ shipped on `main` (`f26d3bd` adapter, `ad314e2` /search, `bae0b11` fuel sheet, `51cbea6` docs). `enrichPlacesWithFuelPrices` after Mapbox search; demo footnote when `source === 'demo'`.
- ~~**On-route hazard markers on /home route-preview + zoom remount**~~ — ✅ shipped (`9555bda` / `f770a15` yellow `EnRouteZone` pins + `RouteHazardDetailCard`; `2b8f537` + `e4968c3` `markerSnapshotEpoch` from `latitudeDelta` so markers re-render on zoom).
- ~~**Fuel sheet tap → mid-trip reroute**~~ — ✅ shipped `70a57e7`. Tap stop uses `router.setParams({ destLat, destLng, destName })`; existing route refetch effect; sheet closes.
- ~~**Map-sheet gray area**~~ — ✅ shipped `f770a15` (± `c68ab0f` bookmark tint). Report/hazard/fuel pin taps + detail cards on `/home` and `/en-route`; ReportDetailCard "Why this route" link; `FuelStopMarker` on map.

## Connect-calendar (Plan 2) — deferred minors + verification gate (2026-06-01)

Shipped via subagent-driven development. Final-review minors, non-blocking (the one Important — /menu tile cold-load flash — was fixed in `4e19ec4`):

- ~~**Native verification PENDING a dev build**~~ — **core path verified on-device (2026-06-02).** A real calendar event surfaced in `/search` Upcoming on a physical-device dev build, confirming the full connect → permission → `getUpcomingLocatedEvents` read → resolve → render chain works. `expo-calendar` is still a native module (no Expo Go; needs a dev build). Lighter-tested sub-paths if you want to close them fully: the pick-sheet correction persisting + sign-out clearing the calendar stores — simpler code paths, very likely fine, but not specifically walked.
- **Sequential geocoding** in `useUpcomingDestinations` — distinct unresolved venues are awaited in series on focus. Fine for a realistic week of events (cache dedupes repeats); if the Upcoming list grows, batch with `Promise.all` over distinct location texts.
- `**(e.location as string)` cast** in `calendar.ts:111` — sound (guarded by the `typeof === 'string'` filter one line up), cosmetic; a filter-narrowing helper would drop it.
- `**relativeWhen` drift** in `/search` — recomputes vs `Date.now()` per render; visible label + a11y label can differ by a render at the m/h/d granularity. Negligible.
- ~~`showFuelTile` cold-load flash~~ — **fixed (2026-07-11):** the `/search` fuel-tile subtitle now holds blank while `useFuelProfile` `loading`, so an already-configured user no longer flashes a false "Set up refuel reminders" before "Next reminder" lands (`app/search.tsx`). Honesty-of-disclosure over a one-frame stale prompt.

## Settings register refresh (Plan 1) — deferred minors (2026-06-01)

Final-review minors, non-blocking (the one Important — SettingsRow value/label wrap — was fixed in `a8e11a6`):

- `**/menu` sign-out not bottom-pinned.** Spec called for `marginTop: 'auto'` to pin the sign-out RowGroup to the bottom; implementation lets it flow after the About group. Reviewer noted flow-position is arguably better with the profile card + tile above. Decide: pin it, or update the spec note. Cosmetic.
- ~~`/menu` onClose `router.back()` vs children's `router.replace('/home')`~~ — **decided (2026-07-11): keep `back()`.** It's the standard iOS modal-dismissal (return to wherever you opened from), and there's no second entry point today (menu is always pushed from /home). Revisit only if a second entry point lands.
- **RowGroup Fragment index keys.** Rows keyed by array index inside RowGroup; fine for static groups, and `/saved-places`' dynamic rows are mitigated by `SavedPlaceRow`'s own `key={place.id}`. Revisit only if RowGroup ever hosts stateful dynamic children directly.
- **RowGroup separator inset assumes icon-bearing rows.** Icon-less groups (e.g. `/zone-preferences` toggles, `/fuel` Reminder group) get a separator inset past where the label starts. Accepted per the primitive's comment; revisit if it reads off in the simulator.
- ~~**Settings register = Plan 1 of 2.** Plan 2 (Connect-calendar feature: expo-calendar dep, 2 adapters, 2 hooks, /search Upcoming section, pick-sheet, carousel 2nd tile) is specced in `docs/archive/superpowers/specs/2026-06-01-settings-register-refresh-design.md` — write its plan + execute after this lands + simulator-verifies.~~ — ✅ **Done (2026-06-04).** Plan 2 shipped in the Connect-calendar arc (section above); core path verified on-device 2026-06-02. Remaining work is deferred minors only, not "write plan + execute."

## Zone-overlay tap-info — post-merge follow-ups (2026-06-01)

Shipped `51549ed`. Final-review minors not blocking merge:

- **ESLint exhaustive-deps comment on ZoneDetailCard's useEffect** — `components/ZoneDetailCard.tsx:53` uses `[zone.id]` as the dep but the effect's closure reads `content`. The project doesn't have an ESLint config today, so no warning fires; if one is ever added, `react-hooks/exhaustive-deps` will flag this as a false positive. Pre-empt with a one-line `// eslint-disable-next-line react-hooks/exhaustive-deps` and a comment ("fires once per zone open, not per content-object identity"). Low priority.
- `**handleZonePress` allocated per-render inside the zones map** — `app/home.tsx:1106`. Negligible at current zone counts; if the overlay set grows, hoist to a `useCallback((zone) => …)` outside the map for referentially-stable Polygon/Polyline props. Post-merge optimization only.
- **Zone-unmount while card is open** — if the user opens a `ZoneDetailCard` and then toggles `showZones` off (or a category-flag off) in `/zone-preferences`, the card stays mounted holding a stale `Zone` object. Not a crash, but visually weird. Optional `useEffect` on `selectedZone` clearing it when its category's enabled flag flips off. Edge case.
- **Repeat-tap behavior on the same zone** — currently no-op (React bails on identical refs; the `useEffect([zone.id])` doesn't re-fire so VoiceOver doesn't re-announce). Defer until user feedback says otherwise.
- `**BottomSheetShell` extraction** — `ReportDetailCard` and `ZoneDetailCard` now share ~30 lines of scrim + sheet + drag-handle chrome. Rule-of-three threshold not yet met (two surfaces), but the next sibling sheet will tempt a third copy — at that point, extract.
- **Unit test for `zoneCategoryContent`** — pure function, trivial to test; would lock the per-category content contract. Project doesn't have a test runner configured today; consider when one lands.

## Audit follow-ups — focused session-surfaces pass (2026-05-30)

Minor findings from the focused static audit of the surfaces this session touched (the blocker + 4 importants were fixed in `99fe915`). All low-severity:

- **Quick a11y nits** — ~~Saved-row period label~~ (fixed `57055bf`). ~~Shield FAB hint~~ / ~~safety-settings SOS hint~~ / ~~daylight strip hidden from AX tree~~ — verified present in code (2026-06 polish grep). Re-open only if device testing finds a gap.
- ~~`/en-route` SOS haptic~~ — **stale (superseded, verified 2026-07-11):** the en-route SOS FAB no longer fires a per-tap haptic; the emergency trigger lives in `app/emergency.tsx`, which already uses a distinct vocabulary (`notificationAsync` + `impactAsync` Medium/Light), so it's no longer "identical to the Report tap".
- `**/menu` "What we flag" hierarchy** — sub-header vs toggle-label distinction rests on font-weight alone (`labelSecondary` #3C3C43 ≈ `labelTertiary` #3D3D3D). Approved for now; if it ever reads ambiguous, drop to `caption1Regular` or a genuinely lighter gray.
- ~~**Spacing-token discipline (pervasive, pre-existing)**~~ — ✅ **Done 2026-06-23** (`polish/spacing-radii-pass`). Inline `padding/margin/gap` swept to `spacing.*` tokens across 15 screens + components; off-grid values snapped to nearest ramp step. Figma-specified outliers (`gap:88`, `marginLeft:10.71`, optical pill paddings) preserved with inline notes.
- `**/search` tile toggle (pre-existing)** — deselecting a query tile (Food/Gas/Parking) leaves the search query set; minor interaction ambiguity, predates this work.
- `**/roadside` file split (post-`feat/roadside-assistance`)** — `app/roadside.tsx` is ~817 lines hosting `Roadside` + 4 step components + helper + const + type + one styles block. Internally cohesive today (one route, one state machine, components only used by their sibling steps), but if a Step 4 or a major addition lands, split into `app/roadside/{ProblemPicker,WrongSpotModal,ActionMenu,LiveStatus}.tsx`.
- ~~`**/roadside-setup` hydration via `useEffect**~~` — ✅ done (`audit/safety-polish`); both `/roadside-setup` and `/fuel` swept to `useEffect` on `[loading, profile, hydrated]`.
- `**ActionMenu` local `useRouter` redundancy** — `app/roadside.tsx`'s `ActionMenu` calls `useRouter()` for its `router.push('/roadside-setup')` + `router.push('/trusted-contact-setup')`, while the parent `Roadside` also has one. Symmetric with `LiveStatus` would mean passing the two navigations as callbacks. Drop the inner `useRouter` when next touching the component.
- ~~`**/trusted-contact-setup` routing default is inverted (footgun)**~~ — ✅ **Done** (the structural fix landed `2026-06-01`; this entry describes the *pre-fix* state and was never struck through, so it kept resurfacing). Verified in code 2026-06-17: `trusted-contact-setup.tsx:73` `const embedded = params.from !== 'onboarding'` makes `back()` the default; `handleContinue`/`handleSkip` only `replace('/home')` when `from=onboarding`; `EntryPoint` type narrowed to just `'onboarding'`. Caller audit — only `/permissions` passes `?from=onboarding` (end of onboarding, wants the home-reset); `/emergency`, `/roadside`, `/safety`, `/safety-settings` all push **param-less** → safe `back()`. No vestigial `from=settings`/`from=emergency` pushes remain (the "Home drops as a sheet over the modal stack" bug is closed). A forgotten param now degrades to `back()`, the safe behavior — the original ask.
- ~~`**/unfamiliar` re-entry race**~~ — ✅ done (`audit/safety-polish`); `step` is now nullable and re-derives once `useShareSession.loading` resolves, blocking the picker from rendering during the AsyncStorage hydration window.
- ~~`**router.back()` fallback when `!canGoBack()**~~` — ✅ done (`audit/safety-polish`); `/unfamiliar` and `/share-location` both gate `router.back()` behind `canGoBack()`, falling back to `router.replace('/home')` so a deep-link entry can never strand the user.
- ~~`**LifelineModal` empty-phone guard**~~ — ✅ done (`audit/safety-polish`); sanitized phone hoisted into `dialable`, empty case bails with a dedicated "No phone number" Alert before `canOpenURL` is consulted.
- ~~`**DESTINATIONS` error-copy fragility**~~ — ✅ done (`audit/safety-polish`); `DestinationOption` gained an explicit `nounSingular` field; the no-results Alert reads from it instead of munging `title`.

## Phase 0b — un-triaged dead-ends (found by the 2026-05-30 acceptance sweep)

Phase 0 (`ae79812`) removed the *enumerated* dead-ends (Google/Email auth, inert /menu rows, /search Trending, plus the query-tile deselect bug + honest /report copy). A codebase-wide `rg` for `coming soon|future update|not yet supported` then surfaced dead-ends the spec's triage table never listed. Each needs a **cut / hide / wire** decision before "zero visible dead-ends" is literally true:

- ~~**/en-route mic button** — "Voice control (not yet supported)"~~ — ✅ hidden in `74c2d98` (see triage decisions below); future voice-nav work tracked as its own feature track.
- ~~**/en-route Volume button** — "Voice prompt controls land in a future update"~~ — ✅ hidden in `74c2d98`; same voice-nav track as above.
- ~~**/en-route alternate-paths FAB** — "Show alternate paths (coming soon)"~~ — ✅ shipped (`457f3ef`); alternate-route comparison sheet.
- ~~**/search Fuel card** — "Coming soon" hint~~ — ✅ shipped (`d9cb709` + `1997010`); wired to /fuel.

Known Phase-1 deferrals (already triaged as WIRE): ~~**/menu Quick Tiles** (Fuel, Notifications)~~ — Fuel tile wired (`menu.tsx` `showFuelTile`); ~~**/safety inert tiles**~~ — all four safety tabs wired (`safety.tsx` hrefs). **Voice-guided navigation** track still open (mic/Volume hidden `74c2d98`).

**Triage decisions (2026-05-30) — status:**

- ~~**HIDE now:** /en-route voice (mic) + Volume buttons~~ — ✅ done (`74c2d98`); buttons + orphaned imports/style removed.
- **Feature track — Voice-guided navigation + en-route voice search (STILL OPEN):** spoken turn-by-turn (gates a future Volume control) + speech-to-text destination input (gates a future mic). Requires an Expo dev build, a speech library, and a mic-for-dictation permission. Own brainstorm→spec→build cycle.
- ~~**BUILD — Alternate-route comparison (/en-route alternate-paths FAB)**~~ — ✅ shipped (`457f3ef`). Comparison sheet + switch + condition chips + map duration badges; `recommended`→`activeRoute` refactor. Anchored to Figma `2:9033`. Spec + plan in `docs/archive/superpowers/`.
- ~~**BUILD — Refuel reminders (/search Fuel card)**~~ — ✅ shipped (Plan 1 `d9cb709` core + Plan 2 `1997010` on-route stops). Time-based reminder + car profile + /fuel screen + on-route fuel stops in /en-route.

## Visual fidelity / Figma drift

- ~~**Safety page matches v2 Figma + confirmation modal popup**~~ — verified 2026-05-31. `app/safety.tsx` cites Figma `1133:13908` v2 with documented v2 deltas; 4-tile layout shipped. The "confirmation modal popup" half of this entry has no design or code basis — speculative artifact from early ideation. Closed.
- ~~**Home bottom sheet matches the v2 version**~~ — verified 2026-05-31. The original Figma reference `1133:13690` here was the *single-row v2* sheet from way back; the multi-row layout was designed collaboratively in conversation, NOT from a Figma node. The vertical-stack-of-horizontal-carousels structure is live in `components/HomeBrowseSheet.tsx` with 7 rows (Trusted + Open Now + 5 categories). Closed; the Figma node citation was always a mismatch.
- ~~**Report modals match v2 design**~~ — verified 2026-05-31. `app/report.tsx` cites v2 Figma nodes (`984:5010` picker, `987:4291` / `992:4752` / `992:4933` details, `992:3933` thank-you) and implements the picker → detail → thank-you state machine with v2 typography + padding. Backlog entry was stale.
- ~~**Custom "community signal" icon for Round 4 surfaces**~~ — verified 2026-05-31. Both `trustedbycommunity-empty.svg` (64×64pt) AND `trustedbycommunity-empty-24.svg` (24×24pt) exist as imported assets in `HomeBrowseSheet.tsx` (lines 11, 29) and render in `TrustedByCommunityEmpty` (line 672). The Star placeholder has already been replaced. Closed.
- ~~**Edge markers match Figma (not placeholders)**~~ — shipped across #134–138 (`EdgeIndicator.tsx` cites Figma `1133:13250`). Component implements the full layered composition (42×62 polygon + 36pt disk + 24pt counter-rotated glyph, per-category routing). The "32pt pill with generic glyph" description here hasn't matched reality since the redesign rounds.
- ~~**Trusted contact text → body regular, not emphasized**~~ — already there. `ContactView` styles (`pulled-over.tsx:1669-1727`) use `title1Regular`/`subheadlineRegular`/`title2Regular`. No `bodyEmphasized` left to swap.
- ~~**Guidance flow has 24px padding**~~ — already there, via composition. `guidanceStyles.page` uses `paddingHorizontal: 8` inside the modal's 16pt safe-area gutter → 24pt effective. Inline comment at `pulled-over.tsx:1546-1550` explains the math.
- **Restore posted speed-limit sign on `/en-route`** — removed in Phase 3 PR E (2026-06-20) because the static '—' affordance taught users to distrust other data signals (Phase 1 P1-10). The current-speed pill above it stays correct and live. When an OSM `maxspeed` adapter ships and posted limits become available per route segment, restore the sign with real data — see the deleted styles in `git log -p -- app/en-route.tsx` for the visual register.

## Interaction polish

- ~~**Drag-and-drop icon swap**~~ — shipped in #184 (canonical `DragAndDrop` SVG from Figma `1114:10979`) + revised in #187 to a single clean teardrop pin after the canonical asset's two-pin stylization read as duplicate markers on a real map.
- ~~**Drag-and-drop pressure**~~ — closed. Drag attempted in #187 (PanResponder rewrite) then reverted: combining a drag gesture with the map's own pan recognizer made the interaction feel ambiguous. Tap-to-move is the only placement gesture now — friction-free for the common case, and the cancel/confirm row handles abort.
- ~~**Zone preferences dropdown doesn't collapse**~~ — moot as of `8ea29ac`: Zone Preferences moved to its own /zone-preferences page; the accordion no longer exists. The earlier "unanimated collapse is a deliberate workaround" trail-off is also resolved by the move (no collapse to animate).
- ~~**Map pin on-tap functionality**~~ — shipped. All variants wired: community report → `ReportDetailCard` (`home.tsx:818`), saved-home → recenter + selection haptic (`handleHomeMarkerPress`), trusted-friend → Call/Text Alert (`handleTrustedFriendMarkerPress`), cluster → fit-bounds zoom (`home.tsx:783`).
- ~~**Hold-to-delete on community-report markers**~~ — shipped. Author-only (`reportSubmittedBy === user.id`) long-press via `MapView.onLongPress` proximity hit-test → heavy haptic → destructive Alert confirm → `removeCommunityReport(id)`. `Zone` gained `reportSubmittedBy` field threaded from `CommunityReport.submittedBy`.
- **Recordings long-press → context menu / multi-select** — deferred from Phase 3 PR C (2026-06-20). Today: per-row Play / Share / Trash are individual taps. A long-press selection mode would unlock bulk-share alongside the existing bulk-delete and per-row reordering if that ever comes up. Not pilot-blocking; the per-row Share is the high-value half and shipped in #245.
- **Recordings bulk-share** — deferred from Phase 3 PR C. Bulk-delete exists; bulk-share doesn't. Needs the multi-select gesture above first.
- `**Sharing.isAvailableAsync` gating on /recordings Share button** — today the try/catch around `Sharing.shareAsync` covers the unavailable case (rare on iOS; the system Share Sheet is always present on supported devices). If user reports confirm a class of devices/configurations where it fails silently, gate the button render on `isAvailableAsync` instead.

## A18 — Heading wedge on /home user-location dot

- **UserLocationMarker gains a heading indicator.** Translucent systemBlue wedge fanning forward from the dot in the direction the user is facing — Apple Maps "you-are-here-and-facing-this-way" convention. **Scope: /home only.** /en-route already has heading via `EnRouteCarMarker` (car rotates with `heading` prop); adding a wedge there would be redundant.
- **Specs:** 60° wedge, ~25–30pt long beyond the dot's edge, systemBlue at 35% opacity. Rotates via `transform: [{ rotate: \`${heading}deg }]`on a wrapper View, behind the dot in z-order. Hidden when`heading == null`or`speed < 0.5 m/s` (direction unreliable at low speeds — show nothing rather than wrong info).
- **Plumbing:** `UserLocationMarker` gains `heading?: number | null` + `speed?: number | null` props. `/home` already runs `Location.watchPositionAsync`; the position object carries both fields. One-line change at the call site to pass them through.
- **Size:** ~30 LOC standalone PR. Independent of Mapbox/lane work — could ship anytime.
- **Design reference:** visual companion mockup at `.superpowers/brainstorm/97027-1779908977/content/heading-indicator.html`. Variant `60-systemblue` was selected.

## New features

- ~~**Connect-calendar Quick Tile (cut at v1)**~~ — ~~confirmed restored 2026-06-24: `showCalendarTile = !calendarLoading && !calendarConnected` live at menu.tsx:145; tile renders in setup carousel at line 356. Entry was stale.~~
- ~~**En-route search**~~ — ~~confirmed resolved 2026-06-24: Search button in ETA header (`EnRouteSearch` SVG, `router.push('/search?from=enroute')`, en-route.tsx:2207–2220). Entry was stale.~~
- ~~**Turn card "Then" arrow uses the actual next-next maneuver**~~ — ~~Fixed 2026-06-24: `maneuverIcon(activeRoute?.steps?.[(nextStepInfo?.index ?? -1) + 1]?.kind, 20, colors.fadedgreen)` replaces hardcoded `ArrowBendUpRight`. Falls back to NavigationArrow (straight) when no next-next step exists.~~
- ~~**Trip summary screen**~~ — shipped (C12: `app/trip-summary.tsx` — arrival inference-validation + "set as default" regular-destination flow).
- **Code the results page** — search results screen with map+sheet layout (Figma `1133:11400`). Currently /search returns a flat results list; the design is map-with-pins + sheet of result cards.

## Copy

- ~~**Update "thanks for recording" copy**~~ — there's no post-dismiss screen or toast to write copy for. The /pulled-over flow exits via iOS swipe-down directly back to /safety with no intermediate surface. Reframe as a feature (add a post-dismiss surface) if the safety-flow register would benefit from one — otherwise close.

## Round 4 — Discovery experiments

~~**Multi-row recommendations sheet (Google Maps-style)**~~ — **Round 4 closed (verified 2026-05-31).** Shipped via `BROWSE_ROW_SPECS` in `components/HomeBrowseSheet.tsx` (lines 407–415): 7 rows live — Row 1 "Trusted by your community" (the differentiator), Row 2 "Open now", Rows 3–7 per existing category. The chip-filter mode is preserved as the focus-mode (chip tap collapses to single-category browse). `useRecommendationsBatch()`-equivalent batch loading lives at lines 103–115. Entry was pre-ship planning framing that survived past the actual shipment.

## Round 5 — Safety surfaces + route-preview departure card

~~Four Figma nodes covering the v2 design pass for the safety surfaces AND the /home route-preview state.~~ **Round 5 closed (verified 2026-05-23).** All four nodes are shipped:

- ~~[Figma `1128:5284](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1128-5284&m=dev)~~` → `app/safety-settings.tsx` cites the node directly; shipped in Round 5 PR A.
- ~~[Figma `1133:12323](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1133-12323&m=dev)~~` → `app/recordings.tsx` main view; shipped in Round 5 PR A.
- ~~[Figma `1133:12674](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1133-12674&m=dev)~~` → `app/recordings.tsx` delete-all confirm modal; shipped in Round 5 PR A.
- ~~[Figma `1109:3264](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1109-3264&m=dev)~~` → `app/home.tsx` route-preview card; shipped across audit-9 + #215 (row pairing).

`app/pulled-over.tsx` 5-phase state machine + audio recording + trusted-contact footer + firearm-guidance ACLU copy all shipped previously. Backlog entry was stale.

## Formalized deviations (documented, not drift)

The following ship in code with no Figma backing — captured here so future fidelity audits don't auto-revert them:

- **All-clear chip + "Along this route:" preamble** on the route-preview card. Extension over Figma `1109:3264` (which only shows warning chips). The "we checked, you're clear" read is load-bearing for trust; an absent chips row read as "feature not loaded."
- **Topline variants on `RecommendationCard**` (`closing-soon`, `curator-attribution`). Top-left pill mirroring the existing bottom quote callout. Surfaces the row's load-bearing signal (hours / curator identity) on rows where it's the row's reason for existing.
- **Scroll-to-row chip behavior** (chips are jump-links, not filters). Focus mode retired. See #216.
- **Clear-destination X on route-preview** (top-right). Extension over Figma `1109:3264`; the affordance is needed in practice.
- **Round 6 `Button` border for AA contrast** (`primary+fill` variant). Documented brand exception so freshgreen-on-white passes the 3:1 UI-component contrast floor.
- **"Around Me: {category}" copy** on the focus-mode header — pinned per #210 as a deliberate Figma deviation (locator framing beats activity framing for community-data).

## Scaffolded-but-not-real (named preemptively at thesis defense)

Carried over from the old `docs/v2-followups.md` (folded in 2026-05-19). These are the gaps a thesis reviewer or a code walkthrough would notice. Better to name them in advance than be ambushed.

- ~~**Turn-by-turn instructions are static placeholder copy**~~ — **stale, shipped (verified 2026-06-02).** Mapbox Directions is the primary routing source with real `banner_instructions` + lane guidance (`80fda0e` PR1, `d59c2e3` PR2), OSRM `steps=true` is the fallback, and `/en-route` consumes `activeRoute.steps` live — GPS-driven next-maneuver selection rendering `step.instruction` with live distance ("Turn left onto Main St, in 0.3 mi"), lane strip, monotonic step advancement, arrival handling. The "Heading toward {destination}" copy is the graceful fallback for mock/no-network routes only, not the default. Entry predated the Mapbox integration; the matching en-route.tsx docblock was stale too (fixed same commit).
- ~~**Weather card is mocked at "66° / Moderate"**~~ — shipped: real Open-Meteo via `lib/api/weather.ts` (now incl. `cloud_cover`); driving label relabeled Easy/Moderate/Tough → Good/Fair/Poor.
- ~~**/safety modal has 3 of 4 tiles inert**~~ — **stale (verified 2026-06-02).** All four tiles in `app/safety.tsx` are wired: "I was pulled over" → `/pulled-over`, "Roadside assistance" → `/roadside`, "Unfamiliar area" → `/unfamiliar`, "Share my location" → `/share-location`. The `href: null` no-op state no longer exists.
- ~~**/menu has inert rows + Quick Tiles**~~ — **stale, shipped (verified 2026-06-02).** Plan 1's settings-register refresh (`7fc4cff`) rebuilt /menu entirely. The claimed inert rows ("Settings," "Schedule a drive," "Theme") and the decorative Quick Tiles carousel are gone; /menu now renders six real wired rows (Refuel reminders, Zone Preferences, Safety, Saved places, Privacy & Terms, Sign out) plus the progressive setup carousel.
- ~~**Reports submit as `'mock-user'**~~` — **stale (verified 2026-06-02).** `app/report.tsx:231` stamps `submittedBy: category.anonymous ? undefined : user?.id` — the real signed-in Apple user id, not a mock. `/report` photo capture is also real (`expo-image-picker`). Cross-device sync is **optional** — see **Supabase (B1)** below; without env vars, behavior is still device-local only.

## Accessibility gaps

- **VoiceOver hint long-tail sweep (Phase 3)** — PR 6 (2026-06-20) added `accessibilityHint`s to the share / roadside / unfamiliar safety flows and excluded `emergency.tsx` (already disambiguated). A second pass over `home.tsx`, the detail cards, and other partially-hinted surfaces for any remaining noun-labeled icon buttons was deferred to keep PR 6 bounded. Convention is now in `.cursorrules` (`## Accessibility (VoiceOver)`).
- ~~**ScrollView snap doesn't respect Reduce Motion**~~ — ~~confirmed resolved 2026-06-24: both scroll sites in HomeBrowseSheet gate `snapToInterval` and `decelerationRate` on `reduceMotion` (lines 492–493, 664–665).~~
- ~~**Carousel container has no `accessibilityRole="list"**~~` — ~~confirmed resolved 2026-06-24: `accessibilityRole={'list' as any}` at HomeBrowseSheet.tsx lines 495 and 667.~~
- `~~**cardTitle` doesn't truncate at AX5**~~ — **stale (verified 2026-06-02).** `HomeBrowseSheet.tsx:1039` cardTitle has `numberOfLines={2}` (+ `adjustsFontSizeToFit minimumFontScale={0.85}`). Truncation is handled.
- ~~**Saved-home + trusted-friend markers don't get a `selected` state**~~ — ~~confirmed resolved 2026-06-24: LandmarkMarker has `selected` prop (default false) with scale transition (0.65× unselected → 1× selected) and re-snapshot on flip. Lines 186, 207, 275.~~
- ~~**Cluster marker + placement pin missing `accessibilityRole**~~` — ~~confirmed resolved 2026-06-24: ClusterMarker has `role="button"` (line 51); placement pin has `role="none"` + descriptive label (intentional — coordinate indicator, not interactive image); LandmarkMarker has `role="button"` at both Marker sites.~~
- ~~**Dynamic Type expansion** — only ~3 `dynamicType()` invocations~~ — **stale (2026-06-25).** Typography PR #252 + prior sweeps; 200+ call sites. AX5 device testing remains the non-code piece.
- ~~**Daylight gradient is color-only signaling (WCAG 1.4.1 failure)**~~ — **substantially fixed (2026-06-02).** `lib/daylight.ts` exposes `DAYLIGHT_DASH_PATTERN` (solid = day, dashes = twilight, dots = night); `/home`'s route-preview polyline consumed it, and `/en-route`'s active-route polyline now does too (`9e2fe5d`, the impeccable audit fix) — so the non-color cue rides the line on both the preview and the live drive. **Legend (2026-06-25):** `DaylightRouteLegend` adds solid → dashed → dotted swatches under the gradient strip on `/home` and in `/en-route`'s expanded sheet; `DAYLIGHT_LEGEND_A11Y_LABEL` narrates dash density = less light. Remaining (optional): per-mile inline narration ("daylight for first 12 mi…") if a fuller text channel is wanted later.

## Visual / polish nits

- ~~**Cold-start map shows Mobile, AL until GPS resolves**~~ — shipped in #217. One-shot useEffect watches `userLocation` and `animateToRegion`s on first non-null fix (1000ms, instant under Reduce Motion). Ref-guarded so subsequent GPS updates don't yank the user's pan/zoom.
- ~~**EdgeIndicator count="1" pill**~~ — already handled at `EdgeIndicator.tsx:85` via `showCount = count != null && count > 1`. Singletons fall through to the category glyph. Backlog entry was stale.
- ~~**Cluster marker missing `tracksViewChanges` lifecycle**~~ — ~~confirmed resolved 2026-06-24: `useState(true) → setTimeout(50ms) → false` at ClusterMarker.tsx lines 38–42. Same pattern as LandmarkMarker/DestinationMarker.~~
- ~~**Curated-fallback distance pill is jarring**~~ — shipped in #217. `annotateDistance` leaves `distanceMiles` undefined for curated entries beyond 50mi from the user; the card already gates the pill on `!= null`. Mobile-area users keep the useful read.
- ~~**Rapid chip tapping causes flicker**~~ — closed by #216 (chips-as-jump-links). Chips no longer trigger per-tap fetches or `LayoutAnimation`; rapid taps just animate the vertical scroller to the latest target.
- ~~**"Coming soon" Alert mid-report / Schedule flow**~~ — ~~confirmed resolved 2026-06-24: no "coming soon" strings remain in home.tsx or report.tsx. Both report photo (expo-image-picker) and Schedule notification CTA are real. Entry fully stale.~~

## Architecture / data v2

- ~~**User auth + report sync (backend TBD)**~~ — **adapter seam shipped (B1, `feat/community-cloud-b1`).** `lib/api/sources/community-cloud.ts` + merged reads in `community-reports.ts`. **No Supabase account required for thesis** — unset env = local-only (unchanged). Cross-phone demo needs setup in **Supabase (B1)** below. `submittedBy` already uses real Apple ids locally; cloud unlocks *other* phones seeing your reports.

### Supabase (B1) — optional community-report cloud

**You don't need an account to build or demo on one device.** The app ignores cloud when `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are missing from `.env.local`.

**When you want two-phone community sync (or thesis "shared community" story):**

1. **Create a free Supabase project** — [supabase.com](https://supabase.com) → New project → note **Project URL** + **anon public** key (Settings → API).
2. **Add to `.env.local`** (gitignored; template in `.env.example`):
  - `EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...`
3. **Create table** `community_reports` in SQL editor (column names must match adapter — snake_case):
  ```sql
   create table public.community_reports (
     id text primary key,
     category_id text not null,
     location jsonb not null,
     detail text,
     sub_tag text,
     place_name text,
     google_place_id text,
     submitted_by text,
     photo_uri text,
     timestamp bigint not null
   );
  ```
4. **RLS (thesis-minimal)** — tighten later for production:
  - Enable RLS on the table.
  - Policy: allow **anon SELECT** (read all reports for demo).
  - Policy: allow **anon INSERT** (submit from app) and **anon DELETE** (Undo / hold-to-delete) — or restrict INSERT/DELETE to authenticated users once auth is wired to Supabase.
5. **Restart Expo** so env vars load.
6. **QA** — same keys on two simulators/devices: submit on A → focus `/home` on B → orange eye pin should appear. Photos stay **local-only** in v1 (`photo_uri` in cloud is usually null until an upload PR exists).

**Code map:** `lib/api/sources/community-cloud.ts` (fetch / push / queue), `docs/archive/superpowers/plans/2026-06-04-corridor-data-richness.md` Task B1, `docs/learnings.md` → `feat/community-cloud-b1`.

**Don't want Supabase at all?** Stay local-only for the thesis; corridor B0/B4/B5 are unrelated. Alternative later: `/api/reports` on the existing Vercel proxy (no second vendor) — not specced yet.

- ~~**Real photo capture in /report**~~ — **stale, shipped (verified 2026-06-02).** `app/report.tsx` uses `expo-image-picker` — `requestCameraPermissionsAsync` + `launchCameraAsync` (camera capture only, copied out of the picker's cache), with a `photoUri` state. Real, not a stub.
- ~~**Schedule CTA → expo-notifications**~~ — shipped: `scheduleDepartureNotification` fires a real local notification (inline permission request) at the suggested departure.
- **Curated catalog as catastrophic fallback feels invisible** — only fires when external + community both empty. With Google Places returning worldwide results, curated rarely runs. Consider letting curated participate when it's category-appropriate AND user is near the curated entry's region.
- **Demo-mode toggle / offline seed** — a `/menu` switch that swaps the external adapter for a richer curated catalog (more cities, more cards, real photos) would let you demo without internet anxiety.
- **Bespoke SVG glyphs for v2 sub-tags** — currently Phosphor fallbacks (HandHeart / Heart / Toilet / MoonStars). Swap when Figma exports land. Track alongside the Round-4 custom community-signal icon.
- **Yelp / EatOkra adapter** — Yelp went paid; EatOkra has no public API. Deferred until either landscape changes.

## Workflow note

The `v1.0-thesis` tag marks the submitted state. Any of these items can land in iteration commits past that tag without affecting the submitted snapshot — `git checkout v1.0-thesis` always returns reviewers to exactly what was submitted.

## Audit 2026-05-31 — backlog flow-in

Findings from `docs/archive/audits/2026-05-31-app-wide-fidelity-audit.md`. Critical + Important + Minor only (Notes live in the audit doc). Strike through on landing per workflow Step 11.5.

### Project-wide

- ~~**[PROJECT] Ionicons leak across 8 surfaces (Phosphor-only rule)**~~ — **stale, done (verified 2026-06-02).** Zero non-Phosphor icon imports remain anywhere (`rg` for `@expo/vector-icons` / `Ionicons` / `react-native-vector-icons` imports → empty; the only "Ionicons" hits are docblock comments saying "was previously Ionicons"). The per-surface closures (`a481cff` et al.) completed the sweep.
- ~~**[PROJECT] Missing `dynamicType()` on 8 non-/safety surfaces**~~ — **stale, done (verified 2026-06-02).** 140 `dynamicType()` invocations across 27 files; every named surface (/home, /en-route, /menu, /search, /recordings, /trip-summary, /trusted-contact-setup, /fuel) has its per-surface closure struck below.
- **[PROJECT] Honesty-of-disclosure overpromise across 7 surfaces** — [Audit 2026-05-31 §Cross-cutting PROJECT-C, Critical] per-surface copy tightening + render-gating. Anchor instances: /pulled-over F1, /trusted-contact-setup F3, /legal F1.
- **[PROJECT] Raw spacing integers / token-discipline drift across 4 surfaces** — [Audit 2026-05-31 §Cross-cutting PROJECT-D, Important] /search (25+), /safety (SOSBar, documented), /en-route (`rgba()` + `#000` literals), /menu (verify). **Partial 2026-06-23** (`polish/spacing-radii-pass`): /search + /en-route spacing tokenized. Remaining: /safety + SOSBar spacing, /menu spacing verify, and the cross-cutting `rgba()` / `#000` color-literal drift on /en-route (separate dimension from this pass).
- **[PROJECT] Stale or missing v2-deltas docblocks (emerging)** — [Audit 2026-05-31 §Cross-cutting PROJECT-E, Important] /home `app/home.tsx:1516` cites stale Figma `1133:13690`; /en-route `app/en-route.tsx:101-118` lacks consolidated deltas block.

### /pulled-over

- ~~**[/pulled-over] TrustedContactStatus claims active notification while wiring is decorative**~~ — ✅ closed `3cf2389` (TrustedContactStatus refactored — gated on contact, pulse dropped, copy now forward-looking). Original audit context: [Audit 2026-05-31 §/pulled-over F1, Critical] gate render on `useTrustedContact().contact`; revise copy at `components/TrustedContactStatus.tsx:27` (rendered `app/pulled-over.tsx:527`).
- **[/pulled-over] Recording footnote elides "we don't auto-share" claim** — [Audit 2026-05-31 §/pulled-over F2, Important] tighten copy at `app/pulled-over.tsx:797-799`.
- **[/pulled-over] "Tap to continue" hint contradicts calming-pause intent** — [Audit 2026-05-31 §/pulled-over F3, Important] `app/pulled-over.tsx:605` → "Tap when ready" or "Tap to skip ahead."
- **[/pulled-over] `officerStyles.emphasis` reaches into another token's `fontWeight`** — [Audit 2026-05-31 §/pulled-over F4, Minor] use `<Strong>` helper at `app/pulled-over.tsx:1997`.
- **[/pulled-over] RecordingChip a11y label says "minutes" even at 0** — [Audit 2026-05-31 §/pulled-over F5, Minor] `app/pulled-over.tsx:847`.

### /en-route

- ~~**[/en-route] Bottom-sheet typography not wrapped in `dynamicType()**~~` — ✅ closed `6189847` (9 bottom-sheet styles wrapped; endTripBtn lifted to minHeight). Original audit context: [Audit 2026-05-31 §/en-route F1, Important] wrap at `app/en-route.tsx:2143, 2147, 2162, 2173, 2223, 2231, 2227, 2079, 2269`; lift `endTripBtn.height: 52` → `minHeight`.
- **[/en-route] Raw `rgba()` and hex literal in styles** — [Audit 2026-05-31 §/en-route F2, Important] tokens at `app/en-route.tsx:1959, 2064`.
- ~~**[/en-route] Ionicons leak inside en-route surface**~~ — ✅ closed `a481cff` (All en-route + RouteComparisonSheet + FuelStopsSheet icons Phosphor). Original audit context: [Audit 2026-05-31 §/en-route F3, Important] `app/en-route.tsx:13, 1723`; `components/RouteComparisonSheet.tsx:1,54,78,91`; `components/FuelStopsSheet.tsx:1,51`.
- ~~**[/en-route] Speed limit hardcoded to 25 mph**~~ — **stale (2026-06-25).** Posted limit sign removed (Phase 1 P1-10 / honesty audit); current-speed pill only. Restore when OSM `maxspeed` adapter ships — see Visual fidelity "Restore posted speed-limit sign."
- **[/en-route] No consolidated v2-deltas docblock** — [Audit 2026-05-31 §/en-route F5, Important] add at `app/en-route.tsx:101-118`.
- **[/en-route] No empty-state when location permission denied** — [Audit 2026-05-31 §/en-route F6, Important] `app/en-route.tsx:848-927`.
- **[/en-route] Turn-card a11y wrapper doesn't surface hazards / offline state** — [Audit 2026-05-31 §/en-route F7, Important] promote `turnSign` View to `accessible` with composite label.
- **[/en-route] LiveSafetySheet collapsed pill overlaps en-route bottom sheet** — [Audit 2026-05-31 §/en-route F8, Important] anchor above measured `bottomSheetHeight`.
- **[/en-route] Route-badge marker a11y uses only duration** — [Audit 2026-05-31 §/en-route F9, Minor] `app/en-route.tsx:1271`.
- **[/en-route] Speed-limit "SF Pro Bold stand-in for Overpass Bold"** — [Audit 2026-05-31 §/en-route F10, Minor] no canonical Overpass font queued.
- **[/en-route] Dead `turnDistance`/`turnDistanceUnit` styles** — [Audit 2026-05-31 §/en-route F11, Minor] `app/en-route.tsx:1910-1917`.

### /home

- **[/home] Stale Figma citation `1133:13690`** — [Audit 2026-05-31 §/home F1, Important] update at `app/home.tsx:1516`; reconcile against `HomeBrowseSheet.tsx:44` (`1114:9047`).
- **[/home] Outdated browse-mode docblock** — [Audit 2026-05-31 §/home F2, Important] `app/home.tsx:1514-1518` describes single-card; shipped is 7-row.
- ~~**[/home] SearchBar uses Ionicons (most-seen UI in the app)**~~ — ✅ closed `a481cff` (MagnifyingGlass/Microphone/CaretLeft/XCircle in SearchBar). Original audit context: [Audit 2026-05-31 §/home F3, Critical] `components/SearchBar.tsx:1, 65, 130`. Folds into PROJECT-A; called out separately for blast-radius.
- ~~**[/home] Browse-sheet section/eyebrow/topRow titles missing Dynamic Type**~~ — ✅ closed `73e53dd` (Browse-sheet section/eyebrow/cardTitle etc. wrapped). Original audit context: [Audit 2026-05-31 §/home F4, Important] `components/HomeBrowseSheet.tsx:1244-1257, 1328-1332, 1457-1462, 1494-1504`.
- ~~**[/home] Carousel `cardTitle` uses `adjustsFontSizeToFit` (wrong primitive)**~~ — ✅ closed `73e53dd` (adjustsFontSizeToFit removed; dynamicType applied). Original audit context: [Audit 2026-05-31 §/home F5, Important] `HomeBrowseSheet.tsx:1039` — shrinks under pressure, opposite of AX5.
- ~~**[/home] `StateCard.card` fixed `width: 326**~~` — ✅ closed `a916e6a` (StateCard.card width: 326 → maxWidth). Original audit context: [Audit 2026-05-31 §/home F6, Important] `components/StateCard.tsx:128`.
- **[/home] "Safest route" caption renders before zones load or with empty zones** — [Audit 2026-05-31 §/home F7, Important] gate at `app/home.tsx:1831` on `enabledZones.length > 0 && !isCalculatingRoute`.
- **[/home] Cold-start race: `bottomSheetHeight` vs `fabAnchorHeight` lock** — [Audit 2026-05-31 §/home F8, Important] `app/home.tsx:1541-1551`; closed-form anchor proposed.
- **[/home] `routeArrival` "arrive {time}" lowercase** — [Audit 2026-05-31 §/home F9, Minor] `app/home.tsx:1754`.
- ~~**[/home] Route-preview labels use spread `typography.*` without `dynamicType**~~` — **stale (2026-06-25, PR #252).** `placementHint`, chips, footnotes wrapped.
- **[/home] `WeatherDrivingCard` glyphs are condition-agnostic** — [Audit 2026-05-31 §/home F11, Important] `HomeBrowseSheet.tsx`. Partially closed (`feat/home-weather-driving-glyphs`): the monochrome Phosphor `CloudSun`/`SteeringWheel` were swapped for the bespoke multi-color Figma illustrations (`weather-glyph.svg`/`driving-glyph.svg`, node 1100:8749) to match the design source of truth. Still open: the weather glyph is a single static partly-cloudy illustration regardless of the actual sky — `CurrentWeather` exposes `cloudCoverPct` (and could add Open-Meteo's `weather_code`) but no glyph keys off it. Making it condition-aware needs a glyph set (clear / cloudy / rain / etc.) + a `cloudCoverPct`-or-`weather_code`→glyph map.
- ~~**[/home] `weatherCard` icon/text hierarchy inconsistent**~~ — [Audit 2026-05-31 §/home F12, Minor] icon `labelSecondary` vs text `labelTertiary`. Obsoleted by `feat/home-weather-driving-glyphs`: the glyphs are now multi-color illustrations with no monochrome tint, so the icon-vs-text color mismatch no longer exists.
- **[/home] `UserLocationMarker` pulse animation runs forever** — [Audit 2026-05-31 §/home F14, Minor] lines 78-85. Defensible-by-comment.
- **[/home] `daylightStripInline` `accessibilityElementsHidden`** — [Audit 2026-05-31 §/home F15, Minor] defensible-by-comment.
- **[/home] Identical haptic for home + trusted-friend markers** — [Audit 2026-05-31 §/home F17, Minor] consider `impactAsync(Light)` for trusted-friend.

### /search

- **[/search] Results-phase search-bar mismatches Figma `1105:6462` left-icon variant** — [Audit 2026-05-31 §/search F1, Important] intentional but not disclosed in docblock.
- **[/search] "More results for X" affordance from Figma results node absent** — [Audit 2026-05-31 §/search F2, Important] Mapbox Search Box pages; surface it.
- ~~**[/search] 25+ raw integer spacings**~~ — ✅ **Done 2026-06-23** (`polish/spacing-radii-pass`). All three files swept (search.tsx 24 sites, SearchBar.tsx 3 sites; StateCard borderRadius:16 also tokenized to radii.lg in the radii pass).
- ~~**[/search] SearchBar uses Ionicons**~~ — ✅ closed `a481cff` (Same SearchBar fix as /home F3). Original audit context: [Audit 2026-05-31 §/search F4, Important] `SearchBar.tsx:1, 65, 130`. Folds into PROJECT-A.
- ~~**[/search] Zero `dynamicType()` calls across the three files**~~ — ✅ closed `a916e6a` (search.tsx + SearchBar + StateCard swept). Original audit context: [Audit 2026-05-31 §/search F5, Important] folds into PROJECT-B.
- **[/search] Quick Tools horizontal ScrollView lacks `tablist` semantics** — [Audit 2026-05-31 §/search F6, Minor] `app/search.tsx:520-569`.
- **[/search] `userLocation` failure silently downgrades ErrorState to transient** — [Audit 2026-05-31 §/search F7, Minor] permission denied is hard wall.
- ~~**[/search] Saved-row a11y label period-as-separator**~~ — **stale, fixed `57055bf` (2026-06-02).** Label now uses a comma (`Route to ${name}, ${subtitle}`) so VoiceOver reads one phrase; an `accessibilityHint` was added too.

### /roadside

- ~~**[/roadside] `WrongSpotModal` input bypasses `dynamicType()**~~` — **stale (2026-06-25).** `styles.input` uses `dynamicType(typography.bodyRegular)`.
- **[/roadside] Missing empty-string defensive bail on sanitized phone** — [Audit 2026-05-31 §/roadside F2, Minor] line 302 — references `audit/safety-polish` class-of-bug.

### /menu

- ~~**[/menu] Ionicons chevrons violate Phosphor-only**~~ — ✅ closed `a481cff` (Menu chevron-back + SettingsRow chevron-forward → CaretLeft/CaretRight). Original audit context: [Audit 2026-05-31 §/menu F1, Important] `app/menu.tsx:1, 202, 520-524`. Folds into PROJECT-A.
- ~~**[/menu] No Dynamic Type on any text node**~~ — ✅ closed `36d03db` (Menu profileGreeting/profileName/rowLabel/zoneInnerLabel/zoneGroupCaption/tile/signOutText wrapped). Original audit context: [Audit 2026-05-31 §/menu F2, Important] lines 587-733. Folds into PROJECT-B.
- **[/menu] Sign-out `Promise.all` masks per-adapter errors** — [Audit 2026-05-31 §/menu F3, Minor] lines 172-179 — use `Promise.allSettled` + console.warn.
- **[/menu] Avatar image has no `onError` / fallback** — [Audit 2026-05-31 §/menu F4, Minor] lines 218-224.

### /recordings

- ~~**[/recordings] Back chevron Ionicons (re-graded from Minor)**~~ — ✅ closed `a481cff` (Recordings chevron-back → CaretLeft). Original audit context: [Audit 2026-05-31 §/recordings F1, Important] lines 1, 174. PROJECT-A retires the "de-facto convention" defense.
- ~~**[/recordings] No Dynamic Type / `relaxedLineHeight**~~` — ✅ closed `2a8cd20` (Recordings pageTitle/cardTimestamp/cardSecondary/confirmTitle/confirmBody wrapped). Original audit context: [Audit 2026-05-31 §/recordings F2, Minor] lines 454, 499, 507, 587, 594. Folds into PROJECT-B.

### /unfamiliar

- ~~**[/unfamiliar] "Saves your journey periodically" overstates v1 behavior**~~ — **stale (2026-06-25).** Copy removed; step 2 reads "Your contact already has a text draft in Messages."
- **[/unfamiliar] Auto-share-on-Step-1-pick has no inline disclosure** — [Audit 2026-05-31 §/unfamiliar F2, Minor] lines 99-102.
- **[/unfamiliar] No-results / Search-failed Alerts collapse state silently** — [Audit 2026-05-31 §/unfamiliar F3, Minor] lines 120-126, 135-141.

### /trip-summary

- ~~**[/trip-summary] Title + stats + inference copy not wrapped in `dynamicType()**~~` — ✅ closed `d4e5141` (trip-summary title/destination/statValue/statLabel/inferenceHeading/Sub/Label/Result wrapped). Original audit context: [Audit 2026-05-31 §/trip-summary F1, Important] lines 349, 353, 363, 368, 378, 382, 396, 422. Folds into PROJECT-B.
- **[/trip-summary] "Remember this destination" silently no-ops when `destLat`/`destLng` absent** — [Audit 2026-05-31 §/trip-summary F2, Important] `trip-summary.tsx:181-200` — disable CTA or show inline error. (Copy renamed from "Set as default" in P1-12.)
- **[/trip-summary] Title/inferenceHeading register inconsistency** — [Audit 2026-05-31 §/trip-summary F3, Minor] `title1Regular` vs `title3Emphasized` at line 378.
- **[/trip-summary] No haptic on Confirm/Dismiss or Set-as-default success** — [Audit 2026-05-31 §/trip-summary F4, Minor] lines 159-202.

### /trusted-contact-setup

- ~~**[/trusted-contact-setup] Ionicons `chevron-back**~~` — ✅ closed `a481cff` (trusted-contact-setup chevron-back → CaretLeft). Original audit context: [Audit 2026-05-31 §/trusted-contact-setup F1, Important] lines 1, 173. Folds into PROJECT-A.
- ~~**[/trusted-contact-setup] No `dynamicType()` / `relaxedLineHeight` despite canonical-AX5-reference status**~~ — ✅ closed `3eaa95b` (title/body/previewName/previewPhone wrapped — canonical AX5 ref now follows its own rule). Original audit context: [Audit 2026-05-31 §/trusted-contact-setup F2, Important] lines 337-352. Direct contradiction of learnings.
- ~~**[/trusted-contact-setup] "Alerts this person during emergencies" overpromises v1 (re-graded from Important)**~~ — ✅ closed `25a2654` (Body copy rewritten: "every call and text is yours to send"). Original audit context: [Audit 2026-05-31 §/trusted-contact-setup F3, Critical] `app/trusted-contact-setup.tsx:186-189`. Anchor finding for PROJECT-C.
- **[/trusted-contact-setup] Error text has no live-region announcement and no haptic** — [Audit 2026-05-31 §/trusted-contact-setup F4, Minor] lines 249, 121-126.

### /legal

- ~~**[/legal] Ionicons used on the page asserting Phosphor MIT in terms.md**~~ — ✅ closed `a481cff` (/legal chevron-back → CaretLeft). Original audit context: [Audit 2026-05-31 §/legal F1, Critical] `app/legal.tsx:1, 74`. The internal contradiction is the thesis hit.
- **[/legal] JSX drops Mapbox URL + "(the map provider)" parenthetical** — [Audit 2026-05-31 §/legal F2, Important] line 125.
- **[/legal] JSX omits four Privacy sections** — [Audit 2026-05-31 §/legal F3, Important] missing "What we do *not* collect", "Children" (COPPA), "Contact", "Sign out cleanup."
- **[/legal] JSX omits Terms sections (incl. Phosphor MIT line that conflicts with F1)** — [Audit 2026-05-31 §/legal F4, Important] missing "What Fresh Greens is", "Your account and data", "Intellectual property", "Governing law", "Contact"; limitation-of-liability text shorter than markdown.
- **[/legal] Limitations tab missing "We are not selling your data" + effective date** — [Audit 2026-05-31 §/legal F5, Important] lines 244, 302.
- **[/legal] Tab row missing `accessibilityRole="tablist"`** — [Audit 2026-05-31 §/legal F6, Important] lines 81-103.
- **[/legal] `•` literal bullet glyph not flagged decorative-hidden** — [Audit 2026-05-31 §/legal F7, Minor] lines 351-353.
- **[/legal] No scroll-to-top reset / no `onScroll` activeSection sync** — [Audit 2026-05-31 §/legal F8, Minor] lines 53-57 — pill desyncs.

### /safety

- **[/safety] Raw spacing literals in SOSBar (documented tech debt)** — [Audit 2026-05-31 §/safety F1, Minor] lines 322-347.
- **[/safety] `header.gap: 16` / `titleBlock.gap: 8` raw literals** — [Audit 2026-05-31 §/safety F2, Minor] lines 255, 266.
- **[/safety] SOS Pressable lacks `accessibilityHint`** — [Audit 2026-05-31 §/safety F3, Minor] lines 204-217.

### /share-location

- **[/share-location] `aspirationalNote` style identifier semantic mismatch** — [Audit 2026-05-31 §/share-location F2, Minor] lines 164, 202-207 — rename `reasonNote`.
- **[/share-location] End-sharing CTA asymmetry — verify dignity rationale inline** — [Audit 2026-05-31 §/share-location F3, Minor] add WHY comment.

### /fuel

- ~~**[/fuel] Ionicons usage drifts from Phosphor**~~ — ✅ closed `a481cff` (/fuel chevron-back + Plus/Minus steppers). Original audit context: [Audit 2026-05-31 §/fuel F1, Important] lines 1, 116, 168, 179. Folds into PROJECT-A.
- ~~**[/fuel] No Dynamic Type / line-height policy**~~ — ✅ closed `062546f` (/fuel title/fieldLabel/input/segmentText/stepValue/toggleLabel/statusText/CTAlabels wrapped). Original audit context: [Audit 2026-05-31 §/fuel F2, Important] lines 236-307. Folds into PROJECT-B.
- **[/fuel] Segmented fuel-type buttons lack composite label; toggle row lacks role** — [Audit 2026-05-31 §/fuel F3, Important] lines 148-150, 183-192.
- **[/fuel] "Next reminder" hides time-of-day reality of TIME_INTERVAL** — [Audit 2026-05-31 §/fuel F4, Minor] lines 92-99, 196 — add WHY comment or surface time.
- **[/fuel] No haptic on Save / "I filled up"** — [Audit 2026-05-31 §/fuel F5, Minor].

