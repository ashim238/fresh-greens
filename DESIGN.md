---
name: Fresh Greens
description: Calm, auditable wayfinding for Black drivers — safety through composure, not alarm.
colors:
  freshgreen: "#41AD49"
  wiltedgreen: "#326936"
  burntgreen: "#003F04"
  fadedgreen: "#A0D6A4"
  signal-orange: "#FF9500"
  signal-red: "#FF3B30"
  signal-yellow: "#FFCC00"
  signal-pink: "#FF2D55"
  safety-navy: "#041E49"
  white: "#FFFFFF"
  black: "#000000"
  label-secondary: "#3C3C43"
  grouped-background: "#F6F6FA"
  daylight-dawn: "#FFB347"
  daylight-dusk: "#C4785A"
  daylight-night: "#2D1B69"
typography:
  display:
    fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "41px"
    letterSpacing: "0.4px"
  headline:
    fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "34px"
    letterSpacing: "0.38px"
  title:
    fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: "28px"
    letterSpacing: "-0.26px"
  body:
    fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "-0.43px"
  label:
    fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "-0.08px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.freshgreen}"
    textColor: "{colors.white}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.wiltedgreen}"
    textColor: "{colors.white}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0px 16px"
    height: "44px"
  button-primary-outline:
    backgroundColor: "transparent"
    textColor: "{colors.freshgreen}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0px 16px"
    height: "44px"
  search-bar:
    backgroundColor: "{colors.white}"
    textColor: "{colors.label-secondary}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0px 16px"
    height: "56px"
  fab:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.pill}"
    height: "56px"
    width: "56px"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Fresh Greens

## 1. Overview

**Creative North Star: "The Steady Companion"**

Fresh Greens rides shotgun. It is the calm voice beside the driver, not the dashboard barking orders — a tool used in both a quiet planning moment at home and a charged one on the roadside, and it has to stay legible and reassuring in both. Every surface is built so that safety is communicated through composure: generous space, a muted earthy-green palette, soft and intentional motion. The interface earns trust by showing its work — the "Along this route:" briefing, the all-clear chip, the daylight strip — never by asserting authority. Underneath the calm sits the warmth the thesis rests on: this was built by and for a community, and the Green Book lineage is felt, not stated.

The system is HIG-native by conviction, not convenience. It speaks iOS — the grouped-settings register, the system typeface, 44pt tap targets painted on the visual — so that the safety content, not the chrome, is what the user notices. Color is rationed: brand greens carry the entire interactive surface, and a small reserved palette (red, orange, yellow, navy) is held back for moments that carry real safety meaning. That rationing is the whole game. A red dot means something here precisely because red appears nowhere else.

This system explicitly rejects four neighbors. It is **not** generic ride-share / SaaS (glossy dark-mode maps, neon route lines, aggressive conversion CTAs). It is **not** alarmist safety-app red (red everywhere, siren energy, fear as the primary emotion). It is **not** over-designed AI slop (gradient text, glassmorphism, eyebrow labels, identical card grids). And it is **not** sterile / clinical (cold enterprise-dashboard or medical-device coldness that loses the person, and the history, behind the route).

**Key Characteristics:**
- Calm, grounded, earthy — composure as the primary safety signal.
- Reserved-color discipline: greens for UI, signals for meaning, never decoration.
- iOS HIG-native: system typeface, grouped surfaces, 44pt painted tap targets.
- Token-driven: every value pulled from `theme/`, never inlined.
- Auditable by design: the UI surfaces *why*, it doesn't just assert.

## 2. Colors

A muted, earthy green family carries the entire interactive surface; a sharp reserved palette sits in reserve for safety meaning, and three warm-to-cool anchors encode daylight.

### Primary
- **Fresh Green** (#41AD49): The brand's voice. Primary CTAs and in-flow links. On white surfaces it is paired with a 1pt Wilted Green border — Fresh Green alone is 2.88:1 against white (below the 3:1 WCAG floor for UI component boundaries); the border lifts the button-to-page edge into the 6.54:1 range without sacrificing brand vibrance.

### Secondary
- **Wilted Green** (#326936): Secondary CTAs, atmospheric full-bleed headers, and the contrast-safe border on primary buttons. The quieter, deeper voice.

### Tertiary
- **Burnt Green** (#003F04): Deep accents — the turn-card "Then" footer, the selected-state card fill. Near-black with a green soul.
- **Faded Sage** (#A0D6A4): Supporting fills and tints where Fresh Green would shout.

### Reserved Signals (a separate vocabulary, not decoration)
- **Signal Orange** (#FF9500): Hazard, speed limit, construction.
- **Signal Red** (#FF3B30): Alert. The rarest color in the system.
- **Signal Yellow** (#FFCC00): Caution.
- **Signal Pink** (#FF2D55): Role TBD — ask before use.
- **Safety Navy** (#041E49): Safety affordances (the en-route shield button, lifeline surfaces).

### Neutral
- **White** (#FFFFFF): Card and chrome surfaces floating over the map.
- **Grouped Background** (#F6F6FA): The app-wide light-gray page background — a cool near-white that lets white cards stay distinct by their shadows alone.
- **Label Secondary / Tertiary** (#3C3C43, rgba(60,60,67,0.6)): iOS-semantic grays for secondary text, icon tints, placeholders. Tokenized so the same role is never re-derived as a raw rgba per screen.

### Functional — Daylight Anchors
- **Daylight Dawn → Dusk → Night** (#FFB347 → #C4785A → #2D1B69): A documented exception to the reserved-color rule. Orange here is *functional encoding* (time-of-day along the route), not a hazard signal. The same three names drive both the bottom-sheet legend and the route polyline so they agree by shared token, not coincidence.

### Named Rules
**The Reserved-Color Rule.** Red, orange, yellow, pink, and navy appear *only* where they carry safety meaning. In-flow CTAs and links stay Fresh Green / Wilted Green. This separation is load-bearing: it is what lets a single red dot or orange chip actually mean something. (Full rule + its documented carve-outs live in `.cursorrules`.)

**The One-Voice Rule.** The greens carry the interactive surface; the signals never decorate it. If a color is doing mood instead of meaning, it is the wrong color.

## 3. Typography

**Display / Body / Label Font:** System (San Francisco) — `-apple-system, 'SF Pro Text/Display', system-ui`. One typeface, the platform's own, across every register.

**Character:** No display face, no pairing, no flourish. The hierarchy is built entirely from the iOS HIG type ramp — scale, weight, and a deliberate Regular/Emphasized split. Restraint is the personality: the type should read as native iOS, so the safety content is the thing the user notices, not the lettering.

### Hierarchy
- **Large Title — Emphasized** (700, 34/41, +0.4 tracking): The largest heading register; full-screen moments.
- **SOS Countdown** (800, 40/44, +1 tracking): A single focal numeral inside the /emergency countdown disc. The one place type goes above heading scale, because it *is* the screen.
- **Headline / Title 1** (700, 28/34): Primary screen titles. Its **Regular** twin (400, 28/34) is the in-modal user-prompt register — same size, lighter weight, so the modal reads as a held question rather than a command.
- **Title 2 / Title 3** (22/28, 20/25): Section headers and card titles.
- **Body** (400, 17/22, −0.43 tracking): The reading register, and the app-wide CTA label weight (Emphasized 600). Matches Settings.app's primary-action buttons.
- **Subheadline / Footnote** (15/20, 13/18): Secondary copy, chip labels, metadata.
- **Caption 1** (12/16): The smallest *informational* register.

### Named Rules
**The Held-Question Rule.** When a surface asks the user something at a charged moment, set the prompt in Title 1 **Regular**, not Emphasized. Bold reads as a directive; regular weight reads as a held question. Reserve bold for guidance the user should follow, not for questions you're posing them.

**The 12pt Floor Rule.** Caption 2 (11pt) sits below WCAG 1.4.4's floor for informational content and is reserved for ornament only — legal fine print, timestamps, copyright lines. Anything a reader could miss and lose meaning from uses Caption 1 (12pt) or larger.

**The Relaxed-Read Rule.** Stress-state long reads (the /pulled-over guidance bullets) bump line-height to 1.6× via `relaxedLineHeight()`, above the native 1.29× body ratio — wider leading reduces line-tracking errors when the reader is under load.

## 4. Elevation

Shadows are functional, not decorative: a surface's shadow encodes how far it floats above the map. The system is a three-tier ramp (plus two special cases), consolidated into `theme/shadows.ts` so elevation reads as systematic rather than hand-tuned per component. Surfaces that aren't lifting off the basemap stay flat.

### Shadow Vocabulary
- **e1 — chrome over map** (`0 1px 3px rgba(0,0,0,0.15)`, Android elevation 2): The lightest lift. FAB stack, ETA pill, search bar, button fills.
- **e2 — content over map** (`0 2px 4px rgba(0,0,0,0.18)`, elevation 3): The workhorse. Bottom sheets, recommendation cards, floating action buttons.
- **e3 — markers and pins** (`0 2px 4px rgba(0,0,0,0.25)`, elevation 4): Strongest, so pins read against busy map content.
- **dot** (`0 1px 2px rgba(0,0,0,0.25)`, elevation 2): A tighter-radius variant for tiny circular markers (the user-location dot) where e3 would overwhelm a 24pt circle.
- **sheet** (`0 -4px 8px rgba(0,0,0,0.15)`, elevation 8): Directional — points *up*, because the bottom sheet rises out of the bottom edge.

### Named Rules
**The Height-Over-Map Rule.** Elevation is literal: pick the tier by how far the surface sits above the basemap (chrome → content → markers), not by how important it feels. Flat surfaces stay flat; a shadow is a claim about height.

## 5. Components

Components are HIG-native and consolidated — one `Button`, one `SearchBar`, one `FloatingActionButton`, replacing styles that were once duplicated per screen. The feel is calm and confident: capsule geometry, generous tap targets, the universal 0.7 press-dim as the single feedback gesture.

### Buttons
- **Shape:** Full capsule (pill, 999px radius), 44pt tall, 16pt horizontal padding, 24pt icon + 8pt gap.
- **Primary:** Fresh Green fill, white label, e1 shadow, 1pt Wilted Green border (the contrast lift).
- **Secondary:** Wilted Green fill, white label, e1 shadow.
- **Outline:** 1pt brand-color border, brand-color label, no fill.
- **Transparent:** Label only, underlined (the link affordance), white text — for dark/colored surfaces *only*; invisible on white.
- **States:** Pressed and disabled both apply `pressedDim` (0.7 opacity). Loading swaps the label for an `ActivityIndicator` and implies disabled.

### Search Bar
- **Shape:** White pill (default) with e2 shadow, 56pt tall, floating over the map. Search glyph left, mic right.
- **States:** `default` (white, shadowed, tappable → routes to /search) · `on-tap` / `typing` (translucent `fillsTertiary` gray, no shadow, back-chevron persists so the user can always abandon a query).

### Floating Action Button
- **Shape:** White circle, e2 shadow. Two sizes: 56pt (en-route side column, 32pt glyph) · 48pt (home top-row overlays, 24pt glyph). Icon-agnostic; pairs `accessibilityLabel` with an optional `accessibilityHint`.

### State Cards
- **EmptyState / LoadingState / ErrorState:** One rounded shape (16px radius, 32pt padding, centered). Empty = translucent gray + border; Loading/Error = no fill (parent shows through). Copy carries personality ("Charting course…"), not "Nothing here."

### Chips
- **Style:** Translucent neutral fills (the four-tier `fills` ramp) for rating/category/tag pills; reserved-signal fills *only* on route-warning chips where the color means hazard.

### Drag Handle
- A 32×4 pill in translucent gray, centered atop every bottom sheet. The one universal "this surface moves" affordance.

### Signature Patterns
- **The bottom-sheet system** (browse, route-comparison, fuel-stops, live-safety): the primary content vehicle, rising over a persistent map with the directional `sheet` shadow.
- **The en-route side column:** a vertical stack of 56pt FABs (Volume, SOS, Shield, Recenter, Report) — thumb-reachable safety controls during the drive.

## 6. Do's and Don'ts

### Do:
- **Do** pull every value from `theme/` — `colors`, `typography`, `shadows`, `spacing` (4pt ramp), `radii`. Never inline a design value.
- **Do** keep interactive surfaces Fresh Green / Wilted Green. Reserved colors only where they carry safety meaning.
- **Do** paint 44×44pt tap targets on the *visual* (use the `tapTarget44` token). `hitSlop` is forgiveness on top of compliance, never the compliance mechanism.
- **Do** set charged-moment prompts in Title 1 **Regular** — the held question, not the command (The Held-Question Rule).
- **Do** pair the daylight gradient with a redundant non-color cue (dash/width pattern + inline legend). Color alone fails WCAG 1.4.1 for colorblind drivers — this is a known, tracked gap.
- **Do** wrap long-read copy in `dynamicType()` so Dynamic Type scales the line box, not just the glyphs.

### Don't:
- **Don't** drift toward **generic ride-share / SaaS**: no glossy dark-mode maps, neon route lines, or aggressive conversion CTAs.
- **Don't** drift toward **alarmist safety-app red**: no red everywhere, no siren energy, no fear as the primary emotion. Red is a reserved *signal*, never an ambient mood.
- **Don't** drift toward **over-designed AI slop**: no gradient text, no glassmorphism, no eyebrow labels on every section, no identical card grids, no decoration that carries no meaning.
- **Don't** drift toward **sterile / clinical**: no cold enterprise-dashboard or medical-device feel. Keep the community warmth and the person behind the route.
- **Don't** use `border-left`/`border-right` greater than 1px as a colored accent stripe on cards or callouts. Full borders, background tints, or nothing.
- **Don't** ship the Transparent button variant on a white surface — its white label is invisible there.
- **Don't** use Caption 2 (11pt) for anything a reader could miss and lose meaning from.
