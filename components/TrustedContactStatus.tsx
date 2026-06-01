import { StyleSheet, Text, View } from 'react-native';

import type { TrustedContact } from '../lib/api/trusted-contact';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Footer used across the safety/pulled-over flow — a small reassurance
 * line indicating the user has a trusted contact configured.
 *
 * Honesty boundary (audit 2026-05-31 §/pulled-over F1): the prior version
 * of this component rendered "Your Trusted Contact is being notified" with
 * a pulsing freshgreen dot regardless of contact-state OR phase. That
 * combination claimed an active notification that does not exist in v1 —
 * Fresh Greens never sends an SMS or push to the contact; calls/texts only
 * happen when the user taps Call/Text on the Contact phase. The current
 * version:
 *   - Returns null when no contact is configured (no silent lie).
 *   - Drops the pulse (the pulse signals activity; activity is the claim
 *     that wasn't true).
 *   - Uses forward-looking copy ("can be reached on the next screen")
 *     that reflects what the surface ACTUALLY offers: a ready-to-tap
 *     contact, not an autonomous alerter.
 *
 * If the share-session model later wires real transmission, swap to a
 * variant that shows the active state explicitly and uses NotifyingPulse
 * (the post-action pulse component) instead of recreating one here.
 */
export function TrustedContactStatus({ contact }: { contact: TrustedContact | null }) {
  if (!contact) return null;

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Trusted contact set: ${contact.name}. Can be reached on the Contact screen.`}
    >
      <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={styles.text}>Your Trusted Contact can be reached on the next screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  text: {
    ...typography.footnoteRegular,
    color: colors.mutedTertiary,
    textAlign: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.freshgreen,
  },
});
