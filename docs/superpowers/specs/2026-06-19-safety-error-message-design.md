# SafetyErrorMessage + Error Taxonomy + useHydratedResource — Design Spec

**Date:** 2026-06-19
**Status:** Approved (brainstorm complete; awaiting plan)
**Sprint:** Design Health Program — Phase 2, Sprint 1, PR #3 of 3 (the closer)
**Synthesis source:** [`docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) — SYSTEMIC pattern #3 ("Generic Error Copy in Charged Moments")

---

## Goal

Make error copy a **shared resource the codebase reads from, not a string each screen writes by hand.** Today ~24 sites write their own "try again" copy (six near-duplicates of the same string with cosmetic differences); ~18 silent `console.warn` sites bury failures users should see. PR #3 introduces one copy table, one function, one component, one new hook primitive — and migrates every existing error site to use them. Brand voice changes happen in one file forever.

This is the closer for Sprint 1. PR #1 (`useHydratedState`) killed the loading-flash class via discriminated union; PR #2 (`useMutation`) killed the silent-fail class via discriminated `MutationResult`; PR #3 standardizes the *user-facing* surface those two PRs left for screens to handle and finally activates the `useRecordings` migration that was deferred from both.

## The classes of bug being fixed

1. **Hand-written error copy drifts.** Six sites write near-duplicates of "We couldn't [verb] [domain]. Try again in a moment." with cosmetic differences ("Could not" vs "Couldn't"; "Please try again" vs "Try again"). Brand voice has no single source of truth.
2. **Silent fails hide user-actionable failures.** Of ~18 `console.warn`-only sites, 3 are user-visible failures dressed as logs (recordings playback, recorder start, places search) — the user taps a thing and nothing happens, no signal.
3. **`useRecordings` has the 3-state shape `useHydratedState` doesn't model.** Loading + error + ready was the explicit reason PR #1 deferred it. A new companion primitive resolves this without breaking PR #1's existing consumers.

## Scope

**All three buckets in one PR** (per user decision in brainstorm — Sprint 1 closer rhythm):

**Bucket A — The system (new primitives + table + component):**
- `hooks/useHydratedResource.ts` — sibling to `useHydratedState`; 3-state discriminated union
- `lib/error-copy.ts` — the canonical (domain × disposition) → `{ title, body }` table
- `lib/error-message.ts` (or co-located) — `getErrorMessage(domain, disposition, error?)` pure function
- `components/SafetyErrorMessage.tsx` — thin JSX wrapper for inline rendering

**Bucket B — `useRecordings` migration (the deferred work):**
- `hooks/useRecordings.ts` — refactored to compose `useHydratedResource` (reads) + `useMutation` (writes: `add`, `remove`)
- Two callers migrated: `app/recordings.tsx`, `app/pulled-over.tsx`

**Bucket C — Caller migrations (apply A everywhere):**
- All 24 Group A sites (existing "try again" copy) → `getErrorMessage` / `<SafetyErrorMessage>`
- 3 Group B sites (currently silent, should surface) → new error surfaces via the same API
- 15 Group B sites stay silent (audit decided per-site; each keeps its `console.warn` for debug)
- `RecordingSaveErrorBanner` (from PR #2) refactored to use `getErrorMessage` for its copy

**Out of scope (intentionally):**
- Network-error specific handling beyond the taxonomy (`disposition: 'transient'` covers it; no need for per-error-code branching)
- Extending PR #1's `useHydratedState` to a 3-state union (rejected in brainstorm — would force 16 existing PR #1 consumers to handle a phantom error branch)
- Sprint 2 work (synthesis PRs 4-10)

---

## Design

### Conceptual model

**Three independent things** that compose cleanly, each with one responsibility:

| Piece | Owns | Surface |
|---|---|---|
| `useHydratedResource<T>` | The loading+error+ready state machine for reads | Hook |
| `getErrorMessage(d, dp, e?)` | The (domain, disposition) → copy mapping | Pure function |
| `<SafetyErrorMessage>` | One inline rendering of `getErrorMessage` output | JSX component |

The hook is independent of the copy system — you can use `useHydratedResource` without the copy table. The copy table is independent of the hook — every error surface in the app uses it whether or not the data came through a hooked read. Composition is a-la-carte.

### `useHydratedResource<T>` — the new primitive

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

export type HydratedResource<T> =
  | { ready: false }
  | { ready: true; ok: false; error: Error }
  | { ready: true; ok: true; data: T };

export function useHydratedResource<T>(
  read: () => Promise<T>,
  options?: { mountOnly?: boolean },
): HydratedResource<T> & { setData: Dispatch<SetStateAction<T>> };
```

Behavior contract:

- **Three-way discriminated union.** Callers cannot reach `.data` without narrowing past both `ready` and `ok`. Cannot reach `.error` without narrowing past `ready` and `!ok`. Type-enforced.
- **`setData` intersected outside the union** (same as `useHydratedState`) — always callable on every branch. Composing mutation hooks need this for optimistic updates that fire regardless of which branch the read currently sits in (e.g., `pulled-over.tsx` writes through `useRecordings.add` even though `/recordings`'s read state is irrelevant to it).
- **Refocus-aware by default**, `{ mountOnly: true }` opt-out — same defaults as `useHydratedState`.
- **`ready` latches `false → true` once.** Once hydration settles, it never re-enters the loading branch on refocus. Same load-bearing detail as PR #1.
- **`ok` can flip true ↔ false on refocus.** A subsequent re-read may succeed where the first failed (e.g., user retries after a transient failure), or vice versa. The error branch is not sticky.
- **Internal read body:** catch wraps the user-provided `read`. On success → `setData(result)`, `setOk(true)`. On throw → `setError(err)`, `setOk(false)`. Both paths flip `ready` to `true`. Mounted guard via ref; cancelled guard for in-flight reads.

**Decision rule for which primitive to use:**
- Reader returns a default on any failure (never throws) → `useHydratedState` (preferences, saved-places, trusted-contact, share-session — the existing PR #1 consumers; no change)
- Reader can throw → `useHydratedResource` (useRecordings today; any future network-backed read)

### The taxonomy

Two narrow axes, both `as const` literal unions:

```ts
export type ErrorDomain =
  | 'recordings'   // save/load/play/remove recording
  | 'sharing'      // start/end/resend share session
  | 'contact'      // pick contact, missing or invalid contact data
  | 'report'       // submit community report, photo attach
  | 'save'         // generic save (fuel, roadside, mark-regular, save-home, remove-saved-place, clear-reports)
  | 'load'         // generic read failure (place search, geocode, fetchAndCenter, fuel stops, recordings load)
  | 'auth';        // Apple Sign In failure, sign-out errors

export type ErrorDisposition =
  | 'transient'    // retry might work — "Try again [in a moment]"
  | 'permanent'    // retry won't help — surfaces with actionable specifics or "We can't recover this"
  | 'needs-setup'  // failed because prerequisite missing — "Set one up first"
  | 'cancelled';   // user dismissed mid-flight — silent (taxonomy includes it as the canonical "ignore" disposition)
```

7 domains × 4 dispositions = 28 conceptual slots; ~18 produce visible copy (`cancelled` is silent across all domains; some `domain + needs-setup` combinations don't exist semantically). The table is exhaustive at the type level — TypeScript demands every key — but slots with no meaningful copy return a sentinel value the consumers can check (e.g., `null` for silent dispositions). See the implementation table at the end of this section.

### `getErrorMessage` — the pure function

```ts
import { ERROR_COPY } from './error-copy';

export type ErrorCopy = { title: string; body: string };

export function getErrorMessage(
  domain: ErrorDomain,
  disposition: ErrorDisposition,
  error?: unknown,
): ErrorCopy {
  // Internal debug log replaces every existing console.warn('[domain] xyz failed', err)
  // boilerplate. One log call per failure, consistent format.
  if (error !== undefined) {
    console.warn(`[${domain}:${disposition}]`, error);
  }
  const copy = ERROR_COPY[domain][disposition];
  // Sentinel for silent slots (cancelled and undefined combinations) — callers
  // should not reach this branch for those slots; if they do, return empty
  // strings so Alert.alert / SafetyErrorMessage degrade gracefully.
  return copy ?? { title: '', body: '' };
}
```

Behavior contract:

- **Pure function.** No JSX, no React. Callable from event handlers, mutation callbacks, anywhere.
- **One log call per failure** — replaces the existing `console.warn('[domain] xyz failed', err)` pattern at every migrated site. Format: `[domain:disposition]`. Reduces ~20 ad-hoc log formats to one.
- **Silent dispositions return empty strings,** not throw. Defensive — a misuse degrades to a no-op surface rather than crashing.
- **Used as:**
  - `Alert.alert(...Object.values(getErrorMessage('sharing', 'transient')))` — destructures `title` + `body`
  - The component below: `<SafetyErrorMessage domain="report" disposition="transient" />` — calls `getErrorMessage` internally

### `<SafetyErrorMessage>` — the thin JSX wrapper

```tsx
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import {
  type ErrorDomain,
  type ErrorDisposition,
  getErrorMessage,
} from '../lib/error-message';

/**
 * Inline error surface. Renders the body text from getErrorMessage, styled
 * to match the existing inline error pattern in /report (footnoteRegular +
 * colors.red + centered). The title is omitted in the inline case — the
 * domain context is usually visible at the call site (the user is on the
 * form that failed; they don't need a "Couldn't send your report" title
 * AND an inline body — just the body suffices).
 *
 * For modal cases use Alert.alert(...Object.values(getErrorMessage(...)));
 * for the persistent-banner case (P-C from PR #2) the RecordingSaveErrorBanner
 * component composes getErrorMessage internally.
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
  if (!body) return null; // silent disposition; render nothing
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
    color: colors.red, // matches existing report.tsx + login.tsx + get-started.tsx patterns
    textAlign: 'center',
  },
});
```

~30 lines. No new design tokens. Reuses the same `footnoteRegular + colors.red + centered` shape that already exists in `report.tsx`, `login.tsx`, `get-started.tsx`, and `trusted-contact-setup.tsx` (per the anti-slop rule "match existing patterns where they exist" — the choice the PR #2 implementer made for `/report`).

### `useRecordings` migration (Bucket B)

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
import { type Mutation, useMutation } from './useMutation';

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

export function useRecordings(): RecordingsState {
  const hydrated = useHydratedResource<Recording[]>(getRecordings, { mountOnly: true });

  // Per-call exact-id reconciliation (same pattern as PR #2's useSavedPlaces.add):
  // generate a unique optimistic id per call, close over it through both the
  // optimistic apply and the success reconciliation, so concurrent runs each
  // touch only their own optimistic. Race-safe under double-tap.
  const addMutation = useMutation(addRecordingToStore);
  const addRun = useCallback(
    async (input: AddRecordingInput): Promise<MutationResult<Recording>> => {
      const optimisticId = `__optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: Recording = {
        id: optimisticId,
        sourceUri: input.sourceUri,
        durationMs: input.durationMs,
        armed: input.armed,
        createdAt: input.createdAt ?? Date.now(),
      };
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
        hydrated.setData((prev) => (prev ?? []).filter((r) => r.id !== optimisticId));
      }
      return result;
    },
    [addMutation.run, hydrated.setData],
  );
  const add: Mutation<AddRecordingInput, Recording> = { ...addMutation, run: addRun };

  const remove = useMutation(removeRecordingFromStore, {
    onOptimistic: (id) => {
      const base = (hydrated.ready && hydrated.ok) ? hydrated.data : [];
      const idx = base.findIndex(r => r.id === id);
      const removed = idx !== -1 ? base[idx] : undefined;
      hydrated.setData(prev => (prev ?? []).filter(r => r.id !== id));
      return () => {
        if (removed !== undefined && idx !== -1) {
          hydrated.setData(prev => {
            const next = [...(prev ?? [])];
            next.splice(idx, 0, removed);
            return next;
          });
        }
      };
    },
  });

  if (!hydrated.ready) return { ready: false, add, remove };
  if (!hydrated.ok) return { ready: true, ok: false, error: hydrated.error, add, remove };
  return { ready: true, ok: true, recordings: hydrated.data, add, remove };
}
```

**Three-way narrow at every caller** (only 2 caller files exist):

`app/recordings.tsx`:
```tsx
const state = useRecordings();
if (!state.ready) return <ScreenChrome />;
if (!state.ok) return <SafetyErrorMessage domain="load" disposition="transient" />;
// state.recordings reachable here; bulk-delete + single-row-delete use state.remove.run
```

`app/pulled-over.tsx`:
```tsx
const { add } = useRecordings();
// state.add.run(input) replaces the legacy await addRecording(input)
// The existing RecordingSaveErrorBanner from PR #2 stays — its hardcoded copy
// "Your recording didn't save." gets replaced by:
//   getErrorMessage('recordings', 'transient').title
```

### Caller migrations (Bucket C)

See the Migration Map at the end of the spec — every existing error site mapped to its `(domain, disposition)`. Three caller patterns emerge after migration:

1. **Modal cases (`Alert.alert`)** — `Alert.alert(...Object.values(getErrorMessage(d, dp, error)))`
2. **Inline cases** — `<SafetyErrorMessage domain={d} disposition={dp} error={result.error} />`
3. **Persistent-banner case** — `RecordingSaveErrorBanner` (from PR #2) refactored to use `getErrorMessage('recordings', 'transient').title` internally; no signature change for callers

No screen writes its own "try again" copy anywhere in the codebase after PR #3.

---

## The full copy table

```ts
// lib/error-copy.ts
export const ERROR_COPY: Record<
  ErrorDomain,
  Record<ErrorDisposition, ErrorCopy | null>
> = {
  recordings: {
    transient:   { title: "Couldn't save your recording", body: "Try again in a moment." },
    permanent:   { title: "Couldn't start recording",     body: "Try a different microphone or restart the app." },
    'needs-setup': null,
    cancelled:   null,
  },
  sharing: {
    transient:    { title: "Couldn't start sharing",       body: "Try again in a moment." },
    permanent:    { title: "Sharing unavailable",          body: "We can't reach your trusted contact right now." },
    'needs-setup': { title: "No trusted contact yet",       body: "Set one up to share your location." },
    cancelled:    null,
  },
  contact: {
    transient:    { title: "Couldn't pick a contact",      body: "Try again." },
    permanent:    { title: "That contact won't work",      body: "They need a phone number we can text and call." },
    'needs-setup': { title: "No trusted contact yet",       body: "Set one up first to call or text from here." },
    cancelled:    null,
  },
  report: {
    transient:    { title: "Couldn't send your report",    body: "Try again." },
    permanent:    { title: "Report unavailable",           body: "We can't send this one." },
    'needs-setup': null,
    cancelled:    null,
  },
  save: {
    transient:    { title: "Couldn't save",                 body: "Try again in a moment." },
    permanent:    { title: "Couldn't save",                 body: "We can't recover this one." },
    'needs-setup': null,
    cancelled:    null,
  },
  load: {
    transient:    { title: "Couldn't load",                 body: "Reopen this screen to try again." },
    permanent:    { title: "Nothing to show",               body: "There's nothing matching here yet." },
    'needs-setup': null,
    cancelled:    null,
  },
  auth: {
    transient:    { title: "Sign-in failed",                body: "Try again." },
    permanent:    { title: "Can't sign in",                 body: "Check your Apple ID and try again." },
    'needs-setup': null,
    cancelled:    null,
  },
};
```

All in Steady Companion voice: calm, grounded, no exclamation points, no "Oops!" or "Whoops!", no performative apologies. The copy makes a statement of fact and offers a next step. Brand voice changes happen here.

---

## Migration map (full inventory)

### Group A — 24 sites with existing "try again" copy

| Site | Current copy | New mapping | New call shape |
|---|---|---|---|
| `login.tsx:67` | "Sign-in failed. Please try again." | `auth + transient` | `setError(getErrorMessage('auth','transient').body)` |
| `get-started.tsx:73` | (same) | `auth + transient` | (same) |
| `search.tsx:353` | "Locating you… try again in a moment." | `load + transient` | `setErrorMessage(...)` |
| `recordings.tsx:188` | "We couldn't load your recordings…" | `load + transient` | `<SafetyErrorMessage domain="load" disposition="transient" />` |
| `report.tsx:727` | "Couldn't send your report. Try again." | `report + transient` | `<SafetyErrorMessage domain="report" disposition="transient" />` |
| `share-location.tsx:73, :84` | "We couldn't [start\|end] the share session…" | `sharing + transient` | `Alert.alert(...Object.values(getErrorMessage('sharing','transient')))` |
| `unfamiliar.tsx:108, :150, :158` | (three sharing/load variations) | `sharing + transient` × 2; `load + transient` × 1 | (Alert form) |
| `LiveSafetySheet.tsx:90` | "Try again in a moment." | `sharing + transient` | (Alert form) |
| `saved-places.tsx:62` | "We couldn't remove this place…" | `save + transient` | (Alert form) |
| `home.tsx:1754, :1837, :3120` | "Could not [remove\|clear]…" | `save + transient` | (Alert form) |
| `fuel.tsx:232, :250` | "Could not save\|update…" | `save + transient` | (Alert form) |
| `roadside-setup.tsx:73` | "Could not save…" | `save + transient` | (Alert form) |
| `roadside.tsx:586, :595` | "Couldn't find that address…" | `load + transient` | `setError(...)` |
| `trusted-contact-setup.tsx:132` | "Could not pick contact…" | `contact + transient` | `setError(...)` |
| `LifelineModal.tsx:41` | "Your trusted contact has no usable phone number…" | `contact + permanent` (the one non-transient — wrong contact data, retry won't help) | (Alert form) |
| `FuelStopsSheet.tsx:93, :167` | "Could not load…" / "Expand your search…" | `load + transient` and `load + permanent` (no-results) | (inline form) |

### Group B — 18 silent sites; audit decided per-site

**3 sites become user-visible:**

| Site | Today | Decision |
|---|---|---|
| `recordings.tsx:84` | play-recording fails silently | **Surface** → inline `<SafetyErrorMessage domain="recordings" disposition="transient" />` next to failed row |
| `pulled-over.tsx:354` | recorder fails to start silently | **Surface** → `Alert.alert(...Object.values(getErrorMessage('recordings','permanent')))` — user thinks recording is happening |
| `search.tsx:412` | places search fails silently | **Surface** → `setErrorMessage(getErrorMessage('load','transient').body)` |

**15 sites stay silent** (each keeps its `console.warn` for debug):

- Paired with an already-visible surface next to them: `login.tsx:68`, `get-started.tsx:74`, `unfamiliar.tsx:147`, `trusted-contact-setup.tsx:134`, `roadside.tsx:594`
- Degraded experience but not failure: `pulled-over.tsx:344` (mic permission for waveform), `home.tsx:1593` (fetchAndCenter on app launch), `search.tsx:318` (background location), `report.tsx:207` (photo durable-copy fallback), `roadside.tsx:133` (reverse-geocode for label)
- Internal plumbing not user-facing: `pulled-over.tsx:391, :396, :529, :1055` (recorder stop / no-URI guard / manual stop / contact pick already handled elsewhere)
- System API issue (usually user cancel): `ReportDetailCard.tsx:152` (iOS share sheet)

---

## Testing

The project has no test runner; norm is `tsc + node assertions + manual device/sim smoke`. This PR matches that.

- **`tsc` is the primary gate.** The discriminated union in `useHydratedResource` forces the three-way narrow at every consumer (compile-error to skip the `!ok` case). The exhaustive `ERROR_COPY` table forces every (domain, disposition) slot to exist.
- **Manual smoke** per site (3 newly-visible Group B + spot-check 5-6 high-value Group A): trigger the failure (inject adapter throw, revert before final commit), confirm the surface renders, copy matches the table, no `console.warn` formatting regression at the migrated sites.
- **`useRecordings` walk:** cold-launch `/recordings` with stored data → list renders; with no data → empty state; with injected `getRecordings` throw → `<SafetyErrorMessage domain="load" disposition="transient" />` renders cleanly. Bulk-delete with injected `removeRecordingFromStore` throw → Alert surfaces, items reappear on rollback.

---

## Files

- **Create:** `hooks/useHydratedResource.ts`
- **Create:** `lib/error-copy.ts` (the table)
- **Create:** `lib/error-message.ts` (or co-located with the table — `getErrorMessage`)
- **Create:** `components/SafetyErrorMessage.tsx`
- **Modify (hook + 2 callers):** `hooks/useRecordings.ts`, `app/recordings.tsx`, `app/pulled-over.tsx`
- **Modify (Group A migrations — 24 caller sites across ~15 files):** see Migration Map
- **Modify (Group B surface decisions — 3 caller sites):** `app/recordings.tsx`, `app/pulled-over.tsx`, `app/search.tsx`
- **Modify (P-C banner refactor):** `components/RecordingSaveErrorBanner.tsx` — internal copy → `getErrorMessage`

## Atomic-commit constraint

Same as PR #1 and PR #2: a breaking change cannot land without all consumers updated in the same commit. The seven-task sequence below respects that constraint; each task is one reviewable unit.

## Verification (definition of done)

- [ ] `tsc` passes with no errors after **each** commit
- [ ] No string literal "Try again" or "try again" appears in user-facing copy outside `lib/error-copy.ts`
- [ ] Every existing `console.warn('[domain] xyz failed', err)` at migrated sites is removed (replaced by `getErrorMessage`'s internal log)
- [ ] All 24 Group A sites migrated; all 18 Group B sites resolved (3 newly user-visible, 15 explicitly silent with retained `console.warn`)
- [ ] `useRecordings` exposes the three-way `RecordingsState` discriminated union; `app/recordings.tsx` performs the three-way narrow; `app/pulled-over.tsx` uses `state.add.run(...)`
- [ ] `RecordingSaveErrorBanner`'s hardcoded copy replaced by `getErrorMessage` call
- [ ] Cold-launch smoke on `/recordings`: no flash (the three-way narrow renders chrome → SafetyErrorMessage OR empty/list immediately on `ready`)
- [ ] No domain logic changed — only error-surface plumbing replaced
- [ ] Sprint 1 complete after merge

## Sequencing

PR #3 of the Sprint 1 trio (closer). Within it, sequence so the system lands before any migration:

1. `useHydratedResource` primitive (pure additive, no callers)
2. `lib/error-copy.ts` + `getErrorMessage` + `<SafetyErrorMessage>` (pure additive, no callers)
3. `RecordingSaveErrorBanner` refactor (smallest migration; proves `getErrorMessage` against PR #2's banner)
4. Group A migrations — 24 sites across ~15 files (mechanical sweep; tsc red until all done)
5. `useRecordings` migration — hook + `/recordings` + `/pulled-over` add call
6. Group B surface decisions — 3 newly-visible sites
7. Final verification + PR

PR #3 closes Sprint 1. Sprint 2 (synthesis PRs 4-10: tap-target geometry, settings value population, VoiceOver hint depth, coach-mark recoverability, Dynamic Type audit, dismissal standardization, reserved-color audit) is the next planning surface.
