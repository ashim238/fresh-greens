import { StyleSheet, Text, View } from 'react-native';

import {
  type ErrorDisposition,
  type ErrorDomain,
  getErrorMessage,
} from '../lib/error-message';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Inline error surface. Renders the body text from getErrorMessage,
 * styled to match the existing inline error pattern in /report
 * (footnoteRegular + colors.severityCritical + centered — the
 * readable-error-copy token on light surfaces, per .cursorrules #8).
 *
 * The title is omitted in the inline case — the domain context is
 * usually visible at the call site (the user is on the form that
 * failed; they don't need a "Couldn't send your report" title AND
 * an inline body — just the body suffices).
 *
 * For modal cases use destructuring:
 *   const { title, body } = getErrorMessage(...);
 *   Alert.alert(title, body);
 * For the persistent-banner case (P-C from PR #2) the
 * RecordingSaveErrorBanner composes getErrorMessage internally.
 *
 * Silent dispositions render nothing (defensive — guards against
 * accidental render of an inline cancelled surface).
 */
export function SafetyErrorMessage({
  domain,
  disposition,
  error,
}: {
  domain: ErrorDomain;
  disposition: ErrorDisposition;
  error?: unknown;
}) {
  const { body } = getErrorMessage(domain, disposition, error);
  if (!body) return null;
  return (
    <View style={styles.root}>
      <Text style={styles.text}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  text: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.severityCritical, // readable error copy on light surface — .cursorrules #8
    textAlign: 'center',
  },
});
