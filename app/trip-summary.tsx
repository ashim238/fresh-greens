import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { DragHandle } from '../components/DragHandle';
import { formatDistance, formatDuration } from '../lib/format';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Trip Summary — post-trip recap pop-up modal. Figma `825:4908`.
 *
 * Shown on arrival (en-route's `status === 'arrived'`). Recaps the route
 * just driven and offers two route-disposition actions.
 *
 * Built on the /pulled-over modal shell (root → SafeAreaView(bottom) →
 * DragHandle), presented as an expo-router modal (see app/_layout.tsx) so
 * the system swipe-down dismisses it. Single view — no phase machine; this
 * is the opposite of /pulled-over's multi-screen consolidation.
 *
 * Design reconciliation (concordance ↔ docs/design-system.md, May 28):
 *  - Title uses `typography.title1Regular`, NOT title1Emphasized — the
 *    held, emotional-restraint register per .cursorrules (same as Contact).
 *  - "Set as default" = Button primary/fill — freshgreen fill that inherits
 *    the wiltedgreen 1pt AA-contrast border automatically (freshgreen-on-
 *    white is 2.88:1, below the WCAG 3:1 UI floor; the border lifts it to
 *    6.54:1). Do NOT hand-roll a plain freshgreen fill.
 *  - "Keep current route" = Button secondary/outline — wiltedgreen border + text.
 */

const METERS_PER_MILE = 1609.34;

type TripSummaryParams = {
  /** Destination name, e.g. "Oakland Museum of California". */
  label?: string;
  /** Total distance driven, in meters (Route.distanceMeters, stringified). */
  distanceMeters?: string;
  /** Trip duration in minutes (Route.estimatedMinutes, stringified). */
  estimatedMinutes?: string;
};

export default function TripSummary() {
  const router = useRouter();
  const { label, distanceMeters, estimatedMinutes } =
    useLocalSearchParams<TripSummaryParams>();

  const meters = Number(distanceMeters);
  const minutes = Number(estimatedMinutes);
  const distanceText =
    Number.isFinite(meters) && meters > 0
      ? formatDistance(meters / METERS_PER_MILE)
      : null;
  const durationText =
    Number.isFinite(minutes) && minutes > 0 ? formatDuration(minutes) : null;

  // Announce the recap on open — the modal carries information a screen-
  // reader user would otherwise have to hunt for across separate Text nodes.
  useEffect(() => {
    const parts = ['Trip summary'];
    if (label) parts.push(`Arrived at ${label}`);
    if (durationText) parts.push(durationText);
    if (distanceText) parts.push(distanceText);
    AccessibilityInfo.announceForAccessibility(parts.join('. '));
  }, [label, distanceText, durationText]);

  function handleKeepCurrent() {
    router.back();
  }

  function handleSetDefault() {
    // TODO(default-route): persist this route as the user's default before
    // dismissing. Wires into preferences once the "default route" slot is
    // defined (usePreferences) — kept a no-op-then-dismiss for now so the
    // screen ships without inventing a persistence contract.
    router.back();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.dragWrapper}>
          <DragHandle />
        </View>

        <View style={styles.content}>
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
        </View>

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
    paddingHorizontal: 24,
  },
  dragWrapper: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...typography.title1Regular,
    color: colors.black,
  },
  destination: {
    ...typography.bodyRegular,
    color: colors.mutedSecondary,
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 32,
  },
  statValue: {
    ...typography.title2Emphasized,
    color: colors.black,
  },
  statLabel: {
    ...typography.subheadlineRegular,
    color: colors.mutedSecondary,
    marginTop: 4,
  },
  actions: {
    gap: 12,
    paddingBottom: 8,
  },
  action: {
    alignSelf: 'stretch',
  },
});
