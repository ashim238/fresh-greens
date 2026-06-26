import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useMutation } from '../hooks/useMutation';
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

import { BackButton } from '../components/BackButton';
import { useRoadsideProfile } from '../hooks/useRoadsideProfile';
import { getErrorMessage } from '../lib/error-message';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
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
  const saveMutation = useMutation(saveProfile);
  const saving = saveMutation.status === 'pending';

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

  function saveAccessibilityHint(): string | undefined {
    if (canSave) return 'Saves your roadside service profile';
    if (saving) return undefined;
    if (!nameValid) return 'Enter a service name to enable Save';
    if (!phoneValid) return 'Enter a phone number with at least 7 digits to enable Save';
    return undefined;
  }

  async function handleSave() {
    if (!canSave) return;
    const result = await saveMutation.run({ serviceName, phoneNumber });
    if (result.ok) {
      router.back();
    } else {
      const { title, body } = getErrorMessage('save', 'transient', saveMutation.error);
      Alert.alert(title, body);
      // status === 'error' now; setting it again is unnecessary —
      // useMutation tracks it. Button re-enables automatically.
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
            <BackButton onPress={() => router.back()} />
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
              placeholderTextColor={colors.labelTertiary}
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
              placeholderTextColor={colors.labelTertiary}
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
            accessibilityHint={saveAccessibilityHint()}
            accessibilityState={{ disabled: !canSave, busy: saving }}
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
  // Back chevron uses the shared `<BackButton>` component (which carries
  // its own 44pt painted target). Title sits on its own line below it
  // (matches /fuel + /recordings + /safety-settings) — chevron and title
  // on one row read congested.
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
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  cta: {
    minHeight: 50,
    borderRadius: radii.pill,
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
