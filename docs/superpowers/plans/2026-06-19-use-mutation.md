# useMutation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the silent-fail / optimistic-divergence class of bug and make it structurally impossible to recur anywhere by introducing a `useMutation` primitive whose `run` returns a discriminated `MutationResult<T>` that TypeScript will not let a caller read past without first narrowing on `.ok`.

**Architecture:** One generic primitive owns three orthogonal axes today's writes collapse: persist (the async write), optimistic echo (apply now + return rollback in the same function), outcome (`run` returns the discriminated `Result`; `status`/`error` for render-time UI). Domain hooks compose it and re-expose **mutation OBJECTS** (`hook.method.run`, `hook.method.status`, `hook.method.error`) — not flattened `.run` methods. Inline screens (trip-summary, report, pulled-over, roadside-setup) call `useMutation` at the top of the component. Three UX patterns scale to consequence: P-A pip-rollback + inline retry (trip-summary), P-B pending button + inline error (report, roadside-setup, hook callers), P-C persistent banner (pulled-over recording save — the highest-stakes case, new component).

**Tech Stack:** React Native + Expo, expo-router, TypeScript, AsyncStorage. No test runner — verification is `npx tsc --noEmit` + manual device/sim smoke (project norm matches PR #1).

**Spec:** [`docs/superpowers/specs/2026-06-19-use-mutation-design.md`](../specs/2026-06-19-use-mutation-design.md)

---

## File Structure

- `hooks/useMutation.ts` — **new.** The generic primitive. Owns status/error state, the in-flight version counter, the unmount guard, and `run`'s persist+optimistic+rollback dance. One responsibility: turn an async writer + an optional optimistic echo into `{ run, status, error, reset }`.
- `components/RecordingSaveErrorBanner.tsx` — **new.** The P-C persistent-banner affordance for `/pulled-over` save-recording failure. Single component, composed of existing tokens; no new design primitives.
- `hooks/useSavedPlaces.ts`, `hooks/useShareSession.ts` — **modify.** Each composes `useMutation` and re-exposes mutation objects on the return.
- Caller files — **modify.** Hook-caller files swap `await hook.method(input)` for `await hook.method.run(input)` + `.ok` narrow. Inline-mutation screens add `useMutation` at the top and the appropriate UX pattern.
- Out-of-scope (deferred to PR #3): `hooks/useRecordings.ts`, `app/recordings.tsx`.

### The atomic-commit constraint

A breaking caller API can't land without all callers updated in the same commit — tsc is red until every caller narrows on `result.ok`. Each task below = one hook/site + all its callers = one commit. Sequence: low-blast → high-blast. The safety-critical wave (useShareSession) lands fourth; the highest-stakes new affordance (P-C banner on pulled-over) lands last.

---

## Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create the feature branch off main**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/use-mutation
```

- [ ] **Step 2: Confirm clean tsc baseline**

Run: `npx tsc --noEmit`
Expected: exits 0 before any change.

---

## Task 1: The `useMutation` primitive

**Files:**
- Create: `hooks/useMutation.ts`

- [ ] **Step 1: Write the primitive**

Create `hooks/useMutation.ts` with exactly:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Discriminated-result async-write primitive — the blessed way to
 * persist data in this app.
 *
 * Separates three axes today's writes collapse into one tangle:
 *   - persist:    the async write itself (slow, may fail)
 *   - optimistic: the UI echo that fires immediately + its rollback
 *                 (do-and-undo declared in the SAME function — they
 *                 can't drift apart)
 *   - outcome:    `run` returns a discriminated MutationResult the
 *                 caller MUST narrow before reading `.data`
 *
 * The result shape is deliberately breaking: a consumer cannot reach
 * `.data` without first checking `.ok`, so silent-fail (catching with
 * console.warn and pretending success) becomes a compile error rather
 * than a convention.
 *
 * `persist` MUST be a stable reference — a module-level adapter
 * function or a useCallback'd closure. It's a render-time effect dep.
 */
export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Error };

export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export type Mutation<I, T> = {
  run: (input: I) => Promise<MutationResult<T>>;
  status: MutationStatus;
  error: Error | null;
  reset: () => void;
};

export function useMutation<I, T>(
  persist: (input: I) => Promise<T>,
  options?: {
    /**
     * Apply the optimistic UI echo immediately; return a rollback fn
     * that fires if `persist` throws. Matches useEffect cleanup shape:
     * "what I did" and "how to undo it" in one function. Return void
     * if no rollback is needed.
     */
    onOptimistic?: (input: I) => (() => void) | void;
  },
): Mutation<I, T> {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  // In-flight version counter: concurrent run() calls cancel the
  // previous attempt's state-flips. A stale resolution can't overwrite
  // a newer one's status, and the prior optimistic apply's rollback
  // does NOT fire (the newer call's optimistic IS the current truth).
  const versionRef = useRef(0);

  // Unmount guard: state setters no-op after unmount. No
  // "setState on unmounted component" warning.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onOptimistic = options?.onOptimistic;

  const run = useCallback(
    async (input: I): Promise<MutationResult<T>> => {
      const myVersion = ++versionRef.current;
      if (mountedRef.current) setStatus('pending');

      // Apply the optimistic echo synchronously, capture the rollback.
      const rollback = onOptimistic?.(input);

      try {
        const data = await persist(input);

        // Cancelled by a newer run() — discard the result silently.
        // The newer call's optimistic is the current UI truth.
        if (versionRef.current !== myVersion) {
          return { ok: true, data };
        }
        if (mountedRef.current) {
          setStatus('success');
          setError(null);
        }
        return { ok: true, data };
      } catch (raw) {
        // Cancelled — newer call's optimistic is the truth; don't
        // rollback this one (would clobber it).
        if (versionRef.current !== myVersion) {
          const err =
            raw instanceof Error ? raw : new Error(String(raw));
          return { ok: false, error: err };
        }
        // Fire the rollback before flipping status — UI snaps back
        // and only then sees the error state.
        rollback?.();
        const err =
          raw instanceof Error ? raw : new Error(String(raw));
        if (mountedRef.current) {
          setStatus('error');
          setError(err);
        }
        return { ok: false, error: err };
      }
    },
    [persist, onOptimistic],
  );

  const reset = useCallback(() => {
    if (mountedRef.current) {
      setStatus('idle');
      setError(null);
    }
  }, []);

  return { run, status, error, reset };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0. Pure-additive (no callers yet).

- [ ] **Step 3: Commit**

```bash
git add hooks/useMutation.ts
git commit -m "feat(hooks): add useMutation primitive

Discriminated-result async-write primitive that separates persist /
optimistic echo / outcome. Breaking by design: callers cannot read
result.data without first narrowing on result.ok, making silent-fail
a compile error rather than a convention. In-flight version counter
handles concurrent run() calls; mounted guard prevents setState on
unmount. Pure-additive — no consumers yet (added per-site in
following commits).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: `useSavedPlaces` writes + callers (lowest blast)

**Files:**
- Modify: `hooks/useSavedPlaces.ts`
- Modify (callers): `app/saved-places.tsx`, `app/home.tsx`, `app/menu.tsx`
- Untouched: `app/search.tsx` (reads `savedPlaces` only, no writes)

- [ ] **Step 1: Refactor the hook to expose mutation objects**

Replace `hooks/useSavedPlaces.ts` with:

```ts
import { useCallback } from 'react';

import {
  addSavedPlace as addSavedPlaceToStore,
  clearSavedPlaces as clearSavedPlacesFromStore,
  getSavedPlaces,
  removeSavedPlace as removeSavedPlaceFromStore,
  type SavedPlace,
  type SavedPlaceKind,
} from '../lib/api/saved-places';
import { useHydratedState } from './useHydratedState';
import { type Mutation, useMutation } from './useMutation';

export type AddSavedPlaceInput = {
  kind: SavedPlaceKind;
  name: string;
  latitude: number;
  longitude: number;
};

type SavedPlacesMutations = {
  add: Mutation<AddSavedPlaceInput, SavedPlace>;
  remove: Mutation<string, void>;
  clear: Mutation<void, void>;
};

export type SavedPlacesState = SavedPlacesMutations &
  (
    | { ready: false }
    | { ready: true; savedPlaces: SavedPlace[]; home: SavedPlace | null }
  );

/**
 * Reactive wrapper around the saved-places adapter. Mount-only read
 * (saved places don't change behind this screen's back the way a
 * contact set in a pushed-over flow does). Writes go through
 * useMutation so the UI echoes optimistically, rolls back on failure,
 * and the caller MUST narrow on result.ok.
 */
export function useSavedPlaces(): SavedPlacesState {
  const hydrated = useHydratedState<SavedPlace[]>(getSavedPlaces, {
    mountOnly: true,
  });

  const add = useMutation(addSavedPlaceToStore, {
    onOptimistic: (input) => {
      // Mirror the adapter's one-home-at-a-time invariant in local
      // state. Synthesize a transient SavedPlace shape (no `id` yet —
      // the adapter assigns it) using a sentinel `id` so the rollback
      // can find this entry to remove it.
      const optimisticId = `__optimistic-${Date.now()}`;
      const optimistic: SavedPlace = {
        id: optimisticId,
        kind: input.kind,
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
      };
      hydrated.setData((prev) => {
        const base = prev ?? [];
        const filtered =
          input.kind === 'home'
            ? base.filter((p) => p.kind !== 'home')
            : base;
        return [...filtered, optimistic];
      });
      return () => {
        hydrated.setData((prev) =>
          (prev ?? []).filter((p) => p.id !== optimisticId),
        );
      };
    },
  });

  // After a successful add, swap the optimistic sentinel for the real
  // adapter-returned record. We can't do this inside useMutation
  // (which doesn't know the shape of T relative to I), so the hook's
  // `add` wrapper does it. The wrapper still returns the same
  // Mutation shape — see the wrappedAdd below.
  const wrappedAdd: Mutation<AddSavedPlaceInput, SavedPlace> = {
    ...add,
    run: useCallback(
      async (input: AddSavedPlaceInput) => {
        const result = await add.run(input);
        if (result.ok) {
          // Replace the latest __optimistic-* entry of this kind with
          // the real record. (We can't track ids back through the
          // mutation; "latest optimistic of this kind" is a safe
          // pointer because mutations are cancelled on overlap.)
          hydrated.setData((prev) => {
            const base = prev ?? [];
            const lastOptimisticIdx = base
              .map((p, i) => ({ p, i }))
              .reverse()
              .find(
                ({ p }) =>
                  p.id.startsWith('__optimistic-') &&
                  p.kind === input.kind,
              )?.i;
            if (lastOptimisticIdx === undefined) {
              return base; // already reconciled (or never present)
            }
            const next = [...base];
            next[lastOptimisticIdx] = result.data;
            return next;
          });
        }
        return result;
      },
      [add.run, hydrated.setData],
    ),
  };

  const remove = useMutation(removeSavedPlaceFromStore, {
    onOptimistic: (id) => {
      const removed = (hydrated.ready ? hydrated.data : []).find(
        (p) => p.id === id,
      );
      hydrated.setData((prev) => (prev ?? []).filter((p) => p.id !== id));
      return () => {
        if (removed) {
          hydrated.setData((prev) => [...(prev ?? []), removed]);
        }
      };
    },
  });

  const clear = useMutation(clearSavedPlacesFromStore, {
    onOptimistic: () => {
      const snapshot = hydrated.ready ? hydrated.data : [];
      hydrated.setData([]);
      return () => {
        hydrated.setData(snapshot);
      };
    },
  });

  if (!hydrated.ready) {
    return { ready: false, add: wrappedAdd, remove, clear };
  }
  const savedPlaces = hydrated.data;
  const home = savedPlaces.find((p) => p.kind === 'home') ?? null;
  return {
    ready: true,
    savedPlaces,
    home,
    add: wrappedAdd,
    remove,
    clear,
  };
}
```

- [ ] **Step 2: Migrate `app/saved-places.tsx`**

Current (line 45 + the catch at 58):
```tsx
const { removeSavedPlace } = savedPlacesState;
// ...
removeSavedPlace(place.id).catch((err) =>
  console.warn('removeSavedPlace failed', err),
);
```

After:
```tsx
const { remove } = savedPlacesState;
// ...inside handleRemove's onPress:
const result = await remove.run(place.id);
if (!result.ok) {
  Alert.alert(
    "Couldn't remove",
    "We couldn't remove this place. Try again in a moment.",
  );
}
```

Make `handleRemove` async if it isn't already (it currently wraps in Alert.alert — keep the outer alert structure, just change the inner action to async + await).

- [ ] **Step 3: Migrate `app/home.tsx`** (line 337 + the void call at line 1781)

Current:
```tsx
const { addSavedPlace } = savedPlacesState;
// ...later:
void addSavedPlace({ kind: 'home', name: 'Home', latitude, longitude });
```

After:
```tsx
const { add } = savedPlacesState;
// ...later:
const result = await add.run({ kind: 'home', name: 'Home', latitude, longitude });
if (!result.ok) {
  console.warn('home save failed', result.error);
  // home save is a background nicety — silent failure is acceptable
  // here (the user can re-save), but the silent path is now EXPLICIT
  // rather than an uncaught .catch.
}
```

The enclosing function needs to be `async`; if it's currently a sync `onPress`, wrap as `() => { void (async () => { ... })(); }` or change to `async`.

- [ ] **Step 4: Migrate `app/menu.tsx`** (line 113)

Current:
```tsx
const { clearAll: clearSavedPlaces } = useSavedPlaces();
```

After:
```tsx
const { clear: clearSavedPlacesMutation } = useSavedPlaces();
// ...where clearSavedPlaces() was called, now:
await clearSavedPlacesMutation.run();
// (no .ok narrow needed if the surrounding sign-out flow ignores
// result; but the call still must use .run)
```

Find every use of `clearSavedPlaces()` in menu.tsx and replace with `clearSavedPlacesMutation.run()`. The sign-out flow probably doesn't care about individual `.ok` — but it MUST use `.run()` to compile.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0. If `search.tsx` errors, the read-side shape changed — that's a bug; investigate before patching.

- [ ] **Step 6: Commit**

```bash
git add hooks/useSavedPlaces.ts app/saved-places.tsx app/home.tsx app/menu.tsx
git commit -m "refactor(saved-places): migrate writes to useMutation

Breaking caller API: add/remove/clear are now Mutation objects.
saved-places.tsx surfaces remove failures via Alert; home.tsx makes
the home-save silent path explicit (was an uncaught .catch); menu.tsx
updates the sign-out clear path. Lowest-blast first; proves the
hook-owned mutation pattern.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: `roadside-setup` saveProfile (inline + P-B pattern)

**Files:**
- Modify: `app/roadside-setup.tsx`

Current (lines 65–77 region — `handleSave` with try/catch/Alert.alert):
```tsx
const [saving, setSaving] = useState(false);
const canSave = nameValid && phoneValid && !saving;

async function handleSave() {
  if (!canSave) return;
  setSaving(true);
  try {
    await saveProfile({ serviceName, phoneNumber });
    router.back();
  } catch (err) {
    console.warn('roadside saveProfile failed', err);
    Alert.alert('Could not save', 'Please try again in a moment.');
    setSaving(false);
  }
}
```

- [ ] **Step 1: Add useMutation + remove the hand-rolled `saving` state**

Replace with (inside `RoadsideSetup` component body):
```tsx
const saveMutation = useMutation(saveProfile);
const saving = saveMutation.status === 'pending';
const canSave = nameValid && phoneValid && !saving;

async function handleSave() {
  if (!canSave) return;
  const result = await saveMutation.run({ serviceName, phoneNumber });
  if (result.ok) {
    router.back();
  } else {
    Alert.alert('Could not save', 'Please try again in a moment.');
    // status === 'error' now; setting it again is unnecessary —
    // useMutation tracks it. Button re-enables automatically.
  }
}
```

Delete the `useState(false)` and the `setSaving(true/false)` calls. Add the import: `import { useMutation } from '../hooks/useMutation';`

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit` → exit 0.

```bash
git add app/roadside-setup.tsx
git commit -m "refactor(roadside-setup): migrate saveProfile to useMutation

Drops the hand-rolled saving boolean; useMutation owns the pending
state. Behavior identical (success → router.back(); failure → Alert).
Single inline migration — proves the screen-side useMutation pattern.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: `useShareSession` writes + callers (first safety-critical wave)

**Files:**
- Modify: `hooks/useShareSession.ts`
- Modify (callers): `app/share-location.tsx`, `app/unfamiliar.tsx`, `components/LiveSafetySheet.tsx`
- Untouched: `app/en-route.tsx`, `app/safety.tsx` (read `session` only, no writes)

- [ ] **Step 1: Refactor the hook to expose three mutations (start / end / resend)**

The current shape uses inline async logic for each write. Replace the body so each write goes through `useMutation`. Schema (preserve `tryCaptureContactLocation`, `openSmsForSession` body, all domain logic — only the persist+state plumbing changes):

```ts
type ShareSessionMutations = {
  start: Mutation<StartShareSessionInput, ShareSession>;
  end: Mutation<void, void>;
  resend: Mutation<
    Pick<NotifyTrustedContactInput, 'locationLabel' | 'coordinates'> | undefined,
    void
  >;
};

export type ShareSessionState = ShareSessionMutations &
  ({ ready: false } | { ready: true; session: ShareSession | null });
```

Each mutation's persist body should be a module-level or `useCallback`'d async function. `openSmsForSession` stays as an internal helper (unchanged body). `start.persist` does: build session → `setStoredShareSession(next)` → `openSmsForSession(next, extras)`. `end.persist` does: `clearStoredShareSession()`. `resend.persist` does: `openSmsForSession(currentSession, extras)` (closure on currentSession).

For each: `onOptimistic` updates `hydrated.setData` immediately (start → setData(next); end → setData(null); resend → no UI echo, it's an external SMS open). The rollback for end restores the previous session; for start, restores null.

Critical detail: `resend` requires `currentSession` to be available. Read it as PR #1 already does: `const currentSession = hydrated.ready ? hydrated.data : null;`. If `currentSession` is null, `resend.run()` should resolve `{ ok: false, error: new Error('no active session') }` — but the cleanest pattern is to gate the call at the caller (`if (!session) return;` already exists at every caller).

Full refactored hook (replace the body of `useShareSession`):
```ts
export function useShareSession(): ShareSessionState {
  const hydrated = useHydratedState<ShareSession | null>(getStoredShareSession);
  const currentSession = hydrated.ready ? hydrated.data : null;

  const openSmsForSession = useCallback(
    async (
      active: ShareSession,
      extras?: Pick<NotifyTrustedContactInput, 'locationLabel' | 'coordinates'>,
    ): Promise<ShareSession> => {
      const contact = await getTrustedContact();
      let coordinates = extras?.coordinates;
      let locationLabel = extras?.locationLabel;
      if (!coordinates) {
        const geo = await readNotifyCoordinates();
        coordinates = geo.coordinates;
        locationLabel = locationLabel ?? geo.locationLabel;
      }
      const result = await notifyTrustedContact(contact, {
        flow: active.type,
        reason: active.reason,
        locationLabel,
        coordinates,
      });
      if (!result.notifiedAtIso) return active;
      const withSms: ShareSession = {
        ...active,
        smsOpenedAtIso: result.notifiedAtIso,
      };
      hydrated.setData(withSms);
      await setStoredShareSession(withSms);
      return withSms;
    },
    [hydrated.setData],
  );

  // start persist: build the session, persist it, then open SMS.
  const startPersist = useCallback(
    async (input: StartShareSessionInput): Promise<ShareSession> => {
      const next: ShareSession = {
        id: `${input.type}-${Date.now()}`,
        type: input.type,
        reason: input.reason,
        startedAtIso: new Date().toISOString(),
      };
      await setStoredShareSession(next);
      return openSmsForSession(next, {
        locationLabel: input.locationLabel,
        coordinates: input.coordinates,
      });
    },
    [openSmsForSession],
  );

  const start = useMutation(startPersist, {
    onOptimistic: (input) => {
      const prev = currentSession;
      const next: ShareSession = {
        id: `${input.type}-${Date.now()}`,
        type: input.type,
        reason: input.reason,
        startedAtIso: new Date().toISOString(),
      };
      hydrated.setData(next);
      return () => {
        hydrated.setData(prev);
      };
    },
  });

  const endPersist = useCallback(async () => {
    await clearStoredShareSession();
  }, []);

  const end = useMutation(endPersist, {
    onOptimistic: () => {
      const prev = currentSession;
      hydrated.setData(null);
      return () => {
        hydrated.setData(prev);
      };
    },
  });

  const resendPersist = useCallback(
    async (
      extras?: Pick<NotifyTrustedContactInput, 'locationLabel' | 'coordinates'>,
    ): Promise<void> => {
      if (!currentSession) {
        throw new Error('No active session to resend.');
      }
      await openSmsForSession(currentSession, extras);
    },
    [currentSession, openSmsForSession],
  );

  const resend = useMutation(resendPersist);

  if (!hydrated.ready) {
    return { ready: false, start, end, resend };
  }
  return {
    ready: true,
    session: currentSession,
    start,
    end,
    resend,
  };
}
```

Note: `start`'s persist constructs the session a second time inside `startPersist`. The optimistic also constructs it. They use `Date.now()` so the optimistic's `id` and the persisted `id` may differ by milliseconds. This is acceptable because the rollback simply restores `prev` — it doesn't care about the optimistic's id matching.

- [ ] **Step 2: Migrate `app/share-location.tsx`** (lines 47, 70, 80, 102)

Before:
```tsx
const { startSession, endSession, resendSessionSms } = shareState;
// ...
await startSession({ type: 'share-location', reason: option.title });
// ...
await endSession();
// ...
void resendSessionSms();
```

After:
```tsx
const { start, end, resend } = shareState;
// ...
const startResult = await start.run({ type: 'share-location', reason: option.title });
if (!startResult.ok) {
  Alert.alert(
    "Couldn't start sharing",
    "We couldn't start the share session. Try again in a moment.",
  );
  return;
}
// ...
const endResult = await end.run();
if (!endResult.ok) {
  Alert.alert("Couldn't end sharing", "Try again in a moment.");
  return;
}
// ...
void resend.run(undefined);
```

(Last call stays `void` per the existing pattern — resend is fire-and-forget at this site by design.)

- [ ] **Step 3: Migrate `app/unfamiliar.tsx`** (lines 86, 104, 150, 196)

Same transform: `{ startSession, endSession, resendSessionSms }` → `{ start, end, resend }`; each `await X(...)` becomes `const r = await X.run(...); if (!r.ok) { /* alert */ }`; `void resendSessionSms()` becomes `void resend.run(undefined)`.

- [ ] **Step 4: Migrate `components/LiveSafetySheet.tsx`** (lines 54, 86, 105, 128, 196)

Same transform. The `doEnd().catch(console.warn)` at line 105 becomes:
```tsx
const endResult = await end.run();
if (!endResult.ok) {
  Alert.alert(
    "Couldn't end sharing",
    "Try again in a moment.",
  );
}
```
(No more `.catch(console.warn)` — the result is narrowed.)

The two `void resendSessionSms()` sites become `void resend.run(undefined)`.

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit` → exit 0. `en-route.tsx` and `app/safety.tsx` should compile unchanged (they only read `session`).

```bash
git add hooks/useShareSession.ts app/share-location.tsx app/unfamiliar.tsx components/LiveSafetySheet.tsx
git commit -m "refactor(share-session): migrate writes to useMutation

Breaking caller API: start/end/resend are now Mutation objects.
Fixes the share-location P0 from Phase 1 (handleEnd silent failure
leaving a ghost session in storage). LiveSafetySheet replaces its
.catch(console.warn) with a proper .ok narrow + Alert. First
safety-critical wave — re-verify share-location / unfamiliar /
LiveSafetySheet against Phase 1 baselines.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: `trip-summary` countermapping + markRegular (P-A pattern)

**Files:**
- Modify: `app/trip-summary.tsx`

P-A pattern (pip rollback + inline "tap to retry" line). Two inline mutations: `handleAccept` (countermapping accept) and `handleSetDefault` (markRegular).

- [ ] **Step 1: Add the two mutations + retry-failure UI state**

Add to the component body (top of `TripSummary`):
```tsx
const acceptMutation = useMutation(addCommunityReport, {
  onOptimistic: (input: AddCommunityReportInput) => {
    // The caller passes the original `inf` via input.detail or
    // similar — we need the inference id to flip the pip. Easiest:
    // pass it through as part of the persist input (see handleAccept
    // below) and capture here.
    return () => {}; // rollback handled in handleAccept (sees `inf` directly)
  },
});

// Map of inference-id → "couldn't save, tap to retry"
const [retryableAccepts, setRetryableAccepts] = useState<
  Record<string, Inference>
>({});
```

Wait — the optimistic-rollback shape doesn't carry the `inf` argument. The cleanest pattern: keep handleAccept owning the `setStatuses` and rollback logic, and use the mutation purely for the persist+result. The mutation's `onOptimistic` can be `undefined` here:

Replace the brainstormed shape with a tighter version:
```tsx
const acceptMutation = useMutation(addCommunityReport);
const regularMutation = useMutation(markRegular);
const [retryableAccepts, setRetryableAccepts] = useState<
  Record<string, Inference>
>({});
```

- [ ] **Step 2: Replace `handleAccept`** (around line 181)

Current:
```tsx
async function handleAccept(inf: Inference) {
  const meta = INFERENCE_META[inf.category];
  if (!meta) return;
  setStatuses((s) => ({ ...s, [inf.id]: 'accepted' }));
  try {
    await addCommunityReport({ ... });
  } catch {
    // Best-effort local write; the optimistic 'accepted' state stands.
  }
}
```

After:
```tsx
async function handleAccept(inf: Inference) {
  const meta = INFERENCE_META[inf.category];
  if (!meta) return;
  setStatuses((s) => ({ ...s, [inf.id]: 'accepted' }));
  setRetryableAccepts((r) => {
    const { [inf.id]: _, ...rest } = r;
    return rest;
  });
  const result = await acceptMutation.run({
    categoryId: meta.reportCategoryId,
    location: { latitude: inf.latitude, longitude: inf.longitude },
    detail: meta.detail,
  });
  if (!result.ok) {
    // P-A: snap pip back, surface inline retry
    setStatuses((s) => ({ ...s, [inf.id]: undefined }));
    setRetryableAccepts((r) => ({ ...r, [inf.id]: inf }));
  }
}
```

(The `_` destructure is a no-lint hack to remove the entry; alternatively use `delete` with a copy.)

- [ ] **Step 3: Replace `handleSetDefault`** (around line 160)

Current:
```tsx
async function handleSetDefault() {
  // ...
  if (label && Number.isFinite(lat) && Number.isFinite(lng)) {
    try {
      await markRegular({ name: label, latitude: lat, longitude: lng });
      AccessibilityInfo.announceForAccessibility(...);
    } catch {
      // Best-effort local write; dismiss regardless.
    }
  }
  router.back();
}
```

After:
```tsx
async function handleSetDefault() {
  const lat = Number(destLat);
  const lng = Number(destLng);
  if (label && Number.isFinite(lat) && Number.isFinite(lng)) {
    const result = await regularMutation.run({
      name: label,
      latitude: lat,
      longitude: lng,
    });
    if (result.ok) {
      AccessibilityInfo.announceForAccessibility(
        `${label} saved as a regular destination.`,
      );
    } else {
      // P-A: stay on screen, show retry affordance below the CTA
      // (handled by status === 'error' check in render — see Step 4)
      return;
    }
  }
  router.back();
}
```

- [ ] **Step 4: Add the inline retry-line UI**

In the inferences section render (where each `inf` row is rendered, around lines 250–300), add a retry-line below rows where `retryableAccepts[inf.id]` exists:
```tsx
{retryableAccepts[inf.id] && (
  <Pressable
    onPress={() => handleAccept(retryableAccepts[inf.id]!)}
    style={styles.inferenceRetryLine}
    accessibilityRole="button"
    accessibilityLabel={`Retry confirming ${inf.label}`}
  >
    <Text style={styles.inferenceRetryText}>Didn't save — tap to retry.</Text>
  </Pressable>
)}
```

For `handleSetDefault`, when `regularMutation.status === 'error'`, render a similar retry-line above or below the "Set as default" button:
```tsx
{regularMutation.status === 'error' && (
  <Pressable
    onPress={handleSetDefault}
    style={styles.setDefaultRetryLine}
  >
    <Text style={styles.setDefaultRetryText}>Didn't save — tap to retry.</Text>
  </Pressable>
)}
```

Add styles (`inferenceRetryLine`, `inferenceRetryText`, `setDefaultRetryLine`, `setDefaultRetryText`) using existing tokens — `typography.footnoteRegular`, `colors.labelSecondary`, modest `paddingVertical`. The retry-line is intentionally quiet; the brand voice is "honesty through composure" — small, not alarming.

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit` → exit 0.

```bash
git add app/trip-summary.tsx
git commit -m "refactor(trip-summary): migrate countermapping + markRegular to useMutation

P-A pattern: on save failure, pips snap back from green to unanswered
and a small 'tap to retry' line appears below the row. handleSetDefault
shows the same retry-line near the CTA instead of dismissing. Overrides
the deliberate-swallow comments with the thesis-aligned answer:
honesty through composure.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: `/report` submit (P-B pattern)

**Files:**
- Modify: `app/report.tsx`

P-B pattern (pending button + inline error). The screen ALREADY has a `submitting` boolean threaded through; the migration unifies it with `useMutation` and adds the inline-error surface that's missing today.

- [ ] **Step 1: Replace `submitting` state with `useMutation`**

Current (lines 85, 214–251 region):
```tsx
const [submitting, setSubmitting] = useState(false);
// ...
async function handleSubmit() {
  if (!category || !location || submitting) return;
  setSubmitting(true);
  try {
    const report = await addCommunityReport({ ... });
    // ...success path
  } catch (error) {
    console.warn('[report] submit failed:', error);
    // ...today's silent fail
  } finally {
    setSubmitting(false);
  }
}
```

After:
```tsx
const submitMutation = useMutation(addCommunityReport);
const submitting = submitMutation.status === 'pending';

async function handleSubmit() {
  if (!category || !location || submitting) return;
  const result = await submitMutation.run({ ... /* same input shape */ });
  if (result.ok) {
    // ...same success path that used to follow the `await` (router
    // back, toast, etc. — keep verbatim)
  }
  // failure: nothing to do here — the inline error surface (Step 2)
  // reads submitMutation.error to render
}
```

Delete the `useState(false)` and `setSubmitting` calls. Replace with the derived `submitting`.

- [ ] **Step 2: Add the inline-error surface above the submit button**

In the render, just above the existing Button (around line 722), add:
```tsx
{submitMutation.status === 'error' && (
  <Text style={styles.submitErrorLine}>
    Couldn't send your report. Try again.
  </Text>
)}
```

Add the style:
```tsx
submitErrorLine: {
  ...dynamicType(typography.subheadlineRegular),
  color: colors.red, // reserved-color carve-out: red on a submit-error line
                     //  matches the brand's pattern (failures are red, not orange)
  textAlign: 'center',
  paddingVertical: spacing.sm,
},
```

NOTE: `colors.red` reserved-color rule — verify this is a sanctioned use of red. If not, fall back to `colors.labelSecondary` and rely on the message text alone.

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit` → exit 0.

```bash
git add app/report.tsx
git commit -m "refactor(report): migrate submit to useMutation + inline error

P-B pattern: pending state now flows from useMutation.status; on
failure, the button re-enables and an inline error line appears
above it. Fixes a synthesis-missed safety-critical case (community
reports feed routing-scoring; silent failure means the routing
layer never gets the signal).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: `/pulled-over` save-recording + P-C banner (highest stakes)

**Files:**
- Create: `components/RecordingSaveErrorBanner.tsx`
- Modify: `app/pulled-over.tsx`

The P-C pattern (persistent retry banner) is the only new visible affordance in this PR. The current code at line 397 navigates away in `finally` *unconditionally* — failure-path navigation needs to be **deferred** so the banner appears on `/pulled-over`, not pinned to a screen the user already left.

- [ ] **Step 1: Build the `RecordingSaveErrorBanner` component**

Create `components/RecordingSaveErrorBanner.tsx`:
```tsx
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { X } from 'phosphor-react-native/src/icons/X';

import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Persistent banner for the /pulled-over save-recording failure case.
 *
 * P-C of the useMutation UX patterns: the highest-stakes silent-fail
 * site in the app (recordings are legal protection — Phase 1's tail).
 * The stop-recording moment is exactly when the user isn't looking at
 * the screen, so inline error isn't enough. This banner pins until
 * the retry succeeds OR the user explicitly dismisses (with confirm).
 *
 * `onRetry` runs the persist again. `onDismiss` is destructive — the
 * banner asks for confirm before discarding the recording.
 */
export function RecordingSaveErrorBanner({
  onRetry,
  onDismiss,
  pending,
}: {
  onRetry: () => void;
  onDismiss: () => void;
  pending: boolean;
}) {
  function handleDismissTap() {
    Alert.alert(
      "Don't save this recording?",
      'This will permanently discard the audio you just captured.',
      [
        { text: 'Keep trying', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDismiss },
      ],
    );
  }

  return (
    <View style={styles.root} accessibilityLiveRegion="assertive">
      <View style={styles.iconWrap}>
        <Warning size={20} color={colors.white} weight="fill" />
      </View>
      <Text style={styles.message} numberOfLines={2}>
        Your recording didn't save.
      </Text>
      <Pressable
        onPress={onRetry}
        disabled={pending}
        accessibilityRole="button"
        accessibilityLabel={pending ? 'Retrying' : 'Retry saving recording'}
        style={({ pressed }) => [
          tapTarget44,
          styles.retryBtn,
          pressed && !pending && pressedDim,
        ]}
      >
        <Text style={styles.retryText}>{pending ? 'Retrying…' : 'Retry'}</Text>
      </Pressable>
      <Pressable
        onPress={handleDismissTap}
        accessibilityRole="button"
        accessibilityLabel="Dismiss banner — discard recording"
        style={({ pressed }) => [tapTarget44, styles.dismissBtn, pressed && pressedDim]}
      >
        <X size={20} color={colors.white} weight="regular" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.red, // reserved-color sanctioned: recording-save failure
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.white,
    flex: 1,
  },
  retryBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.red,
  },
  dismissBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

NOTE: `colors.red` use here IS a reserved-color carve-out — recording-save failure is on-brand for red (the recording subsystem already owns red per the rule). Verify against `.cursorrules`. If reserved-color rule blocks this, fall back to `colors.systemRed` or a less-saturated red token.

- [ ] **Step 2: Refactor pulled-over's save-recording handler**

The current logic (around line 397) lives inside a `try/catch/finally` where the `finally` *always* navigates. New flow: the `addRecording` failure path STAYS on screen, the banner mounts, navigation is deferred to success or explicit dismiss.

This is a real behavior change. The `finally` block currently does:
```tsx
} finally {
  setHasActiveRecording(false);
  navigation.dispatch(data.action);
}
```

Replace with:
```tsx
// (no more try/catch — useMutation owns it)
const result = await saveRecordingMutation.run({
  sourceUri,
  durationMs,
  armed: recordingArmedRef.current,
  createdAt: startedAt,
});
setHasActiveRecording(false);
if (result.ok) {
  console.log('[pulled-over] saved recording', result.data.id);
  navigation.dispatch(data.action);
} else {
  // STAY on screen — banner is now visible (rendered conditionally
  // on saveRecordingMutation.status === 'error', see Step 3).
  // The user retries via the banner or dismisses explicitly.
}
```

Add the mutation at the top of the component:
```tsx
const saveRecordingMutation = useMutation(addRecording);
```

And capture the navigation action for retry/dismiss:
```tsx
const pendingNavRef = useRef<{ action: NavigationAction } | null>(null);
// in the handler body, before .run:
pendingNavRef.current = { action: data.action };
```

- [ ] **Step 3: Render the banner conditionally**

In the pulled-over JSX (near the top of the screen, above the main content but inside SafeAreaView), add:
```tsx
{saveRecordingMutation.status === 'error' && (
  <RecordingSaveErrorBanner
    pending={saveRecordingMutation.status === 'pending'}
    onRetry={async () => {
      // Re-run the same persist input — captured at save time
      const lastInput = lastRecordingSaveInputRef.current;
      if (!lastInput) return;
      const result = await saveRecordingMutation.run(lastInput);
      if (result.ok && pendingNavRef.current) {
        navigation.dispatch(pendingNavRef.current.action);
      }
    }}
    onDismiss={() => {
      // Discard: clear the mutation state, fire the deferred nav
      saveRecordingMutation.reset();
      if (pendingNavRef.current) {
        navigation.dispatch(pendingNavRef.current.action);
      }
    }}
  />
)}
```

Add a ref for the last input: `const lastRecordingSaveInputRef = useRef<AddRecordingInput | null>(null);` and populate it inside the save handler (`lastRecordingSaveInputRef.current = { sourceUri, durationMs, ... }`).

- [ ] **Step 4: Type-check + commit**

Run: `npx tsc --noEmit` → exit 0.

```bash
git add components/RecordingSaveErrorBanner.tsx app/pulled-over.tsx
git commit -m "refactor(pulled-over): migrate save-recording to useMutation + P-C banner

The highest-stakes silent-fail site in the app. Phase 1's tail named
recordings 'the single most safety-consequential gap'; this commit
makes the failure visible via a persistent banner that pins until
retry succeeds or the user explicitly dismisses with confirm. Deferred
navigation: on save failure the user stays on /pulled-over with the
banner; success or explicit dismiss fires the navigation that today
fires unconditionally.

New component: RecordingSaveErrorBanner (composed of existing tokens;
red background is a sanctioned carve-out — the recording subsystem
owns red per the reserved-color rule).

Lands last per the low-blast-first sequence. Re-verify against Phase 1
baseline: happy path identical; failure path now honest.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Final verification + PR

**Files:** none (verification + git)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 2: Confirm scope discipline**

```bash
git diff --name-only main...HEAD | sort
```
Expected files: `hooks/useMutation.ts`, `hooks/useSavedPlaces.ts`, `hooks/useShareSession.ts`, `components/RecordingSaveErrorBanner.tsx`, `app/saved-places.tsx`, `app/home.tsx`, `app/menu.tsx`, `app/roadside-setup.tsx`, `app/share-location.tsx`, `app/unfamiliar.tsx`, `components/LiveSafetySheet.tsx`, `app/trip-summary.tsx`, `app/report.tsx`, `app/pulled-over.tsx`.

Expected ABSENT: `hooks/useRecordings.ts`, `app/recordings.tsx` (deferred to PR #3); `app/en-route.tsx`, `app/safety.tsx`, `app/search.tsx` (read-only for the migrated hooks, no writes touched).

- [ ] **Step 3: Manual smoke — happy paths (7 sites)**

On a sim/device with normal conditions, exercise each save site and confirm success behavior is identical to pre-PR:
- saved-places: tap remove → row disappears, persists across reload.
- home: tap "save as home" on a new location → home marker moves, persists.
- menu: sign-out → all preferences cleared.
- roadside-setup: enter valid service + phone → tap save → returns to previous screen.
- share-location: pick a reason → starts session, opens Messages, returns to /home.
- unfamiliar: pick a destination → starts session, opens Messages.
- trip-summary: tap ✓ on a pip → pip turns green, persists.
- /report: fill report → submit → modal closes.
- /pulled-over: stop recording → recording saved, navigates back.

- [ ] **Step 4: Manual smoke — failure paths (per-pattern)**

Simulate persistence failure by temporarily injecting a `throw` in the relevant adapter (revert before final commit). For each pattern:

**P-A (trip-summary):** tap ✓ → pip flips green → injected throw → pip snaps back, "Didn't save — tap to retry." appears below. Tap retry → succeeds, pip stays green.

**P-B (report, roadside-setup, hook callers):** submit button shows pending, error path produces inline error / Alert; button re-enables.

**P-C (pulled-over):** stop recording with injected adapter throw → banner pins, navigation does NOT fire. Tap Retry → banner clears + navigates. Alternative: tap X → confirm Alert appears; Discard → banner clears + navigates; Keep trying → banner stays.

- [ ] **Step 5: Sanity walks**

- **Double-tap a save:** rapid-fire `run()` calls → no corrupted status, only the latest wins, previous's rollback does NOT fire.
- **Unmount mid-pending:** navigate away while a `run` is in flight (e.g., back-button on report.tsx during submit) → no "setState on unmounted" warning in console.

- [ ] **Step 6: Safety-critical re-verify (Phase 1 baselines)**

Walk share-location / unfamiliar / LiveSafetySheet (Task 4 wave) and pulled-over (Task 7) — confirm happy-path behavior identical to pre-PR. The mutation migration changed only the persist/echo/outcome plumbing, not the domain logic.

- [ ] **Step 7: Open the PR**

```bash
git push -u origin feat/use-mutation
gh pr create --title "refactor(hooks): useMutation — kill the silent-fail class of bug" --body "$(cat <<'EOF'
Implements [the useMutation spec](docs/superpowers/specs/2026-06-19-use-mutation-design.md) (Phase 2 Sprint 1 PR #2 of 3) from the Design Health Program. Synthesis pattern #2 ("Optimistic Divergence from Storage" / silent error swallowing).

## What & why

Introduces \`hooks/useMutation.ts\` — a discriminated-result async-write primitive — and migrates ~10 call sites across 4 hooks + 5 inline screens. The Result is **breaking by design**: a caller cannot read \`result.data\` without first checking \`result.ok\`, so silent-fail becomes a **compile error** rather than a convention. Per the chosen future-proofing path (same as PR #1), this holds codebase-wide for the migrated sites — including screens that don't exist yet.

## Scope (one commit per hook/site, low-blast-first)

- Task 1 — the useMutation primitive
- Task 2 — useSavedPlaces writes (settings)
- Task 3 — roadside-setup saveProfile (inline + P-B)
- Task 4 — useShareSession writes (first safety-critical wave; fixes share-location P0 from Phase 1)
- Task 5 — trip-summary countermapping + markRegular (P-A pip-rollback + inline retry)
- Task 6 — /report submit (P-B; routing-quality surface)
- Task 7 — /pulled-over save-recording + P-C persistent banner (highest stakes, new component)

5 deliberate UX upgrades (P-A ×2, P-B ×4, P-C ×1) + ~5 mechanical migrations (behavior unchanged except where the spec calls for an upgrade). useRecordings is **deferred to PR #3** (where it migrates alongside SafetyErrorMessage).

## Verification

- ✅ tsc --noEmit clean after every commit
- ✅ Scope discipline: useRecordings / recordings.tsx absent from the diff
- ✅ Safety-critical re-verify (share-location, unfamiliar, LiveSafetySheet, pulled-over)

## ⚠️ Manual smoke still owed

tsc + reviews can't cover the failure-path UX. Before merge, on a sim/device:
1. Each save site happy path → unchanged from pre-PR.
2. Each save site failure path (inject adapter throw) → P-A / P-B / P-C pattern fires correctly.
3. Double-tap saves → only latest wins, no corrupted status.
4. Unmount mid-pending → no warnings.
5. /pulled-over banner: pins on failure, retry/dismiss flow works, Alert confirm appears.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- Primitive (discriminated Result, status/error/reset, version-counter cancellation, unmount guard) → Task 1. ✓
- Hook-owned mutations on `useSavedPlaces` (add/remove/clear) + callers → Task 2. ✓
- Hook-owned mutations on `useShareSession` (start/end/resend — synthesizing the brainstorm-noted resend into the wave) + callers → Task 4. ✓
- Inline P-B on `roadside-setup` → Task 3. ✓
- Inline P-A ×2 on `trip-summary` → Task 5. ✓
- Inline P-B on `/report` → Task 6. ✓
- Inline P-C on `/pulled-over` + new banner component → Task 7. ✓
- useRecordings deferred — absent from diff (verified in Task 8 Step 2). ✓
- Atomic-commit constraint, low-blast-first sequencing — Tasks 2→7 ordered. ✓
- tsc + manual smoke + double-tap/unmount sanity walks → Task 8. ✓

**2. Placeholder scan.** None. The `/* … */` markers are deliberate elisions where the surrounding hunks identify the verbatim-preserved code (Task 6 Step 1 success path, Task 2 Step 2 enclosing Alert.alert structure). The `_` destructure in Task 5 Step 2 is the standard "discard key" pattern, not a placeholder.

**3. Type consistency.**
- `Mutation<I, T>` is the canonical shape — defined in Task 1, used in Tasks 2/4 via `import { type Mutation, useMutation }`.
- Domain hooks expose `add` / `remove` / `clear` (savedPlaces) and `start` / `end` / `resend` (shareSession) — names match between hook definitions and migrated callers.
- `MutationResult<T>` field name is `.ok` (not `.success`) — used consistently in every caller migration.

**Watch items for the implementer:**
- Task 5's `acceptMutation` doesn't use `onOptimistic` because the `inf` argument isn't available inside the optimistic callback's closure — the `handleAccept` body owns the pip flip + retry-state directly. Tighter than the brainstorm's worked example.
- Task 7's deferred-navigation logic is the biggest behavior change in the PR — the `finally`-always-navigates pattern is currently load-bearing. Re-verify nothing depends on that side effect (e.g., other useEffects keyed on the navigation event).
- Task 6's `colors.red` and Task 7's banner-background `colors.red` — verify against `.cursorrules` reserved-color rule. The fallback (gray subheadline / less-saturated red) is documented in the relevant step.
