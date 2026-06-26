# Product

## Register

product

## Users

Black drivers and solo travelers planning routes where safety, visibility, and community knowledge matter as much as speed. The app is used before and during a drive — sometimes in a calm planning moment at home, sometimes in a charged one (a traffic stop, an unfamiliar area, a late-night route). The user is not a power user optimizing for efficiency; they are someone deciding whether a route *feels* safe enough to take. Context spans both states, so the interface has to stay legible and reassuring in the calm case without becoming alarmist in the charged one.

## Product Purpose

Fresh Greens is a wayfinding tool inspired by the history of Black travel in America (the Green Book lineage) and driven by the lived Black experience of today. It builds routes that limit exposure to external hazards and maximize daylight, treating community-submitted observations as a first-class routing signal alongside public data (OpenStreetMap, OSRM, SunCalc). Success is a user trusting the route the app recommends — and trusting it *because* the reasoning is visible and auditable, not because a black-box algorithm said so. It is a graduate thesis: a working argument about whose safety knowledge counts, not a shipped commercial product.

## Brand Personality

**Calm, trustworthy, grounded.** A steady companion, not a panic button. Safety is communicated through composure — generous space, a muted-green earthy palette, soft and intentional motion — never through urgency or alarm. The voice is plain and human ("Talk to us. What's going on?" / "You're not alone."), reserving bold weight for guidance and regular weight for moments that should feel like a held question rather than a command. Underneath the calm sits the community-and-heritage warmth the thesis rests on: this was built by and for a community, and the Green Book lineage is felt, not stated.

## Anti-references

The design must NOT drift toward any of these:

- **Generic ride-share / SaaS** — glossy dark-mode maps, neon route lines, aggressive conversion CTAs, the "transportation startup" aesthetic. Too corporate for a community safety tool.
- **Alarmist safety-app red** — panic-button apps that scream danger: red everywhere, siren energy, fear as the primary emotion. Directly undercuts calm-confidence. (Red is strictly a reserved *signal* here, never an ambient mood.)
- **Over-designed AI slop** — gradient text, glassmorphism, eyebrow labels on every section, identical card grids, decoration that carries no meaning. The "AI made this" tells.
- **Sterile / clinical** — cold enterprise-dashboard or medical-device feel; all function, no humanity. Loses the community warmth and the person (and history) behind the route.

## Design Principles

1. **Every safety decision traces to auditable data, and the UI shows its work.** The interface surfaces *why* a route scored as it did (the "Along this route:" briefing, the all-clear chip, the daylight strip). Trust comes from visible reasoning, not authority. Design choices that hide the reasoning fail the thesis.
2. **Safety through calm, not alarm.** Reserved colors (red / orange / yellow / navy) are signals with specific meanings, never ambient decoration. A reframe ("Along this route:" turns warning chips into a briefing) beats raising the alarm. The charged moment deserves composure.
3. **Reserved-color discipline is load-bearing.** The signaling palette only appears where it carries safety meaning; in-flow CTAs and links stay freshgreen/wiltedgreen. This separation is what lets a red dot or an orange chip actually mean something. (See `.cursorrules` for the full rule + its documented carve-outs.)
4. **Honesty of disclosure.** UI state must reflect real underlying capability — no affordance for a state the system can't deliver, no claim the code doesn't back. (The connect-calendar feature is read-only because it says it is; scaffolded surfaces are named, not hidden.)
5. **HIG-native, token-driven craft.** 44pt tap targets on the visual (not papered over with hitSlop), values pulled from `theme/` never inlined, the iOS grouped-settings register where iOS conventions earn it. Match the platform so the safety content, not the chrome, is what the user notices.

## Accessibility & Inclusion

WCAG 2.1 AA is the target. The app already invests in Dynamic Type (`dynamicType()` wrapper), VoiceOver labels + hints, 44pt tap targets, and Reduce Motion gating in several places. Known gaps tracked for this work: (1) **WCAG 1.4.1 report severity-chip color-only signaling** — the report sub-tag chips encode avoid/caution severity via a red/orange border + 8% fill only, with no non-color cue; needs a subtle non-color channel (e.g. a small flagged-severity glyph), without resurrecting an alarmist explicit severity label. *(The earlier daylight-gradient color-only gap is **resolved**: the polyline now carries `DAYLIGHT_DASH_PATTERN` solid/dashed/dotted bands from `lib/daylight.ts` plus the `DaylightRouteLegend` dash-mark legend — verified 2026-06-26.)* (2) Broader Dynamic Type coverage and AX5 truncation testing. (3) Reduce Motion gating on the home browse carousel snap. Accessibility is treated as a thesis strength to foreground, not a checkbox — it maps directly to "whose needs the design accounts for."
