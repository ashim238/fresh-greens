# Roadside Assistance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Roadside Assistance tile on `/safety` as a 3-step page-sheet modal (problem → action → live-status), backed by a one-time service-profile setup, that lets the user call their roadside service, search nearby tow services, and share location with their trusted contact while remaining in a "help is on the way" state.

**Architecture:** Single `/roadside` modal route with internal state machine (`'problem' | 'action' | 'status'`), reading from a new `roadside` AsyncStorage adapter + reactive hook. `/roadside-setup` is a settings-modal mirror of `/fuel`. Reuses `/pulled-over`'s DragHandle + `usePreventRemove` pattern for the safety-sub-flow shape. Trusted-contact and reverse-geocoding machinery already exist.

**Tech Stack:** React Native + Expo (managed), `expo-router` (file-based), TypeScript, AsyncStorage, `expo-location` (reverse-geocode), `expo-linking` / `Linking` (dialer + Apple Maps), `expo-haptics`, `@react-navigation/native` (`usePreventRemove`), Phosphor icons (`phosphor-react-native`).

**Spec:** [docs/superpowers/specs/2026-05-31-roadside-assistance-design.md](../specs/2026-05-31-roadside-assistance-design.md)

---

## Conventions

- **No test runner in this project.** Each task ends with `npx tsc --noEmit` (zero errors expected) + a manual simulator-verify step where the change has visible behavior.
- **Icon convention:** Ionicons `chevron-back` for the modal back-chevron (matches `/fuel`); Phosphor for content icons (matches `/safety`, `/pulled-over`). Per-icon deep imports for Phosphor (`from 'phosphor-react-native/src/icons/Tire'`).
- **Commit cadence:** one commit per task. Conventional-commit prefix (`feat:` / `docs:` / `chore:`).
- **Branch:** `feat/roadside-assistance` (already created — `eed89e3`).
- **Working directory:** `/Users/mylesashitey/code/fresh-greens`.

---

## File Structure

**Create:**
- `lib/api/roadside.ts` — AsyncStorage adapter + problem-type definitions. ~70 lines.
- `hooks/useRoadsideProfile.ts` — reactive wrapper. ~50 lines.
- `app/roadside-setup.tsx` — settings sheet (service name + phone). ~180 lines.
- `app/roadside.tsx` — the 3-step modal page-sheet. ~500 lines.

**Modify:**
- `app/_layout.tsx` — register `roadside` + `roadside-setup` as modal routes.
- `app/safety.tsx` (line ~77) — Roadside tile `href: null` → `href: '/roadside'`.
- `.cursorrules` — append navy-cross-link carve-out under the reserved-color rule.
- `docs/learnings.md` — append branch-headed entry.

---

## Task 1: Roadside adapter + problem-type definitions

**Files:**
- Create: `lib/api/roadside.ts`

- [ ] **Step 1: Create the adapter file with the type + storage primitives**

`lib/api/roadside.ts`:

```ts
// Fresh Greens — roadside-service-profile adapter.
//
// AsyncStorage-backed identity for the user's roadside service (e.g.
// AAA, Geico, USAA). Same architectural shape as preferences.ts /
// fuel.ts / trusted-contact.ts: typed `RoadsideProfile`, async public
// surface, AsyncStorage internals.
//
// Lives separately from the in-flow /roadside session state — which is
// in-memory only and dies on unmount per spec. This file persists ONLY
// the service identity so we can dial directly and address the user's
// service by name on the live-status step.
//
// See docs/superpowers/specs/2026-05-31-roadside-assistance-design.md.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fresh-greens.roadside.v1';

/** The 5 problem categories the Step 1 picker offers. */
export type ProblemType =
  | 'flat-tire'
  | 'no-start'
  | 'no-gas'
  | 'locked-out'
  | 'other';

export type RoadsideProfile = {
  /** "AAA", "Geico Emergency Roadside", "USAA" — shown verbatim. */
  serviceName: string;
  /** Raw user-entered phone; `Linking.openURL('tel:…')` handles formatting. */
  phoneNumber: string;
  /** ms epoch — when the profile was created/last edited. */
  setAt: number;
};

/** Reads stored profile or returns null when not yet set up. */
export async function getStoredRoadsideProfile(): Promise<RoadsideProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoadsideProfile;
    return parsed;
  } catch (err) {
    console.warn('getStoredRoadsideProfile failed', err);
    return null;
  }
}

/** Persists the profile and returns the stored copy. */
export async function setStoredRoadsideProfile(
  profile: RoadsideProfile,
): Promise<RoadsideProfile> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

/** Removes the stored profile (sign-out cleanup, factory reset). */
export async function clearStoredRoadsideProfile(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add lib/api/roadside.ts
git commit -m "feat: roadside-profile adapter + ProblemType union"
```

---

## Task 2: Reactive `useRoadsideProfile` hook

**Files:**
- Create: `hooks/useRoadsideProfile.ts`

- [ ] **Step 1: Create the hook with focus-refetch**

`hooks/useRoadsideProfile.ts`:

```ts
import { useCallback, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import {
  clearStoredRoadsideProfile,
  getStoredRoadsideProfile,
  type RoadsideProfile,
  setStoredRoadsideProfile,
} from '../lib/api/roadside';

/** The user-editable fields of a RoadsideProfile. `setAt` is managed here. */
export type RoadsideProfileInput = {
  serviceName: string;
  phoneNumber: string;
};

/**
 * Reactive wrapper around the roadside adapter. Loads the stored profile
 * on mount and re-reads on focus (so when /roadside-setup is popped, the
 * underlying /roadside or /menu surface sees the freshly-saved profile
 * without a manual refetch).
 *
 * Same shape as useFuelProfile / useTrustedContact. `loading` only flips
 * false (never back to true on refocus) to avoid a flash.
 *
 * `profile` is null both when not-yet-loaded AND when the user has never
 * set up a profile — callers treat both identically (show the "Set up"
 * CTA) so the distinction doesn't matter in practice.
 */
export function useRoadsideProfile() {
  const [profile, setProfile] = useState<RoadsideProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const stored = await getStoredRoadsideProfile();
        if (!cancelled) {
          setProfile(stored);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const saveProfile = useCallback(async (input: RoadsideProfileInput) => {
    const next: RoadsideProfile = {
      serviceName: input.serviceName.trim(),
      phoneNumber: input.phoneNumber.trim(),
      setAt: Date.now(),
    };
    setProfile(next);
    await setStoredRoadsideProfile(next);
    return next;
  }, []);

  const clearAll = useCallback(async () => {
    setProfile(null);
    await clearStoredRoadsideProfile();
  }, []);

  return { profile, loading, saveProfile, clearAll };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useRoadsideProfile.ts
git commit -m "feat: useRoadsideProfile hook with focus-refetch"
```

---

## Task 3: `/roadside-setup` route + layout registration

**Files:**
- Create: `app/roadside-setup.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Register the route in the root layout**

Open `app/_layout.tsx`. Find the existing `<Stack.Screen name="report" …>` block and add the following BEFORE it (so the modal screens stay grouped together):

```tsx
{/*
  /roadside-setup — captures the user's roadside service name + phone.
  Settings-style sheet modal (chevron dismisses); mirrors /fuel.
*/}
<Stack.Screen
  name="roadside-setup"
  options={{ presentation: 'modal' }}
/>
```

- [ ] **Step 2: Type-check the layout change**

Run: `npx tsc --noEmit`
Expected: zero errors (the route name doesn't need a file to type-check expo-router config — the file gets created next).

- [ ] **Step 3: Create the setup route**

`app/roadside-setup.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRoadsideProfile } from '../hooks/useRoadsideProfile';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * /roadside-setup — captures the user's roadside service identity (name
 * + phone) for direct-dial and personalized live-status copy. Mirror of
 * /fuel: settings-modal pattern (chevron dismisses, no DragHandle).
 *
 * Accessible from /menu (settings) AND pushed from /roadside Step 2's
 * "Set up your roadside service" CTA when no profile exists. In both
 * cases router.back() returns the user to where they were.
 *
 * Validation: serviceName non-empty after trim; phoneNumber has at least
 * 7 digits after stripping non-digits. No format coercion — let the user
 * type whatever style they prefer; `tel:` URL scheme handles raw digits.
 */
export default function RoadsideSetup() {
  const router = useRouter();
  const { profile, loading, saveProfile } = useRoadsideProfile();

  const [serviceName, setServiceName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed the form once, after the profile loads (if a profile exists).
  if (!loading && profile && !hydrated) {
    setServiceName(profile.serviceName);
    setPhoneNumber(profile.phoneNumber);
    setHydrated(true);
  } else if (!loading && !profile && !hydrated) {
    setHydrated(true);
  }

  const nameValid = serviceName.trim().length > 0;
  const phoneValid = phoneNumber.replace(/\D/g, '').length >= 7;
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

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={28} color={colors.black} />
            </Pressable>
          </View>
          <Text style={styles.title} accessibilityRole="header">
            Roadside service
          </Text>

          <View style={styles.body}>
            <Text style={styles.fieldLabel}>Service name</Text>
            <TextInput
              style={styles.input}
              value={serviceName}
              onChangeText={setServiceName}
              placeholder="AAA, Geico, USAA, …"
              placeholderTextColor={colors.mutedSecondary}
              autoCapitalize="words"
              accessibilityLabel="Service name"
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Phone number
            </Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="1-800-…"
              placeholderTextColor={colors.mutedSecondary}
              keyboardType="phone-pad"
              accessibilityLabel="Phone number"
            />
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.cta,
                !canSave && styles.ctaDisabled,
                pressed && canSave && pressedDim,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: !canSave }}
            >
              <Text style={styles.ctaLabel}>Save</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1 },
  kav: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: {
    ...typography.displayLarge,
    color: colors.black,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  fieldLabel: {
    ...typography.bodySmall,
    color: colors.labelSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.bodyLarge,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  cta: {
    backgroundColor: colors.freshgreen,
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaDisabled: {
    backgroundColor: colors.cardBorderSubtle,
  },
  ctaLabel: {
    ...typography.bodyLarge,
    color: colors.white,
    fontWeight: '600',
  },
});
```

Note: if any of the typography ramp keys (`displayLarge`, `bodyLarge`, `bodySmall`) don't exist under those exact names in `theme/typography.ts`, substitute the closest existing key — the file is the source of truth. Same for `spacing.xl` — if it's not exported, fall back to `spacing.lg`. Do NOT introduce new tokens.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors. If a typography or spacing key is missing, swap to the closest existing one and re-run.

- [ ] **Step 5: Simulator-verify**

Run: `npm start` (or the project's standard start command) and boot the iOS simulator.

The setup screen isn't yet reachable from any UI — verify by adding a temporary `router.push('/roadside-setup')` from somewhere reachable (e.g. /menu briefly) OR by directly typing the path into the expo-router dev URL bar. Confirm:
- Chevron-back dismisses the modal.
- Save button is disabled until both fields are non-empty.
- Phone field opens the phone-pad keyboard on focus.
- Save succeeds, modal dismisses.

Revert any temporary `router.push` you added.

- [ ] **Step 6: Commit**

```bash
git add app/_layout.tsx app/roadside-setup.tsx
git commit -m "feat: /roadside-setup route — service name + phone"
```

---

## Task 4: `/roadside` skeleton (Step 1 problem picker) + safety tile wiring

**Files:**
- Create: `app/roadside.tsx`
- Modify: `app/_layout.tsx` (register /roadside)
- Modify: `app/safety.tsx` (~line 77, wire Roadside tile)

- [ ] **Step 1: Register `/roadside` in the root layout**

Open `app/_layout.tsx`. Add this block above the `roadside-setup` block created in Task 3:

```tsx
{/*
  /roadside — Roadside Assistance sub-flow. Page-sheet modal with
  internal state machine (problem → action → status), mirroring
  /pulled-over's pattern. DragHandle stays present; usePreventRemove
  traps dismissal on the status step.
*/}
<Stack.Screen
  name="roadside"
  options={{ presentation: 'modal' }}
/>
```

- [ ] **Step 2: Wire the /safety Roadside tile**

Open `app/safety.tsx`. Find the tile with `id: 'roadside'` (around line 77). Change `href: null, // TODO: /roadside sub-flow` to `href: '/roadside',`.

- [ ] **Step 3: Create `/roadside` Step 1**

`app/roadside.tsx`:

```tsx
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarBattery } from 'phosphor-react-native/src/icons/CarBattery';
import { GasPump } from 'phosphor-react-native/src/icons/GasPump';
import { Lock } from 'phosphor-react-native/src/icons/Lock';
import { MapPin } from 'phosphor-react-native/src/icons/MapPin';
import { Tire } from 'phosphor-react-native/src/icons/Tire';
import { Wrench } from 'phosphor-react-native/src/icons/Wrench';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';

import { DragHandle } from '../components/DragHandle';
import { type ProblemType } from '../lib/api/roadside';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Step = 'problem' | 'action' | 'status';

type ProblemMeta = {
  id: ProblemType;
  label: string;
  Icon: typeof Tire;
  /** Phrase used in Step 2's headline: "You're in {location} {phrase}." */
  phrase: string;
};

const PROBLEMS: ProblemMeta[] = [
  { id: 'flat-tire',  label: 'Flat tire',                Icon: Tire,       phrase: 'with a flat tire' },
  { id: 'no-start',   label: "Won't start / Dead battery", Icon: CarBattery, phrase: 'with a dead battery' },
  { id: 'no-gas',     label: 'Out of gas',                Icon: GasPump,    phrase: 'out of gas' },
  { id: 'locked-out', label: 'Locked out',                Icon: Lock,       phrase: 'locked out' },
  { id: 'other',      label: 'Something else',            Icon: Wrench,     phrase: '' /* fallback handled in Step 2 */ },
];

/**
 * /roadside — Roadside Assistance sub-flow.
 *
 * Single page-sheet modal route with internal state machine: problem →
 * action → status. DragHandle on every step; chevron is internal-step
 * back nav (not sheet dismissal); Step 3 traps dismissal via
 * usePreventRemove (added in a later task). Matches /pulled-over.
 *
 * Spec: docs/superpowers/specs/2026-05-31-roadside-assistance-design.md
 */
export default function Roadside() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('problem');
  const [problem, setProblem] = useState<ProblemType | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null); // null = "Locating…"
  const [locationCoords, setLocationCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [wrongSpotOpen, setWrongSpotOpen] = useState(false);

  // Reverse-geocode the user's current location for the chip + Step 2 headline.
  // Fails silently → label stays "Locating…" until the user uses "Wrong spot?".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setLocationLabel('Location unavailable');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setLocationCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const places = await Location.reverseGeocodeAsync(pos.coords);
        if (cancelled) return;
        const hit = places[0];
        if (hit) {
          // "Park Slope, Brooklyn" — neighborhood, city. Fall back gracefully.
          const a = hit.district || hit.subregion || hit.name;
          const b = hit.city || hit.region;
          setLocationLabel([a, b].filter(Boolean).join(', ') || 'Your location');
        } else {
          setLocationLabel('Your location');
        }
      } catch (err) {
        console.warn('roadside reverse-geocode failed', err);
        if (!cancelled) setLocationLabel('Your location');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleProblemPick(id: ProblemType) {
    setProblem(id);
    setStep('action');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <DragHandle />
        {step === 'problem' && (
          <ProblemPicker
            locationLabel={locationLabel}
            onPick={handleProblemPick}
            onWrongSpot={() => setWrongSpotOpen(true)}
          />
        )}
        {/* Step 2 ('action') and Step 3 ('status') rendered in later tasks. */}
      </SafeAreaView>

      <WrongSpotModal
        visible={wrongSpotOpen}
        onClose={() => setWrongSpotOpen(false)}
        onConfirm={(label, coords) => {
          setLocationLabel(label);
          if (coords) setLocationCoords(coords);
          setWrongSpotOpen(false);
        }}
      />
    </View>
  );
}

function ProblemPicker({
  locationLabel,
  onPick,
  onWrongSpot,
}: {
  locationLabel: string | null;
  onPick: (id: ProblemType) => void;
  onWrongSpot: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.stepBody}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.subtitle}>Let's get you the help you need.</Text>
      <Text style={styles.title} accessibilityRole="header">
        What's going on?
      </Text>

      <View style={styles.rowList}>
        {PROBLEMS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onPick(p.id)}
            style={({ pressed }) => [styles.row, pressed && pressedDim]}
            accessibilityRole="button"
            accessibilityLabel={p.label}
          >
            <View style={styles.iconCircle}>
              <p.Icon size={24} color={colors.freshgreen} weight="regular" />
            </View>
            <Text style={styles.rowLabel}>{p.label}</Text>
            <CaretRight size={20} color={colors.labelTertiary} weight="bold" />
          </Pressable>
        ))}
      </View>

      <View style={styles.locationBlock}>
        <View
          style={styles.locationChip}
          accessibilityRole="text"
          accessibilityLabel={
            locationLabel ? `Current location: ${locationLabel}` : 'Locating'
          }
        >
          <MapPin size={16} color={colors.labelSecondary} weight="regular" />
          <Text style={styles.locationChipLabel}>{locationLabel ?? 'Locating…'}</Text>
        </View>
        <Pressable
          onPress={onWrongSpot}
          accessibilityRole="link"
          accessibilityLabel="Change location"
          hitSlop={8}
        >
          <Text style={styles.wrongSpot}>Wrong spot?</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function WrongSpotModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (
    label: string,
    coords: { latitude: number; longitude: number } | null,
  ) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    const query = text.trim();
    if (!query) return;
    setBusy(true);
    setError(null);
    try {
      const results = await Location.geocodeAsync(query);
      const hit = results[0];
      if (!hit) {
        setError("Couldn't find that address. Try again.");
        setBusy(false);
        return;
      }
      onConfirm(query, { latitude: hit.latitude, longitude: hit.longitude });
      setText('');
      setBusy(false);
    } catch (err) {
      console.warn('wrong-spot geocode failed', err);
      setError("Couldn't find that address. Try again.");
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessible={false}
        accessibilityElementsHidden
      >
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle} accessibilityRole="header">
            Where are you?
          </Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(null);
            }}
            placeholder="Enter address or area"
            placeholderTextColor={colors.mutedSecondary}
            autoFocus
            accessibilityLabel="Address or area"
          />
          {error && <Text style={styles.modalError}>{error}</Text>}
          <Pressable
            onPress={handleConfirm}
            disabled={busy || !text.trim()}
            style={({ pressed }) => [
              styles.modalCta,
              (busy || !text.trim()) && styles.ctaDisabled,
              pressed && !(busy || !text.trim()) && pressedDim,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Confirm location"
          >
            <Text style={styles.modalCtaLabel}>Confirm</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1 },
  stepBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.labelSecondary,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.displayLarge,
    color: colors.black,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  rowList: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 60,
    gap: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.fillsTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...typography.bodyLarge,
    color: colors.black,
    flex: 1,
    fontWeight: '600',
  },
  locationBlock: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: spacing.xl,
    gap: spacing.xs,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.fillsTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  locationChipLabel: {
    ...typography.bodySmall,
    color: colors.labelSecondary,
  },
  wrongSpot: {
    ...typography.bodySmall,
    color: colors.labelSecondary,
    textDecorationLine: 'underline',
  },
  // Wrong-spot Modal
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.black,
  },
  input: {
    ...typography.bodyLarge,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalError: {
    ...typography.bodySmall,
    color: colors.red,
  },
  modalCta: {
    backgroundColor: colors.freshgreen,
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaDisabled: {
    backgroundColor: colors.cardBorderSubtle,
  },
  modalCtaLabel: {
    ...typography.bodyLarge,
    color: colors.white,
    fontWeight: '600',
  },
});
```

Notes for the implementer:
- If `typography.displayLarge` / `bodyLarge` / `bodySmall` aren't the exact names in `theme/typography.ts`, swap to the closest existing token. Same for `spacing.xl` (fall back to `spacing.lg` if missing).
- If `colors.labelTertiary` is named differently in `theme/colors.ts`, substitute the closest. The audit at the end of this plan will catch any drift.
- The `weight` prop on Phosphor icons is `'regular' | 'bold' | 'fill' | 'duotone' | 'thin' | 'light'`. Don't pass a numeric weight.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors. If a `typography.*` or `spacing.*` key is missing, swap for an existing one and re-run.

- [ ] **Step 5: Simulator-verify**

Boot the iOS simulator. From `/home`, open `/safety`, tap the **Roadside assistance** tile. Confirm:
- Sheet slides up from bottom with DragHandle visible at the top.
- "Let's get you the help you need." gray subtitle, "What's going on?" bold title.
- 5 problem rows, each tappable (Step 2 is not yet rendered — tapping a row will currently fall through to a blank sheet, that's expected).
- Location chip at bottom: shows "Locating…" briefly, then resolves to a real neighborhood/city.
- Tapping "Wrong spot?" opens the modal with the scrim. Type an address, tap Confirm: chip updates with that text. Cancel-scrim dismisses without changes.
- Swipe-down on the sheet dismisses back to `/safety`.

- [ ] **Step 6: Commit**

```bash
git add app/_layout.tsx app/safety.tsx app/roadside.tsx
git commit -m "feat: /roadside Step 1 — problem picker + location chip + wrong-spot"
```

---

## Task 5: `/roadside` Step 2 — action menu

**Files:**
- Modify: `app/roadside.tsx`

- [ ] **Step 1: Extend state + add `actionTaken` / `shareOn` / `shareToggledAtIso`**

In `app/roadside.tsx`, inside the `Roadside()` function, add these state fields right after the existing `wrongSpotOpen` state:

```tsx
const [actionTaken, setActionTaken] = useState(false);
const [shareOn, setShareOn] = useState(false);
const [shareToggledAtIso, setShareToggledAtIso] = useState<string | null>(null);
```

And after `handleProblemPick`, add:

```tsx
function handleBackToProblem() {
  setStep('problem');
}

function markActionTaken() {
  setActionTaken(true);
  setStep('status');
}
```

- [ ] **Step 2: Render Step 2 when `step === 'action'`**

In the JSX of `Roadside()`, after the `{step === 'problem' && <ProblemPicker … />}` block, add:

```tsx
{step === 'action' && (
  <ActionMenu
    problem={problem}
    locationLabel={locationLabel ?? 'Your location'}
    locationCoords={locationCoords}
    shareOn={shareOn}
    onBack={handleBackToProblem}
    onCallPlaced={markActionTaken}
    onTowSearchOpened={markActionTaken}
    onShareToggle={(next) => {
      setShareOn(next);
      if (next) {
        setShareToggledAtIso(new Date().toISOString());
        if (!actionTaken) markActionTaken();
      }
    }}
    onFiguredOut={() => router.back()}
  />
)}
```

- [ ] **Step 3: Add the imports + `ActionMenu` component**

Near the top, add to existing imports:

```tsx
import * as Haptics from 'expo-haptics';
import { Alert, Linking, Switch } from 'react-native';
import { Phone } from 'phosphor-react-native/src/icons/Phone';
import { ShareNetwork } from 'phosphor-react-native/src/icons/ShareNetwork';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';

import { useRoadsideProfile } from '../hooks/useRoadsideProfile';
import { useTrustedContact } from '../hooks/useTrustedContact';
```

Merge the new entries into the existing `react-native` import line and the existing Phosphor import block — don't duplicate import statements.

After the `ProblemPicker` function, add `ActionMenu`:

```tsx
function ActionMenu({
  problem,
  locationLabel,
  locationCoords,
  shareOn,
  onBack,
  onCallPlaced,
  onTowSearchOpened,
  onShareToggle,
  onFiguredOut,
}: {
  problem: ProblemType | null;
  locationLabel: string;
  locationCoords: { latitude: number; longitude: number } | null;
  shareOn: boolean;
  onBack: () => void;
  onCallPlaced: () => void;
  onTowSearchOpened: () => void;
  onShareToggle: (next: boolean) => void;
  onFiguredOut: () => void;
}) {
  const router = useRouter();
  const { profile: roadsideProfile } = useRoadsideProfile();
  const { contact } = useTrustedContact();

  const headline = buildActionHeadline(locationLabel, problem);

  async function handleCall() {
    if (!roadsideProfile) {
      router.push('/roadside-setup');
      return;
    }
    const tel = `tel:${roadsideProfile.phoneNumber.replace(/[^\d+]/g, '')}`;
    const supported = await Linking.canOpenURL(tel);
    if (!supported) {
      Alert.alert('Cannot place call', 'This device cannot make phone calls.');
      return;
    }
    await Linking.openURL(tel);
    onCallPlaced();
  }

  async function handleTowSearch() {
    const sll = locationCoords
      ? `&sll=${locationCoords.latitude},${locationCoords.longitude}`
      : '';
    const url = `maps://?q=tow+truck${sll}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Cannot open Maps', 'Apple Maps is not available.');
      return;
    }
    await Linking.openURL(url);
    onTowSearchOpened();
  }

  function handleShareToggle(next: boolean) {
    Haptics.selectionAsync().catch(() => {});
    onShareToggle(next);
  }

  function handleShareSetup() {
    router.push('/trusted-contact-setup');
  }

  return (
    <ScrollView
      contentContainerStyle={styles.stepBody}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backChevron, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
      >
        <CaretLeft size={28} color={colors.black} weight="regular" />
      </Pressable>

      <Text style={styles.subtitle}>Got it.</Text>
      <Text style={styles.title} accessibilityRole="header">
        {headline}
      </Text>

      <View style={styles.rowList}>
        {/* Call row */}
        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [styles.row, pressed && pressedDim]}
          accessibilityRole="button"
          accessibilityLabel={
            roadsideProfile
              ? `Call ${roadsideProfile.serviceName}`
              : 'Set up your roadside service'
          }
        >
          <View style={styles.iconCircle}>
            <Phone size={24} color={colors.freshgreen} weight="regular" />
          </View>
          <Text style={styles.rowLabel}>
            {roadsideProfile
              ? `Call ${roadsideProfile.serviceName}`
              : 'Set up your roadside service'}
          </Text>
          <CaretRight size={20} color={colors.labelTertiary} weight="bold" />
        </Pressable>

        {/* Tow-search row */}
        <Pressable
          onPress={handleTowSearch}
          style={({ pressed }) => [styles.row, pressed && pressedDim]}
          accessibilityRole="button"
          accessibilityLabel="Search nearby tow services"
        >
          <View style={styles.iconCircle}>
            <MapPin size={24} color={colors.freshgreen} weight="regular" />
          </View>
          <Text style={styles.rowLabel}>Search nearby tow services</Text>
          <CaretRight size={20} color={colors.labelTertiary} weight="bold" />
        </Pressable>

        {/* Share-location row */}
        {contact ? (
          <View
            style={styles.row}
            accessible
            accessibilityRole="switch"
            accessibilityState={{ checked: shareOn }}
            accessibilityLabel={`Share location with ${contact.name}`}
          >
            <View style={styles.iconCircle}>
              <ShareNetwork size={24} color={colors.freshgreen} weight="regular" />
            </View>
            <Text style={styles.rowLabel}>Share location w/ {contact.name}</Text>
            <Switch
              value={shareOn}
              onValueChange={handleShareToggle}
              trackColor={{ false: colors.cardBorderSubtle, true: colors.freshgreen }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.cardBorderSubtle}
            />
          </View>
        ) : (
          <Pressable
            onPress={handleShareSetup}
            style={({ pressed }) => [styles.row, pressed && pressedDim]}
            accessibilityRole="button"
            accessibilityLabel="Set a trusted contact"
          >
            <View style={styles.iconCircle}>
              <ShareNetwork size={24} color={colors.freshgreen} weight="regular" />
            </View>
            <Text style={styles.rowLabel}>Set a trusted contact</Text>
            <CaretRight size={20} color={colors.labelTertiary} weight="bold" />
          </Pressable>
        )}
      </View>

      <View style={styles.outlinedCtaWrap}>
        <Pressable
          onPress={onFiguredOut}
          style={({ pressed }) => [styles.outlinedCta, pressed && pressedDim]}
          accessibilityRole="button"
          accessibilityLabel="I figured it out"
        >
          <Text style={styles.outlinedCtaLabel}>I figured it out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/**
 * Builds the Step 2 headline. "Something else" (and any null problem,
 * defensive) falls back to a generic "need help" phrasing so we never
 * read "with a something else."
 */
function buildActionHeadline(
  locationLabel: string,
  problem: ProblemType | null,
): string {
  if (!problem || problem === 'other') {
    return `You're in ${locationLabel} and need help.`;
  }
  const phrase = PROBLEMS.find((p) => p.id === problem)?.phrase ?? '';
  return `You're in ${locationLabel} ${phrase}.`;
}
```

- [ ] **Step 4: Add the new styles**

Append these entries into the `StyleSheet.create({…})` object at the bottom of the file (do not create a second `StyleSheet.create` — extend the existing one):

```tsx
backChevron: {
  marginTop: spacing.sm,
  width: 32,
  height: 32,
  alignItems: 'flex-start',
  justifyContent: 'center',
},
outlinedCtaWrap: {
  marginTop: 'auto',
  paddingTop: spacing.xl,
},
outlinedCta: {
  borderWidth: 1.5,
  borderColor: colors.freshgreen,
  borderRadius: 999,
  paddingVertical: spacing.md,
  alignItems: 'center',
  backgroundColor: colors.white,
},
outlinedCtaLabel: {
  ...typography.bodyLarge,
  color: colors.freshgreen,
  fontWeight: '600',
},
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Simulator-verify**

From `/safety`, tap Roadside, pick "Flat tire". Confirm:
- Step 2 renders with chevron at top-left, "Got it." subtitle, headline "You're in {location} with a flat tire."
- Tapping the chevron returns to Step 1, problem still selectable.
- Tapping "Flat tire" again returns to Step 2.
- Call row, without a profile: shows "Set up your roadside service" → tapping pushes `/roadside-setup`. Set up a service (e.g., "AAA", "555-1234"), save, return to Step 2 — call row now shows "Call AAA."
- Tapping "Call AAA" opens the dialer. After dismissing the dialer, the screen has advanced to Step 3 (which is a blank sheet for now — that's expected; the next task fills it in).
- Go back into the flow. Pick "Something else" — headline reads "You're in {location} and need help."
- Tow-search row opens Apple Maps with "tow truck" query. After returning, screen has advanced to Step 3.
- Share row, without a trusted contact: shows "Set a trusted contact" → pushes `/trusted-contact-setup`. Pick a contact. Return — row now shows toggle + "Share location w/ {name}". Toggling on triggers haptic + advances to Step 3.
- "I figured it out" dismisses the sheet.

- [ ] **Step 7: Commit**

```bash
git add app/roadside.tsx
git commit -m "feat: /roadside Step 2 — action menu + degradation paths"
```

---

## Task 6: `/roadside` Step 3 — live-status + back-trap + haptics

**Files:**
- Modify: `app/roadside.tsx`

- [ ] **Step 1: Render Step 3 when `step === 'status'`**

In `Roadside()`'s JSX, after the `{step === 'action' && …}` block, add:

```tsx
{step === 'status' && (
  <LiveStatus
    problem={problem}
    locationLabel={locationLabel ?? 'Your location'}
    shareOn={shareOn}
    shareToggledAtIso={shareToggledAtIso}
    onBackOnRoad={() => router.back()}
    onSwitchToPulledOver={() => router.replace('/pulled-over')}
  />
)}
```

- [ ] **Step 2: Add Step 3 imports + trap-dismissal effect + entry haptic**

Add to existing imports (merging into existing import lines where possible):

```tsx
import { usePreventRemove } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { Siren } from 'phosphor-react-native/src/icons/Siren';

import { usePulseOpacity } from '../hooks/usePulseOpacity';
```

Also import `Animated` from `react-native` (merge into existing rn import).

Inside `Roadside()`, near the top of the function body, add:

```tsx
const navigation = useNavigation();
usePreventRemove(step === 'status', () => {
  // Block the dismissal — the user must use an explicit CTA on Step 3.
  // No-op callback; presence of the hook + true flag is what blocks.
});
```

And alongside the other state, add a haptic trigger when `step` first becomes `'status'`:

```tsx
useEffect(() => {
  if (step === 'status') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
  }
}, [step]);
```

- [ ] **Step 3: Add the `LiveStatus` component**

After the `ActionMenu` function (and before the `buildActionHeadline` helper, or after it — order doesn't matter), add:

```tsx
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
  const { profile: roadsideProfile } = useRoadsideProfile();
  const { contact } = useTrustedContact();
  const pulse = usePulseOpacity();

  const headline = roadsideProfile
    ? `${roadsideProfile.serviceName} should be on the way.`
    : 'Help is on the way. Stay where you are.';

  const problemLabel = problem
    ? PROBLEMS.find((p) => p.id === problem)?.label ?? 'Need help'
    : 'Need help';

  const sharedFacts: string[] = [problemLabel, locationLabel];
  if (shareOn && shareToggledAtIso && contact) {
    const time = new Date(shareToggledAtIso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    sharedFacts.push(`${contact.name} was notified at ${time}`);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.stepBody}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.subtitle, { marginTop: spacing.sm }]}>Hang tight.</Text>
      <Text style={styles.title} accessibilityRole="header">
        {headline}
      </Text>

      <View style={styles.sharedCard}>
        <Text style={styles.sharedCardTitle}>What you shared</Text>
        <Text style={styles.sharedCardBody}>{sharedFacts.join(' • ')}</Text>
      </View>

      <Text style={styles.sectionLabel}>If this gets worse</Text>
      <Pressable
        onPress={onSwitchToPulledOver}
        style={({ pressed }) => [styles.row, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel="Switch to Pulled-over mode"
      >
        <View style={styles.iconCircle}>
          <Siren size={24} color={colors.navy} weight="regular" />
        </View>
        <Text style={styles.rowLabel}>Switch to Pulled-over mode</Text>
        <CaretRight size={20} color={colors.labelTertiary} weight="bold" />
      </Pressable>

      <View style={styles.primaryCtaWrap}>
        <Pressable
          onPress={onBackOnRoad}
          style={({ pressed }) => [styles.primaryCta, pressed && pressedDim]}
          accessibilityRole="button"
          accessibilityLabel="I'm back on the road"
        >
          <Text style={styles.primaryCtaLabel}>I'm back on the road</Text>
        </Pressable>

        {shareOn && contact && (
          <View
            style={styles.statusPulseRow}
            accessibilityLabel={`${contact.name} is being notified`}
          >
            <Animated.View
              style={[styles.statusPulseDot, { opacity: pulse }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={styles.statusPulseLabel}>
              {contact.name} is being notified
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 4: Add the Step 3 styles**

Append into the existing `StyleSheet.create({…})`:

```tsx
sharedCard: {
  backgroundColor: colors.systemGroupedBackground,
  borderRadius: 12,
  padding: spacing.md,
  marginBottom: spacing.lg,
  gap: spacing.xs,
},
sharedCardTitle: {
  ...typography.bodySmall,
  fontWeight: '600',
  color: colors.black,
},
sharedCardBody: {
  ...typography.bodySmall,
  color: colors.labelSecondary,
},
sectionLabel: {
  ...typography.bodySmall,
  color: colors.labelSecondary,
  marginBottom: spacing.sm,
},
primaryCtaWrap: {
  marginTop: 'auto',
  paddingTop: spacing.xl,
  alignItems: 'center',
  gap: spacing.sm,
},
primaryCta: {
  backgroundColor: colors.freshgreen,
  borderRadius: 999,
  paddingVertical: spacing.md,
  alignItems: 'center',
  alignSelf: 'stretch',
},
primaryCtaLabel: {
  ...typography.bodyLarge,
  color: colors.white,
  fontWeight: '600',
},
statusPulseRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.xs,
},
statusPulseDot: {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: colors.freshgreen,
},
statusPulseLabel: {
  ...typography.bodySmall,
  color: colors.labelSecondary,
},
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Simulator-verify**

Run the full flow end-to-end:
- `/safety` → Roadside tile.
- Step 1 → pick "Flat tire."
- Step 2 → tap "Call AAA" (with profile set up), dismiss the dialer.
- Step 3 renders: "Hang tight." subtitle, "AAA should be on the way." headline (no ETA copy anywhere), "What you shared" card listing "Flat tire • {location}", "If this gets worse" section with navy siren + "Switch to Pulled-over mode" row, "I'm back on the road" freshgreen CTA at the bottom.
- A success haptic fires when Step 3 first appears.
- Swipe-down gesture is BLOCKED on Step 3 — the sheet does not dismiss.
- Hardware back (Android equivalent / iOS gesture) is BLOCKED on Step 3.
- Tap "Switch to Pulled-over mode" → flow replaces with `/pulled-over` (the navy siren icon was the affordance).
- Re-run the flow, this time toggle "Share location w/ {name}" on Step 2. Step 3 now: "What you shared" includes "{name} was notified at {time}", and a pulsing green dot + "{name} is being notified" appears below the primary CTA.
- Tap "I'm back on the road" → flow dismisses to `/home` (back through `/safety`).

- [ ] **Step 7: Commit**

```bash
git add app/roadside.tsx
git commit -m "feat: /roadside Step 3 — live-status + back-trap + haptics"
```

---

## Task 7: Documentation — `.cursorrules` carve-out + learnings entry

**Files:**
- Modify: `.cursorrules`
- Modify: `docs/learnings.md`

- [ ] **Step 1: Append the navy cross-link carve-out to `.cursorrules`**

Open `.cursorrules` and find the "Reserved-color rule" section. Append the following paragraph at the end of that section (before the next top-level rule, if any):

```markdown
**Cross-link carve-out:** A reserved color *may* tint an icon in a row whose `onPress` navigates directly to that color's owning route, as a wayfinding affordance. Example: the navy `Siren` icon on `/roadside`'s "Switch to Pulled-over mode" row. The reserved color still functions as a signal (here: "this row goes to Pulled-over"), not a brand-color reassignment. The carve-out does NOT extend to decorative use, secondary navigation, or rows whose target is not the reserved color's owning screen.
```

- [ ] **Step 2: Append a branch-headed entry to `docs/learnings.md`**

Open `docs/learnings.md`. At the top of the file (newest-at-top convention per CLAUDE.md), insert this entry above the existing newest entry:

```markdown
## feat/roadside-assistance — navy as a cross-link affordance

The Roadside `/safety` sub-flow needed a "Switch to Pulled-over mode" row on its live-status step. Pulled-over's reserved color is navy. The reserved-color rule reads "navy only on /pulled-over" — strict reading says the row's icon must be freshgreen (or some neutral). But that loses semantic signal: the user can't tell at a glance that this row escalates to a different safety mode.

**Carve-out:** A reserved color may tint an icon in a row whose `onPress` goes directly to that color's owning route. The icon is still acting as a *signal* — pointing at where the row goes — not as decoration or brand reassignment. Scope is narrow: only direct-navigation icons, only to the color's owning screen.

Documented in `.cursorrules` under the reserved-color rule. The carve-out is also why a navy `Siren` shows up in `app/roadside.tsx` despite navy belonging to `/pulled-over`.
```

- [ ] **Step 3: Commit**

```bash
git add .cursorrules docs/learnings.md
git commit -m "docs: navy cross-link carve-out + roadside learnings entry"
```

---

## Final verification (after all tasks)

- [ ] **Run a full type-check**

Run: `npx tsc --noEmit`
Expected: zero errors across the whole repo.

- [ ] **Run the workflow Step 10 audit**

Per `docs/workflow.md` Step 13, dispatch the design + code-quality subagent reviews on the branch diff. Per Step 10, merge to main with squash once audit passes (the user's standing preference — `feedback_merge_to_main_default.md`).

- [ ] **Verify the full Roadside flow end-to-end one more time**

From `/home` → `/safety` → Roadside tile:
- Profile-less first-run path: Step 1 picks, Step 2 "Set up", `/roadside-setup` save, return to Step 2 with call row active, dial, Step 3 with serviceName headline, "I'm back on the road" returns to /home.
- Contact-less first-run path: Step 2 "Set a trusted contact", `/trusted-contact-setup`, return to Step 2 with share toggle active.
- "Something else" headline: "You're in {location} and need help." (no garbled "with a something else").
- Live "What you shared" card: re-renders when share is toggled mid-status step.
- Step 3 dismissal is trapped; only explicit CTAs exit.
- "Switch to Pulled-over mode" → `/pulled-over` replaces the sheet.

---

## Self-review

**Spec coverage check:**

| Spec section | Implementing task |
|---|---|
| Persistence shape (`lib/api/roadside.ts`) | Task 1 |
| `useRoadsideProfile` hook | Task 2 |
| `/roadside-setup` route | Task 3 |
| Step 1: Problem picker + DragHandle + location chip + Wrong-spot Modal | Task 4 |
| `/safety` tile wiring | Task 4 |
| Layout registration | Tasks 3 + 4 |
| Step 2: Action menu + headline interpolation + call/tow/share + degradation paths + outlined CTA | Task 5 |
| Step 3: Live-status + What-you-shared card + Pulled-over cross-link + primary CTA + status pulse | Task 6 |
| Hardware-back trap via `usePreventRemove` | Task 6 |
| Entry haptic on Step 3 | Task 6 |
| Reserved-color carve-out in `.cursorrules` | Task 7 |
| `docs/learnings.md` entry | Task 7 |
| A11y baseline (roles, labels, switch state) | Embedded in Tasks 4–6 |
| Out-of-scope items (no ETA, no membership #, in-memory session only) | N/A — verified by absence |

No gaps.

**Placeholder scan:** every code step shows the full code; no "TBD" / "fill in" / "add error handling" without specifics. The two `swap to closest existing token` notes (Tasks 3 + 4) are concrete fallback instructions, not vagueness — and the implementer has the source-of-truth files (`theme/typography.ts`, `theme/spacing.ts`) to consult.

**Type consistency:** `ProblemType` is defined once in `lib/api/roadside.ts` and used everywhere. `RoadsideProfile` is defined once and used by both the hook and the screens. `Step` is defined locally in `app/roadside.tsx`. All callbacks pass through the documented signatures. The `Roadside()` function progressively grows across Tasks 4 → 5 → 6 with no rename or signature drift — same `step`, `problem`, `locationLabel`, `locationCoords`, `shareOn`, `shareToggledAtIso` fields throughout.
