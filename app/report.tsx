import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { X } from 'phosphor-react-native/src/icons/X';
import { useEffect, useState } from 'react';
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

import { Button } from '../components/Button';
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
import { pressedDim } from '../theme/interaction';
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

  function handlePickCategory(c: ReportCategory) {
    setCategory(c);
    setDetailText('');
    setSelectedSubTag(undefined);
    setMode('detail');
  }

  function handleBackFromDetail() {
    setCategory(null);
    setSelectedSubTag(undefined);
    setMode('picker');
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
        // Anonymous categories never persist a submitter; for non-
        // anonymous, the real implementation would attach the auth
        // user's id once auth lands. Mock placeholder for now.
        submittedBy: category.anonymous ? undefined : 'mock-user',
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
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
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
          hitSlop={12}
        >
          <X size={20} color={colors.labelTertiary} weight="bold" />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        {/*
          Orange alert-circle is the documented exception to the
          reserved-color rule (see .cursorrules rule #4 — "Report flow
          identity icon"). Keep as Ionicons; this glyph is the modal's
          identity mark, intentionally consistent across the project's
          report entry points.
        */}
        <View style={styles.identityIcon}>
          <Ionicons name="alert-circle" size={32} color={colors.orange} />
        </View>
        <Text style={styles.titleEmphasized}>Report</Text>
        <Text style={styles.subtitle}>
          Let the community know what&rsquo;s going on near you.
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
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.labelTertiary} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
        >
          <X size={20} color={colors.labelTertiary} weight="bold" />
        </Pressable>
      </View>

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
          inputAccessoryViewID={
            Platform.OS === 'ios' ? DETAIL_INPUT_ACCESSORY_ID : undefined
          }
        />

        {/*
          Place-type chips — only render for categories that define
          a `subTags` whitelist (the place categories: black-owned
          and felt-welcome). Tap toggles the selection: tapping the
          active chip again clears it.
        */}
        {category.subTags && category.subTags.length > 0 && (
          <>
            <Text style={styles.fieldLabel}>(Optional) What kind of place?</Text>
            <View style={styles.chipsWrap}>
              {category.subTags.map((tag) => {
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
          </>
        )}

        {category.hasPhoto && (
          <>
            <Text style={styles.fieldLabel}>(Optional) Add a photo</Text>
            <Pressable
              style={({ pressed }) => [styles.photoStub, pressed && pressedDim]}
              onPress={handlePhotoStubTap}
              accessibilityRole="button"
              accessibilityLabel="Add a photo (coming soon)"
            >
              <Ionicons name="camera-outline" size={32} color={colors.labelTertiary} />
            </Pressable>
          </>
        )}
      </View>

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
  placeName,
  onUndo,
  onClose,
}: {
  placeName?: string;
  onUndo: () => void;
  onClose: () => void;
}) {
  // Subtitle leads with the resolved business name when we have it
  // — makes the contribution feel concrete ("Your note about
  // Wintzell's…") instead of abstract. Falls back to the generic
  // copy when /api/nearby returned nothing.
  const subtitle = placeName
    ? `Your note about ${placeName} helps the next driver — the same way every other Fresh Greens user is helping you.`
    : 'Your report helps the next driver — the same way every other Fresh Greens user is helping you.';

  return (
    <>
      <View style={styles.headerRow}>
        <Pressable
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel="Undo submission and go back"
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.labelTertiary} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
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
    backgroundColor: colors.white,
    borderRadius: 20,
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
  titleBlock: {
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
  },
  subtitle: {
    // bodyRegular per v2 Figma (1112:8319 / 1112:8900). Softer than the
    // earlier bodyEmphasized — the subtitle is the supporting line, not
    // the prompt itself. Per .cursorrules "In-modal user prompts use
    // Title1 Regular," the *supporting* body line should match in tone.
    ...typography.bodyRegular,
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

  // --- Place-type chips (sub-tag picker) ---
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
    paddingVertical: 8,
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
});
