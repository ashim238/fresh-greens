# Safety Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four Phase 1 safety-critical interaction items in one PR — safety-settings SOS row separation, en-route hazard auto-expand kill, roadside Step 3 back-X, and en-route SOS hold-to-confirm (the headline) — plus codify the hold-to-confirm pattern as a `.cursorrules` convention.

**Architecture:** Six atomic commits low-blast-first. One new hook (`useHoldToConfirm`) factors the SOS pattern so future safety surfaces inherit it. Zero new dependencies (`expo-haptics`, `Animated`, `AccessibilityInfo` are already in the project).

**Tech Stack:** React Native + Expo, TypeScript, expo-haptics, react-native Animated + AccessibilityInfo, no test runner. Real-device smoke is essential — agents cannot test hold-timing feel, haptic ramp pacing, or visual ramp tuning.

**Spec:** [`docs/superpowers/specs/2026-06-20-safety-guardrails-design.md`](../specs/2026-06-20-safety-guardrails-design.md)

---

## Pre-flight: branch

```bash
git checkout main && git pull --ff-only origin main
git checkout -b feat/phase3-safety-guardrails
```

Do NOT implement on `main`.

## File Structure

| File | Touched in commit |
|---|---|
| `app/safety-settings.tsx` | 1 |
| `app/en-route.tsx` | 2, 5 |
| `app/roadside.tsx` | 3 |
| `hooks/useHoldToConfirm.ts` (NEW) | 4 |
| `components/FloatingActionButton.tsx` | 5 |
| `.cursorrules` | 6 |

**Context the implementer needs:**
- Imports: `app/en-route.tsx` does NOT yet import `Animated` from `react-native` — add to existing react-native import. `app/roadside.tsx` does NOT import `tapTarget44` (only `pressedDim`) and does NOT import the Phosphor `X` icon — both must be added.
- `reduceMotion` is used in TWO places in `app/en-route.tsx` (auto-expand effect AND the arrival ETA pulse at ~line 1082). Do NOT remove the `useReduceMotion()` hook call; only drop it from the auto-expand dependency array since the effect no longer uses the variable.
- The new ring overlay color `colors.red` is the SOS button's reserved-color carve-out (sanctioned by `.cursorrules` `## Reserved-color rule` carve-out #5 / SOS pattern); the ring is part of the same affordance.

---

### Task 1: split safety-settings SOS into its own RowGroup

**Files:** `app/safety-settings.tsx` (~lines 100–122)

- [ ] **Step 1: Edit the RowGroup block**

The current single RowGroup with three rows reads:

```tsx
<RowGroup footer="Reach a trusted contact or 911.">
  <SettingsRow
    icon={<Asterisk size={24} color={colors.red} weight="bold" />}
    label="Emergency SOS"
    onPress={() => router.push('/emergency')}
    accessibilityHint="Opens the SOS screen to call your trusted contact or 911"
  />
  <SettingsRow
    icon={<UserCircle size={24} color={colors.black} weight="duotone" />}
    label="Trusted Contact"
    value={trustedContactValue}
    onPress={handleEditTrustedContact}
  />
  <SettingsRow
    icon={<Microphone size={24} color={colors.black} weight="duotone" />}
    label="Recordings"
    value={recordingsValue}
    onPress={handleRecordings}
  />
</RowGroup>
```

Replace with two RowGroups:

```tsx
<RowGroup footer="One-tap path to call your trusted contact or 911.">
  <SettingsRow
    icon={<Asterisk size={24} color={colors.red} weight="bold" />}
    label="Emergency SOS"
    onPress={() => router.push('/emergency')}
    accessibilityHint="Opens the SOS screen to call your trusted contact or 911"
  />
</RowGroup>

<RowGroup footer="Configure your safety options.">
  <SettingsRow
    icon={<UserCircle size={24} color={colors.black} weight="duotone" />}
    label="Trusted Contact"
    value={trustedContactValue}
    onPress={handleEditTrustedContact}
  />
  <SettingsRow
    icon={<Microphone size={24} color={colors.black} weight="duotone" />}
    label="Recordings"
    value={recordingsValue}
    onPress={handleRecordings}
  />
</RowGroup>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Inspect the diff**

Run: `git diff app/safety-settings.tsx`
Expected: the single RowGroup becomes two; the SOS row moves into the first group; the two footers read as specified. No other change in the file (no imports, no styles, no handlers).

- [ ] **Step 4: Commit**

```bash
git add app/safety-settings.tsx
git commit -m "fix(safety-settings): split SOS into its own RowGroup

Phase 1 critique P0-7: SOS row was visually identical to Trusted
Contact + Recordings in the same RowGroup; a mis-tap routed to
/emergency. iOS Settings-canonical pattern is to scope operational
rows (Reset / Sign Out / SOS) into their own group. Split:
- Group 1: 'One-tap path to call your trusted contact or 911.' — SOS only.
- Group 2: 'Configure your safety options.' — Trusted Contact + Recordings.

No new component, no token changes. Structural fix.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: remove en-route hazard auto-expand visual

**Files:** `app/en-route.tsx` (~lines 938–986)

- [ ] **Step 1: Edit the auto-expand `useEffect`**

The current effect (~line 938) reads:

```ts
useEffect(() => {
  let entered = false;
  for (const id of enteredZoneIds) {
    if (!prevEnteredZoneIdsRef.current.has(id)) {
      entered = true;
      break;
    }
  }
  prevEnteredZoneIdsRef.current = enteredZoneIds;
  if (!entered) return;

  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  if (!reduceMotion) {
    setSheetExpanded(true);
    if (autoCollapseTimerRef.current) clearTimeout(autoCollapseTimerRef.current);
    autoCollapseTimerRef.current = setTimeout(() => {
      setSheetExpanded(false);
      autoCollapseTimerRef.current = null;
    }, 5000);
  }
}, [enteredZoneIds, reduceMotion]);
```

Replace with:

```ts
useEffect(() => {
  let entered = false;
  for (const id of enteredZoneIds) {
    if (!prevEnteredZoneIdsRef.current.has(id)) {
      entered = true;
      break;
    }
  }
  prevEnteredZoneIdsRef.current = enteredZoneIds;
  if (!entered) return;

  // Light haptic ping signals the zone entry without yanking the
  // driver's eyes off the road. Manual DragHandle expand is the
  // user-controlled path to see details. The auto-expand v1
  // behavior was a P1 in the 2026-06-19 Phase 1 critique.
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}, [enteredZoneIds]);
```

The dep array drops `reduceMotion` (no longer used inside the effect). `reduceMotion` itself stays as a top-level component variable — it's still used by the ETA pulse effect at ~line 1082.

- [ ] **Step 2: Remove the `autoCollapseTimerRef` declaration**

Find the line (~line 945):

```ts
const autoCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
  null,
);
```

Delete it.

- [ ] **Step 3: Remove the cleanup `useEffect` for the timer**

Find the cleanup effect immediately after the auto-expand effect (~line 970):

```ts
// Cleanup the auto-collapse timer on unmount so a pending callback
// never fires after the screen is gone.
useEffect(() => {
  return () => {
    if (autoCollapseTimerRef.current) clearTimeout(autoCollapseTimerRef.current);
  };
}, []);
```

Delete this entire block including its preceding comment.

- [ ] **Step 4: Simplify `handleDragHandleToggle`**

Find the callback (~line 981):

```ts
const handleDragHandleToggle = useCallback(() => {
  if (autoCollapseTimerRef.current) {
    clearTimeout(autoCollapseTimerRef.current);
    autoCollapseTimerRef.current = null;
  }
  setSheetExpanded((v) => !v);
}, []);
```

Replace with:

```ts
const handleDragHandleToggle = useCallback(() => {
  setSheetExpanded((v) => !v);
}, []);
```

The preceding comment about cancelling the auto-collapse is now stale — delete it too if present.

- [ ] **Step 5: Confirm `autoCollapseTimerRef` has no remaining references**

Run: `rg "autoCollapseTimerRef" app/en-route.tsx`
Expected: empty output.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Inspect the diff**

Run: `git diff app/en-route.tsx`
Expected: simplifications only — no new code outside the comment update inside the effect; `setSheetExpanded` no longer called from the auto-expand path; cleanup effect gone; `handleDragHandleToggle` shorter.

- [ ] **Step 8: Commit**

```bash
git add app/en-route.tsx
git commit -m "fix(en-route): remove hazard auto-expand visual (keep haptic ping)

Phase 1 critique P1-9: auto-expanding the hazard sheet on zone entry
yanks driver eyes off the road for 5 seconds — at 60mph that is ~176ft
of unwatched road. The haptic ping already conveys 'something just
happened'; keep it. The visual expand was the unsafe half.

Removes:
- setSheetExpanded(true) + 5s setTimeout auto-collapse
- autoCollapseTimerRef + its cleanup useEffect
- the timer-cancel branch in handleDragHandleToggle

Keeps:
- prevEnteredZoneIdsRef change detection
- Haptics.impactAsync(Light) on zone entry
- Manual DragHandle expand (user-controlled)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: roadside Step 3 back-to-Step-2 X close

**Files:** `app/roadside.tsx`

- [ ] **Step 1: Add Phosphor `X` import**

The file imports CaretLeft / CaretRight / CarBattery / etc. but does NOT import `X`. Add (alphabetically among the Phosphor imports around lines 21–31):

```ts
import { X } from 'phosphor-react-native/src/icons/X';
```

- [ ] **Step 2: Add `tapTarget44` to the interaction import**

The file currently imports only `pressedDim`. Change line 44:

```ts
import { pressedDim, tapTarget44 } from '../theme/interaction';
```

- [ ] **Step 3: Add the `handleBackToActions` handler in `Roadside`**

Locate `handleBackToProblem` (~line 148). Insert immediately below:

```ts
function handleBackToActions() {
  // Per Phase 1 P0-3: Step 3 was a trap. The "I'm back on the road"
  // CTA was the only exit but it commits state. This non-committing
  // path returns to Step 2 so a user who advanced by accident (e.g.
  // share toggle auto-advance) can recover without losing their
  // roadside flow.
  setStep('action');
}
```

- [ ] **Step 4: Pass the new prop to `<LiveStatus />`**

In the parent render (~line 201):

```tsx
{step === 'status' && (
  <LiveStatus
    problem={problem}
    locationLabel={locationLabel ?? 'Your location'}
    shareOn={shareOn}
    shareToggledAtIso={shareToggledAtIso}
    onBackOnRoad={() => router.back()}
    onSwitchToPulledOver={() => router.replace('/pulled-over')}
    onBackToActions={handleBackToActions}
  />
)}
```

- [ ] **Step 5: Extend `LiveStatus` props**

Locate the LiveStatus signature (~line 468):

```ts
function LiveStatus({
  problem,
  locationLabel,
  shareOn,
  shareToggledAtIso,
  onBackOnRoad,
  onSwitchToPulledOver,
}: {
  problem: ProblemType | null;
  locationLabel: string;
  shareOn: boolean;
  shareToggledAtIso: string | null;
  onBackOnRoad: () => void;
  onSwitchToPulledOver: () => void;
}) {
```

Replace with (add `onBackToActions` to both destructure and type):

```ts
function LiveStatus({
  problem,
  locationLabel,
  shareOn,
  shareToggledAtIso,
  onBackOnRoad,
  onSwitchToPulledOver,
  onBackToActions,
}: {
  problem: ProblemType | null;
  locationLabel: string;
  shareOn: boolean;
  shareToggledAtIso: string | null;
  onBackOnRoad: () => void;
  onSwitchToPulledOver: () => void;
  onBackToActions: () => void;
}) {
```

- [ ] **Step 6: Render the X close at the top of `LiveStatus`**

The body currently begins (~line 504):

```tsx
return (
  <ScrollView
    contentContainerStyle={styles.stepBody}
    showsVerticalScrollIndicator={false}
  >
    <Text style={[styles.subtitle, { marginTop: spacing.sm }]}>Hang tight.</Text>
```

Insert a top-chrome row immediately before the `<Text style={[styles.subtitle, ...]}>Hang tight.</Text>`:

```tsx
return (
  <ScrollView
    contentContainerStyle={styles.stepBody}
    showsVerticalScrollIndicator={false}
  >
    <View style={styles.statusTopChrome}>
      <Pressable
        onPress={onBackToActions}
        accessibilityRole="button"
        accessibilityLabel="Back to actions"
        style={({ pressed }) => [tapTarget44, pressed && pressedDim]}
      >
        <X size={24} color={colors.labelSecondary} weight="regular" />
      </Pressable>
    </View>
    <Text style={[styles.subtitle, { marginTop: spacing.sm }]}>Hang tight.</Text>
```

- [ ] **Step 7: Add the `statusTopChrome` style**

Locate the `styles = StyleSheet.create({ ... })` block at the bottom of the file. Add a new entry alongside existing styles (placement is style-block order; insert near `stepBody` or in the alphabetical position you prefer):

```ts
statusTopChrome: {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  // tapTarget44 provides the 44pt painted floor on the Pressable.
  // The row container right-aligns it per the Dismissal convention.
},
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 9: Inspect the diff**

Run: `git diff app/roadside.tsx`
Expected: two import additions (X, tapTarget44), one new handler, one prop added to LiveStatus + its callsite, one new top-chrome View block in the LiveStatus render, one new style. `usePreventRemove` unchanged. Existing "I'm back on the road" + "Switch to Pulled-over mode" CTAs unchanged.

- [ ] **Step 10: Commit**

```bash
git add app/roadside.tsx
git commit -m "fix(roadside): add back-to-Step-2 X close on Step 3

Phase 1 critique P0-3: Step 3 ('status') was a trap. usePreventRemove
legitimately blocks swipe-back during an active share session, but
the only labeled exit was 'I'm back on the road' — which commits a
state the user may not mean. A user who advanced by accident (share
toggle auto-advances) couldn't return to Step 2 to fix the share state.

New: top-right X close (Phosphor X, labelSecondary, 24pt glyph in
tapTarget44 painted target per the .cursorrules ## Dismissal
convention). Tapping returns to Step 2 ('action') — share state
preserved, no commitment. usePreventRemove unchanged. 'I'm back on
the road' and 'Switch to Pulled-over mode' CTAs unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `useHoldToConfirm` primitive

**Files:** `hooks/useHoldToConfirm.ts` (NEW)

- [ ] **Step 1: Create the file with the full implementation**

Write `hooks/useHoldToConfirm.ts` with this exact content:

```ts
import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

type HoldHandlers = {
  onPressIn: () => void;
  onPressOut: () => void;
  onPress?: () => void; // VoiceOver bypass path
};

/**
 * Press-and-hold confirmation for safety-critical actions on driving
 * surfaces (e.g. en-route SOS). Returns an Animated.Value that ramps
 * 0→1 over `thresholdMs` while held, and handlers to spread onto a
 * Pressable. On release before threshold: silent cancel (the user just
 * learned the gesture; a "denied" buzz reads as alarming). At threshold:
 * success haptic + onConfirm.
 *
 * VoiceOver bypass: when AccessibilityInfo.isScreenReaderEnabled is true,
 * the Pressable's `onPress` fires onConfirm immediately on tap. Hold-
 * timing is fiddly with screen readers, and VoiceOver users are
 * intentional by definition (a screen reader user does not accidentally
 * double-tap the SOS button).
 *
 * Per .cursorrules ## Safety-critical interactions.
 */
export function useHoldToConfirm({
  thresholdMs = 800,
  onConfirm,
}: {
  thresholdMs?: number;
  onConfirm: () => void;
}): { holdProgress: Animated.Value; pressHandlers: HoldHandlers; isVoiceOverOn: boolean } {
  const holdProgress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const voiceOverRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (!cancelled) voiceOverRef.current = on;
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (on) => {
      voiceOverRef.current = on;
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    for (const t of hapticTimersRef.current) clearTimeout(t);
    hapticTimersRef.current = [];
    holdProgress.stopAnimation();
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 120,
      useNativeDriver: false,
    }).start();
  }, [holdProgress]);

  const onPressIn = useCallback(() => {
    if (voiceOverRef.current) return; // VoiceOver bypass uses onPress
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: thresholdMs,
      useNativeDriver: false,
    }).start();
    // Light haptic ramp at 200 / 400 / 600 ms — confirming buildup, not alarm.
    hapticTimersRef.current = [200, 400, 600].map((delay) =>
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, delay),
    );
    timerRef.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      onConfirm();
      timerRef.current = null;
    }, thresholdMs);
  }, [holdProgress, thresholdMs, onConfirm]);

  const onPressOut = useCallback(() => {
    if (voiceOverRef.current) return;
    cleanup();
  }, [cleanup]);

  const onPress = useCallback(() => {
    if (!voiceOverRef.current) return;
    onConfirm();
  }, [onConfirm]);

  useEffect(() => cleanup, [cleanup]);

  return {
    holdProgress,
    pressHandlers: { onPressIn, onPressOut, onPress },
    isVoiceOverOn: voiceOverRef.current,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. (The hook must compile cleanly even with no consumer yet.)

- [ ] **Step 3: Commit**

```bash
git add hooks/useHoldToConfirm.ts
git commit -m "feat(hooks): add useHoldToConfirm primitive

For safety-critical actions on driving surfaces (en-route SOS et al)
per .cursorrules ## Safety-critical interactions (added in commit 6).

Returns { holdProgress: Animated.Value, pressHandlers, isVoiceOverOn }:
- holdProgress: ramps 0→1 over thresholdMs while held; the consumer
  interpolates it for the visual ramp (opacity, scale, color).
- pressHandlers: spread onto a Pressable. onPressIn starts the timer +
  haptic ramp (200/400/600ms Light) + opacity animation; onPressOut
  before threshold cancels silently. At threshold: Success haptic +
  onConfirm.
- VoiceOver bypass: when isScreenReaderEnabled, the onPress path
  invokes onConfirm immediately. Hold-timing is fiddly with screen
  readers; VoiceOver users are intentional by definition.

No consumer in this commit — the en-route SOS wires it in commit 5.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: en-route SOS hold-to-confirm

**Files:**
- `components/FloatingActionButton.tsx`
- `app/en-route.tsx`

This commit groups the FAB extension with its first consumer.

- [ ] **Step 1: Extend `FloatingActionButton` to accept `onPressIn` / `onPressOut`**

In `components/FloatingActionButton.tsx`, locate the prop type (~line 32):

```tsx
type Props = {
  size?: '48' | '56';
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  children?: React.ReactNode;
};
```

(Exact field set may differ — look at the actual type. Add the two new fields wherever the existing onPress sits.) Add `onPressIn?: () => void;` and `onPressOut?: () => void;` to the type — alongside `onPress` / `onLongPress`. JSDoc minimally: `/** Exposed for hold-to-confirm patterns (see hooks/useHoldToConfirm). */` above the two new fields.

Destructure them in the function signature alongside `onPress`/`onLongPress`. Pass them to the underlying `Pressable`:

```tsx
<Pressable
  onPress={onPress}
  onLongPress={onLongPress}
  onPressIn={onPressIn}
  onPressOut={onPressOut}
  // ... rest unchanged
>
```

Pure additive. No existing callsite changes behavior — when the props aren't passed, they're `undefined`, which `Pressable` ignores.

- [ ] **Step 2: Type-check (FAB extension is consumed in next steps)**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Add `Animated` to the en-route react-native import**

In `app/en-route.tsx`, locate the existing `react-native` import (find the line with `View`, `StyleSheet`, etc.). Add `Animated` to the named imports.

For example if the current line reads:
```ts
import { Pressable, StyleSheet, Text, View, useWindowDimensions, ... } from 'react-native';
```

It becomes:
```ts
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions, ... } from 'react-native';
```

(Preserve the existing alphabetical/sorted order of the imports.)

- [ ] **Step 4: Import `useHoldToConfirm`**

Add to the hooks/local imports region of `app/en-route.tsx`:

```ts
import { useHoldToConfirm } from '../hooks/useHoldToConfirm';
```

- [ ] **Step 5: Wire the hook inside the en-route component**

Inside the en-route component, near the other hook calls (after `useReduceMotion` etc.), add:

```ts
const sosHold = useHoldToConfirm({
  thresholdMs: 800,
  onConfirm: () => {
    router.push('/emergency');
  },
});
```

- [ ] **Step 6: Replace the SOS SideFabRow's FAB**

Locate the SOS SideFabRow (~line 2080):

```tsx
<SideFabRow label="SOS" showLabel={sideFabCoach.visible}>
  <FloatingActionButton
    size="56"
    onPress={() => {
      Haptics.selectionAsync().catch(() => {});
      router.push('/emergency');
    }}
    accessibilityLabel="Emergency SOS"
    accessibilityHint="Opens trusted-contact and 911 options"
  >
    <SidebtnSos width={32} height={32} />
  </FloatingActionButton>
</SideFabRow>
```

Replace with:

```tsx
<SideFabRow label="SOS" showLabel={sideFabCoach.visible}>
  <View style={styles.sosHoldWrap}>
    <Animated.View
      pointerEvents="none"
      style={[styles.sosHoldRing, { opacity: sosHold.holdProgress }]}
    />
    <FloatingActionButton
      size="56"
      onPressIn={sosHold.pressHandlers.onPressIn}
      onPressOut={sosHold.pressHandlers.onPressOut}
      onPress={sosHold.pressHandlers.onPress}
      accessibilityLabel="Emergency SOS"
      accessibilityHint={
        sosHold.isVoiceOverOn
          ? 'Opens the SOS screen to call your trusted contact or 911'
          : 'Press and hold to open SOS'
      }
    >
      <SidebtnSos width={32} height={32} />
    </FloatingActionButton>
  </View>
</SideFabRow>
```

The bare `onPress` is gone. The press-feedback haptic is absorbed into the hold pattern's haptic ramp.

- [ ] **Step 7: Add the two new styles to the en-route StyleSheet**

Locate the `styles = StyleSheet.create({ ... })` in `app/en-route.tsx`. Add:

```ts
sosHoldWrap: {
  position: 'relative',
  alignItems: 'center',
  justifyContent: 'center',
},
sosHoldRing: {
  position: 'absolute',
  width: 64,
  height: 64,
  borderRadius: 32,
  borderWidth: 3,
  borderColor: colors.red,
},
```

(64pt around the 56pt FAB — reads as an expanding glow without animating size. `colors.red` is the sanctioned SOS-button reserved-color carve-out.)

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 9: Inspect the diff (both files)**

Run: `git diff components/FloatingActionButton.tsx app/en-route.tsx`
Expected: FAB gains two props pure-additively; en-route adds `Animated` to RN import, adds `useHoldToConfirm` import, adds `sosHold` hook call, swaps the SOS FAB's `onPress` for the hold-handlers wrap with an Animated.View ring, adds two new styles. No other change.

- [ ] **Step 10: Commit**

```bash
git add components/FloatingActionButton.tsx app/en-route.tsx
git commit -m "feat(en-route): SOS hold-to-confirm with visual + haptic ramp

Phase 1 critique P0-2: the bespoke red sidebtn-sos burst was bare
one-tap to /emergency. An accidental brush during routine driving
opened the crisis surface (wasted 911 calls, attention damage).

Now: 800ms press-and-hold (the iOS canonical long-press threshold).
- Visual ramp: an Animated.View ring (64×64, 3pt red border) overlaid
  on the 56pt FAB; opacity interpolates with holdProgress.
- Haptic ramp: 3 ImpactFeedbackStyle.Light at 200/400/600ms during
  the hold (confirming buildup, not alarm).
- Success haptic on confirm; silent cancel on release before threshold.
- VoiceOver bypass: single-tap fires onConfirm when
  isScreenReaderEnabled. Screen-reader users are intentional by
  definition; hold-timing is fiddly with double-tap-and-hold.

FloatingActionButton gains onPressIn/onPressOut passthrough — pure
additive, no existing callsite changes. The ring color (colors.red)
is the SOS button's sanctioned reserved-color carve-out, so the ring
amplifies the existing affordance — no new reserved use.

The 800ms threshold and ramp timing are smoke-time tunable per the spec.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: codify the safety-critical-interaction convention

**Files:** `.cursorrules`

- [ ] **Step 1: Insert a new section after `## Accessibility (VoiceOver)`**

The current `.cursorrules` reads (~lines 66 region):

```
## Accessibility (VoiceOver)
Every interactive control needs ... need no hint.

## Code conventions
```

Insert a blank line + the new section between them, so the structure becomes:

```
## Accessibility (VoiceOver)
... (unchanged)

## Safety-critical interactions
Driving-surface actions whose consequence is significant — calling 911, navigating to the SOS surface, sharing live location with a contact, ending an active recording — require an **intent gesture**, not a one-tap. The canonical pattern is `useHoldToConfirm` from `hooks/useHoldToConfirm.ts`: 800ms hold + visual ramp (opacity 0→1 on an overlaid ring) + light haptic ramp (200/400/600ms `ImpactFeedbackStyle.Light`) + success haptic on confirm + silent cancel on release (no "denied" buzz — reads as alarming). VoiceOver users get a single-tap bypass (`AccessibilityInfo.isScreenReaderEnabled`) — they're intentional by definition. Two-tap-with-arm-state is a sanctioned alternative when long-press is unavailable (e.g., a map FAB whose long-press already opens a context menu).

Non-driving surfaces (Settings screens, post-trip recaps, in-app modals) do not need the hold — they're not under driver attention budget. The `/safety-settings` "Emergency SOS" row, for example, is one-tap (it's in a Settings context, not on the driving map).

## Code conventions
... (unchanged)
```

- [ ] **Step 2: Inspect the diff**

Run: `git diff .cursorrules`
Expected: only the new `## Safety-critical interactions` section + the blank line before it. No other change.

- [ ] **Step 3: Commit**

```bash
git add .cursorrules
git commit -m "docs(cursorrules): codify safety-critical-interaction convention

The hold-to-confirm pattern (800ms + visual + haptic ramp + VoiceOver
bypass) now has a consumer (en-route SOS) and a primitive
(useHoldToConfirm). Promote it to a .cursorrules section so future
safety surfaces conform: when a driving-surface action's consequence
is significant, the canonical answer is the hold pattern, with
two-tap-arm as the sanctioned alternative when long-press is taken.

The section also names the carve-out: non-driving surfaces (Settings,
modals, recaps) are one-tap — they're not under driver attention
budget. /safety-settings 'Emergency SOS' is the explicit example.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Final verification + PR

**Files:** none modified (verification + PR only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Confirm the diff scope**

Run: `git diff main --stat`
Expected: 6 files total — `app/safety-settings.tsx`, `app/en-route.tsx`, `app/roadside.tsx`, `components/FloatingActionButton.tsx`, `hooks/useHoldToConfirm.ts` (new), `.cursorrules`. No other files.

- [ ] **Step 3: Confirm no reserved-color violations introduced**

Run: `rg "colors\.red" app/en-route.tsx app/safety-settings.tsx app/roadside.tsx components/FloatingActionButton.tsx hooks/useHoldToConfirm.ts`
Expected: the existing SOS Asterisk + the new `sosHoldRing` borderColor in `app/en-route.tsx` (both sanctioned). No new red elsewhere.

- [ ] **Step 4: Confirm no `hitSlop` introduced**

Run: `git diff main | rg '^\+.*hitSlop'`
Expected: empty output.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin feat/phase3-safety-guardrails
gh pr create --title "feat(safety): hold-to-confirm SOS + roadside back-X + auto-expand kill + SOS row split" --body "$(cat <<'EOF'
## Phase 3 PR D — safety guardrails (the headline PR of Phase 3)

Closes four Phase 1 critique items on driving-surface interactions whose consequence is significant:

| # | Item | Pri | Fix |
|---|---|---|---|
| 1 | safety-settings SOS row identical to config rows | **P0** | Split into its own RowGroup with operational footer |
| 2 | en-route hazard sheet auto-expands on zone entry | **P1** | Remove auto-expand; keep haptic ping. Driver expands via DragHandle |
| 3 | roadside Step 3 dismissal trap | **P0** | Top-right X close returns to Step 2 (preserves share state); `usePreventRemove` unchanged |
| 4 | **en-route SOS one-tap** | **P0** | **Hold-to-confirm: 800ms + opacity ramp + haptic ramp + VoiceOver bypass.** New `useHoldToConfirm` hook factors the pattern |

Plus `.cursorrules ## Safety-critical interactions` codifies the hold-to-confirm pattern so future safety surfaces conform.

### Behavior changes (real-device smoke essential)
- **en-route SOS no longer one-tap** — press and hold ~800ms; haptic and visual ramp; release before threshold cancels silently. VoiceOver users get single-tap (intentional by definition).
- **en-route hazard sheet no longer auto-expands** on zone entry. Haptic ping retained.
- **roadside Step 3 has a new top-right X** that returns to Step 2 without committing exit.

### Smoke-tunable per the spec
- 800ms hold threshold (iOS canonical long-press).
- Haptic ramp timing (200/400/600ms).
- Ring opacity curve (linear; switch to ease-in if mechanical).

### Scope
- One new hook (`useHoldToConfirm` ~80 LOC).
- `FloatingActionButton` extended pure-additively with `onPressIn`/`onPressOut`.
- No new deps; `expo-haptics`, `Animated`, `AccessibilityInfo` already in project.
- Reserved-color rule respected (ring uses the SOS button's sanctioned `colors.red` carve-out, amplifying the existing affordance).
- Tap-target / Dismissal / Accessibility conventions respected.

Spec: `docs/superpowers/specs/2026-06-20-safety-guardrails-design.md`
Plan: `docs/superpowers/plans/2026-06-20-safety-guardrails.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Report it back.

---

## Self-Review

**1. Spec coverage:**
- Spec Commit 1 (safety-settings split) → Task 1. ✓
- Spec Commit 2 (auto-expand kill, keep haptic) → Task 2 (with the 5-step decomposition: effect body, ref decl, cleanup effect, handleDragHandleToggle, verify-no-refs). ✓
- Spec Commit 3 (roadside back-X) → Task 3 (handler, prop, X+tapTarget44 imports, render, style). ✓
- Spec Commit 4 (useHoldToConfirm hook) → Task 4 with verbatim code. ✓
- Spec Commit 5 (FAB extension + en-route wiring) → Task 5 (FAB props, RN import, hook import, hook call, render swap, styles). ✓
- Spec Commit 6 (.cursorrules convention) → Task 6 with verbatim wording. ✓
- Spec Verification + behavior-change list → Task 7 Steps 2–4 + PR body. ✓

**2. Placeholder scan:** No TBD/vague steps; every code block is verbatim from the spec or anchored against verified line ranges.

**3. Type/name consistency:** `useHoldToConfirm`, `holdProgress`, `pressHandlers.{onPressIn|onPressOut|onPress}`, `isVoiceOverOn`, `sosHold`, `sosHoldWrap`/`sosHoldRing`, `handleBackToActions`/`onBackToActions`, `statusTopChrome`, `statusBackBtn` — names used consistently across Tasks 1–7. ✓

**4. Anchor verification:** Every line number in the plan was verified by direct `awk`/`rg` of the live source at planning time. `reduceMotion` correctly retained at the hook-call site; only dropped from the effect's dep array.

**5. Behavior-change surfacing:** Three behavior changes called out explicitly in the PR body. ✓

No gaps found.
