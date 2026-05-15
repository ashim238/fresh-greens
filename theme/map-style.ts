// Fresh Greens — navigation-veteran basemap style.
//
// Google-style JSON consumed by `<MapView customMapStyle={mapStyle} />`
// on Android and `mapType="mutedStandard"` paired with this style on
// iOS (iOS's MapKit honors a subset, with `mutedStandard` handling
// the bulk of the dimming for us).
//
// Goal: read as a *navigation product*, not as Apple Maps' default
// "show me every business and POI." Apple Maps, Google Maps, and
// Waze all dim non-route POIs during active navigation; we apply
// the same treatment app-wide because Fresh Greens is always-in-
// navigation-mode by design (the app is a routing tool, not a
// general map browser).
//
// What gets hidden:
//   - Business POIs (other restaurants/shops compete with our own
//     curated/community pins for attention)
//   - Transit station icons (we don't surface transit data)
//   - Park-icon labels (we keep the polygon, drop the label)
//
// What stays visible:
//   - Road labels (driver needs to read street names)
//   - Road geometry + colors (the basemap's primary affordance)
//   - Water + landuse polygons (gives the map context)

export const mapStyle = [
  // Hide all POI icons + labels — restaurants, shops, attractions.
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.attraction',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.medical',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.school',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.place_of_worship',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.sports_complex',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.government',
    stylers: [{ visibility: 'off' }],
  },
  // Keep park polygons but drop their icon labels — the user wants
  // visual context, not "Acme Park" floating mid-frame.
  {
    featureType: 'poi.park',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text',
    stylers: [{ visibility: 'simplified' }],
  },
  // Transit stations clutter the dense urban grids we expect to
  // operate in (Mobile, AL downtown demo region). Hide both the
  // station icon and the label.
  {
    featureType: 'transit.station',
    stylers: [{ visibility: 'off' }],
  },
  // Slightly dim residential-road labels so arterial roads pop more.
  // This is the move that most separates "navigation app" from
  // "drag the map around" Google Maps default.
  {
    featureType: 'road.local',
    elementType: 'labels',
    stylers: [{ visibility: 'simplified' }, { lightness: 25 }],
  },
];
