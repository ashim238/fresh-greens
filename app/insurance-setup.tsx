import * as ImagePicker from 'expo-image-picker';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  extractTextFromImage,
  isSupported as ocrSupported,
} from 'expo-text-extractor';
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

import { useInsuranceProfile } from '../hooks/useInsuranceProfile';
import { useMutation } from '../hooks/useMutation';
import { getErrorMessage } from '../lib/error-message';
import { parseInsuranceFromOcr } from '../lib/insurance-ocr';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * /insurance-setup — carrier + policy number for pulled-over "What to
 * Have." Manual entry or scan an insurance card photo (on-device OCR via
 * Apple Vision; requires a dev build, not Expo Go).
 *
 * Pushed from /safety-settings. router.back() returns to Safety.
 */
export default function InsuranceSetup() {
  const router = useRouter();
  const { profile, loading, saveProfile } = useInsuranceProfile();

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

  const carrierError =
    carrierTouched && !carrierValid ? 'Enter your insurance carrier.' : null;
  const policyError =
    policyTouched && !policyValid
      ? 'Policy number needs at least 4 letters or digits.'
      : null;

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
      const lines = await extractTextFromImage(uri);
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

  if (loading && !hydrated) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.loadingSafe} edges={['top', 'bottom']}>
          <ActivityIndicator color={colors.freshgreen} size="large" />
          <Text style={styles.loadingLabel}>Loading insurance…</Text>
        </SafeAreaView>
      </View>
    );
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
              style={tapTarget44}
            >
              <CaretLeft size={28} color={colors.black} weight="regular" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.intro}>
              <Text style={styles.title} accessibilityRole="header">
                Auto insurance
              </Text>
              <Text style={styles.lede}>
                Save carrier and policy number so they are ready if you are
                stopped.
              </Text>
            </View>

            <View style={styles.scanSection}>
              {!ocrSupported ? (
                <Text style={styles.scanCapabilityNote} accessibilityRole="text">
                  Card scanning needs a development build. Manual entry below
                  still works in Expo Go.
                </Text>
              ) : null}

              <View style={styles.scanCardShadow}>
                <View style={styles.scanCard}>
                  <Pressable
                    onPress={handleScanCard}
                    disabled={scanning}
                    style={({ pressed }) => [
                      styles.scanRow,
                      pressed && !scanning && pressedDim,
                      scanning && styles.scanRowBusy,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Scan insurance card"
                    accessibilityHint={
                      ocrSupported
                        ? 'Opens camera or photo library to read your card'
                        : 'Requires a development build; opens an explanation'
                    }
                    accessibilityState={{ disabled: scanning, busy: scanning }}
                  >
                    <View style={styles.scanIconCircle}>
                      {scanning ? (
                        <ActivityIndicator color={colors.freshgreen} />
                      ) : (
                        <Camera
                          size={24}
                          color={colors.freshgreen}
                          weight="duotone"
                        />
                      )}
                    </View>
                    <View style={styles.scanCopy}>
                      <Text style={styles.scanTitle}>
                        {scanning ? 'Reading card…' : 'Scan insurance card'}
                      </Text>
                      <Text style={styles.scanSubtitle}>
                        On-device only. Nothing is uploaded.
                      </Text>
                    </View>
                    <CaretRight
                      size={16}
                      color={colors.labelTertiary}
                      weight="regular"
                    />
                  </Pressable>

                  {cardPhotoUri ? (
                    <>
                      <View style={styles.scanDivider} />
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
                    </>
                  ) : null}
                </View>
              </View>

              {scanError ? (
                <Text style={styles.scanError} accessibilityRole="alert">
                  {scanError}
                </Text>
              ) : null}
            </View>

            <View style={styles.manualSection}>
              <Text style={styles.sectionLabel} accessibilityRole="header">
                Enter manually
              </Text>
              <View style={styles.fieldGroup}>
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
                  placeholderTextColor={colors.labelTertiary}
                  autoCapitalize="words"
                  accessibilityLabel="Carrier"
                />
                {carrierError ? (
                  <Text style={styles.fieldError} accessibilityRole="alert">
                    {carrierError}
                  </Text>
                ) : null}
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Policy number</Text>
                <TextInput
                  style={[styles.input, policyError ? styles.inputError : null]}
                  value={policyNumber}
                  onChangeText={handlePolicyChange}
                  onBlur={() => setPolicyTouched(true)}
                  placeholder="As printed on your card"
                  placeholderTextColor={colors.labelTertiary}
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
            </View>
          </ScrollView>

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.cta,
              !canSave && styles.ctaDisabled,
              pressed && canSave && pressedDim,
            ]}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Saving insurance' : 'Save insurance'}
            accessibilityHint="Saves your insurance profile"
            accessibilityState={{ disabled: !canSave, busy: saving }}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.ctaLabel}>Save</Text>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  loadingSafe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  loadingLabel: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelSecondary,
  },
  kav: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: spacing.lg,
    gap: spacing.xl,
  },
  intro: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  title: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
  },
  lede: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelSecondary,
  },
  scanSection: {
    gap: spacing.sm,
  },
  scanCapabilityNote: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
    paddingHorizontal: spacing.xs,
  },
  scanCardShadow: {
    borderRadius: radii.md,
    ...shadows.e1,
  },
  scanCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorderSubtle,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scanRowBusy: { opacity: 0.7 },
  scanIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.fadedgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCopy: { flex: 1, gap: spacing.xs },
  scanTitle: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  scanSubtitle: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
  scanDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorderSubtle,
    marginLeft: spacing.md + 44 + spacing.md,
  },
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
  scanError: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.red,
    paddingHorizontal: spacing.xs,
  },
  manualSection: {
    gap: spacing.md,
  },
  sectionLabel: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.wiltedgreen,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.labelSecondary,
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
  inputError: {
    borderColor: colors.red,
  },
  fieldError: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.red,
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
