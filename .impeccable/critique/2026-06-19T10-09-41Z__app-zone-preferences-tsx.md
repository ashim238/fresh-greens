---
target: app/zone-preferences.tsx
total_score: 24
p0_count: 0
p1_count: 2
timestamp: 2026-06-19T10-09-41Z
slug: app-zone-preferences-tsx
---
## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | No loading state during AsyncStorage hydration — toggles show stale defaults until async read resolves |
| 2 | Match System / Real World | 3 | Labels are plain English; "Community reports" is slightly abstract for new users |
| 3 | User Control and Freedom | 3 | Back + close-X dual exit is clean; no "Reset to defaults" escape valve |
| 4 | Consistency and Standards | 4 | Fully on-register iOS grouped-settings; token-driven throughout |
| 5 | Error Prevention | 2 | All three routing flags can be silently disabled together — degrades core product value with no confirmation |
| 6 | Recognition Rather Than Recall | 2 | Labels name features but give no context about routing consequence at point of decision |
| 7 | Flexibility and Efficiency | 2 | No bulk reset, no accelerators; three separate taps required |
| 8 | Aesthetic and Minimalist Design | 3 | Clean but first RowGroup floats without anchoring context |
| 9 | Error Recovery | 2 | Silent degradation when all flags disabled; no recovery prompt or downstream signal |
| 10 | Help and Documentation | 1 | Footer is one terse line in 13pt gray; no point-of-decision explanation for any toggle |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict
Detector: 0 findings (exit code 0). LLM: No AI slop. HIG-native, token-disciplined, no gradient text, no eyebrows, no glassmorphism.

## Cognitive Load
2/8 checklist failures (moderate): compound decision model (display vs. routing) invisible; point-of-decision context for toggle consequences absent.

## Emotional Journey
Calm register is correct. The three routing toggles carry real safety weight for the target user but are presented with the same affective flatness as notification preferences. Footer reads as engineer release notes, not Steady Companion voice.

## What's Working
Token discipline exemplary. Tap-target implementation correct (tapTarget44 as compliance mechanism). Two-group IA structurally sound (display vs. routing is a real distinction).

## Priority Issues

**[P1] Route-scoring consequence invisible at point of decision**
- What: Each "What we flag" toggle has only a label and AX hint; no visible secondary label or inline context about routing consequence.
- Why it matters: These are safety-critical preferences for Black drivers. "Police presence" toggle should communicate what OFF means for routing, not just exist as a binary.
- Fix: Use the existing `value` prop on SettingsRow to show brief consequence ("Routes around police presence"). Update footer to human voice: "These signals shape how Fresh Greens builds your route."
- Suggested command: /impeccable clarify

**[P1] Silent degradation when all safety flags disabled**
- What: All three routing flags can be toggled off simultaneously with no warning or downstream signal. App continues presenting route briefings with same confidence.
- Why it matters: Violates the "Honesty of disclosure" design principle in PRODUCT.md.
- Fix: Show inline status banner when all three are off: "Route safety scoring is paused — your routes won't account for hazard zones." Disappears when any flag is re-enabled.
- Suggested command: /impeccable harden

**[P2] Hydration lag — toggles briefly show wrong state**
- What: `preferences` starts null; screen falls back to hardcoded defaults until AsyncStorage resolves. `loading` boolean returned from hook is unused in this screen.
- Why it matters: Fast taps can modify a toggle before real state lands.
- Fix: Use `loading` to disable Switch components during hydration. One-line prop addition.
- Suggested command: /impeccable harden

**[P2] "Show zones overlay" has no consequence summary**
- What: Isolated RowGroup with one toggle and no title, no footer — a floating card with an abstract label.
- Why it matters: Users don't know what zones look like or what "overlay" means in this context.
- Fix: Add RowGroup footer: "Turns on a map layer showing police zones, low-light corridors, and community-flagged areas."
- Suggested command: /impeccable clarify

**[P3] Separator inset assumes icon-bearing rows — none here**
- What: Separator left-inset is 56pt (icon-column width) but no rows use icons. Hairline starts mid-label.
- Why it matters: Minor visual inconsistency; acknowledged in RowGroup comment.
- Fix: Add Phosphor icons to the three flag rows (adds scannability) OR make inset adaptive when no icons present.
- Suggested command: /impeccable polish

## Persona Red Flags

**Sam (accessibility):** VoiceOver wiring is correct on all toggles. Gap: loading state doesn't disable Switches, risking tap-before-hydration race for keyboard/switch-access users.

**Casey (distracted mobile):** Full-row tap doesn't toggle Switch — only the Switch thumb does. The iOS Settings.app pattern (full row tappable) is not implemented. One-handed users will tap the label area expecting toggle feedback and get none.

**Black driver assessing safety in a charged moment:** "Community reports" is the most thesis-forward feature but reads like a checkbox. The footer "Affects route scoring and map flags." is engineer voice, not Steady Companion. No acknowledgment that "Police presence" means something specific and urgent for this user.

## Minor Observations
- scrollContent uses spacing.lg (24pt) horizontal / spacing.xl (32pt) gap — minor asymmetry; consider aligning both to spacing.lg or spacing.xl.
- First RowGroup has no title or footer — adding a short footer would anchor "Show zones overlay" without adding visual weight.
- No icons on any SettingsRow — both separator inset and scannability would benefit from Phosphor icons on the three flag rows.

## Questions to Consider
- Should "Show zones overlay" live on /home as a quick-access FAB or chip rather than buried in settings?
- What changes on /home when all three routing flags are disabled? Does the route briefing signal this?
- Is "Community reports" the right vocabulary? "Neighbor sightings" or "Local knowledge" might carry more warmth for the target user.
- Should the `loading` boolean from usePreferences disable toggles during hydration to prevent pre-hydration tap races?
