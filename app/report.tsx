import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
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
import { useUser } from '../hooks/useUser';
import {
  addCommunityReport,
  CATEGORIES,
  type CommunityReport,
  type ReportCategory,
  removeCommunityReport,
} from '../lib/api/community-reports';
import type { Coordinate } from '../lib/api/zones';
import { fetchNearestPlace } from '../lib/proxy';
import { colors } from '../theme/colors';
import { pressedDim, tapTarget44 } from '../theme/interaction';
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
  const [submitting, setSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<CommunityReport | null>(
    null,
  );
  const [location, setLocation] = useState<Coordinate | null>(() => {
    const lat = params.latitude ? parseFloat(params.latitude) : NaN;
    const lng = params.longitude ? parseFloat(params.longitude) : NaN;
    if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
    return null;
  });

  // Fall back to current GPS when no location was passed via params.
  useEffect(() => {
    if (location) return;
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
  }, [location]);

  function handleClose() {
    router.back();
  }

  // Place-type sub-tag for categories that define a `subTags` whitelist.
  // Reset on category change so a sub-tag from a previous selection
  // can't bleed across a back-and-forth navigation.
  const [selectedSubTag, setSelectedSubTag] = useState<string | undefined>(
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
    setPhotoUri(undefined);
    setMode('detail');
  }

  function handleBackFromDetail() {
    setCategory(null);
    setSelectedSubTag(undefined);
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
    setSubmitting(true);
    try {
      // Best-effort business-name lookup. The contribution succeeds
      // either way — if Google has nothing at this coord, we still
      // persist the report and the marker falls back to subTag-
      // based naming. Fire-and-await but capture failures silently;
      // a network blip shouldn't block a real submission.
      const nearest = await fetchNearestPlace(
        location.latitude,
        location.longitude,
      );

      const report = await addCommunityReport({
        categoryId: category.id,
        location,
        detail: detailText.trim() || undefined,
        subTag: selectedSubTag,
        placeName: nearest?.name,
        googlePlaceId: nearest?.googlePlaceId,
        submittedBy: category.anonymous ? undefined : user?.id,
        photoUri,
      });
      // Success haptic on submission — the contribution lands as a
      // tactile confirmation, matching the visual transition into the
      // Thank-You frame. Reporting is the active community-building
      // moment of the app; the cue gives it weight.
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
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
            onBack={handleBackFromDetail}
            onClose={handleClose}
            onSubmit={handleSubmit}
            submitting={submitting}
            locationKnown={location !== null}
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
      return <GlyphFeltWelcome width={size} height={size} />;
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
          <X size={20} color={colors.labelTertiary} weight="bold" />
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
        {/* Render in 3 rows of 2. CATEGORIES is already in the right
            order (avoid → caution → safe) — slice into rows. */}
        {[0, 2, 4].map((rowStart) => (
          <View style={styles.gridRow} key={rowStart}>
            {CATEGORIES.slice(rowStart, rowStart + 2).map((c) => (
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
  selectedSubTag,
  onChangeSubTag,
  onBack,
  onClose,
  onSubmit,
  submitting,
  locationKnown,
  photoUri,
  onPickPhoto,
  onClearPhoto,
}: {
  category: ReportCategory;
  detailText: string;
  onChangeDetail: (text: string) => void;
  selectedSubTag: string | undefined;
  onChangeSubTag: (subTag: string | undefined) => void;
  onBack: () => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  locationKnown: boolean;
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
          <CaretLeft size={24} color={colors.labelTertiary} weight="regular" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={tapTarget44}
        >
          <X size={20} color={colors.labelTertiary} weight="bold" />
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
      <View style={styles.titleBlock}>
        <View style={styles.detailIdentityIcon}>
          <CategoryGlyph categoryId={category.id} size={48} />
        </View>
        {/*
          v2 Figma (1112:8900) specs Title1 Emphasized (28pt bold) for
          the category title — the category names ("Incident", "Hazard",
          etc.) read as labels rather than questions, so the emphasized
          weight fits. The picker's "Report" title is also titleEmphasized;
          consistent across both report-modal phases.
        */}
        <Text style={styles.titleEmphasized}>{category.label}</Text>
        {/*
          v2 Figma (1114:8811 — canonical Report Modal component): single
          shared subtitle across all category variants. Per-category
          subtitles in CATEGORIES are no longer consumed by the detail
          view — kept on the type in case a future revision wants to
          surface them again. Only icon + title vary per category.
        */}
        <Text style={styles.subtitle}>
          Reports like yours keep Fresh Greens fresh.
        </Text>
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
          accessibilityLabel="Report details"
          accessibilityState={{ disabled: submitting }}
          inputAccessoryViewID={
            Platform.OS === 'ios' ? DETAIL_INPUT_ACCESSORY_ID : undefined
          }
        />

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
              {groups.map((group, groupIdx) => (
                <View
                  key={group.label ?? `group-${groupIdx}`}
                  style={styles.subTagGroup}
                >
                  {group.label && (
                    <Text
                      style={styles.fieldLabel}
                      accessibilityRole="header"
                    >
                      {group.label}
                    </Text>
                  )}
                  <View style={styles.chipsWrap}>
                    {group.tags.map((tag) => {
                      const active = selectedSubTag === tag;
                      return (
                        <Pressable
                          key={tag}
                          onPress={() =>
                            onChangeSubTag(active ? undefined : tag)
                          }
                          disabled={submitting}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`${tag}${active ? ' (selected)' : ''}`}
                          style={({ pressed }) => [
                            styles.chip,
                            active && styles.chipActive,
                            pressed && !submitting && pressedDim,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipLabel,
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
              ))}
            </>
          );
        })()}

        {category.hasPhoto && (
          <>
            <Text style={styles.fieldLabel}>(Optional) Add a photo</Text>
            {photoUri ? (
              // Preview state — tap the image to retake (replaces),
              // tap the X to clear. The retake-on-tap pattern matches
              // iOS Photos / Instagram capture review screens.
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
                <Pressable
                  style={({ pressed }) => [
                    styles.photoClearBtn,
                    pressed && pressedDim,
                  ]}
                  onPress={onClearPhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  // Small "x" badge in the photo corner — .cursorrules
                  // carve-out case: a child target inside an already-
                  // compliant larger container (the 200pt photo-preview
                  // Pressable around it carries the primary retake
                  // action; this corner badge clears the photo).
                  // hitSlop=8 keeps the touch zone (24+8+8=40) inside
                  // the badge's painted area and clear of the photo
                  // Pressable underneath — bumping it to 12 would push
                  // touch into the photo's tap area and steal retakes
                  // (audit #10 review).
                  hitSlop={8}
                >
                  <X size={14} color={colors.white} weight="bold" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.photoStub, pressed && pressedDim]}
                onPress={onPickPhoto}
                accessibilityRole="button"
                accessibilityLabel="Add a photo"
              >
                <Camera size={32} color={colors.labelTertiary} weight="duotone" />
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
      <Button
        text={submitting ? 'Submitting…' : category.cta}
        onPress={onSubmit}
        disabled={!locationKnown}
        loading={submitting}
        accessibilityLabel={category.cta}
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
          <CaretLeft size={24} color={colors.labelTertiary} weight="regular" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={tapTarget44}
        >
          <X size={20} color={colors.labelTertiary} weight="bold" />
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
    marginHorizontal: 20,
    maxWidth: 400,
    // Cap the popup at 90% of available height so KeyboardAvoidingView
    // can lift it cleanly when the detail TextInput focuses, and so
    // the tallest category (felt-welcome — 3 chip groups + ~10 chips +
    // optional input) doesn't outgrow the screen. The interior body
    // (titleBlock + formBlock) is wrapped in a ScrollView; flexShrink
    // lets the popup honor the cap rather than overflowing the parent.
    maxHeight: '90%',
    flexShrink: 1,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    // v2 spec (1112:8900): px-24 py-32 gap-24. Bumped horizontal from
    // 16 → 24 to honor the v2 breathing room while keeping the vertical
    // and gap unchanged.
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 24,
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
    gap: 24,
  },
  titleBlock: {
    // Center-aligned title stack (icon + title + subtitle + optional
    // anonymous note). Text in this modal is short enough that centered
    // reads more deliberate than left-aligned, and the icon was already
    // a centered visual anchor — user-flagged 2026-06-01.
    alignItems: 'center',
    gap: 8,
  },
  identityIcon: {
    // 56x56 dedicated space, internal padding centers the 32pt icon.
    // Same shape as the safety modal's iconBox. Used by the picker's
    // alert-circle identity glyph.
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -16, // pulls the icon to align with the popup's left edge
  },
  detailIdentityIcon: {
    // Detail-view variant — v2 Figma (1112:8900) renders the category
    // glyph at a larger 48pt inside the 56pt container, giving the
    // category its own visual weight separate from the picker's
    // smaller alert-circle. No negative margin since the detail glyph
    // is wider and reads better aligned with the title text edge.
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleEmphasized: {
    ...typography.title1Emphasized,
    color: colors.black,
    textAlign: 'center',
  },
  subtitle: {
    // bodyRegular per v2 Figma (1112:8319 / 1112:8900). Softer than the
    // earlier bodyEmphasized — the subtitle is the supporting line, not
    // the prompt itself. Per .cursorrules "In-modal user prompts use
    // Title1 Regular," the *supporting* body line should match in tone.
    ...typography.bodyRegular,
    color: colors.labelTertiary,
    textAlign: 'center',
  },
  anonymousNote: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
    marginTop: 4,
    textAlign: 'center',
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
    // Theme tier — same depth as the safety modal tiles and the
    // home browse card.
    ...shadows.e1,
  },
  tileLabel: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
    textAlign: 'center',
    marginTop: 8,
  },

  // --- Detail form ---
  // v2 Figma (1112:8900): 16pt gap between form-block children (label →
  // input → label → photo). Bumped from 12 to match. The borderRadius
  // on the detail input + photo dropzone also moves to 16 — v2 uses
  // rounded-16, more in line with the popup's 20pt corner radius than
  // the earlier 8pt boxy feel.
  formBlock: {
    gap: 16,
  },
  fieldLabel: {
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
  },
  textInput: {
    minHeight: 61,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...typography.bodyRegular,
    color: colors.black,
    textAlignVertical: 'top',
  },
  photoStub: {
    height: 120,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Photo preview after capture. Container is `relative` so the
  // clear X can absolute-position over the image's top-right corner.
  photoPreviewWrap: {
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  // 24pt translucent dark pill anchored top-right of the preview;
  // separate Pressable from the retake-on-image-tap so the two
  // gestures don't fight.
  photoClearBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Place-type chips (sub-tag picker) ---
  // Each subTag group gets its own labeled block. 12pt internal
  // gap between the label and the chip row. Inter-group spacing
  // is handled by the parent form's gap (avoids double-stacking
  // margin + gap, which made the last group's trailing space
  // collide with the photo dropzone below).
  subTagGroup: {
    gap: 12,
  },
  // Wraps so the 6-item chip set lays out across two rows on a
  // narrow 351pt popup. 8pt gap matches the field-label-to-control
  // rhythm elsewhere in the form block.
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // Pill shape per the design system's pill register (same as the
  // submit button + the home toggle buttons). 32pt visual height
  // is below the 44pt HIG tap minimum, but a non-touchable hitSlop
  // of 8 brings the effective area to 48pt — exception-clause
  // case for chip rows of which 5+ would otherwise dominate the
  // form layout. Outlined freshgreen on the unselected side keeps
  // the brand register; filled freshgreen on selected is the
  // standard "this is the choice" affordance.
  chip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: colors.freshgreen,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    // wiltedgreen so the white active-state label clears WCAG AA.
    backgroundColor: colors.wiltedgreen,
    borderColor: colors.wiltedgreen,
  },
  chipLabel: {
    ...typography.subheadlineRegular,
    color: colors.freshgreen,
  },
  chipLabelActive: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
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
    gap: 16,
    alignItems: 'flex-start',
  },
  thankYouTitle: {
    ...typography.title1Emphasized,
    color: colors.black,
  },
  thankYouSubtitle: {
    ...typography.bodyRegular,
    color: colors.labelTertiary,
  },

  // iOS InputAccessoryView toolbar — small bar that sits directly
  // above the keyboard. Right-aligned "Done" matches iOS Mail / Notes
  // and is the platform-conventional dismiss target.
  inputAccessory: {
    backgroundColor: colors.systemGroupedBackground,
    paddingHorizontal: 16,
    // No vertical padding — the Done button's minHeight: 44 sizes the bar
    // to ~44pt total, matching the native iOS keyboard toolbar. Earlier
    // had paddingVertical: 8 which stacked with the new 44pt button to
    // ~60pt — visibly taller than native, audit #10 review caught it.
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorderSubtle,
  },
  inputAccessoryDone: {
    ...typography.bodyEmphasized,
    color: colors.freshgreen,
    paddingVertical: 4,
  },
  // 44pt painted tap floor for the Done button — the bodyEmphasized
  // Text alone is ~22pt and needs a compliant hit area. minWidth gives
  // it horizontal slack matching the bar's right edge; centering the
  // text inside keeps the visual the same.
  inputAccessoryDoneBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
