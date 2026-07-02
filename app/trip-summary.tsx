import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { X } from 'phosphor-react-native/src/icons/X';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { DragHandle } from '../components/DragHandle';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { useMutation } from '../hooks/useMutation';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useRegularDestinations } from '../hooks/useRegularDestinations';
import {
  addCommunityReport,
  type ReportCategoryId,
} from '../lib/api/community-reports';
import { formatDistance, formatDuration } from '../lib/format';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { motion } from '../theme/motion';
import { radii } from '../theme/radii';
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

/**
 * D3: "Added to the community map" confirmation line — fades in over
 * 220ms after the user confirms an inference. Only rendered post-accept;
 * the opacity tween fires on mount. Gated on reduce motion.
 */
function CommunityMapLine({ reduceMotion }: { reduceMotion: boolean }) {
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: motion.duration.quick,
      easing: motion.easing.out,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, opacity]);

  return (
    <Animated.Text
      style={[styles.communityMapLine, { opacity }]}
      accessibilityLiveRegion="polite"
    >
      Added to the community map
    </Animated.Text>
  );
}

export default function TripSummary() {
  const router = useRouter();
  const { label, distanceMeters, estimatedMinutes, inferences, destLat, destLng } =
    useLocalSearchParams<TripSummaryParams>();
  const { markRegular } = useRegularDestinations();
  const reduceMotion = useReduceMotion();

  // D1: completion check-circle entrance animation
  const checkEntrance = useEntranceAnimation(8);

  // D1: success haptic on arrival — fires once on mount
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
  }, []);

  const acceptMutation = useMutation(addCommunityReport);
  const regularMutation = useMutation(markRegular);
  // Map of inference-id → the Inference object, when its save failed
  // (used to render an inline "tap to retry" line below the row).
  const [retryableAccepts, setRetryableAccepts] = useState<
    Record<string, Inference>
  >({});

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
  // Ref that mirrors statuses for synchronous reads inside async handlers.
  // React state updates are batched; without this, the rollback in handleAccept
  // can't see a Reject the user tapped during the await.
  const statusesRef = useRef<Record<string, InferenceStatus>>({});
  useEffect(() => {
    statusesRef.current = statuses;
  }, [statuses]);

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
    // spine (C15). Needs the name + coords (carried from the arrival push).
    const lat = Number(destLat);
    const lng = Number(destLng);
    if (label && Number.isFinite(lat) && Number.isFinite(lng)) {
      const result = await regularMutation.run({
        name: label,
        latitude: lat,
        longitude: lng,
      });
      if (result.ok) {
        AccessibilityInfo.announceForAccessibility(
          `${label} saved as a regular destination.`,
        );
      } else {
        // P-A: stay on screen, retry-line near the CTA (rendered
        // conditionally on regularMutation.status === 'error', see
        // actions section). User can tap to retry; success dismisses.
        return;
      }
    }
    router.back();
  }

  async function handleAccept(inf: Inference) {
    const meta = INFERENCE_META[inf.category];
    if (!meta) return;
    // D3: selection haptic on confirm
    Haptics.selectionAsync().catch(() => {});
    setStatuses((s) => ({ ...s, [inf.id]: 'accepted' }));
    // Clear any prior retry-state for this inference (a retry tap should
    // not leave a stale "tap to retry" if the new attempt succeeds).
    setRetryableAccepts((r) => {
      const next = { ...r };
      delete next[inf.id];
      return next;
    });
    // Confirmation → community report. Same pipeline /report uses, so
    // the validated zone feeds future routing (getCommunityReportsAsZones
    // → scoring). This is the countermapping loop closing.
    const result = await acceptMutation.run({
      categoryId: meta.reportCategoryId,
      location: { latitude: inf.latitude, longitude: inf.longitude },
      detail: meta.detail,
    });
    if (!result.ok) {
      // P-A: snap pip back to unanswered, surface inline retry — but only
      // if the user hasn't since rejected this inference. If they tapped
      // Reject during the await, statusesRef will be 'rejected'; rolling
      // back would clobber their deliberate choice.
      if (statusesRef.current[inf.id] === 'accepted') {
        setStatuses((s) => {
          const next = { ...s };
          delete next[inf.id];
          return next;
        });
        setRetryableAccepts((r) => ({ ...r, [inf.id]: inf }));
      }
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
          {/* D1: completion check-circle — entrance animation gated on reduce motion */}
          <Animated.View
            style={[
              styles.checkCircle,
              reduceMotion ? undefined : checkEntrance.style,
            ]}
            accessibilityLabel="Trip complete"
          >
            <Check size={28} color={colors.white} weight="bold" />
          </Animated.View>

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
                  <View key={inf.id}>
                    <View style={styles.inferenceRow}>
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
                        <View>
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
                          {status === 'accepted' && (
                            <CommunityMapLine reduceMotion={reduceMotion} />
                          )}
                        </View>
                      )}
                    </View>
                    {retryableAccepts[inf.id] && (
                      <Pressable
                        onPress={() => handleAccept(retryableAccepts[inf.id]!)}
                        style={styles.inferenceRetryLine}
                        accessibilityRole="button"
                        accessibilityLabel={`Retry confirming ${meta.label}`}
                      >
                        <Text style={styles.inferenceRetryText}>
                          Didn't save — tap to retry.
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          {regularMutation.status === 'error' && (
            <Pressable
              onPress={handleSetDefault}
              style={styles.setDefaultRetryLine}
              accessibilityRole="button"
              accessibilityLabel="Retry saving as default"
            >
              <Text style={styles.setDefaultRetryText}>
                Didn't save — tap to retry.
              </Text>
            </Pressable>
          )}
          <Button
            text="Remember this destination"
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
    backgroundColor: colors.surfacePage,
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
  // D1: completion indicator — 48pt freshgreen circle, centered
  checkCircle: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...dynamicType(typography.caption1Regular),
    color: colors.mutedSecondary,
  },
  destination: {
    ...dynamicType(typography.brandDisplayLarge),
    color: colors.black,
    marginTop: spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  statValue: {
    ...dynamicType(typography.title1Emphasized),
    color: colors.black,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...dynamicType(typography.caption1Regular),
    color: colors.mutedSecondary,
    marginTop: spacing.xs,
  },
  // --- Inference validation (C12b) ---
  inferenceSection: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  inferenceHeading: {
    ...dynamicType(typography.title3Regular),
    color: colors.black,
  },
  inferenceSub: {
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
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
    ...dynamicType(typography.bodyRegular),
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
    borderRadius: radii.pill,
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
    ...dynamicType(typography.subheadlineEmphasized),
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
  inferenceRetryLine: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  inferenceRetryText: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
  setDefaultRetryLine: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  setDefaultRetryText: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
  // D3: "Added to the community map" secondary line below "Confirmed"
  communityMapLine: {
    ...dynamicType(typography.caption1Regular),
    color: colors.wiltedgreen,
    marginTop: spacing.xs,
  },
});
