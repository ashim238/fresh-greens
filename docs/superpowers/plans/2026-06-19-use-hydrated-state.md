# useHydratedState Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the hydration-flash bug and make it structurally impossible to recur anywhere by migrating four AsyncStorage-backed hooks to a discriminated-union loading primitive (`useHydratedState`) that TypeScript will not let a caller read past without first narrowing on `ready`.

**Architecture:** One generic primitive owns the loading→ready axis. Four domain hooks (`useSavedPlaces`, `usePreferences`, `useShareSession`, `useTrustedContact`) compose it and re-expose a domain-named discriminated union — write methods intersected out (callable on both branches), the loaded value reachable only on the `ready: true` branch. Five screens that Phase 1 flagged get a *deliberate* per-section gate (render chrome/placeholder while `!ready`). The ~9 remaining data-reading callers get a *mechanical narrow* — a 1–2 line edit that satisfies the compiler without changing behavior. Write-only callers are untouched.

**Tech Stack:** React Native + Expo, expo-router (`useFocusEffect`), TypeScript, AsyncStorage. No test runner — verification is `npx tsc --noEmit` + manual device/sim smoke (project norm).

**Spec:** [`docs/superpowers/specs/2026-06-19-use-hydrated-state-design.md`](../specs/2026-06-19-use-hydrated-state-design.md)

---

## File Structure

- `hooks/useHydratedState.ts` — **new.** The generic primitive. Owns `useState` + `useFocusEffect`/`useEffect` + cancelled-guard + the `ready` latch. One responsibility: turn an async reader into `{ ready } & { setData }`.
- `hooks/useSavedPlaces.ts`, `hooks/usePreferences.ts`, `hooks/useShareSession.ts`, `hooks/useTrustedContact.ts` — **modify.** Each composes the primitive, deletes its hand-rolled loading scaffolding, keeps all domain logic, returns a breaking union.
- Caller files — **modify.** 5 flash-gate screens (deliberate gate) + ~9 mechanical narrows. Enumerated per task.
- `hooks/useRecordings.ts`, `app/recordings.tsx` — **NOT touched** (deferred to PR #3).
- `app/menu.tsx`, `components/zoneCategoryContent.ts` — **NOT touched** (write-only / no hook call; see notes).

### The atomic-commit constraint

A breaking union cannot land without all of that hook's data-reading callers updated **in the same commit** — `tsc` is red until every one narrows. So each task below is **one hook + all its callers = one commit**. Tasks are ordered low-blast-first so risk rises gradually and the safety-critical screens are touched last. `useShareSession` and `useTrustedContact` share callers (`en-route`, `unfamiliar`, `safety`, `share-location`, `LiveSafetySheet`); those files are touched in both Task 4 and Task 5, each edit isolated to that hook's destructure.

---

## Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create the feature branch off main**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/use-hydrated-state
```

- [ ] **Step 2: Confirm clean tsc baseline**

Run: `npx tsc --noEmit`
Expected: exits 0 (no errors) before any change.

---

## Task 1: The `useHydratedState` primitive

**Files:**
- Create: `hooks/useHydratedState.ts`

- [ ] **Step 1: Write the primitive**

Create `hooks/useHydratedState.ts` with exactly:

```ts
import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Discriminated-union loading primitive — the blessed way to read an
 * async-hydrated value in this app.
 *
 * Separates two axes that screens used to collapse into one nullable
 * value (the cause of the cold-launch "empty state flash"):
 *   - hydration: has the read settled?  → the `ready` flag
 *   - content:   once settled, is there anything there?  → the data's
 *                own nullability/emptiness
 *
 * `ready: true` does NOT mean "data exists" — it means "the read has
 * settled." A loaded-but-empty result is `ready: true` with empty data.
 *
 * The union shape is deliberately breaking: a consumer cannot reach
 * `.data` without first narrowing on `ready`, so the flash bug is a
 * compile error rather than a convention. `setData` is intersected
 * OUTSIDE the union so a composing hook can build write methods at the
 * top level (and so write-only consumers compile unchanged).
 *
 * `read` MUST be a stable reference (a module-level adapter function, or
 * a useCallback'd closure) — it is an effect dependency.
 */
export type Hydrated<T> =
  | { ready: false }
  | { ready: true; data: T };

export function useHydratedState<T>(
  read: () => Promise<T>,
  options?: { mountOnly?: boolean },
): Hydrated<T> & { setData: Dispatch<SetStateAction<T>> } {
  const mountOnly = options?.mountOnly ?? false;
  const [data, setData] = useState<T | undefined>(undefined);
  const [ready, setReady] = useState(false);

  // Shared read body. `ready` latches false→true once and never returns
  // to false on refocus — re-reading must update `data` silently without
  // re-showing the loading branch (which would re-flash the UI).
  const runRead = useCallback(() => {
    let cancelled = false;
    void (async () => {
      const result = await read();
      if (!cancelled) {
        setData(result);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [read]);

  // Both hooks are always called (rules-of-hooks); the unused one no-ops
  // via an early return inside its body, not around the call.
  useEffect(() => {
    if (!mountOnly) return;
    return runRead();
  }, [mountOnly, runRead]);

  useFocusEffect(
    useCallback(() => {
      if (mountOnly) return;
      return runRead();
    }, [mountOnly, runRead]),
  );

  const stableSetData = setData as Dispatch<SetStateAction<T>>;
  if (!ready) {
    return { ready: false, setData: stableSetData };
  }
  return { ready: true, data: data as T, setData: stableSetData };
}
```

Note on the two casts: internally `data` is `T | undefined` (undefined is the "not yet read" sentinel). `data as T` is sound on the `ready` branch because `ready` only flips true after `setData(result)` ran with a real `T`. `setData as Dispatch<SetStateAction<T>>` narrows the accepted type for callers (they only ever pass `T`); the underlying setter accepts `T | undefined`, a superset, so every call a caller makes is valid.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0. The file is pure-additive (no callers yet).

- [ ] **Step 3: Commit**

```bash
git add hooks/useHydratedState.ts
git commit -m "feat(hooks): add useHydratedState loading primitive

Discriminated-union hook that separates hydration (ready) from content
(the data's own emptiness). Breaking by design: callers cannot read
.data without narrowing on ready, making the cold-launch empty-state
flash a compile error. Refocus-aware by default, { mountOnly } opt-out.
Pure-additive — no consumers yet (added per-hook in following commits)."
```

---

## Task 2: `useSavedPlaces` + its callers (lowest blast)

**Files:**
- Modify: `hooks/useSavedPlaces.ts`
- Modify (flash-gate): `app/saved-places.tsx`
- Modify (mechanical narrow): `app/home.tsx:335`, `app/search.tsx:235`
- Untouched (write-only): `app/menu.tsx:113` (`clearAll` only)

- [ ] **Step 1: Refactor the hook**

Replace the body of `hooks/useSavedPlaces.ts` (keep the imports block; `useEffect`/`useState` come from the primitive now — drop them from the import if unused). New hook:

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

type SavedPlacesWrites = {
  addSavedPlace: (input: {
    kind: SavedPlaceKind;
    name: string;
    latitude: number;
    longitude: number;
  }) => Promise<SavedPlace>;
  removeSavedPlace: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

export type SavedPlacesState = SavedPlacesWrites &
  (
    | { ready: false }
    | { ready: true; savedPlaces: SavedPlace[]; home: SavedPlace | null }
  );

/**
 * Reactive wrapper around the saved-places adapter. Mount-only read
 * (saved places don't change behind this screen's back the way a
 * contact set in a pushed-over flow does). Loading is owned by
 * useHydratedState; write methods mirror the adapter into local state.
 */
export function useSavedPlaces(): SavedPlacesState {
  const hydrated = useHydratedState<SavedPlace[]>(getSavedPlaces, {
    mountOnly: true,
  });

  const addSavedPlace = useCallback<SavedPlacesWrites['addSavedPlace']>(
    async (input) => {
      const place = await addSavedPlaceToStore(input);
      // Mirror the adapter's one-home-at-a-time invariant in local state.
      hydrated.setData((prev) => {
        const base = prev ?? [];
        const filtered =
          input.kind === 'home' ? base.filter((p) => p.kind !== 'home') : base;
        return [...filtered, place];
      });
      return place;
    },
    [hydrated.setData],
  );

  const removeSavedPlace = useCallback(async (id: string) => {
    await removeSavedPlaceFromStore(id);
    hydrated.setData((prev) => (prev ?? []).filter((p) => p.id !== id));
  }, [hydrated.setData]);

  const clearAll = useCallback(async () => {
    await clearSavedPlacesFromStore();
    hydrated.setData([]);
  }, [hydrated.setData]);

  if (!hydrated.ready) {
    return { ready: false, addSavedPlace, removeSavedPlace, clearAll };
  }
  const savedPlaces = hydrated.data;
  const home = savedPlaces.find((p) => p.kind === 'home') ?? null;
  return { ready: true, savedPlaces, home, addSavedPlace, removeSavedPlace, clearAll };
}
```

Adaptation note: the `prev ?? []` guards exist because the primitive's internal sentinel is `undefined` (the original hook initialised to `[]`). Post-`ready` the value is always the loaded array, so the guards are dead-but-safe; they only matter if a write somehow fires pre-`ready` (it can't from a gated screen). `clearAll` resets to `[]` instead of the prior implicit empty — behaviourally identical (the screen shows its empty state).

- [ ] **Step 2: Gate `app/saved-places.tsx`** (flash-gate)

The screen destructures `const { savedPlaces, removeSavedPlace } = useSavedPlaces();` (around line 43) and renders `savedPlaces.length === 0 ? <empty> : <RowGroup>…</RowGroup>` inside the `ScrollView`.

Change the destructure to bind through `ready`:

```tsx
const savedPlacesState = useSavedPlaces();
const { removeSavedPlace } = savedPlacesState;
const savedPlaces = savedPlacesState.ready ? savedPlacesState.savedPlaces : [];
```

Then gate the empty-vs-list decision so neither shows until ready (header still renders — chrome). Wrap the existing conditional:

```tsx
{savedPlacesState.ready
  ? savedPlaces.length === 0
    ? (
      <View style={styles.emptyState}>
        {/* …existing empty-state copy, unchanged… */}
      </View>
    )
    : (
      <RowGroup>
        {/* …existing rows, unchanged… */}
      </RowGroup>
    )
  : null}
```

`handleRemove` is unchanged (`removeSavedPlace` is a write method, available regardless of `ready`).

- [ ] **Step 3: Mechanical narrow — `app/home.tsx:335`**

Before:
```tsx
const { home, addSavedPlace } = useSavedPlaces();
```
After:
```tsx
const savedPlacesState = useSavedPlaces();
const { addSavedPlace } = savedPlacesState;
const home = savedPlacesState.ready ? savedPlacesState.home : null;
```
Everything downstream that reads `home` (the home marker) is unchanged — during the brief load `home` is `null`, exactly as before (the marker simply doesn't render until data lands).

- [ ] **Step 4: Mechanical narrow — `app/search.tsx:235`**

Before:
```tsx
const { savedPlaces } = useSavedPlaces();
```
After:
```tsx
const savedPlacesState = useSavedPlaces();
const savedPlaces = savedPlacesState.ready ? savedPlacesState.savedPlaces : [];
```
Downstream reads of `savedPlaces` are unchanged (empty during load, as before).

- [ ] **Step 5: Confirm `app/menu.tsx` needs no change**

`menu.tsx:113` reads only `const { clearAll: clearSavedPlaces } = useSavedPlaces();` — a write method, intersected outside the union, available on both branches. Verify by `tsc` (next step); make no edit.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0. If `menu.tsx` errors, the write-method intersection is wrong in Step 1 — fix the hook type, not menu.

- [ ] **Step 7: Commit**

```bash
git add hooks/useSavedPlaces.ts app/saved-places.tsx app/home.tsx app/search.tsx
git commit -m "refactor(saved-places): migrate useSavedPlaces to useHydratedState

Breaking discriminated-union return. saved-places gets the deliberate
flash-gate (no empty-state flash on cold launch); home + search get
mechanical narrows (compile-only, behavior unchanged). menu is
write-only (clearAll) and compiles untouched."
```

---

## Task 3: `usePreferences` + its callers

**Files:**
- Modify: `hooks/usePreferences.ts`
- Modify (flash-gate): `app/zone-preferences.tsx`
- Modify (mechanical narrow): `app/home.tsx:334`, `app/en-route.tsx:373`
- Untouched: `app/menu.tsx:115` (`clearAll` only); `components/zoneCategoryContent.ts` (no hook call)

- [ ] **Step 1: Refactor the hook**

Replace `hooks/usePreferences.ts` with:

```ts
import { useCallback } from 'react';

import {
  clearStoredPreferences,
  DEFAULT_PREFERENCES,
  getStoredPreferences,
  setStoredPreferences,
  type Preferences,
} from '../lib/api/preferences';
import { useHydratedState } from './useHydratedState';

type PreferencesWrites = {
  setShowZones: (next: boolean) => void;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  clearAll: () => Promise<void>;
};

export type PreferencesState = PreferencesWrites &
  ({ ready: false } | { ready: true; preferences: Preferences });

/**
 * Reactive wrapper around the preferences adapter. Re-reads on focus
 * (default) so a toggle made in /menu surfaces on the screens it was
 * pushed over (/home, /en-route). getStoredPreferences always returns a
 * complete object (merged with DEFAULT_PREFERENCES), so the ready branch
 * never needs per-key `?? default` fallbacks.
 */
export function usePreferences(): PreferencesState {
  const hydrated = useHydratedState<Preferences>(getStoredPreferences);

  const setShowZones = useCallback((next: boolean) => {
    hydrated.setData((prev) => {
      const merged: Preferences = { ...(prev ?? DEFAULT_PREFERENCES), showZones: next };
      void setStoredPreferences(merged);
      return merged;
    });
  }, [hydrated.setData]);

  const setPreference = useCallback<PreferencesWrites['setPreference']>(
    (key, value) => {
      hydrated.setData((prev) => {
        const merged: Preferences = { ...(prev ?? DEFAULT_PREFERENCES), [key]: value };
        void setStoredPreferences(merged);
        return merged;
      });
    },
    [hydrated.setData],
  );

  // Sign-out / factory reset. The union can't represent "null preferences",
  // so reset to DEFAULT_PREFERENCES — behaviourally identical to the prior
  // null-then-refetch (consumers saw defaults either way), and avoids a
  // transient null.
  const clearAll = useCallback(async () => {
    await clearStoredPreferences();
    hydrated.setData(DEFAULT_PREFERENCES);
  }, [hydrated.setData]);

  if (!hydrated.ready) {
    return { ready: false, setShowZones, setPreference, clearAll };
  }
  return { ready: true, preferences: hydrated.data, setShowZones, setPreference, clearAll };
}
```

- [ ] **Step 2: Gate `app/zone-preferences.tsx`** (flash-gate)

Current destructure (line 33) and the `?? false / ?? true` ladder (lines 39–42) are the loading-compensation the narrow replaces. Change to:

```tsx
const prefsState = usePreferences();
const { setShowZones, setPreference } = prefsState;
```

Delete lines 39–42 (the `showZones`/`flagPolice`/`flagLowLight`/`flagCommunityReports` derived consts). Gate the `ScrollView` body on `ready`; read directly off `prefsState.preferences` inside the gate:

```tsx
<ScrollView
  contentContainerStyle={styles.scrollContent}
  showsVerticalScrollIndicator={false}
>
  {prefsState.ready && (
    <>
      <RowGroup>
        <SettingsRow
          label="Show zones overlay"
          trailing="toggle"
          toggleValue={prefsState.preferences.showZones}
          onToggle={setShowZones}
          accessibilityHint="Shows or hides the zone safety overlay on the map"
        />
      </RowGroup>

      <RowGroup title="What we flag" footer="Affects route scoring and map flags.">
        <SettingsRow
          label="Police presence"
          trailing="toggle"
          toggleValue={prefsState.preferences.flagPolice}
          onToggle={(v) => setPreference('flagPolice', v)}
          accessibilityHint="Routes around mapped police presence when on"
        />
        <SettingsRow
          label="Low-light areas"
          trailing="toggle"
          toggleValue={prefsState.preferences.flagLowLight}
          onToggle={(v) => setPreference('flagLowLight', v)}
          accessibilityHint="Routes around poorly-lit streets when on"
        />
        <SettingsRow
          label="Community reports"
          trailing="toggle"
          toggleValue={prefsState.preferences.flagCommunityReports}
          onToggle={(v) => setPreference('flagCommunityReports', v)}
          accessibilityHint="Factors neighbor-submitted reports when on"
        />
      </RowGroup>
    </>
  )}
</ScrollView>
```

- [ ] **Step 3: Mechanical narrow — `app/home.tsx:334`**

Before:
```tsx
const { preferences } = usePreferences();
```
After:
```tsx
const prefsState = usePreferences();
const preferences = prefsState.ready ? prefsState.preferences : null;
```
Downstream reads of `preferences` (e.g. `preferences?.showZones`) keep their optional chaining; during load `preferences` is `null`, which the existing `?.` already tolerated.

- [ ] **Step 4: Mechanical narrow — `app/en-route.tsx:373`**

Same transform:
```tsx
const prefsState = usePreferences();
const preferences = prefsState.ready ? prefsState.preferences : null;
```
Verify the en-route reads of `preferences` use optional access; if any read `preferences.x` non-optionally, add `?.` (these are display-only reads of `showZones`/flag fields — null during load is the same as the prior pre-hydrate state).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0. `menu.tsx:115` (`clearAll`) and `zoneCategoryContent.ts` (no hook call) need no edit — confirm via tsc.

- [ ] **Step 6: Commit**

```bash
git add hooks/usePreferences.ts app/zone-preferences.tsx app/home.tsx app/en-route.tsx
git commit -m "refactor(preferences): migrate usePreferences to useHydratedState

Breaking union. zone-preferences gets the flash-gate and drops its
?? default ladder (getStoredPreferences always returns a complete
object). home + en-route get mechanical narrows. menu (write-only) and
zoneCategoryContent (no hook call) untouched."
```

---

## Task 4: `useShareSession` + its callers (first safety-critical wave)

**Files:**
- Modify: `hooks/useShareSession.ts`
- Modify (flash-gate): `app/share-location.tsx`
- Modify (mechanical narrow): `app/en-route.tsx:465`, `app/unfamiliar.tsx:85`, `app/safety.tsx:111`, `components/LiveSafetySheet.tsx:53`

- [ ] **Step 1: Refactor the hook**

In `hooks/useShareSession.ts`, replace the `useState(session)` + `useFocusEffect` read block (lines ~36–53) with the primitive, and re-shape the return. Keep `openSmsForSession`, `startSession`, `resendSessionSms`, `endSession` logic; route their `setSession(...)` calls through `hydrated.setData(...)`. New shape:

```ts
import { useCallback } from 'react';

import { getTrustedContact } from '../lib/api/trusted-contact';
import {
  clearStoredShareSession,
  getStoredShareSession,
  type ShareSession,
  type ShareSessionType,
  setStoredShareSession,
} from '../lib/api/share-session';
import {
  notifyTrustedContact,
  readNotifyCoordinates,
  type NotifyTrustedContactInput,
} from '../lib/notify-trusted-contact';
import { useHydratedState } from './useHydratedState';

export type StartShareSessionInput = {
  type: ShareSessionType;
  reason: string;
  locationLabel?: string;
  coordinates?: { latitude: number; longitude: number };
};

type ShareSessionWrites = {
  startSession: (input: StartShareSessionInput) => Promise<ShareSession>;
  resendSessionSms: (
    extras?: Pick<NotifyTrustedContactInput, 'locationLabel' | 'coordinates'>,
  ) => Promise<void>;
  endSession: () => Promise<void>;
};

export type ShareSessionState = ShareSessionWrites &
  ({ ready: false } | { ready: true; session: ShareSession | null });
```

Then in the function: `const hydrated = useHydratedState<ShareSession | null>(getStoredShareSession);`. Replace each `setSession(x)` with `hydrated.setData(x)`. `resendSessionSms` reads the current session — it can no longer close over a `session` state var, so read it from `hydrated`:

```ts
const resendSessionSms = useCallback(
  async (extras) => {
    const current = hydrated.ready ? hydrated.session : null;
    if (!current) return;
    await openSmsForSession(current, extras);
  },
  [hydrated, openSmsForSession],
);
```
(Where `hydrated.ready ? hydrated.session : null` reads the union; note the primitive returns `data`, so inside this hook it's `hydrated.ready ? hydrated.data : null`.)

`endSession` → `hydrated.setData(null)`. Return:

```ts
if (!hydrated.ready) {
  return { ready: false, startSession, resendSessionSms, endSession };
}
return { ready: true, session: hydrated.data, startSession, resendSessionSms, endSession };
```

`openSmsForSession` and `startSession` keep their bodies; replace their `setSession` calls with `hydrated.setData`.

- [ ] **Step 2: Gate `app/share-location.tsx`** (flash-gate)

Current (lines 46, 50, 91): `const { session, startSession, endSession, resendSessionSms } = useShareSession();`, `const isActive = session?.type === 'share-location';`, render `{isActive && session ? <ActiveView/> : <ReasonPicker/>}`.

Change to bind through `ready` and gate the picker-vs-active branch so neither shows until ready (prevents the picker flashing before an active session resolves):

```tsx
const shareState = useShareSession();
const { startSession, endSession, resendSessionSms } = shareState;
const session = shareState.ready ? shareState.session : null;
const isActive = session?.type === 'share-location';
```
In the render, gate the branch:
```tsx
{shareState.ready
  ? isActive && session
    ? <ActiveView {/* …unchanged props… */} />
    : <ReasonPicker {/* …unchanged props… */} />
  : null}
```
(`share-location` also reads `useTrustedContact` at line 47 — that is migrated in Task 5, not here. Leave line 47 as-is for now; it still compiles because `useTrustedContact` is unchanged until Task 5.)

- [ ] **Step 3: Mechanical narrows**

`app/en-route.tsx:465` — before `const { session: shareSession } = useShareSession();`:
```tsx
const shareState = useShareSession();
const shareSession = shareState.ready ? shareState.session : null;
```

`app/unfamiliar.tsx:85` (multi-line destructure of `useShareSession()`) — bind through ready; whatever names it pulled (e.g. `session`, `startSession`, `endSession`) split into writes (kept) + `session` (narrowed):
```tsx
const shareState = useShareSession();
const session = shareState.ready ? shareState.session : null;
const { startSession, endSession /* …whatever it used… */ } = shareState;
```

`app/safety.tsx:111` — before `const { session } = useShareSession();`:
```tsx
const shareState = useShareSession();
const session = shareState.ready ? shareState.session : null;
```

`components/LiveSafetySheet.tsx:53` — before `const { session, endSession, resendSessionSms } = useShareSession();`:
```tsx
const shareState = useShareSession();
const { endSession, resendSessionSms } = shareState;
const session = shareState.ready ? shareState.session : null;
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add hooks/useShareSession.ts app/share-location.tsx app/en-route.tsx app/unfamiliar.tsx app/safety.tsx components/LiveSafetySheet.tsx
git commit -m "refactor(share-session): migrate useShareSession to useHydratedState

Breaking union. share-location gets the flash-gate (picker no longer
flashes before an active session resolves); en-route, unfamiliar,
safety, LiveSafetySheet get mechanical narrows (behavior unchanged).
First safety-critical wave — re-verify per the plan checklist."
```

---

## Task 5: `useTrustedContact` + its callers (highest blast)

**Files:**
- Modify: `hooks/useTrustedContact.ts`
- Modify (flash-gate): `app/safety-settings.tsx` (per-row), `app/trusted-contact-setup.tsx` (per-section + animation guard)
- Modify (mechanical narrow): `app/share-location.tsx:47`, `app/home.tsx:343`, `app/en-route.tsx:466`, `app/unfamiliar.tsx:86`, `app/safety.tsx:110`, `app/emergency.tsx:77`, `app/pulled-over.tsx:194` & `:944`, `app/roadside.tsx:313` & `:480`, `components/LiveSafetySheet.tsx:54`
- Untouched (write-only): `app/menu.tsx:112` (`clearContact` only)

- [ ] **Step 1: Refactor the hook**

In `hooks/useTrustedContact.ts`, keep `tryCaptureContactLocation` verbatim. Replace the `useState(contact)` + `useFocusEffect` read block (lines ~89–112) with the primitive; re-shape the return. New shape + body:

```ts
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import { useCallback } from 'react';

import {
  clearTrustedContact,
  deriveContactInitials,
  deriveContactName,
  getTrustedContact,
  pickPrimaryPhoneNumber,
  setTrustedContact,
  type TrustedContact,
} from '../lib/api/trusted-contact';
import { useHydratedState } from './useHydratedState';

// …tryCaptureContactLocation unchanged…

type TrustedContactWrites = {
  pickContact: () => Promise<TrustedContact | null>;
  clearContact: () => Promise<void>;
};

export type TrustedContactState = TrustedContactWrites &
  ({ ready: false } | { ready: true; contact: TrustedContact | null });

export function useTrustedContact(): TrustedContactState {
  const hydrated = useHydratedState<TrustedContact | null>(getTrustedContact);

  const pickContact = useCallback(async (): Promise<TrustedContact | null> => {
    const picked = await Contacts.presentContactPickerAsync();
    if (!picked) return null;
    const phoneNumber = pickPrimaryPhoneNumber(picked.phoneNumbers);
    if (!phoneNumber) {
      throw new Error(
        'Selected contact has no phone number. Pick a different contact.',
      );
    }
    const name = deriveContactName(
      picked.name, picked.firstName, picked.lastName, phoneNumber,
    );
    const location = await tryCaptureContactLocation(picked.id);
    const stored = await setTrustedContact({
      id: picked.id,
      name,
      initials: deriveContactInitials(name, picked.firstName, picked.lastName),
      phoneNumber,
      setAt: Date.now(),
      latitude: location?.latitude,
      longitude: location?.longitude,
      addressLabel: location?.addressLabel,
    });
    hydrated.setData(stored);
    return stored;
  }, [hydrated.setData]);

  const clearContact = useCallback(async () => {
    await clearTrustedContact();
    hydrated.setData(null);
  }, [hydrated.setData]);

  if (!hydrated.ready) {
    return { ready: false, pickContact, clearContact };
  }
  return { ready: true, contact: hydrated.data, pickContact, clearContact };
}
```

- [ ] **Step 2: Gate `app/safety-settings.tsx`** (per-row — SOS + recordings rows stay static)

Line 38: `const { contact } = useTrustedContact();`. The contact value (lines 42–48) must not show its `'Add someone you trust'` placeholder during hydration. Change to:

```tsx
const contactState = useTrustedContact();
const trustedContactName = contactState.ready
  ? contactState.contact?.name?.trim()
  : undefined;
const trustedContactValue = contactState.ready
  ? (trustedContactName ?? 'Add someone you trust')
  : undefined; // hydrating → no value text (row shows label + chevron only)
```

The Trusted Contact `<SettingsRow>` already accepts an optional `value` (the Recordings row passes none). While `!ready`, `value={undefined}` renders the row without the placeholder — the SOS and Recordings rows render instantly, unaffected. No other change.

- [ ] **Step 3: Gate `app/trusted-contact-setup.tsx`** (per-section + animation guard)

Line 74: `const { contact, loading: contactLoading, pickContact } = useTrustedContact();`. Bind through `ready` (the animation `useEffect` at lines 93–117 reads the old `contactLoading` and `contact?.id` and must keep running above any conditional return):

```tsx
const contactState = useTrustedContact();
const contactReady = contactState.ready;
const contact = contactState.ready ? contactState.contact : null;
const { pickContact } = contactState;
```

In the animation effect, replace `if (contactLoading) return;` (line 94) with `if (!contactReady) return;`, and update the dependency array (line 117) from `contactLoading` to `contactReady`:
```tsx
}, [contact?.id, contactReady, reduceMotion, avatarScale]);
```

Then gate the preview-vs-empty block (the render at line 198, `{contact ? <preview> : <empty>}`) so neither shows until ready — the static title/body copy above it still renders (chrome):

```tsx
{contactReady ? (
  contact ? (
    <View style={[styles.preview, embedded && stylesWhite.preview]}>
      {/* …existing preview, unchanged… */}
    </View>
  ) : (
    <View /* …existing empty/EmptyState block, unchanged… */ />
  )
) : null}
```

`handlePickContact`, `handleContinue`, `handleSkip` are unchanged.

- [ ] **Step 4: Mechanical narrows (the remaining callers)**

Apply the same transform — bind through `ready`, keep write methods via destructure — to each:

- `app/share-location.tsx:47` — `const { contact } = useTrustedContact();` →
  ```tsx
  const contactState = useTrustedContact();
  const contact = contactState.ready ? contactState.contact : null;
  ```
- `app/home.tsx:343` — `const { contact: trustedContact } = useTrustedContact();` →
  ```tsx
  const trustedContactState = useTrustedContact();
  const trustedContact = trustedContactState.ready ? trustedContactState.contact : null;
  ```
- `app/en-route.tsx:466` — `const { contact: trustedContact } = useTrustedContact();` → same as home.
- `app/unfamiliar.tsx:86` — `const { contact } = useTrustedContact();` → share-location form.
- `app/safety.tsx:110` — `const { contact } = useTrustedContact();` → share-location form.
- `app/emergency.tsx:77` — `const { contact } = useTrustedContact();` → share-location form.
- `app/pulled-over.tsx:194` — `const { contact } = useTrustedContact();` → share-location form.
- `app/pulled-over.tsx:944` — `const { contact, pickContact } = useTrustedContact();` →
  ```tsx
  const contactState = useTrustedContact();
  const { pickContact } = contactState;
  const contact = contactState.ready ? contactState.contact : null;
  ```
- `app/roadside.tsx:313` and `:480` — `const { contact } = useTrustedContact();` → share-location form (two separate components in the file; apply to each).
- `components/LiveSafetySheet.tsx:54` — `const { contact } = useTrustedContact();` → share-location form.

In every case, downstream reads (`contact?.name`, `contact?.latitude`, `trustedContact?.…`) are unchanged — `null` during the brief load is the same value these sites already handled.

- [ ] **Step 5: Confirm `app/menu.tsx` needs no change**

`menu.tsx:112` reads only `const { clearContact } = useTrustedContact();` — write-only, intersected. No edit; verify via tsc.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add hooks/useTrustedContact.ts app/safety-settings.tsx app/trusted-contact-setup.tsx app/share-location.tsx app/home.tsx app/en-route.tsx app/unfamiliar.tsx app/safety.tsx app/emergency.tsx app/pulled-over.tsx app/roadside.tsx components/LiveSafetySheet.tsx
git commit -m "refactor(trusted-contact): migrate useTrustedContact to useHydratedState

Breaking union — highest blast (12 callers). safety-settings (per-row)
and trusted-contact-setup (per-section + animation guard) get deliberate
flash-gates; the rest get mechanical narrows. emergency/pulled-over/
en-route/unfamiliar/safety re-verified against Phase 1 baselines.
menu (write-only clearContact) untouched. Completes the 4-hook
migration; useRecordings remains the lone legacy-shaped holdout (PR #3)."
```

---

## Task 6: Final verification + PR

**Files:** none (verification + git)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 2: Confirm scope discipline**

Run: `git diff --name-only main...HEAD | sort`
Expected: the new primitive, 4 hooks, 5 flash-gate screens, the mechanical-narrow callers — and NOT `hooks/useRecordings.ts` or `app/recordings.tsx`. `app/menu.tsx` should also be absent (write-only).

- [ ] **Step 3: Manual smoke — flash-gate screens (data present)**

On a sim/device with stored data, cold-launch each and confirm NO empty-state flash:
- `saved-places` (with ≥1 saved place), `zone-preferences`, `share-location` (with an active session — picker must not flash), `trusted-contact-setup` (with a contact — "No contact set yet." must not flash), `safety-settings` ("Add someone you trust" must not flash when a contact is set).

- [ ] **Step 4: Manual smoke — flash-gate screens (data absent)**

Clear stored data; confirm each renders its empty state correctly (not a flash, not a hang).

- [ ] **Step 5: Refocus + animation walks**

- Set a contact in `trusted-contact-setup`, pop back to `safety-settings` → name appears immediately, no "Add someone you trust" flicker.
- In `trusted-contact-setup`, confirm the avatar spring fires on a genuine unset→set pick, and does NOT fire when opening the screen with a pre-existing contact.

- [ ] **Step 6: Safety-critical re-verify (behavior identical to Phase 1)**

Walk `emergency`, `pulled-over`, `en-route`, `unfamiliar`, `safety` — each must render and behave exactly as before. The mechanical narrow changed only how the contact/session/preferences are read, not what's shown. Spot-check: SOS countdown, the pulled-over contact phase, en-route hazard panel, unfamiliar destination flow, the safety picker.

- [ ] **Step 7: Open the PR**

```bash
git push -u origin feat/use-hydrated-state
gh pr create --title "refactor(hooks): useHydratedState — kill the loading-flash class of bug" --body "Implements docs/superpowers/specs/2026-06-19-use-hydrated-state-design.md (Phase 2 Sprint 1 PR #1).

Migrates useSavedPlaces / usePreferences / useShareSession / useTrustedContact to a discriminated-union loading primitive so reading a hydrated value without narrowing on \`ready\` is a compile error — the cold-launch empty-state flash becomes structurally impossible, codebase-wide. 5 screens get deliberate flash-gates; ~9 other callers get mechanical narrows (compile-only, behavior unchanged). menu (write-only) and recordings (deferred to PR #3) untouched.

Verification: tsc clean after each hook+callers commit; manual smoke on the 5 flash-gate screens; safety-critical screens (emergency/pulled-over/en-route/unfamiliar/safety) re-verified against Phase 1 baselines.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review

**1. Spec coverage.**
- Primitive (discriminated union, refocus default, `mountOnly`, `ready` latch, stable-`read`) → Task 1. ✓
- 4 hooks breaking union → Tasks 2–5. ✓
- 5 flash-gates (per-section/per-row, animation guard) → saved-places (T2), zone-preferences (T3), share-location (T4), safety-settings + trusted-contact-setup (T5). ✓
- ~9 mechanical narrows → T2–T5. ✓
- menu write-only exemption, zoneCategoryContent no-call exemption → noted in T2/T3/T5. ✓
- recordings deferred → excluded everywhere; asserted in T6 Step 2. ✓
- Atomic-commit constraint (hook + callers per commit, low-blast-first) → Tasks 2→5 ordering. ✓
- tsc + manual smoke + safety re-verify → T6. ✓

**2. Placeholder scan.** No TBD/TODO. The `/* …unchanged… */` markers denote verbatim-preserved existing blocks (the instruction is "keep as-is"), not gaps. Every code step shows the actual new code.

**3. Type consistency.** `useHydratedState<T>` returns `{ ready } & { setData }`; domain hooks consume `hydrated.ready`/`hydrated.data`/`hydrated.setData` (the primitive's field is `data`, re-exposed under domain names `savedPlaces`/`preferences`/`session`/`contact`). Write methods are intersected outside every union (enables the menu/home/LiveSafetySheet write-only compiles). State type names (`SavedPlacesState`, `PreferencesState`, `ShareSessionState`, `TrustedContactState`) are consistent between their hook definitions and the screens that bind them. `clearAll` resets to empty/`DEFAULT_PREFERENCES` (not null) — noted as a deliberate, behaviour-preserving adaptation in T2/T3.

One watch item flagged for the implementer: in `useShareSession.resendSessionSms`, the current value is read via `hydrated.ready ? hydrated.data : null` (the primitive exposes `data`, not the domain name) — do not write `hydrated.session`.
