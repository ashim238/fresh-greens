# Phase 1 Cross-Screen Synthesis
**Date:** 2026-06-19  
**Scope:** 25 unique screens (26 snapshots; home.tsx deduplicated to post-polish 2026-06-19T04:31:39Z)  
**Phase 2 engineer note:** This synthesis is input to scoping Phase 2 extraction PRs. Section 3 maps patterns to proposed extraction locations; Section 4 sequences them.

---

## Section 1: Score Table

**Distribution:** Mean 30.2 · Median 31 · At Tier A floor (≥35): 3 screens · Below floor: 22 screens · Mean P0 count: 0.76 per screen · Total P0s across corpus: 19

| Screen | Score | P0 | P1 | Band |
|---|---|---|---|---|
| app-zone-preferences-tsx | 24 | 0 | 2 | Acceptable |
| app-roadside-setup-tsx | 25 | 1 | 2 | Acceptable |
| app-fuel-tsx | 26 | 1 | 2 | Functional |
| app-login-tsx | 26 | 1 | 2 | Functional |
| app-roadside-tsx | 26 | 1 | 3 | Functional |
| app-recordings-tsx | 27 | 2 | 2 | Functional |
| app-en-route-tsx | 28 | 1 | 2 | Functional |
| app-report-tsx | 28 | 0 | 2 | Functional |
| app-sign-out-tsx | 28 | 0 | 2 | Functional |
| app-trusted-contact-setup-tsx | 28 | 0 | 3 | Functional |
| app-unfamiliar-tsx | 28 | 2 | 2 | Functional |
| app-get-started-tsx | 29 | 0 | 2 | Functional |
| app-pulled-over-tsx | 29 | 1 | 2 | Functional |
| app-legal-tsx | 31 | 1 | 2 | Solid |
| app-menu-tsx | 31 | 0 | 2 | Solid |
| app-permissions-tsx | 31 | 0 | 2 | Solid |
| app-safety-settings-tsx | 31 | 1 | 2 | Solid |
| app-search-tsx | 31 | 0 | 1 | Solid |
| app-trip-summary-tsx | 32 | 1 | 2 | Solid |
| app-saved-places-tsx | 33 | 0 | 2 | Solid |
| app-share-location-tsx | 33 | 2 | 1 | Solid |
| app-emergency-tsx | 34 | 0 | 2 | Solid |
| app-home-tsx | 36 | 0 | 2 | Tier A |
| app-onboarding-tsx | 35 | 0 | 2 | Tier A |
| app-safety-tsx | 35 | 0 | 2 | Tier A |

---

## Section 2: Recurring Patterns

### 1. Loading State Ignored — Hook Exposes, UI Doesn't Consume

**Screens:** app-saved-places-tsx, app-zone-preferences-tsx, app-safety-settings-tsx, app-share-location-tsx, app-trusted-contact-setup-tsx, app-recordings-tsx  
**Severity:** SYSTEMIC (6 screens)

Hooks consistently return a `loading` boolean — `useSavedPlaces`, `usePreferences`, `useTrustedContact`, `useShareSession`, `useRecordings` — and screens consistently ignore it. The invariant failure mode is identical on every screen: component initializes with an empty or null default, renders the empty/unconfigured state immediately, then patches to the real data when the async read resolves. Users see a flash of "No saved places yet" or "Add someone you trust" even when both exist. The failure is worst on safety-critical screens: `app-safety-settings-tsx` shows "Add someone you trust" during the contact row's load window, and `app-trusted-contact-setup-tsx` shows "No contact set yet." — a statement that reads accusatory in the embedded mid-stop register — before resolving to the actual stored contact. The pattern is architectural: hooks are written correctly but screen authors are not threading `loading` through to render.

### 2. Silent Error Swallowing on Storage / Async Operations

**Screens:** app-trip-summary-tsx, app-saved-places-tsx, app-share-location-tsx, app-unfamiliar-tsx, app-recordings-tsx, app-menu-tsx  
**Severity:** SYSTEMIC (6 screens)

Across the codebase, `catch` blocks for AsyncStorage and API writes log to `console.warn` or swallow entirely, while the UI has already updated optimistically. The consequence is optimistic-divergence-from-truth: the user sees "Confirmed" on a community report inference but nothing was stored (`app-trip-summary-tsx`); a saved place disappears from the list but reappears on next launch because the write failed (`app-saved-places-tsx`); a share session's `endSession` fails but the UI dismisses anyway, leaving a ghost session in storage (`app-share-location-tsx`); the calendar connection in `app-menu-tsx` fires with `void connectCalendar()` and can fail entirely without any user-visible signal. For an app whose thesis rests on "honesty of disclosure" and "visible reasoning," silent failure is a structural trust violation. The fix pattern is the same everywhere: catch block should either roll back optimistic state and surface an inline error, or expose a retry affordance.

### 3. Generic Error Copy in Charged-Moment Contexts

**Screens:** app-login-tsx, app-report-tsx, app-en-route-tsx, app-roadside-tsx, app-recordings-tsx, app-search-tsx  
**Severity:** SYSTEMIC (6 screens)

A pattern of single-sentence, non-differentiated error copy appears across screens where users may be in elevated emotional states. "Sign-in failed. Please try again." covers all failure modes on `app-login-tsx` regardless of whether the issue is a network timeout, credential expiry, or Apple backend problem. "Could not submit. Please try again in a moment." on `app-report-tsx` gives the same response whether GPS failed, storage failed, or the server rejected the request. Error states on `app-recordings-tsx` instruct users to "reopen the screen" with no in-surface retry. On `app-search-tsx`, "Locating you… try again in a moment" gives no recovery action at all. These screens all serve the primary persona (Black driver) in moments ranging from mildly inconvenient to safety-critical. Generic error copy in charged moments is not merely a UX gap — it signals that the system doesn't know why it failed, which for safety-context users maps directly to distrust of the system's other signals.

### 4. Tap-Target Painted-vs-Hit-Area Drift

**Screens:** app-legal-tsx, app-search-tsx, app-report-tsx, app-permissions-tsx, app-pulled-over-tsx, app-home-tsx  
**Severity:** SYSTEMIC (6 screens)

The `.cursorrules` tap-target rule is explicit: "44×44 pt minimum on the visual, not just the hit area." Multiple screens violate this specifically on the visual side. Tab pills on `app-legal-tsx` compute to 28pt painted height. The recovery affordance `Pressable` on `app-permissions-tsx` has compliant vertical padding but zero horizontal padding, so painted horizontal target equals text width (~80pt at most). The "Clear" button on `app-search-tsx` is `minHeight: 44` compliant but `paddingHorizontal: 0`. The `stopRecordingBtn` on `app-pulled-over-tsx` is `paddingVertical: 6` — approximately 18pt painted height. The `dragHandleArea` on `app-home-tsx` computes to ~36pt. `hitSlop` is applied in a few of these cases as the compliance mechanism, but the rulebook states this is "forgiveness on top of compliance, never the compliance mechanism." This pattern accumulates because engineers add `hitSlop` as a quick fix rather than correcting the painted geometry.

### 5. Dismissal Pattern Inconsistency

**Screens:** app-home-tsx, app-roadside-tsx, app-unfamiliar-tsx, app-safety-tsx, app-en-route-tsx, app-emergency-tsx  
**Severity:** SYSTEMIC (6 screens)

Modal sheets and overlay surfaces across the app use at least five distinct dismissal patterns: drag handle (decorative, no gesture handler in some cases), scrim tap (sometimes `accessible={false}`), explicit X button, back chevron, and full-screen Pressable with no visible affordance. On `app-roadside-tsx`, `usePreventRemove` blocks swipe-down without any in-UI affordance communicating the guard, so the `Alert` that fires when a user attempts to swipe feels unexpected. On `app-unfamiliar-tsx`, the drag handle implies bottom-sheet swipe-to-dismiss behavior but the screen is a full-screen route with no gesture handler — the handle is cosmetic. On `app-safety-tsx`, no close button is painted at all. On `app-en-route-tsx`, the coach mark overlay is a full-screen Pressable with `accessible={false}` — invisible mechanism. The inconsistency is both usability and trust issue: users develop a mental model of how to dismiss this app's sheets, and every modal that breaks that model creates a small moment of "why isn't this working?"

### 6. Brand Voice Misregistration — Alarm Register Intrusions

**Screens:** app-home-tsx, app-sign-out-tsx, app-report-tsx, app-unfamiliar-tsx, app-share-location-tsx, app-zone-preferences-tsx  
**Severity:** SYSTEMIC (6 screens)

"The Steady Companion" brand is defined by composure, groundedness, and refusal of alarm-register conventions. The critique corpus surfaces repeated small departures from this voice. "Heads up!" on `app-home-tsx` route-preview copy introduces exclamation-mark alarm register in the briefing surface. "Thank you for stopping by!" on `app-sign-out-tsx` is retail-app farewell copy that misreads the emotional weight of what users just went through. The `app-report-tsx` subtitle "Reports like yours keep Fresh Greens fresh." applies community-marketing copy to users who may be reporting that they felt unsafe. `app-zone-preferences-tsx`'s footer reads as engineer release notes ("Affects route scoring and map flags."), not companion voice. `app-share-location-tsx` fires "On it. Sharing your location now." as an eyebrow before the user has tapped anything — creating a false status announcement in a stressed moment. These are individually small, but their accumulation means the voice drifts exactly where it should hold steadiest: in charged-moment screens.

### 7. Async Hydration Flash — Empty/Unconfigured State Before Data Loads

**Screens:** app-saved-places-tsx, app-zone-preferences-tsx, app-trusted-contact-setup-tsx, app-share-location-tsx, app-safety-settings-tsx  
**Severity:** SYSTEMIC (5 screens)

Distinct from Pattern 1 (which covers loading state being ignored in hook consumption), this pattern specifically names the visual flash of a wrong empty or default state that occurs during the hydration window. The `loading` boolean exists in the hook but the screen renders the default ("empty", "null", or "defaults-from-code") before the async read completes. On `app-zone-preferences-tsx`, toggles briefly show hardcoded defaults before stored preferences land. On `app-trusted-contact-setup-tsx`, "No contact set yet." flashes before contact data arrives — in the mid-stop embedded register this is a dignity failure. On `app-share-location-tsx`, the picker flashes before resolving to the active session view. The fix for all five screens is a single pattern: guard the content render on `loading` and render a skeleton, spinner, or disabled state until `loading` is false.

### 8. Optimistic State Diverging from Storage on Write Failure

**Screens:** app-saved-places-tsx, app-trip-summary-tsx, app-share-location-tsx, app-unfamiliar-tsx  
**Severity:** RECURRING (4 screens)

A subset of the silent error pattern (Pattern 2) specifically concerns optimistic state updates that never roll back on failure. `app-saved-places-tsx` removes a place from local state before confirming AsyncStorage write — if the write fails, the place vanishes from UI but persists in storage (ghost place). `app-trip-summary-tsx` flips inference to `'accepted'` optimistically before `addCommunityReport` completes — if the report fails, "Confirmed" is permanently displayed even though nothing was submitted to the community map. `app-share-location-tsx`'s `handleEnd` catches errors and warns to console but dismisses the view — session persists in storage. The consequence is a specific class of trust violation: the UI presents completed actions that did not complete. For the community-report countermapping mechanism in particular, this means the thesis claim that "confirming helps the next driver" is technically false for any report that silently failed.

### 9. iOS Settings Register Pattern Drift — Value-as-Description

**Screens:** app-safety-settings-tsx, app-menu-tsx, app-zone-preferences-tsx  
**Severity:** RECURRING (3 screens)

In iOS grouped-settings register, the `value` slot on a `SettingsRow` communicates current state ("On", "Marcus Williams", "3 places"). Across these three screens, the slot is used for navigation descriptions or is absent entirely. `app-safety-settings-tsx` uses "Reach a trusted contact or 911" as a value — this describes what the row does, not what the current state is. `app-menu-tsx` has no value props on any of its four config rows, meaning returning users cannot confirm settings are configured without tapping into each sub-page. `app-zone-preferences-tsx` similarly shows no consequence summary at point-of-decision for routing toggles. The `SettingsRow` component already accepts a `value` prop — the pattern is defined, just not populated. For a thesis app whose promise includes "auditable settings," blank value slots on the settings hub undercut the claim directly.

### 10. VoiceOver Hint vs. Label Depth Inconsistency

**Screens:** app-safety-tsx, app-menu-tsx, app-en-route-tsx, app-recordings-tsx, app-report-tsx  
**Severity:** RECURRING (5 screens)

A systemic inconsistency in VoiceOver depth: some elements receive only `accessibilityLabel` (announces what the element is) while adjacent elements of comparable importance receive both label and `accessibilityHint` (announces what happens when activated). On `app-safety-tsx`, the SOS bar has both label and hint but grid tiles have labels only — VoiceOver users cannot distinguish Unfamiliar area from Share location from announcement alone. On `app-menu-tsx`, carousel tiles have combined labels but no hints. On `app-en-route-tsx`, the side column icons coach-mark labels are non-persistent and 11pt — below WCAG informational floor. On `app-recordings-tsx`, play and delete buttons have `accessibilityLabel` but no `accessibilityHint` explaining what the action commits to. The inconsistency maps directly to `accessibilityHint` being treated as optional polish rather than a required component of interactive elements serving a safety function.

### 11. Coach Mark One-Shot / Unrecoverable After Dismissal

**Screens:** app-home-tsx, app-en-route-tsx  
**Severity:** EMERGENT (2 screens)

Both the home screen map coach (zone explanation, edge indicators, community pins) and the en-route coach mark (SOS, safety shield, report, recenter labels) fire exactly once via `useCoachMark`, after which they are permanently dismissed with no re-entry path. Users who dismiss without reading — a documented behavior pattern — have permanently lost the only in-app explanation of the app's most complex UI surfaces. On `app-en-route-tsx` this is compounded by the side-column FABs having no persistent labels, leaving the four safety-critical buttons permanently unlabeled for anyone who dismissed the coach. The shared mechanism (`useCoachMark`) and identical failure mode on two of the app's most consequential screens makes this a candidate for a shared fix.

### 12. Dynamic Type Exclusion on Interactive / Safety-Critical Affordances

**Screens:** app-permissions-tsx, app-en-route-tsx, app-emergency-tsx, app-pulled-over-tsx, app-recordings-tsx  
**Severity:** SYSTEMIC (5 screens)

`dynamicType()` is applied consistently to primary copy throughout the app, but breaks down specifically on secondary affordances that happen to be safety-critical. The permissions screen's recovery footnote (`settingsLinkPrompt`, `settingsLink`) is not wrapped in `dynamicType()` — creating a 2.5× size mismatch at maximum accessibility size between body copy and the recovery path. The en-route coach mark labels use `caption2Regular` (11pt) hardcoded, not scaled. The `app-pulled-over-tsx` `skipHint` is static `footnoteRegular`. The `app-recordings-tsx` `confirmBodyEmphasis` span within an otherwise-dynamic parent creates a mismatched emphasis run at large sizes. On `app-emergency-tsx`, the countdown numeral is a deliberate exception (disc-constrained) but undocumented, creating maintenance debt. Dynamic Type compliance is not uniform — it's applied to primary content and skipped on the secondary interactive paths that exist precisely for users who need large text.

### 13. Reserved-Color Discipline Drift — Token-Identity Confusion

**Screens:** app-fuel-tsx, app-trip-summary-tsx, app-roadside-setup-tsx, app-menu-tsx, app-recordings-tsx  
**Severity:** RECURRING (5 screens)

The reserved-color rule is broadly respected at the semantic level (orange/red/yellow/navy appear only where the rulebook permits), but there is drift in how brand-green tokens are used for non-interactive purposes and how border/separator tokens are selected. `app-fuel-tsx` uses `colors.freshgreen` borders on unselected buttons — freshgreen should carry active/selected state, not ambient unselected state. `app-trip-summary-tsx` uses `colors.wiltedgreen` as the accept-button fill, making wiltedgreen carry two meanings: secondary CTA and affirmative confirmation. `app-roadside-setup-tsx` uses `colors.cardBorderSubtle` as a disabled button fill — a token whose identity is "card/input border outline," not "inactive state fill." `app-menu-tsx` and `app-recordings-tsx` both use `cardBorderSubtle` where `separatorSubtle` is the semantically correct choice. The discipline is strong at the named-signal level but has eroded in the green-family and border-token space.

---

## Section 3: Phase 2 Extraction Candidates

| Pattern | Proposed Extraction Location | Scope | Screens Fixed | Rationale |
|---|---|---|---|---|
| Loading State Ignored | `useLoadingGuard` hook + `LoadingSkeleton` component | LARGE | saved-places, zone-preferences, safety-settings, share-location, trusted-contact-setup, recordings (6 screens) | Same structural gap repeated 6 times — screens don't thread `loading` from hooks into render. A shared guard component + documentation convention fixes all six simultaneously. |
| Async Hydration Flash | `useHydratedState<T>` hook | MEDIUM | Same 6 screens as above (overlapping with loading pattern) | Can be combined with the loading guard extraction: a `useHydratedState` wrapper that returns `{data, loading}` and skeletons while `loading` is true replaces the current pattern of ignoring the boolean. |
| Optimistic Divergence from Storage | Rollback pattern in `useOptimisticMutation` utility | MEDIUM | saved-places, trip-summary, share-location, unfamiliar (4 screens) | A shared `useOptimisticMutation(write, rollback)` wrapper that handles try/catch/rollback once, used by hooks for saves, removes, and session-state changes. Prevents reimplementing error boundaries per screen. |
| Generic Error Copy in Charged Moments | `SafetyErrorMessage` component + error-copy taxonomy | MEDIUM | login, report, en-route, recordings, search, roadside (6 screens) | A component that takes an error code and returns context-appropriate copy prevents new screens from defaulting to "Please try again." Taxonomy documents approved copy variants per error category, so future screens have a decision tree. |
| Tap-Target Painted Geometry | `tapTarget44` token enforcement — augment `SettingsRow`, `Button (transparent)`, and tab components | MEDIUM | legal (tabs), search (Clear), permissions (recovery), pulled-over (stop-recording), home (drag handle) (5 screens) | Some of these are component-level (Button transparent variant, SettingsRow tab pills) and fix propagate to all uses. Others (drag handle, custom controls) require screen-level fixes. Split: component fixes first, screen-level audits second. |
| iOS Settings Register — Value-as-Description | `SettingsRow` documentation + value-population audit | SMALL | safety-settings, menu, zone-preferences (3 screens) | Component accepts `value` prop already; gap is that screens don't populate it. No code change to component needed — author a convention doc and fix the 3 screens. |
| VoiceOver Hint vs. Label Depth | `a11yInteractive` utility — requires both `label` and `hint` for safety-surface elements | MEDIUM | safety, menu, en-route, recordings, report (5 screens) | A lint-style utility or PropTypes enforcement that requires `accessibilityHint` on Pressables in `safety-context` flag. Codifies "label describes what; hint describes what happens." Prevents regression. |
| Coach Mark One-Shot | Extend `useCoachMark` to support re-display + "?" re-entry affordance | SMALL | home, en-route (2 screens) | `useCoachMark` already centralized; adding `reset()` export + optional menu entry is contained work. Small scope, outsized trust payoff for both screens. |
| Dynamic Type Exclusion | `dynamicType()` lint rule — require on all interactive `Text` elements | LARGE | permissions, en-route, emergency, pulled-over, recordings (5 screens) | The gap is distributed across many files; a Danger/lint check that flags `Text` elements with hardcoded `fontSize` without `dynamicType()` wrapping would catch regressions automatically. First pass: audit the 5 flagged screens. |
| Dismissal Pattern Inconsistency | `useSheetDismiss` hook + documented modal contract | LARGE | home, roadside, unfamiliar, safety, en-route, emergency (6 screens) | Different sheets use different dismissal patterns by accident, not design. A `useSheetDismiss` hook that standardizes: X button, scrim-tap, drag handle gesture, and dismiss guard for protected sheets — applied uniformly to all modal surfaces. |

---

## Section 4: Phase 2 Scope Estimate

Phase 2 has 10 extraction candidates identified above. Not all are equal in architectural reach. Below is a recommended sequencing that front-loads highest-impact, lowest-regression-risk work, followed by the larger architectural changes.

**Recommended PR sequence:**

**PR 1 — Loading / Hydration Guard (LARGE)**  
Addresses: loading-state-ignored + async-hydration-flash patterns  
Work: Write `useHydratedState` hook; update 6 screens to use it; add `LoadingSkeleton` component for settings screens.  
Effort: LARGE — 6 screens to audit, skeleton variants needed per context (safety vs. settings vs. form).  
Risk: Medium — state initialization changes could affect existing animation guards; requires device testing on each screen.

**PR 2 — Optimistic Mutation Rollback (MEDIUM)**  
Addresses: optimistic-divergence pattern  
Work: Write `useOptimisticMutation` wrapper; refactor 4 hooks (`useSavedPlaces`, `useRecordings`, `useShareSession`, the trip-summary inference handler).  
Effort: MEDIUM — hook refactors are self-contained; screen changes are light.  
Risk: Low — hooks already have the try/catch structure; this formalizes the rollback path.

**PR 3 — Error Copy Taxonomy + SafetyErrorMessage (MEDIUM)**  
Addresses: generic error copy pattern  
Work: Define error-code taxonomy (network, storage, auth, GPS, not-found); write `SafetyErrorMessage` component with variant prop; audit 6 screens for error surfaces.  
Effort: MEDIUM — copy decisions require explicit review per screen/context.  
Risk: Low — additive change; existing error rendering simply becomes more specific.

**PR 4 — Tap-Target Geometry Fixes (MEDIUM)**  
Addresses: tap-target painted-vs-hit-area pattern  
Work: Fix `Button (transparent)` variant to carry painted `minHeight: 44`; fix `SettingsRow` tab pill to `minHeight: 44`; audit and fix 5 identified screen-level violations.  
Effort: MEDIUM — component fixes propagate broadly; screen fixes are local.  
Risk: Medium — layout changes on existing components need regression tests on all uses.

**PR 5 — Settings Value Population (SMALL)**  
Addresses: iOS settings register pattern drift  
Work: Populate `value` props on `SettingsRow` in safety-settings, menu, and zone-preferences; document value-slot convention in component JSDoc.  
Effort: SMALL — 3 screens, data already available in hooks.  
Risk: Low — additive.

**PR 6 — VoiceOver Hint Depth (MEDIUM)**  
Addresses: VoiceOver hint vs. label inconsistency  
Work: Audit all Pressables on 5 screens for `accessibilityHint`; write utility or PropTypes enforcement; fix omissions.  
Effort: MEDIUM — requires writing copy for each hint; cannot be automated entirely.  
Risk: Low — additive; can be done incrementally per screen.

**PR 7 — Coach Mark Recoverability (SMALL)**  
Addresses: coach-mark one-shot pattern  
Work: Add `reset()` to `useCoachMark`; add "Map guide" entry to /menu; add re-display trigger to en-route side column.  
Effort: SMALL — hook change + 2 screen wires.  
Risk: Low — contained to coach mark system.

**PR 8 — Dynamic Type Audit + Lint (LARGE)**  
Addresses: Dynamic Type exclusion pattern  
Work: Audit 5 flagged screens for hardcoded `fontSize` without `dynamicType()`; fix omissions; add lint rule or Danger check for regressions.  
Effort: LARGE — lint rule authoring is nontrivial; audit needs device verification at AX5 size.  
Risk: Low per screen fix; Medium for lint rule (may need tuning for legitimate exceptions like `sosCountdown`).

**PR 9 — Dismissal Pattern Standardization (LARGE)**  
Addresses: dismissal pattern inconsistency  
Work: Write `useSheetDismiss` hook; document modal contract (when to use guard, when scrim-dismiss is allowed, X button vs. drag-handle); audit 6 screens.  
Effort: LARGE — architectural change touching modal infrastructure; requires design review on intent for each surface.  
Risk: High — dismissal behavior is behavioral contract; changes need careful regression coverage, especially on pulled-over and roadside where dismiss guards carry safety semantics.

**PR 10 — Reserved-Color / Token Audit (MEDIUM)**  
Addresses: reserved-color discipline drift  
Work: Correct `wiltedgreen` as accept-button fill in trip-summary; correct `freshgreen` on unselected borders in fuel; standardize separator tokens in menu, recordings, roadside-setup; document carve-outs.  
Effort: MEDIUM — visual regression risk; needs Figma comparison on each change.  
Risk: Medium — color token changes can be non-obvious in edge cases (dark mode, OLED screens).

**Total: 10 PRs. Rough effort: 3 LARGE + 4 MEDIUM + 3 SMALL.**  
Conservative estimate: PRs 1–5 in Phase 2 sprint (3–4 weeks), PRs 6–10 as follow-on or Phase 3 blended.  
Dismissal standardization (PR 9) is the highest-risk work and should not be combined with other changes.

---

## Section 5: Phase 3 Tail — Per-Screen Issues That Can't Be Extracted

The following issues are screen-specific and cannot be resolved by extraction. They are priority-ordered within tier.

| Screen Slug | Issue Title | Priority | Note |
|---|---|---|---|
| app-recordings-tsx | No share / export path for recordings | P0 | Recordings exist solely as legal protection; no iOS Share Sheet means users cannot get recordings off device. Single most safety-consequential gap in app. Add `Sharing.shareAsync(uri)` per card row. |
| app-en-route-tsx | SOS button one-tap to emergency — no confirmation | P0 | Accidental brush of top FAB during routine stop opens emergency flow. Needs hold-to-confirm or two-tap pattern with distinct haptic. |
| app-roadside-tsx | Step 3 dismissal trap — no visible escape | P0 | `usePreventRemove` locks sheet with no visible affordance. Accidental share toggle = trapped. Add X button or require explicit CTA to advance to Step 3. |
| app-recordings-tsx | Single-row delete has no confirmation for evidence | P0 | Bulk delete is gated; single-row delete is not. Asymmetry backward for legally significant material. |
| app-unfamiliar-tsx | Silent async during destination search — no loading state | P0 | Safety flow shows no feedback during 2–5s location + POI search. Reads as broken to user in charged moment. |
| app-en-route-tsx | Auto-expand hazard sheet on zone entry too aggressive | P1 | Sheet expansion during zone entry pulls driver eyes off road. Replace with compact hazard pill; keep expanded panel available by drag. |
| app-en-route-tsx | Static speed-limit sign permanently shows "—" | P1 | Affordance teaches users to distrust other data signals. Remove until OSM maxspeed is wired, or repurpose element for current speed only. |
| app-pulled-over-tsx | "Add a contact" mid-stop recovery too subtle | P1 | Unconfigured contact state looks like content, not a call to action. Needs explicit pill-outline button affordance, 44pt minimum. |
| app-sign-out-tsx | Copy register mismatch — "Thank you for stopping by!" | P1 | Sign-out is last app impression; may follow pulled-over or share-location session. "Drive safe." or "Take care out there." required. One-line fix, high persona impact. |
| app-trip-summary-tsx | "Set as default" CTA — mental model mismatch | P1 | Label is opaque settings-register language at a trip-completion moment. Replace with "Save [destination] as a regular" or "Remember this destination." |
| app-legal-tsx | Tab pills 28pt painted — 36% below floor | P0 (component) | P0 level but component-level fix; surfaced here because legal content is trust-sensitive and broken tabs on legal screen is compounding. Fix `paddingVertical` to achieve 44pt painted. |
| app-fuel-tsx | Save with distance enabled but no range silently misconfigures | P0 | User who enables distance reminders without picking range stores `rangeMiles=null`, gets silent reset loop. Disable Save or surface inline validation when `distanceEnabled && rangeMiles === null`. |
| app-zone-preferences-tsx | Silent degradation when all safety flags disabled | P1 | All three routing flags can be off simultaneously with no downstream signal. Add inline status banner when fully disabled. |
| app-safety-settings-tsx | Emergency SOS row one tap from emergency flow | P0 | SOS row and configuration rows visually identical in weight; mis-tap routes to /emergency. Separate into own RowGroup. |
| app-unfamiliar-tsx | Lifeline modal overstates live-location capability | P1 | "Can see your current location" may misrepresent a Messages-draft model as live push. If overcommitting, user may make safety decisions based on false premise. Must audit `useShareSession` and correct copy. |
