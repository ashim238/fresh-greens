import { StyleSheet, View } from 'react-native';
import { Bookmark } from 'phosphor-react-native/src/icons/Bookmark';

import { colors } from '../theme/colors';

/** Icon box for /search quick tools — matches 24×24 category tiles. */
export const SAVED_QUICK_TOOL_BOX = 24;

/** Glyph size inside the quick-tool box (not the box itself). */
const SAVED_QUICK_TOOL_GLYPH = 22;

/**
 * Canonical saved-place bookmark. Phosphor `Bookmark` (not the Figma SVG)
 * so `fill` weight stays inside the glyph — the exported SVG compound
 * path bleeds wiltedgreen outside the bookmark silhouette.
 *
 * `selected` → fill weight + wiltedgreen. `default` → outline + black.
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
  const iconSize = inQuickToolBox ? SAVED_QUICK_TOOL_GLYPH : size;
  const selected = variant === 'selected';
  const tint = selected ? colors.wiltedgreen : colors.black;

  const glyph = (
    <Bookmark
      size={iconSize}
      weight={selected ? 'fill' : 'regular'}
      color={tint}
    />
  );

  if (!inQuickToolBox) {
    return glyph;
  }

  return <View style={styles.quickToolBox}>{glyph}</View>;
}

const styles = StyleSheet.create({
  quickToolBox: {
    width: SAVED_QUICK_TOOL_BOX,
    height: SAVED_QUICK_TOOL_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
