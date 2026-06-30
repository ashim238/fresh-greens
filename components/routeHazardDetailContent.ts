// Per-category copy for RouteHazardDetailCard (home route-preview hazard
// teardrop taps). OSM hazards only — community reports use ReportDetailCard.

import type { HazardCategory } from '../lib/scoring';

export type RouteHazardDetailContent = {
  title: string;
  dataSource: string;
  affectsRoutes: string;
  preferenceLink: boolean;
};

export function routeHazardDetailContent(
  category: HazardCategory,
  roadSubtype?: 'construction' | 'accident' | 'closure' | 'weather' | 'flooding',
): RouteHazardDetailContent {
  switch (category) {
    case 'lighting':
      return {
        title: 'Low lighting on this route',
        dataSource:
          'OpenStreetMap tags this stretch as below-average lighting.',
        affectsRoutes:
          'Your preview counted it toward the low-light chip when that signal is on in Zone Preferences.',
        preferenceLink: true,
      };
    case 'police':
      return {
        title: 'Police presence on this route',
        dataSource:
          'A police facility or enforcement point is mapped here in OpenStreetMap.',
        affectsRoutes:
          'Your preview counted it toward the police-zone chip when Police presence is on in Zone Preferences.',
        preferenceLink: true,
      };
    case 'wildlife':
      return {
        title: 'Wildlife zone on this route',
        dataSource: 'Mapped as a wildlife corridor in OpenStreetMap.',
        affectsRoutes:
          'Fresh Greens routes around wildlife zones when dawn and dusk risk is highest.',
        preferenceLink: false,
      };
    case 'road-condition':
      // Subtype-aware copy when Mapbox Incidents tagged the specific
      // kind of road event. Falls back to the generic OSM-surface
      // copy for both untyped Mapbox incidents and OSM tags (which
      // have no per-tag subtype). Chip-level UI stays generic on
      // purpose; specificity earns its keep at read-time, not glance.
      switch (roadSubtype) {
        case 'construction':
          return {
            title: 'Construction on this route',
            dataSource:
              'Mapbox traffic flagged active construction along this stretch.',
            affectsRoutes:
              'Fresh Greens treats construction zones as avoid-weighted in route scoring.',
            preferenceLink: false,
          };
        case 'accident':
          return {
            title: 'Accident reported on this route',
            dataSource:
              'Mapbox traffic flagged an accident or disabled vehicle along this stretch.',
            affectsRoutes:
              'Fresh Greens treats accident-flagged stretches as avoid-weighted while the report is active.',
            preferenceLink: false,
          };
        case 'closure':
          return {
            title: 'Road closure on this route',
            dataSource:
              'Mapbox traffic flagged a closed road or lane restriction along this stretch.',
            affectsRoutes:
              'Fresh Greens routes around full closures and weights lane restrictions toward alternates.',
            preferenceLink: false,
          };
        case 'weather':
          return {
            title: 'Weather affecting this route',
            dataSource:
              'Mapbox traffic flagged a weather-related impact along this stretch.',
            affectsRoutes:
              'Fresh Greens weights weather-flagged stretches based on the impact severity Mapbox reports.',
            preferenceLink: false,
          };
        case 'flooding':
          return {
            title: 'Flooding reported on this route',
            dataSource:
              'Mapbox traffic flagged flooding along this stretch.',
            affectsRoutes:
              'Fresh Greens treats flooded stretches as avoid-weighted while the report is active.',
            preferenceLink: false,
          };
        default:
          return {
            title: 'Road condition on this route',
            dataSource:
              'OpenStreetMap tags degraded surface condition along this stretch.',
            affectsRoutes: 'Fresh Greens factors road condition into your route score.',
            preferenceLink: false,
          };
      }
    case 'community-alert':
      return {
        title: 'Community alert on this route',
        dataSource: 'A community report sits near this point on your path.',
        affectsRoutes:
          'Your preview counted it toward the community-flag chip along this route.',
        preferenceLink: false,
      };
  }
}

export function formatRouteHazardLength(miles: number): string {
  if (miles < 0.05) {
    return 'At this point along your route';
  }
  if (miles < 10) return `${miles.toFixed(1)} mi. along your route`;
  return `${Math.round(miles)} mi. along your route`;
}
