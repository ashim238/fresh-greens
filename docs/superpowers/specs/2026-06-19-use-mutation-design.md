# useMutation — Design Spec

**Date:** 2026-06-19
**Status:** Approved (brainstorm complete; awaiting plan)
**Sprint:** Design Health Program — Phase 2, Sprint 1, PR #2 of 3
**Synthesis source:** [`docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) — SYSTEMIC pattern #2 ("Optimistic Divergence from Storage" / silent error swallowing)

---

## Goal

Make the "save failed and the UI lied about it" class of bug **structurally impossible to recur, codebase-wide.** Today, ~10 async write sites fail silently — UI shows success, storage doesn't have the data, the user has no signal. A single primitive `useMutation` (plus a discriminated `Result<T>` return) gives every write site one shape that TypeScript forces callers to handle.

## The class of bug

Every async write does three things; right now they're tangled together so each call site improvises:

1. **Persist** — call AsyncStorage / adapter (slow, may fail)
2. **Echo to UI** — flip the pip to "Confirmed," remove the row, mark the contact as set (instant, snappy)
3. **What if persist fails?** — rollback? show error? silently leave the optimistic state? Most callers `.catch(console.warn)` and the failure is invisible.

The result, across the audit:
- `useShareSession.startSession` / `endSession` — state-first, await-after; failure leaves UI/storage divergent (share-location P0 in Phase 1)
- `trip-summary.handleAccept` / `handleSetDefault` — deliberate swallow with a defensive comment; user sees "Confirmed" pip for reports that never persisted (countermapping integrity)
- `/report` submit — community report; silent persistence failure feeds nothing into the routing-scoring layer
- `/pulled-over` recording save — Phase 1's tail called recordings "the single most safety-consequential gap in the app"; silent save failure means no legal record
- `useSavedPlaces` writes — honest hook (await-first), but the *callers* `.catch(console.warn)` and the user sees a row that didn't delete
- `roadside-setup` saveProfile — settings save, lower stakes but same silent shape

`useMutation` separates persist / optimistic echo / outcome cleanly and forces every caller to handle the failure branch — same compiler-enforced rigor as PR #1's `ready` narrow.

## Scope

**One unified primitive + ~10 call sites + 1 new UX affordance (the persistent-banner pattern on `/pulled-over`), shipped in one PR.** Per the rejected "synthesis-only" scope: PR #1 set the precedent that we do this codebase-wide once and right; covering all sites here lands the safety-critical cases (report, pulled-over recording) the synthesis missed.

| Site | Shape | Notes |
|---|---|---|
| `useSavedPlaces.addSavedPlace` / `removeSavedPlace` / `clearAll` | hook-owned mutations | settings register, lowest blast |
| `roadside-setup` saveProfile | inline `useMutation` in screen | proves inline pattern |
| `useShareSession.startSession` / `endSession` | hook-owned mutations | first safety-critical wave (4 callers: share-location, LiveSafetySheet, unfamiliar, en-route) |
| `trip-summary.handleAccept` (countermapping accept) | inline `useMutation` | overrides the deliberate swallow; adds pip-rollback + "tap to retry" line |
| `trip-summary.handleSetDefault` (markRegular) | inline `useMutation` | same shape, same screen |
| `/report` submit | inline `useMutation` | adds pending-button + inline error |
| `/pulled-over` save-recording | inline `useMutation` | **highest stakes**; adds new persistent-banner affordance |

**Out of scope (deferred):**
- `useRecordings.removeRecording` — deferred to PR #3 with the rest of recordings (loading migration + error standardization)
- ~12 non-mutation catches (login API, place search, recorder hardware errors, photo file-copy, reverse-geocode) — these are external-integration failures, not divergence; PR #3's `SafetyErrorMessage` is their home

---

## Design

### Conceptual model

Three orthogonal axes today's writes collapse:

- **Intent** — what does the caller want to persist? → `persist: (input: I) => Promise<T>`
- **Local state echo** — how does the UI reflect the optimistic apply, and how would it undo? → `onOptimistic(input) => (() => void) | void`
- **Outcome** — did it land? what should the caller / UI do if not? → discriminated `Result<T>` from `run` + render-time `status` for UI

The `onOptimistic` shape borrows React's `useEffect` cleanup convention: do the apply, return the undo. "What I did" and "how to undo it" live in one function — they can't drift apart.

### The primitive's API

```ts
export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Error };

export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export function useMutation<I, T>(
  persist: (input: I) => Promise<T>,
  options?: {
    /** Apply the optimistic UI echo immediately; return a rollback fn
     *  that fires if `persist` throws. Matches useEffect cleanup shape. */
    onOptimistic?: (input: I) => (() => void) | void;
  },
): {
  run: (input: I) => Promise<MutationResult<T>>;
  status: MutationStatus;
  error: Error | null;
  reset: () => void;
};
```

Behavior contract:

- **`run` always resolves, never throws.** Compiler-forced narrowing on `result.ok` is the whole point. A consumer cannot reach `result.data` without first checking `result.ok`.
- **Order inside `run`:** (1) bump in-flight version, (2) `setStatus('pending')`, (3) invoke `onOptimistic(input)` synchronously and capture the rollback fn, (4) `await persist(input)`, (5) on success → `setStatus('success')`, return `{ ok: true, data }`; on throw → invoke rollback → `setStatus('error')` + capture error → return `{ ok: false, error }`.
- **Concurrent `run` calls cancel the previous.** An in-flight version counter (same cancelled-guard pattern as `useHydratedState`'s `runRead`) ensures a stale resolution can't overwrite a newer one's status. The previous attempt's rollback does NOT fire — the newer call's optimistic apply is the current truth.
- **Unmount-safe.** If the component unmounts mid-await, the cleanup guard prevents state setters from firing. No "setState on unmounted" warnings.
- **`reset()` → `status: 'idle'`, `error: null`.** For "tap to retry" affordances that should clear the error after the retry tap, and for screens that want a fresh state after an explicit dismiss.
- **`persist` MUST be a stable reference** (module-level adapter, or `useCallback`'d). Same rule as PR #1's `read`. Listed in JSDoc.

Internally: one `useState` for `status`, one for `error`, one `useRef` for the in-flight version counter. `run` is `useCallback`'d on `[persist, onOptimistic]`.

### Hook composition (domain hooks expose mutation OBJECTS)

A domain hook owns the mutation and re-exposes it as a named object on its return — not as a flattened `.run` method. This makes `status` / `error` available to screens for render-time UI without each hook re-exporting three fields per write:

```ts
type SavedPlacesState = SavedPlacesReads & {
  add: Mutation<AddInput, SavedPlace>;
  remove: Mutation<string, void>;
  clear: Mutation<void, void>;
};

// Where Mutation<I, T> is the return shape of useMutation<I, T>().
```

Worked refactor (`useSavedPlaces.remove`):

```ts
const removeMutation = useMutation(removeSavedPlaceFromStore, {
  onOptimistic: (id) => {
    const removed = (hydrated.ready ? hydrated.data : []).find(p => p.id === id);
    hydrated.setData(prev => (prev ?? []).filter(p => p.id !== id));
    return () => {
      if (removed) hydrated.setData(prev => [...(prev ?? []), removed]);
    };
  },
});
```

The screen then reads:

```tsx
const state = useSavedPlaces();

<Pressable
  disabled={state.remove.status === 'pending'}
  onPress={async () => {
    const result = await state.remove.run(id);
    if (!result.ok) {
      Alert.alert('Couldn\'t remove', result.error.message);
    }
  }}
/>
```

**Caller migration shape across the codebase:** every existing `await hook.methodName(input)` becomes `await hook.method.run(input)` + an `if (!result.ok)` narrow. This is a real API change at every call site — same kind of compile-forced narrow PR #1 had.

### Inline composition (screens calling `useMutation` directly)

For mutations not tied to a domain hook (`trip-summary` pips, `/report` submit, `/pulled-over` recording save, `/roadside-setup` saveProfile), the screen calls `useMutation` at the top of the component, same shape:

```tsx
const acceptMutation = useMutation(addCommunityReport, {
  onOptimistic: (inf) => {
    setStatuses(s => ({ ...s, [inf.id]: 'accepted' }));
    return () => setStatuses(s => ({ ...s, [inf.id]: undefined }));
  },
});
```

### Safety-critical UX patterns

Three patterns, scaled to the consequence of the failure:

**Pattern P-A — Pip rollback with inline retry** (trip-summary `handleAccept`, `handleSetDefault`)
- On `run` failure, the rollback snaps the pip back to its unanswered state.
- A small line appears below the row: *"Didn't save — tap to retry."* Tap → `run` again. No modal, no recap interruption.
- Honors brand principle ("safety through composure") while overriding the deliberate-swallow comment with the thesis-aligned answer (honesty).

**Pattern P-B — Pending button with inline error** (`/report` submit; `useSavedPlaces` callers; `useShareSession` callers; `roadside-setup`)
- While `status === 'pending'`: button disabled, subtle spinner (`Steady Companion` style, not panicky).
- On success: existing happy path (modal close / dismiss / navigation).
- On failure: button re-enables; inline error text appears above the button: *"Couldn\'t send your report. Try again."* (Concrete copy per site — written close to the site, not generic.)

**Pattern P-C — Persistent retry banner** (`/pulled-over` save-recording — the highest-stakes case)
- The stop-recording moment is exactly when the user *isn't looking at the screen* (they may be talking to an officer). Inline-error isn't enough.
- On failure: a persistent banner pins to the top or bottom of the screen: *"Your recording didn't save. Tap to retry."*
- Banner stays until either (a) retry succeeds (banner clears with a brief confirmation), or (b) user explicitly dismisses it (with a confirm: "Don\'t save this recording?" — this is the destructive escape).
- One new component: `RecordingSaveErrorBanner` (or similar). Scope: composed of existing tokens / typography / Phosphor icons; no new design primitives.

---

## Testing

The project has no test runner; norm is `tsc + node assertions + manual device/sim smoke`. This PR matches that.

- **`tsc` is the primary gate.** The discriminated `Result<T>` makes the bug a compile error — green tsc proves every caller narrows on `.ok` before reading `.data`. This is most of the protection the PR exists to provide.
- **Manual smoke** (all 7 sites, per atomic commit):
  - Happy path: trigger each save with normal conditions → success UI appears, storage reflects the change.
  - Failure path: simulate persistence failure (the simplest is a temporary `throw` injected in the adapter, reverted before commit; or AsyncStorage quota saturation if reachable). Confirm: UI rolls back / shows the correct error pattern (P-A / P-B / P-C); the user has a clear next step; tap retry → succeeds.
  - Double-tap: rapid-fire `run` calls don\'t corrupt status (only the latest wins; previous rollback does NOT fire).
  - Unmount mid-pending: navigate away while a `run` is in flight → no "setState on unmounted" warning; no rollback.
- **Safety-critical re-verify** against Phase 1 baselines: share-location, en-route, unfamiliar, pulled-over, report, trip-summary — behavior under happy path identical to before; failure paths now honest instead of silent.

---

## Files

- **Create:** `hooks/useMutation.ts`
- **Create:** `components/RecordingSaveErrorBanner.tsx` (the P-C persistent-banner affordance)
- **Modify (hooks → mutation objects, breaking caller API):** `hooks/useSavedPlaces.ts`, `hooks/useShareSession.ts`
- **Modify (hook callers — `.run` + `.ok` narrows):** `app/saved-places.tsx`, `app/home.tsx`, `app/share-location.tsx`, `app/en-route.tsx`, `app/unfamiliar.tsx`, `components/LiveSafetySheet.tsx`
- **Modify (inline `useMutation` + UX pattern):** `app/trip-summary.tsx` (P-A ×2), `app/report.tsx` (P-B), `app/pulled-over.tsx` (P-C), `app/roadside-setup.tsx` (P-B)
- **Deferred to PR #3 (not touched here):** `hooks/useRecordings.ts`, `app/recordings.tsx`

## Atomic-commit constraint

A breaking caller API cannot land without all of that hook's callers updated in the **same commit** — tsc is red until every caller narrows on `result.ok`. Each task in the plan = one hook (or inline site) + all its callers = one commit. Same constraint as PR #1; sequence low-blast-first so the safety-critical screens land last and individually re-verified.

## Verification (definition of done)

- [ ] `tsc` passes with no errors after **each** commit
- [ ] All caller files narrow on `result.ok` before reading `result.data` (compile-enforced)
- [ ] Each of the 7 sites: happy path unchanged from pre-PR; failure path now surfaces honestly via P-A / P-B / P-C
- [ ] Double-tap / rapid-fire `run` doesn\'t corrupt status (latest wins)
- [ ] Unmount mid-pending: no warnings, no rollback fires
- [ ] **Safety-critical re-verify** (Phase 1 baselines): share-location, en-route, unfamiliar, pulled-over, report, trip-summary — happy path behavior identical
- [ ] **Pattern P-C banner** (`/pulled-over` save-recording): banner pins, persists across navigation events that don\'t leave the screen, retry succeeds; explicit dismiss requires confirm
- [ ] `useRecordings` / `app/recordings.tsx` untouched (scope discipline)
- [ ] No domain logic changed — only persist / echo / outcome scaffolding replaced

## Sequencing

PR #2 of the Sprint 1 trio. Within it, migrate low-blast-first so risk rises gradually and the safety-critical screens come last:

1. `useMutation` primitive + `RecordingSaveErrorBanner` component (pure-additive, no callers)
2. `useSavedPlaces` + its callers (settings/utility — lowest risk)
3. `roadside-setup` (single screen, settings, proves inline pattern)
4. `useShareSession` + its 4 callers (first safety-critical wave — re-verify each)
5. `trip-summary` (P-A pattern ×2)
6. `/report` submit (P-B pattern, routing-quality surface)
7. `/pulled-over` save-recording (P-C pattern — highest stakes; lands last with the banner)

PR #3 (`SafetyErrorMessage` + error taxonomy) is a separate spec, brainstormed after this lands. `useRecordings` migrates in PR #3 — both its read (to `useHydratedState`) and its writes (to `useMutation`) — coordinated with standardizing its error branch.
