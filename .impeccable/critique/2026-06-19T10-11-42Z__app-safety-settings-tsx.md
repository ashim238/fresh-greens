---
target: app/safety-settings.tsx
total_score: 31
p0_count: 1
p1_count: 2
timestamp: 2026-06-19T10-11-42Z
slug: app-safety-settings-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Recordings row has no value string — user cannot tell how many recordings exist without tapping; trusted-contact row shows name but no status |
| 2 | Match System / Real World | 4 | "Emergency SOS" label mirrors Apple's native term; value copy "Reach a trusted contact or 911" reads as navigation label, not system status |
| 3 | User Control and Freedom | 3 | No destructive or corrective action surfaced; only exit paths are back and close-to-home — no undo surface |
| 4 | Consistency and Standards | 4 | Asterisk icon (24pt `bold`) visually heavier than UserCircle and Microphone icons (24pt `duotone`) — makes group feel unbalanced |
| 5 | Error Prevention | 2 | Emergency SOS row most consequential tap on screen and sits first with no secondary confirmation; mis-tap routes directly to emergency flow. No loading/error state for contact data |
| 6 | Recognition Rather Than Recall | 3 | Recordings row omits count value; trusted-contact placeholder "Add someone you trust" warm but doesn't cue user that contact could already be set during data-fetch window |
| 7 | Flexibility and Efficiency | 3 | No quick-call shortcut from settings row itself; screen is three rows with no section organization — no architecture for future additions |
| 8 | Aesthetic and Minimalist Design | 4 | Clean and minimal — three-row single-card composition appropriate. `value` truncation on SOS row likely to truncate on smaller phones at large Dynamic Type sizes |
| 9 | Error Recovery | 2 | No recovery surface for any action on screen. If user taps "Emergency SOS" by mistake, recovery depends entirely on /emergency screen's back affordance — nothing on this screen warns or confirms |
| 10 | Help and Documentation | 3 | Screen structureless — no `RowGroup` `title` group header, no `footer` explanation. For safety-critical sub-page handling emergency contacts, unset trusted contact should have footer nudge rather than silence |
| **Total** | | **31/40** | **Good baseline, two structural safety gaps** |

## Anti-Patterns Verdict

**No reserved-color violations.** Red on Asterisk correct (Exception 6 — Emergency SOS → /emergency). Microphone in `colors.black` correct (recording signal belongs on /pulled-over, not here). UserCircle in `colors.black` correct.

**No hardcoded design values.** `spacing.lg`, `spacing.xl`, `colors.*` all pulled from theme.

**Icon weight inconsistency within single RowGroup.** Asterisk is `weight="bold"`, UserCircle and Microphone are `weight="duotone"`. All three icons decorative-informational at same hierarchy level inside one card. Mixed weights inside homogeneous group is visual attention mismatch.

**"Reach a trusted contact or 911" as settings row `value` is description, not value.** In iOS grouped-settings register, `value` communicates *current state* of setting (e.g. "On", "Never", "Marcus Williams"). Navigation description belongs in `footer` below card.

**No loading state discrimination.** Trusted-contact name silently shows "Add someone you trust" during both loading window and genuinely-empty state.

## Cognitive Load

Very low in steady state — three rows, one card, clear hierarchy. Load spike in error case: if trusted contact isn't set and user arrives in stressed moment, must parse three rows to understand screen before acting.

SOS row bearing description-value rather than state-value mildly increases cognitive step between "what does this row do" and "where does this row go."

## Emotional Journey

**Calm planning moment (home, no stress):** Screen lands well. Minimal, clean, no alarm. Red Asterisk visually prominent but not alarmist. Trusted-contact placeholder "Add someone you trust" has good warmth.

**Charged moment (arrived here mid-route, during stop):** Screen becomes harder to read. Three rows with no grouping copy means user must mentally parse each row's purpose before acting. Recordings row at bottom — lowest priority during stop — occupies same visual weight as Emergency SOS. **No visual triage.** Missing loading-state discrimination means user whose contact is set may briefly see "Add someone you trust" and feel exposed.

Most emotionally exposed user — Black driver during traffic stop — needs immediate visual triage and confirmation that contact is set. Neither is present.

## What's Working

- Single RowGroup, no visual clutter.
- Red Asterisk on Emergency SOS right reserved-color carve-out.
- `trustedContactValue` defensive trimming and null-coalescing guard well-reasoned.
- `accessibilityHint` on SOS row present and appropriately detailed.
- `pressedDim` via `SettingsRow`'s Pressable implementation gives correct press feedback.
- `minHeight: 52` in SettingsRow clears 44pt tap-target floor.
- SettingsHeader's back/close pattern consistent with rest of settings register.
- Phosphor deep imports used correctly throughout.

## Priority Issues

**[P0] Emergency SOS row one tap from emergency flow with no friction**
- What: Emergency SOS row uses `trailing="chevron"` (default), so single mis-tap while hunting for Trusted Contact row routes to /emergency. On settings screen where user's intent is typically to *configure*, not to *activate*, this is hazard.
- Why it matters: Primary persona (Black driver in stress moment) arriving at this screen may be moving fast. Mis-tap on top row triggers safety flow requiring its own back-navigation to cancel. SOS row and Trusted Contact row visually identical in weight.
- Fix: Two options: (1) Visual separation — put Emergency SOS in own RowGroup card with `footer`. (2) Reserve-color anchor — confirm red Asterisk + card separation sufficient disambiguation. At minimum, separate SOS into own RowGroup from configuration rows.

**[P1] "Reach a trusted contact or 911" is description copy in value slot, not state value**
- What: iOS grouped-settings `value` position is reserved slot for *current state* display. This screen uses it as subtitle describing what /emergency does.
- Why it matters: Pattern drift. User scanning right-side values reads "Reach a trusted contact or 911" as state rather than description.
- Fix: Clear `value` from SOS row. Move contextual description to RowGroup `footer`. Optionally add real status value: "Marcus Williams set" / "No contact".

**[P1] Trusted Contact row has no loading state — placeholder visible during data fetch**
- What: `useTrustedContact` is async. During load window, `contact` is null, so `trustedContactValue` resolves to "Add someone you trust" even when contact is stored.
- Why it matters: In charged moment, briefly seeing "Add someone you trust" when you know you set contact erodes trust in system.
- Fix: Expose `loading` flag from `useTrustedContact`. Render `value` as placeholder dash or skeleton string while loading.

**[P2] No contact status or recording count surfaced as at-a-glance values**
- What: Recordings row has no `value` prop. Trusted Contact row could show relationship-level status (e.g., "Last notified 2 days ago") but doesn't.
- Why it matters: Steady Companion meant to be auditable — UI should show its work.
- Fix: Pass recording count as `value` to Recordings row. Consider brief status line for Trusted Contact.

**[P3] Icon weight inconsistency in RowGroup**
- What: Asterisk is `weight="bold"`, UserCircle and Microphone are `weight="duotone"`.
- Why it matters: Visual rhythm inside homogeneous settings group expects all icons to carry same visual weight. Red color already distinguishes SOS row.
- Fix: Align to `weight="duotone"` across all three rows.

## Persona Red Flags

**Sam (accessibility):**
Recordings row has no `value` and no `accessibilityHint` — VoiceOver announces "Recordings, button" with no additional context. At large Dynamic Type sizes, SOS row's value string will truncate. Trusted contact loading state produces misleading announcement.

**Casey (distracted mobile):**
SOS row is first row and one tap to emergency flow. Casey, navigating while half-distracted, more likely to mis-tap top row while reaching for second. No visual barrier separates destructive-consequence row from configuration rows.

**Black driver assessing safety in a charged moment:**
Highest-stakes persona for this screen. Need two things immediately: (1) confirmation their contact is set, and (2) clear path to SOS without having to parse screen. Neither optimally delivered. Trusted-contact name appears as value in row 2, but "Add someone you trust" during load flicker sends wrong signal at exactly wrong moment. SOS row's description-value consumes right-side slot that should say "Marcus Williams" or "Contact set." Screen communicates *configuration options*, not *current safety posture* — distinction matters acutely in stress state.

## Minor Observations

- `RowGroup` receives `children` as plain `ReactNode` and calls `Children.toArray()` — future non-SettingsRow children would be counted as rows.
- `scrollContent` uses `gap: spacing.xl` (32pt) between RowGroups. Only one RowGroup currently, so gap inert.
- `onClose={() => router.replace('/home')}` replaces stack — correct for settings exit.
- `title` prop on `SettingsHeader` is "Safety" — matches /menu row label.
- `RowGroup` separator inset assumes all rows have icon.

## Questions to Consider

1. Should Emergency SOS live in same RowGroup as Trusted Contact and Recordings? SOS is *action affordance*; other two rows are *configuration affordances*.
2. What does user see when both `contact` is null and `loading` is true? Race condition where "Add someone you trust" flashes on first mount?
3. Is there planned "no contact set" CTA path? Could RowGroup `footer` double as nudge when contact row shows placeholder?
4. Should Recordings row surface count or "last recorded" timestamp?
5. Cross-device: will SOS row's value render in full on iPhone SE at largest accessibility Dynamic Type size?
