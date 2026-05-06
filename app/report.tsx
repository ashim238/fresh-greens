import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  addCommunityReport,
  CATEGORIES,
  type CommunityReport,
  type ReportCategory,
  removeCommunityReport,
} from '../lib/api/community-reports';
import type { Coordinate } from '../lib/api/zones';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * /report — community reporting flow.
 *
 * Single screen, internal state machine: picker → detail → thank-you.
 * All three states share the same backdrop (the map screen showing
 * through a 20% scrim) and the same centered popup card; only the
 * card's contents change. That's a state machine, not three routes.
 *
 * Presentation is configured in _layout.tsx as `transparentModal` so
 * the underlying screen (typically /home) stays visible the entire
 * time. Dismissal is via the X button or the system back gesture.
 *
 * Location: this PR uses the user's current GPS as the report location
 * regardless of entry point. Drop-pin mode (user taps a map point to
 * place the pin) is deferred to a future PR — the choreography that
 * answers "where is this report being placed?" is its own concern.
 *
 * Figma nodes: 984:5010 (picker), 987:4291 (Felt unsafe), 992:4752
 * (Lighting), 992:4933 (Black-owned), 992:3933 (Thank You).
 */

type Mode = 'picker' | 'detail' | 'thank-you';

export default function Report() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('picker');
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [detailText, setDetailText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<CommunityReport | null>(
    null,
  );
  const [location, setLocation] = useState<Coordinate | null>(null);

  // Pull current GPS once on mount. Permission was already granted by
  // /permissions earlier in the flow; this call returns immediately
  // with cached coords on subsequent uses.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      if (cancelled) return;
      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleClose() {
    router.back();
  }

  function handlePickCategory(c: ReportCategory) {
    setCategory(c);
    setDetailText('');
    setMode('detail');
  }

  function handleBackFromDetail() {
    setCategory(null);
    setMode('picker');
  }

  async function handleSubmit() {
    if (!category || !location || submitting) return;
    setSubmitting(true);
    try {
      const report = await addCommunityReport({
        categoryId: category.id,
        location,
        detail: detailText.trim() || undefined,
        // Anonymous categories never persist a submitter; for non-
        // anonymous, the real implementation would attach the auth
        // user's id once auth lands. Mock placeholder for now.
        submittedBy: category.anonymous ? undefined : 'mock-user',
      });
      setSubmittedReport(report);
      setMode('thank-you');
    } catch (error) {
      console.warn('[report] submit failed:', error);
      Alert.alert('Could not submit', 'Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUndo() {
    if (!submittedReport) return;
    await removeCommunityReport(submittedReport.id);
    setSubmittedReport(null);
    setMode('detail');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* Scrim — 20% black, fills the screen behind the popup. */}
      <Pressable
        style={styles.scrim}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss report"
      />

      <View style={styles.popup}>
        {mode === 'picker' && (
          <PickerView
            onClose={handleClose}
            onPick={handlePickCategory}
          />
        )}
        {mode === 'detail' && category && (
          <DetailView
            category={category}
            detailText={detailText}
            onChangeDetail={setDetailText}
            onBack={handleBackFromDetail}
            onClose={handleClose}
            onSubmit={handleSubmit}
            submitting={submitting}
            locationKnown={location !== null}
          />
        )}
        {mode === 'thank-you' && (
          <ThankYouView
            onUndo={handleUndo}
            onClose={handleClose}
          />
        )}
      </View>
    </View>
  );
}

// --- Picker view ---------------------------------------------------------

function PickerView({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (category: ReportCategory) => void;
}) {
  return (
    <>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
        >
          <Ionicons name="close-circle-outline" size={20} color={colors.labelTertiary} />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <View style={styles.identityIcon}>
          <Ionicons name="alert-circle" size={32} color={colors.orange} />
        </View>
        <Text style={styles.titleEmphasized}>Report</Text>
        <Text style={styles.subtitle}>
          Let the community know what's happening near you.
        </Text>
      </View>

      <View style={styles.grid}>
        {/* Render in 3 rows of 2. CATEGORIES is already in the right
            order (avoid → caution → safe) — slice into rows. */}
        {[0, 2, 4].map((rowStart) => (
          <View style={styles.gridRow} key={rowStart}>
            {CATEGORIES.slice(rowStart, rowStart + 2).map((c) => (
              <Pressable
                key={c.id}
                style={styles.tile}
                onPress={() => onPick(c)}
                accessibilityRole="button"
                accessibilityLabel={c.label}
              >
                <View style={styles.tileIconBox}>
                  <Ionicons
                    name={c.iconName as keyof typeof Ionicons.glyphMap}
                    size={48}
                    color={colors.black}
                    accessible={false}
                  />
                </View>
                <Text style={styles.tileLabel}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </>
  );
}

// --- Detail view ---------------------------------------------------------

function DetailView({
  category,
  detailText,
  onChangeDetail,
  onBack,
  onClose,
  onSubmit,
  submitting,
  locationKnown,
}: {
  category: ReportCategory;
  detailText: string;
  onChangeDetail: (text: string) => void;
  onBack: () => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  locationKnown: boolean;
}) {
  function handlePhotoStubTap() {
    // Photo capture lands in a future PR. For now the affordance is
    // visual; tapping acknowledges the intent without leading anywhere
    // half-built.
    Alert.alert(
      'Photo capture coming soon',
      'For now, descriptions only. Full camera support lands in a future update.',
    );
  }

  return (
    <>
      <View style={styles.headerRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.labelTertiary} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
        >
          <Ionicons name="close-circle-outline" size={20} color={colors.labelTertiary} />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <View style={styles.identityIcon}>
          <Ionicons
            name={category.iconName as keyof typeof Ionicons.glyphMap}
            size={32}
            color={colors.black}
          />
        </View>
        {/* Title1 Regular — see .cursorrules. The modal is asking, not telling. */}
        <Text style={styles.titleRegular}>{category.label}</Text>
        <Text style={styles.subtitle}>{category.subtitle}</Text>
        {category.anonymous && (
          <Text style={styles.anonymousNote}>
            Note: All reports are anonymous
          </Text>
        )}
      </View>

      <View style={styles.formBlock}>
        <Text style={styles.fieldLabel}>(Optional) Add detail below</Text>
        <TextInput
          style={styles.textInput}
          value={detailText}
          onChangeText={onChangeDetail}
          placeholder=""
          multiline
          maxLength={280}
          editable={!submitting}
        />

        {category.hasPhoto && (
          <>
            <Text style={styles.fieldLabel}>(Optional) Add a photo</Text>
            <Pressable
              style={styles.photoStub}
              onPress={handlePhotoStubTap}
              accessibilityRole="button"
              accessibilityLabel="Add a photo (coming soon)"
            >
              <Ionicons name="camera-outline" size={32} color={colors.labelTertiary} />
            </Pressable>
          </>
        )}
      </View>

      <Pressable
        style={[
          styles.submitBtn,
          (!locationKnown || submitting) && styles.submitBtnDisabled,
        ]}
        onPress={onSubmit}
        disabled={!locationKnown || submitting}
        accessibilityRole="button"
        accessibilityLabel={category.cta}
      >
        <Text style={styles.submitBtnText}>
          {submitting ? 'Submitting…' : category.cta}
        </Text>
      </Pressable>
    </>
  );
}

// --- Thank-You view ------------------------------------------------------

function ThankYouView({
  onUndo,
  onClose,
}: {
  onUndo: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <View style={styles.headerRow}>
        <Pressable
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel="Undo submission and go back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.labelTertiary} />
        </Pressable>
      </View>

      <View style={styles.thankYouTitleBlock}>
        <Text style={styles.thankYouTitle}>Thanks for submitting.</Text>
        <Text style={styles.thankYouSubtitle}>
          Reports like yours keep Fresh Greens, well...fresh.
        </Text>
      </View>

      <Pressable
        style={styles.thankYouCloseBtn}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Text style={styles.thankYouCloseBtnText}>Close</Text>
      </Pressable>
    </>
  );
}

// --- Styles --------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  popup: {
    width: 351,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 32,
    gap: 24,
    // Approximates Figma M3 Elevation Light/2.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBlock: {
    gap: 8,
  },
  identityIcon: {
    // 56x56 dedicated space, internal padding centers the 32pt icon.
    // Same shape as the safety modal's iconBox.
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -16, // pulls the icon to align with the popup's left edge
  },
  titleEmphasized: {
    ...typography.title1Emphasized,
    color: colors.black,
  },
  titleRegular: {
    ...typography.title1Regular,
    color: colors.black,
  },
  subtitle: {
    ...typography.bodyEmphasized,
    color: colors.labelTertiary,
  },
  anonymousNote: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
    marginTop: 4,
  },

  // --- Picker grid ---
  grid: {
    gap: 24,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 24,
  },
  tile: {
    flex: 1,
    height: 96 + 8 + 20, // tile box + gap + label line
  },
  tileIconBox: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    backgroundColor: colors.systemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
    // Approximates Figma M3 Elevation Light/1.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  tileLabel: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
    textAlign: 'center',
    marginTop: 8,
  },

  // --- Detail form ---
  formBlock: {
    gap: 12,
  },
  fieldLabel: {
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
  },
  textInput: {
    minHeight: 61,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...typography.subheadlineRegular,
    color: colors.black,
    textAlignVertical: 'top',
  },
  photoStub: {
    height: 120,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    height: 44,
    borderRadius: 100,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
    // Approximates Figma M3 Elevation Light/1.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },

  // --- Thank-You title block ---
  // Centered alignment + smaller subtitle metrics distinguish this from
  // the picker/detail blocks. Per Figma 992:3982: items-center on the
  // wrapper, Title1 Regular 28pt centered, Subheadline Regular 15pt
  // centered #3D3D3D for the body line. The picker/detail screens
  // intentionally keep left-aligned, larger-subtitle style — different
  // emotional register.
  thankYouTitleBlock: {
    gap: 16,
    alignItems: 'center',
  },
  thankYouTitle: {
    ...typography.title1Regular,
    color: colors.black,
    textAlign: 'center',
  },
  thankYouSubtitle: {
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
    textAlign: 'center',
  },

  // --- Thank-You close button ---
  thankYouCloseBtn: {
    height: 44,
    borderRadius: 100,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  thankYouCloseBtnText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
});
