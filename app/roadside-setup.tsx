import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
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

  // Seed the form once, after the profile loads (if one exists). Was
  // a conditional setState during render — works but trips React 19's
  // stricter dev warnings. useEffect on [loading, profile] is the
  // idiomatic equivalent: the `hydrated` latch still ensures we never
  // overwrite user edits if the profile re-resolves on refocus.
  useEffect(() => {
    if (loading || hydrated) return;
    if (profile) {
      setServiceName(profile.serviceName);
      setPhoneNumber(profile.phoneNumber);
    }
    setHydrated(true);
  }, [loading, profile, hydrated]);

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
              // 44pt painted floor instead of hitSlop — .cursorrules
              // forbids hitSlop as the compliance mechanism on a sub-44pt
              // visual. The 28pt CaretLeft centers inside (audit #10 fix).
              style={tapTarget44}
            >
              <CaretLeft size={28} color={colors.black} weight="regular" />
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  kav: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  // (backBtn replaced by the shared `tapTarget44` token in audit #10
  //  review — applied directly at the back Pressable.)
  // Title sits on its own line below the back chevron (matches /fuel +
  // /recordings + /safety-settings) — chevron and title on one row read
  // congested.
  title: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  body: { flex: 1, gap: spacing.sm },
  fieldLabel: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.labelSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  cta: {
    minHeight: 50,
    borderRadius: 100,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  ctaDisabled: {
    backgroundColor: colors.cardBorderSubtle,
  },
  ctaLabel: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.white,
  },
});
