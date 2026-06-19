---
target: app/trusted-contact-setup.tsx
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-06-19T09-49-21Z
slug: app-trusted-contact-setup-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | `contactLoading` consumed but no skeleton renders during async hydration — EmptyState flashes before resolving to preview |
| 2 | Match System / Real World | 4 | Plain language throughout; "Trusted Contact" matches user mental model |
| 3 | User Control and Freedom | 3 | Back caret + Skip exits present; missing: no remove affordance once contact is set |
| 4 | Consistency and Standards | 3 | Transparent vs outline Skip flip is intentional and correct but requires re-parsing per register |
| 5 | Error Prevention | 2 | No upstream filter prevents picking a contact with no phone number — user completes gesture then hits wall |
| 6 | Recognition Rather Than Recall | 3 | EmptyState is discoverable; preview card lacks visible change/remove affordance |
| 7 | Flexibility and Efficiency | 2 | Single path to change contact; no inline change/remove action visible after contact is set |
| 8 | Aesthetic and Minimalist Design | 4 | Excellent restraint — two states, one action zone, no chrome noise |
| 9 | Error Recovery | 2 | Error text (13pt centred, below buttons) easy to miss; gives no next-step suggestion |
| 10 | Help and Documentation | 3 | Body copy serves as documentation; answers what the contact receives before user wonders |
| **Total** | | **28/40** | **Good — solid foundation, address gaps before pilot** |

## Anti-Patterns Verdict

No AI slop detected. No gradient text, no glassmorphism, no eyebrow labels, no identical card grid, no decorative color. Dual-register architecture is a genuine design decision with correctly scoped style overrides. Deterministic scan (detect.mjs): zero findings, exit code 0.

## Cognitive Load

1 of 8 checklist items fail: progressive disclosure — no affordance to change/remove contact once set, requiring recall of re-entry path. Decision point count (2 buttons) is well within working memory limits.

## Emotional Journey

Onboarding peak is the avatar spring + success haptic on contact pick — well-placed reward. Missing: no completion moment at step 5/5 — Continue exists but does not acknowledge finishing. Embedded register copies onboarding tone verbatim; "No contact set yet." reads as judgment in a charged mid-stop context where the user is under stress. Peak-end rule: end is emotionally neutral across both registers.

## What's Working

1. Top-of-file comment block is load-bearing documentation — the dual-register, routing bug history, and default inversion are explained. `stylesWhite` 1:1 override naming makes conditionals readable.
2. Reserved-color discipline holds — `colors.red` on error is carve-out #8; fadedgreen/labelTertiary for secondary text in correct registers; no signal colors decoratively.
3. EmptyState-as-Pressable is the right affordance: whole card is the primary CTA, correct a11y labelling, `busy`/`disabled` state threaded through `picking`.

## Priority Issues

**[P1] No loading state during async hydration**
- What: `contactLoading` is consumed in animation guard but no loading branch renders — screen shows EmptyState during hydration window even if contact is stored
- Why it matters: In the embedded/mid-stop register, a driver sees "No contact set yet." for a perceptible flash even though they set one last week — safety-critical mismatch
- Fix: Add `if (contactLoading) return <LoadingState text="Loading contact…" />` in the content render zone; prevents layout flash and spurious animation triggers
- Suggested command: /impeccable harden

**[P1] No change/remove affordance on preview card**
- What: Once contact is picked, no visible affordance to replace or remove it; user must know to re-enter the screen and re-tap
- Why it matters: This is also the edit surface from Settings — a user changing contacts has no discoverable path
- Fix: Add `Button type="secondary" fill="outline" text="Change contact"` below preview card calling `handlePickContact()`; optional destructive "Remove" for full clearContact support
- Suggested command: /impeccable harden

**[P1] Error recovery message below action block, too small, no next step**
- What: Error text at footnoteRegular (13pt) centred below buttons — invisible in stress moments; message names problem but gives no next step
- Why it matters: User taps again re-entering same wall; in charged embedded register this is safety-critical feedback
- Fix: Move error above action block; bump to subheadlineRegular (15pt); add Phosphor WarningCircle icon for non-color redundancy
- Suggested command: /impeccable clarify

**[P2] Onboarding completion has no emotional payoff**
- What: Step 5/5 with contact set routes to home with no acknowledgment; Continue button text is generic
- Why it matters: "The Steady Companion" brand should notice when the user does something meaningful
- Fix: When contact set + onboarding register, change button text to "You're all set" or "Let's go"; optionally replace PageControl with a checkmark on completion
- Suggested command: /impeccable clarify

**[P2] EmptyState headline accusatory in stress register**
- What: "No contact set yet." is a judgment statement in the embedded/emergency register
- Why it matters: Brand principle is "Safety through calm, not alarm" — a statement of absence as a period-ended sentence fails a user in distress
- Fix: Change to "No contact set." + "Tap here to add someone you trust." In embedded register consider adding "You can still call 911 without this." as reassurance
- Suggested command: /impeccable clarify

## Persona Red Flags

**Sam (accessibility):** EmptyState inside Pressable creates potential VoiceOver double-announce (inner component has accessibilityRole="text", outer Pressable has accessibilityRole="button"). Add `importantForAccessibility="no-hide-descendants"` to inner EmptyState root when used as Pressable child. No accessibility live region announces when preview card replaces EmptyState after pick — add `accessibilityLiveRegion="polite"` to preview View.

**Casey (distracted mobile):** EmptyState has fixed `width: 326` in StateCard.tsx — 6pt wider than iPhone SE (320pt). Inside SafeAreaView with `paddingHorizontal: 32` giving 256pt content width on SE, the card overflows by 70pt. Genuine layout bug on small screens. Back caret is top-left (least thumb-reachable) — structural iOS HIG convention, known ergonomic cost.

**Black driver in charged moment:** Error message for "no phone number" contact pick fires in 13pt red text below buttons — nearly invisible with adrenaline and environmental distraction. The P1 error fix (reposition above buttons, bump size) is most critical for this persona. Trust copy ("Fresh Greens never messages them on its own") is exactly right — do not remove or abbreviate.

## Minor Observations

- `colors.labelTertiary` is `#3D3D3D` (fully opaque, ~24% lighter than iOS system tertiary `rgba(60,60,67,0.6)`) — check whether this intentional divergence from iOS semantic is visible on systemGroupedBackground
- `marginLeft: -16` on backHeader is a brittle offset compensating for paddingHorizontal:32 — fragile if spacing changes; nest caret outside padded View instead
- `picking` state has no visual loading indicator on the EmptyState Pressable — Button component supports `loading` prop, EmptyState wrapper does not surface it; user sees a frozen screen if picker is slow to present
- `relaxedLineHeight()` on body copy (17pt × 1.6 = 27.2pt) — stress-state line-height for a 3-sentence onboarding paragraph may be over-engineered; confirm this wasn't leftover from longer copy
- Avatar initials at fixed `title3Emphasized` without `dynamicType()` — documented exception mirroring LifelineModal; confirm Figma-specified vs implementation convenience

## Questions to Consider

- What happens if Continue is tapped while `contactLoading` is still true? Should Continue be disabled until hydration resolves?
- Does "Set your Trusted Contact" title work for the edit-contact case from Settings? Should title be conditional on whether a contact exists ("Update" vs "Set")?
- Has iPhone SE (320pt) width been tested? EmptyState card is 326pt — 6pt overflow.
- Should "Skip for now" label be "Cancel" in the embedded register where it returns to Settings, not defers to later?
- `clearContact` is exported by the hook but never called from a UI surface — is removal intentionally out of scope, or an unfinished affordance?
