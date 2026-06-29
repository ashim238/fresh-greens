---
target: app/moderation.tsx
total_score: 23
p0_count: 2
p1_count: 3
timestamp: 2026-06-29T21-47-37Z
slug: app-moderation-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No user-facing feedback on action success/failure — just haptics. No toast, no progress count during bulk ops. |
| 2 | Match System / Real World | 3 | Good moderator vocabulary. Raw category_id values shown instead of human-readable labels. "Needs review" section vs "hidden" badge vocabulary mismatch. |
| 3 | User Control and Freedom | 2 | No undo after restore/remove. No Select All / Deselect All in bulk mode. Cannot abort mid-flight bulk action. |
| 4 | Consistency and Standards | 3 | Strong token discipline, iOS HIG followed. cardHidden side-stripe violates design system ban. transformOrigin: 'left' is web-only (broken on RN). |
| 5 | Error Prevention | 3 | Hold-to-confirm for destructive actions is excellent. Cross-section filtering prevents invalid bulk ops. No summary before bulk remove. |
| 6 | Recognition Rather Than Recall | 3 | Status badges are good. Progressive disclosure via panels is excellent. No search/filter for breadth navigation. |
| 7 | Flexibility and Efficiency | 2 | Bulk mode exists but no search, sort, or filter. No Select All. Linear scroll only. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean progressive disclosure. Good density management via collapsible panels. Two named-rule violations (side-stripe, caption2 floor). |
| 9 | Error Recovery | 1 | API errors silently console.warn. No user-facing error state. ErrorState component not used. No retry. Partial bulk failure is silent. |
| 10 | Help and Documentation | 1 | No guidance on when to restore vs. remove. No explanation of hidden vs removed distinction. Coordination warning is the only contextual help. |
| **Total** | | **23/40** | **Acceptable** |

## Anti-Patterns Verdict

**Does this look AI-generated?** No. This is a purpose-built moderation tool with genuine domain-specific features — coordinated flagging detection via IP/device deduplication, haversine proximity search for nearby reports, hold-to-confirm on destructive actions. The investigation panels (submitter history, nearby reports, flags) show real understanding of what moderators need to make decisions. No generic card grids, no gradient text, no glassmorphism, no eyebrow-on-every-section scaffold.

**LLM assessment:** The product-register test passes — a moderator fluent in admin tools would trust this interface's vocabulary and patterns. Two violations: (1) cardHidden uses borderLeftWidth: 3, borderLeftColor: colors.orange — a banned side-stripe accent. (2) Six caption2 (11pt) uses for informational metadata breach the 12pt Floor Rule.

**Deterministic scan:** detect.mjs returned clean (0 findings). Expected — the detector targets HTML/CSS markup, not React Native TSX.

## Overall Impression

A solid first-pass moderation tool that gets the core workflow right — the investigation panels are genuinely excellent UX, and the hold-to-confirm pattern is well-implemented. The biggest gap is **silent failure**: API errors vanish into console.warn, leaving moderators unsure whether their actions took effect. A fetch failure is indistinguishable from an empty queue — dangerous for a moderation tool. The second gap is **discoverability at scale**. The single biggest opportunity: user-facing action feedback and error states.

## What's Working

1. **Investigation panels are genuinely useful UX.** Submitter history, nearby reports (haversine-based), and flags with coordinated-flagging detection give moderators real decision-support context. Progressive disclosure keeps them tucked away until needed.

2. **Hold-to-confirm is well-implemented.** The useHoldToConfirm hook with an animated progress ring for destructive actions is excellent error prevention, consistent between single and bulk actions.

3. **Token discipline is strong.** Every design value comes from theme/ — colors, typography, spacing, radii, shadows, interaction tokens. The Wilted-Eyebrow Rule is correctly applied to section titles. Badge styling is systematic.

## Priority Issues

### [P0] Silent fetch failure is indistinguishable from an empty queue
When fetchQueue gets a non-ok status or throws, it calls setLoading(false) and leaves reports empty. The screen renders "No reports to review." — identical to a genuinely clean queue. A moderator on a bad network or with an expired session token will believe the queue is empty. This is an integrity failure for a moderation tool. Fix: Add fetchError state, render visible error banner with Retry button. Suggested command: /impeccable harden

### [P0] Bulk remove partial failure is silent on-screen
When some bulk removes succeed and some fail, the moderator gets a haptic error buzz but no visible indication of which reports failed or how many. The moderator cannot retry the failures. In a tool that does permanent deletions, unacknowledged failures are data integrity risks. Fix: Retain failed IDs in selection, show visible error count banner, don't exit bulk mode on partial failure. Suggested command: /impeccable harden

### [P1] cardHidden uses a banned side-stripe border
borderLeftWidth: 3, borderLeftColor: colors.orange directly violates the absolute ban on side-stripe borders AND uses a reserved color (orange) decoratively. The hidden badge already carries the signal. Fix: Remove the left border. Optionally use a full background tint (chipCautionFill). Suggested command: /impeccable polish

### [P1] Six caption2 (11pt) uses for informational metadata violate the 12pt Floor Rule
cardCategory, panelRowCategory, panelRowAge, flagMeta, miniBadgeText, miniBadgeTextHidden all use caption2Regular (11pt) for content a moderator needs to read. Fix: Upgrade to caption1Regular (12pt). Suggested command: /impeccable typeset

### [P1] transformOrigin: 'left' is web-only — hold-ring animation is broken
In styles.holdRing, transformOrigin: 'left' is not a valid React Native style property. The scaleX animation fills from center instead of left edge, breaking the directional progress-bar metaphor. Fix: Remove transformOrigin, use translateX offset or width-based interpolation. Suggested command: /impeccable polish

### [P2] Hold-to-confirm is not VoiceOver-accessible
Users who can't perform a long press have no alternative path to remove a report. The hold progress ring has no screen reader announcement. Fix: Detect VoiceOver via AccessibilityInfo and fall back to a confirmation alert. Suggested command: /impeccable harden

### [P2] No error recovery on single-report restore/remove
handleRestore and handleRemove check res.ok but on failure only console.warn. No haptic, no toast, no visual feedback. Fix: Add error branch with haptic and visible feedback. Suggested command: /impeccable harden

### [P3] Raw category IDs and vocabulary mismatch
category_id values shown raw (speed_trap). "Needs review" section vs "hidden" badge use different words for the same state. Fix: Add category label map; unify vocabulary. Suggested command: /impeccable clarify

### [P3] Reduce Motion not respected for holdRing animation
The hold-ring uses Animated.View with scaleX interpolation but has no useReduceMotion() branch. Fix: Add Reduce Motion check, show static fill on gesture start. Suggested command: /impeccable polish

## Persona Red Flags

**Alex (Power User / Moderator):** No search or filter — must scroll linearly through all reports. No Select All in bulk mode. No sort options. At scale (50+ reports), the linear scroll becomes a workflow bottleneck. No copy-to-clipboard on device UUIDs in investigation panels. No completion summary after bulk action.

**Sam (Accessibility-Dependent):** Hold-to-confirm has no accessible alternative — VoiceOver users cannot perform a long press. Investigation panel toggle headers lack accessibilityState: { expanded: open }. Coordination warning banner has no accessibilityRole. VoiceOver hint says "Hold to confirm" when VoiceOver users actually get a single-tap bypass.

**Riley (Stress Tester):** Uses ScrollView instead of FlatList — no virtualization. No live-update mechanism for new incoming reports. Bulk selecting from Visible section then hitting Restore silently skips (correctly, but no indication given). BulkActionBar has no safe area bottom padding — home indicator could clip on iPhone X+.

## Minor Observations

- BulkActionBar appears/disappears instantly with no transition
- panelRow items have sub-44pt heights (paddingVertical: spacing.xs = 4pt)
- haversineMeters and detectCoordination should live in shared libs
- detectCoordination could produce false positives on shared networks; warning doesn't qualify this
- holdRingColor is an inline rgba outside the token system — should be a theme token or use chipAvoidFill
- BulkActionBar needs useSafeAreaInsets().bottom for iPhone X+ home indicator
- Inconsistent time unit formatting: "min" (written out) vs "h" (abbreviated)
- emptyText uses a period — the only copy on the screen that ends with one

## Questions to Consider

- What if the moderator could see a daily summary at the top (12 new, 3 flagged, 1 coordinated) to get the pulse before diving into individual cards?
- What if restore/remove showed a brief undo toast instead of being immediate — would that reduce the need for hold-to-confirm on remove?
- Does a ScrollView survive past 50 reports, or is FlatList virtualization needed before pilot?
- The submitter history panel shows history from allReports (what's loaded). If a prolific bad actor has 200 reports but only 50 are loaded, the count is silently wrong. Does the panel header count claim accuracy it cannot deliver?
