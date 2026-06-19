# useHydratedState — Design Spec

**Date:** 2026-06-19
**Status:** Approved (brainstorm complete; awaiting plan)
**Sprint:** Design Health Program — Phase 2, Sprint 1, PR #1 of 3
**Synthesis source:** [`docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) — SYSTEMIC pattern #1 ("Loading State Ignored")

---

## Goal

Eliminate the hydration-flash bug across 6 screens by extracting a single primitive, `useHydratedState`, that makes the loading state **structurally impossible to ignore** — the consumer cannot read data without first proving hydration is complete, enforced by TypeScript.

## The bug being fixed

Six screens conflate **two independent axes** into one nullable value:

- **Axis 1 — hydration:** has the async read settled? (loading vs. settled)
- **Axis 2 — content:** once settled, is there anything there? (data vs. empty)

Today both collapse into `data === null || data.length === 0`, so "still loading" and "loaded, genuinely empty" render identically. On cold launch (~50–200ms hydration window) the user sees a flash of the empty/unconfigured state before real data lands. The worst cases are safety-critical: `safety-settings` flashes "Add someone you trust" when a contact *is* set; `trusted-contact-setup` flashes "No contact set yet." — accusatory copy — in the embedded mid-stop register.

`useHydratedState` separates the axes: a `ready` flag owns Axis 1; the data's own emptiness owns Axis 2. `ready: true, data: null` is a real, distinct state — "we looked, there's nothing" — which lets the screen render its *empty* state instead of its *wrong* state.

## Scope

**6 screens, 5 hooks** (`useTrustedContact` serves two screens):

| Screen | Hook | Read mode today | Notes |
|---|---|---|---|
| `saved-places` | `useSavedPlaces` | mount-only | list |
| `zone-preferences` | `usePreferences` | refocus | settings toggles |
| `safety-settings` | `useTrustedContact` | refocus | per-row gate (see below) |
| `trusted-contact-setup` | `useTrustedContact` | refocus | nullable-when-loaded |
| `share-location` | `useShareSession` | refocus | `session` nullable-when-loaded |
| `recordings` | `useRecordings` | mount-only | has an `error` branch |

**Out of scope:** error-state presentation (owned by Sprint 1 PR #3, `SafetyErrorMessage` + error taxonomy); optimistic-write integrity (Sprint 1 PR #2, `useOptimisticMutation`). This PR is scoped to the loading→ready axis only.

---

## Design

### Conceptual model

Two orthogonal axes, never collapsed:

- `ready: false` → hydration in flight → render **chrome only** (header + back affordance, no content body).
- `ready: true` → hydration settled → render content, where the data's **own** nullability/emptiness drives the empty state.

`ready` is not "data exists." It is "the async read has settled." A loaded-but-empty result is `ready: true` with empty data — that is the whole point.

### The primitive's API

```ts
type Hydrated<T> =
  | { ready: false }
  | { ready: true; data: T };

function useHydratedState<T>(
  read: () => Promise<T>,
  options?: { mountOnly?: boolean },   // default: refocus-aware
): Hydrated<T> & { setData: Dispatch<SetStateAction<T>> };
```

Behavior contract:

- **`setData` lives outside the union** (always present) so a domain hook can build its write methods at the top level, before narrowing. Screens never call `useHydratedState` directly — only domain hooks do.
- **`ready` latches `false → true` once and never returns to `false` on refocus.** This is load-bearing: re-reading on focus must not re-trigger the flash. Refocus updates `data` silently; `ready` stays `true`. (Preserves the existing `useFocusEffect` "loading only flips false once" behavior documented in `usePreferences` / `useTrustedContact`.)
- **Refocus-aware by default; `{ mountOnly: true }` is the opt-out.** Rationale: setup flows are pushed *over* the screens that read this data, so popping back *reveals* (does not remount) the consumer — a mount-only read would show stale/missing data in a safety-critical moment. The safer behavior is the default; a new hook author who passes no options gets it.
- **`read` must be a stable reference** (module-level adapter function, as all five are today). A hook passing a closure must `useCallback` it.

Internally: default uses `useFocusEffect`; `mountOnly` uses `useEffect`. Both run the reader behind a `cancelled` guard, `setData(result)` + `setReady(true)` on settle.

### Domain-hook composition

A domain hook composes the primitive and re-exposes a **domain-named discriminated union** with its write methods intersected out (always callable), and its loaded value gated behind `ready`:

```ts
type TrustedContactState = {
  pickContact: () => Promise<TrustedContact | null>;
  clearContact: () => Promise<void>;
} & ({ ready: false } | { ready: true; contact: TrustedContact | null });
```

`contact` is `TrustedContact | null` **on the ready branch** — preserving the empty state (null = genuinely no contact). TypeScript refuses `hook.contact` until the screen narrows on `ready`. The bug becomes unrepeatable.

Worked refactor (`useTrustedContact`):

```ts
export function useTrustedContact(): TrustedContactState {
  const hydrated = useHydratedState<TrustedContact | null>(getTrustedContact);

  const pickContact = useCallback(async () => {
    const picked = await Contacts.presentContactPickerAsync();
    if (!picked) return null;
    // phone-number guard, name derivation, tryCaptureContactLocation — ALL unchanged
    const stored = await setTrustedContact({ /* … */ });
    hydrated.setData(stored);
    return stored;
  }, [hydrated.setData]);

  const clearContact = useCallback(async () => {
    await clearTrustedContact();
    hydrated.setData(null);
  }, [hydrated.setData]);

  if (!hydrated.ready) return { ready: false, pickContact, clearContact };
  return { ready: true, contact: hydrated.data, pickContact, clearContact };
}
```

**Refactor shape across all 5 hooks:** delete the `useState` + `useEffect`/`useFocusEffect` + `cancelled`-guard scaffolding; keep every line of domain logic. `tryCaptureContactLocation`, the picker flow, the one-home-at-a-time invariant, the SMS-open chain — untouched. The primitive absorbs only the boilerplate that was being copy-pasted (and subtly diverging) five times.

### Recordings: single-axis primitive, error layered on top

`useRecordings` is the only hook with an `error` branch (the PR-K load-failure ladder: loading → error → empty → list). The primitive stays **loading→ready only**; recordings reconciles by:

- its reader catching internally so `ready` still flips (no hang),
- the **existing `error` branch staying exactly as-is**, living inside the ready branch.

Error presentation is standardized later by Sprint 1 PR #3 (`SafetyErrorMessage`). Keeping the primitive single-axis means the 5 storage-backed hooks (whose AsyncStorage reads don't meaningfully fail) carry no never-hit error branch, and screen narrows stay two-case.

### Screen consumer pattern

One new line per screen — the narrow:

```tsx
const contactState = useTrustedContact();
if (!contactState.ready) return <ScreenChrome />;   // header + back, no body
// below: contactState.contact is TrustedContact | null → null = empty state, not loading
```

This is the chrome-only render (no skeleton primitive — a blank body reads honest for a ~100ms window, where a flash reads wrong).

**Exception — `safety-settings`:** it composes the contact read with a *static* SOS row and recordings row. A whole-screen narrow would briefly blank those static rows too. This one screen uses a **per-row gate** (the contact row shows a placeholder until ready; SOS and recordings rows render instantly). Whole-screen narrow remains the default everywhere else.

---

## Testing

The project has no test runner (no jest/RTL); the norm is **tsc + node assertions + manual device/sim smoke**. This PR matches that and does **not** add a test framework.

- **`tsc` is the primary gate.** The discriminated union makes the bug a compile error — green tsc proves all 6 screens narrow correctly before reading data. This is most of the protection the PR exists to provide.
- **Manual smoke (all 6 screens):** cold-launch with stored data present → confirm zero flash; with data absent → confirm the empty state renders (not a flash, not a hang). Critical walk for `useTrustedContact`: set a contact in `trusted-contact-setup`, pop back to `safety-settings`, confirm the name appears immediately (no "Add someone you trust" flicker).
- **Per-hook contract check:** each refactored hook's write methods still mutate local state correctly (add/remove/clear) — covered by the smoke walks.

---

## Files

- **Create:** `hooks/useHydratedState.ts`
- **Modify:** `hooks/useSavedPlaces.ts`, `hooks/usePreferences.ts`, `hooks/useTrustedContact.ts`, `hooks/useShareSession.ts`, `hooks/useRecordings.ts`
- **Modify:** `app/saved-places.tsx`, `app/zone-preferences.tsx`, `app/safety-settings.tsx`, `app/trusted-contact-setup.tsx`, `app/share-location.tsx`, `app/recordings.tsx`

## Verification (definition of done)

- [ ] `tsc` passes with no errors
- [ ] All 6 screens narrow on `ready` before accessing loaded data (compile-enforced)
- [ ] Cold-launch smoke on all 6 screens: no empty-state flash with data present
- [ ] Empty state still renders correctly with data absent (loaded-but-empty)
- [ ] `useTrustedContact` refocus walk: contact set in setup appears immediately on pop-back to `safety-settings`
- [ ] Each refactored hook's write methods (add/remove/clear/pick/start/end) still update local state
- [ ] No domain logic changed — only loading scaffolding replaced

## Sequencing

PR #1 of the Sprint 1 trio. PR #2 (`useOptimisticMutation`) and PR #3 (`SafetyErrorMessage` + error taxonomy) are separate specs, brainstormed after this lands. Recordings' `error` branch is intentionally left untouched here; PR #3 standardizes it.
