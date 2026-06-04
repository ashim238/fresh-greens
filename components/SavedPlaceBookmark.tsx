import QuickToolSaved from '../assets/illustrations/quick-tools-saved.svg';
import { colors } from '../theme/colors';

/** Figma bookmark aspect (14×19). */
const ASPECT = 19 / 14;

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
}: {
  size?: number;
  variant?: 'default' | 'selected';
}) {
  const height = size * ASPECT;
  const fill = variant === 'selected' ? colors.wiltedgreen : colors.black;

  return (
    <QuickToolSaved
      width={size}
      height={height}
      fill={fill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
