import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Minus } from 'phosphor-react-native/src/icons/Minus';
import { Plus } from 'phosphor-react-native/src/icons/Plus';

import { RowGroup } from '../components/settings/RowGroup';
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { type FuelType } from '../lib/api/fuel';
import { useFuelProfile } from '../hooks/useFuelProfile';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
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
 * Settings register: SettingsHeader (back + close) over a grouped-gray
 * page; the form's controls are grouped into RowGroups (Your car /
 * Reminder / current-state) with the Save CTA full-width below them.
 * Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md
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
            <RowGroup title="Your car">
              <View style={styles.field}>
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
              </View>

              <View style={styles.field}>
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
              </View>
            </RowGroup>

            <RowGroup title="Reminder">
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
            </RowGroup>

            {profile?.remindersEnabled && nextLabel && (
              <RowGroup footer="Tap “I filled up” to reset the cadence clock.">
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
              </RowGroup>
            )}

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
  filledBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.freshgreen,
  },
  filledBtnText: { ...dynamicType(typography.subheadlineEmphasized), color: colors.freshgreen },
  saveBtn: {
    minHeight: 50,
    borderRadius: 100,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { ...dynamicType(typography.bodyEmphasized), color: colors.white },
});
