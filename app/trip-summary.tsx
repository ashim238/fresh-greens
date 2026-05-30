import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { X } from 'phosphor-react-native/src/icons/X';
import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { DragHandle } from '../components/DragHandle';
import { useRegularDestinations } from '../hooks/useRegularDestinations';
import {
  addCommunityReport,
  type ReportCategoryId,
} from '../lib/api/community-reports';
import { formatDistance, formatDuration } from '../lib/format';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Trip Summary — post-trip recap pop-up modal. Figma `825:4908`.
 *
 * Shown on arrival (en-route's `status === 'arrived'`, wired in C12a).
 * Recaps the route just driven, hosts the inference-validation loop
 * (C12b), and offers two route-disposition actions.
 *
 * Inference-validation (C12b — the countermapping feedback loop): the
 * caution/avoid zones the trip actually passed through are listed for
 * the user to confirm or dismiss. A confirmation becomes a community
 * report (the same pipeline /report uses), so lived validation feeds
 * future routing for everyone — community knowledge weighted equally
 * with institutional data, per the thesis.
 *
 * Built on the /pulled-over modal shell (root → SafeAreaView(bottom) →
 * DragHandle), presented as an expo-router modal. Title uses
 * `typography.title1Regular` (the held register per .cursorrules).
 * "Set as default" is a primary/fill Button; "Keep current route" is
 * secondary/outline.
 */

const METERS_PER_MILE = 1609.34;

type TripSummaryParams = {
  /** Destination name, e.g. "Oakland Museum of California". */
  label?: string;
  /** Total distance driven, in meters (Route.distanceMeters, stringified). */
  distanceMeters?: string;
  /** Trip duration in minutes (Route.estimatedMinutes, stringified). */
  estimatedMinutes?: string;
  /** JSON-serialized Inference[] — the trip's encountered caution/avoid zones. */
  inferences?: string;
  /** Destination coords (stringified) — for marking it a regular (C12c). */
  destLat?: string;
  destLng?: string;
};

type Inference = {
  id: string;
  category: string;
  latitude: number;
  longitude: number;
};

type InferenceStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Maps an OSM zone category to its plain-language label, the community-
 * report category an accepted confirmation creates, and the report's
 * detail copy. The report-category mapping is intentionally lossy
 * (there's no 'police'/'wildlife' report category) — the detail string
 * preserves the specific meaning. 'police' → 'felt-unsafe' is on-thesis:
 * it encodes the police-wariness the interviews surfaced.
 */
const INFERENCE_META: Record<
  string,
  { label: string; reportCategoryId: ReportCategoryId; detail: string }
> = {
  police: {
    label: 'Increased police presence',
    reportCategoryId: 'felt-unsafe',
    detail: 'Confirmed on a recent trip: increased police presence along this route.',
  },
  wildlife: {
    label: 'Wildlife crossing area',
    reportCategoryId: 'hazard',
    detail: 'Confirmed on a recent trip: wildlife activity along this route.',
  },
  lighting: {
    label: 'Low-light stretch',
    reportCategoryId: 'lighting',
    detail: 'Confirmed on a recent trip: poor lighting along this route.',
  },
  'road-condition': {
    label: 'Rough road or construction',
    reportCategoryId: 'hazard',
    detail: 'Confirmed on a recent trip: rough road or construction along this route.',
  },
};

export default function TripSummary() {
  const router = useRouter();
  const { label, distanceMeters, estimatedMinutes, inferences, destLat, destLng } =
    useLocalSearchParams<TripSummaryParams>();
  const { markRegular } = useRegularDestinations();

  const meters = Number(distanceMeters);
  const minutes = Number(estimatedMinutes);
  const distanceText =
    Number.isFinite(meters) && meters > 0
      ? formatDistance(meters / METERS_PER_MILE)
      : null;
  const durationText =
    Number.isFinite(minutes) && minutes > 0 ? formatDuration(minutes) : null;

  // Parse + filter the inference set to categories we have a mapping
  // for. Defensive: a malformed param degrades to no validation section
  // rather than crashing the arrival recap.
  const parsedInferences = useMemo<Inference[]>(() => {
    if (!inferences) return [];
    try {
      const raw = JSON.parse(inferences) as Inference[];
      if (!Array.isArray(raw)) return [];
      return raw.filter((i) => i && INFERENCE_META[i.category]);
    } catch {
      return [];
    }
  }, [inferences]);

  const [statuses, setStatuses] = useState<Record<string, InferenceStatus>>({});

  // Announce the recap on open — the modal carries information a screen-
  // reader user would otherwise hunt for across separate Text nodes.
  useEffect(() => {
    const parts = ['Trip summary'];
    if (label) parts.push(`Arrived at ${label}`);
    if (durationText) parts.push(durationText);
    if (distanceText) parts.push(distanceText);
    if (parsedInferences.length > 0) {
      parts.push(
        `${parsedInferences.length} area${parsedInferences.length === 1 ? '' : 's'} to confirm`,
      );
    }
    AccessibilityInfo.announceForAccessibility(parts.join('. '));
  }, [label, distanceText, durationText, parsedInferences.length]);

  function handleKeepCurrent() {
    router.back();
  }

  async function handleSetDefault() {
    // C12c: mark this destination a "regular" — it unlocks the
    // recurring-destination underline on /home (isRegularLocation) and
    // is the first frequency signal feeding the adaptive-personalization
    // spine (C15). Best-effort; dismiss either way. Needs the name +
    // coords (carried from the arrival push).
    const lat = Number(destLat);
    const lng = Number(destLng);
    if (label && Number.isFinite(lat) && Number.isFinite(lng)) {
      try {
        await markRegular({ name: label, latitude: lat, longitude: lng });
        AccessibilityInfo.announceForAccessibility(
          `${label} saved as a regular destination.`,
        );
      } catch {
        // Best-effort local write; dismiss regardless.
      }
    }
    router.back();
  }

  async function handleAccept(inf: Inference) {
    const meta = INFERENCE_META[inf.category];
    if (!meta) return;
    setStatuses((s) => ({ ...s, [inf.id]: 'accepted' }));
    try {
      // Confirmation → community report. Same pipeline /report uses, so
      // the validated zone feeds future routing (getCommunityReportsAsZones
      // → scoring). This is the countermapping loop closing.
      await addCommunityReport({
        categoryId: meta.reportCategoryId,
        location: { latitude: inf.latitude, longitude: inf.longitude },
        detail: meta.detail,
      });
    } catch {
      // Best-effort local write; the optimistic 'accepted' state stands.
      // A failed AsyncStorage write is rare and not worth a rollback that
      // would re-prompt the user mid-recap.
    }
  }

  function handleReject(inf: Inference) {
    setStatuses((s) => ({ ...s, [inf.id]: 'rejected' }));
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.dragWrapper}>
          <DragHandle />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title} accessibilityRole="header">
            Trip Summary
          </Text>
          {label ? <Text style={styles.destination}>{label}</Text> : null}

          {(distanceText || durationText) && (
            <View style={styles.stats}>
              {durationText ? (
                <View>
                  <Text style={styles.statValue}>{durationText}</Text>
                  <Text style={styles.statLabel}>time</Text>
                </View>
              ) : null}
              {distanceText ? (
                <View>
                  <Text style={styles.statValue}>{distanceText}</Text>
                  <Text style={styles.statLabel}>distance</Text>
                </View>
              ) : null}
            </View>
          )}

          {parsedInferences.length > 0 && (
            <View style={styles.inferenceSection}>
              <Text style={styles.inferenceHeading}>Did we get this right?</Text>
              <Text style={styles.inferenceSub}>
                Confirming adds your report to the community map — it helps
                the next driver.
              </Text>
              {parsedInferences.map((inf) => {
                const meta = INFERENCE_META[inf.category];
                const status = statuses[inf.id] ?? 'pending';
                return (
                  <View key={inf.id} style={styles.inferenceRow}>
                    <Text
                      style={[
                        styles.inferenceLabel,
                        status === 'rejected' && styles.inferenceLabelMuted,
                      ]}
                    >
                      {meta.label}
                    </Text>
                    {status === 'pending' ? (
                      <View style={styles.inferenceActions}>
                        <Pressable
                          onPress={() => handleReject(inf)}
                          accessibilityRole="button"
                          accessibilityLabel={`Dismiss: ${meta.label}`}
                          style={({ pressed }) => [
                            styles.inferenceBtn,
                            styles.inferenceBtnReject,
                            pressed && pressedDim,
                          ]}
                        >
                          <X size={18} color={colors.labelSecondary} weight="bold" />
                        </Pressable>
                        <Pressable
                          onPress={() => handleAccept(inf)}
                          accessibilityRole="button"
                          accessibilityLabel={`Confirm: ${meta.label}`}
                          style={({ pressed }) => [
                            styles.inferenceBtn,
                            styles.inferenceBtnAccept,
                            pressed && pressedDim,
                          ]}
                        >
                          <Check size={18} color={colors.white} weight="bold" />
                        </Pressable>
                      </View>
                    ) : (
                      <Text
                        accessibilityLiveRegion="polite"
                        style={[
                          styles.inferenceResult,
                          status === 'accepted'
                            ? styles.inferenceResultAccepted
                            : styles.inferenceResultRejected,
                        ]}
                      >
                        {status === 'accepted' ? 'Confirmed' : 'Dismissed'}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <Button
            text="Set as default"
            type="primary"
            fill="fill"
            onPress={handleSetDefault}
            style={styles.action}
          />
          <Button
            text="Keep current route"
            type="secondary"
            fill="outline"
            onPress={handleKeepCurrent}
            style={styles.action}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  dragWrapper: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.title1Regular,
    color: colors.black,
  },
  destination: {
    ...typography.bodyRegular,
    color: colors.mutedSecondary,
    marginTop: spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  statValue: {
    ...typography.title2Emphasized,
    color: colors.black,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...typography.subheadlineRegular,
    color: colors.mutedSecondary,
    marginTop: spacing.xs,
  },
  // --- Inference validation (C12b) ---
  inferenceSection: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  inferenceHeading: {
    ...typography.title3Emphasized,
    color: colors.black,
  },
  inferenceSub: {
    ...typography.footnoteRegular,
    color: colors.mutedSecondary,
    marginBottom: spacing.sm,
  },
  inferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.separatorSubtle,
  },
  inferenceLabel: {
    ...typography.bodyRegular,
    color: colors.black,
    flex: 1,
  },
  inferenceLabelMuted: {
    color: colors.mutedTertiary,
    textDecorationLine: 'line-through',
  },
  inferenceActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inferenceBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inferenceBtnReject: {
    backgroundColor: colors.fillsTertiary,
  },
  inferenceBtnAccept: {
    backgroundColor: colors.wiltedgreen,
  },
  inferenceResult: {
    ...typography.subheadlineEmphasized,
  },
  inferenceResultAccepted: {
    color: colors.wiltedgreen,
  },
  inferenceResultRejected: {
    color: colors.mutedTertiary,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  action: {
    alignSelf: 'stretch',
  },
});
