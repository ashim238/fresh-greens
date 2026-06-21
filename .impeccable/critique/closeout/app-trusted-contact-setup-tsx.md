---
target: app/trusted-contact-setup.tsx
total_score: 30
p0_count: 0
p1_count: 2
phase: closeout
timestamp: 2026-06-20
slug: app-trusted-contact-setup-tsx
---

## Phase 1 vs Closeout — Delta

| | Phase 1 (2026-06-19) | Closeout (2026-06-20) | Delta |
|---|---|---|---|
| Total score | 28/40 | 30/40 | **+2** |
| P0 | 0 | 0 | — |
| P1 | 3 | 2 | **−1** |
| Rating band | Good — solid foundation | Good — solid foundation | (same band, healthier interior) |

**What closed (Phase 1 → now):**
- **P1#1 (no loading state during hydration)** — closed structurally. Sprint 1 hooks migration moved `useTrustedContact` to a `ready: false | true` discriminated union (`hooks/useTrustedContact.ts:96`). Line 202 now renders `contactReady ? (preview/empty) : null` so the EmptyState can no longer flash during the hydrate window. The fix is at the type system, not the render branch — cleaner than the Phase 1 suggested `<LoadingState text="Loading contact…">` patch. Visibility of System Status climbs from 2 → 3. (Note: the `null` branch renders no skeleton — fine for the sub-100ms AsyncStorage read on a real device, marginal for cold-cache first paint. Not a P1.)
- **EmptyState copy softened** — "Tap to add someone you trust." replaces the bare "Tap here to add…" hint, partially answering Phase 1 P2#2's accusatory-headline note. The headline itself ("No contact set yet.") is unchanged; the embedded-register charge concern stands but at lower intensity.

**What's still open (Phase 1 → now):**
- **P1#2 (no change/remove affordance on preview card)** — unchanged. `clearContact` is still wired in `useTrustedContact` (line 145) and still never called from a UI surface. Tapping the preview card does nothing; there's no Change button. From Settings entry this is the only edit surface, so a user replacing their trusted contact has no discoverable path. Recognition Rather Than Recall + Flexibility/Efficiency stay at 3/2.
- **P1#3 (error text position/sizing)** — unchanged. Line 261 still renders error at `footnoteRegular` (13pt) red, centred, *below* both action buttons. Sprint 1's `getErrorMessage` taxonomy adoption (line 134) improved the *log* path — `[contact:transient]` is canonical now — but the displayed error UI is byte-for-byte the same. The Black-driver-in-stress red flag still applies.

**What got marginally better in passing:**
- Hook migration also tightened the avatar-entrance logic — `contactReady` now gates the `useEffect` baseline-capture (line 98), removing a class of race where `loading: false` could fire before hydration on hot-reload. Not a Phase 1 finding; clean side effect of the Sprint 1 work.
- `getErrorMessage` taxonomy means the error log is now greppable and analytics-routable per the Phase 2 convention. The user-facing string still falls back to `err.message` first (line 135) — correct, because the hook's "no phone number" message has actionable detail the taxonomy body lacks.

**Net read:** Sprint 1's structural migration silently fixed the most safety-critical Phase 1 finding (hydration flash in the embedded register, where a driver under stress could see "No contact set yet." for a contact they actually set). The two remaining P1s are *additive UX* (change affordance, error placement) rather than *broken-state* bugs. Score lift is modest because the rubric scores end-state quality, not effort — the migration moved the floor up but didn't add new ceiling.

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Hydration flash closed by discriminated-union; no skeleton during the `ready: false` window but read is sub-frame on warm cache |
| 2 | Match System / Real World | 4 | Plain language throughout; "Trusted Contact" matches user mental model |
| 3 | User Control and Freedom | 3 | Back caret + Skip exits present; still no remove affordance once contact is set |
| 4 | Consistency and Standards | 3 | Dual-register `stylesWhite` overrides + Button transparent-on-dark / outline-on-light Skip swap remain coherent |
| 5 | Error Prevention | 2 | No upstream filter prevents picking a contact with no phone number — user completes gesture then hits wall |
| 6 | Recognition Rather Than Recall | 3 | EmptyState discoverable; preview card still lacks visible change/remove affordance |
| 7 | Flexibility and Efficiency | 2 | Single path to change contact; `clearContact` exported but no UI surface |
| 8 | Aesthetic and Minimalist Design | 4 | Excellent restraint — two states, one action zone, no chrome noise |
| 9 | Error Recovery | 2 | Error text (13pt centred, below buttons) easy to miss; gives no next-step suggestion; taxonomy log path improved but UI unchanged |
| 10 | Help and Documentation | 4 | Body copy serves as documentation; trust copy ("Fresh Greens never messages them on its own") earns its place — every clause carries a user-visible decision |
| **Total** | | **30/40** | **Good — solid foundation, two additive UX gaps to close** |

## Anti-Patterns Verdict

No AI slop detected. No gradient text, no glassmorphism, no eyebrow labels, no identical card grid, no decorative color. Dual-register architecture remains a genuine design decision with correctly scoped style overrides. The `fill="transparent"` Button consumer (line 295-302) is a documented, audited Phase 2 pattern — primary+transparent renders white+underlined per Button.tsx:90-95, valid only on dark surfaces, used here exactly where the Button doc says it should be (onboarding register, Skip secondary action). No additions of slop families since Phase 1.

## Cognitive Load

1 of 8 checklist items fail (same as Phase 1): progressive disclosure — no affordance to change/remove contact once set, requiring recall of re-entry path. Decision point count (2 buttons) is well within working memory limits. The discriminated-union hook closes the working-memory concern Phase 1 flagged in the `loading` race ("did I set this last week?") at the type level rather than at the UI level.

## Emotional Journey

Onboarding peak is still the avatar spring + success haptic on contact pick — well-placed reward, now firing cleanly without the hot-reload race. Missing: still no completion moment at step 5/5 — Continue exists but does not acknowledge finishing. Embedded register copies onboarding tone verbatim; "No contact set yet." reads as judgment in a charged mid-stop context where the user is under stress (Phase 1 P2 still applies at lower intensity since the supporting line softened). Peak-end rule: end remains emotionally neutral across both registers.

## What's Working

1. **Discriminated-union hook (Sprint 1 win).** `useTrustedContact` returns `{ ready: false } | { ready: true; contact }` and the screen narrows at line 76-77 — the Phase 1 hydration-flash concern can't recur because the compiler enforces the gate. This is the right shape of fix for a safety-app loading state: structural, not retrofitted.
2. **Reserved-color discipline still holds** — `colors.red` on error is carve-out #8; fadedgreen/labelTertiary for secondary text in correct registers; no signal colors decoratively. `colors.freshgreen` on the UserPlus icon (line 250) is the only carve-out and it's the EmptyState's primary brand-pull, exactly the use case the reserved-color rule allows.
3. **Top-of-file documentation continues to earn its weight.** The `from=onboarding` inversion explanation (line 43-51), the `stylesWhite` 1:1 override naming, and the avatar-entrance ref logic are all explained inline. A new agent landing on this file has the rationale for every non-obvious choice. Phase 2 convention says the comment block is load-bearing; this one is.

## Priority Issues

**[P1] No change/remove affordance on preview card** *(carried from Phase 1, unchanged)*
- What: Once contact is picked, no visible affordance to replace or remove it; `clearContact` exists in the hook (useTrustedContact.ts:145) but is never wired to a UI surface
- Why it matters: This is also the edit surface from Settings — a user changing contacts has no discoverable path. Sprint 1's hook migration kept `clearContact` in the API, signaling intent; the UI lag is now visible.
- Fix: Add `Button type="secondary" fill="outline" text="Change contact"` below preview card calling `handlePickContact()`; optional destructive "Remove contact" calling `clearContact()` for full hook-surface parity
- Suggested command: /impeccable harden

**[P1] Error recovery message below action block, too small, no next step** *(carried from Phase 1, unchanged)*
- What: Line 261 renders error at footnoteRegular (13pt) centred below buttons — invisible in stress moments; message names problem but gives no next step. Sprint 1's `getErrorMessage` taxonomy improved the log path but not the displayed UI.
- Why it matters: User taps again re-entering same wall; in charged embedded register this is safety-critical feedback. The "no phone number" error path is the one users actually hit (picker doesn't filter by phone availability) so this is real, not edge-case.
- Fix: Move error above action block; bump to subheadlineRegular (15pt); add Phosphor WarningCircle icon for non-color redundancy; consider rendering `getErrorMessage(...).title` as a heading above the body for the taxonomy two-line shape
- Suggested command: /impeccable clarify

**[P2] Onboarding completion has no emotional payoff** *(carried from Phase 1)*
- What: Step 5/5 with contact set routes to home with no acknowledgment; Continue button text is generic
- Why it matters: "The Steady Companion" brand should notice when the user does something meaningful
- Fix: When contact set + onboarding register, change button text to "You're all set" or "Let's go"; optionally replace PageControl with a checkmark on completion
- Suggested command: /impeccable clarify

**[P2] EmptyState headline accusatory in stress register** *(carried from Phase 1, supporting copy now softened)*
- What: "No contact set yet." (line 254) is a judgment statement in the embedded/emergency register. Supporting copy was softened to "Tap to add someone you trust." — headline unchanged.
- Why it matters: Brand principle is "Safety through calm, not alarm" — a statement of absence as a period-ended sentence still fails a user in distress, even with friendlier follow-up
- Fix: Change to "No contact set." (drop the "yet" which reads as gentle blame), or condition the headline on register: embedded shows "Add a trusted contact" (action-framed), onboarding keeps the absence framing
- Suggested command: /impeccable clarify

**[P2] No completion-state acknowledgment for the embedded edit case** *(new in closeout)*
- What: When entering from Settings to *change* a contact, the screen reuses the onboarding success affordances (avatar spring, success haptic) but the user already knew they were doing a change — the spring fires on the swap and that's the only feedback. No "Saved" / "Updated" microcopy in the embedded register.
- Why it matters: Phase 1 flagged completion-payoff gap in onboarding; the same gap exists for the edit case, where the user did discrete work (swapped a contact) and got identical feedback to a first-time set. Hard to know "did the swap stick?" without re-reading the name.
- Fix: After a swap in embedded register, render a subdued `Saved · {timestamp}` line under the preview card, or toast on `router.back()`
- Suggested command: /impeccable clarify

## Persona Red Flags

**Sam (accessibility):** Phase 1's VoiceOver double-announce concern (EmptyState inside Pressable, inner `accessibilityRole="text"` vs outer `accessibilityRole="button"`) is unchanged — still need `importantForAccessibility="no-hide-descendants"` on the inner EmptyState root. The discriminated-union win does NOT help here: no accessibility live region announces when preview card replaces EmptyState after pick. Add `accessibilityLiveRegion="polite"` to the preview View. The Sprint 1 work would have been the right moment to thread this through; opportunity missed.

**Casey (distracted mobile):** EmptyState fixed `width: 326` in StateCard.tsx still overflows iPhone SE (320pt content, 256pt inside paddingHorizontal:32) — layout bug Phase 1 caught is still there. Back caret top-left ergonomic cost unchanged (HIG convention). New observation: the `fill="transparent"` Skip button underlines its text (Button.tsx:124, `labelUnderlined`) — on a small device with vibration, an underlined link below a filled pill button is a clear hierarchy signal, no regression here.

**Black driver in charged moment:** Error message position/size is unchanged from Phase 1 — still the most safety-critical fix on the board. Trust copy ("Fresh Greens never messages them on its own") still earns its place. The Sprint 1 taxonomy work means a `[contact:transient]` event now logs cleanly for post-incident audit, which is right for the trust contract but doesn't help the user in the moment.

## Minor Observations

- `colors.labelTertiary` (#3D3D3D fully opaque, ~24% lighter than iOS system `rgba(60,60,67,0.6)`) — Phase 1 question stands; closeout adds: this divergence shows on the preview card phone number (line 449) where it sits on `systemGroupedBackground` in the white register. Verify contrast on light gray.
- `marginLeft: -16` on backHeader (line 331) — Phase 1 fragility note stands; an opportunity-of-passing fix would have nested the caret outside the padded View.
- `picking` state visual feedback — Phase 1 noted EmptyState wrapper doesn't surface a loading indicator. The Sprint 1 migration touched the Button consumer but not this Pressable; the EmptyState wrapper could pass `picking` to a `loading` prop if EmptyState supported one. Currently the user taps and sees no UI response until the iOS picker presents (usually fast, occasionally not).
- Avatar initials still at fixed `title3Emphasized` without `dynamicType()` — documented exception (line 378-380); confirm Figma-specified intent vs. implementation convenience.
- `relaxedLineHeight()` on body copy (17pt × 1.6 = 27.2pt) — Phase 1 observed this may be over-engineered. Still worth confirming.
- New: the `fill="transparent"` Button render (line 295) ships with underlined white text per Button.tsx — on the wiltedgreen page bg this gets 6.54:1 contrast (computed from Button.tsx:175-179 commentary). Audited; clean.

## Questions to Consider

- The hydration `null` branch (line 259) renders nothing — is a one-frame blank screen on cold-cache first paint acceptable for the onboarding register, where the screen is the entry? Consider a wiltedgreen-tinted skeleton for the first 100ms.
- `clearContact` exists in the hook signature (useTrustedContact.ts:91-94) but no UI calls it. Is removal intentionally deferred to a settings-only "Remove trusted contact" surface, or just unfinished here?
- The Sprint 1 `getErrorMessage` taxonomy returns `{ title, body }` — should the displayed error use both (`title` as the heading, `body` as the recovery text)? Currently only `body` is used as fallback (line 134); `title` is discarded.
- Does "Set your Trusted Contact" title work for the edit-from-Settings case? Title should arguably be conditional on `contact != null` ("Update your Trusted Contact").
- iPhone SE (320pt) width still untested? EmptyState card is still 326pt — 6pt overflow.

---

**Trend for `app-trusted-contact-setup-tsx`: 28 → 30**

Phase 1 baseline 2026-06-19, closeout 2026-06-20. +2 from Sprint 1 hooks migration silently closing the hydration-flash P1. Two P1s (change affordance, error placement) remain as additive UX gaps; no new P0/P1 introduced.
