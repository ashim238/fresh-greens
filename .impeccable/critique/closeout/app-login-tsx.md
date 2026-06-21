---
target: app/login.tsx
phase: closeout
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-06-20
slug: app-login-tsx
---

## Phase 1 vs Closeout

| | Phase 1 (2026-06-19) | Closeout (2026-06-20) | Δ |
|---|---|---|---|
| Score | 26/40 | 28/40 | +2 |
| P0 | 1 | 0 | −1 |
| P1 | 2 | 3 | +1 |
| Verdict | Functional but fragile | Functional, structurally healthier, surface unchanged | — |

**What moved.** The P0 — "error state lacks diagnostic differentiation" — is partially resolved at the architecture level, not the surface. Phase 2 introduced `lib/error-message.ts` with a typed `domain × disposition` taxonomy. Login now calls `getErrorMessage('auth', 'transient', err).body` rather than carrying a hardcoded string. That earns +2 on Heuristic 9 (recognition/diagnose/recover): the canonical [auth:transient] log fires and an `auth.permanent` slot exists upstream ("Check your Apple ID and try again."). But login still only ever passes `'transient'` — the disposition isn't conditional on error code, so the *user-visible* copy is still single-variant ("Sign-in failed. Try again."), and Apple credential expiry or network failure both render identically. P0 → P1.

**What didn't move.** Divider/"or", token adoption (still `paddingHorizontal: 32`, `borderRadius: 100`, `gap: 88`, etc.), `dividerLine` using `colors.wiltedgreen` instead of `colors.dividerOnDark`, `loginLink.fontWeight` borrowing `footnoteEmphasized.fontWeight`, missing `accessibilityLiveRegion` on error, no error haptic, no biometrics, no "where you'll land" subtitle, no help/contact escape. The screen is byte-identical in surface terms to the Phase 1 capture except for the `getErrorMessage` indirection.

**New finding promoted.** Disposition-mapping logic now belongs in `handleAppleSignIn` (P1) — the infrastructure to differentiate exists; the call site doesn't use it. That's a fresh P1 the Phase 1 critique couldn't have written.

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | ActivityIndicator + `accessibilityState.busy` unchanged from Phase 1; canonical `[auth:transient]` warn now fires for devs, no surface change for users |
| 2 | Match Between System and World | 4 | "Welcome back" still lands warm; "Log in with Apple" still diverges from Apple HIG canonical "Sign in with Apple" |
| 3 | User Control and Freedom | 2 | Apple sheet still the only path; no retry shortcut, no fallback, no support touchpoint |
| 4 | Consistency and Standards | 3 | Mirrors get-started faithfully; error copy now sourced from shared taxonomy — consistency with other auth-domain errors improved |
| 5 | Error Prevention | 2 | `signingIn` guard correct; `disabled={signingIn}` wired; still no proactive network-required hint |
| 6 | Recognition over Recall | 3 | "or" divider still implies parallel auth methods that don't exist |
| 7 | Flexibility and Efficiency | 2 | No biometrics, no passkey, no "remember me" — v1 deliberate hold |
| 8 | Aesthetic and Minimalist Design | 4 | Two actions, one error slot, one divider — clean |
| 9 | Help Users Recognize, Diagnose, and Recover | 3 | Taxonomy lift: `getErrorMessage('auth', 'transient')` swappable to `'permanent'` per error code; **call site doesn't switch yet** — diagnostic differentiation is one-line away but unbuilt. +2 over Phase 1 because the path exists, not because it's used. |
| 10 | Help and Documentation | 2 | No "trouble signing in?" link; charged-moment friction unchanged |
| **Total** | | **28/40** | **Functional, taxonomy-ready, call site lagging** |

## Anti-Patterns Verdict

**Not AI slop.** Same pass as Phase 1: no gradient text, no glass, no eyebrow, no generic ride-share register. Reserved-color rule clean — `colors.red` only on error text (documented exception #8), `colors.freshgreen` only on the "Sign up" inline link (semantic accent, narrow surface), no other reserved-color leakage. Earthy palette intact.

Same borderline flag as Phase 1: 13pt red on burntgreen with surrounding white reads visually hot. Now that the taxonomy supports a `title` field too (`{ title: 'Sign-in failed', body: 'Try again.' }`), the screen could render a two-line error like the safety domain does — but currently only `.body` is consumed, so the screen-level treatment hasn't matured.

## Cognitive Load

| Item | Status | Note |
|---|---|---|
| Single primary action per view | Pass | One CTA dominates |
| Action labels describe what happens | Partial | "Log in with Apple" — provider, not outcome |
| Error states give next steps | Fail | "Try again." (shortened from Phase 1's "Please try again.") is even more terse — taxonomy collapsed the copy; no progress on guidance |
| No gratuitous choices | Pass | Divider/or framing still semantically off, decision load minimal |
| Transition logic clear | Fail | Still no on-screen hint that login lands on `/home` |
| Loading distinguished from idle | Pass | ActivityIndicator replaces button content |
| Tap targets compliant | Pass | CTA 48pt; sign-up row 52pt with padding |
| Visual hierarchy reflects action priority | Pass | Title → CTA → escape link |

**Regression flag, not score-affecting:** Phase 1 error copy was "Sign-in failed. Please try again." (10 words, soft register). Closeout copy via taxonomy is "Try again." (2 words). Terser is fine if the title ("Sign-in failed") is shown — but login only renders `.body`, so the *user sees just "Try again."* with no failure framing at all. This is a behavior regression masked by an architectural improvement.

## Emotional Journey

**Arriving:** Unchanged. "Welcome back" still lands warm.

**Pressing the CTA:** Unchanged. Apple sheet rises immediately. `pressedDim` correct. Success haptic still placed at right beat.

**Error state:** Worse on the surface than Phase 1 — "Try again." reads as a curt instruction rather than an acknowledgment that something went wrong. For a returning user in a charged moment, the message register dropped from cold-diagnostic to cold-imperative. Architecturally healthier (typed taxonomy, canonical log), experientially flatter.

**Escape link:** Unchanged. "Don't have an account? Sign up" still the wrong escape for a returning user hitting auth failure.

## What's Working

**1. Error taxonomy infrastructure landed.** `lib/error-message.ts` + `lib/error-copy.ts` provide a typed `domain × disposition` table. `auth.transient` and `auth.permanent` slots exist; `auth.needs-setup` is correctly `null`; `cancelled` returns silent empty copy matching the existing `ERR_REQUEST_CANCELED` suppression. This is the right substrate for the Phase 1 P0 fix.

**2. Canonical logging side-effect.** `getErrorMessage(..., err)` emits `[auth:transient]` warn — replaces ad-hoc patterns and gives a grep-able audit trail for sign-in failures in dev. Phase 1 had no such telemetry seam.

**3. Brand coherence, accessibility implementation, route logic, comment-as-provenance** — all unchanged from Phase 1 and still strong.

## Priority Issues

**[P1] Disposition is hardcoded to `'transient'` regardless of error code**
- What: `getErrorMessage('auth', 'transient', err)` is called for every non-cancelled error. The `'permanent'` slot ("Check your Apple ID and try again.") and any future `network` slot are unreachable from login.
- Why it matters: Phase 1 P0 was "error state lacks diagnostic differentiation." Phase 2 built the rails to fix it; the call site didn't switch onto them. A returning user with an expired Apple credential gets identical copy to a network drop — the exact failure the taxonomy was designed to disambiguate.
- Fix: Branch on `err.code` (and likely a network-error sniff via `err.message` or fetch-error shape) inside `handleAppleSignIn`. Map known-permanent codes to `'permanent'`, default to `'transient'`. Add a `network` disposition to the taxonomy if a fetch failure can be distinguished cleanly. Mirror in `get-started.tsx`.

**[P1] Only `.body` is rendered — `.title` from taxonomy is discarded**
- What: `setError(getErrorMessage('auth', 'transient', err).body)` drops the `title` field. The taxonomy returns `{ title: 'Sign-in failed', body: 'Try again.' }` and login renders only "Try again."
- Why it matters: Behavior regression vs. Phase 1's "Sign-in failed. Please try again." — the failure framing is gone. User sees a bare imperative with no acknowledgment something failed. Worse register in a charged moment than the Phase 1 string it replaced.
- Fix: Either (a) store `{ title, body }` in state and render both with hierarchy (title in `footnoteEmphasized`, body in `footnoteRegular`), or (b) concatenate `${title}. ${body}` for a one-line restoration. Option (a) is the higher-fidelity move and matches what the taxonomy was shaped to enable.

**[P1] No `accessibilityLiveRegion` on error text + no error haptic**
- What: Carried directly from Phase 1's Sam/Casey/driver red flags. Error `<Text>` has no live region; failure path has no `Haptics.NotificationFeedbackType.Error`. The success haptic is present; the symmetric failure haptic is absent.
- Why it matters: VoiceOver user gets no announcement that error appeared. Sighted-but-distracted user gets no tactile confirmation the tap registered and failed. In safety-app context, the silent failure is the worst-case interaction.
- Fix: Add `accessibilityLiveRegion="polite"` to error `<Text>`. Add `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})` to catch block (gated on non-`ERR_REQUEST_CANCELED`).

**[P2] "or" divider still creates false parallel** *(carried from Phase 1 P1)*
- What: Divider with "or" sits between primary CTA and "Don't have an account? Sign up." "Or" implies peer auth method.
- Why it matters: Same as Phase 1 — users scan dividers as "here are my options."
- Fix: Remove divider or replace "or" with visual separator only. Treat "Don't have an account?" as footer.
- **Demotion rationale:** Closeout-phase priority. Real but cosmetic vs. the live error-handling gap.

**[P2] No post-sign-in destination communication** *(carried from Phase 1 P1)*
- What: Nothing on screen tells returning user they'll land on `/home`.
- Fix: Add subtitle under "Welcome back" — "Pick up where you left off." — in `subheadlineRegular`.
- **Demotion rationale:** Polish, not blocker.

**[P2] Token adoption still missing** *(carried from Phase 1 P2)*
- What: `paddingHorizontal: 32`, `height: 48`, `borderRadius: 100`, `gap: 88`, `gap: 16`, `gap: 8` all hardcoded. `theme/spacing.ts` and `theme/radii.ts` exist and are unused here.
- Why it matters: `.cursorrules` anti-slop rule #2.
- Fix: Import `spacing`, `radii`; replace inline values. Apply to `get-started.tsx` simultaneously.

**[P2] `loginLink` borrows weight from a different size token** *(carried from Phase 1 P2)*
- What: `fontWeight: typography.footnoteEmphasized.fontWeight` while the rendered size is 15pt.
- Fix: Use `'600'` directly or define `subheadlineEmphasized.fontWeight`. Sync `get-started.tsx`.

**[P3] `dividerLine` uses `colors.wiltedgreen` instead of `colors.dividerOnDark`** *(carried from Phase 1 P3)*
- Fix: `backgroundColor: colors.dividerOnDark`. Same fix in `get-started.tsx`.

## Persona Red Flags

**Sam (accessibility):** All Phase 1 gaps still present. `accessibilityLiveRegion` still missing from error `<Text>`. `ActivityIndicator` still unlabeled. New: shorter error body ("Try again.") gives Sam even less context if the live region is added later.

**Casey (distracted mobile):** Worse than Phase 1 on the error register — "Try again." is too small (13pt) and too terse to register at a glance. Still no failure haptic.

**Black driver in a charged moment:** Same gap as Phase 1, now with a subtler wrinkle — the taxonomy lift made the developer ergonomics better while the user-facing error voice flattened. The persona where this matters most got a structurally healthier system and a slightly colder message.

## Minor Observations

- All Phase 1 minors still apply: wiltedgreen-on-burntgreen border contrast, `StatusBar` placement, `get-started-cars.png` filename, `loginLink` provenance comment.
- New: the `getErrorMessage` call passes `err` as the third arg, so the canonical `[auth:transient]` warn fires per `error-message.ts`. Good — that's the handler-mode contract.
- The rule-of-three comment block on `<AuthScreen />` extraction is still valid. If a settings sign-in lands, the disposition-mapping logic from the P1 fix above is the prime candidate to lift into the shared component.

## Questions to Consider

1. Which Apple Sign In error codes (beyond `ERR_REQUEST_CANCELED`) should map to `'permanent'` disposition? `ERR_INVALID_RESPONSE`? `ERR_INVALID_OPERATION`?
2. Should a `'network'` disposition be added to the taxonomy, or is network failure detectable enough at the catch site to branch into `'transient'` with custom copy?
3. Should the error render use `{ title, body }` (two-line) or stay single-line? Two-line restores Phase 1's failure framing and matches the safety domain's render shape.
4. Is the `Haptics.NotificationFeedbackType.Error` add the right place to also sync `get-started.tsx`? Both screens share the same handler shape.
5. Phase 1 question still open: is the "or" divider load-bearing for a planned v2 second auth, or removable now?
