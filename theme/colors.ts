// Fresh Greens — color tokens
// Source of truth: Figma file 7DDh6c7tk7OKF4WiA7pEkp
// See ../.cursorrules ("Reserved-color rule") for usage rules and exceptions.
//
// Usage:
//   import { colors } from '../theme/colors';
//   <View style={{ backgroundColor: colors.freshgreen }} />

export const colors = {
  // Brand greens — use freely for UI
  freshgreen: '#41AD49',   // primary CTA, in-flow links
  wiltedgreen: '#326936',  // secondary CTAs, atmospheric headers
  burntgreen: '#003F04',   // deep accents (e.g. turn-card "Then" footer)
  fadedgreen: '#A0D6A4',   // supporting fills

  // Reserved — UI signals only. See .cursorrules for documented exceptions.
  orange: '#FF9500',       // hazard / speed limit / construction
  red: '#FF3B30',          // alert
  yellow: '#FFCC00',       // caution
  pink: '#FF2D55',         // role TBD — ask before use
  navy: '#041E49',         // safety affordances (en-route shield button, etc.)

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',

  // iOS system labels — semantic grays used for secondary/tertiary text,
  // icon tints, and placeholder copy. Tokenized here so screens don't
  // scatter raw rgba/hex values for the same semantic role.
  labelSecondary: '#3C3C43',
  labelTertiary: '#3D3D3D',
  mutedSecondary: 'rgba(60, 60, 67, 0.6)',
  mutedTertiary: 'rgba(80, 80, 80, 0.7)',

  // iOS system backgrounds
  systemGroupedBackground: '#F2F2F7',

  // Daylight gradient anchors — documented exception to the reserved-
  // color rule (orange used as functional daylight encoding, not as
  // signaling). Three-stop palette mirrored on /home's bottom-sheet
  // strip and on the route polyline in lib/daylight.ts so the legend
  // and the polyline agree by *shared name*, not just shared values.
  // See .cursorrules.
  daylightDawn: '#FFB347',
  daylightDusk: '#C4785A',
  daylightNight: '#2D1B69',

  // iOS system fills — neutral surface tints used for inactive controls,
  // tertiary input fields, and tag/chip backgrounds. Four-tier ramp
  // mirrors the iOS Fills system (Primary > Secondary > Tertiary >
  // Quaternary). `fillsTertiary` is the standard search-bar gray on a
  // flat (non-map) surface; `fillsPrimary` is the densest tag pill in
  // the browse-sheet (rating / category chips); `fillsSecondary` is
  // the slightly-lighter chip background; `fillsQuaternary` is the
  // weather card backdrop.
  fillsPrimary: 'rgba(120, 120, 128, 0.2)',
  fillsSecondary: 'rgba(120, 120, 128, 0.16)',
  fillsTertiary: 'rgba(120, 120, 128, 0.12)',
  fillsQuaternary: 'rgba(120, 120, 128, 0.08)',

  // Sign-out goodbye-line off-white. Figma-specified; distinct from
  // pure white so the parting copy reads as quietly secondary.
  signOutSubtitle: '#F5F5F5',

  // Edge-marker palette per Figma `1133:13250`. Darker, more
  // saturated than the brand orange/green — designed to read
  // crisply against busy map content at the small (36pt) edge-
  // marker size. Used only by `components/EdgeIndicator.tsx`; the
  // brand orange/green still cover everything else.
  slightlyDarkOrange: '#D34400',
  slightlyWiltedGreen: '#1F8122',

  // Borders + scrims + separators. Tokenized so the same semantic role
  // doesn't get re-derived as raw rgba per screen.
  modalScrim: 'rgba(0, 0, 0, 0.2)',          // dim layer behind /report popup
  cardBorderSubtle: 'rgba(0, 0, 0, 0.3)',    // input/card outlines
  separatorSubtle: 'rgba(0, 0, 0, 0.1)',     // hairline dividers on light bg
  separatorOnFlat: 'rgba(0, 0, 0, 0.08)',    // search bar outline on tap-state
  dividerOnDark: 'rgba(160, 214, 164, 0.25)',// hairline dividers on wiltedgreen
  dragHandleBar: 'rgba(128, 128, 128, 0.55)',// the gray bar atop modal sheets
  dividerNeutral: 'rgba(202, 196, 208, 1)',  // vertical/horizontal card dividers
} as const;

// Type helper: lets TypeScript autocomplete color names and catch typos.
// e.g. `color: ColorToken` will only accept 'freshgreen' | 'wiltedgreen' | ...
export type ColorToken = keyof typeof colors;
