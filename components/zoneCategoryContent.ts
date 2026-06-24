// components/zoneCategoryContent.ts
//
// Per-category content adapter for ZoneDetailCard. Pure data: each
// recognized ZoneCategory maps to a title, a Phosphor glyph component,
// two copy strings (data source + how-it-affects-routes), and a flag
// for whether the card should show a "Manage in Zone Preferences →"
// footer link.
//
// Honesty-of-disclosure: only categories with a user-controllable
// toggle in usePreferences (lighting, police) set preferenceLink: true.
// The other categories (park, landuse, wildlife, road-condition) are
// always-on contributors to route scoring; their cards explain *why*
// they factor in without implying they can be toggled. Spec:
// docs/superpowers/specs/2026-06-01-zone-overlay-tap-info-design.md.

import type { ComponentType } from 'react';

import { Buildings } from 'phosphor-react-native/src/icons/Buildings';
import { Lightbulb } from 'phosphor-react-native/src/icons/Lightbulb';
import { PawPrint } from 'phosphor-react-native/src/icons/PawPrint';
import { Shield } from 'phosphor-react-native/src/icons/Shield';
import { Tree } from 'phosphor-react-native/src/icons/Tree';
import { Warning } from 'phosphor-react-native/src/icons/Warning';

import type { ZoneCategory, ZoneType } from '../lib/api/zones';
import { colors } from '../theme/colors';

type PhosphorIcon = ComponentType<{
  size?: number;
  color?: string;
  weight?: 'regular' | 'bold' | 'fill' | 'duotone' | 'thin' | 'light';
}>;

export type ZoneContent = {
  title: string;
  Glyph: PhosphorIcon;
  dataSource: string;
  affectsRoutes: string;
  /** Whether to render the "Manage in Zone Preferences →" footer link. */
  preferenceLink: boolean;
};

/**
 * Returns the card content for a given category, or null when the
 * category has no card (community-report — handled by ReportDetailCard
 * — or an unknown category from a future fixture).
 */
export function zoneCategoryContent(
  category: ZoneCategory | undefined,
  zoneType?: ZoneType,
): ZoneContent | null {
  switch (category) {
    case 'lighting':
      if (zoneType === 'safe') {
        return {
          title: 'Lit street',
          Glyph: Lightbulb,
          dataSource:
            'Streets here are tagged as well-lit in OpenStreetMap data (lit=yes or always-on).',
          affectsRoutes:
            'Fresh Greens favors lit corridors in its routing — this is a positive signal on your route.',
          preferenceLink: true,
        };
      }
      return {
        title: 'Low lighting',
        Glyph: Lightbulb,
        dataSource:
          'Streets here are tagged as below-average lighting in OpenStreetMap data.',
        affectsRoutes:
          'Fresh Greens routes around low-lit areas when Low-light areas is on in Zone Preferences.',
        preferenceLink: true,
      };
    case 'police':
      return {
        title: 'Police presence',
        Glyph: Shield,
        dataSource:
          'A police station, speed camera, or other police facility is mapped here in OpenStreetMap.',
        affectsRoutes:
          'Fresh Greens routes around police presence when Police presence is on in Zone Preferences.',
        preferenceLink: true,
      };
    case 'park':
      return {
        title: 'Park or green space',
        Glyph: Tree,
        dataSource: 'Mapped as a park in OpenStreetMap data.',
        affectsRoutes:
          'Fresh Greens factors green spaces into safety scoring — they generally read as safer during daylight.',
        preferenceLink: false,
      };
    case 'landuse':
      return {
        title: 'Commercial / residential area',
        Glyph: Buildings,
        dataSource: 'OpenStreetMap land-use tag.',
        affectsRoutes:
          'Fresh Greens factors land-use type into routing — commercial corridors typically have more pedestrians.',
        preferenceLink: false,
      };
    case 'wildlife':
      return {
        title: 'Wildlife crossing zone',
        Glyph: PawPrint,
        dataSource: 'Mapped as a wildlife corridor in OpenStreetMap data.',
        affectsRoutes:
          'Fresh Greens routes around wildlife zones during dawn and dusk when collision risk is highest.',
        preferenceLink: false,
      };
    case 'road-condition':
      return {
        title: 'Road condition zone',
        Glyph: Warning,
        dataSource:
          'Tagged in OpenStreetMap as having degraded surface condition.',
        affectsRoutes: 'Fresh Greens factors road condition into route scoring.',
        preferenceLink: false,
      };
    case 'community-report':
    default:
      return null;
  }
}

/**
 * Glyph color follows the zone's type signal — safe / caution / avoid
 * map onto the reserved-color rule (freshgreen / yellow / red).
 * Consistent across all categories; the type carries the severity
 * register, the category carries the role.
 */
export function glyphColorForZoneType(type: ZoneType): string {
  switch (type) {
    case 'safe':
      return colors.freshgreen;
    case 'caution':
      return colors.yellow;
    case 'avoid':
      return colors.red;
  }
}
