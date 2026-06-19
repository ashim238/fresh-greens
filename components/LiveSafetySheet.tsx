import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CaretUp } from 'phosphor-react-native/src/icons/CaretUp';

import { Button } from './Button';
import { DragHandle } from './DragHandle';
import { NotifyingPulse } from './NotifyingPulse';
import { useShareSession } from '../hooks/useShareSession';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { formatElapsedDuration } from '../lib/format';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Persistent sticky bottom widget surfacing the active ShareSession on
 * /home and /en-route. Returns null when no session is active.
 *
 * Collapsed (default): 64pt pill at the bottom, tap to expand.
 * Expanded: Modal sheet with DragHandle, full session detail, End-sharing
 *           CTA, NotifyingPulse footer.
 *
 * v1 simulates time-elapsed by ticking a local counter once per second.
 * The session itself is global state (useShareSession); the ticker is
 * presentation-only.
 *
 * Privacy: for type='unfamiliar' sessions the widget surfaces "Unfamiliar
 * area" as the session label, NOT the underlying problem (the user's
 * verbatim selection like "I'm being followed"). Glanceability + dignity.
 *
 * bottomInset: distance (pt) from the screen bottom to float the
 * collapsed pill. Defaults to spacing.lg (sits near the bottom edge —
 * correct for /home). /en-route passes its measured bottomSheetHeight +
 * gap so the pill floats ABOVE the bottom sheet rather than covering
 * the End-trip button inside it (user-flagged 2026-06-01).
 */
export function LiveSafetySheet({
  bottomInset,
}: {
  bottomInset?: number;
} = {}) {
  const shareState = useShareSession();
  const { endSession, resendSessionSms } = shareState;
  const session = shareState.ready ? shareState.session : null;
  const contactState = useTrustedContact();
  const contact = contactState.ready ? contactState.contact : null;
  const [expanded, setExpanded] = useState(false);
  const [tickSeconds, setTickSeconds] = useState(0);

  // Recompute elapsed seconds once per second while a session is live.
  useEffect(() => {
    if (!session) {
      setTickSeconds(0);
      return;
    }
    const startedAt = new Date(session.startedAtIso).getTime();
    const update = () => {
      setTickSeconds(Math.floor((Date.now() - startedAt) / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session]);

  if (!session || !contact) return null;

  const duration = formatElapsedDuration(tickSeconds);
  const sessionTypeLabel =
    session.type === 'unfamiliar' ? 'Unfamiliar area' : 'Sharing location';
  const widgetReason =
    session.type === 'unfamiliar' ? 'Unfamiliar area' : session.reason;

  async function doEnd() {
    setExpanded(false);
    await endSession();
  }

  function handleEnd() {
    if (!session) return;
    // Unfamiliar sessions are higher-stakes (the user declared they
    // were lost/unsafe/followed) — gate the end behind an Alert confirm
    // so a misplaced thumb doesn't drop the share mid-incident.
    // Share-location is routine; single tap is appropriate.
    if (session.type === 'unfamiliar') {
      Alert.alert(
        'End sharing?',
        'This ends your active safety check-in. Send another text anytime from Safety.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'End', style: 'destructive', onPress: doEnd },
        ],
      );
    } else {
      doEnd().catch((err) => console.warn('endSession failed', err));
    }
  }

  return (
    <>
      {/* Collapsed pill — anchored to bottom of mounting surface, or
          floated above a host bottom sheet via bottomInset. */}
      <Pressable
        onPress={() => setExpanded(true)}
        style={({ pressed }) => [
          styles.collapsed,
          bottomInset != null && { bottom: bottomInset },
          pressed && pressedDim,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Safety check-in with ${contact.name}, ${duration}. Tap to expand.`}
      >
        <NotifyingPulse
          contactName={contact.name}
          label={`${sessionTypeLabel} · ${duration}`}
          align="start"
          onPress={() => {
            void resendSessionSms();
          }}
        />
        <CaretUp size={18} color={colors.labelSecondary} weight="bold" />
      </Pressable>

      {/* Expanded sheet */}
      <Modal
        visible={expanded}
        transparent
        animationType="slide"
        onRequestClose={() => setExpanded(false)}
        accessibilityViewIsModal
      >
        <Pressable
          style={styles.scrim}
          onPress={() => setExpanded(false)}
          accessible={false}
          accessibilityElementsHidden
        >
          <Pressable style={styles.expandedCard} onPress={() => {}}>
            <DragHandle />

            <View style={styles.expandedBody}>
              <Text style={styles.expandedKicker}>Live</Text>
              <Text style={styles.expandedTitle} accessibilityRole="header">
                Sharing location
              </Text>

              <View style={styles.detailCard}>
                <View style={styles.activelyRow}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activelyLabel}>Actively sharing</Text>
                </View>
                <View style={styles.separator} />
                <View style={styles.contactRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{contact.initials}</Text>
                  </View>
                  <View>
                    <Text style={styles.contactName}>{contact.name}</Text>
                  </View>
                </View>
                <View style={styles.separator} />
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Duration</Text>
                  <Text style={styles.metaValue}>{duration}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Reason</Text>
                  <Text style={styles.metaValue}>{widgetReason}</Text>
                </View>
              </View>

              <View style={styles.endCtaWrap}>
                <Button
                  text="End sharing"
                  type="primary"
                  fill="outline"
                  onPress={handleEnd}
                  style={styles.endCtaStretch}
                />
              </View>

              <View style={styles.expandedFooter}>
                <NotifyingPulse
                  contactName={contact.name}
                  onPress={() => {
                    void resendSessionSms();
                  }}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Collapsed pill
  collapsed: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    minHeight: 64,
    backgroundColor: colors.white,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    ...shadows.e2,
    zIndex: 50,
  },
  // Scrim + expanded card
  scrim: {
    flex: 1,
    backgroundColor: colors.modalScrimStrong,
    justifyContent: 'flex-end',
  },
  expandedCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.lg,
  },
  expandedBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  expandedKicker: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
  expandedTitle: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
  },
  // Detail card
  detailCard: {
    backgroundColor: colors.systemGroupedBackground,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  activelyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.freshgreen,
  },
  activelyLabel: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  separator: {
    height: 1,
    backgroundColor: colors.cardBorderSubtle,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.wiltedgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.footnoteEmphasized,
    color: colors.white,
  },
  contactName: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelSecondary,
  },
  metaValue: {
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
  },
  // CTAs
  endCtaWrap: {
    marginTop: spacing.sm,
  },
  endCtaStretch: {
    alignSelf: 'stretch',
  },
  expandedFooter: {
    paddingTop: spacing.xs,
  },
});
