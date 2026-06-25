import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RowGroup } from '../components/settings/RowGroup';
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { SettingsRow } from '../components/settings/SettingsRow';
import { useInsuranceProfile } from '../hooks/useInsuranceProfile';
import { useMutation } from '../hooks/useMutation';
import { getErrorMessage } from '../lib/error-message';
import {
  extractInsuranceCardText,
  isInsuranceOcrEnvironment,
  isInsuranceOcrSupported,
} from '../lib/insurance-ocr-native';
import { parseInsuranceFromOcr } from '../lib/insurance-ocr';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * /insurance-setup — carrier + policy number for pulled-over "What to
 * Have." Manual entry or scan an insurance card photo (on-device OCR via
 * Apple Vision; requires a dev build, not Expo Go).
 *
 * Settings register: grouped-gray page, SettingsHeader, RowGroup cards
 * (matches /fuel and /safety-settings). Full stack push from
 * /safety-settings; router.back() returns to Safety.
 */
export default function InsuranceSetup() {
  const router = useRouter();
  const { profile, loading, saveProfile } = useInsuranceProfile();
  const [ocrSupported, setOcrSupported] = useState(false);

  useEffect(() => {
    if (!isInsuranceOcrEnvironment()) {
      setOcrSupported(false);
      return;
    }
    void isInsuranceOcrSupported().then(setOcrSupported);
  }, []);

  const [carrierName, setCarrierName] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [cardPhotoUri, setCardPhotoUri] = useState<string | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [carrierTouched, setCarrierTouched] = useState(false);
  const [policyTouched, setPolicyTouched] = useState(false);
  const saveMutation = useMutation(saveProfile);
  const saving = saveMutation.status === 'pending';

  useEffect(() => {
    if (loading || hydrated) return;
    if (profile) {
      setCarrierName(profile.carrierName);
      setPolicyNumber(profile.policyNumber);
      setCardPhotoUri(profile.cardPhotoUri);
    }
    setHydrated(true);
  }, [loading, profile, hydrated]);

  const carrierValid = carrierName.trim().length > 0;
  const policyValid = policyNumber.replace(/[^A-Za-z0-9]/g, '').length >= 4;
  const canSave = carrierValid && policyValid && !saving && !scanning;

  const isDirty =
    hydrated &&
    (carrierName.trim() !== (profile?.carrierName ?? '').trim() ||
      policyNumber.trim() !== (profile?.policyNumber ?? '').trim() ||
      cardPhotoUri !== profile?.cardPhotoUri);

  const carrierError =
    carrierTouched && !carrierValid ? 'Enter your insurance carrier.' : null;
  const policyError =
    policyTouched && !policyValid
      ? 'Policy number needs at least 4 letters or digits.'
      : null;

  const scanFooter =
    scanError ?? (ocrSupported ? 'On-device only. Nothing is uploaded.' : undefined);
  const scanFooterTone = scanError ? 'error' : 'default';

  function saveAccessibilityHint(): string | undefined {
    if (canSave) return 'Saves your insurance profile';
    if (scanning) return 'Finish scanning before saving';
    if (saving) return undefined;
    if (!carrierValid) return 'Enter your insurance carrier to enable Save';
    if (!policyValid) {
      return 'Policy number needs at least 4 letters or digits to enable Save';
    }
    return undefined;
  }

  function confirmDiscard(onDiscard: () => void) {
    if (!isDirty) {
      onDiscard();
      return;
    }
    Alert.alert(
      'Discard changes?',
      'You have unsaved insurance information.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDiscard },
      ],
    );
  }

  function handleBack() {
    confirmDiscard(() => router.back());
  }

  function handleClose() {
    confirmDiscard(() => router.replace('/home'));
  }

  function handleCarrierChange(text: string) {
    setScanError(null);
    setCarrierName(text);
  }

  function handlePolicyChange(text: string) {
    setScanError(null);
    setPolicyNumber(text);
  }

  async function handleSave() {
    setCarrierTouched(true);
    setPolicyTouched(true);
    if (!canSave) return;
    const result = await saveMutation.run({
      carrierName,
      policyNumber,
      cardPhotoUri,
    });
    if (result.ok) {
      router.back();
    } else {
      const { title, body } = getErrorMessage(
        'save',
        'transient',
        saveMutation.error,
      );
      Alert.alert(title, body);
    }
  }

  async function runOcrOnUri(uri: string) {
    setScanning(true);
    setScanError(null);
    try {
      const lines = await extractInsuranceCardText(uri);
      const draft = parseInsuranceFromOcr(lines);
      if (draft.carrierName) setCarrierName(draft.carrierName);
      if (draft.policyNumber) setPolicyNumber(draft.policyNumber);
      setCardPhotoUri(uri);
      if (!draft.carrierName && !draft.policyNumber) {
        setScanError(
          'Could not read the card clearly. Check the fields below or try another photo.',
        );
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[insurance-setup] OCR failed', err);
      }
      setCardPhotoUri(uri);
      setScanError(
        'Could not read text from that photo. Fill in the fields manually.',
      );
    } finally {
      setScanning(false);
    }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow camera access in Settings to scan your insurance card.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    await runOcrOnUri(result.assets[0].uri);
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photos access needed',
        'Allow photo library access in Settings to import your insurance card.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    await runOcrOnUri(result.assets[0].uri);
  }

  function handleScanCard() {
    if (!ocrSupported) {
      Alert.alert(
        'Development build required',
        'Card scanning uses on-device OCR that is not available in Expo Go. Enter your carrier and policy number below, or install a development build.',
      );
      return;
    }
    Alert.alert('Scan insurance card', 'Take a photo or choose one you already have.', [
      { text: 'Take photo', onPress: () => void pickFromCamera() },
      { text: 'Choose photo', onPress: () => void pickFromLibrary() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleRemovePhoto() {
    setCardPhotoUri(undefined);
    // Persist immediately when a saved profile had a photo — avoids
    // "removed locally, still on disk after back()" confusion.
    if (
      profile?.cardPhotoUri &&
      carrierValid &&
      policyValid &&
      !saving &&
      !scanning
    ) {
      await saveMutation.run({
        carrierName,
        policyNumber,
        cardPhotoUri: undefined,
      });
    }
  }

  const formReady = hydrated && !loading;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SettingsHeader
            title="Auto insurance"
            onBack={handleBack}
            onClose={handleClose}
          />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!formReady ? (
              <View style={styles.loadingBody}>
                <ActivityIndicator color={colors.freshgreen} size="large" />
                <Text style={styles.loadingLabel}>Loading insurance…</Text>
              </View>
            ) : (
              <>
                <RowGroup footer={scanFooter} footerTone={scanFooterTone}>
                  <SettingsRow
                    icon={
                      scanning ? (
                        <ActivityIndicator color={colors.freshgreen} />
                      ) : (
                        <Camera
                          size={24}
                          color={colors.black}
                          weight="duotone"
                        />
                      )
                    }
                    label={
                      scanning ? 'Reading card…' : 'Scan insurance card'
                    }
                    onPress={handleScanCard}
                    disabled={scanning}
                    busy={scanning}
                    accessibilityHint={
                      ocrSupported
                        ? 'Opens camera or photo library to read your card'
                        : 'Requires a development build; opens an explanation'
                    }
                  />

                  {cardPhotoUri ? (
                    <View>
                      <Image
                        source={{ uri: cardPhotoUri }}
                        style={styles.cardThumb}
                        resizeMode="cover"
                        accessible
                        accessibilityLabel="Insurance card photo"
                        accessibilityIgnoresInvertColors
                      />
                      <Pressable
                        onPress={() => void handleRemovePhoto()}
                        style={({ pressed }) => [
                          styles.removePhotoBtn,
                          pressed && pressedDim,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Remove card photo"
                        accessibilityHint={
                          profile?.cardPhotoUri
                            ? 'Removes the photo and saves your profile'
                            : 'Removes the card photo'
                        }
                      >
                        <Text style={styles.removePhotoLabel}>
                          Remove card photo
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </RowGroup>

                <RowGroup title="Enter manually">
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Carrier</Text>
                    <TextInput
                      style={[
                        styles.input,
                        carrierError ? styles.inputError : null,
                      ]}
                      value={carrierName}
                      onChangeText={handleCarrierChange}
                      onBlur={() => setCarrierTouched(true)}
                      placeholder="State Farm, GEICO, …"
                      placeholderTextColor={colors.mutedSecondary}
                      autoCapitalize="words"
                      accessibilityLabel="Carrier"
                    />
                    {carrierError ? (
                      <Text style={styles.fieldError} accessibilityRole="alert">
                        {carrierError}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Policy number</Text>
                    <TextInput
                      style={[
                        styles.input,
                        policyError ? styles.inputError : null,
                      ]}
                      value={policyNumber}
                      onChangeText={handlePolicyChange}
                      onBlur={() => setPolicyTouched(true)}
                      placeholder="As printed on your card"
                      placeholderTextColor={colors.mutedSecondary}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      accessibilityLabel="Policy number"
                    />
                    {policyError ? (
                      <Text style={styles.fieldError} accessibilityRole="alert">
                        {policyError}
                      </Text>
                    ) : null}
                  </View>
                </RowGroup>

                <Pressable
                  onPress={handleSave}
                  disabled={!canSave}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    !canSave && styles.saveBtnDisabled,
                    pressed && canSave && pressedDim,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    saving ? 'Saving insurance' : 'Save insurance'
                  }
                  accessibilityHint={saveAccessibilityHint()}
                  accessibilityState={{ disabled: !canSave, busy: saving }}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.systemGroupedBackground },
  safe: { flex: 1 },
  loadingBody: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  loadingLabel: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelSecondary,
  },
  kav: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.xl },
  cardThumb: {
    width: '100%',
    aspectRatio: 1.586,
    backgroundColor: colors.fillsTertiary,
  },
  removePhotoBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  removePhotoLabel: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
  field: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  fieldLabel: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.labelSecondary,
  },
  input: {
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.separatorSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  inputError: {
    borderColor: colors.red,
  },
  fieldError: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.red,
  },
  saveBtn: {
    minHeight: 50,
    borderRadius: radii.pill,
    backgroundColor: colors.freshgreen,
    // 1pt wiltedgreen border per DESIGN.md: freshgreen alone is 2.88:1
    // against the page (below the 3:1 UI-component floor); the border
    // lifts the button-to-page edge into a legible range.
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.white,
  },
});
