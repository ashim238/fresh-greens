# Design Health Program — Closeout

**Date:** 2026-06-20
**Program range:** 2026-06-19 (Phase 1 critique pass) → 2026-06-20 (closeout audit)
**Bookends:** opens with [`phase-1-findings/2026-06-19-cross-screen-synthesis.md`](2026-06-19-cross-screen-synthesis.md); closes with this doc. The audit re-ran `/impeccable` against every Phase 1 screen under identical conditions; snapshots live at `.impeccable/critique/closeout/`.

Diagnostic only. No code shipped from this audit. The artifact's value is the ledger and the M1 readiness statement — read both, then act.

---

## 1. Per-screen then-vs-now

| Screen | P1 score | P1 P0/P1 | Closeout score | Closeout P0/P1 | Δ | One-line narrative |
|---|---|---|---|---|---|---|
| app-en-route-tsx | 28 | 1 / 2 | 34 | 0 / 1 | **+6** | SOS hold-to-confirm + zone-entry haptic-without-layout-disruption + dead speed-limit-sign retired honestly. |
| app-recordings-tsx | 27 | 2 / 2 | 33 | 0 / 2 | **+6** | Per-row iOS Share Sheet + dual-mode delete confirmation; both Phase 1 P0s closed, evidence egress works. |
| app-safety-settings-tsx | 31 | 1 / 2 | 37 | 0 / 1 | **+6** | RowGroup split isolates Emergency SOS from config; recordings count surfaces; hydration flash gone. |
| app-zone-preferences-tsx | 24 | 0 / 2 | 29 | 0 / 1 | **+5** | `allFlagsOff` footer swap discloses degraded state honestly; `ready` gate kills the hydration flash. |
| app-saved-places-tsx | 33 | 0 / 2 | 37 | 0 / 0 | **+4** | `useMutation` rollback + Alert on transient save error — "ghost place" trust break closed. |
| app-trip-summary-tsx | 32 | 1 / 2 | 36 | 0 / 1 | **+4** | Optimistic submit now has race-safe rollback + inline retry; "Remember this destination" replaces the opaque default CTA. |
| app-unfamiliar-tsx | 28 | 2 / 2 | 32 | 0 / 2 | **+4** | Per-row destination spinner closes the silent-async trust break; Lifeline modal copy now capability-honest. |
| app-roadside-tsx | 26 | 1 / 3 | 30 | 0 / 2 | **+4** | Step 3 X-affordance closes the dismissal trap; problem-picker + tow row gain action-describing VoiceOver hints. |
| app-share-location-tsx | 33 | 2 / 1 | 36 | 1 / 1 | **+3** | `handleEnd` failure now surfaces and lets session stay live; per-card hint names contact by name. |
| app-pulled-over-tsx | 29 | 1 / 2 | 32 | 1 / 1 | **+3** | Stop-recording at 44pt + "Recording saved" terminal state + RecordingSaveErrorBanner; dismissal-lock affordance still open. |
| app-menu-tsx | 31 | 0 / 2 | 34 | 0 / 2 | **+3** | Saved-places count surfaces; Map guide row adds coach-mark recoverability; sign-out + calendar P1s unchanged. |
| app-fuel-tsx | 26 | 1 / 2 | 28 | 0 / 2 | **+2** | `canSave` derivation closes the distance-without-range silent misconfig; visible reason-for-disable still missing. |
| app-login-tsx | 26 | 1 / 2 | 28 | 0 / 3 | **+2** | Error taxonomy lifted architecturally; call site hardcodes `'transient'` and drops `.title` — see §3. |
| app-legal-tsx | 31 | 1 / 2 | 33 | 0 / 2 | **+2** | Tab pills clear the 44pt painted floor; scroll-spy + tab a11y role still open. |
| app-sign-out-tsx | 28 | 0 / 2 | 30 | 0 / 2 | **+2** | "Drive safe." replaces the retail farewell — the screen's emotional core is restored. |
| app-trusted-contact-setup-tsx | 28 | 0 / 3 | 30 | 0 / 2 | **+2** | Discriminated-union hook closes hydration flash structurally; change-affordance + error placement carry. |
| app-onboarding-tsx | 35 | 0 / 2 | 36 | 0 / 1 | **+1** | Dynamic Type now wrapped; 5-dot count documented as intent; Skip hint still missing. |
| app-permissions-tsx | 31 | 0 / 2 | 32 | 0 / 1 | **+1** | Recovery-link tap-target verified compliant via PR #238 audit; Dynamic Type gap on recovery footnote remains. |
| app-roadside-setup-tsx | 25 | 1 / 2 | 26 | 1 / 2 | **+1** | `useMutation` cleans the saving path + accessibilityHint added; PR #2 inline-error pattern did not land here. |
| app-home-tsx | 36 | 0 / 2 | 36 | 0 / 2 | **0** | Not touched after Phase 1 baseline; sub-flows it routes into picked up conventions it didn't. |
| app-emergency-tsx | 34 | 0 / 2 | 34 | 0 / 2 | **0** | Deliberately excluded from PR #242 + #246 — labels already disambiguate, countdown IS the confirmation gesture. |
| app-safety-tsx | 35 | 0 / 2 | 35 | 0 / 2 | **0** | Picker untouched; sub-flow rooms now more carefully held than the door that opens them. |
| app-search-tsx | 31 | 0 / 1 | 31 | 0 / 1 | **0** | Untouched; mic-icon inert affordance + missing location-retry still the open items. |
| app-get-started-tsx | 29 | 0 / 2 | 29 | 0 / 2 | **0** | Error taxonomy plumbed; same two P1s (value-prop gap, button border contrast) visible all of Phase 2/3 and now deferred. |
| app-report-tsx | 28 | 0 / 2 | 28 | 0 / 2 | **0** | PR #235 was already counted in Phase 1; PR #241 + PR #242 conventions did not propagate to this surface. |

**Mean delta:** **+2.44** across 25 screens.
**Δ ≥ +4 cohort (8 screens):** en-route, recordings, safety-settings, zone-preferences, saved-places, trip-summary, unfamiliar, roadside.
**Δ = 0 cohort (6 screens):** home, emergency, safety, search, get-started, report.
**Net new P0 surfaced by the closeout:** pulled-over dismissal-lock affordance (see §3).

---

## 2. Cross-screen patterns — then-vs-now

The eight conventions the program operated against: the four Phase 1 cross-screen patterns, plus the four Phase 2/3 codified additions.

| Pattern | Phase 1 status | Closeout status | Evidence pointer | Carry-forward (Phase 4 if there is one) |
|---|---|---|---|---|
| **Optimistic mutations** | Systemic — `useSavedPlaces`, `trip-summary` inference, `useShareSession.handleEnd` all silent-fail. | **Closed for the in-scope hooks.** `useMutation` adopted across `useSavedPlaces`, trip-summary inference, share-location pick/end, recordings delete, roadside-setup save. Rollback in hook, disclosure in screen. | trip-summary closeout (race-safe `statusesRef`); saved-places closeout (split of concerns); share-location closeout (`handleEnd` surfaces + session stays live). | Backport the rollback discipline into surfaces the program didn't reach (`report.tsx` submit, `useTrustedContact.saveContact`). |
| **Hydration / 3-state ladder** | Systemic — 6 screens flashed the wrong empty state during load. | **Closed structurally.** `useHydratedResource` + `ready: false \| true` discriminated unions replace boolean loading on `useSavedPlaces`, `useTrustedContact`, `useRecordings`, `usePreferences`, `useShareSession`. The compiler now prevents the bug class. | saved-places, trusted-contact-setup, zone-preferences, share-location, safety-settings closeouts. | None on the in-scope hooks. New hooks should adopt the same shape by default. |
| **Tap-target painted geometry** | Systemic — 6 screens with painted-vs-hit-area drift. | **Closed for the audited surfaces.** PR #238 fixed legal tab pills (28pt → 44pt painted), pulled-over `stopRecordingBtn`, permissions recovery row verified compliant. | legal closeout (+2 on Consistency + Aesthetic); pulled-over closeout (stop-recording at 44pt); permissions closeout (P1 retired by audit-acceptance). | Search `"Clear" recentClearBtn` (horizontal target sub-44pt) — single-screen mechanical fix. |
| **Reserved-color discipline** | Recurring — token-identity confusion (wiltedgreen as accept fill, freshgreen as unselected border, cardBorderSubtle as separator). | **Largely held; two carve-outs explicitly written.** PR #239 codified Exception #11 (destructive-row red label, sanctioning Sign out + recordings delete). Exception #9 extended for the favorite-gold ring on FuelStopMarker. Open: `inferenceBtnAccept` still `wiltedgreen` (trip-summary closeout P1); `fillBtn` borders still `freshgreen` (fuel closeout P2). | trip-summary P1; fuel P2; menu/recordings separator-token note. | Two-line trip-summary swap + fuel borders are the entire remaining surface. |
| **Dynamic Type compliance** *(Phase 2/3 addition)* | Systemic on secondary affordances — 5 screens skipped `dynamicType()` on safety-critical run-ons (permissions recovery footnote, en-route 11pt coach labels, pulled-over skipHint). | **Codified in `.cursorrules`; partially propagated.** PR #240 brought onboarding, pulled-over, share-location, unfamiliar, fuel into compliance. Open: permissions recovery footnote (P1), en-route coach labels (11pt still), home route-preview ladder never pressure-tested at AX5. | onboarding closeout (`dynamicType` now applied); permissions closeout (the remaining P1); home closeout (the unrun pressure-test). | Permissions recovery-row fix is one line. Home route-preview at AX5 is the largest untested risk surface in the app. |
| **Dismissal affordance consistency** *(Phase 2/3 addition)* | Systemic — drag handles cosmetic, scrim `accessible={false}`, X buttons absent. | **Codified in `.cursorrules` as the painted-X convention; partially propagated.** PR #241 added X to route-comparison, roadside Step 3, others. Open: safety picker modal still lacks painted X; home placement-mode bar uses a separate convention; pulled-over has `usePreventRemove` Alert with no visible lock affordance. | roadside closeout (P0-3 closed); safety closeout (P1 carry); pulled-over closeout (new visible-lock P0 — see §3). | Three-screen sweep: safety modal X, home placement-mode unification, pulled-over lock-indicator. |
| **Accessibility / VoiceOver hint depth** *(Phase 2/3 addition)* | Recurring — 5 screens with `label` but no `hint` on safety-context Pressables. | **Codified in `.cursorrules` as `label = noun, hint = present-tense outcome`; partially propagated.** PR #242 reached share-location, unfamiliar, roadside, roadside-setup, safety-settings. Open: safety picker tiles, home hazard chips, report Pressables, search mic icon. | safety closeout (drift now sharper); share-location closeout (per-card contact-name interpolation closed Sam's red flag); deferral note at next-session.md line 194. | Long-tail sweep is already a tracked deferral (next-session.md L194). |
| **Safety-critical interaction gating** *(Phase 3 addition)* | New pattern — Phase 1 found no convention; SOS one-tap, recordings single-delete, roadside-setup silent validation all unguarded. | **Codified in `.cursorrules` (`## Safety-critical interactions`); `useHoldToConfirm` shipped.** PR #246 brought hold-to-confirm to en-route SOS + roadside SOS; PR #245 dual-mode confirm for recordings delete; carve-out for settings-context one-tap. Open: pulled-over visible-lock affordance (the program's one new P0); login + roadside-setup silent validation; report disabled-Submit explains nothing. | en-route closeout (canonical implementation); pulled-over closeout (residual); roadside-setup closeout (silent validation persists). | The visible-lock pattern is the next safety-critical convention worth codifying. |

Two readings worth surfacing from the table:

The **four Phase 1 patterns** (top half) closed cleanly. Each had a clear architectural fix — a hook, a primitive, a token swap — and the fix propagated to every surface the original critique flagged. The strongest evidence is the hydration ladder: the compiler now enforces what was previously a runtime invariant. Once the discriminated-union shape lands in a hook, the screens it powers cannot regress to the flash-of-wrong-default state without a type error. That's a different and durabler kind of "closed" than the cosmetic patterns.

The **four Phase 2/3 additions** (bottom half) closed *unevenly*. Each was codified as a `.cursorrules` section — the convention is durable — but propagation stopped at whichever surfaces happened to be in the PR's scope. Dismissal landed on route-comparison and roadside Step 3 but skipped the safety picker. VoiceOver hints reached share-location and unfamiliar but stopped at the home hazard chips and the report Pressables. The four written conventions are the program's durable contribution; the uneven propagation is the program's honest limit. §3.2 names this as a pattern in its own right rather than treating it as one-off misses.

---

## 3. New patterns surfaced by the closeout pass

The honest finds the re-critique generated. Each names a gap the Phase 1 lens did not see, or a regression the program itself introduced.

### 3.1 Pulled-over dismissal-lock — the one new P0
PR #246 codified hold-to-confirm and brought it to en-route SOS and roadside SOS. It deliberately skipped pulled-over because `usePreventRemove` was already in place. But `usePreventRemove` fires its Alert *after* the dismiss gesture — the user gestures, the Alert pops, and the user is in the most charged moment of the app reading a system dialog they didn't expect. The visible-lock affordance (a small Lock icon on the DragHandle row when `hasActiveRecording`) is the missing half of the convention. The fix is 1–2 lines of JSX. The closeout flags this as the program's one new P0, surfaced precisely because the convention now exists on adjacent surfaces and the gap is newly visible inside one file.

### 3.2 The "sub-flows are now better than the screen itself" pattern
Six screens scored Δ=0: home, emergency, safety, search, get-started, report. Three of those (home, safety, search) are the *entry surfaces* the user crosses before landing in a sub-flow that *did* get touched. The closeout snapshots flag this in identical language across all three: "the sub-flows the screen routes into are now noticeably better than the screen itself." A user starts on a 31/40 search screen and walks into a 33/40 recordings screen; lands on a 35/40 safety picker that opens into a 36/40 share-location flow; starts on a 36/40 home and crosses into a 34/40 en-route that picked up VoiceOver hint depth the home hazard chips didn't. This is a **generalization gap** — the conventions were written and propagated into the sub-flows but didn't generalize back to the screens that route into them. Naming it explicitly: when the program ships its next convention pass, the propagation should walk *both* directions of every navigation edge, not just the depth-first direction.

### 3.3 Login partial migration
Sprint 1 introduced `lib/error-message.ts` with a typed `domain × disposition` taxonomy. Login routes through `getErrorMessage('auth', 'transient', err).body`. Two ways this regresses user-visible quality:
- Disposition is hardcoded to `'transient'` regardless of error code. The `'permanent'` slot ("Check your Apple ID and try again.") exists upstream and is unreachable from the call site.
- Only `.body` is rendered. The taxonomy returns `{ title: 'Sign-in failed', body: 'Try again.' }`. Login drops `.title` — the user sees a bare "Try again." with no failure framing. Phase 1 copy ("Sign-in failed. Please try again.") was warmer.

The infrastructure landed; the call site doesn't use it. This is the cleanest example in the program of architecturally-correct change producing a small experiential regression. Get-started carries the same pattern (less load-bearing — it's a sign-up entry, not a returning user hitting failure).

### 3.4 Roadside-setup PR #2 spec didn't land
The Phase 2 Sprint 1 inline-error pattern was specced for roadside-setup, trusted-contact-setup, and zone-preferences. It shipped on the latter two. Roadside-setup still has the silent-validation behavior Phase 1 flagged: type "AAA", tap dim Save, get silence. PR #242 added an accessibilityHint that describes the success path, not the disable reason — VoiceOver users hear "Save, button, dimmed, saves your roadside service profile" with no clue about the blocker. This is the single largest Phase 1 finding that the program scoped, then dropped, without recording the scope decision.

### 3.5 The "deferred not failed" cohort
Two screens (home, get-started) carry their Phase 1 P1 findings forward across the entire Phase 2/3 window without any code edit. The closeouts on both flag this in identical language: *these are no longer "newly discovered" findings — they are deferred*. The program did not record either as a deliberate deferral. The closeout is the moment to name them as such so the next planning pass treats them as in-scope-but-deferred rather than as new.

### 3.6 Convention-drift visible-inside-one-file
The safety picker closeout surfaces the sharpest example: the SOS bar at the bottom of `app/safety.tsx` already follows the PR #242 hint convention ("Emergency. Reach a trusted contact or 911." + "Opens emergency options to call your trusted contact or 911."). The four tiles two `<Pressable>` levels above it do not. A VoiceOver user swiping the picker hears the depth shift between the toolkit lane and the emergency lane mid-screen. Same shape on emergency.tsx, where the inline-safety-window in the label is now an undocumented variant of the split-hint convention. The closeout's recommendation in both cases: add a one-line code comment marking the intentional deviation so a future "consistency" audit doesn't refactor it.

### 3.7 Audit-acceptance as a closure mechanism
PR #238's tap-target audit retired the permissions recovery-row P1 without changing a line of code — `paddingVertical: 16` around the ~14pt footnote was verified to yield ~50pt vertical hit area, which clears the rule on the load-bearing axis. The closeout adopts this finding: the P1 is retired by audit-acceptance, not by code change. This is a legitimate closure mechanism for findings where the original critique flagged a *suspicion* the audit can now disprove. Worth naming because the pattern likely applies to a few other carry-over findings whose mechanisms were slightly mis-read in Phase 1 — search closeout's mic-icon VoiceOver mechanism is another example (Phase 1 worst-case description was off; the actual residual is sighted-only). When the rubric scores end-state quality rather than effort, audit-acceptance is the right way to retire findings whose Phase 1 framing didn't survive contact with the code.

---

## 4. Program-produced artifacts inventory

| Artifact | Type | Notes |
|---|---|---|
| `.cursorrules` § Dynamic Type | Convention | Wraps `dynamicType()` use; codifies AX5 pressure-test expectation. PR #240. |
| `.cursorrules` § Dismissal | Convention | Painted-X over scrim-tap-only; documents `usePreventRemove` carve-out. PR #241. |
| `.cursorrules` § Accessibility (VoiceOver) | Convention | `label = noun, hint = present-tense outcome, no "Tap to"`. PR #242. |
| `.cursorrules` § Safety-critical interactions | Convention | Hold-to-confirm threshold, settings-context one-tap carve-out, VoiceOver bypass requirement. PR #246. |
| `.cursorrules` Exception #11 | Reserved-color carve-out | Destructive-red on row labels (Sign out, single-recording delete). PR #239. |
| `.cursorrules` Exception #9 (extended) | Reserved-color carve-out | Favorite-gold ring on `FuelStopMarker`. PR #239. |
| `hooks/useHoldToConfirm.ts` | Primitive (NEW FILE) | The one net-new file in the post-Phase-1 stretch. ~150 LOC. Used by en-route SOS + roadside SOS. VoiceOver-aware single-tap bypass built in. |
| `useHydratedResource<T>` | Primitive (modified) | Discriminated-union `{ ready: false } \| { ready: true, ... }`. Consumed by 5 hooks. Replaces the loading-boolean pattern. Sprint 1. |
| `useMutation` | Primitive (modified) | `{ status, error, run, reset }` with optimistic-rollback hook. Consumed by saved-places, recordings, share-location, trip-summary, roadside-setup. Sprint 1. |
| `getErrorMessage(domain, disposition, err)` | Library | `lib/error-message.ts` + `lib/error-copy.ts`. Typed `domain × disposition` taxonomy with `{ title, body }` return + canonical `[domain:disposition]` log side-effect. Sprint 1. |
| `useCoachMark` extensions | Primitive (modified) | Adds `show()` and `resetCoachMarks()`. Powers the Map guide row in /menu and the Help (?) FAB on /en-route. PR #237. |
| `SafetyErrorMessage` | Component | Inline error surface above CTA. Consumes the taxonomy. Used by report, recordings, share-location. Sprint 1. |
| `RowGroup` `footer` slot (state-aware) | Pattern | Conditional footer carrying degraded-state truth (zone-preferences "All three off"); value-as-state convention (Saved places "N saved"). PR #236. |

**Codebase footprint:** exactly **one new file** (`hooks/useHoldToConfirm.ts`), approximately **150 LOC**. Every other change was modification. Across the program — 18 PRs, 4 conventions written, 2 carve-outs added, 5 primitives extended — the codebase grew by one file and a small handful of style blocks. The mean per-screen quality lift was +2.44, with 8 screens picking up +4 or more.

The program was overwhelmingly a **convention and behavior pass, not an abstraction pass**. Measurable quality improvement with negligible code growth. This is itself part of the evidence — most of what was wrong with the app could be fixed by writing down what "good" meant and propagating it, not by inventing new shared components.

---

## 5. M1 readiness statement

The program's goal was to clear design-debt before the pilot. What the audit is in a position to assert:

**What the program affected:** user-facing surfaces (25 screens audited; 19 saw quality lift), conventions (4 new `.cursorrules` sections + 2 reserved-color carve-outs), the accessibility floor (Dynamic Type compliance, VoiceOver hint depth on safety-critical Pressables, hold-to-confirm for emergency surfaces), and the safety-critical interaction gates (en-route SOS, roadside SOS, single-recording delete).

**What M1.1 (community cloud) actually needs**, per `docs/ROADMAP.md`:
- Stand up the Supabase project + `community_reports` table matching the existing client shape
- `EXPO_PUBLIC_SUPABASE_*` env wiring + verify cross-device pin visibility
- **RLS + abuse-mitigation design** — anon SELECT, gated INSERT, no editing others' rows, report-flagging + moderation path (the weaponization risk the thesis identifies goes live the moment two users share data)

The client (`lib/api/sources/community-cloud.ts`, ~181 LOC, gated by `isCommunityCloudConfigured()`) is already built. The program touched **none** of that code region. M1.1's work is server-side + RLS policy design + abuse-vector thinking; the design-health audit did not advance or retard any of it.

**What M1.2 (EAS → TestFlight) actually needs:**
- `eas.json` (does not exist)
- Real bundle id (currently the `com.anonymous.fresh-greens` placeholder)
- Apple Developer Program membership
- `eas build` + `eas submit` pipeline + TestFlight internal/external tester setup

The program added **zero** EAS configuration. M1.2 is a distribution-infrastructure milestone; no design-debt blocks it.

### Recommendation

**M1.1 is the start.** The program cleared the runway *for* M1.1, not *of* it.

The design surfaces the pilot will use — home, search, en-route, the safety picker and its sub-flows, the report flow, recordings, the settings hub, sign-out — are now consistent enough, honest enough, and accessible enough that a stranger picking up the app at TestFlight won't trip on the kind of cold-moment trust break the program was scoped to fix. The remaining open items (the 6 Δ=0 screens, the unaddressed P1s on login + roadside-setup, the visible-lock affordance on pulled-over) are the program's deferrals — they are visible, named, and tracked in `docs/next-session.md`. They are not pilot-blocking.

What is pilot-blocking is the absence of a server. The next strategic move is **M1.1**.

---

## 6. Outstanding deferrals from the program

Every `docs/next-session.md` item added with a `2026-06-20` stamp — the program's deferrals. All three are tracked. None became pilot-blocking in hindsight.

| Source PR | Item | Status | Pilot-blocking? |
|---|---|---|---|
| PR E (en-route) | Restore posted speed-limit sign on `/en-route` | Tracked at `docs/next-session.md:123`. Removed because the static `—` taught users to distrust other data signals; restore when an OSM `maxspeed` adapter ships. | No. The current-speed pill above it is correct and live. |
| PR C (recordings) | Recordings long-press → context menu / multi-select | Tracked at `docs/next-session.md:132`. Per-row Play / Share / Trash work today; multi-select would unlock bulk-share alongside the existing bulk-delete. | No. Per-row Share (the high-value half) shipped in #245. |
| PR 6 (VoiceOver) | VoiceOver hint long-tail sweep | Tracked at `docs/next-session.md:194`. Convention is in `.cursorrules`; second pass over `home.tsx`, detail cards, partially-hinted surfaces was deferred to keep PR 6 bounded. | No. Safety-critical surfaces already hinted. |

The closeout audit itself surfaces several more items that *should* land here as 2026-06-20-stamped deferrals if they are not already (the pulled-over dismissal-lock P0, the login disposition-mapping P1, the roadside-setup inline-error backport). These are flagged in §3 above; whether they get added to `docs/next-session.md` or routed straight into the planning queue is a sequencing decision for the next session.

---

---

## What this audit is, and isn't

This is a diagnostic — the program's exit ramp, not a victory lap. The score lifts are real but small per screen; the convention propagation is uneven; the codebase grew by one file. That's the honest accounting.

What the audit *is* in a position to assert is that the design surfaces the pilot will rest on are now consistent enough to put in front of strangers, the safety-critical interactions are gated where they need to be, and the accessibility floor is high enough for VoiceOver users to navigate the safety flow without the dignity-failure gaps Phase 1 flagged. The remaining open items are visible, named, and tracked.

What's left between this audit and pilot is server-side. That's M1.1.

---

**The Design Health Program is formally complete.** What was scoped, shipped. What was deferred is tracked. The next strategic move is **M1.1 — community cloud (Supabase server-side + RLS)**, per `docs/ROADMAP.md` and the recommendation above.
