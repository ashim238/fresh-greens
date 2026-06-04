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
      return {
        title: 'Road condition on this route',
        dataSource:
          'OpenStreetMap tags degraded surface condition along this stretch.',
        affectsRoutes: 'Fresh Greens factors road condition into your route score.',
        preferenceLink: false,
      };
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
