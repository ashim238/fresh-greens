import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { Phone } from 'phosphor-react-native/src/icons/Phone';

import { Button } from './Button';
import { DragHandle } from './DragHandle';
import { NotifyingPulse } from './NotifyingPulse';
import type { TrustedContact } from '../lib/api/trusted-contact';
import { getErrorMessage } from '../lib/error-message';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = {
  visible: boolean;
  onClose: () => void;
  contact: TrustedContact;
};

/**
 * "You're not alone." — Unfamiliar-area-only lifeline. Tapping the
 * NotifyingPulse footer in /unfamiliar opens this. Big avatar + Call /
 * Text shortcuts. Sharing continues during/after the call.
 *
 * Per spec scope-decision: lifeline is Unfamiliar-only — Roadside and
 * Pulled-over have their own contact-handling chrome; Share Location
 * stays light.
 */
export function LifelineModal({ visible, onClose, contact }: Props) {
  // Strip formatting + leading-`+`-keep. If a contact was picked without
  // a valid number (or has only formatting chars), the sanitized string
  // is empty and `tel:` / `sms:` would open a blank dialer — bail early
  // instead of silently failing.
  const dialable = contact.phoneNumber.replace(/[^\d+]/g, '');

  async function openOrWarn(url: string, unsupportedMessage: string) {
    if (!dialable) {
      const { title, body } = getErrorMessage('contact', 'permanent');
      Alert.alert(title, body);
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Unavailable', unsupportedMessage);
      return;
    }
    await Linking.openURL(url);
  }

  function handleCall() {
    void openOrWarn(`tel:${dialable}`, "This device can't place phone calls.");
  }

  function handleText() {
    void openOrWarn(`sms:${dialable}`, "This device can't send text messages.");
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessible={false}
        accessibilityElementsHidden
      >
        <Pressable style={styles.card} onPress={() => {}}>
          <DragHandle />

          <View style={styles.body}>
            <Text style={styles.title} accessibilityRole="header">
              You&apos;re not alone.
            </Text>
            <Text style={styles.subtitle}>
              Your Trusted Contact is alerted during emergencies and can see your current location.
            </Text>

            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{contact.initials}</Text>
              </View>
            </View>
            <Text style={styles.name}>{contact.name}</Text>

            <View style={styles.ctaStack}>
              <Button
                text="Call"
                type="primary"
                fill="fill"
                icon={<Phone size={20} color={colors.white} weight="regular" />}
                onPress={handleCall}
                style={styles.ctaStretch}
              />
              <Button
                text="Text"
                type="primary"
                fill="outline"
                icon={<ChatCircle size={20} color={colors.freshgreen} weight="regular" />}
                onPress={handleText}
                style={styles.ctaStretch}
              />
            </View>

            <View style={styles.footer}>
              <NotifyingPulse
                contactName={contact.name}
                label="Your Trusted Contact is being notified"
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.modalScrimStrong,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.lg,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
    alignSelf: 'flex-start',
  },
  subtitle: {
    ...dynamicType(relaxedLineHeight(typography.bodyRegular)),
    color: colors.labelSecondary,
    alignSelf: 'flex-start',
  },
  avatarRing: {
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 4,
    borderColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.burntgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    // Display-scale identity affordance — the 44pt size has no token
    // equivalent in the typography ramp (largest is title2Emphasized at
    // ~28pt). Hand-set here as the documented exception per the spec's
    // "big avatar moment" sizing.
    ...typography.title2Emphasized,
    color: colors.white,
    // Avatar initials stay at fixed display-scale — the ring is a visual
    // element, not text needing AX5 scaling. The single character won't clip
    // at this size.
    // dynamic-type exempt (.cursorrules): display-scale avatar identity element
    fontSize: 44,
  },
  name: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  ctaStack: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  ctaStretch: {
    alignSelf: 'stretch',
  },
  footer: {
    paddingTop: spacing.lg,
  },
});
