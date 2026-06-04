# App-wide Fidelity Audit — 2026-05-31

Branch: `audit/app-wide-fidelity`. Synthesis of 14 per-surface reports. Last gate before portfolio + thesis defense.

## Executive summary

**State per dimension:**
- **Polish:** Strong on disciplined surfaces (/safety, /share-location, /roadside, /recordings) — drifts on token discipline at /search and on icon library across 8 surfaces. Inline hex and rgba leaks isolated to /en-route.
- **Fidelity:** Stale docblocks/Figma citations at /home and /en-route are the only real drift; everywhere else divergences are either documented or chat-defined-canonical.
- **A11y:** AX5 / Dynamic Type adoption stops at the `ax5/safety-surfaces` scope line. Eight surfaces outside that scope ship without `dynamicType()` wraps — including the canonical-reference surface /trusted-contact-setup.
- **Reliability:** Mostly defensible. Genuine empty-state gaps at /en-route (no location permission) and a cold-start race at /home. Local-only persistence well-documented in /legal.
- **Concept (honesty of disclosure):** The thesis-critical dimension. Seven surfaces overpromise in ways the v1 wiring can't back: /pulled-over (Trusted Contact pulse), /trusted-contact-setup ("alerts this person"), /unfamiliar ("saves your journey periodically"), /en-route (hardcoded 25mph), /home ("Safest route" before zones), /trip-summary (silent no-op CTA), /legal (JSX subset of canonical markdown — including using Ionicons on the page that asserts Phosphor MIT).

**Top 5 surfaces by finding density (Critical + Important + Minor):**
1. **/home** — 1 Critical (re-graded), 7 Important, 5 Minor (18 total inc. Notes)
2. **/en-route** — 0 Critical, 8 Important, 4 Minor (13 total)
3. **/legal** — 1 Critical, 5 Important, 2 Minor (9 total)
4. **/pulled-over** — 1 Critical, 2 Important, 2 Minor (7 total)
5. **/trusted-contact-setup** — 0 Critical, 3 Important (one re-graded from "Important" with sharper framing), 1 Minor (5 total)

**Must-fix-before-portfolio shortlist (ranked, 8 items):**

1. **[Critical] /pulled-over F1 — TrustedContactStatus claims notification while wiring is decorative.** `components/TrustedContactStatus.tsx:27` rendered on armed/transition/guidance phases in `app/pulled-over.tsx:527`. Gate render on `useTrustedContact().contact`; revise copy to behavior-honest framing. Thesis-load-bearing — Fresh Greens' anti-tracker stance fails if the most stressful screen in the app makes a notification claim it can't back.
2. **[Critical, re-graded] /trusted-contact-setup F3 — "alerts this person during emergencies and shares your location with them."** `app/trusted-contact-setup.tsx:186-189`. Same honesty class as /pulled-over F1; the original report tiered it Important but this synthesis promotes it to Critical for symmetry. The surface is cited as the canonical onboarding-honesty reference; an unhedged promise on the canonical screen is the worst possible place for it.
3. **[Critical] /legal F1 — Ionicons used on the page that asserts Phosphor MIT in terms.md.** `app/legal.tsx:1, 74`. Lying in /legal undermines the whole thesis. Swap to Phosphor `CaretLeft`.
4. **[Critical, project-wide] PROJECT-A — Ionicons leak across 8 surfaces, violating Phosphor-only memory rule.** See Cross-cutting Pattern A. SearchBar is the highest-leverage carrier (every cold launch + every /search visit). The "defensible-by-convention" framing in /recordings F1 is rejected — eight surfaces means the convention is "we forgot to migrate," not "we chose."
5. **[Critical, project-wide] PROJECT-B — Missing `dynamicType()` on 8 non-`/safety` surfaces.** See Cross-cutting Pattern B. Includes /trusted-contact-setup which learnings cite as the canonical AX5 reference — a direct contradiction.
6. **[Critical, project-wide] PROJECT-C — Honesty-of-disclosure overpromise (7 surfaces).** See Cross-cutting Pattern C. Each individual instance is Important on its own; the pattern is Critical because honesty is the thesis spine.
7. **[Important] /home F3 — SearchBar uses Ionicons.** `components/SearchBar.tsx:1, 65, 130`. Most-seen UI surface in the app violating the explicit project rule. Folded into PROJECT-A but called out separately because its blast radius is highest.
8. **[Important] /en-route F4 — Speed limit hardcoded to 25 mph.** `app/en-route.tsx:1507`. Hide when unknown OR show "—" with "Limit unknown" a11y label. Subset of PROJECT-C but mechanically the easiest fix in the bunch.

**Defensible-imperfect-on-purpose list (Minor with documented rationale):**

- /safety F1, F2 — raw spacing literals in SOSBar (self-acknowledged tech debt, in backlog).
- /trip-summary F5 — `handleAccept` swallows `addCommunityReport` failures with optimistic state (documented in code).
- /trusted-contact-setup F5 — Contacts permission denial silently degrades Trusted Friend marker (documented design choice).
- /share-location F1 — ActiveView subtitle "Sharing your location" is aspirational; v1 simulation is documented in thesis stance + /legal.
- /fuel F4 — "Next reminder" hides time-of-day reality of TIME_INTERVAL trigger. Acceptable trade-off given local-notification constraints; could earn a defensive WHY comment.
- /home F14 — UserLocationMarker pulse animation runs after `tracksViewChanges={false}`; acknowledged in code comment.
- /home F15 — `daylightStripInline` `accessibilityElementsHidden`, defensible-by-comment.
- /en-route F13 — "Demo route" copy + straight-line mock waypoints. Narratively flag in thesis defense; copy is honest.

## Cross-cutting patterns

### PROJECT-A | Critical | Ionicons leak (Phosphor-only memory rule) — 8 surfaces

**Affected:** /home (`components/SearchBar.tsx:1, 65, 130`), /search (same SearchBar), /menu (`app/menu.tsx:1, 202, 520-524`), /recordings (`app/recordings.tsx:1, 174`), /trusted-contact-setup (`app/trusted-contact-setup.tsx:1, 173`), /legal (`app/legal.tsx:1, 74`), /fuel (`app/fuel.tsx:1, 116, 168, 179`), /en-route (`app/en-route.tsx:13, 1723`, `components/RouteComparisonSheet.tsx:1,54,78,91`, `components/FuelStopsSheet.tsx:1,51`).

**Re-grade:** /recordings F1 was Minor with "defensible-by-project-convention" framing. The convention defense weakens past 3 surfaces; at 8, it inverts — the pattern is migration debt, not a conscious carve-out. Promoting all individual flags to Important; promoting the cross-cutting pattern itself to Critical because /legal F1 hosts the contradiction (Phosphor MIT claim while importing Ionicons on the same page).

**Fix shape:** Phosphor `CaretLeft` for chevron-back uniformly. `MagnifyingGlass` for SearchBar. Audit-style PR scoped narrowly to icon swaps; no behavioral changes.

### PROJECT-B | Critical | Missing `dynamicType()` on non-/safety surfaces — 8 surfaces

**Affected:** /home (browse-sheet titles, route-preview labels — `HomeBrowseSheet.tsx:1244-1257, 1328-1332, 1457-1462, 1494-1504` + `app/home.tsx` cluster from F10), /en-route (bottom-sheet typography F1), /menu (all text nodes), /search (zero `dynamicType()` calls across `app/search.tsx`, `SearchBar.tsx`, `StateCard.tsx`), /recordings (lines 454, 499, 507, 587, 594), /trip-summary (lines 349-422), /trusted-contact-setup (lines 337-352 — directly contradicts learnings-cited canonical-reference framing), /fuel (lines 236-307).

**Severity:** Critical at the pattern level. `ax5/safety-surfaces` scoped only /safety + /pulled-over + a few canonical references; everything outside that scope shipped without the wrap. The /trusted-contact-setup instance is the sharpest contradiction — learnings cite it as canonical, code doesn't honor it.

**Fix shape:** Sweep-style PR mirroring `ax5/safety-surfaces`. Wrap each `typography.*` spread in `dynamicType()`; add `relaxedLineHeight()` to long-read styles; convert fixed `height` to `minHeight` on tap targets.

### PROJECT-C | Critical | Honesty-of-disclosure overpromise — 7 surfaces

**Affected:**
- /pulled-over F1 — TrustedContactStatus pulse claims notification with no wiring (`components/TrustedContactStatus.tsx:27`).
- /pulled-over F2 — recording footnote elides "we don't auto-share" (`app/pulled-over.tsx:797-799`).
- /en-route F4 — speed limit hardcoded to 25 mph (`app/en-route.tsx:1507`).
- /home F7 — "Safest route" caption renders before zones load or when `enabledZones.length === 0` (`app/home.tsx:1831`).
- /unfamiliar F1 — "Saves your journey periodically" overstates one-shot persistence (`app/unfamiliar.tsx:274-276`).
- /trusted-contact-setup F3 — "alerts this person during emergencies and shares your location with them" (`app/trusted-contact-setup.tsx:186-189`).
- /trip-summary F2 — "Set as default" silently no-ops when `destLat`/`destLng` absent (`components/TripSummaryModal.tsx:159-178` or equivalent).
- /legal F1, F3, F4, F5 — JSX is a meaningful subset of canonical markdown; the page asserting Phosphor MIT itself uses Ionicons.

**Severity:** Critical at the pattern level. Honesty is the thesis spine. Any one of these is defensible in isolation; the accumulation is not.

**Fix shape:** Per-surface copy tightening + render-gating (`enabledZones.length > 0`, `contact != null`, etc.). /legal needs a markdown-mirror reconciliation pass.

### PROJECT-D | Important | Raw spacing integers / token-discipline drift — 4 surfaces

**Affected:** /search (25+ raw integer spacings in `app/search.tsx:826-1021`, `SearchBar.tsx:147-198`, `StateCard.tsx:126-195`), /safety (SOSBar — documented backlog), /en-route (`app/en-route.tsx:1959, 2064` — `rgba()` and `#000` literals; also raw spacing in bottom-sheet block), /menu (per its report, token-clean — VERIFY in cleanup PR; if dirty, this count rises to 4 confirmed).

**Severity:** Important at the pattern level. Below Critical because no user-facing claim is at stake — but token discipline is the design-system contract and these are the surfaces where it slips.

### PROJECT-E | Emerging | Stale or missing v2-deltas docblocks — 2 surfaces (watch)

**Affected:** /home (`app/home.tsx:1516` cites stale Figma `1133:13690`; docblock describes single-card browse mode while shipped is a 7-row stack), /en-route (no consolidated "v2 deltas" docblock at `app/en-route.tsx:101-118` — divergences scattered across F1/F5/F6/F7/F8/F11/F12/W2/C12/C12b/C16 tags).

**Severity:** Below the ≥3-surface promotion threshold but flagged as emerging because both instances are on the highest-traffic surfaces in the app. Workflow Step 11 (learnings) catches most of this; the gap is the in-file docblock not the learnings entry.

### Other patterns considered, not promoted

- **Composite a11y labels on multi-text rows:** /unfamiliar, /share-location handle this well; /home, /search, /menu have gaps. Folded into PROJECT-B since the fix is in the same sweep.
- **Haptic gaps on success moments:** /trip-summary F4, /fuel F5, /trusted-contact-setup F4 (no haptic on error). Three instances but each Minor; not promoted but worth a single sweep PR.
- **No defensive empty-string bail on sanitized phone:** /roadside F2 references `audit/safety-polish` learnings item 4 as a class-of-bug. Defensible to leave per surface; track as a class-fix follow-up.

## fgq coverage notes

**Verified (thesis-promise judgments grounded):** /pulled-over, /en-route, /home, /search, /roadside, /menu, /recordings, /unfamiliar, /trip-summary, /safety, /fuel.

**Partially verified — tokenizer drift, judgment leaned on code + learnings instead:**
- **/trusted-contact-setup** — `trusted contact` seed returned legal-doc nodes. Thesis-promise judgments (especially F3 honesty) rest on code reads of `useTrustedContact` + `audit/safety-polish` learnings, not on fgq chat-trail confirmation. **Thesis-promise NOT directly verified via fgq for /trusted-contact-setup.** Code-grounded only. Acceptable because the honesty failure is mechanically obvious from `share-session.ts`, but worth saying out loud.
- **/share-location** — `trusted contact` similarly drifted; subgraph confirmed widget architecture but not the "Already on it." copy intent. Code-grounded.
- **/legal** — `privacy` / `disclosure` / `simulated`: `disclosure` seeded on `DisclosureDuty` (irrelevant noise). `simulated` confirmed canonical anchor in `share-session.ts:8`. Honesty claims independently code-verified (no analytics SDKs, `ITSAppUsesNonExemptEncryption: false`, OS dial for roadside). Sufficient.
- **/pulled-over** — `trusted contact` returned terms.md hit; contact-phase semantics verified from code + ax5/safety-surfaces learnings.

**Conclusion:** fgq tokenizer brittleness affects `trusted contact` and prose-shaped seeds consistently. Where it drifted, this audit relied on code reads + `docs/learnings.md` — both first-class sources. No surface's honesty judgment is grounded *only* in fgq output.

## Per-surface findings

### /pulled-over
**Context:** Consolidated single-modal safety flow (armed → transition → guidance → contact → review). Canonical AX5 reference. Refined for trauma-informed pacing.

- **F1 | Critical | Concept / Honesty.** `TrustedContactStatus` claims active notification while wiring is decorative. `components/TrustedContactStatus.tsx:27`; rendered `app/pulled-over.tsx:527`. Gate render on `useTrustedContact().contact`; revise copy.
- **F2 | Important | Concept / Honesty.** Recording footnote elides "we don't auto-share." `app/pulled-over.tsx:797-799`. Fix: "Saved on this phone only. Not sent to anyone."
- **F3 | Important | Polish / Copy register.** "Tap to continue" hint contradicts calming-pause intent. `app/pulled-over.tsx:605`. Fix: "Tap when ready" or "Tap to skip ahead."
- **F4 | Minor | Polish / Token discipline.** `officerStyles.emphasis` reaches into another token's `fontWeight`. `app/pulled-over.tsx:1997`. Use `<Strong>` helper.
- **F5 | Minor | Polish.** `RecordingChip` accessibility label always says "minutes" even at 0. `app/pulled-over.tsx:847`.
- **F6 | Note | Reliability.** App-kill mid-recording loses artifact. Document in limitations.
- **F7 | Note | Reliability.** Positive: no-data/no-contact path well-handled at `app/pulled-over.tsx:920-969`.

**Verdict:** Canonical reference holds its standard. F1 is the genuine Critical.

### /en-route
**Context:** Active-navigation surface. Turn-sign header, map, side-button column, speed-limit cluster, collapsible bottom sheet, overlays. Real OSRM/Mapbox routes with cache + mock fallback.

- **F1 | Important | Polish.** Bottom-sheet typography not wrapped in `dynamicType()`. `app/en-route.tsx:2143, 2147, 2162, 2173, 2223, 2231, 2227, 2079, 2269`. Lift `endTripBtn.height: 52` → `minHeight: 52`.
- **F2 | Important | Polish.** Raw `rgba()` and hex literal. `app/en-route.tsx:1959, 2064`. Use tokens.
- **F3 | Important | Polish.** Ionicons leak. `app/en-route.tsx:13, 1723`; `components/RouteComparisonSheet.tsx:1,54,78,91`; `components/FuelStopsSheet.tsx:1,51`. Folds into PROJECT-A.
- **F4 | Important | Concept / Honesty.** Speed limit hardcoded to 25 mph. `app/en-route.tsx:1507`. Hide when unknown OR show "—".
- **F5 | Important | Fidelity (undocumented refinement).** No consolidated v2-deltas docblock at `app/en-route.tsx:101-118`. Add deltas list.
- **F6 | Important | Reliability.** No empty-state banner when location permission denied. Map stays on hardcoded Mobile, AL camera. `app/en-route.tsx:848-927`.
- **F7 | Important | A11y.** Turn-card a11y wrapper doesn't surface hazards or offline state. Promote `turnSign` View to `accessible` with composite label.
- **F8 | Important | Reliability.** LiveSafetySheet collapsed pill overlaps en-route bottom sheet. Anchor above measured `bottomSheetHeight`.
- **F9 | Minor | Polish.** Route-badge marker accessibility uses only duration. `app/en-route.tsx:1271`.
- **F10 | Minor | Polish.** SF Pro Bold stand-in for Overpass Bold on speed-limit; no canonical font queued.
- **F11 | Minor | A11y.** Dead `turnDistance`/`turnDistanceUnit` styles. `app/en-route.tsx:1910-1917`.
- **F12 | Note | Polish.** `LaneStrip.tsx:141-159` switch has `case 'uturn':` after `default:` — unreachable.
- **F13 | Note | Concept (honesty).** "Demo route" copy honest; mock geometry is straight-line waypoints. Flag in thesis defense.

**Verdict:** Strong overall. Portfolio risks: F1, F3, F4, F5.

### /home
**Context:** Main map screen, entry point. Browse mode (`HomeBrowseSheet` 7-row stack) vs route-preview mode. Hosts community markers + edge indicators + persistent LiveSafetySheet.

- **F1 | Important | Fidelity.** Stale Figma citation at `app/home.tsx:1516` (names `1133:13690`); `HomeBrowseSheet.tsx:44` names `1114:9047`. Both predate Round-4 multi-row stack.
- **F2 | Important | Fidelity.** Docblock at `app/home.tsx:1514-1518` describes single-card browse mode; shipped is 7-row stack.
- **F3 | Critical | Polish / Concept.** SearchBar uses Ionicons. `components/SearchBar.tsx:1, 65, 130`. Most-seen UI surface violating explicit rule. Re-graded to Critical (was the report's framing). Folds into PROJECT-A.
- **F4 | Important | A11y.** Browse-sheet section/eyebrow/topRow titles missing Dynamic Type wraps. `components/HomeBrowseSheet.tsx:1244-1257, 1328-1332, 1457-1462, 1494-1504`.
- **F5 | Important | A11y.** Carousel `cardTitle` uses `adjustsFontSizeToFit` + `minimumFontScale={0.85}` — wrong primitive (shrinks under pressure). `HomeBrowseSheet.tsx:1039`.
- **F6 | Important | A11y.** `StateCard.card` has fixed `width: 326`. `components/StateCard.tsx:128`.
- **F7 | Important | Concept / Honesty.** "Safest route" caption renders even when `enabledZones.length === 0` or zones still fetching. `app/home.tsx:1831`. Gate on `enabledZones.length > 0 && !isCalculatingRoute`.
- **F8 | Important | Reliability.** Cold-start race: `bottomSheetHeight` measurement vs `fabAnchorHeight` lock. `app/home.tsx:1541-1551`. Defensible-to-leave with closed-form anchor proposed.
- **F9 | Minor | Polish.** `routeArrival` "arrive {time}" lowercase. `app/home.tsx:1754`. Fix: "Arrive {arrivalTime}".
- **F10 | Important | A11y.** `placementHint`, `routeViaLabel`, `routeConditionsCaption`, `routeDistance`, `routeArrival`, `routeMinutes`, `destTitle` use spread `typography.*` without `dynamicType`. Same class as F4.
- **F11 | Important | Concept / Polish.** `WeatherDrivingCard` uses Phosphor `CloudSun` regardless of conditions. `HomeBrowseSheet.tsx:822`.
- **F12 | Minor | Polish.** `weatherCard` icon `labelSecondary` vs text `labelTertiary`. Same row, different hierarchy.
- **F13 | Note | Polish.** HomeBrowseSheet `Star` import verified clean.
- **F14 | Minor | Polish.** `UserLocationMarker` pulse animation runs forever after `tracksViewChanges={false}`. Defensible-by-comment. Lines 78-85.
- **F15 | Minor | Polish.** `daylightStripInline` `accessibilityElementsHidden` — defensible-by-comment.
- **F16 | Note | Reliability.** `useFocusEffect` re-fetches `getCommunityReportsAsZones()` with no catch. `app/home.tsx:1019-1032`.
- **F17 | Minor | Polish.** `handleHomeMarkerPress` and `handleTrustedFriendMarkerPress` both call `selectionAsync()`. Recommend `impactAsync(Light)` for trusted-friend.
- **F18 | Note | Reliability.** Positive: `useEffect` cleanup verified.

**Verdict:** Largely portfolio-ready. F3 (Ionicons in SearchBar — Critical). F1+F2 (stale Figma + outdated docblock). F4/F5/F10 cluster: ax5 follow-up sweep needed.

### /search
**Context:** Five-phase state machine. Landing (SearchBar + 4 Quick Tools + Fuel CTA + Recents); Food/Gas/Parking fill the bar; Mapbox v6 autocomplete on 300ms debounce. Routes to /home (or /en-route if `from=enroute`).

- **F1 | Important | Fidelity.** Results-phase search-bar mismatches Figma `1105:6462` left-icon variant. SearchBar always uses chevron-back. Intentional; not disclosed in docblock.
- **F2 | Important | Fidelity.** "More results for X" affordance from results node is absent.
- **F3 | Important | Polish / Token-discipline.** 25+ raw integer spacings across `app/search.tsx:826-1021`, `SearchBar.tsx:147-198`, `StateCard.tsx:126-195`. Folds into PROJECT-D.
- **F4 | Important | Polish / A11y.** SearchBar uses Ionicons. `SearchBar.tsx:1, 65, 130`. Folds into PROJECT-A.
- **F5 | Important | A11y.** Zero `dynamicType()` calls across the three files. Folds into PROJECT-B.
- **F6 | Minor | Polish.** Quick Tools horizontal ScrollView lacks `tablist` semantics. `app/search.tsx:520-569`.
- **F7 | Minor | Reliability.** `userLocation` failure silently downgrades explicit-search ErrorState to transient. Permission denied is a hard wall but copy reads transient.
- **F8 | Minor | Polish.** Saved-row a11y label uses period-as-separator. `app/search.tsx:593`.
- **F9 | Note | Concept-execution.** Saved tile empty-state copy is warmest in the file; most other copy is generic.

**Verdict:** F1/F2 silent Figma deviation, F3 token discipline, F4 Ionicons, F5 Dynamic Type opt-in gap.

### /roadside
**Context:** Page-sheet modal with 3-step state machine (problem → action → status). Shipped via `feat/roadside-assistance`.

- **F1 | Minor | Polish.** `WrongSpotModal` input style bypasses `dynamicType()`. Lines 716-724.
- **F2 | Minor | Reliability.** Empty-string defensive bail on sanitized phone not applied. Line 302.
- **F3 | Note | Polish.** Step 3 subtitle has redundant inline `marginTop` override. Line 482.
- **F4 | Note | Concept-execution.** Honesty audit clean.

**Verdict:** Tight. Safe to defend.

### /menu
**Context:** v2 settings hub. Identity + Zone Preferences accordion (overlay + 3 factor toggles wired into scoring) + Safety/Privacy push-rows + Quick-Tile (Fuel) + Sign-out.

- **F1 | Important | Polish + Concept.** Ionicons chevrons. `app/menu.tsx:1, 202, 520-524`. Folds into PROJECT-A.
- **F2 | Important | A11y.** No Dynamic Type / `relaxedLineHeight` on any text node. Lines 587-733. Folds into PROJECT-B.
- **F3 | Minor | Reliability.** Sign-out `Promise.all` masks per-adapter errors. Lines 172-179. Use `Promise.allSettled` + console.warn.
- **F4 | Minor | Polish.** Avatar image has no `onError` / fallback. Lines 218-224.
- **F5 | Note | Concept-execution.** Honesty sweep clean.
- **F6 | Note | Polish.** Positive — no raw spacing/color drift.

**Verdict:** Strong shape. F1 + F2 are the real pre-defense moves.

### /recordings
**Context:** Audio library for /pulled-over captures. White-on-light register per Round 5 PR A.

- **F1 | Important | Polish / Concept.** Back chevron Ionicons. Lines 1, 174. **Re-graded from Minor.** The "de-facto chevron register" defense in learnings L440 covers /menu, /safety-settings, /recordings, /report — but PROJECT-A pulls 8 surfaces into scope, which retires the convention defense.
- **F2 | Minor | A11y.** No Dynamic Type / `relaxedLineHeight`. Lines 454, 499, 507, 587, 594. `ax5/safety-surfaces` explicitly did not scope /recordings. Folds into PROJECT-B.
- **F3 | Note | Reliability.** No defensive "missing file" handling at play time. Low likelihood.
- **F4 | Note | Concept-execution.** Honesty verified clean.

**Verdict:** Production-clean. F2 the substantive gap.

### /unfamiliar
**Context:** Three-step page sheet (problem | destination | active). Starts global ShareSession on Step 1; Mapbox POI search on Step 2; `router.replace` to /en-route.

- **F1 | Important | Concept / Honesty.** "Saves your journey periodically" overstates v1 behavior (single-shot persist). `app/unfamiliar.tsx:274-276`. Fix: "Fresh Greens stays with you until you tell us you're safe." Folds into PROJECT-C.
- **F2 | Minor | Polish / Concept.** Auto-share-on-Step-1-pick has no inline disclosure. Lines 99-102.
- **F3 | Minor | Polish / Reliability.** No-results / Search-failed Alerts collapse state silently. Lines 120-126, 135-141.
- **F4 | Note | Polish.** ActiveSessionView lacks back-from-deep-link chevron. Defensible.

**Positive:** Every `Text` uses `dynamicType(...)`. Composite labels. NotifyingPulse `accessibilityElementsHidden`. Token discipline clean.

**Verdict:** Tight, defensible. F1 is the panel-risk string.

### /trip-summary
**Context:** Post-trip recap modal over /en-route on arrival. Recap + C12b inference-validation (confirm/dismiss caution zones) + "Set as default" (markRegular).

- **F1 | Important | A11y.** Title + stats + inference copy not wrapped in `dynamicType()`. Lines 349, 353, 363, 368, 378, 382, 396, 422. `ax5/safety-surfaces` did not scope /trip-summary. Folds into PROJECT-B.
- **F2 | Important | Concept / Reliability.** "Set as default" silently no-ops when `destLat`/`destLng` absent. Lines 159-178. Promise unconditional; behavior conditional. Folds into PROJECT-C.
- **F3 | Minor | Polish.** Title `title1Regular` (held register) vs `inferenceHeading` `title3Emphasized` — register inconsistency. Line 378.
- **F4 | Minor | Polish.** No haptic on Confirm/Dismiss or Set-as-default success. Lines 159-202. The countermapping moment lands without haptic weight.
- **F5 | Note | Reliability.** `handleAccept` swallows `addCommunityReport` failures with optimistic state (documented).
- **F6 | Note | Concept-execution.** "Set as default" copy underspecific. Consider "Save as a regular."

**Verdict:** Structurally clean. F1 + F2 are panel risks.

### /trusted-contact-setup
**Context:** Onboarding step 5/5, reused from /menu + SOS recovery. Two states (empty/preview), two registers (wiltedgreen onboarding / white embedded). Geocodes home address for Trusted Friend marker.

- **F1 | Important | Polish / Concept.** Ionicons `chevron-back`. Lines 1, 173. Folds into PROJECT-A.
- **F2 | Important | A11y.** No `dynamicType()` / `relaxedLineHeight` despite being cited as AX5 canonical reference. Lines 337-352. Folds into PROJECT-B. Direct contradiction of learnings.
- **F3 | Critical | Concept / Honesty (re-graded).** "Fresh Greens alerts this person during emergencies and shares your location with them." Lines 186-189. Per learnings v1 is UI-state simulation. Re-graded from Important: same honesty class as /pulled-over F1, on a surface cited as canonical-honesty reference. Folds into PROJECT-C as anchor finding.
- **F4 | Minor | Polish.** Error text has no live-region announcement and no haptic. Lines 249, 121-126.
- **F5 | Note | Reliability.** Contacts permission-denied silently degrades Trusted Friend marker — documented design choice.

**Verdict:** Architecturally sound. F1 + F2 + F3 drag it below the canonical-reference bar it's supposed to set.

### /legal
**Context:** Single scrollable route with sticky pill-tab TOC (Privacy / Terms / Limitations). Mirrors `docs/legal/{privacy,terms,limitations}.md`. Thesis-critical honesty surface.

- **F1 | Critical | Concept / Honesty.** Ionicons used in /legal. Lines 1, 74. The page making the icon-licensing claim itself uses Ionicons. Critical because the contradiction is internal to one screen.
- **F2 | Important | Fidelity / Sync drift.** JSX drops Mapbox URL and "(the map provider)" parenthetical. Line 125.
- **F3 | Important | Fidelity / Sync drift.** JSX omits four privacy sections: "What we do *not* collect", "Children" (COPPA), "Contact", "Sign out cleanup."
- **F4 | Important | Fidelity / Sync drift.** JSX omits Terms sections: "What Fresh Greens is", "Your account and data", "Intellectual property" (incl. the Phosphor MIT line that conflicts with F1), "Governing law", "Contact". Limitation-of-liability text materially shorter than markdown.
- **F5 | Important | Fidelity / Sync drift.** Limitations tab missing "We are not selling your data" + effective date. Lines 244, 302.
- **F6 | Important | A11y.** Tab row missing `accessibilityRole="tablist"`. Lines 81-103.
- **F7 | Minor | Polish.** `•` literal bullet glyph with no decorative-hidden flag. Lines 351-353.
- **F8 | Minor | Polish.** No scroll-to-top reset on tab switch; no `onScroll` updating activeSection. Lines 53-57. Pill desyncs from scroll.
- **F9 | Note | Polish.** Effective date is hand-edited literal in three places (no constant).

**Positive:** Honesty claims that *are* present are code-true. `dynamicType()` + `relaxedLineHeight()` applied to long-read styles. Token discipline clean.

**Verdict:** Voice strong. JSX is a meaningful subset of canonical markdown; back-arrow uses Ionicons while terms.md claims Phosphor. Both honesty failures by the surface's own standard.

### /safety
**Context:** Entry-point modal to four safety sub-flows + grouped Emergency entry row (2026-06 polish). v2 deltas docblock + ax5 minHeight pattern + navy icon-only on emergency row + cross-tile guard.

- **F1 | Minor | Polish.** ~~Raw spacing literals in SOSBar~~ — largely tokenized (`spacing.*`, `radii.sm`); residual raw literals may remain in comments-only blocks.
- **F2 | Minor | Polish.** ~~`header` / `titleBlock` raw gaps~~ — migrated to `spacing.md` / `spacing.sm` (2026-06 polish).
- **F3 | Minor | A11y.** ~~SOS Pressable lacks `accessibilityHint`~~ — fixed (2026-06 polish).
- **F4 | Note | A11y.** Positive: `tabLabel` wraps `dynamicType()`; `tabIcon` uses `minHeight: 96`.
- **F5 | Note | Reliability.** Positive: cross-tile guard correctly distinguishes same-tile re-entry.
- **F6 | Note | Honesty.** Positive: No-contact gate copy honest given v1 simulation.
- **F7 | Note | Concept.** ~~`fadedgreen` on navy SOS bar~~ — superseded: emergency row uses grouped surface + `labelTertiary` subtitle; navy scopes to shield icon only.

**Verdict:** One of the most-disciplined surfaces. Nothing rises above Minor.

### /share-location
**Context:** Single-step page-sheet modal. Reason picker (4 options); re-entry while session live renders ActiveView with End-sharing CTA.

- **F1 | Note | Concept-execution.** ActiveView subtitle "Already on it." / "Sharing your location" — aspirational given v1 simulation, documented thesis stance.
- **F2 | Minor | Polish.** `aspirationalNote` style identifier reads as semantic mismatch. Lines 164, 202-207. Rename `reasonNote`.
- **F3 | Minor | Polish.** End-sharing CTA asymmetry — verify dignity rationale surfaces inline. Add WHY comment.
- **F4 | Note | Reliability.** Cold-no-contact path defensive fallback correct.

**Positive:** Composite labels, `dynamicType` applied, busy latch, dismiss helper canonical pattern.

**Verdict:** Strong shape. No Critical/Important findings.

### /fuel
**Context:** Pushed settings screen for time-based refuel reminders. Optional car name, fuel type, cadence (1-60 days), on/off toggle. Schedules recurring TIME_INTERVAL local notification.

- **F1 | Important | Polish.** Ionicons usage drifts from Phosphor. Lines 1, 116, 168, 179. Chevron-back + +/- steppers. Folds into PROJECT-A.
- **F2 | Important | A11y.** No Dynamic Type / line-height. Lines 236-307. `ax5/safety-surfaces` did not scope /fuel. Folds into PROJECT-B.
- **F3 | Important | A11y.** Segmented fuel-type buttons lack composite label; toggle row lacks role. Lines 148-150, 183-192.
- **F4 | Minor | Concept / Honesty.** "Next reminder" hides time-of-day reality. Lines 92-99, 196. TIME_INTERVAL fires at *(enable moment) + N×86400s*; stripping time glosses behavior. Folds into PROJECT-C (low-severity tail).
- **F5 | Minor | Polish.** No haptic on Save / "I filled up."
- **F6 | Note | Reliability.** Positive: notifications persist across app kill.
- **F7 | Note | Reliability.** Positive: permission-denied path honest.

**Verdict:** Functionally honest. Defensibility gaps cosmetic-but-real: F1, F2, F3.

## Per-dimension appendix

### Concept / Honesty (Thesis spine)
- **Critical:** /pulled-over F1, /trusted-contact-setup F3 (re-graded), /legal F1.
- **Important:** /pulled-over F2, /en-route F4, /home F7, /unfamiliar F1, /trip-summary F2, /home F11 (lagging icon reads as placeholder).
- **Minor:** /pulled-over F3 (copy register), /unfamiliar F2 (auto-share no inline disclosure), /share-location F1 (aspirational subtitle, documented), /fuel F4 (TIME_INTERVAL time-of-day gloss).
- **Notes (positive):** /safety F6, F7; /menu F5; /recordings F4; /roadside F4.

### Polish / Token discipline
- **Critical:** PROJECT-A (Ionicons leak, 8 surfaces) rolled up.
- **Important:** /en-route F1, F2, F3; /home F3 (Critical at surface, Important at line item), F11; /menu F1; /search F3, F4; /trusted-contact-setup F1; /recordings F1 (re-graded); /fuel F1; PROJECT-D (raw spacing, 4 surfaces).
- **Minor:** /pulled-over F4, F5; /en-route F9, F10; /home F9, F12, F14, F15, F17; /safety F1, F2; /trip-summary F3; /search F6, F8; /share-location F2, F3; /fuel F5; /legal F7, F8; /roadside F1, F3.
- **Notes:** /home F13; /en-route F11, F12; /menu F6.

### Fidelity
- **Critical:** /legal F1 (icon-claim contradiction — also Concept).
- **Important:** /home F1 (stale Figma), F2 (outdated docblock); /en-route F5 (no v2-deltas docblock); /search F1, F2 (silent Figma deviation, missing "More results"); /legal F2, F3, F4, F5 (sync drift across all three tabs).
- **Emerging:** PROJECT-E (stale/missing v2-deltas docblocks, 2 surfaces).
- **Notes:** /trip-summary verdict ("undocumented intentional refinements") is documented through learnings, not docblock — watch on next port.

### Accessibility
- **Critical:** PROJECT-B (missing `dynamicType()`, 8 surfaces) rolled up.
- **Important:** /home F4, F5, F6, F10; /en-route F1, F7; /menu F2; /search F5; /trusted-contact-setup F2 (canonical-reference contradiction); /trip-summary F1; /fuel F2, F3; /legal F6 (tablist role).
- **Minor:** /en-route F11 (dead styles); /search F6, F8; /safety F3; /recordings F2 (re-graded into PROJECT-B); /roadside F1 (input dynamicType); /trusted-contact-setup F4 (live-region + haptic on error); /home F15 (defensible).
- **Notes:** /safety F4; /unfamiliar positive callouts; /share-location positive callouts.

### Reliability
- **Important:** /en-route F6 (no-permission empty state), F8 (LiveSafetySheet overlap); /home F8 (cold-start race); /trip-summary F2 (silent no-op, also Concept).
- **Minor:** /menu F3 (`Promise.all` masks errors), F4 (avatar onError); /search F7 (silent permission-denied downgrade); /roadside F2 (empty-string defensive bail); /unfamiliar F3 (silent collapse on no-results).
- **Notes:** /pulled-over F6, F7; /recordings F3; /trip-summary F5; /home F16, F18; /share-location F4; /fuel F6, F7.

---

End of audit. Findings cited above flow into `docs/next-session.md` under the 2026-05-31 backlog section.
