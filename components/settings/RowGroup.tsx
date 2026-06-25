// components/settings/RowGroup.tsx
import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { dynamicType } from '../../theme/dynamic-type';
import { radii } from '../../theme/radii';
import { shadows } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

/**
 * A white card wrapping a contiguous set of SettingsRows, sitting on
 * the grouped-gray page background. Optional uppercase eyebrow caption
 * above the card and a small footer caption below it (the iOS grouped-
 * settings pattern). RowGroup owns the inter-row hairline separators
 * so SettingsRow stays position-agnostic.
 *
 * Spec: docs/archive/superpowers/specs/2026-06-01-settings-register-refresh-design.md
 */
export function RowGroup({
  title,
  footer,
  footerTone = 'default',
  children,
}: {
  title?: string;
  footer?: string;
  /** `error` renders footer in reserved red (inline validation, scan failures). */
  footerTone?: 'default' | 'error';
  children: ReactNode;
}) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.wrap}>
      {title ? (
        <Text style={styles.eyebrow} accessibilityRole="header">
          {title}
        </Text>
      ) : null}

      <View style={styles.cardShadow}>
        <View style={styles.cardClip}>
          {rows.map((row, i) => (
            <Fragment key={i}>
              {row}
              {i < rows.length - 1 ? <View style={styles.separator} /> : null}
            </Fragment>
          ))}
        </View>
      </View>

      {footer ? (
        <Text
          style={[
            styles.footer,
            footerTone === 'error' && styles.footerError,
          ]}
          accessibilityRole={footerTone === 'error' ? 'alert' : 'text'}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  // Sentence-case section caption (user-flagged 2026-06-01 — the
  // all-caps register read too utilitarian). Bumped to subheadline-
  // Emphasized so the heading carries weight without the caps. Sits
  // above the card with a small inset to align to the card's content.
  // Bolder pass: color shifted from labelSecondary → wiltedgreen so
  // RowGroup section titles read as brand-confident waypoints in the
  // settings tree rather than neutral iOS-gray captions. The deep
  // wiltedgreen is one of the brand greens already used for atmospheric
  // headers; on a grouped-gray surface it lifts the section name into
  // brand voice without introducing a new color.
  eyebrow: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.wiltedgreen,
    paddingHorizontal: spacing.md,
  },
  // Outer wrapper carries the shadow. It must NOT set overflow:'hidden'
  // — on iOS that would clip the shadow it's trying to cast (the repo's
  // HomeBrowseSheet card/clip split is the same pattern).
  cardShadow: {
    borderRadius: radii.md,
    ...shadows.e1,
  },
  // Inner view clips the rows + separators to the rounded corners.
  cardClip: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    overflow: 'hidden',
    // A bit of vertical air so the first/last rows don't sit flush to
    // the card's rounded edges (user-flagged 2026-06-02). Insets the
    // rows top + bottom; the hairline separators between rows are
    // unaffected.
    paddingVertical: spacing.xs,
  },
  // Hairline separator inset to clear the row's icon column so it runs
  // under the label text, not the icon — iOS-style. Inset = row
  // paddingHorizontal (spacing.md) + iconWrap (24) + row gap (spacing.md).
  // Assumes icon-bearing rows (the iOS-homogeneous-group norm); an
  // icon-less group's separator will inset past where its label starts,
  // which is acceptable for this app's groups.
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorderSubtle,
    marginLeft: spacing.md + 24 + spacing.md,
  },
  footer: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
    paddingHorizontal: spacing.md,
  },
  footerError: {
    color: colors.red,
  },
});
