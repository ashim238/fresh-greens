# Safety Guardrails — Design Spec

**Date:** 2026-06-20
**Status:** Approved (brainstorm complete; awaiting plan)
**Phase:** Design Health Program — Phase 3 PR D (of A/B/C/D/E)
**Synthesis source:** [`phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) Section 5

---

## Goal

Close four Phase 1 critique items that share one theme: **driving-surface interactions whose consequence is significant must not be one-tap.** A tired, stressed, or distracted driver should be funnelled into a deliberate gesture before any action that costs them money, time, or attention budget — calling 911, escalating a flow they can't easily back out of, or pulling their eyes off the road.

The four items:

1. **P0-2 en-route SOS one-tap** — bare `onPress` on the bespoke red `sidebtn-sos.svg` jumps straight to `/emergency`. Accidental brush during routine driving opens the crisis surface.
2. **P0-3 roadside Step 3 trap** — `usePreventRemove` legitimately blocks swipe-back during an active share session, but a user who advanced *by accident* (the share toggle auto-advances) can only escape by committing "I'm back on the road" (a state commitment they may not mean).
3. **P0-7 safety-settings SOS row** — "Emergency SOS" sits in the same `RowGroup` as "Trusted Contact" and "Recordings"; visually identical weight, mis-tap routes to `/emergency`.
4. **P1-9 en-route hazard auto-expand** — entering an OSM zone yanks the bottom sheet expanded for 5 seconds with no driver action. Eyes-off-road risk at speed.

These are not synthesis-overcount items. Each is a real interaction-design decision, and the synthesis is correct about all four. Ship them together as PR D.

---

## How each surface works today (verified)

### P0-2 — `app/en-route.tsx` SOS FAB (~line 2089)
```tsx
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
```
Bare one-tap. The light `Haptics.selectionAsync()` is a press-feedback, not a confirm. The button is the LOUDEST affordance in the side-FAB column (bespoke red burst, the only non-white FAB).

### P0-3 — `app/roadside.tsx` `LiveStatus` step (~line 504)
`usePreventRemove(step === 'status', noop)` blocks nav-system removal (swipe-down, back-gesture) — legitimate, because there's an active share session on this step. `LiveStatus` renders two CTAs:
- `"Switch to Pulled-over mode"` (`onSwitchToPulledOver` → `router.replace('/pulled-over')`)
- `"I'm back on the road"` (`onBackOnRoad` → `router.back()`) — the deliberate exit, **but it commits a state**

There's no "back to Step 2" path. A user who accidentally toggled the share switch (Step 2 → auto-advance to Step 3) cannot return to the action menu to fix the share state without committing exit.

### P0-7 — `app/safety-settings.tsx` (~line 100)
```tsx
<RowGroup footer="Reach a trusted contact or 911.">
  <SettingsRow icon={<Asterisk ... red />} label="Emergency SOS" onPress={... '/emergency'} />
  <SettingsRow icon={<UserCircle .../>} label="Trusted Contact" .../>
  <SettingsRow icon={<Microphone .../>} label="Recordings" .../>
</RowGroup>
```
Three rows of the same visual weight; SOS is the only operational one, the other two are configurational.

### P1-9 — `app/en-route.tsx` auto-expand effect (~line 938)
```ts
useEffect(() => {
  let entered = false;
  for (const id of enteredZoneIds) {
    if (!prevEnteredZoneIdsRef.current.has(id)) { entered = true; break; }
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
The haptic ping is fine — it's a non-visual signal. The `setSheetExpanded(true)` + 5s auto-collapse is the eye-grab.

---

## Scope

**6 commits, 4 files modified + 1 file added.** Sequenced low-blast-first; each commit is independently reviewable.

| # | Commit | Files | Effort |
|---|---|---|---|
| 1 | `fix(safety-settings): split SOS into its own RowGroup` | `app/safety-settings.tsx` | trivial |
| 2 | `fix(en-route): remove hazard auto-expand visual (keep haptic ping)` | `app/en-route.tsx` | small |
| 3 | `fix(roadside): add back-to-Step-2 X close on Step 3` | `app/roadside.tsx` | small-medium |
| 4 | `feat(hooks): add useHoldToConfirm primitive` | `hooks/useHoldToConfirm.ts` (new) | medium |
| 5 | `feat(en-route): SOS hold-to-confirm with visual + haptic ramp` | `app/en-route.tsx` | medium |
| 6 | `docs(cursorrules): codify safety-critical-interaction convention` | `.cursorrules` | trivial |

**Out of scope (deliberate, deferred via `docs/next-session.md`):**
- Two-tap-arm pattern as an alternative to hold (not yet needed; add when a surface needs it).
- Compact hazard pill in the en-route toolbar (a new feature; PR D removes the unsafe behavior, doesn't add chrome).
- Safety-settings: red destructive label or other amplification on the SOS row (the red `Asterisk` icon already signals; doubling up over-signals).

---

## Design

### Commit 1 — P0-7: split SOS into its own RowGroup

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

iOS Settings-canonical: operational rows (Reset / Sign Out / SOS) live in their own group. The two footers explain the register difference: SOS is *what tapping does*, the other group is *what tapping configures*. No new component, no token changes.

### Commit 2 — P1-9: remove hazard auto-expand visual

The auto-expand effect retains the haptic ping (the non-visual signal that a zone was entered) and the change-detection bookkeeping. Only the `setSheetExpanded(true)` + 5s `setTimeout` is removed. The auto-collapse timer ref + cleanup effect are removed entirely (no timer to clean up).

```ts
useEffect(() => {
  let entered = false;
  for (const id of enteredZoneIds) {
    if (!prevEnteredZoneIdsRef.current.has(id)) { entered = true; break; }
  }
  prevEnteredZoneIdsRef.current = enteredZoneIds;
  if (!entered) return;

  // Light haptic ping signals the zone entry without yanking the
  // driver's eyes off the road. Manual DragHandle expand is the
  // user-controlled path to see details.
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}, [enteredZoneIds]);
```

`handleDragHandleToggle` simplifies: no auto-collapse timer to cancel. The user expands the sheet whenever *they* choose.

### Commit 3 — P0-3: roadside Step 3 X close → back to Step 2

The parent (`Roadside`) gains a handler:
```ts
function handleBackToActions() {
  setStep('action');
}
```

`LiveStatus` gains an `onBackToActions: () => void` prop and renders an X close at the top-right of its scroll view (above the "Hang tight." subtitle):

```tsx
<View style={styles.statusTopChrome}>
  <Pressable
    onPress={onBackToActions}
    accessibilityRole="button"
    accessibilityLabel="Back to actions"
    style={({ pressed }) => [tapTarget44, pressed && pressedDim, styles.statusBackBtn]}
  >
    <X size={24} color={colors.labelSecondary} weight="regular" />
  </Pressable>
</View>
```

Positioned per the `## Dismissal` convention (top-right, ≥44pt painted, no `hitSlop`). Tapping returns to Step 2 — the share state is preserved, the user can toggle off and re-advance deliberately, or re-pick an action. `usePreventRemove` is unchanged (still protects against accidental nav-system removal). The "I'm back on the road" CTA stays as the deliberate-exit path.

### Commit 4 — `useHoldToConfirm` primitive

```ts
// hooks/useHoldToConfirm.ts
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

Pure hook, no UI. Returns the `Animated.Value` so the consumer renders whatever visual ramp it wants. The `useNativeDriver: false` is required because the consumer interpolates it into a `borderColor` / `opacity` (style props the native driver can't drive).

### Commit 5 — en-route SOS hold-to-confirm

Replace the bare `onPress` with the hold pattern. The visual ramp is an `Animated.View` ring overlaid on the FAB whose `opacity` interpolates with `holdProgress`. Ring uses `colors.red` (reserved-color rule unchanged — the SOS button is the canonical red carve-out, and the ring amplifies the existing affordance):

```tsx
// new imports near the top of app/en-route.tsx:
import { Animated } from 'react-native';
import { useHoldToConfirm } from '../hooks/useHoldToConfirm';

// inside the component:
const sosHold = useHoldToConfirm({
  thresholdMs: 800,
  onConfirm: () => {
    router.push('/emergency');
  },
});

// inside the SideFabRow for SOS:
<SideFabRow label="SOS" showLabel={sideFabCoach.visible}>
  <View style={styles.sosHoldWrap}>
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sosHoldRing,
        { opacity: sosHold.holdProgress },
      ]}
    />
    <FloatingActionButton
      size="56"
      {...sosHold.pressHandlers}
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

New styles (added to the existing `StyleSheet.create`):
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

The ring is 64pt (vs the 56pt FAB) so it reads as an *expanding glow* without animating size. Initial opacity is 0; ramps to 1 over the 800ms hold. On release before threshold: animates back to 0 in 120ms (the cleanup easing).

**`FloatingActionButton` does NOT currently accept `onPressIn` / `onPressOut`.** This is a required FAB component extension — add the two props alongside the existing `onPress`/`onLongPress` and thread them to the underlying `Pressable`. Pure additive; no existing call site changes behavior.

### Commit 6 — `.cursorrules ## Safety-critical interactions`

New section after `## Accessibility (VoiceOver)`, before `## Code conventions`:

> **## Safety-critical interactions**
> Driving-surface actions whose consequence is significant — calling 911, navigating to the SOS surface, sharing live location with a contact, ending an active recording — require an **intent gesture**, not a one-tap. The canonical pattern is `useHoldToConfirm` from `hooks/useHoldToConfirm.ts`: 800ms hold + visual ramp (opacity 0→1 on an overlaid ring) + light haptic ramp (200/400/600ms `ImpactFeedbackStyle.Light`) + success haptic on confirm + silent cancel on release (no "denied" buzz — reads as alarming). VoiceOver users get a single-tap bypass (`AccessibilityInfo.isScreenReaderEnabled`) — they're intentional by definition. Two-tap-with-arm-state is a sanctioned alternative when long-press is unavailable (e.g., a map FAB whose long-press already opens a context menu).
>
> Non-driving surfaces (Settings screens, post-trip recaps, in-app modals) do not need the hold — they're not under driver attention budget. The `/safety-settings` "Emergency SOS" row, for example, is one-tap (it's in a Settings context, not on the driving map).

---

## Testing

- **`tsc --noEmit`** clean after every commit.
- **No test runner.** Behavior is real-device-only.

### Smoke (user's responsibility, real device required):
- **P0-7:** `/safety-settings` shows two grouped cards — SOS alone above; Trusted Contact + Recordings below. Footers read as specified.
- **P1-9:** `/en-route` driving through an OSM zone: a light haptic ping fires on entry; the sheet does NOT yank expanded. Manually pulling the DragHandle still works.
- **P0-3:** `/roadside` Step 2 → toggle share ON → auto-advances to Step 3 → tap top-right X → returns to Step 2 with share state preserved.
- **P0-2:** `/en-route` SOS FAB:
  - Tap-and-release quickly → no nav; no haptic buzz; ring fades back.
  - Press and hold ~800ms → ring opacity ramps; 3 light haptic taps build up; success haptic fires; navigates to `/emergency`.
  - With VoiceOver on: focus SOS button, single double-tap → navigates immediately.

### Smoke-time tuning (call out if it feels off):
- 800ms hold threshold (iOS canonical long-press).
- Haptic ramp at 200/400/600ms.
- Linear opacity ramp; switch to ease-in if it reads mechanical.

---

## Files

- **Modify:** `app/safety-settings.tsx` (Commit 1)
- **Modify:** `app/en-route.tsx` (Commits 2, 5)
- **Modify:** `app/roadside.tsx` (Commit 3)
- **Modify:** `components/FloatingActionButton.tsx` (Commit 5 — `onPressIn`/`onPressOut` passthrough)
- **Add:** `hooks/useHoldToConfirm.ts` (Commit 4)
- **Modify:** `.cursorrules` (Commit 6)
- **Untouched (deliberate):** `/emergency`, `/pulled-over`, `/safety` — those surfaces already have their own confirm gates appropriate to context (countdown for trusted-contact dial, recording arm-state, share-session start).

## Verification (definition of done)

- [ ] `tsc --noEmit` clean after every commit.
- [ ] `/safety-settings` renders SOS in its own RowGroup; the two footers match the spec wording.
- [ ] `/en-route` zone entry: haptic ping fires; sheet does not expand; `autoCollapseTimerRef` + its cleanup effect are removed; `handleDragHandleToggle` no longer references the timer.
- [ ] `/roadside` Step 3 has a top-right X (`tapTarget44`, Phosphor `X` 24pt, `labelSecondary`) that returns to Step 2 without committing exit; `usePreventRemove` unchanged.
- [ ] `hooks/useHoldToConfirm.ts` exists; returns `{ holdProgress, pressHandlers: {onPressIn, onPressOut, onPress}, isVoiceOverOn }`; cleans up timers on unmount.
- [ ] `components/FloatingActionButton.tsx` accepts `onPressIn` and `onPressOut` props (pure additive).
- [ ] `/en-route` SOS FAB: bare `onPress` removed; `useHoldToConfirm` wired; `Animated.View` ring overlays the FAB; `accessibilityHint` branches on `isVoiceOverOn`.
- [ ] `.cursorrules` has a new `## Safety-critical interactions` section with the wording above.
- [ ] No reserved-color violations; no `hitSlop` introduced; tap-target rule respected on the new X close.
- [ ] No other screen / hook touched.

## Sequencing

PR D of Phase 3. Six atomic commits, low-blast-first:

1. `fix(safety-settings): split SOS into its own RowGroup` — trivial structural fix.
2. `fix(en-route): remove hazard auto-expand visual (keep haptic ping)` — drop unsafe behavior.
3. `fix(roadside): add back-to-Step-2 X close on Step 3` — small add per the Dismissal convention.
4. `feat(hooks): add useHoldToConfirm primitive` — new hook; no consumer yet.
5. `feat(en-route): SOS hold-to-confirm with visual + haptic ramp` — wire the hook; the biggest single item.
6. `docs(cursorrules): codify safety-critical-interaction convention` — codify the pattern.

After PR D merges, Phase 3 has 2 items + the final audit remaining (PR E: speed-limit "—" + pulled-over contact CTA; then thorough critique/audit). PR E needs its own brainstorm; the closing audit closes the program.
