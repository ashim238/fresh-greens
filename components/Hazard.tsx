import { Eye } from 'phosphor-react-native/src/icons/Eye';
import { Lightbulb } from 'phosphor-react-native/src/icons/Lightbulb';
import { PawPrint } from 'phosphor-react-native/src/icons/PawPrint';
import { Warning } from 'phosphor-react-native/src/icons/Warning';

import type { HazardCategory } from '../lib/scoring';
import { colors } from '../theme/colors';

/**
 * Hazard glyph — 4 variants matching Figma `1133:13397`. Surfaces on
 * /en-route's turn card to communicate "this turn is on your safe
 * route, but be aware" without breaking the route recommendation
 * itself. See `hazardsNearTurn` in `lib/scoring.ts` for the trigger.
 *
 * Phosphor stand-ins for v1; canonical custom SVGs queued under
 * CLAUDE.md's bulk-SVG export item. Yellow tint matches Figma's
 * "caution" register — distinct from the orange Report-button alert.
 */
export function Hazard({
  category,
  size = 24,
  color = colors.yellow,
}: {
  category: HazardCategory;
  size?: number;
  color?: string;
}) {
  switch (category) {
    case 'lighting':
      return <Lightbulb size={size} color={color} weight="duotone" />;
    case 'road-condition':
      return <Warning size={size} color={color} weight="duotone" />;
    case 'wildlife':
      return <PawPrint size={size} color={color} weight="duotone" />;
    case 'community-alert':
      return <Eye size={size} color={color} weight="duotone" />;
  }
}
