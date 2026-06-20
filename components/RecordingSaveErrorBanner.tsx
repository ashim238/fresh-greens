import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { X } from 'phosphor-react-native/src/icons/X';

import { getErrorMessage } from '../lib/error-message';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Persistent banner for the /pulled-over save-recording failure case.
 *
 * P-C of the useMutation UX patterns: the highest-stakes silent-fail
 * site in the app (recordings are legal protection — Phase 1's tail).
 * The stop-recording moment is exactly when the user isn't looking at
 * the screen, so inline error isn't enough. This banner pins until
 * the retry succeeds OR the user explicitly dismisses (with confirm).
 *
 * `onRetry` runs the persist again. `onDismiss` is destructive — the
 * banner asks for confirm before discarding the recording.
 */
export function RecordingSaveErrorBanner({
  onRetry,
  onDismiss,
  pending,
}: {
  onRetry: () => void;
  onDismiss: () => void;
  pending: boolean;
}) {
  function handleDismissTap() {
    Alert.alert(
      'Discard this recording?',
      'This will permanently discard the audio you just captured.',
      [
        { text: 'Keep trying', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDismiss },
      ],
    );
  }

  return (
    <View style={styles.root} accessibilityLiveRegion="assertive">
      <View style={styles.iconWrap}>
        <Warning size={20} color={colors.white} weight="fill" />
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {getErrorMessage('recordings', 'transient').title}
      </Text>
      <Pressable
        onPress={onRetry}
        disabled={pending}
        accessibilityRole="button"
        accessibilityLabel={pending ? 'Retrying' : 'Retry saving recording'}
        style={({ pressed }) => [
          tapTarget44,
          styles.retryBtn,
          pressed && !pending && pressedDim,
        ]}
      >
        <Text style={styles.retryText}>{pending ? 'Retrying…' : 'Retry'}</Text>
      </Pressable>
      <Pressable
        onPress={handleDismissTap}
        accessibilityRole="button"
        accessibilityLabel="Dismiss banner — discard recording"
        style={({ pressed }) => [tapTarget44, styles.dismissBtn, pressed && pressedDim]}
      >
        <X size={20} color={colors.white} weight="regular" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.red, // reserved-color sanctioned: recording-save failure
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.white,
    flex: 1,
  },
  retryBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.red,
  },
  dismissBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
