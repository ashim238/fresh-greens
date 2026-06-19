# Fuel Screen v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `app/fuel.tsx` to fix four UX gaps in shipped Phase 1 (fuel-type-mixed buckets, time-only as a sibling of range, current-cycle gating bug, weak selected state) and to anticipate the Phase 2 EPA cascade slot — without touching data model or hooks.

**Architecture:** Single-file presentation refresh. Replace the flat `RANGE_BUCKETS` constant with a per-`FuelType` bucket map. Add an "Also use distance" toggle inside the Reminders group that gates the bucket pills. Bucket pills get Phosphor class/battery icons + a checkmark-on-selected affordance. Fuel-type segment gains matching Phosphor icons. Current cycle group gating now reads local `enabled` in addition to saved profile state.

**Tech Stack:** React Native + Expo, TypeScript, StyleSheet API. Phosphor icons via per-icon deep imports (`phosphor-react-native/src/icons/<Name>`). Theme tokens at `theme/colors.ts`, `theme/typography.ts`, `theme/spacing.ts`, `theme/radii.ts`, `theme/interaction.ts`.

**Spec:** [`docs/superpowers/specs/2026-06-17-fuel-screen-v2-design.md`](../specs/2026-06-17-fuel-screen-v2-design.md)

**Verification model:** This repo has no test runner. Per project norm, each task is gated on `npx tsc --noEmit` clean against the baseline (the 4 known-unrelated pre-existing errors documented in workflow.md). Device-test gates live in Task 8.

---

## File map

- **Modify:** `app/fuel.tsx` — the only file touched.
- No new files. No hook changes. No theme additions. `FuelProfile` schema untouched.

---

### Task 1: Phosphor icon imports

**Files:**
- Modify: `app/fuel.tsx` (imports block, lines 7–9)

**Goal:** Add the 11 new Phosphor icons the rest of the plan depends on, all via per-icon deep imports (project convention — see CLAUDE.md `project_icons_phosphor.md`).

- [ ] **Step 1: Add the icon imports**

Find the existing Phosphor imports (current state):
```ts
import { Minus } from 'phosphor-react-native/src/icons/Minus';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
```

Replace with:
```ts
import { BatteryHigh } from 'phosphor-react-native/src/icons/BatteryHigh';
import { BatteryLow } from 'phosphor-react-native/src/icons/BatteryLow';
import { BatteryMedium } from 'phosphor-react-native/src/icons/BatteryMedium';
import { CarProfile } from 'phosphor-react-native/src/icons/CarProfile';
import { CarSimple } from 'phosphor-react-native/src/icons/CarSimple';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { GasPump } from 'phosphor-react-native/src/icons/GasPump';
import { Leaf } from 'phosphor-react-native/src/icons/Leaf';
import { Lightning } from 'phosphor-react-native/src/icons/Lightning';
import { Minus } from 'phosphor-react-native/src/icons/Minus';
import { PencilSimple } from 'phosphor-react-native/src/icons/PencilSimple';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { Truck } from 'phosphor-react-native/src/icons/Truck';
```

- [ ] **Step 2: Verify static**

Run: `npx tsc --noEmit`
Expected: no new errors beyond the 4 pre-existing baseline errors. The new icon symbols are unused at this point — that's fine, they're consumed in Tasks 3 and 5.

- [ ] **Step 3: Commit**

```bash
git add app/fuel.tsx
git commit -m "$(cat <<'EOF'
chore(fuel): add Phosphor icon imports for v2 refresh

Adds the 11 deep-imported Phosphor icons consumed by the v2 fuel screen:
Car silhouettes (CarSimple/CarProfile/Truck) for class-based buckets,
Battery levels (BatteryLow/Medium/High) for EV range buckets,
PencilSimple for Custom, fuel-type segment icons (GasPump/Leaf/Lightning),
and Check for the selected-pill prefix.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Per-fuel-type bucket spec

**Files:**
- Modify: `app/fuel.tsx` (replace `RANGE_BUCKETS` constant; update `selectedBucketId` and `handlePickBucket` references)

**Goal:** Replace the single flat `RANGE_BUCKETS` array with a per-`FuelType` map. Each fuel type gets 3 buckets + the Custom pill is rendered separately (it's universal).

- [ ] **Step 1: Replace the bucket constant**

Find (lines 33–40 current):
```ts
/** Phase-1 tank-range tier buckets. `null` = Time only (distance off). */
const RANGE_BUCKETS: { id: string; label: string; rangeMiles: number | null }[] = [
  { id: 'none', label: 'Time only', rangeMiles: null },
  { id: 'compact', label: 'Compact ~300 mi', rangeMiles: 300 },
  { id: 'sedan', label: 'Sedan ~350 mi', rangeMiles: 350 },
  { id: 'suv', label: 'SUV / Truck ~400 mi', rangeMiles: 400 },
  { id: 'ev', label: 'EV ~250 mi', rangeMiles: 250 },
];
```

Replace with:
```ts
/**
 * Per-fuel-type bucket specs. Gas/diesel/hybrid use vehicle-class labels
 * (drivers think "I drive a sedan"); EV uses range-based labels because
 * EV ranges vary too widely for vehicle class to map cleanly. The Custom
 * pill is rendered separately (universal across fuel types). Icons are
 * imported in Task 1; the icon component reference travels with each
 * bucket so the row-render loop can dispatch off the spec.
 */
type BucketSpec = {
  id: string;
  label: string;
  rangeMiles: number;
  Icon: typeof CarSimple;
};

const BUCKETS_BY_FUEL_TYPE: Record<FuelType, BucketSpec[]> = {
  gas: [
    { id: 'compact-gas', label: 'Compact · 300 mi', rangeMiles: 300, Icon: CarSimple },
    { id: 'sedan-gas', label: 'Sedan · 350 mi', rangeMiles: 350, Icon: CarProfile },
    { id: 'suv-gas', label: 'SUV / Truck · 400 mi', rangeMiles: 400, Icon: Truck },
  ],
  diesel: [
    { id: 'compact-diesel', label: 'Compact · 350 mi', rangeMiles: 350, Icon: CarSimple },
    { id: 'sedan-diesel', label: 'Sedan · 400 mi', rangeMiles: 400, Icon: CarProfile },
    { id: 'suv-diesel', label: 'SUV / Truck · 450 mi', rangeMiles: 450, Icon: Truck },
  ],
  hybrid: [
    { id: 'compact-hybrid', label: 'Compact · 450 mi', rangeMiles: 450, Icon: CarSimple },
    { id: 'sedan-hybrid', label: 'Sedan · 500 mi', rangeMiles: 500, Icon: CarProfile },
    { id: 'suv-hybrid', label: 'SUV · 550 mi', rangeMiles: 550, Icon: Truck },
  ],
  electric: [
    { id: 'ev-short', label: 'Short · 200 mi', rangeMiles: 200, Icon: BatteryLow },
    { id: 'ev-mid', label: 'Mid · 280 mi', rangeMiles: 280, Icon: BatteryMedium },
    { id: 'ev-long', label: 'Long · 360 mi', rangeMiles: 360, Icon: BatteryHigh },
  ],
};
```

- [ ] **Step 2: Update `selectedBucketId` derivation**

Find (lines 169–173 current):
```ts
// Which bucket (if any) is currently selected — for the selected styling.
const selectedBucketId =
  rangeSource === 'custom'
    ? 'custom'
    : RANGE_BUCKETS.find((b) => b.rangeMiles === rangeMiles)?.id ?? 'none';
```

Replace with:
```ts
// Which bucket (if any) is currently selected — for the selected styling.
// Matches against the active fuel-type's bucket set; if the stored
// rangeMiles isn't a bucket in the current set (e.g. user switched fuel
// types and we haven't reset yet — Task 6 covers that flow), nothing
// shows as selected and the user can pick fresh.
const activeBuckets = BUCKETS_BY_FUEL_TYPE[fuelType];
const selectedBucketId =
  rangeSource === 'custom'
    ? 'custom'
    : activeBuckets.find((b) => b.rangeMiles === rangeMiles)?.id ?? null;
```

- [ ] **Step 3: Update `handlePickBucket` signature**

Find (lines 143–147 current):
```ts
function handlePickBucket(bucket: (typeof RANGE_BUCKETS)[number]) {
  setCustomRangeOpen(false);
  setRangeMiles(bucket.rangeMiles);
  setRangeSource(bucket.rangeMiles == null ? 'none' : 'bucket');
}
```

Replace with:
```ts
function handlePickBucket(bucket: BucketSpec) {
  setCustomRangeOpen(false);
  setRangeMiles(bucket.rangeMiles);
  setRangeSource('bucket');
  setShowFuelChangeNote(false); // clear the prompt if it was up — Task 6 wires the state
}
```

Note: `setShowFuelChangeNote` is referenced here but added in Task 6. Stub it as `() => {}` temporarily if Task 6 hasn't shipped yet; final wiring lands in Task 6. **This task will leave `setShowFuelChangeNote` as a TS error until Task 6 declares it** — that's expected, fix-by-Task-6 sequencing.

Actually — to avoid breaking tsc gate, defer the `setShowFuelChangeNote` line. Use this body instead for now:
```ts
function handlePickBucket(bucket: BucketSpec) {
  setCustomRangeOpen(false);
  setRangeMiles(bucket.rangeMiles);
  setRangeSource('bucket');
}
```

Task 6 will add the `setShowFuelChangeNote(false)` line here.

- [ ] **Step 4: Verify static**

Run: `npx tsc --noEmit`
Expected: no new errors beyond baseline. The bucket rendering site (Task 5) still references the old `RANGE_BUCKETS` shape — that's fine for now, those reads will keep working until Task 5 swaps them. Wait — they WON'T work because `RANGE_BUCKETS` no longer exists.

**Resolution:** in this same task, also do a temporary patch at the bucket render site to use `activeBuckets` instead of `RANGE_BUCKETS`. Find (line ~300 in current `app/fuel.tsx`, inside the Tank range RowGroup):

```ts
{RANGE_BUCKETS.map((b) => {
```

Change to:
```ts
{activeBuckets.map((b) => {
```

That preserves render correctness through tsc. Task 5 rewrites this whole block (icons + checkmark + new selected styling), but for now we just want a clean tsc.

Also: the old `RANGE_BUCKETS` had a 'none' entry that displayed "Time only" as a pill. Task 4 introduces the "Also use distance" toggle which replaces the Time-only-as-pill concept. For now, with `activeBuckets` having no 'none' entry, the Time-only pill disappears from the render. That's the intended end state — Task 4 will introduce the toggle that owns the distance-off semantics.

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean against baseline.

- [ ] **Step 6: Commit**

```bash
git add app/fuel.tsx
git commit -m "$(cat <<'EOF'
refactor(fuel): per-fuel-type bucket spec

Replaces the single flat RANGE_BUCKETS constant with BUCKETS_BY_FUEL_TYPE
keyed by FuelType. Each fuel type gets 3 vehicle-class or EV-range
buckets with bundled Phosphor icon references. Custom pill is rendered
separately (universal). The 'none'/Time-only pill is removed at this
step — Task 4's "Also use distance" toggle replaces that semantic.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Fuel-type segment icons

**Files:**
- Modify: `app/fuel.tsx` (`FUEL_TYPES` constant, fuel-type segment render block, segment styles)

**Goal:** Add Phosphor icon glyphs to each fuel-type pill so the segment matches the visual register the range pills will adopt in Task 5.

- [ ] **Step 1: Extend `FUEL_TYPES` with icon refs**

Find (lines 23–28 current):
```ts
const FUEL_TYPES: { id: FuelType; label: string }[] = [
  { id: 'gas', label: 'Gas' },
  { id: 'diesel', label: 'Diesel' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'electric', label: 'Electric' },
];
```

Replace with:
```ts
/**
 * Per-fuel-type display spec. The icon is rendered to the left of the
 * label inside each segment pill. Gas and Diesel share GasPump — Phosphor
 * has no diesel-specific glyph, and the label below disambiguates.
 */
const FUEL_TYPES: { id: FuelType; label: string; Icon: typeof GasPump }[] = [
  { id: 'gas', label: 'Gas', Icon: GasPump },
  { id: 'diesel', label: 'Diesel', Icon: GasPump },
  { id: 'hybrid', label: 'Hybrid', Icon: Leaf },
  { id: 'electric', label: 'Electric', Icon: Lightning },
];
```

- [ ] **Step 2: Render the icon in each segment pill**

Find the fuel-type segment block (lines 218–242 current):
```tsx
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
```

Replace with:
```tsx
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
        <ft.Icon
          size={20}
          color={selected ? colors.white : colors.labelSecondary}
          weight={selected ? 'fill' : 'regular'}
        />
        <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
          {ft.label}
        </Text>
      </Pressable>
    );
  })}
</View>
```

- [ ] **Step 3: Update `segmentItem` style to flex the icon + label**

Find (lines 475–483 current):
```ts
segmentItem: {
  flex: 1,
  minHeight: 44,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: radii.pill,
  borderWidth: 1,
  borderColor: colors.separatorSubtle,
},
```

Replace with:
```ts
segmentItem: {
  flex: 1,
  minHeight: 44,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing.xs,
  paddingHorizontal: spacing.sm,
  borderRadius: radii.pill,
  borderWidth: 1,
  borderColor: colors.separatorSubtle,
},
```

The `gap: spacing.xs` (4pt) gives icon-to-label breathing room; `paddingHorizontal: spacing.sm` (8pt) ensures the icon+label combo doesn't crowd the pill edges on smaller viewports.

- [ ] **Step 4: Verify static**

Run: `npx tsc --noEmit`
Expected: clean against baseline.

- [ ] **Step 5: Commit**

```bash
git add app/fuel.tsx
git commit -m "$(cat <<'EOF'
feat(fuel): Phosphor icons in fuel-type segment

Each fuel-type pill gains a leading icon (GasPump for Gas/Diesel — shared
glyph, label disambiguates; Leaf for Hybrid; Lightning for Electric).
Icon switches to white-fill on selected, matches the freshgreen pill bg.
Sets up visual consistency for the bucket pills in Task 5.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: "Also use distance" toggle

**Files:**
- Modify: `app/fuel.tsx` (state declarations, hydration useEffect, Tank range RowGroup wrapper, styles)

**Goal:** Introduce a top-of-Range-section toggle that owns the "distance off → time only" semantics. When OFF, hide the bucket pills + custom row + footer copy. Default OFF for new profiles; ON when an existing profile has a non-'none' `rangeSource`.

- [ ] **Step 1: Add the `distanceEnabled` state**

Find the state declarations (lines 84–93 current):
```ts
const [carName, setCarName] = useState('');
const [fuelType, setFuelType] = useState<FuelType>('gas');
const [cadenceDays, setCadenceDays] = useState(7);
const [enabled, setEnabled] = useState(false);
const [hydrated, setHydrated] = useState(false);
const [saving, setSaving] = useState(false);
const [rangeMiles, setRangeMiles] = useState<number | null>(null);
const [rangeSource, setRangeSource] = useState<FuelProfile['rangeSource']>('none');
const [customRangeOpen, setCustomRangeOpen] = useState(false);
const [customRangeText, setCustomRangeText] = useState('');
```

Add (after `customRangeText`):
```ts
// "Also use distance" toggle — owns the distance-trigger on/off
// semantics. When OFF, rangeMiles=null and rangeSource='none' on save.
// Hydrated from existing profile.rangeSource (ON if any non-'none' source).
const [distanceEnabled, setDistanceEnabled] = useState(false);
```

- [ ] **Step 2: Hydrate `distanceEnabled` from the loaded profile**

Find (lines 99–108 current):
```ts
useEffect(() => {
  if (loading || !profile || hydrated) return;
  setCarName(profile.carName ?? '');
  setFuelType(profile.fuelType);
  setCadenceDays(profile.cadenceDays);
  setEnabled(profile.remindersEnabled);
  setRangeMiles(profile.rangeMiles);
  setRangeSource(profile.rangeSource);
  setHydrated(true);
}, [loading, profile, hydrated]);
```

Replace with:
```ts
useEffect(() => {
  if (loading || !profile || hydrated) return;
  setCarName(profile.carName ?? '');
  setFuelType(profile.fuelType);
  setCadenceDays(profile.cadenceDays);
  setEnabled(profile.remindersEnabled);
  setRangeMiles(profile.rangeMiles);
  setRangeSource(profile.rangeSource);
  setDistanceEnabled(profile.rangeSource !== 'none');
  setHydrated(true);
}, [loading, profile, hydrated]);
```

- [ ] **Step 3: Update `handleSave` to respect `distanceEnabled`**

Find (lines 113–120 current):
```ts
const result = await saveProfile({
  carName: carName.trim() || undefined,
  fuelType,
  cadenceDays,
  remindersEnabled: enabled,
  rangeMiles,
  rangeSource,
});
```

Replace with:
```ts
const result = await saveProfile({
  carName: carName.trim() || undefined,
  fuelType,
  cadenceDays,
  remindersEnabled: enabled,
  rangeMiles: distanceEnabled ? rangeMiles : null,
  rangeSource: distanceEnabled ? rangeSource : 'none',
});
```

- [ ] **Step 4: Merge the Tank range RowGroup into the Reminders RowGroup**

Per spec § Section 1, the Range subsection lives *inside* the Reminders RowGroup as a sibling of the cadence stepper, not as a separate adjacent card. The current code has them as two separate RowGroups. This step merges them and adds the "Also use distance" toggle + the conditional bucket section.

Find the Reminders RowGroup block (lines 245–287 current):
```tsx
<RowGroup>
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>Remind me to refuel</Text>
    <Switch
      value={enabled}
      onValueChange={setEnabled}
      trackColor={{ false: colors.cardBorderSubtle, true: colors.freshgreen }}
      thumbColor={colors.white}
      accessibilityLabel="Refuel reminders"
    />
  </View>

  {enabled && (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Remind me every</Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => setCadenceDays((d) => Math.max(MIN_DAYS, d - 1))}
          style={({ pressed }) => [styles.stepBtn, pressed && pressedDim]}
          accessibilityRole="button"
          accessibilityLabel="Fewer days"
        >
          <Minus size={20} color={colors.black} weight="bold" />
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
          <Plus size={20} color={colors.black} weight="bold" />
        </Pressable>
      </View>
    </View>
  )}
</RowGroup>
```

Replace with the merged version:
```tsx
<RowGroup
  footer={
    enabled && distanceEnabled
      ? "Reminders fire on your schedule OR after this many in-app navigated miles, whichever comes first. Miles only count trips you navigate in the app."
      : undefined
  }
>
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>Remind me to refuel</Text>
    <Switch
      value={enabled}
      onValueChange={setEnabled}
      trackColor={{ false: colors.cardBorderSubtle, true: colors.freshgreen }}
      thumbColor={colors.white}
      accessibilityLabel="Refuel reminders"
    />
  </View>

  {enabled && (
    <>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Remind me every</Text>
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => setCadenceDays((d) => Math.max(MIN_DAYS, d - 1))}
            style={({ pressed }) => [styles.stepBtn, pressed && pressedDim]}
            accessibilityRole="button"
            accessibilityLabel="Fewer days"
          >
            <Minus size={20} color={colors.black} weight="bold" />
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
            <Plus size={20} color={colors.black} weight="bold" />
          </Pressable>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Also use distance</Text>
        <Switch
          value={distanceEnabled}
          onValueChange={setDistanceEnabled}
          trackColor={{ false: colors.cardBorderSubtle, true: colors.freshgreen }}
          thumbColor={colors.white}
          accessibilityLabel="Also use distance to trigger reminders"
        />
      </View>

      {distanceEnabled && (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Tank range</Text>
          <View
            style={styles.rangeOptions}
            accessibilityRole="radiogroup"
            accessibilityLabel="Tank range"
          >
            {activeBuckets.map((b) => {
              const selected = selectedBucketId === b.id && !customRangeOpen;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => handlePickBucket(b)}
                  style={({ pressed }) => [
                    styles.rangeOption,
                    selected && styles.rangeOptionSelected,
                    pressed && pressedDim,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={b.label}
                >
                  <Text
                    style={[
                      styles.rangeOptionText,
                      selected && styles.rangeOptionTextSelected,
                    ]}
                  >
                    {b.label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={handleOpenCustom}
              style={({ pressed }) => [
                styles.rangeOption,
                (selectedBucketId === 'custom' || customRangeOpen) &&
                  styles.rangeOptionSelected,
                pressed && pressedDim,
              ]}
              accessibilityRole="radio"
              accessibilityState={{
                selected: selectedBucketId === 'custom' || customRangeOpen,
                checked: selectedBucketId === 'custom' || customRangeOpen,
              }}
              accessibilityLabel="Custom range"
            >
              <Text
                style={[
                  styles.rangeOptionText,
                  (selectedBucketId === 'custom' || customRangeOpen) &&
                    styles.rangeOptionTextSelected,
                ]}
              >
                {rangeSource === 'custom' && rangeMiles != null
                  ? `Custom · ${rangeMiles} mi`
                  : 'Custom…'}
              </Text>
            </Pressable>
          </View>

          {customRangeOpen && (
            <View style={styles.customRangeRow}>
              <TextInput
                style={styles.input}
                value={customRangeText}
                onChangeText={setCustomRangeText}
                onEndEditing={handleCommitCustom}
                placeholder="e.g. 320"
                placeholderTextColor={colors.mutedSecondary}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleCommitCustom}
                accessibilityLabel="Custom tank range in miles"
              />
              <Text style={styles.customRangeUnit}>mi</Text>
            </View>
          )}
        </View>
      )}
    </>
  )}
</RowGroup>
```

Then **delete the now-redundant separate Tank range RowGroup** (was lines 289–374 in the current file). After this step the structure is:

```
RowGroup #1: Your car (Car name + Fuel type segment)
RowGroup #2: Reminders (toggle + cadence + Also use distance + Tank range)  ← MERGED
RowGroup #3: Current cycle (unchanged)
RowGroup #4: Preferred stations (unchanged)
```

The bucket pill rendering is still text-only here — icons + checkmark land in Task 5.

- [ ] **Step 5: Verify static**

Run: `npx tsc --noEmit`
Expected: clean against baseline.

- [ ] **Step 6: Commit**

```bash
git add app/fuel.tsx
git commit -m "$(cat <<'EOF'
feat(fuel): merge Range into Reminders group with distance toggle

Per spec §Section 1, the Range subsection is now a child of the
Reminders RowGroup (was a separate adjacent card). New "Also use
distance" Switch sits below the cadence stepper and gates the bucket
pills + custom row + the RowGroup footer copy.

Hydration sets the distance toggle ON when an existing profile has a
non-'none' rangeSource (preserves prior choices). Save normalizes
rangeMiles/rangeSource to null/'none' when the toggle is OFF.

Replaces the deleted Time-only-as-pill semantic from Task 2. Footer
copy adopts "schedule" wording — full copy sweep lands in Task 7.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Bucket pills with icons + checkmark selected state

**Files:**
- Modify: `app/fuel.tsx` (bucket pill render block — both the per-bucket `.map` and the Custom pill; bucket pill styles)

**Goal:** Bucket pills get their Phosphor icon on the left. Selected pill prepends a `Check` glyph and adopts the freshgreen+white selected styling. This is the four-affordance selected state from spec §Selected-state design.

- [ ] **Step 1: Add a `BucketPill` helper component above `export default function Fuel`**

Find the line `export default function Fuel() {` (line ~66 current).

Insert directly above it:
```tsx
/**
 * Bucket pill — text-only label + leading Phosphor icon, with the
 * four-affordance selected state (bg, icon color, label color, Check
 * prefix). Used for the per-fuel-type buckets AND the universal Custom
 * pill. The Custom pill passes `Icon={PencilSimple}`.
 */
function BucketPill({
  Icon,
  label,
  selected,
  onPress,
  a11yLabel,
}: {
  Icon: typeof CarSimple;
  label: string;
  selected: boolean;
  onPress: () => void;
  a11yLabel: string;
}) {
  const iconColor = selected ? colors.white : colors.labelSecondary;
  const textStyle = [styles.rangeOptionText, selected && styles.rangeOptionTextSelected];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rangeOption,
        selected && styles.rangeOptionSelected,
        pressed && pressedDim,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={a11yLabel}
    >
      {selected && (
        <Check size={14} color={colors.white} weight="bold" />
      )}
      <Icon
        size={20}
        color={iconColor}
        weight={selected ? 'fill' : 'regular'}
      />
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Replace the inline bucket Pressables with `BucketPill`**

Find the bucket `.map` block (introduced in Task 4):
```tsx
{activeBuckets.map((b) => {
  const selected = selectedBucketId === b.id && !customRangeOpen;
  return (
    <Pressable
      key={b.id}
      onPress={() => handlePickBucket(b)}
      style={({ pressed }) => [
        styles.rangeOption,
        selected && styles.rangeOptionSelected,
        pressed && pressedDim,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={b.label}
    >
      <Text
        style={[
          styles.rangeOptionText,
          selected && styles.rangeOptionTextSelected,
        ]}
      >
        {b.label}
      </Text>
    </Pressable>
  );
})}
<Pressable
  onPress={handleOpenCustom}
  style={({ pressed }) => [
    styles.rangeOption,
    (selectedBucketId === 'custom' || customRangeOpen) &&
      styles.rangeOptionSelected,
    pressed && pressedDim,
  ]}
  accessibilityRole="radio"
  accessibilityState={{
    selected: selectedBucketId === 'custom' || customRangeOpen,
    checked: selectedBucketId === 'custom' || customRangeOpen,
  }}
  accessibilityLabel="Custom range"
>
  <Text
    style={[
      styles.rangeOptionText,
      (selectedBucketId === 'custom' || customRangeOpen) &&
        styles.rangeOptionTextSelected,
    ]}
  >
    {rangeSource === 'custom' && rangeMiles != null
      ? `Custom · ${rangeMiles} mi`
      : 'Custom…'}
  </Text>
</Pressable>
```

Replace with:
```tsx
{activeBuckets.map((b) => (
  <BucketPill
    key={b.id}
    Icon={b.Icon}
    label={b.label}
    selected={selectedBucketId === b.id && !customRangeOpen}
    onPress={() => handlePickBucket(b)}
    a11yLabel={b.label}
  />
))}
<BucketPill
  Icon={PencilSimple}
  label={
    rangeSource === 'custom' && rangeMiles != null
      ? `Custom · ${rangeMiles} mi`
      : 'Custom…'
  }
  selected={selectedBucketId === 'custom' || customRangeOpen}
  onPress={handleOpenCustom}
  a11yLabel="Custom range"
/>
```

- [ ] **Step 3: Update `rangeOption` style to flex icon + check + label**

Find (lines 520–529 current):
```ts
rangeOption: {
  minHeight: 44,
  minWidth: 44,
  justifyContent: 'center',
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderRadius: radii.pill,
  borderWidth: 1,
  borderColor: colors.separatorSubtle,
},
```

Replace with:
```ts
rangeOption: {
  minHeight: 44,
  minWidth: 44,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing.xs,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderRadius: radii.pill,
  borderWidth: 1,
  borderColor: colors.separatorSubtle,
},
```

The `flexDirection: 'row'` + `gap: spacing.xs` lays out the optional Check (14pt), the Icon (20pt), and the label in a tidy row. Width grows ~14pt + 4pt gap when selected — minor reflow in the wrap row is acceptable (`flexWrap: 'wrap'` on `rangeOptions` already absorbs it).

- [ ] **Step 4: Verify static**

Run: `npx tsc --noEmit`
Expected: clean against baseline.

- [ ] **Step 5: Commit**

```bash
git add app/fuel.tsx
git commit -m "$(cat <<'EOF'
feat(fuel): bucket pills with icons + checkmark selected state

Extracts a BucketPill component that bundles the four-affordance
selected state: freshgreen background, white label, white-fill icon,
and a leading Check glyph. Vehicle silhouettes for class buckets
(CarSimple/CarProfile/Truck) and battery levels for EV range buckets
(BatteryLow/Medium/High); Custom uses PencilSimple.

Pill width grows ~14pt + gap on select for the Check prefix; flex-wrap
on the row absorbs the reflow.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Fuel-type-change reset behavior

**Files:**
- Modify: `app/fuel.tsx` (state declarations, fuel-type segment `onPress`, `handlePickBucket` body, inline-note render inside Range section, styles)

**Goal:** When the user taps a different fuel type while a bucket was selected, clear the bucket pick and surface a one-line "Pick a tank range for your new fuel type" prompt above the pill row. The prompt auto-clears when the user makes a new selection.

- [ ] **Step 1: Add the `showFuelChangeNote` state**

Find the state block (now includes `distanceEnabled` from Task 4):
```ts
const [distanceEnabled, setDistanceEnabled] = useState(false);
```

Add directly below it:
```ts
// Inline prompt above the bucket pills, shown briefly after the user
// changes fuel type while a bucket was selected. Auto-clears on the
// next bucket pick (see handlePickBucket).
const [showFuelChangeNote, setShowFuelChangeNote] = useState(false);
```

- [ ] **Step 2: Wire fuel-type segment `onPress` to detect a real change**

Find the segment's `Pressable` (set up in Task 3):
```tsx
<Pressable
  key={ft.id}
  onPress={() => setFuelType(ft.id)}
  ...
```

Replace the `onPress` with:
```tsx
<Pressable
  key={ft.id}
  onPress={() => {
    if (ft.id === fuelType) return;
    setFuelType(ft.id);
    // Clear the bucket pick — a 350mi gas Sedan ≠ 350mi EV.
    // Auto-mapping would silently change a number the user didn't approve.
    if (rangeSource !== 'none') {
      setRangeMiles(null);
      setRangeSource('none');
      setCustomRangeOpen(false);
      setShowFuelChangeNote(true);
    }
  }}
  ...
```

(Only the `onPress` changes; the rest of the Pressable props from Task 3 stay.)

- [ ] **Step 3: Clear the note when the user picks a bucket**

Find `handlePickBucket` (updated in Task 2):
```ts
function handlePickBucket(bucket: BucketSpec) {
  setCustomRangeOpen(false);
  setRangeMiles(bucket.rangeMiles);
  setRangeSource('bucket');
}
```

Replace with:
```ts
function handlePickBucket(bucket: BucketSpec) {
  setCustomRangeOpen(false);
  setRangeMiles(bucket.rangeMiles);
  setRangeSource('bucket');
  setShowFuelChangeNote(false);
}
```

Also update `handleOpenCustom` (line ~149 current):
```ts
function handleOpenCustom() {
  setCustomRangeOpen(true);
  setCustomRangeText(rangeMiles != null ? String(rangeMiles) : '');
}
```

Replace with:
```ts
function handleOpenCustom() {
  setCustomRangeOpen(true);
  setCustomRangeText(rangeMiles != null ? String(rangeMiles) : '');
  setShowFuelChangeNote(false);
}
```

- [ ] **Step 4: Render the inline note above the bucket pills**

Find inside the Range section (added in Task 4) — the `<View style={styles.field}>` that contains the Tank range label and the `rangeOptions` View:

```tsx
<View style={styles.field}>
  <Text style={styles.fieldLabel}>Tank range</Text>
  <View
    style={styles.rangeOptions}
    accessibilityRole="radiogroup"
    accessibilityLabel="Tank range"
  >
```

Replace with:
```tsx
<View style={styles.field}>
  <Text style={styles.fieldLabel}>Tank range</Text>
  {showFuelChangeNote && (
    <Text style={styles.fuelChangeNote} accessibilityLiveRegion="polite">
      Pick a tank range for your new fuel type.
    </Text>
  )}
  <View
    style={styles.rangeOptions}
    accessibilityRole="radiogroup"
    accessibilityLabel="Tank range"
  >
```

- [ ] **Step 5: Add the `fuelChangeNote` style**

Find the styles block — locate the `rangeOptions` style.

Add directly above `rangeOptions`:
```ts
fuelChangeNote: {
  ...dynamicType(typography.footnoteRegular),
  color: colors.labelSecondary,
},
```

- [ ] **Step 6: Verify static**

Run: `npx tsc --noEmit`
Expected: clean against baseline.

- [ ] **Step 7: Commit**

```bash
git add app/fuel.tsx
git commit -m "$(cat <<'EOF'
feat(fuel): fuel-type-change clears bucket pick + inline prompt

Tapping a different fuel type while a bucket was selected clears
rangeMiles + rangeSource and surfaces a one-line "Pick a tank range
for your new fuel type" prompt above the pill row. Prompt auto-clears
on the next bucket selection or Custom tap. accessibilityLiveRegion
announces the prompt to VoiceOver.

Auto-mapping (silently swapping a 350mi gas Sedan to a 280mi EV Mid
on fuel-type change) is rejected — would change a number the user
didn't approve.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Current cycle group visibility fix + copy cleanup

**Files:**
- Modify: `app/fuel.tsx` (Current cycle RowGroup conditional, footer copy review)

**Goal:** Close the gating bug where the Current cycle group reads only saved `profile.remindersEnabled` and ignores local toggle state. Sweep any remaining "cadence" → "schedule" copy.

- [ ] **Step 1: Tighten the Current cycle group conditional**

Find (lines 376–399 current — the Status RowGroup):
```tsx
{profile?.remindersEnabled && nextLabel && (
  <RowGroup footer="Tell us how much you filled -- a partial fill reminds you sooner.">
    <View style={styles.statusBlock}>
      <Text style={styles.statusText}>Next reminder: {nextLabel}</Text>
      ...
    </View>
  </RowGroup>
)}
```

Replace the conditional only:
```tsx
{enabled && profile?.remindersEnabled && nextLabel && (
  <RowGroup footer="Tell us how much you filled — a partial fill reminds you sooner.">
    <View style={styles.statusBlock}>
      <Text style={styles.statusText}>Next reminder: {nextLabel}</Text>
      ...
    </View>
  </RowGroup>
)}
```

Two changes here:
1. Added `enabled &&` (local toggle) to the front of the conditional. Toggling off pre-Save now hides the live-state group immediately.
2. Footer en-dash (`—`) replaces the ASCII double-hyphen (`--`) for visual polish — the existing rendering shows literal `--` because RN doesn't typographically replace.

- [ ] **Step 2: Cross-check the Range section footer copy**

The Range section footer was set in Task 4 to:
```
"Reminders fire on your schedule OR after this many in-app navigated miles, whichever comes first. Miles only count trips you navigate in the app."
```

Confirm that string contains "schedule" (not "cadence"). If a stale "cadence" string slipped through, replace it here.

- [ ] **Step 3: Grep for any other "cadence" in user-facing strings**

Run: `grep -n 'cadence' app/fuel.tsx`
Expected: only the `cadenceDays` variable name should appear (state declaration, hydration, handleSave, stepper handlers). No user-facing copy should contain the word "cadence". If any does, replace with "schedule".

- [ ] **Step 4: Verify static**

Run: `npx tsc --noEmit`
Expected: clean against baseline.

- [ ] **Step 5: Commit**

```bash
git add app/fuel.tsx
git commit -m "$(cat <<'EOF'
fix(fuel): current cycle group gates on local enabled + copy cleanup

Current cycle group (Next reminder + I filled up) now hides immediately
when the local Remind-me toggle is off, instead of waiting for Save.
Closes the gap where toggling off left the live-state group on screen
with stale data.

Also: en-dash in "Tell us how much you filled —" footer and final
"cadence" → "schedule" sweep in user-facing copy. cadenceDays variable
name stays in code (developer-facing, no churn).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Final verification + device-test gate

**Files:**
- None modified — verification + manual device pass only.

**Goal:** Final tsc + device walkthrough of every spec scenario before declaring the PR ready for review.

- [ ] **Step 1: Final tsc clean**

Run: `npx tsc --noEmit`
Expected: zero new errors compared to baseline (4 known-unrelated pre-existing errors per workflow.md).

- [ ] **Step 2: Device test — fuel-type filtering**

On device (Expo Go or simulator):
1. Open `/fuel`.
2. With `fuelType = Gas`: confirm bucket pills are Compact 300 / Sedan 350 / SUV/Truck 400 / Custom — each with the expected icon (CarSimple / CarProfile / Truck / PencilSimple).
3. Tap Diesel: confirm pills swap to Compact 350 / Sedan 400 / SUV/Truck 450 / Custom.
4. Tap Hybrid: confirm pills swap to Compact 450 / Sedan 500 / SUV 550 / Custom. Note the Hybrid pill itself shows a Leaf glyph.
5. Tap Electric: confirm pills swap to Short 200 (BatteryLow) / Mid 280 (BatteryMedium) / Long 360 (BatteryHigh) / Custom. Electric pill shows a Lightning glyph.

- [ ] **Step 3: Device test — fuel-type-change reset**

1. With Gas selected, tap Sedan 350 → confirm pill turns freshgreen with leading Check glyph.
2. Tap Diesel → confirm: bucket pill clears (no freshgreen pill), inline note "Pick a tank range for your new fuel type." appears above the pill row.
3. Tap any new bucket → note disappears.

- [ ] **Step 4: Device test — "Also use distance" toggle**

1. Toggle "Remind me to refuel" ON if not already. Confirm cadence stepper + Range section render.
2. Inside Range section, toggle "Also use distance" OFF → confirm bucket pills + footer copy hide; only the toggle row remains visible.
3. Toggle ON → confirm pills + footer return.
4. Save with toggle ON, range = Sedan 350 → close + reopen `/fuel` → confirm distance toggle hydrates ON, Sedan 350 stays selected.
5. Toggle distance OFF → Save → close + reopen → confirm distance toggle hydrates OFF; no pill selected.

- [ ] **Step 5: Device test — Remind-me toggle gates cycle group**

1. Open `/fuel` with an existing profile that has `nextReminderAt` set. Confirm "Current cycle" group renders (Next reminder + I filled up fractions).
2. Toggle "Remind me to refuel" OFF without Saving. Confirm Current cycle group hides immediately.
3. Toggle back ON. Confirm Current cycle group returns.

- [ ] **Step 6: Device test — VoiceOver**

1. With VoiceOver enabled, swipe through each bucket pill. Each should announce: label + "selected"/"not selected".
2. Swipe to a selected pill → confirm "selected" state announced.
3. After triggering the fuel-change reset note (Step 3), confirm VoiceOver reads "Pick a tank range for your new fuel type" (live region).

- [ ] **Step 7: Self-review and audit pass**

Per project workflow (`docs/workflow.md` Step 7):
1. Run `code-reviewer` agent on the diff.
2. Run `mobile-ux-optimizer` agent on the diff — specifically check the selected-state visual jump and the fuel-type-change flow.
3. Address any P1 findings; defer P2 to next-session.md if they don't block merge.

- [ ] **Step 8: Workflow learnings entry (if applicable)**

Per `docs/learnings.md`: if the "anticipate Phase 2 slot in Phase 1.5 layout" pattern proved out (designing for an unbuilt feature without shipping a stub), append a branch-headed entry. Skip if nothing surprised.

- [ ] **Step 9: Final commit only if learnings or self-review fixes were applied**

```bash
# If self-review or learnings edits — commit them. Otherwise skip.
git add app/fuel.tsx docs/learnings.md
git commit -m "$(cat <<'EOF'
chore(fuel): post-review polish + learnings entry

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Out of scope (per spec)

These deliberately do NOT ship in this PR:
- EPA cascade / "Your car" Year-Make-Model rows (Phase 2 PR).
- The "Use my exact car for a precise range" upgrade link below the pills (Phase 2 PR — Phase 1.5 omits it entirely; no stub or placeholder).
- Changes to `FuelProfile`, `useFuelProfile`, `lib/api/fuel.ts`, `useTripOdometer`, `markFilledUp`, or any trigger-engine logic.
- Changes to Preferred Stations behavior.
- Icon additions outside `app/fuel.tsx`.
