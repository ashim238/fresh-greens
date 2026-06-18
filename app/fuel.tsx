import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

import { RowGroup } from '../components/settings/RowGroup';
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { type FuelProfile, type FuelType } from '../lib/api/fuel';
import { useFuelProfile } from '../hooks/useFuelProfile';
import { usePreferredStations } from '../hooks/usePreferredStations';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

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

const MIN_DAYS = 1;
const MAX_DAYS = 60;

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

const MIN_RANGE = 20;
const MAX_RANGE = 800;

/** Fraction-button options for "I filled up" (Phase 1 / all EVs). */
const FILL_FRACTIONS: { id: string; label: string; a11yLabel: string; fraction: number }[] = [
  { id: 'full', label: 'Filled up', a11yLabel: 'Filled up', fraction: 1 },
  { id: 'three-q', label: '¾', a11yLabel: 'Filled three quarters', fraction: 0.75 },
  { id: 'half', label: '½', a11yLabel: 'Filled one half', fraction: 0.5 },
  { id: 'quarter', label: '¼', a11yLabel: 'Filled one quarter', fraction: 0.25 },
];

/**
 * Bucket pill — text label + leading Phosphor icon, with the
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

/**
 * /fuel — refuel-reminder setup. Pushed from the /search Fuel card.
 *
 * Time-based by design (no fuel sensing): the user sets a cadence and an
 * optional car profile; saving schedules a recurring local notification
 * via useFuelProfile. "I filled up" resets the cadence clock. See
 * docs/superpowers/specs/2026-05-30-refuel-reminders-design.md.
 *
 * Settings register: SettingsHeader (back + close) over a grouped-gray
 * page; the form's controls are grouped into RowGroups (Your car /
 * Reminder / current-state) with the Save CTA full-width below them.
 * Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md
 */
export default function Fuel() {
  const router = useRouter();
  const { profile, loading, saveProfile, markFilledUp } = useFuelProfile();
  const { stations: preferredStations, remove: removePreferredStation } =
    usePreferredStations();

  function handleRemoveStation(id: string, name: string) {
    Alert.alert('Remove station', `Remove "${name}" from your preferred stations?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removePreferredStation(id),
      },
    ]);
  }

  // Local form state, seeded from the stored profile once loaded.
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
  // "Also use distance" toggle — owns the distance-trigger on/off
  // semantics. When OFF, rangeMiles=null and rangeSource='none' on save.
  // Hydrated from existing profile.rangeSource (ON if any non-'none' source).
  const [distanceEnabled, setDistanceEnabled] = useState(false);
  // Inline prompt above the bucket pills, shown briefly after the user
  // changes fuel type while a bucket was selected. Auto-clears on the
  // next bucket pick (see handlePickBucket).
  const [showFuelChangeNote, setShowFuelChangeNote] = useState(false);

  // Seed the form once, after the profile loads. useEffect (vs the
  // older conditional-setState-during-render pattern) is the idiomatic
  // shape and avoids React 19's stricter dev warnings. The `hydrated`
  // latch still prevents re-seeding if the profile re-resolves on focus.
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

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const result = await saveProfile({
      carName: carName.trim() || undefined,
      fuelType,
      cadenceDays,
      remindersEnabled: enabled,
      rangeMiles: distanceEnabled ? rangeMiles : null,
      rangeSource: distanceEnabled ? rangeSource : 'none',
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

  async function handleFilledUp(fillFraction: number) {
    const result = await markFilledUp(fillFraction);
    if (!result.ok) {
      Alert.alert('Could not update', 'Please try again in a moment.');
    }
  }

  function handlePickBucket(bucket: BucketSpec) {
    setCustomRangeOpen(false);
    setRangeMiles(bucket.rangeMiles);
    setRangeSource('bucket');
    setShowFuelChangeNote(false);
  }

  function handleOpenCustom() {
    setCustomRangeOpen(true);
    setCustomRangeText(rangeMiles != null ? String(rangeMiles) : '');
    setShowFuelChangeNote(false);
  }

  function handleCommitCustom() {
    const parsed = parseInt(customRangeText, 10);
    if (Number.isFinite(parsed)) {
      const clamped = Math.max(MIN_RANGE, Math.min(MAX_RANGE, parsed));
      setRangeMiles(clamped);
      setRangeSource('custom');
      setCustomRangeText(String(clamped));
    } else {
      // Invalid input (empty or NaN) — close the custom input and revert
      // to the previously committed range so the Custom chip doesn't stay
      // selected with no value behind it.
      setCustomRangeOpen(false);
    }
  }

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
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SettingsHeader
            title="Refuel reminders"
            onBack={() => router.back()}
            onClose={() => router.replace('/home')}
          />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <RowGroup>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Car name (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={carName}
                  onChangeText={setCarName}
                  placeholder="e.g. Civic"
                  placeholderTextColor={colors.mutedSecondary}
                  returnKeyType="done"
                  accessibilityLabel="Car name, optional"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Fuel type</Text>
                <View style={styles.segment}>
                  {FUEL_TYPES.map((ft) => {
                    const selected = fuelType === ft.id;
                    return (
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
              </View>
            </RowGroup>

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

            {profile?.remindersEnabled && nextLabel && (
              <RowGroup footer="Tell us how much you filled -- a partial fill reminds you sooner.">
                <View style={styles.statusBlock}>
                  <Text style={styles.statusText}>Next reminder: {nextLabel}</Text>
                  <Text style={styles.fieldLabel}>I filled up…</Text>
                  <View style={styles.fillRow}>
                    {FILL_FRACTIONS.map((f) => (
                      <Pressable
                        key={f.id}
                        onPress={() => handleFilledUp(f.fraction)}
                        style={({ pressed }) => [
                          styles.fillBtn,
                          pressed && pressedDim,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={f.a11yLabel}
                      >
                        <Text style={styles.fillBtnText}>{f.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </RowGroup>
            )}

            <RowGroup
              title="Preferred stations"
              footer="Stations you trust — starred from the on-route fuel list or a Gas search."
            >
              {preferredStations.length === 0 ? (
                <View style={styles.emptyStationRow}>
                  <Text style={styles.emptyStationText}>
                    Star a gas station you trust and it&apos;ll show up here.
                  </Text>
                </View>
              ) : (
                preferredStations.map((s) => (
                  <View key={s.id} style={styles.stationRow}>
                    <View style={styles.stationTextStack}>
                      <Text style={styles.stationName} numberOfLines={1}>{s.name}</Text>
                      {s.brand ? (
                        <Text style={styles.stationBrand} numberOfLines={1}>{s.brand}</Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleRemoveStation(s.id, s.name)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${s.name}`}
                      style={({ pressed }) => [pressed && pressedDim]}
                    >
                      <Trash size={20} color={colors.labelSecondary} weight="regular" />
                    </Pressable>
                  </View>
                ))
              )}
            </RowGroup>

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
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.systemGroupedBackground },
  safe: { flex: 1 },
  kav: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.xl },
  // Each form control sits as a flat row inside its RowGroup card; the
  // card owns the bg/radius/shadow, so the field just provides the row's
  // inset padding (matching SettingsRow) and stacks its label + control.
  field: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  fieldLabel: { ...dynamicType(typography.footnoteEmphasized), color: colors.labelSecondary },
  input: {
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.separatorSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  segment: { flexDirection: 'row', gap: spacing.sm },
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
  segmentItemSelected: {
    backgroundColor: colors.freshgreen,
    borderColor: colors.freshgreen,
  },
  segmentText: { ...dynamicType(typography.subheadlineEmphasized), color: colors.labelSecondary },
  segmentTextSelected: { color: colors.white },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  stepBtn: {
    // 44pt stepper buttons — minHeight not height because at AX5 the
    // value-row container grows to fit the scaled stepValue and the
    // buttons should grow with it (per ax5/safety-surfaces minHeight rule).
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.separatorSubtle,
  },
  stepValue: { ...dynamicType(typography.bodyEmphasized), color: colors.black, minWidth: 72, textAlign: 'center' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleLabel: { ...dynamicType(typography.bodyRegular), color: colors.black },
  statusBlock: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusText: { ...dynamicType(typography.footnoteRegular), color: colors.labelSecondary },
  fuelChangeNote: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
  rangeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  rangeOptionSelected: {
    backgroundColor: colors.freshgreen,
    borderColor: colors.freshgreen,
  },
  rangeOptionText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.labelSecondary,
  },
  rangeOptionTextSelected: { color: colors.white },
  customRangeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  customRangeUnit: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelSecondary,
  },
  fillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fillBtn: {
    minHeight: 44,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.freshgreen,
  },
  fillBtnText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.freshgreen,
  },
  saveBtn: {
    minHeight: 50,
    borderRadius: radii.pill,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { ...dynamicType(typography.bodyEmphasized), color: colors.white },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stationTextStack: { flex: 1, gap: 2 },
  stationName: { ...dynamicType(typography.bodyRegular), color: colors.black },
  stationBrand: { ...dynamicType(typography.footnoteRegular), color: colors.labelSecondary },
  emptyStationRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  emptyStationText: { ...dynamicType(typography.footnoteRegular), color: colors.labelSecondary },
});
