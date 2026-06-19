---
target: app/saved-places.tsx
total_score: 33
p0_count: 0
p1_count: 2
timestamp: 2026-06-19T09-57-39Z
slug: app-saved-places-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading state exists in hook (`loading: true`) but screen ignores it — users see empty-state flash during async read |
| 2 | Match System / Real World | 4 | "Saved {date}" clear; icon pairing (House / MapPin) honest; "No saved places yet" friendly plain language |
| 3 | User Control and Freedom | 3 | Destructive path (Alert → confirm) guarded; no undo after removal; no way to add a place from within this surface — users must know to go to /home or /search |
| 4 | Consistency and Standards | 4 | Matches settings register faithfully (RowGroup, SettingsHeader, grouped-gray bg); separator inset keyed to icon-bearing rows; works because all rows have icons |
| 5 | Error Prevention | 3 | Two-tap confirm on delete correct; no guard on edge case where `removeSavedPlace` fails silently (`catch` path only warns to console, UI already reflected removal via optimistic state) |
| 6 | Recognition Rather Than Recall | 4 | House vs MapPin glyph makes kind scannable; "Saved {date}" gives temporal context; no address/coordinate shown — user must recall what name they assigned |
| 7 | Flexibility and Efficiency | 2 | Power-users with many places get no sort/filter; no edit-name affordance; no quick-swipe-to-delete (platform convention) — must always hit Trash button and confirm Alert |
| 8 | Aesthetic and Minimalist Design | 4 | Calm and uncluttered; empty-state copy generous and instructional without being wordy; SettingsHeader's back-AND-close both present on screen one level deep from /menu |
| 9 | Error Recovery | 2 | Post-remove error has no recovery path — console.warn swallowed without user-visible message; if AsyncStorage fails, place vanishes from UI but may persist in storage (optimistic state diverges from source of truth) |
| 10 | Help and Documentation | 4 | Empty state self-teaching ("Save a Home from the map or a landmark from Search…"); no unanswered mystery about what surface does |
| **Total** | | **33/40** | **Solid — two systemic gaps (loading state, error recovery); one efficiency gap (no swipe-to-delete / add-from-here)** |

## Anti-Patterns Verdict

**No reserved-color violations.** `Trash` icon correctly uses `colors.labelSecondary` (gray), not red. Neither orange nor navy appears here. Screen entirely within freshgreen/wiltedgreen/neutral palette.

**No inline design values.** Every spacing, color, and typography reference pulls from token files.

**Tap-target rule: PASS on Trash button** (`tapTarget44` applied). Row's own tap area not a `Pressable` — only Trash action is interactive, correct choice for review-or-remove surface.

**Icon rule: PASS.** Phosphor deep-imports throughout.

**`hitSlop` on SettingsHeader: acceptable** — `hitSlop={8}` applied on top of already-compliant `tapTarget44` visual ("forgiveness on top of compliance" usage).

**One pattern flag — optimistic removal without error recovery.** Hook removes from local state before AsyncStorage write confirmed (`.catch` only warns). Accepted async pattern, but without user-visible error path silently diverges UI from truth.

**Minor flag — `loading` returned by hook, never consumed.** Hook exposes `loading: boolean` on public surface; screen destructures only `{ savedPlaces, removeSavedPlace }` and renders empty-state immediately if `savedPlaces.length === 0`. Brief flash of "No saved places yet" possible before AsyncStorage resolves.

## Cognitive Load

Low for read-path (scan list, done). Medium for write-path: users who want to add a place must leave this screen entirely. Screen teaches this in empty-state copy but doesn't offer shortcut or link to /search from within populated-list state. Once user has places, affordance for "add another" disappears entirely.

Alert dialog copy tight. Trash icon globally recognizable destructive-action signal. Date formatting locale-aware and correct.

No overload concerns at typical list sizes (1-5 places). No consideration of very long list (10+ landmarks) — no visual grouping by kind, no sort order controls.

## Emotional Journey

**Arrival (has places):** Calm. Familiar iOS-settings register, named places, clear dates. Recognizes this as data-transparency surface immediately.

**Arrival (no places):** Slightly hollow but not alarming. Empty-state copy instructional and gentle. No illustration or warmth beyond text — one place Steady Companion voice is missing brief moment of personality.

**Delete flow:** Correct emotional pacing. Alert adds deliberate pause before irreversible action. Two-tap confirmation appropriately friction-ful.

**Post-delete (success):** Smooth. Optimistic update means row vanishes instantly.

**Post-delete (failure):** Silent failure. User sees place disappear; if AsyncStorage write fails data may still be there on next launch. Disconnect between what UI shows and what app actually stored is one moment that could undermine thesis claim of data transparency.

## What's Working

**1. Token discipline exemplary.** Every spacing, color, type, and shadow value traces to theme file. No inline values, no magic numbers (except hardcoded `2` gap in `rowTextStack`, sub-`spacing.xs`).

**2. Tap-target compliance clean.** `tapTarget44` token applied correctly to Trash Pressable; icon centers inside via alignItems/justifyContent.

**3. Accessibility labels thoughtful.** Row's primary `Text` carries `accessibilityLabel="{name}, saved {date}"` — VoiceOver gets both place name and temporal anchor in one read.

**4. Two-step delete thesis-appropriate.** Preventing accidental loss of curated anchor (especially "Home") directly aligned with data transparency and user control.

**5. Empty-state copy on-brand.** Plain, human, instructional without being condescending.

**6. Hook architecture clean.** Optimistic-update pattern consistent with `useTrustedContact` / `useUser`.

**7. `dynamicType()` + `relaxedLineHeight()` applied on body copy.** Empty-state uses `relaxedLineHeight(typography.subheadlineRegular)` — Relaxed-Read Rule followed correctly.

## Priority Issues

**[P1] Loading flash — empty state renders before AsyncStorage resolves**
- What: `useSavedPlaces` initializes `savedPlaces` as `[]` and `loading` as `true`. Screen checks `savedPlaces.length === 0` and renders empty state immediately — `loading` boolean never read. On first launch users briefly see "No saved places yet" before places load.
- Why it matters: Flash of incorrect state at best jarring, at worst confusing ("did I lose my places?"). For thesis that foregrounds data transparency, showing wrong state undermines premise.
- Fix: Destructure `loading` from hook. While `loading === true`, render skeleton row or bare spinner inside RowGroup container in place of empty state. When `loading === false` and `savedPlaces.length === 0`, render empty-state copy.

**[P1] Silent failure on remove — optimistic state diverges from storage**
- What: `removeSavedPlace` updates local state first, then awaits AsyncStorage write. `.catch` logs warning to console only. If write fails, place disappears from UI but persists in storage; on next launch reappears — "ghost place" problem.
- Why it matters: Thesis makes direct claim about data transparency and user control. User who deliberately removes a place and later sees it return has experienced opposite of stated value. Trust issue, not merely a bug.
- Fix: Wrap `removeSavedPlace` call in try/catch in screen's `handleRemove`, and on failure: (a) rollback local state by re-adding item, and (b) show brief inline error. Hook's `removeSavedPlace` could also return boolean success indicator instead of swallowing errors.

**[P2] No "Add" affordance from within populated-list view**
- What: Once user has at least one saved place, empty-state instruction disappears. No affordance to add more places from saved-places screen.
- Why it matters: Discoverability gap. First-time user who arrives with one place ("Home") and wants to add landmark has no in-screen signal they need to go elsewhere.
- Fix: Add RowGroup below existing list with `+` / `Plus` icon row: "Save a landmark → goes to /search". Alternatively, short footer caption below list card ("Add landmarks from the Search tab").

**[P2] No swipe-to-delete (iOS platform convention)**
- What: Removing place requires tapping Trash icon, then confirming Alert. iOS users expect swipe-left-to-delete on list rows.
- Why it matters: Settings register (RowGroup) mimics iOS grouped settings where swipe-to-delete is expected gesture. Casey has to make two deliberate taps where platform convention affords single gesture.
- Fix: Implement swipe-action on `SavedPlaceRow` using `ReanimatedSwipeable` or `react-native-gesture-handler`'s Swipeable. Swipe-reveal action can be red "Remove" chip.

**[P3] Hardcoded `gap: 2` in `rowTextStack`**
- What: `rowTextStack` uses `gap: 2`, below `spacing.xs` floor of 4. Minor token drift.
- Fix: Either add `gap: 2` as named local comment ("sub-ramp optical gap — intentional"), or migrate to `spacing.xs`.

## Persona Red Flags

**Sam (accessibility):**
Good VoiceOver labels. Combined `accessibilityLabel` on place name text particularly strong. One gap: Trash `Pressable` only has `accessibilityLabel="Remove {place.name}"` — no `accessibilityHint` to describe consequence ("Prompts you to confirm before removing"). Dynamic Type wrapped correctly. No `accessibilityRole` on rows themselves — `View` elements, VoiceOver will read children sequentially.

**Casey (distracted mobile):**
Trash-to-Alert flow is two deliberate taps. In distracted state, Trash button is 44×44 compliant. Gap is swipe-to-delete: iOS mental model Casey carries predicts swipe, being redirected to small icon breaks flow momentarily.

**Black driver assessing safety in a charged moment:**
Not charged-moment surface — calm planning surface. However, "Home" saved place has specific safety salience: where driver is trying to get to, may be used by routing algorithm to personalize routes. Screen does not communicate this. If user sees Home listed and questions whether removing will affect routing or safety features, no in-screen answer. Brief RowGroup footer ("Your home is used to suggest safer return routes") would close this question. More broadly: P1 "ghost place" bug particularly bad if it affects Home anchor.

## Minor Observations

- `SettingsHeader` passes both `onBack` (chevron-left) and `onClose` (X). Standard settings child-page pattern. However, "Saved places" lives exactly one level from /menu — "Back" and "Close" navigate to same destination.
- Separator inset in `RowGroup` is `spacing.md + 24 + spacing.md = 56pt`. Assumes every row has 24pt icon. `SavedPlaceRow` does use 24pt glyph so aligns. Future fragility for icon-less variants.
- `weight="duotone"` on place glyph and `weight="regular"` on Trash glyph reasonable contrast. Intentional or incidental? Worth locking in.
- `savedPlaces` sorted "oldest first" at adapter level. For users with several landmarks, "newest last" may feel backwards.
- `emptyState` container has `paddingVertical: spacing.lg` but no minimum height. Empty state could be vertically centered in available scroll area.

## Questions to Consider

1. Should screen display saved place coordinates or address? Currently only user-assigned name and save date shown. Single line of truncated address would significantly reduce recall burden.
2. Is "Home" meant to be editable, or only replaceable? Adapter enforces one-home-at-a-time by replacement. Screen only offers removal. Updating home address is two-screen multi-step operation.
3. What is intended maximum number of saved landmarks? Screen has no cap and no feedback. Should there be cap, visual count, or prompt to review and trim after threshold?
4. Does removing saved place affect map immediately? Optimistic state update removes from saved-places list, but if map screen caches markers independently, removed place might still render until user navigates away and back.
5. Empty-state copy says "Save a Home from the map" — still accurate? Worth verifying live /home screen still surfaces that exact affordance.
