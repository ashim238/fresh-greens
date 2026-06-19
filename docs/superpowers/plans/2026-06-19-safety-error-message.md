# SafetyErrorMessage + useHydratedResource Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make error copy a shared resource the codebase reads from (not a string each screen writes by hand), introduce a 3-state read primitive for hooks whose reads can throw, migrate `useRecordings` through the new primitive, and sweep every existing "try again" site to the new taxonomy. Brand voice changes happen in one file forever.

**Architecture:** Four new pieces compose a-la-carte: (1) `useHydratedResource<T>` — a sibling primitive to PR #1's `useHydratedState`, modelling the loading + error + ready 3-state union; (2) `lib/error-copy.ts` — the exhaustive `(domain × disposition) → { title, body }` table; (3) `lib/error-message.ts` — `getErrorMessage(d, dp, error?)` pure function that reads the table and emits a canonical `[domain:disposition]` debug log; (4) `<SafetyErrorMessage>` — ~30 LOC inline JSX wrapper. `useRecordings` refactors to compose `useHydratedResource` (reads) + `useMutation` (writes); 24 Group A sites migrate to the new copy source; 2 Group B silent sites become user-visible.

**Tech Stack:** React Native + Expo, expo-router (`useFocusEffect`), TypeScript, AsyncStorage. No test runner — verification is `npx tsc --noEmit` + manual device/sim smoke (project norm matches PR #1 / PR #2).

**Spec:** [`docs/superpowers/specs/2026-06-19-safety-error-message-design.md`](../specs/2026-06-19-safety-error-message-design.md)

---

## File Structure

- **`hooks/useHydratedResource.ts`** — **new.** Sibling to `useHydratedState`. 3-state discriminated union. Composes `useEffect`/`useFocusEffect` + cancelled + mounted guards (same pattern as PR #1). One responsibility: turn an async reader that can throw into `{ ready } & { ok } & { setData }`.
- **`lib/error-copy.ts`** — **new.** Pure data: the `ERROR_COPY` table. Strings only, no logic.
- **`lib/error-message.ts`** — **new.** `getErrorMessage(domain, disposition, error?)` + the `ErrorDomain` / `ErrorDisposition` / `ErrorCopy` types. One file: types + function + the table re-export.
- **`components/SafetyErrorMessage.tsx`** — **new.** ~30 LOC. Inline error surface. Reads `getErrorMessage`'s body, renders with `footnoteRegular + colors.red + centered`.
- **`hooks/useRecordings.ts`** — **modify.** Refactors to compose `useHydratedResource` + `useMutation`. Exposes `RecordingsState` discriminated union and `add` / `remove` mutation objects. Per-call exact-id reconciliation for `add`.
- **Caller files (24 Group A + 2 Group B + 2 useRecordings consumers + 1 banner)** — see per-task lists.

### The atomic-commit constraint (revised for PR #3)

Group A migrations are mostly *string substitutions* — they don't break tsc between files. The atomic-commit-per-hook rule from PR #1/#2 relaxes here. Tasks 4-7 each pick a single domain (`sharing`, `save`, `load`, `auth+contact+report`) so each commit is a clean reviewable unit by topic, not by tsc-greenness constraint. Task 8 (`useRecordings`) reverts to the strict atomic-commit shape — that one IS a breaking-union change for its 2 callers.

---

## Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create the feature branch off main**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/safety-error-message
```

- [ ] **Step 2: Confirm clean tsc baseline**

Run: `npx tsc --noEmit`
Expected: exits 0.

---

## Task 1: The `useHydratedResource` primitive

**Files:**
- Create: `hooks/useHydratedResource.ts`

- [ ] **Step 1: Write the primitive**

Create `hooks/useHydratedResource.ts` with exactly:

```ts
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Discriminated-result async-read primitive — sibling to useHydratedState
 * for reads that can MEANINGFULLY THROW. Three-state union:
 *
 *   { ready: false }                              // still loading
 *   { ready: true; ok: false; error: Error }      // loaded, but failed
 *   { ready: true; ok: true; data: T }            // loaded fine
 *
 * Use this for hooks whose reader can throw (storage corrupt, quota
 * exceeded, network-backed in the future). Use useHydratedState for
 * reads that always return a default (preferences, savedPlaces, etc.).
 *
 * Like useHydratedState:
 * - setData intersected outside the union (always callable, on every
 *   branch, so a composing mutation hook can do optimistic updates
 *   regardless of whether the read itself has settled or errored).
 * - Refocus-aware by default; { mountOnly: true } opt-out.
 * - `ready` latches false → true once. Once hydration settles it never
 *   re-enters the loading branch on refocus.
 *
 * Different from useHydratedState:
 * - `ok` can flip true ↔ false on refocus. A retry might succeed where
 *   the first read failed, or vice versa. The error branch is not sticky.
 *
 * `read` MUST be a stable reference (module-level adapter function or a
 * useCallback'd closure). It's an effect dependency.
 */
export type HydratedResource<T> =
  | { ready: false }
  | { ready: true; ok: false; error: Error }
  | { ready: true; ok: true; data: T };

export function useHydratedResource<T>(
  read: () => Promise<T>,
  options?: { mountOnly?: boolean },
): HydratedResource<T> & { setData: Dispatch<SetStateAction<T>> } {
  const mountOnly = options?.mountOnly ?? false;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(true); // meaningful only when ready === true

  // Mounted guard — state setters no-op after unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runRead = useCallback(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await read();
        if (cancelled || !mountedRef.current) return;
        // setData + setOk + setReady are batched into one render (React
        // 18+ automatic batching inside async callbacks), so a consumer
        // never observes ready:true with data still undefined.
        setData(result);
        setError(null);
        setOk(true);
        setReady(true);
      } catch (raw) {
        if (cancelled || !mountedRef.current) return;
        const err =
          raw instanceof Error ? raw : new Error(String(raw));
        setError(err);
        setOk(false);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [read]);

  // Both effects always called (rules-of-hooks); the unused one no-ops
  // via early return inside its body.
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
  if (!ok) {
    return {
      ready: true,
      ok: false,
      error: error as Error,
      setData: stableSetData,
    };
  }
  return {
    ready: true,
    ok: true,
    data: data as T,
    setData: stableSetData,
  };
}
```

Note on casts: `data as T` and `error as Error` are sound because both are only reachable on their respective `ready: true` branches, and both are only set inside the same async `try`/`catch` block that flips `ready` — React 18 batching guarantees no interleaved render. `setData as Dispatch<SetStateAction<T>>` narrows the caller-facing setter type; internally the state holds `T | undefined`, a superset.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0. Pure-additive.

- [ ] **Step 3: Commit**

```bash
git add hooks/useHydratedResource.ts
git commit -m "feat(hooks): add useHydratedResource primitive

Sibling to useHydratedState for reads that can meaningfully throw.
Three-state discriminated union (loading / errored / ok) forces
consumers to handle both narrows before reaching data. setData
intersected outside the union as in PR #1; refocus default; ready
latches once; ok can flip on refocus (errors are not sticky).
Pure-additive — no consumers yet.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: error-copy table + getErrorMessage + SafetyErrorMessage

**Files:**
- Create: `lib/error-copy.ts`
- Create: `lib/error-message.ts`
- Create: `components/SafetyErrorMessage.tsx`

- [ ] **Step 1: Write the copy table**

Create `lib/error-copy.ts`:

```ts
import type { ErrorCopy, ErrorDisposition, ErrorDomain } from './error-message';

/**
 * Canonical (domain × disposition) → { title, body } table. The single
 * source of truth for every user-facing error string in the app.
 *
 * Brand voice: Steady Companion — calm, grounded, no exclamation
 * points, no "Oops!" or "Whoops!", no performative apologies. Make a
 * statement of fact and offer a next step.
 *
 * `null` slots are silent dispositions (cancelled across all domains;
 * a few domain × disposition pairs that don't exist semantically).
 * getErrorMessage degrades gracefully to empty strings for those.
 *
 * To adjust copy: edit this file. All ~24 caller sites pick up the
 * change next render.
 */
export const ERROR_COPY: Record<
  ErrorDomain,
  Record<ErrorDisposition, ErrorCopy | null>
> = {
  recordings: {
    transient:     { title: "Couldn't save your recording",  body: 'Try again in a moment.' },
    permanent:     { title: "Couldn't start recording",       body: 'Try a different microphone or restart the app.' },
    'needs-setup': null,
    cancelled:     null,
  },
  sharing: {
    transient:     { title: "Couldn't start sharing",         body: 'Try again in a moment.' },
    permanent:     { title: 'Sharing unavailable',            body: "We can't reach your trusted contact right now." },
    'needs-setup': { title: 'No trusted contact yet',         body: 'Set one up to share your location.' },
    cancelled:     null,
  },
  contact: {
    transient:     { title: "Couldn't pick a contact",        body: 'Try again.' },
    permanent:     { title: "That contact won't work",        body: 'They need a phone number we can text and call.' },
    'needs-setup': { title: 'No trusted contact yet',         body: 'Set one up first to call or text from here.' },
    cancelled:     null,
  },
  report: {
    transient:     { title: "Couldn't send your report",      body: 'Try again.' },
    permanent:     { title: 'Report unavailable',             body: "We can't send this one." },
    'needs-setup': null,
    cancelled:     null,
  },
  save: {
    transient:     { title: "Couldn't save",                  body: 'Try again in a moment.' },
    permanent:     { title: "Couldn't save",                  body: "We can't recover this one." },
    'needs-setup': null,
    cancelled:     null,
  },
  load: {
    transient:     { title: "Couldn't load",                  body: 'Reopen this screen to try again.' },
    permanent:     { title: 'Nothing to show',                body: "There's nothing matching here yet." },
    'needs-setup': null,
    cancelled:     null,
  },
  auth: {
    transient:     { title: 'Sign-in failed',                 body: 'Try again.' },
    permanent:     { title: "Can't sign in",                  body: 'Check your Apple ID and try again.' },
    'needs-setup': null,
    cancelled:     null,
  },
};
```

- [ ] **Step 2: Write `getErrorMessage` + types**

Create `lib/error-message.ts`:

```ts
import { ERROR_COPY } from './error-copy';

/**
 * The taxonomy. Two narrow axes — every error site picks one from each.
 *
 * Domain: WHAT failed (the subject of the error).
 * Disposition: HOW it failed (the retry posture).
 *
 * Adding a domain or disposition: edit both this union AND the table
 * in lib/error-copy.ts. TypeScript enforces every combination exists
 * (the table is keyed on the unions); the `null` sentinel handles
 * silent slots (cancelled, plus a few combinations that don't exist
 * semantically — e.g. report + needs-setup).
 */
export type ErrorDomain =
  | 'recordings'
  | 'sharing'
  | 'contact'
  | 'report'
  | 'save'
  | 'load'
  | 'auth';

export type ErrorDisposition =
  | 'transient'
  | 'permanent'
  | 'needs-setup'
  | 'cancelled';

export type ErrorCopy = { title: string; body: string };

/**
 * Pure function — no JSX, no React, callable from any handler.
 *
 * Emits one canonical [domain:disposition] debug log per failure,
 * replacing the ~20 ad-hoc `console.warn('[domain] xyz failed', err)`
 * patterns across the codebase.
 *
 * Silent dispositions (cancelled, undefined slots) return empty
 * strings — defensive, so a misuse degrades to a no-op surface
 * rather than throwing.
 */
export function getErrorMessage(
  domain: ErrorDomain,
  disposition: ErrorDisposition,
  error?: unknown,
): ErrorCopy {
  if (error !== undefined) {
    console.warn(`[${domain}:${disposition}]`, error);
  }
  const copy = ERROR_COPY[domain][disposition];
  return copy ?? { title: '', body: '' };
}
```

- [ ] **Step 3: Write the SafetyErrorMessage component**

Create `components/SafetyErrorMessage.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';

import {
  type ErrorDisposition,
  type ErrorDomain,
  getErrorMessage,
} from '../lib/error-message';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Inline error surface. Renders the body text from getErrorMessage,
 * styled to match the existing inline error pattern in /report
 * (footnoteRegular + colors.red + centered).
 *
 * The title is omitted in the inline case — the domain context is
 * usually visible at the call site (the user is on the form that
 * failed; they don't need a "Couldn't send your report" title AND
 * an inline body — just the body suffices).
 *
 * For modal cases use Alert.alert(...Object.values(getErrorMessage(...)));
 * for the persistent-banner case (P-C from PR #2) the
 * RecordingSaveErrorBanner composes getErrorMessage internally.
 *
 * Silent dispositions render nothing (defensive — guards against
 * accidental render of an inline cancelled surface).
 */
export function SafetyErrorMessage({
  domain,
  disposition,
  error,
}: {
  domain: ErrorDomain;
  disposition: ErrorDisposition;
  error?: unknown;
}) {
  const { body } = getErrorMessage(domain, disposition, error);
  if (!body) return null;
  return (
    <View style={styles.root}>
      <Text style={styles.text}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  text: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.red,
    textAlign: 'center',
  },
});
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0. All three files pure-additive.

- [ ] **Step 5: Commit**

```bash
git add lib/error-copy.ts lib/error-message.ts components/SafetyErrorMessage.tsx
git commit -m "feat(error): add error-copy taxonomy + getErrorMessage + SafetyErrorMessage

7 domains × 4 dispositions; ~18 real copy variants. Canonical source
of truth for every user-facing error string in the app — brand voice
changes happen here. getErrorMessage emits a unified [domain:disposition]
debug log replacing ~20 ad-hoc console.warn formats. SafetyErrorMessage
is a thin ~30 LOC JSX wrapper for the inline case, matching the existing
report.tsx pattern (footnoteRegular + colors.red + centered).

Pure-additive — no consumers yet.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Refactor RecordingSaveErrorBanner to use getErrorMessage

**Files:**
- Modify: `components/RecordingSaveErrorBanner.tsx`

The banner from PR #2 has its title hardcoded (`"Your recording didn't save."` at line 50). Refactor to read from the taxonomy. This is the smallest migration; proves `getErrorMessage` against PR #2's banner.

- [ ] **Step 1: Replace the hardcoded title**

Edit `components/RecordingSaveErrorBanner.tsx`:

Add the import (near existing imports):
```tsx
import { getErrorMessage } from '../lib/error-message';
```

Replace line ~50:
```tsx
<Text style={styles.message} numberOfLines={2}>
  Your recording didn't save.
</Text>
```

With:
```tsx
<Text style={styles.message} numberOfLines={2}>
  {getErrorMessage('recordings', 'transient').title}
</Text>
```

(The taxonomy's `recordings + transient` title is exactly "Couldn't save your recording" — slightly different wording from the original "Your recording didn't save." but semantically equivalent and on-brand.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/RecordingSaveErrorBanner.tsx
git commit -m "refactor(recording-banner): pull title copy from getErrorMessage

Replaces the hardcoded \"Your recording didn't save.\" with
getErrorMessage('recordings', 'transient').title (\"Couldn't save your
recording\"). Smallest migration — proves the taxonomy against PR #2's
persistent-banner surface.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Group A sharing-domain migrations

**Files:**
- Modify: `app/share-location.tsx`
- Modify: `app/unfamiliar.tsx`
- Modify: `components/LiveSafetySheet.tsx`

All three files have Alert.alert sites for sharing-session failures. Migrate each to use `getErrorMessage('sharing', 'transient')`.

- [ ] **Step 1: Migrate `app/share-location.tsx`**

Add import (near existing imports):
```tsx
import { getErrorMessage } from '../lib/error-message';
```

Replace the existing Alert at line ~72:
```tsx
if (!startResult.ok) {
  Alert.alert(
    "Couldn't start sharing",
    "We couldn't start the share session. Try again in a moment.",
  );
  return;
}
```

With:
```tsx
if (!startResult.ok) {
  const { title, body } = getErrorMessage('sharing', 'transient', startResult.error);
  Alert.alert(title, body);
  return;
}
```

Replace the existing Alert at line ~82:
```tsx
const endResult = await end.run();
if (!endResult.ok) {
  Alert.alert("Couldn't end sharing", 'Try again in a moment.');
  return;
}
```

With:
```tsx
const endResult = await end.run();
if (!endResult.ok) {
  const { title, body } = getErrorMessage('sharing', 'transient', endResult.error);
  Alert.alert(title, body);
  return;
}
```

- [ ] **Step 2: Migrate `app/unfamiliar.tsx`**

Add the same import.

Replace the start-session Alert at line ~108:
```tsx
if (!startResult.ok) {
  Alert.alert(
    "Couldn't start sharing",
    "We couldn't start the share session. Try again in a moment.",
  );
  return;
}
```

With:
```tsx
if (!startResult.ok) {
  const { title, body } = getErrorMessage('sharing', 'transient', startResult.error);
  Alert.alert(title, body);
  return;
}
```

Replace the end-session Alert at line ~158:
```tsx
Alert.alert("Couldn't end sharing", 'Try again in a moment.');
```

With:
```tsx
const { title: endTitle, body: endBody } = getErrorMessage('sharing', 'transient', endResult.error);
Alert.alert(endTitle, endBody);
```

Note: the destination-search failure at line ~150 (`'Could not search for nearby destinations. Try again in a moment.'`) is `load + transient`, NOT `sharing` — that one stays in this task too since we're already editing this file:

```tsx
const { title: searchTitle, body: searchBody } = getErrorMessage('load', 'transient', err);
Alert.alert(searchTitle, searchBody);
```

(Replace the corresponding existing Alert at line ~150.)

- [ ] **Step 3: Migrate `components/LiveSafetySheet.tsx`**

Add the same import.

Replace the end-sharing Alert at line ~90:
```tsx
if (!endResult.ok) {
  Alert.alert(
    "Couldn't end sharing",
    'Try again in a moment.',
  );
}
```

With:
```tsx
if (!endResult.ok) {
  const { title, body } = getErrorMessage('sharing', 'transient', endResult.error);
  Alert.alert(title, body);
}
```

- [ ] **Step 4: Type-check + commit**

Run: `npx tsc --noEmit` → exit 0.

```bash
git add app/share-location.tsx app/unfamiliar.tsx components/LiveSafetySheet.tsx
git commit -m "refactor(sharing): migrate Alert copy to getErrorMessage

share-location (start/end), unfamiliar (start/end + destination
search), LiveSafetySheet (end) all pull their failure copy from
getErrorMessage('sharing'|'load', 'transient', error) instead of
hardcoding it. Same Alert.alert call shape; just sourcing the strings
from the taxonomy.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Group A save-domain migrations

**Files:**
- Modify: `app/saved-places.tsx`
- Modify: `app/roadside-setup.tsx`
- Modify: `app/fuel.tsx`
- Modify: `app/home.tsx`

All four files have Alert.alert sites for save failures. Migrate each.

- [ ] **Step 1: Migrate `app/saved-places.tsx`**

Add import. Replace the Alert at line ~58:
```tsx
const result = await remove.run(place.id);
if (!result.ok) {
  Alert.alert(
    "Couldn't remove",
    "We couldn't remove this place. Try again in a moment.",
  );
}
```

With:
```tsx
const result = await remove.run(place.id);
if (!result.ok) {
  const { title, body } = getErrorMessage('save', 'transient', result.error);
  Alert.alert(title, body);
}
```

- [ ] **Step 2: Migrate `app/roadside-setup.tsx`**

Add import. Replace the Alert at line ~73:
```tsx
} else {
  Alert.alert('Could not save', 'Please try again in a moment.');
  // status === 'error' now; setting it again is unnecessary —
  // useMutation tracks it. Button re-enables automatically.
}
```

With:
```tsx
} else {
  const { title, body } = getErrorMessage('save', 'transient', saveMutation.error);
  Alert.alert(title, body);
  // status === 'error' now; setting it again is unnecessary —
  // useMutation tracks it. Button re-enables automatically.
}
```

- [ ] **Step 3: Migrate `app/fuel.tsx`**

Add import. Two sites. At line ~232 (inside the `else` of `permission-denied`):

```tsx
} else {
  Alert.alert('Could not save', 'Please try again in a moment.');
}
```

Becomes:
```tsx
} else {
  const { title, body } = getErrorMessage('save', 'transient');
  Alert.alert(title, body);
}
```

At line ~250 (`markFilledUp` failure):
```tsx
Alert.alert('Could not update', 'Please try again in a moment.');
```

Becomes:
```tsx
const { title, body } = getErrorMessage('save', 'transient');
Alert.alert(title, body);
```

**Do not touch** the `permission-denied` branch at line ~228 — that Alert (`'Notifications off', 'Turn on notifications for Fresh Greens in Settings…'`) is a permission-system message, not "try again" copy. Out of scope.

- [ ] **Step 4: Migrate `app/home.tsx`**

Add import. Three sites.

Line ~1754 (remove community report catch):
```tsx
} catch {
  Alert.alert('Could not remove', 'Please try again.');
}
```

Becomes:
```tsx
} catch (err) {
  const { title, body } = getErrorMessage('save', 'transient', err);
  Alert.alert(title, body);
}
```

Line ~1837 (clear community reports catch):
```tsx
} catch {
  Alert.alert('Could not clear', 'Please try again.');
}
```

Becomes:
```tsx
} catch (err) {
  const { title, body } = getErrorMessage('save', 'transient', err);
  Alert.alert(title, body);
}
```

Line ~3120 (the schedule-trip generic failure — inside an else chain after `permission-denied` and `past-time` branches):
```tsx
} else {
  Alert.alert(
    'Could not schedule',
    'Please try again in a moment.',
  );
}
```

Becomes:
```tsx
} else {
  const { title, body } = getErrorMessage('save', 'transient');
  Alert.alert(title, body);
}
```

**Do not touch** the `permission-denied` or `past-time` sibling branches — both have specific, non-generic copy that isn't "try again."

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit` → exit 0.

```bash
git add app/saved-places.tsx app/roadside-setup.tsx app/fuel.tsx app/home.tsx
git commit -m "refactor(save): migrate Alert copy to getErrorMessage

saved-places (remove), roadside-setup (saveProfile), fuel (save +
markFilledUp), home (remove-report + clear-reports + schedule-trip)
pull their failure copy from getErrorMessage('save', 'transient').
Sibling branches with non-generic copy (permission-denied, past-time,
Notifications off) deliberately left alone.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Group A load-domain migrations

**Files:**
- Modify: `app/search.tsx`
- Modify: `app/roadside.tsx`
- Modify: `components/FuelStopsSheet.tsx`

These are read-failure sites where the screen already routes through a `setErrorMessage` / `setError` state, or renders an inline `<Text>`. Migrate the copy source.

- [ ] **Step 1: Migrate `app/search.tsx`**

Add import. Two sites.

Line ~353 (location-unavailable for explicit search):
```tsx
setErrorMessage('Locating you… try again in a moment.');
```

Becomes:
```tsx
setErrorMessage(getErrorMessage('load', 'transient').body);
```

Line ~410-413 (places-search failed, explicit branch):
```tsx
if (isExplicit) {
  setPhase('error');
  setIsNoResultsError(false);
  setErrorMessage(
    "We're having trouble connecting to the internet right now.",
  );
}
```

Becomes:
```tsx
if (isExplicit) {
  setPhase('error');
  setIsNoResultsError(false);
  setErrorMessage(getErrorMessage('load', 'transient', err).body);
}
```

Note: the silent autocomplete fallback below ("Silent autocomplete error — leave UI alone, user can keep typing.") **stays silent** — appropriately quiet while the user is mid-type. No change.

- [ ] **Step 2: Migrate `app/roadside.tsx`**

Add import. Two sites, both `setError("Couldn't find that address. Try again.")` — one on the no-hit branch (line ~586), one in the catch (line ~595).

Replace both with:
```tsx
setError(getErrorMessage('load', 'transient').body);
```

(For the catch site at line ~595, pass `err` as the third arg: `getErrorMessage('load', 'transient', err).body`.)

- [ ] **Step 3: Migrate `components/FuelStopsSheet.tsx`**

Add import. One site — line ~93 (error subtitle):
```tsx
if (error) {
  return 'We could not load stops near your route. Check your connection and try again.';
}
```

Becomes:
```tsx
if (error) {
  return getErrorMessage('load', 'transient').body;
}
```

**Do not touch** the `stops.length === 0` no-results message at line ~94 (`"No ${fuelNoun(...)} found within ~${ROUTE_PROXIMITY_MILES} mi of this route. Try another route or search Gas from Home."`) — it's a fuel-specific instruction with route distance + alternatives, not a generic "try again." Out of scope.

**Do not touch** the `stops.length === 0` message at line ~167 ("Expand your search from Home using the Gas tile, or adjust your route and try again.") — same reasoning. The taxonomy's `load + permanent` ("Nothing to show / There's nothing matching here yet.") is too generic for this site's specific instructions. Out of scope.

- [ ] **Step 4: Type-check + commit**

Run: `npx tsc --noEmit` → exit 0.

```bash
git add app/search.tsx app/roadside.tsx components/FuelStopsSheet.tsx
git commit -m "refactor(load): migrate read-failure copy to getErrorMessage

search (locate + places-search explicit error), roadside (geocode +
geocode catch), FuelStopsSheet (load error) pull their failure copy
from getErrorMessage('load', 'transient'). FuelStopsSheet's no-results
messages stay site-specific (alternative-action instructions, not
generic 'try again' — out of taxonomy scope).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Group A auth + contact + report + inline migrations

**Files:**
- Modify: `app/login.tsx`
- Modify: `app/get-started.tsx`
- Modify: `app/trusted-contact-setup.tsx`
- Modify: `components/LifelineModal.tsx`
- Modify: `app/report.tsx`

Mix of `setError` sites (auth + contact-pick) and inline `<SafetyErrorMessage>` swap-ins (report).

- [ ] **Step 1: Migrate `app/login.tsx`**

Add import. Replace line ~67:
```tsx
if (code !== 'ERR_REQUEST_CANCELED') {
  setError('Sign-in failed. Please try again.');
  console.warn('Apple Sign In error', err);
}
```

With:
```tsx
if (code !== 'ERR_REQUEST_CANCELED') {
  setError(getErrorMessage('auth', 'transient', err).body);
}
```

(The `console.warn` line is removed — `getErrorMessage` emits its own `[auth:transient]` log.)

- [ ] **Step 2: Migrate `app/get-started.tsx`**

Add import. Same shape as login.tsx — replace line ~73 with:
```tsx
if (code !== 'ERR_REQUEST_CANCELED') {
  setError(getErrorMessage('auth', 'transient', err).body);
}
```

(Remove the adjacent `console.warn` line.)

- [ ] **Step 3: Migrate `app/trusted-contact-setup.tsx`**

Add import. Replace lines ~125-133:
```tsx
try {
  await pickContact();
} catch (err) {
  setError(
    err instanceof Error
      ? err.message
      : 'Could not pick contact. Try again.',
  );
  console.warn('pickContact failed', err);
} finally {
  setPicking(false);
}
```

With:
```tsx
try {
  await pickContact();
} catch (err) {
  // Prefer specific err.message when present (the hook's
  // phone-number-missing error has actionable detail);
  // fall back to the canonical contact-transient copy.
  setError(
    err instanceof Error
      ? err.message
      : getErrorMessage('contact', 'transient', err).body,
  );
} finally {
  setPicking(false);
}
```

(`console.warn` removed; `getErrorMessage` logs only when invoked, which the `instanceof Error` branch skips — but the `else` branch (rare) will log via the taxonomy.)

For the rare case where `err instanceof Error` is true, the error is still passed through to setError, and we silently drop the log. If a debug log on every contact-pick failure is desired, add an explicit `getErrorMessage('contact', 'transient', err)` call *before* the setError so it logs regardless of which branch is taken — but the existing code didn't log on the `instanceof Error` branch's value either, so this preserves behavior.

- [ ] **Step 4: Migrate `components/LifelineModal.tsx`**

Add import. Replace line ~39-43:
```tsx
Alert.alert(
  'No phone number',
  'Your trusted contact has no usable phone number. Update their details and try again.',
);
```

With:
```tsx
const { title, body } = getErrorMessage('contact', 'permanent');
Alert.alert(title, body);
```

(The taxonomy's `contact + permanent` title is "That contact won't work" and body is "They need a phone number we can text and call." — both more concise than the original.)

**Do not touch** the `Alert.alert('Unavailable', unsupportedMessage)` site at line ~47-49 — that's a system-capability message ("This device can't place phone calls"), not "try again" copy. Out of scope.

- [ ] **Step 5: Migrate `app/report.tsx`**

The report inline-error already exists as a custom Text style. Refactor to use `<SafetyErrorMessage>`.

Find the existing inline error JSX (around line 724-728):
```tsx
{submitError && (
  <Text style={styles.submitErrorLine}>
    Couldn&rsquo;t send your report. Try again.
  </Text>
)}
```

Replace with:
```tsx
{submitError && (
  <SafetyErrorMessage
    domain="report"
    disposition="transient"
    error={submitMutation.error}
  />
)}
```

Add import (near existing imports):
```tsx
import { SafetyErrorMessage } from '../components/SafetyErrorMessage';
```

Delete the unused `submitErrorLine` style entry from the StyleSheet (around lines 1055-1059) — `SafetyErrorMessage` brings its own styles.

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit` → exit 0.

```bash
git add app/login.tsx app/get-started.tsx app/trusted-contact-setup.tsx components/LifelineModal.tsx app/report.tsx
git commit -m "refactor(auth+contact+report): migrate copy to getErrorMessage + SafetyErrorMessage

login + get-started Apple Sign-In errors pull from auth-transient.
trusted-contact-setup's pickContact fallback uses contact-transient
(keeps err.message when present for actionable detail).
LifelineModal's no-phone-number Alert uses contact-permanent.
report's inline error swaps to <SafetyErrorMessage> (deletes the
duplicate submitErrorLine style). Sibling system-capability Alerts
in LifelineModal ('This device can't place phone calls') deliberately
left alone.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: useRecordings migration + Group B newly-visible

**Files:**
- Modify: `hooks/useRecordings.ts`
- Modify: `app/recordings.tsx`
- Modify: `app/pulled-over.tsx`

The deferred Sprint 1 work + the 2 Group B sites in these same files.

- [ ] **Step 1: Refactor `hooks/useRecordings.ts`**

Replace the entire body with:

```ts
import { useCallback } from 'react';

import {
  addRecording as addRecordingToStore,
  getRecordings,
  removeRecording as removeRecordingFromStore,
  type ArmedAnswer,
  type Recording,
} from '../lib/api/recordings';
import { useHydratedResource } from './useHydratedResource';
import { type Mutation, type MutationResult, useMutation } from './useMutation';

export type AddRecordingInput = {
  sourceUri: string;
  durationMs: number;
  armed: ArmedAnswer | null;
  createdAt?: number;
};

type RecordingsMutations = {
  add: Mutation<AddRecordingInput, Recording>;
  remove: Mutation<string, void>;
};

export type RecordingsState = RecordingsMutations &
  (
    | { ready: false }
    | { ready: true; ok: false; error: Error }
    | { ready: true; ok: true; recordings: Recording[] }
  );

/**
 * Reactive wrapper around the recordings adapter. Reads through
 * useHydratedResource (3-state — recordings reads can throw on
 * corrupt store / quota / cold-simulator wipe). Writes through
 * useMutation. Per-call exact-id reconciliation for add — race-safe
 * under concurrent runs (same pattern as PR #2's useSavedPlaces.add).
 */
export function useRecordings(): RecordingsState {
  const hydrated = useHydratedResource<Recording[]>(getRecordings, {
    mountOnly: true,
  });

  // add — per-call exact-id reconciliation. Each call closes over its
  // own unique optimistic id so concurrent calls can't collide; rollback
  // and reconciliation both target the exact id (no version race).
  const addMutation = useMutation(addRecordingToStore);
  const addRun = useCallback(
    async (
      input: AddRecordingInput,
    ): Promise<MutationResult<Recording>> => {
      const optimisticId = `__optimistic-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const optimistic: Recording = {
        id: optimisticId,
        sourceUri: input.sourceUri,
        durationMs: input.durationMs,
        armed: input.armed,
        createdAt: input.createdAt ?? Date.now(),
      };
      // Newest-first ordering — match what getRecordings returns.
      hydrated.setData((prev) => [optimistic, ...(prev ?? [])]);
      const result = await addMutation.run(input);
      if (result.ok) {
        hydrated.setData((prev) => {
          const base = prev ?? [];
          const idx = base.findIndex((r) => r.id === optimisticId);
          if (idx === -1) return base;
          const next = [...base];
          next[idx] = result.data;
          return next;
        });
      } else {
        // Rollback — remove only our optimistic entry, leave concurrent
        // ones in place.
        hydrated.setData((prev) =>
          (prev ?? []).filter((r) => r.id !== optimisticId),
        );
      }
      return result;
    },
    [addMutation.run, hydrated.setData],
  );
  const add: Mutation<AddRecordingInput, Recording> = {
    ...addMutation,
    run: addRun,
  };

  // remove — onOptimistic captures original index for splice-restore on rollback.
  const remove = useMutation(removeRecordingFromStore, {
    onOptimistic: (id) => {
      const base = hydrated.ready && hydrated.ok ? hydrated.data : [];
      const idx = base.findIndex((r) => r.id === id);
      const removed = idx !== -1 ? base[idx] : undefined;
      hydrated.setData((prev) => (prev ?? []).filter((r) => r.id !== id));
      return () => {
        if (removed !== undefined && idx !== -1) {
          hydrated.setData((prev) => {
            const next = [...(prev ?? [])];
            next.splice(idx, 0, removed);
            return next;
          });
        }
      };
    },
  });

  if (!hydrated.ready) {
    return { ready: false, add, remove };
  }
  if (!hydrated.ok) {
    return {
      ready: true,
      ok: false,
      error: hydrated.error,
      add,
      remove,
    };
  }
  return {
    ready: true,
    ok: true,
    recordings: hydrated.data,
    add,
    remove,
  };
}
```

- [ ] **Step 2: Migrate `app/recordings.tsx`**

This screen has the most rework — the 4-branch ladder (loading / error / empty / list) collapses into the type-enforced three-way narrow.

Current top of component (around line 49):
```tsx
const { recordings, loading, error, removeRecording } = useRecordings();
```

Replace with:
```tsx
const state = useRecordings();
```

Also remove the derived booleans (around lines 156-157):
```tsx
const showEmptyState = !loading && !error && recordings.length === 0;
const hasRecordings = !loading && !error && recordings.length > 0;
```

Replace with the discriminated narrows used at render time below.

Now the render. The current ladder (around lines 185-218):

```tsx
{loading ? (
  <LoadingState text="Loading recordings…" />
) : error ? (
  <ErrorState text="We couldn't load your recordings. Reopen this screen to try again." />
) : showEmptyState ? (
  <EmptyStateCard ... />
) : (
  <View style={styles.recordingsList}>
    {recordings.map((recording) => { ... })}
  </View>
)}
```

Becomes (replacing the four-branch ternary):

```tsx
{!state.ready ? (
  <LoadingState text="Loading recordings…" />
) : !state.ok ? (
  <SafetyErrorMessage
    domain="load"
    disposition="transient"
    error={state.error}
  />
) : state.recordings.length === 0 ? (
  <EmptyStateCard ... />
) : (
  <View style={styles.recordingsList}>
    {state.recordings.map((recording) => { ... })}
  </View>
)}
```

(Preserve the EmptyStateCard's existing props verbatim — `justDeletedAll`, the icon, headline, text. Same for each RecordingCard's props — `recording={recording}`, `isActive`, `isPlaying`, `onTogglePlay`, `onDelete`.)

The `hasRecordings && (...)` block around line 221 (the "Delete all recordings" button) — replace `hasRecordings` with a fresh narrow:

```tsx
{state.ready && state.ok && state.recordings.length > 0 && (
  <View style={styles.deleteAllWrap}>
    <Button ... />
  </View>
)}
```

The handlers that call `removeRecording(id)`:

Find the existing `handleDelete` (around line 119-125):
```tsx
async function handleDelete(id: string) {
  ...
  await removeRecording(id);
  ...
}
```

Replace `removeRecording(id)` with the new mutation call + result narrow:
```tsx
const result = await state.remove.run(id);
if (!result.ok) {
  const { title, body } = getErrorMessage('save', 'transient', result.error);
  Alert.alert(title, body);
  return;
}
```

Find the bulk-delete handler (around line 140-145):
```tsx
await Promise.all(recordings.map((r) => removeRecording(r.id)));
```

Replace with:
```tsx
// Iterate the local snapshot — capture before the first run() in case
// state.recordings is replaced by an in-flight optimistic.
const ids = state.ready && state.ok ? state.recordings.map((r) => r.id) : [];
const results = await Promise.all(ids.map((id) => state.remove.run(id)));
const anyFailed = results.some((r) => !r.ok);
if (anyFailed) {
  const firstErr = results.find((r) => !r.ok && r.error)?.error;
  const { title, body } = getErrorMessage('save', 'transient', firstErr);
  Alert.alert(title, body);
}
```

(The bulk-delete block is inside a code path gated on `hasRecordings`, so `state.ready && state.ok` is already true at the call site — but the narrow defensively returns `[]` for the impossible case.)

Add imports near the top:
```tsx
import { Alert } from 'react-native';
// (Alert may already be imported; verify)
import { SafetyErrorMessage } from '../components/SafetyErrorMessage';
import { getErrorMessage } from '../lib/error-message';
```

Remove unused imports — `LoadingState` stays (still used), `ErrorState` becomes unused if no other code path uses it (verify before deleting). The `EmptyState as EmptyStateCard` import stays.

**Group B integration — `recordings.tsx:84` play-recording failure.**

Find the current playback effect (around line 75-90):
```tsx
useEffect(() => {
  if (!playingId) return;
  const target = recordings.find((r) => r.id === playingId);
  if (!target) return;
  try {
    player.replace({ uri: target.uri });
    player.play();
  } catch (err) {
    console.warn('Failed to play recording', target.id, err);
    setPlayingId(null);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [playingId]);
```

The `recordings.find(...)` reference depends on the post-refactor narrowed `state.ready && state.ok ? state.recordings : []`. Adjust:

```tsx
const [playbackErrorId, setPlaybackErrorId] = useState<string | null>(null);
// ...add near the existing useState declarations at the top of the component.

useEffect(() => {
  if (!playingId) return;
  if (!state.ready || !state.ok) return;
  const target = state.recordings.find((r) => r.id === playingId);
  if (!target) return;
  try {
    player.replace({ uri: target.uri });
    player.play();
    setPlaybackErrorId(null);
  } catch (err) {
    // Group B: surface to the user. The user tapped play on a specific
    // row; show an inline error next to THAT row.
    getErrorMessage('recordings', 'transient', err); // emits debug log
    setPlaybackErrorId(playingId);
    setPlayingId(null);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [playingId, state.ready, state.ok]);
```

Then in the per-row JSX (around the `state.recordings.map` block):
```tsx
<RecordingCard ... />
{playbackErrorId === recording.id && (
  <SafetyErrorMessage
    domain="recordings"
    disposition="transient"
  />
)}
```

(The error clears the next time the user successfully starts playback on any row; for clearing on row tap, set `setPlaybackErrorId(null)` inside `handleTogglePlay` before calling `setPlayingId`.)

- [ ] **Step 3: Migrate `app/pulled-over.tsx`**

Add imports:
```tsx
import { Alert } from 'react-native'; // verify already imported
import { getErrorMessage } from '../lib/error-message';
```

The existing `useRecordings` destructure at line ~217:
```tsx
const { addRecording } = useRecordings();
```

Becomes:
```tsx
const { add } = useRecordings();
```

Every existing call to `await addRecording(input)` becomes `await add.run(input)`. The save-recording handler from PR #2 (around line 420-430) already does this pattern with the saveRecordingMutation — that part stays as PR #2 wrote it. The change is only the destructure name + the upstream `addRecording` references.

Actually — looking at the existing code more carefully — `addRecording` from `useRecordings` is what `saveRecordingMutation` wraps via `useMutation(addRecording)`. After this migration, `saveRecordingMutation` becomes `useMutation(add.run)` — but `add.run` is the same input/output shape as `addRecording` was, so the call body doesn't change.

Wait — `useMutation` expects a function `(input: I) => Promise<T>`, but `add.run` returns `Promise<MutationResult<Recording>>`, not `Promise<Recording>`. That'd break PR #2's pattern.

Correction: the saveRecordingMutation should NOT wrap `add.run` (which already returns a Result). It should either:
(a) Use `add` directly (so `saveRecordingMutation` IS `add` — replace `useMutation(addRecording)` with just using the hook's `add` mutation object) OR
(b) Wrap the underlying adapter `addRecordingToStore` again (duplicates the useMutation wrap; not great).

Option (a) is cleanest. Replace `const saveRecordingMutation = useMutation(addRecording);` (PR #2 line ~218) with:

```tsx
const { add } = useRecordings();
// add IS the mutation object — has run, status, error, reset
const saveRecordingMutation = add;
```

Or just rename uses of `saveRecordingMutation` to `add` directly (cleaner but more diff). Since PR #2's banner code (around lines 548-566) uses `saveRecordingMutation.status === 'error'` etc., aliasing keeps that code untouched.

**Group B integration — `pulled-over.tsx:354` recorder failed to start.**

Find the current code (around line 354):
```tsx
} catch (err) {
  console.warn('expo-audio recorder failed to start', err);
}
```

Replace with:
```tsx
} catch (err) {
  // Group B: surface to the user. They think recording is happening; if
  // it isn't, they need to know NOW. Recordings + permanent maps to
  // "Couldn't start recording / Try a different microphone or restart."
  const { title, body } = getErrorMessage('recordings', 'permanent', err);
  Alert.alert(title, body);
}
```

- [ ] **Step 4: Type-check + commit**

Run: `npx tsc --noEmit` → exit 0.

```bash
git add hooks/useRecordings.ts app/recordings.tsx app/pulled-over.tsx
git commit -m "refactor(recordings): migrate to useHydratedResource + useMutation + surface 2 silent fails

The deferred Sprint 1 work activated through the new 3-state primitive.
useRecordings now exposes RecordingsState discriminated union with
add/remove Mutation objects. recordings.tsx collapses its 4-branch
ladder into the type-enforced three-way narrow + inline
<SafetyErrorMessage> for load failures. pulled-over.tsx swaps
addRecording for add.run.

Group B newly-visible failures (recordings = legal protection per
Phase 1's tail):
- recordings.tsx:84 play-recording failure now surfaces inline next
  to the failed row instead of a silent console.warn
- pulled-over.tsx:354 recorder-failed-to-start now Alert.alerts via
  recordings + permanent — the user thinks recording is happening; if
  not they need to know

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Final verification + PR

**Files:** none (verification + git)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 2: Confirm scope discipline**

```bash
git diff --name-only main...HEAD | sort
```

Expected: 4 new system files (`hooks/useHydratedResource.ts`, `lib/error-copy.ts`, `lib/error-message.ts`, `components/SafetyErrorMessage.tsx`), 1 refactored banner (`components/RecordingSaveErrorBanner.tsx`), 3 useRecordings files (`hooks/useRecordings.ts`, `app/recordings.tsx`, `app/pulled-over.tsx`), 12 Group A files (`app/share-location.tsx`, `app/unfamiliar.tsx`, `components/LiveSafetySheet.tsx`, `app/saved-places.tsx`, `app/roadside-setup.tsx`, `app/fuel.tsx`, `app/home.tsx`, `app/search.tsx`, `app/roadside.tsx`, `components/FuelStopsSheet.tsx`, `app/login.tsx`, `app/get-started.tsx`, `app/trusted-contact-setup.tsx`, `components/LifelineModal.tsx`, `app/report.tsx`). ~20 files total.

Verify the user-facing-copy invariant — NO `"Try again"` or `"try again"` outside `lib/error-copy.ts`:

```bash
grep -rn "Try again\|try again" app/ components/ hooks/ lib/ 2>/dev/null | grep -v "lib/error-copy.ts" | grep -v "// "
```

Expected: empty (or only matches inside JSX/JS comments — none in user-facing strings).

- [ ] **Step 3: Manual smoke — 5 high-value Group A spot-checks**

On a sim/device, inject a temporary `throw` in each adapter (revert before commit), confirm the new copy renders:
- saved-places: tap remove → Alert "Couldn't save / Try again in a moment."
- share-location: pick a reason → Alert "Couldn't start sharing / Try again in a moment."
- report: submit → inline `<SafetyErrorMessage>` "Try again."
- login: trigger Apple Sign-In failure → inline "Try again."
- trusted-contact-setup: tap pick (no contact) → inline (either err.message or taxonomy fallback)

- [ ] **Step 4: Manual smoke — Group B newly-visible**

- recordings.tsx play failure: corrupt a recording's `uri` to invalid → tap play → inline `<SafetyErrorMessage>` appears next to that row.
- pulled-over.tsx recorder start failure: deny mic permission AT MOMENT OF RECORD (not at app launch) → tap stop-recording start → Alert "Couldn't start recording / Try a different microphone or restart the app."

- [ ] **Step 5: Manual smoke — useRecordings 3-state**

- Cold-launch `/recordings` with stored recordings → list renders.
- With NO stored recordings → empty state.
- With injected `getRecordings` throw → `<SafetyErrorMessage>` "Couldn't load / Reopen this screen to try again."
- Bulk delete with injected `removeRecordingFromStore` throw → Alert appears, items reappear on rollback.

- [ ] **Step 6: Open the PR**

```bash
git push -u origin feat/safety-error-message
gh pr create --title "refactor: SafetyErrorMessage + error taxonomy + useHydratedResource (Sprint 1 closer)" --body "$(cat <<'EOF'
Implements [the SafetyErrorMessage spec](docs/superpowers/specs/2026-06-19-safety-error-message-design.md) (Phase 2 Sprint 1 PR #3 of 3 — Sprint 1 closer) from the Design Health Program. Synthesis pattern #3 ("Generic Error Copy in Charged Moments").

## What & why

Three new system pieces compose a-la-carte:

- \`hooks/useHydratedResource.ts\` — sibling to PR #1's useHydratedState; 3-state union for reads that can meaningfully throw.
- \`lib/error-copy.ts\` + \`lib/error-message.ts\` — exhaustive 7-domain × 4-disposition copy table + pure getErrorMessage function. **Single source of truth for every user-facing error string in the app.**
- \`components/SafetyErrorMessage.tsx\` — ~30 LOC inline JSX wrapper.

Plus the deferred Sprint 1 work: \`useRecordings\` migrated through both new primitives + useMutation. 24 Group A "try again" sites swept to the new taxonomy. 2 Group B silent failures became user-visible. RecordingSaveErrorBanner from PR #2 refactored to read from the same taxonomy.

## Scope (one commit per task)

- Task 1: useHydratedResource primitive
- Task 2: error-copy + getErrorMessage + SafetyErrorMessage
- Task 3: RecordingSaveErrorBanner refactor
- Task 4: Group A sharing (3 files)
- Task 5: Group A save (4 files)
- Task 6: Group A load (3 files)
- Task 7: Group A auth + contact + report (5 files)
- Task 8: useRecordings migration + 2 Group B newly-visible (3 files)

## Verification

- ✅ tsc --noEmit clean after every commit
- ✅ No literal "Try again" outside lib/error-copy.ts
- ✅ 15 deliberately-silent Group B sites preserved with retained console.warn
- ✅ Sibling branches with non-generic copy (Notifications off / past-time / "This device can't place phone calls") deliberately untouched

## ⚠️ Manual smoke still owed (device/sim — reviewer's to run)

Per the test plan in Task 9 — 5 Group A spot-checks + 2 Group B newly-visible + useRecordings 3-state ladder walks.

Sprint 1 closes on merge.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- useHydratedResource (3-state union, setData intersected, refocus default, ok-can-flip) → Task 1. ✓
- error-copy table + getErrorMessage + SafetyErrorMessage → Task 2. ✓
- All 24 Group A sites → Tasks 4-7 (sharing 3 / save 4 / load 3 / auth+contact+report 5). ✓
- All 18 Group B (3 visible + 15 silent) → Task 8 covers recordings:84 + pulled-over:354 newly-visible; the other 15 silent sites stay untouched (no Group B inclusion in Tasks 4-7). The audit-deferred third site (search.tsx:412) is migrated under Task 6's load domain, not as a "becomes visible" — preserves existing behavior. ✓
- useRecordings migration + 2 callers → Task 8. ✓
- RecordingSaveErrorBanner refactor → Task 3. ✓
- tsc + manual smoke + scope-discipline diff → Task 9. ✓

**2. Placeholder scan.** No TBD/TODO. Code blocks show actual edit content per site. The `recordings.tsx` render diff is the most elaborate (4-branch → 3-way narrow) but every prop and callback is named explicitly.

**3. Type consistency.**
- `Mutation<I, T>`, `MutationResult<T>` from PR #2's useMutation — re-used consistently in Task 8's useRecordings.
- `HydratedResource<T>` from Task 1 — composed in Task 8 via the `useHydratedResource(getRecordings)` call.
- `ErrorDomain` / `ErrorDisposition` / `ErrorCopy` types in Task 2 — referenced consistently across Tasks 3-8.
- All caller sites pass `getErrorMessage(domain, disposition, error?)` with the same three-argument shape. The third arg is the raw error (`unknown` accepted); the function emits one canonical `[domain:disposition]` log when present.

**Watch items for the implementer:**
- Task 8 Step 3's saveRecordingMutation aliasing — verify after migration that PR #2's banner code (lines 548-566 of pulled-over.tsx) still reads `saveRecordingMutation.error`/`.status`/`.reset` correctly. Aliasing `add` to `saveRecordingMutation` preserves the names; verify tsc doesn't complain about any subtle structural mismatch.
- Task 6 search.tsx:412 — the silent autocomplete branch ("Silent autocomplete error — leave UI alone") must stay silent. Only the explicit-search branch migrates.
- Task 7 trusted-contact-setup — preserves the err.message-when-present fallback. If the implementer "simplifies" this to always use the taxonomy, they lose the actionable detail of the hook's no-phone-number error.
- Task 8 Step 2's `EmptyStateCard` and `RecordingCard` props — preserve verbatim from the existing render block. Skipping a prop is an easy mistake during the ladder refactor.
