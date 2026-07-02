import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { WarningDiamond } from 'phosphor-react-native/src/icons/WarningDiamond';
import { X } from 'phosphor-react-native/src/icons/X';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// Same SVGs the LandmarkMarker renders inside its pin — using them
// here keeps the picker tile and the resulting marker visually
// identical for every category.
import GlyphBlackOwned from '../assets/illustrations/mapmarker-glyph-black-owned.svg';
import GlyphFeltUnsafe from '../assets/illustrations/mapmarker-glyph-felt-unsafe.svg';
import GlyphFeltWelcome from '../assets/illustrations/mapmarker-glyph-felt-welcome.svg';
import GlyphHazard from '../assets/illustrations/mapmarker-glyph-hazard.svg';
import GlyphIncident from '../assets/illustrations/mapmarker-glyph-incident.svg';
import GlyphLighting from '../assets/illustrations/mapmarker-glyph-lighting.svg';
import SidebtnReport from '../assets/illustrations/sidebtn-report.svg';

import { Button } from '../components/Button';
import { MarkerGlyph } from '../components/MarkerGlyph';
import { SafetyErrorMessage } from '../components/SafetyErrorMessage';
import { useMutation } from '../hooks/useMutation';
import { useUser } from '../hooks/useUser';
import {
  addCommunityReport,
  CATEGORIES,
  type CommunityReport,
  type ReportCategory,
  ReportSubmitRejection,
  removeCommunityReport,
} from '../lib/api/community-reports';
import { getReportSubmitErrorCopy } from '../lib/report-submit-errors';
import type { Coordinate } from '../lib/api/zones';
import { fetchNearestPlace } from '../lib/proxy';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
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
 * Location: accepts optional `latitude`/`longitude` search params. When
 * passed (from /home's tap-then-drag placement mode), uses those coords.
 * When absent (from /en-route's Report button), falls back to current GPS.
 *
 * Figma nodes: 984:5010 (picker), 987:4291 (Felt unsafe), 992:4752
 * (Lighting), 992:4933 (Black-owned), 992:3933 (Thank You).
 */

type Mode = 'picker' | 'detail' | 'thank-you';

export default function Report() {
  const router = useRouter();
  const { user } = useUser();
  const params = useLocalSearchParams<{ latitude?: string; longitude?: string }>();
  const [mode, setMode] = useState<Mode>('picker');
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [detailText, setDetailText] = useState('');
  const submitMutation = useMutation(addCommunityReport);
  const submitting = submitMutation.status === 'pending';
  const submitError = submitMutation.status === 'error';
  const [submittedReport, setSubmittedReport] = useState<CommunityReport | null>(
    null,
  );
  const [location, setLocation] = useState<Coordinate | null>(() => {
    const lat = params.latitude ? parseFloat(params.latitude) : NaN;
    const lng = params.longitude ? parseFloat(params.longitude) : NaN;
    if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
    return null;
  });

  // Whether GPS fallback has conclusively failed (permission denied,
  // error, or never resolved) — drives the CTA's terminal "Location
  // needed" state instead of a forever "Finding your location…".
  const [locationUnavailable, setLocationUnavailable] = useState(false);

  // Fall back to current GPS when no location was passed via params.
  useEffect(() => {
    if (location) return;
    let cancelled = false;
    // Guarantee a terminal state — getCurrentPositionAsync has no timeout,
    // so a fix that never arrives would otherwise hang the CTA on
    // "Finding your location…" (same guard as /roadside).
    const settleTimer = setTimeout(() => {
      if (!cancelled) setLocationUnavailable(true);
    }, 8000);
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setLocationUnavailable(true);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      } catch {
        if (!cancelled) setLocationUnavailable(true);
      } finally {
        clearTimeout(settleTimer);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(settleTimer);
    };
  }, [location]);

  function handleClose() {
    router.back();
  }

  /**
   * Detail-mode close handler — confirms discard when the form has
   * partial content. Empty form (no note, no sub-tag, no photo) closes
   * silently, matching the picker-stage X behavior. Triggered by the
   * detail header's X tap only; the back caret (handleBackFromDetail)
   * is a deliberate retreat, not a discard.
   */
  function handleCloseFromDetail() {
    const hasContent =
      detailText.trim().length > 0 ||
      selectedSubTag !== undefined ||
      selectedPlaceType !== undefined ||
      photoUri !== undefined;
    if (!hasContent) {
      handleClose();
      return;
    }
    Alert.alert(
      'Discard report?',
      "Your note and any selections will be lost.",
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: handleClose,
        },
      ],
    );
  }

  // Place-type sub-tag for categories that define a `subTags` whitelist.
  // Reset on category change so a sub-tag from a previous selection
  // can't bleed across a back-and-forth navigation.
  const [selectedSubTag, setSelectedSubTag] = useState<string | undefined>(
    undefined,
  );

  // Place-type selection for categories that have a two-section chip split
  // (currently: felt-welcome). Tracks the first group's selection separately
  // from selectedSubTag so each section has independent toggle state.
  const [selectedPlaceType, setSelectedPlaceType] = useState<string | undefined>(
    undefined,
  );

  // Optional photo URI from expo-image-picker (camera capture only —
  // library picks would let a user attach a photo from anywhere,
  // which breaks the implicit "this is where I am" contract of a
  // location-tagged community report). Local-device file URI; the
  // RecommendationCard display path renders it via <Image source={{ uri }} />.
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  function handlePickCategory(c: ReportCategory) {
    setCategory(c);
    setDetailText('');
    setSelectedSubTag(undefined);
    setSelectedPlaceType(undefined);
    setPhotoUri(undefined);
    setMode('detail');
  }

  function handleBackFromDetail() {
    setCategory(null);
    setSelectedSubTag(undefined);
    setSelectedPlaceType(undefined);
    setPhotoUri(undefined);
    setMode('picker');
  }

  /**
   * Camera capture for the optional photo attachment. Requests
   * camera permission inline (no upfront onboarding ask — the
   * affordance is buried inside a category-specific report flow,
   * not on the common path, so eager-prompting at /permissions
   * would burn permission goodwill for a rarely-used feature).
   *
   * After capture, copies the photo from expo-image-picker's
   * cache directory (which iOS may evict under storage pressure)
   * into documentDirectory for durability — without this, a
   * report's photo would show broken-image space after iOS
   * cleared the cache.
   *
   * Permission denied → inline Alert with copy that points to
   * Settings; the rest of the report still submits without a photo.
   * Cancel → no-op.
   */
  async function handlePickPhoto() {
    Haptics.selectionAsync().catch(() => {});
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow Camera in Settings to attach a photo. Your report can still submit without one.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      // Mild quality compression — a community-report thumbnail
      // doesn't need raw camera resolution. 0.7 trades ~40% file
      // size for a perceptual delta most users won't notice.
      quality: 0.7,
      // No editor — for a quick contribution flow, the friction of
      // a crop/rotate step has outsized cost on completion rates.
      allowsEditing: false,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    // Copy out of the volatile cache dir into documentDirectory so
    // the URI survives iOS cache eviction. Best-effort: if the copy
    // fails, fall back to the cache URI (works until iOS clears it).
    try {
      const dir = `${FileSystem.documentDirectory}reports/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
        () => {},
      );
      // Filename derives from the asset URI's extension to preserve
      // mime; timestamp + random suffix avoids same-second collisions.
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const durableUri = `${dir}${filename}`;
      await FileSystem.copyAsync({ from: asset.uri, to: durableUri });
      setPhotoUri(durableUri);
    } catch (err) {
      console.warn('[report] photo durable-copy failed, using cache URI:', err);
      setPhotoUri(asset.uri);
    }
  }

  function handleClearPhoto() {
    Haptics.selectionAsync().catch(() => {});
    setPhotoUri(undefined);
  }

  async function handleSubmit() {
    if (!category || !location || submitting) return;

    // Best-effort business-name lookup. The contribution succeeds
    // either way — if Google has nothing at this coord, we still
    // persist the report and the marker falls back to subTag-
    // based naming. Fire-and-await but capture failures silently;
    // a network blip shouldn't block a real submission.
    const nearest = await fetchNearestPlace(
      location.latitude,
      location.longitude,
    );

    const result = await submitMutation.run({
      categoryId: category.id,
      location,
      detail: detailText.trim() || undefined,
      subTag: selectedSubTag,
      placeType: selectedPlaceType,
      placeName: nearest?.name,
      googlePlaceId: nearest?.googlePlaceId,
      submittedBy: category.anonymous ? undefined : user?.id,
      photoUri,
    });

    if (result.ok) {
      // Success haptic on submission — the contribution lands as a
      // tactile confirmation, matching the visual transition into the
      // Thank-You frame. Reporting is the active community-building
      // moment of the app; the cue gives it weight.
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      setSubmittedReport(result.data);
      setMode('thank-you');
    }
    // failure: the inline error line above the submit button reads
    // submitMutation.error and surfaces "Couldn't send your report."
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

      {/*
        KeyboardAvoidingView lifts the centered popup above the iOS
        keyboard when the detail-view TextInput focuses. Without it,
        the keyboard covers the Submit CTA and the user can't see
        what they're committing to. `behavior="padding"` shifts the
        popup with the keyboard's animation curve; Android handles
        the layout natively via android:windowSoftInputMode and
        doesn't need the wrapper to do anything (`undefined`).
      */}
      <KeyboardAvoidingView
        style={styles.popupCentering}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
      {/*
        accessibilityViewIsModal traps VoiceOver focus inside the
        popup while it's presented — without it, the screen reader
        can navigate to /home or /en-route content under the scrim.
        Stack.Screen presentation='transparentModal' handles the
        visual layer but doesn't enforce a11y containment; this prop
        does. Per Apple HIG modals + WCAG 2.4.3 (Focus Order, Level A).
      */}
      <View style={styles.popup} accessibilityViewIsModal>
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
            selectedSubTag={selectedSubTag}
            onChangeSubTag={setSelectedSubTag}
            selectedPlaceType={selectedPlaceType}
            onChangePlaceType={setSelectedPlaceType}
            onBack={handleBackFromDetail}
            onClose={handleCloseFromDetail}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitError={submitError}
            submitErrorPayload={submitMutation.error}
            locationStatus={
              location !== null
                ? 'known'
                : locationUnavailable
                  ? 'unavailable'
                  : 'resolving'
            }
            photoUri={photoUri}
            onPickPhoto={handlePickPhoto}
            onClearPhoto={handleClearPhoto}
          />
        )}
        {mode === 'thank-you' && (
          <ThankYouView
            placeName={submittedReport?.placeName}
            onUndo={handleUndo}
            onClose={handleClose}
          />
        )}
      </View>
      </KeyboardAvoidingView>

      {/*
        Done toolbar above the keyboard — iOS-only InputAccessoryView,
        wired to the multiline detail TextInput by `inputAccessoryViewID`.
        iOS's return key in a multiline input legitimately inserts a
        newline, so users need a separate dismiss path. Tap Done →
        Keyboard.dismiss(). The TextInput stays multiline for free-form
        report detail.
      */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={DETAIL_INPUT_ACCESSORY_ID}>
          <View style={styles.inputAccessory}>
            <Pressable
              onPress={Keyboard.dismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
              // Painted 44pt tap target (HIG floor) instead of hitSlop —
              // .cursorrules forbids hitSlop as the compliance mechanism;
              // it's only for forgiveness on an already-compliant visual.
              style={styles.inputAccessoryDoneBtn}
            >
              <Text style={styles.inputAccessoryDone}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}

// Module-level ID — same string referenced by the TextInput's
// `inputAccessoryViewID` and the InputAccessoryView's `nativeID`.
const DETAIL_INPUT_ACCESSORY_ID = 'report-detail-accessory';

// Picker grouping per layout pass — exposes the sentiment register that
// the categories' position-in-CATEGORIES already encodes. Copy chosen to
// match the calm-companion voice (plainspoken, not signal-words). The
// slice offsets follow CATEGORIES' canonical avoid → caution → safe order.
const PICKER_GROUPS = [
  { label: 'Something off', start: 0 },     // felt-unsafe, incident
  { label: 'Something useful', start: 2 },  // hazard, lighting
  { label: 'Something good', start: 4 },    // black-owned, felt-welcome
];

// --- Category glyph ------------------------------------------------------

/**
 * Per-category illustrated glyph. Same SVGs the LandmarkMarker
 * renders inside its pin (Figma 1044:2667), used here for the
 * picker tile + the detail header so the picker, the detail view,
 * and the resulting marker on the map all carry the same glyph
 * for a given submission.
 */
function CategoryGlyph({
  categoryId,
  size,
}: {
  categoryId: string;
  size: number;
}) {
  switch (categoryId) {
    case 'black-owned':
      return <GlyphBlackOwned width={size} height={size} />;
    case 'felt-welcome':
      // Outline path uses fill="currentColor"; MarkerGlyph pins black so
      // the grid tile doesn't inherit an unset currentColor (stroke flicker
      // from #262's dual-stroke SVG).
      return <MarkerGlyph Glyph={GlyphFeltWelcome} width={size} height={size} />;
    case 'felt-unsafe':
      return <GlyphFeltUnsafe width={size} height={size} />;
    case 'incident':
      return <GlyphIncident width={size} height={size} />;
    case 'lighting':
      return <GlyphLighting width={size} height={size} />;
    case 'hazard':
      return <GlyphHazard width={size} height={size} />;
    default:
      return null;
  }
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
          // 44pt painted floor per .cursorrules — the 20pt X glyph
          // centers inside an invisible 44×44 hit area; replaces the
          // earlier hitSlop-as-compliance pattern (audit #10).
          style={tapTarget44}
        >
          <X size={20} color={colors.labelSecondary} weight="regular" />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        {/*
          The Report identity glyph is the canonical orange-disc SVG
          shared with the /home and /en-route Report FABs (sidebtn-
          report.svg). Was previously an Ionicons `alert-circle`,
          which is a different visual (filled circle WITH an
          interior exclamation glyph) — the FAB and modal title
          read as different entry points to the same flow. Now
          aligned. Documented exception to the reserved-color
          rule per .cursorrules #4.
        */}
        <View style={styles.identityIcon}>
          <SidebtnReport width={32} height={32} />
        </View>
        <Text style={styles.titleEmphasized}>Report</Text>
        <Text style={styles.subtitle}>
          Flag what&rsquo;s going on near you.
        </Text>
      </View>

      <View style={styles.grid}>
        {PICKER_GROUPS.map((group) => (
          <View key={group.label} style={styles.gridGroup}>
            <View style={styles.gridRow}>
              {CATEGORIES.slice(group.start, group.start + 2).map((c) => (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [styles.tile, pressed && pressedDim]}
                  onPress={() => onPick(c)}
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
                >
                  <View style={styles.tileIconBox}>
                    <CategoryGlyph categoryId={c.id} size={48} />
                  </View>
                  <Text style={styles.tileLabel}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

// --- Severity chip helper ------------------------------------------------

function severityChipStyles(
  category: ReportCategory,
  tag: string,
): {
  base?: object;
  active?: object;
  label?: object;
  level?: 'avoid' | 'caution';
} {
  if (!category.severityMap) return {};
  const zone = category.severityMap[tag];
  if (zone === 'avoid') {
    return {
      base: styles.chipAvoid,
      active: styles.chipAvoidActive,
      label: styles.chipAvoidLabel,
      level: 'avoid',
    };
  }
  if (zone === 'caution') {
    return {
      base: styles.chipCaution,
      active: styles.chipCautionActive,
      label: styles.chipCautionLabel,
      level: 'caution',
    };
  }
  return {};
}

// --- Detail view ---------------------------------------------------------

function DetailView({
  category,
  detailText,
  onChangeDetail,
  selectedSubTag,
  onChangeSubTag,
  selectedPlaceType,
  onChangePlaceType,
  onBack,
  onClose,
  onSubmit,
  submitting,
  submitError,
  submitErrorPayload,
  locationStatus,
  photoUri,
  onPickPhoto,
  onClearPhoto,
}: {
  category: ReportCategory;
  detailText: string;
  onChangeDetail: (text: string) => void;
  selectedSubTag: string | undefined;
  onChangeSubTag: (subTag: string | undefined) => void;
  selectedPlaceType: string | undefined;
  onChangePlaceType: (placeType: string | undefined) => void;
  onBack: () => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: boolean;
  submitErrorPayload: Error | null;
  locationStatus: 'known' | 'resolving' | 'unavailable';
  photoUri: string | undefined;
  onPickPhoto: () => void;
  onClearPhoto: () => void;
}) {
  return (
    <>
      <View style={styles.headerRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          // 44pt painted floor — same pattern as the close X below
          // (audit #10 fix; was hitSlop={12} on a 24pt caret).
          style={tapTarget44}
        >
          <CaretLeft size={24} color={colors.labelSecondary} weight="regular" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={tapTarget44}
        >
          <X size={20} color={colors.labelSecondary} weight="regular" />
        </Pressable>
      </View>

      {/*
        Scrollable middle (title + form). Header (back/X) above and
        Submit below stay pinned. Without the cap + scroll, the felt-
        welcome popup (3 chip groups, ~10 chips, optional TextInput)
        outgrows the screen-minus-keyboard space and Submit lands
        under the keyboard. keyboardShouldPersistTaps='handled' keeps
        chip-tap selection working while the input is focused.
      */}
      <ScrollView
        style={styles.detailScrollBody}
        contentContainerStyle={styles.detailScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.detailTitleRow}>
        <CategoryGlyph categoryId={category.id} size={40} />
        <Text style={styles.detailTitleLabel}>{category.label}</Text>
      </View>
      {category.anonymous && (
        <Text style={styles.anonymousNote}>
          Note: All reports are anonymous
        </Text>
      )}

      <View style={styles.formBlock}>
        {/*
          SubTag chips — only render for categories that define a
          `subTags` whitelist (the place categories: black-owned,
          felt-welcome). When the category declares `subTagGroups`,
          each group renders as its own labeled section so users see
          the semantic distinction (e.g. felt-welcome splits
          place-type chips from identity chips). Otherwise the chips
          render as a single flat row with the default
          "(Optional) What kind of place?" header. Tap toggles the
          selection: tapping the active chip again clears it.
        */}
        {category.subTags && category.subTags.length > 0 && (() => {
          // Normalize to subTagGroups shape so the render loop is
          // single-path. If the category didn't declare groups, wrap
          // its flat subTags in a single default-labeled group.
          const groups = category.subTagGroups ?? [
            { label: '(Optional) What kind of place?', tags: category.subTags },
          ];
          return (
            <>
              {groups.map((group, groupIdx) => {
                const isSplitSelect = category.id === 'felt-welcome' && groups.length > 1;
                const usePlaceType = isSplitSelect && groupIdx === 0;
                const selectedValue = usePlaceType ? selectedPlaceType : selectedSubTag;
                const onChangeValue = usePlaceType ? onChangePlaceType : onChangeSubTag;
                return (
                  <View
                    key={group.label ?? `group-${groupIdx}`}
                    style={styles.subTagGroup}
                  >
                    {group.label && (
                      <Text
                        style={styles.subTagGroupLabel}
                        accessibilityRole="header"
                      >
                        {group.label}
                      </Text>
                    )}
                    <View style={styles.chipsWrap}>
                      {group.tags.map((tag) => {
                        const active = selectedValue === tag;
                        const sev = severityChipStyles(category, tag);
                        return (
                          <Pressable
                            key={tag}
                            onPress={() =>
                              onChangeValue(active ? undefined : tag)
                            }
                            disabled={submitting}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`${tag}${
                              sev.level === 'avoid'
                                ? ', avoid-level'
                                : sev.level === 'caution'
                                  ? ', caution-level'
                                  : ''
                            }${active ? ' (selected)' : ''}`}
                            style={({ pressed }) => [
                              styles.chip,
                              sev.base,
                              active && (sev.active ?? styles.chipActive),
                              pressed && !submitting && pressedDim,
                            ]}
                          >
                            {sev.level ? (
                              <WarningDiamond
                                // Non-color severity cue (WCAG 1.4.1): the
                                // chip's red/orange border was the only
                                // signal that this place-type is flagged;
                                // a colorblind reader saw "Highway underpass"
                                // with an indistinguishable border. The
                                // diamond is the same hazard glyph the
                                // route-preview chips use (home.tsx), so
                                // the icon vocabulary stays consistent.
                                // Color inherits from `sev.label` via fill,
                                // not added as new color information.
                                size={14}
                                color={
                                  active
                                    ? colors.white
                                    : sev.level === 'avoid'
                                      ? colors.severityCritical
                                      : colors.severityWarning
                                }
                                weight="fill"
                              />
                            ) : null}
                            <Text
                              style={[
                                styles.chipLabel,
                                sev.label,
                                active && styles.chipLabelActive,
                              ]}
                            >
                              {tag}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </>
          );
        })()}

        {category.id !== 'lighting' && (
          <>
            <Text style={styles.fieldLabel}>
              {category.id === 'incident' ? '(Optional) What happened?'
                : category.id === 'felt-unsafe' ? '(Optional) Want to say more?'
                : category.id === 'hazard' ? '(Optional) Details'
                : category.id === 'felt-welcome' ? '(Optional) Share your experience'
                : category.id === 'black-owned' ? '(Optional) Know the name?'
                : '(Optional) Your note'}
            </Text>
            <TextInput
              style={styles.textInput}
              value={detailText}
              onChangeText={onChangeDetail}
              placeholder=""
              multiline
              maxLength={280}
              editable={!submitting}
              accessibilityLabel="Report details"
              accessibilityState={{ disabled: submitting }}
              inputAccessoryViewID={
                Platform.OS === 'ios' ? DETAIL_INPUT_ACCESSORY_ID : undefined
              }
            />
          </>
        )}

        {category.hasPhoto && (
          <>
            <Text style={styles.fieldLabel}>(Optional) Add a photo</Text>
            {photoUri ? (
              // Preview state — tap the image to retake (replaces); the
              // explicit "Remove photo" control below clears it. The remove
              // action lives in its own ≥44pt labeled row, not a corner
              // badge, so it clears the HIG tap-target floor on the visual
              // without leaning on hitSlop or fighting the retake-on-image
              // tap (the prior 24pt + hitSlop=8 badge was only 40pt).
              <View style={styles.photoPreviewBlock}>
                <View style={styles.photoPreviewWrap}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.photoPreview,
                      pressed && pressedDim,
                    ]}
                    onPress={onPickPhoto}
                    accessibilityRole="button"
                    accessibilityLabel="Photo attached — tap to retake"
                  >
                    <Image
                      source={{ uri: photoUri }}
                      style={styles.photoPreviewImage}
                      accessibilityIgnoresInvertColors
                    />
                  </Pressable>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.photoRemoveRow,
                    pressed && pressedDim,
                  ]}
                  onPress={onClearPhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                >
                  <X size={16} color={colors.labelSecondary} weight="regular" />
                  <Text style={styles.photoRemoveText}>Remove photo</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.photoStub, pressed && pressedDim]}
                onPress={onPickPhoto}
                accessibilityRole="button"
                accessibilityLabel="Add a photo"
              >
                <Camera size={32} color={colors.labelSecondary} weight="regular" />
              </Pressable>
            )}
          </>
        )}
      </View>
      </ScrollView>

      {/*
        Submit CTA — v2 `Button` primary/fill matches the previous
        bespoke styles exactly (44pt pill, freshgreen, white text, M3
        Elevation/1). `loading` swaps the label for an ActivityIndicator
        while the submission is in flight; `disabled` covers the
        no-location case.
      */}
      {submitError && (
        submitErrorPayload instanceof ReportSubmitRejection ? (
          <View style={errorStyles.root}>
            <Text style={errorStyles.text}>
              {getReportSubmitErrorCopy(submitErrorPayload.code).body}
            </Text>
          </View>
        ) : (
          <SafetyErrorMessage
            domain="report"
            disposition="transient"
            error={submitErrorPayload}
          />
        )
      )}
      <Button
        // Make the wait legible instead of a bare disabled button: while
        // GPS resolves the CTA reads "Finding your location…", and if it
        // can't be resolved at all it reaches a terminal "Location needed"
        // rather than hanging.
        text={
          submitting
            ? 'Submitting…'
            : locationStatus === 'known'
              ? category.cta
              : locationStatus === 'unavailable'
                ? 'Location needed to post this report'
                : 'Finding your location…'
        }
        onPress={onSubmit}
        disabled={locationStatus !== 'known' || submitting}
        loading={submitting}
        accessibilityLabel={
          locationStatus === 'known'
            ? category.cta
            : locationStatus === 'unavailable'
              ? 'Location needed to post this report'
              : 'Finding your location'
        }
        style={styles.ctaStretch}
      />
    </>
  );
}

// --- Thank-You view ------------------------------------------------------

function ThankYouView({
  onUndo,
  onClose,
}: {
  placeName?: string;
  onUndo: () => void;
  onClose: () => void;
}) {
  // v2 Figma (1114:7584) uses the same generic subtitle as the detail
  // view — single shared message across the report flow. The earlier
  // implementation surfaced the resolved place name ("Your note about
  // Wintzell's…") for warmth, but v2 chose uniformity. The placeName
  // prop is preserved on the type so a future revision can re-surface
  // it without re-plumbing.
  const subtitle = 'Reports like yours keep Fresh Greens fresh.';

  return (
    <>
      <View style={styles.headerRow}>
        <Pressable
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel="Undo submission and go back"
          // 44pt painted floor (audit #10) — replaces the
          // hitSlop-as-compliance pattern.
          style={tapTarget44}
        >
          <CaretLeft size={24} color={colors.labelSecondary} weight="regular" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={tapTarget44}
        >
          <X size={20} color={colors.labelSecondary} weight="regular" />
        </Pressable>
      </View>

      <View style={styles.thankYouTitleBlock}>
        <Text style={styles.thankYouTitle}>Thanks for sharing.</Text>
        <Text style={styles.thankYouSubtitle}>{subtitle}</Text>
      </View>

      <Button
        text="Close"
        onPress={onClose}
        accessibilityLabel="Close"
        style={styles.ctaStretch}
      />
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
    backgroundColor: colors.modalScrim,
  },
  // Wrapper that centers the popup vertically — the KeyboardAvoidingView
  // shifts this whole block up when the keyboard opens. Mirrors the
  // root's center alignment so the popup keeps its position pre-focus.
  popupCentering: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    // Stretches with a consistent 20pt edge margin on either side and
    // a maxWidth so it doesn't go wider than the original Figma spec
    // on tablet/landscape contexts. On 390pt → ~350pt (matches Figma's
    // 351). On 430pt Pro Max → 390pt (proportional). On 600pt+ →
    // capped at 400pt so the popup stays "focused dialog" not "page."
    alignSelf: 'stretch',
    marginHorizontal: spacing.md,
    maxWidth: 400,
    // Cap the popup at 90% of available height so KeyboardAvoidingView
    // can lift it cleanly when the detail TextInput focuses, and so
    // the tallest category (felt-welcome — 3 chip groups + ~10 chips +
    // optional input) doesn't outgrow the screen. The interior body
    // (titleBlock + formBlock) is wrapped in a ScrollView; flexShrink
    // lets the popup honor the cap rather than overflowing the parent.
    maxHeight: '90%',
    flexShrink: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    // v2 spec (1112:8900): px-24 py-32 gap-24. Bumped horizontal from
    // 16 → 24 to honor the v2 breathing room while keeping the vertical
    // and gap unchanged.
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    // Theme tier — content above map but below transparent modal scrim.
    ...shadows.e2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // (headerIconBtn replaced by the shared `tapTarget44` token from
  //  theme/interaction.ts in audit #10 review — applied directly at each
  //  back/close Pressable.)
  // Scrollable middle of the detail view (title + form). flexShrink:1
  // lets it cede space inside the height-capped popup so headerRow
  // and the Submit Button stay pinned, while the form content scrolls
  // when it would otherwise overflow the cap.
  detailScrollBody: {
    flexShrink: 1,
  },
  // Re-supplies the 24pt gap that the popup's column-gap previously
  // gave between titleBlock and formBlock when they were direct
  // children — moving them inside ScrollView's contentContainer means
  // the gap has to live here instead.
  detailScrollContent: {
    gap: spacing.lg,
  },
  titleBlock: {
    // Left-aligned title stack (icon + title + subtitle + optional
    // anonymous note). Shared placement register with /safety header.
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  identityIcon: {
    // 56x56 dedicated space for the 32pt report identity glyph.
    // Same shape as the safety modal's iconBox — top-leading anchor.
    width: 56,
    height: 56,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  titleEmphasized: {
    ...dynamicType(typography.title1Emphasized),
    color: colors.black,
    alignSelf: 'stretch',
  },
  subtitle: {
    // bodyRegular per v2 Figma (1112:8319 / 1112:8900). Softer than the
    // earlier bodyEmphasized — the subtitle is the supporting line, not
    // the prompt itself. Per .cursorrules "In-modal user prompts use
    // Title1 Regular," the *supporting* body line should match in tone.
    ...dynamicType(typography.bodyRegular),
    color: colors.labelTertiary,
    alignSelf: 'stretch',
  },
  anonymousNote: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
    marginTop: spacing.xs,
    alignSelf: 'stretch',
  },
  // Detail title row — glyph + category name in a single tight row.
  // Replaces the v1 vertical block (48pt glyph + label + generic subtitle).
  // The generic subtitle "Reports like yours keep Fresh Greens fresh" was
  // pure filler — identical on every category — so the C3 collapse cut it.
  // Glyph shrunk from 48pt to 32pt to fit the row register cleanly.
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailTitleLabel: {
    ...dynamicType(typography.title1Emphasized),
    color: colors.black,
    flex: 1,
  },

  // --- Picker grid ---
  grid: {
    gap: spacing.lg,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  tile: {
    flex: 1,
    height: 96 + 8 + 20, // tile box + gap + label line
  },
  tileIconBox: {
    width: '100%',
    height: 96,
    borderRadius: radii.sm,
    backgroundColor: colors.surfacePage,
    alignItems: 'center',
    justifyContent: 'center',
    // Theme tier — same depth as the safety modal tiles and the
    // home browse card.
    ...shadows.e1,
  },
  tileLabel: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.black,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  // Picker group wrapper — bundles a sentiment header with its 2-tile
  // row. The 3 groups are separated by the parent `grid` style's existing
  // gap; each group's own `gap` ties header tightly to its tiles.
  gridGroup: {
    gap: spacing.sm,
  },
  // --- Detail form ---
  // v2 Figma (1112:8900): 16pt gap between form-block children (label →
  // input → label → photo). Bumped from 12 to match. The borderRadius
  // on the detail input + photo dropzone also moves to 16 — v2 uses
  // rounded-16, more in line with the popup's 20pt corner radius than
  // the earlier 8pt boxy feel.
  formBlock: {
    gap: spacing.md,
  },
  fieldLabel: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelTertiary,
  },
  textInput: {
    minHeight: 61,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
    textAlignVertical: 'top',
  },
  photoStub: {
    height: 120,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Photo preview after capture — image in a fixed-height rounded
  // frame, with the explicit "Remove photo" control beneath it.
  photoPreviewBlock: {
    gap: spacing.xs,
  },
  photoPreviewWrap: {
    height: 120,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  // Explicit remove control — its own ≥44pt painted row (HIG floor on
  // the visual), so it never relies on hitSlop or competes with the
  // retake-on-image tap above it. labelSecondary, not red: removing an
  // un-submitted attachment is low-stakes and recoverable.
  photoRemoveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: 44,
    paddingRight: spacing.sm,
  },
  photoRemoveText: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },

  // --- Place-type chips (sub-tag picker) ---
  // Each subTag group gets its own labeled block. 12pt internal
  // gap between the label and the chip row. Inter-group spacing
  // is handled by the parent form's gap (avoids double-stacking
  // margin + gap, which made the last group's trailing space
  // collide with the photo dropzone below).
  subTagGroup: {
    gap: spacing.sm,
  },
  subTagGroupLabel: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.wiltedgreen,
    alignSelf: 'stretch',
  },
  // Wraps so the 6-item chip set lays out across two rows on a
  // narrow 351pt popup. 8pt gap matches the field-label-to-control
  // rhythm elsewhere in the form block.
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Pill shape per the design system's pill register. minHeight: 44
  // paints the HIG tap-target floor; visual label centers inside the
  // larger painted area. Outlined freshgreen (unselected) / filled
  // wiltedgreen (selected) — the content treatment is unchanged.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.freshgreen,
    backgroundColor: colors.surfaceCard,
  },
  chipActive: {
    // wiltedgreen so the white active-state label clears WCAG AA.
    backgroundColor: colors.wiltedgreen,
    borderColor: colors.wiltedgreen,
  },
  chipLabel: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.freshgreen,
  },
  chipLabelActive: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.white,
  },
  chipAvoid: {
    borderColor: colors.severityCritical,
    backgroundColor: colors.chipAvoidFill,
  },
  chipAvoidActive: {
    backgroundColor: colors.severityCritical,
    borderColor: colors.severityCritical,
  },
  chipAvoidLabel: {
    color: colors.severityCritical,
  },
  chipCaution: {
    borderColor: colors.severityWarning,
    backgroundColor: colors.chipCautionFill,
  },
  chipCautionActive: {
    backgroundColor: colors.severityWarning,
    borderColor: colors.severityWarning,
  },
  chipCautionLabel: {
    color: colors.severityWarning,
  },
  // Stretches the v2 `Button` across the popup's content width. Without
  // this, the unified Button picks up its natural width from its label
  // — fine on screens that center it, wrong here where the modal expects
  // a full-width primary CTA at the bottom of the form.
  ctaStretch: {
    alignSelf: 'stretch',
  },

  // --- Thank-You title block ---
  // v2 Figma (1114:7584): items-start, Title1 Emphasized for the
  // headline + Body Regular for the supporting line, both left-aligned
  // and matching the picker/detail typography. The earlier center-
  // aligned Title1 Regular version was a different visual register;
  // v2 consolidates the three phases to one consistent layout family.
  thankYouTitleBlock: {
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  thankYouTitle: {
    ...dynamicType(typography.brandDisplay),
    color: colors.black,
  },
  thankYouSubtitle: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelTertiary,
  },

  // iOS InputAccessoryView toolbar — small bar that sits directly
  // above the keyboard. Right-aligned "Done" matches iOS Mail / Notes
  // and is the platform-conventional dismiss target.
  inputAccessory: {
    backgroundColor: colors.surfacePage,
    paddingHorizontal: spacing.md,
    // No vertical padding — the Done button's minHeight: 44 sizes the bar
    // to ~44pt total, matching the native iOS keyboard toolbar. Earlier
    // had paddingVertical: 8 which stacked with the new 44pt button to
    // ~60pt — visibly taller than native, audit #10 review caught it.
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderWarm,
  },
  inputAccessoryDone: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.freshgreen,
    paddingVertical: spacing.xs,
  },
  // 44pt painted tap floor for the Done button — the bodyEmphasized
  // Text alone is ~22pt and needs a compliant hit area. minWidth gives
  // it horizontal slack matching the bar's right edge; centering the
  // text inside keeps the visual the same.
  inputAccessoryDoneBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const errorStyles = StyleSheet.create({
  root: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  text: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.red,
    textAlign: 'center',
  },
});
