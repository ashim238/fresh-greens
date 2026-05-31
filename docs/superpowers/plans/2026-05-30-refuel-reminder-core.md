# Refuel Reminders — Plan 1 (Reminder Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the /search Fuel card real — a local, time-based refuel reminder (light car profile + cadence) that fires a recurring local notification, with a `/fuel` setup screen and live card status. (Plan 2 — on-route fuel stops in /en-route — is separate and out of scope here.)

**Architecture:** A new `lib/api/fuel.ts` AsyncStorage adapter (mirrors `preferences.ts`) holds a `FuelProfile`; new `scheduleRefuelReminder`/`cancelRefuelReminder` helpers in `lib/notifications.ts` (TIME_INTERVAL repeating trigger, mirroring `scheduleDepartureNotification`); a `useFuelProfile` hook ties storage + scheduling together; a pushed `app/fuel.tsx` screen edits the profile; the /search Fuel card gains an `onPress` + live status. Local-only, no new sensitive permission.

**Tech Stack:** React Native + Expo + TypeScript, expo-router (file-based), expo-notifications, AsyncStorage. Theme tokens at `theme/*`.

---

## ⚠️ Verification model (read first)

**This project has no test runner** (no jest, no `test` script, no test files). Per `CLAUDE.md` (user instructions, which outrank the writing-plans TDD default), verification is:
1. `npx tsc --noEmit` (typecheck).
2. A precise **manual simulator check** per task.
3. A **code-reviewer subagent** pass before merge.

So each task is **edit → typecheck → manual check → commit**, not red/green TDD.

**Typecheck command** (filters this repo's known unrelated noise):
```bash
npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40
```
Expected after every task: no output.

**Note on `app/fuel.tsx` visual fidelity:** the code below is a **functional, theme-token-correct baseline** matching the app's settings-screen register (back-chevron header, theme tokens, HIG tap targets). The card cites Figma `825:4997` for the /menu Fuel tile; a dedicated setup-screen node may exist. Per workflow, **pull the Figma and reconcile layout in the next fidelity audit** — do not block this functional plan on it.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `lib/api/fuel.ts` | FuelProfile storage (typed, async, AsyncStorage, defaults) | **Create** — mirrors `lib/api/preferences.ts` |
| `lib/notifications.ts` | Local-notification helpers | **Modify** — add `scheduleRefuelReminder` + `cancelRefuelReminder` |
| `hooks/useFuelProfile.ts` | Reactive wrapper + scheduling integration | **Create** — mirrors `hooks/usePreferences.ts` |
| `app/fuel.tsx` | Refuel-reminder setup screen (pushed route) | **Create** — no `_layout` entry needed (default push) |
| `app/search.tsx` | Fuel card onPress + live status | **Modify** — `app/search.tsx:614` Fuel card |
| `app/menu.tsx` | Sign-out cleanup | **Modify** — add fuel clear to the `Promise.all` |

Branch: `feat/refuel-reminder-core`. Squash-merge to `main` after the acceptance task.

---

### Task 1: `lib/api/fuel.ts` store

**Files:**
- Create: `lib/api/fuel.ts`

- [ ] **Step 1: Create the adapter** (mirrors `lib/api/preferences.ts` exactly)

```ts
// Fresh Greens — fuel-profile adapter.
//
// AsyncStorage-backed car/fuel profile that drives the time-based refuel
// reminder. Same architectural shape as preferences.ts / user.ts: typed
// `FuelProfile`, async public surface, AsyncStorage internals, backend
// swap-in point preserved.
//
// Time-based by design: a phone can't sense fuel level and the app has no
// mileage tracking, so the reminder is an explicit user-set cadence — not
// a fake gauge. `lastFilledAt` + `cadenceDays` derive `nextReminderAt`;
// `notificationId` is the scheduled recurring reminder (so it can be
// cancelled/rescheduled). See docs/superpowers/specs/2026-05-30-refuel-
// reminders-design.md.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fresh-greens.fuel.v1';

export type FuelType = 'gas' | 'diesel' | 'hybrid' | 'electric';

export type FuelProfile = {
  /** Optional nickname/model — "Civic". Personalizes reminder copy. */
  carName?: string;
  /** Tunes copy ("refuel" vs "recharge") and the future on-route POI query. */
  fuelType: FuelType;
  /** Remind every N days. Clamped to >= 1 by the scheduler. */
  cadenceDays: number;
  remindersEnabled: boolean;
  /** ISO — set at enable + on "I filled up". Anchors the cadence clock. */
  lastFilledAt: string | null;
  /** ISO — derived: lastFilledAt + cadenceDays. Shown in card + screen. */
  nextReminderAt: string | null;
  /** Scheduled recurring-reminder id (cancel/reschedule). */
  notificationId: string | null;
};

export const DEFAULT_FUEL_PROFILE: FuelProfile = {
  fuelType: 'gas',
  cadenceDays: 7,
  remindersEnabled: false,
  lastFilledAt: null,
  nextReminderAt: null,
  notificationId: null,
};

/** Reads stored profile merged with defaults — never returns null. */
export async function getStoredFuelProfile(): Promise<FuelProfile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FUEL_PROFILE;
    const parsed = JSON.parse(raw) as Partial<FuelProfile>;
    return { ...DEFAULT_FUEL_PROFILE, ...parsed };
  } catch (err) {
    console.warn('getStoredFuelProfile failed', err);
    return DEFAULT_FUEL_PROFILE;
  }
}

/** Persists the profile and returns the stored copy. */
export async function setStoredFuelProfile(
  profile: FuelProfile,
): Promise<FuelProfile> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

/** Removes the stored profile (sign-out cleanup, factory reset). */
export async function clearStoredFuelProfile(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 2: Typecheck**

Run the typecheck command. Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/api/fuel.ts
git commit -m "feat: fuel-profile adapter (lib/api/fuel.ts)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Reminder engine in `lib/notifications.ts`

**Files:**
- Modify: `lib/notifications.ts` (append after `scheduleDepartureNotification`)

- [ ] **Step 1: Add the import for the FuelProfile type**

At the top of `lib/notifications.ts`, the existing import is `import * as Notifications from 'expo-notifications';`. Add below it:
```ts
import type { FuelProfile } from './api/fuel';
```

- [ ] **Step 2: Append the refuel helpers** at the end of the file (after `scheduleDepartureNotification`'s closing brace)

```ts
export type RefuelScheduleResult =
  | { ok: true; identifier: string; nextReminderAt: string }
  | { ok: false; reason: 'permission-denied' | 'failed' };

/** Verb the reminder uses — electric "recharges", everything else "refuels". */
function refuelVerb(fuelType: FuelProfile['fuelType']): 'refuel' | 'recharge' {
  return fuelType === 'electric' ? 'recharge' : 'refuel';
}

/**
 * Schedules a RECURRING refuel reminder from the given profile. Cancels
 * any prior reminder first (by `profile.notificationId`). Uses a
 * TIME_INTERVAL repeating trigger (cadenceDays × 86400s) so it survives
 * the app being closed with no re-arm — unlike the one-shot DATE trigger
 * used by scheduleDepartureNotification (departure is a single event;
 * refuel recurs).
 *
 * Tradeoff (documented in the spec): a TIME_INTERVAL repeat fires at
 * (now + N days) and on that cadence — it does not pin a time-of-day.
 * Accepted for v1; a refuel nudge isn't hour-sensitive.
 *
 * Asks notification permission inline if not yet granted — reuses the
 * same flow as scheduleDepartureNotification. No new sensitive permission.
 *
 * Returns the new identifier + the derived first-fire time (nextReminderAt)
 * so the caller can persist both onto the FuelProfile.
 */
export async function scheduleRefuelReminder(
  profile: FuelProfile,
): Promise<RefuelScheduleResult> {
  // Cancel any prior reminder so we never stack duplicates.
  if (profile.notificationId) {
    await cancelRefuelReminder(profile.notificationId);
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    granted = req.granted;
  }
  if (!granted) {
    return { ok: false, reason: 'permission-denied' };
  }

  // Clamp to >= 1 day. iOS requires repeating TIME_INTERVAL seconds >= 60;
  // 1 day = 86400s clears that comfortably.
  const days = Math.max(1, Math.round(profile.cadenceDays));
  const seconds = days * 86400;
  const verb = refuelVerb(profile.fuelType);
  const subject = profile.carName ? ` the ${profile.carName}` : '';
  const nextReminderAt = new Date(Date.now() + seconds * 1000).toISOString();

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Time to ${verb}${subject}`,
        body: `It's been about ${days} day${days === 1 ? '' : 's'} — a good time to ${verb}.`,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: true,
      },
    });
    console.info(
      `[notifications] scheduled refuel reminder ${identifier} every ${days}d`,
    );
    return { ok: true, identifier, nextReminderAt };
  } catch (err) {
    console.warn('[notifications] refuel schedule failed:', err);
    return { ok: false, reason: 'failed' };
  }
}

/** Cancels a scheduled refuel reminder. Safe to call with a stale id. */
export async function cancelRefuelReminder(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (err) {
    console.warn('[notifications] refuel cancel failed:', err);
  }
}
```

- [ ] **Step 3: Typecheck**

Run the typecheck command. Expected: no output. (Confirms the `FuelProfile` import resolves and the trigger type matches expo-notifications' `SchedulableTriggerInputTypes.TIME_INTERVAL`.)

- [ ] **Step 4: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: recurring refuel-reminder scheduler in lib/notifications

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `hooks/useFuelProfile.ts`

**Files:**
- Create: `hooks/useFuelProfile.ts`

- [ ] **Step 1: Create the hook** (mirrors `hooks/usePreferences.ts`; integrates the scheduler)

```ts
import { useCallback, useEffect, useState } from 'react';

import {
  clearStoredFuelProfile,
  DEFAULT_FUEL_PROFILE,
  type FuelProfile,
  type FuelType,
  getStoredFuelProfile,
  setStoredFuelProfile,
} from '../lib/api/fuel';
import {
  cancelRefuelReminder,
  scheduleRefuelReminder,
} from '../lib/notifications';

/** The user-editable fields of a FuelProfile (the derived/internal fields
    — lastFilledAt, nextReminderAt, notificationId — are managed here). */
export type FuelProfileInput = {
  carName?: string;
  fuelType: FuelType;
  cadenceDays: number;
  remindersEnabled: boolean;
};

export type SaveResult = { ok: true } | { ok: false; reason: 'permission-denied' | 'failed' };

/**
 * Reactive wrapper around the fuel adapter + the refuel scheduler. Loads
 * the stored profile on mount; saveProfile / markFilledUp drive BOTH the
 * AsyncStorage write AND the recurring local notification, keeping the
 * stored notificationId + nextReminderAt in sync with what's actually
 * scheduled.
 *
 * Local-state only, like usePreferences — each consumer reads its own
 * snapshot (the /search card reads status; /fuel edits it; both remount).
 */
export function useFuelProfile() {
  const [profile, setProfile] = useState<FuelProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getStoredFuelProfile();
      if (!cancelled) {
        setProfile(stored);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Save the edited profile. When reminders are enabled, (re)schedule the
  // recurring notification and persist its id + nextReminderAt; the
  // cadence clock anchors to now (lastFilledAt = now). When disabled,
  // cancel any scheduled reminder and clear the derived fields.
  const saveProfile = useCallback(
    async (input: FuelProfileInput): Promise<SaveResult> => {
      const base = profile ?? DEFAULT_FUEL_PROFILE;
      const nowIso = new Date().toISOString();

      if (!input.remindersEnabled) {
        if (base.notificationId) await cancelRefuelReminder(base.notificationId);
        const next: FuelProfile = {
          ...base,
          ...input,
          lastFilledAt: null,
          nextReminderAt: null,
          notificationId: null,
        };
        setProfile(next);
        await setStoredFuelProfile(next);
        return { ok: true };
      }

      // Enabling (or re-saving while enabled): schedule from a profile that
      // carries the prior notificationId so the scheduler cancels it first.
      const toSchedule: FuelProfile = {
        ...base,
        ...input,
        lastFilledAt: nowIso,
      };
      const result = await scheduleRefuelReminder(toSchedule);
      if (!result.ok) {
        // Persist the entered fields but leave reminders OFF so the UI
        // doesn't claim a reminder exists when scheduling was refused.
        const next: FuelProfile = {
          ...toSchedule,
          remindersEnabled: false,
          nextReminderAt: null,
          notificationId: null,
        };
        setProfile(next);
        await setStoredFuelProfile(next);
        return { ok: false, reason: result.reason };
      }
      const next: FuelProfile = {
        ...toSchedule,
        nextReminderAt: result.nextReminderAt,
        notificationId: result.identifier,
      };
      setProfile(next);
      await setStoredFuelProfile(next);
      return { ok: true };
    },
    [profile],
  );

  // "I filled up" — reset the cadence clock from now (cancel + reschedule).
  const markFilledUp = useCallback(async (): Promise<SaveResult> => {
    const base = profile ?? DEFAULT_FUEL_PROFILE;
    if (!base.remindersEnabled) return { ok: true };
    const result = await scheduleRefuelReminder({
      ...base,
      lastFilledAt: new Date().toISOString(),
    });
    if (!result.ok) return { ok: false, reason: result.reason };
    const next: FuelProfile = {
      ...base,
      lastFilledAt: new Date().toISOString(),
      nextReminderAt: result.nextReminderAt,
      notificationId: result.identifier,
    };
    setProfile(next);
    await setStoredFuelProfile(next);
    return { ok: true };
  }, [profile]);

  // Sign-out / factory-reset: cancel any scheduled reminder, wipe storage.
  const clearAll = useCallback(async () => {
    const base = profile;
    if (base?.notificationId) await cancelRefuelReminder(base.notificationId);
    setProfile(null);
    await clearStoredFuelProfile();
  }, [profile]);

  return { profile, loading, saveProfile, markFilledUp, clearAll };
}
```

- [ ] **Step 2: Typecheck**

Run the typecheck command. Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add hooks/useFuelProfile.ts
git commit -m "feat: useFuelProfile hook (storage + scheduling integration)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `app/fuel.tsx` setup screen

**Files:**
- Create: `app/fuel.tsx`

> No `app/_layout.tsx` change needed — expo-router auto-registers `app/fuel.tsx` as a default pushed route (`/fuel`). Only modal screens are explicitly registered in `_layout`.

- [ ] **Step 1: Create the screen** (functional baseline; theme-token-correct; settings-screen register)

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type FuelType } from '../lib/api/fuel';
import { useFuelProfile } from '../hooks/useFuelProfile';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

const FUEL_TYPES: { id: FuelType; label: string }[] = [
  { id: 'gas', label: 'Gas' },
  { id: 'diesel', label: 'Diesel' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'electric', label: 'Electric' },
];

const MIN_DAYS = 1;
const MAX_DAYS = 60;

/**
 * /fuel — refuel-reminder setup. Pushed from the /search Fuel card.
 *
 * Time-based by design (no fuel sensing): the user sets a cadence and an
 * optional car profile; saving schedules a recurring local notification
 * via useFuelProfile. "I filled up" resets the cadence clock. See
 * docs/superpowers/specs/2026-05-30-refuel-reminders-design.md.
 *
 * Visual register matches the app's other settings screens; reconcile
 * against Figma in the next fidelity audit.
 */
export default function Fuel() {
  const router = useRouter();
  const { profile, loading, saveProfile, markFilledUp } = useFuelProfile();

  // Local form state, seeded from the stored profile once loaded.
  const [carName, setCarName] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('gas');
  const [cadenceDays, setCadenceDays] = useState(7);
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed the form once, after the profile loads.
  if (!loading && profile && !hydrated) {
    setCarName(profile.carName ?? '');
    setFuelType(profile.fuelType);
    setCadenceDays(profile.cadenceDays);
    setEnabled(profile.remindersEnabled);
    setHydrated(true);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const result = await saveProfile({
      carName: carName.trim() || undefined,
      fuelType,
      cadenceDays,
      remindersEnabled: enabled,
    });
    setSaving(false);
    if (!result.ok) {
      if (result.reason === 'permission-denied') {
        Alert.alert(
          'Notifications off',
          'Turn on notifications for Fresh Greens in Settings to get refuel reminders.',
        );
      } else {
        Alert.alert('Could not save', 'Please try again in a moment.');
      }
      return;
    }
    router.back();
  }

  async function handleFilledUp() {
    const result = await markFilledUp();
    if (!result.ok) {
      Alert.alert('Could not update', 'Please try again in a moment.');
    }
  }

  const nextLabel =
    profile?.remindersEnabled && profile.nextReminderAt
      ? new Date(profile.nextReminderAt).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : null;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={28} color={colors.black} />
          </Pressable>
          <Text style={styles.title}>Refuel reminders</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.fieldLabel}>Car name (optional)</Text>
          <TextInput
            style={styles.input}
            value={carName}
            onChangeText={setCarName}
            placeholder="e.g. Civic"
            placeholderTextColor={colors.labelTertiary}
            returnKeyType="done"
            accessibilityLabel="Car name, optional"
          />

          <Text style={styles.fieldLabel}>Fuel type</Text>
          <View style={styles.segment}>
            {FUEL_TYPES.map((ft) => {
              const selected = fuelType === ft.id;
              return (
                <Pressable
                  key={ft.id}
                  onPress={() => setFuelType(ft.id)}
                  style={({ pressed }) => [
                    styles.segmentItem,
                    selected && styles.segmentItemSelected,
                    pressed && pressedDim,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={ft.label}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                    {ft.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Remind me every</Text>
          <View style={styles.stepperRow}>
            <Pressable
              onPress={() => setCadenceDays((d) => Math.max(MIN_DAYS, d - 1))}
              style={({ pressed }) => [styles.stepBtn, pressed && pressedDim]}
              accessibilityRole="button"
              accessibilityLabel="Fewer days"
            >
              <Ionicons name="remove" size={20} color={colors.black} />
            </Pressable>
            <Text style={styles.stepValue}>
              {cadenceDays} {cadenceDays === 1 ? 'day' : 'days'}
            </Text>
            <Pressable
              onPress={() => setCadenceDays((d) => Math.min(MAX_DAYS, d + 1))}
              style={({ pressed }) => [styles.stepBtn, pressed && pressedDim]}
              accessibilityRole="button"
              accessibilityLabel="More days"
            >
              <Ionicons name="add" size={20} color={colors.black} />
            </Pressable>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Reminders on</Text>
            <Switch value={enabled} onValueChange={setEnabled} />
          </View>

          {profile?.remindersEnabled && nextLabel && (
            <View style={styles.statusBlock}>
              <Text style={styles.statusText}>Next reminder: {nextLabel}</Text>
              <Pressable
                onPress={handleFilledUp}
                style={({ pressed }) => [styles.filledBtn, pressed && pressedDim]}
                accessibilityRole="button"
                accessibilityLabel="I filled up — reset the reminder"
              >
                <Text style={styles.filledBtnText}>I filled up</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [styles.saveBtn, pressed && !saving && pressedDim]}
          accessibilityRole="button"
          accessibilityLabel="Save refuel reminder settings"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={styles.saveBtnText}>Save</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { ...typography.title2Emphasized, color: colors.black },
  body: { flex: 1, gap: spacing.md },
  fieldLabel: { ...typography.footnoteEmphasized, color: colors.labelSecondary },
  input: {
    ...typography.bodyRegular,
    color: colors.black,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.separatorSubtle,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  segment: { flexDirection: 'row', gap: spacing.sm },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.separatorSubtle,
  },
  segmentItemSelected: {
    backgroundColor: colors.freshgreen,
    borderColor: colors.freshgreen,
  },
  segmentText: { ...typography.subheadlineEmphasized, color: colors.labelSecondary },
  segmentTextSelected: { color: colors.white },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.separatorSubtle,
  },
  stepValue: { ...typography.bodyEmphasized, color: colors.black, minWidth: 72, textAlign: 'center' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  toggleLabel: { ...typography.bodyRegular, color: colors.black },
  statusBlock: { gap: spacing.sm, paddingTop: spacing.sm },
  statusText: { ...typography.footnoteRegular, color: colors.labelSecondary },
  filledBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.freshgreen,
  },
  filledBtnText: { ...typography.subheadlineEmphasized, color: colors.freshgreen },
  saveBtn: {
    minHeight: 50,
    borderRadius: 100,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  saveBtnText: { ...typography.bodyEmphasized, color: colors.white },
});
```

- [ ] **Step 2: Verify the theme-token names used actually exist**

The code above uses `colors.white`, `colors.black`, `colors.freshgreen`, `colors.labelSecondary`, `colors.labelTertiary`, `colors.separatorSubtle`, `spacing.{sm,md,lg}`, and several `typography.*` tokens. Confirm each exists:
```bash
rg -n "white:|black:|freshgreen:|labelSecondary:|labelTertiary:|separatorSubtle:" theme/colors.ts
rg -n "xs:|sm:|md:|lg:" theme/spacing.ts
rg -n "title2Emphasized|bodyEmphasized|bodyRegular|subheadlineEmphasized|footnoteEmphasized|footnoteRegular" theme/typography.ts
```
If any token name differs (e.g. the separator token is named differently), substitute the real token name. Do NOT invent tokens or inline hex/values.

- [ ] **Step 3: Typecheck**

Run the typecheck command. Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/fuel.tsx
git commit -m "feat: /fuel refuel-reminder setup screen

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: /search Fuel card — onPress + live status

**Files:**
- Modify: `app/search.tsx` (the Fuel card at ~line 614)

- [ ] **Step 1: Add the hook + import at the top of the component**

Add to the imports (with the other hook imports):
```tsx
import { useFuelProfile } from '../hooks/useFuelProfile';
```
Inside the `Search` component body (near the other hooks), add:
```tsx
  const { profile: fuelProfile } = useFuelProfile();
```

- [ ] **Step 2: Make the Fuel card tappable + live**

Replace the current Fuel `Pressable` (the block at ~614-625 that has `accessibilityHint="Coming soon"` and no `onPress`):
```tsx
                <Pressable
                  style={({ pressed }) => [styles.fuelSection, pressed && pressedDim]}
                  accessibilityRole="button"
                  accessibilityLabel="Fuel. Add your car's model and fuel for refuel reminders"
                  accessibilityHint="Coming soon"
                >
                  <FuelIcon width={32} height={32} />
                  <Text style={styles.fuelTitle}>Fuel</Text>
                  <Text style={styles.fuelSubtitle}>
                    Add your car's model and fuel for refuel reminders
                  </Text>
                </Pressable>
```
with:
```tsx
                <Pressable
                  style={({ pressed }) => [styles.fuelSection, pressed && pressedDim]}
                  onPress={() => router.push('/fuel')}
                  accessibilityRole="button"
                  accessibilityLabel="Fuel and refuel reminders"
                  accessibilityHint={
                    fuelProfile?.remindersEnabled
                      ? 'Opens your refuel reminder settings'
                      : 'Set up refuel reminders'
                  }
                >
                  <FuelIcon width={32} height={32} />
                  <Text style={styles.fuelTitle}>Fuel</Text>
                  <Text style={styles.fuelSubtitle}>
                    {fuelProfile?.remindersEnabled && fuelProfile.nextReminderAt
                      ? `Refuel reminder on · next ${new Date(
                          fuelProfile.nextReminderAt,
                        ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                      : 'Set up refuel reminders for your car'}
                  </Text>
                </Pressable>
```
(Confirm `router` is already in scope in this component — /search already uses `useRouter`. If not, add `const router = useRouter();`.)

- [ ] **Step 3: Typecheck**

Run the typecheck command. Expected: no output.

- [ ] **Step 4: Manual simulator check**

Open /search. The Fuel card now reads "Set up refuel reminders for your car" (no "Coming soon"). Tap it → `/fuel` opens. On /fuel: enter a name, pick a fuel type, set a cadence, toggle Reminders on, Save → returns to /search; the Fuel card now reads "Refuel reminder on · next {date}". Re-open /fuel → "I filled up" updates the next date. (If the notification permission prompt appears on first enable, accept it.)

- [ ] **Step 5: Commit**

```bash
git add app/search.tsx
git commit -m "feat: wire /search Fuel card to /fuel + live reminder status

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Sign-out cleanup in `app/menu.tsx`

**Files:**
- Modify: `app/menu.tsx` (the `useFuelProfile` consumer + `handleSignOut` `Promise.all`)

- [ ] **Step 1: Import + consume the hook's clearAll**

Add the import near the other hook imports:
```tsx
import { useFuelProfile } from '../hooks/useFuelProfile';
```
Near the other `clearAll` destructures (around `app/menu.tsx:132-134`), add:
```tsx
  const { clearAll: clearFuelProfile } = useFuelProfile();
```

- [ ] **Step 2: Add it to the sign-out clear set**

In `handleSignOut`, the `Promise.all` (app/menu.tsx:172-178) currently is:
```tsx
      await Promise.all([
        signOut(),
        clearContact(),
        clearSavedPlaces(),
        clearRegularDestinations(),
        clearPreferences(),
      ]);
```
Change to add `clearFuelProfile()`:
```tsx
      await Promise.all([
        signOut(),
        clearContact(),
        clearSavedPlaces(),
        clearRegularDestinations(),
        clearPreferences(),
        clearFuelProfile(),
      ]);
```

- [ ] **Step 3: Typecheck**

Run the typecheck command. Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/menu.tsx
git commit -m "feat: clear fuel profile on sign-out

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Acceptance + merge

**Files:** none (verification + merge)

- [ ] **Step 1: Full typecheck** — run the typecheck command against the whole tree. Expected: no output.

- [ ] **Step 2: End-to-end manual check (simulator)**
  - /search Fuel card → no "Coming soon"; reads the setup prompt.
  - Tap → /fuel. Enter name, fuel type, cadence; enable; Save (accept the notification prompt). Returns to /search; card shows "Refuel reminder on · next {date}".
  - Re-open /fuel → "I filled up" advances the next date.
  - Toggle Reminders off + Save → card returns to the setup prompt; no scheduled reminder remains.
  - Electric fuel type → the (future) copy uses "recharge" — confirm the scheduled notification title says "recharge" (can verify via the fired notification or the console breadcrumb).
  - Sign out from /menu, sign back in → no stale fuel profile (card back to setup prompt).

- [ ] **Step 3: Code-reviewer subagent** on the branch diff (`git diff main...feat/refuel-reminder-core`). Confirm: adapter mirrors `preferences.ts`; the hook keeps stored `notificationId`/`nextReminderAt` in sync with what's scheduled; no theme tokens invented; reserved-color rule intact (the `freshgreen` CTA/selected states are allowed — freshgreen is a CTA color, not reserved); permission failure path leaves `remindersEnabled` false (no lying UI). Fix anything flagged, re-review.

- [ ] **Step 4: Squash-merge to `main`**
```bash
git checkout main
git merge --squash feat/refuel-reminder-core
git commit -m "feat: refuel reminders — reminder core (Plan 1)

Time-based refuel reminder: fuel-profile adapter + useFuelProfile hook +
recurring local-notification scheduler + /fuel setup screen + live
/search Fuel card. Local-only, no new sensitive permission. The Fuel
card is no longer a coming-soon stub. Plan 2 (on-route stops) is next.

Plan: docs/superpowers/plans/2026-05-30-refuel-reminder-core.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git branch -D feat/refuel-reminder-core
```

- [ ] **Step 5: Append a `docs/learnings.md` entry** (per workflow Step 11) if anything non-obvious surfaced — e.g. the TIME_INTERVAL-repeats vs one-shot-DATE choice, or any expo-notifications trigger-typing gotcha. One line per takeaway, newest at top.

---

## Self-Review

**1. Spec coverage** (against the spec's Plan 1 scope — units ①②③):
- ① `lib/api/fuel.ts` store + `useFuelProfile` → Task 1 + Task 3. ✅
- ② reminder engine (`scheduleRefuelReminder` TIME_INTERVAL repeats, `cancelRefuelReminder`, inline permission, fuelType-tuned copy, discriminated result, "I filled up" reset) → Task 2 (`refuelVerb`, result type, schedule/cancel) + Task 3 (`markFilledUp` reset). ✅
- ③ /search card onPress + live status + `app/fuel.tsx` setup → Task 4 + Task 5. ✅
- Sign-out clear (spec ①) → Task 6. ✅
- Plan 2 (on-route /en-route stops) correctly excluded. ✅

**2. Placeholder scan:** every code step is complete, real code. The one judgment area (`app/fuel.tsx` visual fidelity) ships a complete functional baseline + an explicit "reconcile against Figma in the next audit" note — not a "TBD". Task 4 Step 2 guards against invented theme tokens by verifying names against the real theme files. No "handle edge cases"/"similar to Task N".

**3. Type/name consistency:** `FuelProfile`, `FuelType`, `DEFAULT_FUEL_PROFILE`, `getStoredFuelProfile`/`setStoredFuelProfile`/`clearStoredFuelProfile` (Task 1) are imported verbatim in Tasks 2/3. `RefuelScheduleResult` + `scheduleRefuelReminder`/`cancelRefuelReminder` (Task 2) are consumed in Task 3. `useFuelProfile` returns `{ profile, loading, saveProfile, markFilledUp, clearAll }` (Task 3) — Task 4 uses `profile/saveProfile/markFilledUp`, Task 5 uses `profile`, Task 6 uses `clearAll`. `FuelProfileInput`/`SaveResult` defined in Task 3 and used by Task 4. `nextReminderAt`/`notificationId`/`remindersEnabled` field names consistent across all tasks.

**Risk noted:** Task 4's theme-token names (`colors.separatorSubtle`, `colors.labelSecondary`, `spacing.lg`, etc.) are assumed from usage elsewhere in the codebase; Task 4 Step 2 explicitly verifies them before typecheck and substitutes real names if any differ. This is the one place reality must be checked against the plan's assumptions.
