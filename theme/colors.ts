// Fresh Greens — color tokens
// Source of truth: Figma file 7DDh6c7tk7OKF4WiA7pEkp
// See ../.cursorrules ("Reserved-color rule") for usage rules and exceptions.
//
// Usage:
//   import { colors } from '../theme/colors';
//   <View style={{ backgroundColor: colors.freshgreen }} />

export const colors = {
  // ── Brand greens ──────────────────────────────────────────────
  freshgreen: '#41AD49',   // primary CTA, in-flow links
  wiltedgreen: '#326936',  // secondary CTAs, atmospheric headers
  burntgreen: '#003F04',   // deep accents (e.g. turn-card "Then" footer)
  fadedgreen: '#A0D6A4',   // supporting fills

  // ── Reserved — UI signals only ────────────────────────────────
  // See .cursorrules for documented exceptions.
  orange: '#FF9500',       // hazard / speed limit / construction
  red: '#FF3B30',          // alert SIGNAL (icons, dots, banner fills, destructive labels, dark-surface error text). For readable error COPY on light surfaces use severityCritical — see .cursorrules carve-out #8.
  yellow: '#FFCC00',       // caution
  navy: '#041E49',         // safety affordances (en-route shield button, etc.)

  // ── Neutrals ──────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',

  // iOS system blue — the canonical MKUserLocation tint.
  systemBlue: '#007AFF',

  // iOS system green — verified/positive state badge in moderation.
  systemGreen: '#34C759',

  // ── Labels ────────────────────────────────────────────────────
  // Semantic grays for text, icon tints, and placeholder copy.
  labelSecondary: '#3C3C43',
  labelTertiary: '#3D3D3D',
  mutedSecondary: 'rgba(60, 60, 67, 0.6)',
  mutedTertiary: 'rgba(80, 80, 80, 0.7)',

  // ── Warm surface ramp ─────────────────────────────────────────
  // OKLCH-derived at ~0.008–0.012 chroma, hue 142° (brand-green
  // axis). Replaces iOS-default cool grays with warm paper tones
  // so brand markers pop and cards separate from backgrounds
  // without hard borders.
  //
  // Migration note: `systemGroupedBackground` retains its name for
  // backward compat but shifts from cool #F6F6FA to warm #F4F4ED.
  // New code should prefer the semantic `surface*` tokens.
  systemGroupedBackground: '#F4F4ED',

  surfacePage: '#F4F4ED',          // page background — warm paper
  surfaceCard: '#FEFDFB',          // card surface, distinct from page
  surfaceSheet: '#FAF9F4',         // bottom-sheet background
  surfaceElevated: '#FFFFFF',      // modals — max elevation = pure white
  surfaceTinted: '#ECF0E6',        // personality surfaces (profile card, greeting)
  surfaceInset: '#ECEAE3',         // inset areas, grouped sections on warm bg

  // ── Warm borders & dividers ───────────────────────────────────
  borderWarm: '#D5D2C9',           // standard border
  borderSubtle: '#E3E1D9',         // subtle separator / hairline

  // ── Daylight gradient ─────────────────────────────────────────
  daylightDawn: '#FFB347',
  daylightDusk: '#C4785A',
  daylightNight: '#2D1B69',

  // ── System fills ──────────────────────────────────────────────
  fillsPrimary: 'rgba(120, 120, 128, 0.2)',
  fillsSecondary: 'rgba(120, 120, 128, 0.16)',
  fillsTertiary: 'rgba(120, 120, 128, 0.12)',
  fillsQuaternary: 'rgba(120, 120, 128, 0.08)',

  signOutSubtitle: '#F5F5F5',

  // ── Edge-marker palette ───────────────────────────────────────
  slightlyDarkOrange: '#D34400',
  slightlyWiltedGreen: '#1F8122',

  // ── Borders + scrims + separators ─────────────────────────────
  modalScrim: 'rgba(0, 0, 0, 0.2)',
  modalScrimStrong: 'rgba(0, 0, 0, 0.4)',
  cardBorderSubtle: 'rgba(0, 0, 0, 0.3)',
  separatorSubtle: 'rgba(0, 0, 0, 0.1)',
  dividerOnDark: 'rgba(160, 214, 164, 0.25)',
  dragHandleBar: 'rgba(128, 128, 128, 0.55)',
  dividerNeutral: 'rgba(202, 196, 208, 1)',
  whiteFill12: 'rgba(255, 255, 255, 0.12)',
  whiteFill20: 'rgba(255, 255, 255, 0.2)',   // pill fill on dark map chrome (en-route offline pill)
  whiteSubdued70: 'rgba(255, 255, 255, 0.7)', // subdued white text on dark (emergency countdown unit)

  // ── Severity scale ────────────────────────────────────────────
  // Named safety-severity tokens for emotionally-charged UI:
  // recording waveforms, report chips, incident UI, trust signals.
  // Derived from the reserved palette but tuned for foreground +
  // background pairing at WCAG AA contrast.
  //
  // severityCritical doubles as the readable-error-COPY token on light
  // surfaces (~5.6:1 on white, passes AA — vs red's ~3.5:1 which fails).
  // See .cursorrules carve-out #8 for the error-copy-vs-signal split.
  severityCritical: '#C62828',
  severityCriticalBg: 'rgba(198, 40, 40, 0.08)',
  severityWarning: '#D97706',
  severityWarningBg: 'rgba(217, 119, 6, 0.08)',
  severityCaution: '#B8860B',
  severityCautionBg: 'rgba(184, 134, 11, 0.08)',
  severityPositive: '#2E7D32',
  severityPositiveBg: 'rgba(46, 125, 50, 0.08)',

  // ── Secondary accent (non-safety UI) ──────────────────────────
  // Warm teal for fuel, trips, search categories, empty-state
  // prompts — so green stays reserved for safety = good / go / trust.
  accent: '#247D7D',
  accentLight: '#E3F1F1',
  accentMuted: 'rgba(36, 125, 125, 0.12)',

  // ── Focus / active / pressed ──────────────────────────────────
  // Derived from brand green; use via interaction tokens, not raw.
  pressedGreen: '#369B3E',
  activeGreen: 'rgba(65, 173, 73, 0.12)',
  focusRing: 'rgba(65, 173, 73, 0.4)',

  // ── Report severity-chip fills ────────────────────────────────
  chipAvoidFill: 'rgba(255, 59, 48, 0.08)',
  chipCautionFill: 'rgba(255, 149, 0, 0.08)',
  chipVerifiedFill: 'rgba(52, 199, 89, 0.1)',
} as const;

// Type helper: lets TypeScript autocomplete color names and catch typos.
// e.g. `color: ColorToken` will only accept 'freshgreen' | 'wiltedgreen' | ...
export type ColorToken = keyof typeof colors;
