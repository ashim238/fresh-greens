import { StyleSheet, View } from 'react-native';

import QuickToolSaved from '../assets/illustrations/quick-tools-saved.svg';
import { colors } from '../theme/colors';

/** Figma bookmark aspect (14×19). */
const ASPECT = 19 / 14;

/** Icon box for /search quick tools — matches 24×24 category tiles. */
export const SAVED_QUICK_TOOL_BOX = 24;

/** Glyph size inside the quick-tool box (not the box itself). */
const SAVED_QUICK_TOOL_GLYPH = 17;

/**
 * Canonical saved-place bookmark — same glyph as /search's Saved quick
 * tool. Use beside saved destination titles and in saved-place lists
 * instead of freshgreen underline (underline reads as a link, not
 * "saved").
 *
 * `selected` fills the bookmark wiltedgreen (brand register, not a
 * reserved safety signal). Decorative quick-tool exception documents
 * the Saved tile's system-color family; this variant stays on-brand.
 */
export function SavedPlaceBookmark({
  size = 14,
  variant = 'default',
  /** When true, centers the glyph in a 24×24 well (quick-tool tile). */
  inQuickToolBox = false,
}: {
  size?: number;
  variant?: 'default' | 'selected';
  inQuickToolBox?: boolean;
}) {
  const glyphSize = inQuickToolBox ? SAVED_QUICK_TOOL_GLYPH : size;
  const height = glyphSize * ASPECT;
  const tint = variant === 'selected' ? colors.wiltedgreen : colors.black;

  const glyph = (
    <QuickToolSaved
      width={glyphSize}
      height={height}
      color={tint}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );

  if (!inQuickToolBox) {
    return glyph;
  }

  return (
    <View
      style={[
        styles.quickToolBox,
        variant === 'selected' && styles.quickToolBoxSelected,
      ]}
    >
      {glyph}
    </View>
  );
}

const styles = StyleSheet.create({
  quickToolBox: {
    width: SAVED_QUICK_TOOL_BOX,
    height: SAVED_QUICK_TOOL_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickToolBoxSelected: {
    backgroundColor: colors.fadedgreen,
    borderRadius: 8,
  },
});
