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

**Breaking change, codebase-wide (revised during planning, 2026-06-19).** The discriminated union makes the loaded value unreachable without narrowing on `ready` — that is the whole point, and it is *intrinsic to a breaking change*. There is no non-breaking shape that yields a compiler-enforced narrow. A dependency check (`grep` ground-truth; graphify was mid-rebuild) found the 4 hooks have ~20 call sites across 16 files, not the 6 first assumed. The decision (confirmed with the user) is to go breaking across **all** callers so the bug becomes structurally impossible anywhere — present screens and future ones alike. A contained, convention-only fix was rejected precisely because it cannot prevent the bug on screens that don't exist yet.

**4 hooks migrate to the breaking union:**

| Hook | Read mode today | Caller files | Of which: deliberate flash-gate |
|---|---|---|---|
| `useSavedPlaces` | mount-only | `saved-places`, `home`, `menu`, `search` (4) | `saved-places` |
| `usePreferences` | refocus | `zone-preferences`, `home`, `menu`, `en-route`, `components/zoneCategoryContent` (5) | `zone-preferences` |
| `useShareSession` | refocus | `share-location`, `en-route`, `unfamiliar`, `safety`, `components/LiveSafetySheet` (5) | `share-location` |
| `useTrustedContact` | refocus | `safety-settings`, `trusted-contact-setup`, `share-location`, `home`, `emergency`, `pulled-over`, `en-route`, `unfamiliar`, `safety`, `roadside`, `menu`, `components/LiveSafetySheet` (12) | `safety-settings`, `trusted-contact-setup` |

**Two kinds of caller edit** (see "Screen consumer pattern" below):
- **Flash-gate (5 screens):** the screens Phase 1 flagged. These get a *deliberate* gate — render chrome / a placeholder while `!ready`, because showing their empty state during hydration is the actual bug.
- **Mechanical narrow (~11 callers):** every other caller. These already tolerate null-during-load (e.g. `home` skips the contact marker when there's no contact). They get a 1–2 line narrow (`const cs = useX(); const data = cs.ready ? cs.data : null;`) purely to satisfy the compiler; **behavior is unchanged** (they read null during the brief load window, exactly as before). No redesign.

**`recordings` deferred to PR #3** (the prior decision stands). `useRecordings` + the recordings screen already gate on `loading` with a real Loading state (the PR-K loading→error→empty→list ladder) — no flash — and its `error` path fights the single-axis primitive. PR #3 (`SafetyErrorMessage`) already touches its error branch, so migrating it there is one coordinated touch. The codebase-wide guarantee becomes complete after PR #3 migrates `useRecordings`; until then `useRecordings` is the one legacy-shaped holdout.

**Out of scope:** error-state presentation (Sprint 1 PR #3, `SafetyErrorMessage` + error taxonomy); optimistic-write integrity (Sprint 1 PR #2, `useOptimisticMutation`); `recordings` migration (PR #3). This PR is scoped to the loading→ready axis.

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

**Refactor shape across all 4 hooks:** delete the `useState` + `useEffect`/`useFocusEffect` + `cancelled`-guard scaffolding; keep every line of domain logic. `tryCaptureContactLocation`, the picker flow, the one-home-at-a-time invariant, the SMS-open chain — untouched. The primitive absorbs only the boilerplate that was being copy-pasted (and subtly diverging) across these hooks.

### Recordings: deferred to PR #3 (not in this PR)

`useRecordings` is the only hook with an `error` branch (the PR-K load-failure ladder: loading → error → empty → list). It is **out of scope for this PR**, for two reasons found during planning:

- **No flash to fix.** Unlike the 5 in-scope screens, the recordings screen already gates on `loading` and renders a real Loading state — it never shows the empty state during hydration. The axis-conflation bug this primitive fixes simply isn't present.
- **Its error path fights the single-axis primitive.** Migrating now would mean threading the error catch through `useHydratedState`'s reader (reader catches internally, sets a domain-level error so `ready` still flips). That's the one awkward shape the primitive doesn't model cleanly.

PR #3 (`SafetyErrorMessage` + error taxonomy) already touches recordings' error branch. Migrating `useRecordings` to `useHydratedState` there is a single coordinated touch instead of two. Keeping the primitive single-axis (loading→ready only) means the 4 in-scope storage-backed hooks — whose AsyncStorage reads don't meaningfully fail — carry no never-hit error branch, and every screen narrow stays two-case.

### Screen consumer pattern

One new line per screen — the narrow:

```tsx
const contactState = useTrustedContact();
if (!contactState.ready) return <ScreenChrome />;   // header + back, no body
// below: contactState.contact is TrustedContact | null → null = empty state, not loading
```

This is the chrome-only render (no skeleton primitive — a blank body reads honest for a ~100ms window, where a flash reads wrong).

In practice the gate is **per-section, not whole-screen**: render everything that doesn't read the loaded data (header, static copy), gate only the data-dependent subtree on `ready`. The gated region varies by screen — a `ScrollView` body (`saved-places`, `zone-preferences`), a preview/empty block (`trusted-contact-setup`), a row `value` (`safety-settings`), or the picker-vs-active branch (`share-location`). `safety-settings` is the tightest case: its SOS and recordings rows are static and render instantly, while only the contact row's `value` waits on `ready`.

**Mechanical narrow (the ~11 non-flash callers).** Every other caller of the 4 hooks must narrow too — but only to compile, not to change behavior. The pattern:

```tsx
const cs = useTrustedContact();
const contact = cs.ready ? cs.contact : null;
// …everything downstream reads `contact` exactly as before — `contact?.latitude`,
// the marker, the copy fallback. During the brief load window `contact` is null,
// which is what these callers already saw and already handle.
```

Crucially: **no redesign, no new gate, no behavior change** for these. `home` still skips the contact marker when there's no contact; `emergency` still falls back to "Set up a contact first"; the only difference is the read is now routed through a `ready` narrow. This is what keeps the breaking change tractable across the safety-critical screens — they get a 1–2 line edit and a re-verify, not a rework.

**Rules-of-hooks note:** never early-return before the screen's other hooks run. Bind `ready` + the derived value right after the hook call, run all remaining hooks (effects, refs, callbacks) against those bindings, then gate the render. `trusted-contact-setup` is the case that needs this — its avatar-spring `useEffect` reads the hydration flag (today's `contactLoading` becomes `!ready`) and must stay above any conditional return.

---

## Testing

The project has no test runner (no jest/RTL); the norm is **tsc + node assertions + manual device/sim smoke**. This PR matches that and does **not** add a test framework.

- **`tsc` is the primary gate.** The discriminated union makes the bug a compile error — green tsc proves all 5 screens narrow correctly before reading data. This is most of the protection the PR exists to provide.
- **Manual smoke (all 5 screens):** cold-launch with stored data present → confirm zero flash; with data absent → confirm the empty state renders (not a flash, not a hang). Critical walk for `useTrustedContact`: set a contact in `trusted-contact-setup`, pop back to `safety-settings`, confirm the name appears immediately (no "Add someone you trust" flicker).
- **Per-hook contract check:** each refactored hook's write methods still mutate local state correctly (add/remove/clear) — covered by the smoke walks.

---

## Files

- **Create:** `hooks/useHydratedState.ts`
- **Modify (hooks → breaking union):** `hooks/useSavedPlaces.ts`, `hooks/usePreferences.ts`, `hooks/useShareSession.ts`, `hooks/useTrustedContact.ts`
- **Modify (flash-gate screens — deliberate gate):** `app/saved-places.tsx`, `app/zone-preferences.tsx`, `app/safety-settings.tsx`, `app/trusted-contact-setup.tsx`, `app/share-location.tsx`
- **Modify (mechanical narrow — compile-only, no behavior change):** `app/home.tsx`, `app/menu.tsx`, `app/search.tsx`, `app/en-route.tsx`, `app/unfamiliar.tsx`, `app/safety.tsx`, `app/emergency.tsx`, `app/pulled-over.tsx`, `app/roadside.tsx`, `components/LiveSafetySheet.tsx`, `components/zoneCategoryContent.ts`
- **Deferred to PR #3 (not touched here):** `hooks/useRecordings.ts`, `app/recordings.tsx`

## Atomic-commit constraint

A breaking union change cannot land without all of that hook's callers updated in the **same commit** — tsc is red until every caller narrows. So the commit unit is **one hook + all its callers**, not one screen. Sequence low-blast-first so each commit is independently verifiable, and so the safety-critical screens are touched last, by the hooks they belong to. Hooks that share callers (`useShareSession` and `useTrustedContact` both touch `en-route`/`unfamiliar`/`safety`/`share-location`/`LiveSafetySheet`) will touch those files twice across two commits — each edit isolated to that hook's destructure.

## Verification (definition of done)

- [ ] `tsc` passes with no errors after **each** hook+callers commit (every breaking change lands tsc-green)
- [ ] All ~16 caller files narrow on `ready` before reading loaded data (compile-enforced)
- [ ] Cold-launch smoke on the 5 flash-gate screens: no empty-state flash with data present; empty state still renders with data absent
- [ ] `useTrustedContact` refocus walk: contact set in `trusted-contact-setup` appears immediately on pop-back to `safety-settings`
- [ ] `trusted-contact-setup` avatar-spring still fires only on a genuine unset→set transition, not on hydrate of a pre-existing contact
- [ ] **Safety-critical re-verify** (no behavior change vs. Phase 1 baseline): `emergency`, `pulled-over`, `en-route`, `unfamiliar`, `safety` — each renders and behaves identically; the mechanical narrow changed only how data is read, not what's shown
- [ ] Each refactored hook's write methods (add/remove/clear/pick/start/end) still update local state
- [ ] No domain logic changed — only loading scaffolding replaced
- [ ] `useRecordings` / `app/recordings.tsx` untouched (confirms scope discipline)

## Sequencing

PR #1 of the Sprint 1 trio. Within it, migrate low-blast-first so risk rises gradually and the safety-critical screens come last:

1. `useHydratedState` primitive (pure-additive, no callers yet)
2. `useSavedPlaces` + its 4 callers (settings/utility — lowest risk)
3. `usePreferences` + its 5 callers (display-only reads)
4. `useShareSession` + its 5 callers (first safety-critical wave — re-verify)
5. `useTrustedContact` + its 12 callers (highest blast; `emergency`/`pulled-over` here — re-verify each)

PR #2 (`useOptimisticMutation`) and PR #3 (`SafetyErrorMessage` + error taxonomy) are separate specs, brainstormed after this lands. `useRecordings` migrates to `useHydratedState` in PR #3, coordinated with standardizing its `error` branch — at which point the codebase-wide guarantee is complete.
