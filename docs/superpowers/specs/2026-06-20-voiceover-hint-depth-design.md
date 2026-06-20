# VoiceOver Hint Depth — Design Spec

**Date:** 2026-06-20
**Status:** Approved (brainstorm complete; awaiting plan)
**Sprint:** Design Health Program — Phase 2 Sprint 3, PR 3 of 3 (the closer — **this PR closes Phase 2**)
**Synthesis source:** [`phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) Section 4, "VoiceOver Depth"

---

## Goal

Add `accessibilityHint` to the interactive controls whose action is non-obvious from the label alone, so a VoiceOver user understands the *consequence* before acting. Convention (currently in `FloatingActionButton`'s JSDoc): `accessibilityLabel` = what the control *is*; `accessibilityHint` = what tapping *does*. This is genuine accessibility depth — the app serves vulnerable drivers, and VoiceOver is how a blind user (or a low-vision driver's companion) operates it. Safety flows especially must be unambiguous.

## The finding: a real but modest, well-concentrated gap

Unlike the other Sprint 2/3 audits (rule-compliance checks that collapsed to near-zero), this is a *coverage* audit needing per-element judgment. Recon: 262 `accessibilityLabel` uses, 39 `accessibilityHint` uses. The 223 gap is **not** all work — most labels are self-evident verbs ("Save", "Delete", "Close") that need no hint.

A rigorous inventory of the unhinted surfaces found **6 genuine high-value additions**, concentrated exactly where you'd expect: the **share-location / roadside / unfamiliar safety flows**, which never received hints, while en-route, home, search, and safety-settings already did. Notably, **`emergency.tsx` needs no hints** — its labels already disambiguate fully ("Call [contact]. Three-second cancel window." / "Call 911. Three-second cancel window." / "Switch to calling 911 instead"). High-importance surface, but nothing missing; credited, not skipped.

## The 6 hints (exact copy)

House style (matched from the existing 39 hints): **present-tense outcome phrase, no "Tap to" prefix** (VoiceOver already announces "button"), calm and factual.

| # | File | Control (current label) | `accessibilityHint` to add |
|---|---|---|---|
| 1 | `app/share-location.tsx` (~line 153) | reason picker — `` `${r.title}. ${r.clarifier}` `` | `` `Opens Messages with a safety check-in draft for ${contactName}` `` |
| 2 | `app/unfamiliar.tsx` (~line 244) | problem picker — `` `${p.title}. ${p.clarifier}` `` | `"Reports this and starts sharing your location with your trusted contact"` |
| 3 | `app/unfamiliar.tsx` (~line 316) | destination picker — `{d.title}` | `"Routes you there and returns to the map"` |
| 4 | `app/roadside.tsx` (~line 256) | problem picker — `{p.label}` | `"Selects this problem and shows roadside actions"` |
| 5 | `app/roadside.tsx` (~line 410) | tow-search row — `"Search nearby tow services"` | `"Opens Apple Maps to find tow services near you"` |
| 6 | `app/roadside-setup.tsx` (~line 140) | Save — `"Save"` | `"Saves your roadside service profile"` |

**Interpolation note:** only #1 interpolates a runtime value — `contactName`, which is confirmed in scope at that render site (it already feeds the `NotifyingPulse` footer just below). #2's hint deliberately uses "your trusted contact" (no interpolation) because `contactName` is not guaranteed in the `ProblemPicker` sub-component's scope. #3 uses "there" rather than a per-destination noun to avoid depending on a field that may not exist (`d` has `title`/`Icon`/`id`, no guaranteed singular-noun field). All others are static strings.

Each hint is added as an `accessibilityHint={...}` prop on the existing `Pressable` — no other change to the control.

---

## Design

**2 atomic commits, 5 files.** Pure accessibility metadata — no visual change, no behavior change, no label rewrites.

### Commit 1 — add the 6 hints

Add the `accessibilityHint` prop to each of the 6 controls above, immediately after the existing `accessibilityLabel` (or `accessibilityRole`) prop on the same `Pressable`. Grouped into one commit: six one-line additions of the same kind, fully independent, low-blast. Exact strings per the table.

### Commit 2 — `.cursorrules` Accessibility rule

Promote the hint convention from the `FloatingActionButton` JSDoc into the cardinal rulebook (new section in the interaction-rules region, near `## Tap targets` / `## Dismissal`):

> **## Accessibility (VoiceOver)**
> Every interactive control needs an `accessibilityRole` + `accessibilityLabel` (what the control *is*). Add an `accessibilityHint` (what tapping *does* — the outcome) when the label is a noun/title, or the consequence is non-obvious or significant (navigates away, opens an external app, starts/stops sharing or recording, is destructive). House style: present-tense outcome phrase, **no "Tap to" prefix** (VoiceOver already announces "button"), calm and factual — e.g. "Opens Messages with a safety check-in draft", "Routes you there and returns to the map". Self-evident verb+object labels ("Save place", "Delete recording", "Close") need no hint.

### Out of scope (deliberate, listed so it's clear they were considered)

- **`emergency.tsx`** — labels already disambiguate the SOS / call-contact / call-911 / countdown controls; no hint needed.
- **Long-tail + already-hinted-surface sweep** — a second pass over `home.tsx`, the detail cards, and other partially-covered surfaces for any remaining noun-labeled icon buttons. Deferred to **Phase 3** (added as a `docs/next-session.md` item) to keep this PR bounded to the high-value safety-flow gap.
- **Label rewrites** — none of the audited labels were wrong; this PR is hints-only.
- **Map markers / decorative components** (ClusterMarker, LandmarkMarker, PageControl, EdgeIndicator, etc.) — non-interactive or self-evident; no hints.

---

## Testing

- **`tsc --noEmit`** clean after each commit (the interpolated `contactName` in #1 must type-check — confirms it's in scope).
- **VoiceOver smoke (user's responsibility — requires a real device; agents cannot test VoiceOver):** with VoiceOver on, focus each of the 6 controls and confirm the hint is spoken after the label, reads naturally, and describes the real outcome. Especially: the share-location reason rows announce the Messages consequence; the unfamiliar problem rows announce the location-sharing consequence.
- **No visual regression possible** — `accessibilityHint` is non-visual metadata.

---

## Files

- **Modify:** `app/share-location.tsx` (hint #1)
- **Modify:** `app/unfamiliar.tsx` (hints #2, #3)
- **Modify:** `app/roadside.tsx` (hints #4, #5)
- **Modify:** `app/roadside-setup.tsx` (hint #6)
- **Modify:** `.cursorrules` (new `## Accessibility (VoiceOver)` section)
- **Untouched (deliberate):** `app/emergency.tsx` (already disambiguated); all already-hinted surfaces

## Verification (definition of done)

- [ ] All 6 controls have the exact `accessibilityHint` from the table, added on the existing `Pressable`
- [ ] Hint #1 interpolates `contactName` and type-checks (in scope); #2/#3 use the non-interpolated copy as specified
- [ ] No `accessibilityLabel` was changed; no visual/layout/behavior change
- [ ] `.cursorrules` has the new `## Accessibility (VoiceOver)` section with the house-style wording
- [ ] `tsc --noEmit` passes
- [ ] Diff is exactly five files; no other controls touched
- [ ] A `docs/next-session.md` item records the deferred long-tail hint sweep (Phase 3)

## Sequencing

PR 3 of 3 in Sprint 3 — **the Phase 2 closer.** Within it, low-blast-first:

1. **`feat(a11y): add VoiceOver hints to the share / roadside / unfamiliar safety flows`** — the 4 screen files, 6 hints.
2. **`docs(cursorrules): promote the accessibilityHint convention to the rulebook`** — `.cursorrules`.
3. **verify + PR** (+ add the deferred-sweep note to `docs/next-session.md`).

Merging this closes Sprint 3 and **Phase 2** of the Design Health Program (Sprint 1 + Sprint 2 + Sprint 3 = 10 PRs). What remains after is Phase 3 (the per-screen tail) — a fresh scoping decision, and per the roadmap, weighed against pivoting to M1 (pilot-ready).
