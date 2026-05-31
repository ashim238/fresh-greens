# Fresh Greens — Portfolio-Ready (v2) Design Spec

**Date:** 2026-05-30
**Status:** Approved scope, pending spec review → implementation planning
**Topic:** What the *product itself* needs to be portfolio-ready.

---

## Goal

Take Fresh Greens from "coherent thesis app with documented scaffolding" to a **v2 product that survives App Store review and photographs strongly for a design-portfolio case study** — by removing every visible dead-end, making the placeholder surfaces genuinely real, clearing Apple's compliance gates, completing the v2 visual vision, and shipping a full accessibility pass.

## Targets (what each demands)

1. **App Store submission** — the highest *functional* bar. Apple rejects placeholder / "coming soon" features and inert controls (Guideline 2.1), and requires a privacy policy, accurate App Privacy disclosure, specific permission purpose strings, and in-app account deletion (5.1.1(v)). No crashes.
2. **Design-portfolio case study** — rewards *visible* craft: v2 fidelity on every screen, finished hero illustrations, a coherent icon system, and a few signature stories (the cloud-aware daylight gradient, color-independent route encoding, AX5 reflow on the safety flow, the adapter-pattern backend swap-in).

The two overlap heavily: removing scaffolding and finishing visuals serves both.

## Scope tier

**v2 / Real-product tier, minus the real backend.** Estimated **~2–3 months of effort** (effort, not calendar). Selected via brainstorming: the user pulled the full v2 UI vision, Round 4 discovery, and full-AX5 accessibility *in*, and left a real backend *out*.

### Decision: data stays local-only (intentional, documented)

Community reports, the user object, trusted contact, recordings, and preferences remain device-local AsyncStorage. Consequences and mitigations:

- "Community" is single-device in v1 — reports don't sync across phones, `submittedBy` stays `mock-user`. **Honest copy** frames reports as "on this device," not a live network.
- This is consistent with the chosen targets (App Store + case study). It costs some of the *funding* narrative, which the user explicitly did not prioritize.
- **The adapter pattern (`lib/api/*`) was deliberately designed so a backend swaps in by replacing adapter internals without touching any consumer.** This is captured as a designed seam, not a gap — and it is a case-study talking point. The public surfaces (`addCommunityReport`, `getCommunityReportsAsZones`, `lib/api/user.ts`, etc.) and the `User`/`Zone` types stay stable.

Account deletion is therefore primarily a **local** wipe (clear all AsyncStorage namespaces). One caveat to resolve in compliance: Apple's Sign in with Apple *token revocation* (`/auth/revoke`) requires a server-signed client secret, which a no-backend app can't produce client-side (see Risks). The likely resolutions are (a) a single serverless revocation function — the one server-side concession — or (b) demonstrating that no Apple tokens are persisted beyond initial auth, so local deletion suffices. To be confirmed before submission.

---

## Workstream 1 — Scaffolding triage (the honesty pass)

Every surface that currently looks real but isn't, with its final disposition. `CUT` = remove; `HIDE` = remove from this v1 surface, keep the code path for later; `WIRE` = make genuinely functional; `KEEP` = leave but correct framing.

| # | Surface | Disposition | Notes |
|---|---------|-------------|-------|
| 1 | Get Started / Login — "Continue with Google / Email" (visual-only) | **HIDE** → Apple-only | Removes fake-auth dead-ends; Apple-only is fully compliant and simplifies account deletion. |
| 2 | /menu inert rows: Settings, Schedule a drive, Theme | **CUT** | Dimmed no-op rows read "unfinished." Keep only the real rows (Zone Settings, Safety). |
| 3 | /menu Quick Tiles (Fuel, Notifications — tap no-ops) | **WIRE** | Fuel → /search fuel section; Notifications → a real notifications preference toggle. Fallback if either is awkward: cut that tile. |
| 4 | /menu profile row (0.5 opacity, no tap) | **KEEP, full opacity** | Render as a static identity header (no chevron) so it reads as info, not a disabled button. |
| 5 | /safety inert tiles: Roadside, Unfamiliar area, Share my location | **WIRE all 3** (scoped) | See Workstream 2 for the scoped-real definitions. |
| 6 | /report photo button (Alert stub) | **WIRE** | Real capture via `expo-image-picker` / `expo-camera`. Adds camera/photo permission → Workstream 3. |
| 7 | "Coming soon" Alerts (report photo, Schedule) | **REMOVE all** | A "coming soon" modal is the clearest single Apple-reject signal. Zero may remain. |
| 8 | /search Trending tile (→ "Soon" alert) | **CUT** | Needs data we don't have. |
| 9 | /search tile-deselect bug (query lingers) | **FIX** | Deselecting a category tile should clear the associated query. |
| 10 | Zone-flag toggles (#44 — persist but change nothing) | **WIRE** | Read flags in `lib/scoring.ts` to gate each factor; gate zone rendering on /home + /en-route. A control that claims to change behavior but doesn't is the worst scaffolding and undercuts the thesis. |
| 11 | /en-route turn-by-turn (static placeholder copy) | **WIRE** | OSRM `steps=true` → real maneuver list. See Workstream 2. |
| 12 | Reports submit as `mock-user`, device-local | **KEEP** + honest copy | Local reporting works end-to-end on-device; legitimate v1 given the local-only decision. |

**Definition of done for this workstream:** a full tap-through of the app surfaces zero inert controls, zero "coming soon" alerts, and no dimmed-disabled affordances presented as tappable.

---

## Workstream 2 — Feature wiring ("make it real")

### 2.1 Zone-factor toggles → scoring + map (#44)
Read `flagPolice` / `flagLowLight` / `flagCommunityReports` (already persisted by `usePreferences`) inside `lib/scoring.ts` to include/exclude each factor from the route score, and gate the corresponding zone rendering on /home and /en-route. The toggles already exist in /menu; this makes them mean something.

### 2.2 Turn-by-turn (OSRM `steps=true`)
Request `steps=true` from OSRM; parse the maneuver list into a typed `TurnStep[]` (instruction text, maneuver type, distance-to-next). Render real instructions on the /en-route turn card, advancing as the user progresses. The turn-maneuver glyph should reflect the maneuver type (ties into the Workstream 5 glyph sweep). Fallback to the current static copy only if OSRM omits steps for a given route. Watch: OSRM public-demo rate limits.

### 2.3 Report photo capture
Replace the Alert stub with `expo-image-picker` (camera + library). Persist the image alongside the report (local file, same pattern as recordings). Surface the thumbnail in `ReportDetailCard`. Adds a camera/photo permission (Workstream 3).

### 2.4 /safety tiles — scoped-real definitions
All three reuse **existing adapters** to stay bounded:
- **Share my location** *(S)* — tap shares a maps link (`maps.apple.com/?ll=<lat>,<lng>`) to the trusted contact via `Linking` SMS / the share sheet. Reuses `useTrustedContact`.
- **Roadside assistance** *(M)* — a sheet with (a) one-tap call to a roadside number (user-set, or a sensible national default) via `tel:`, and (b) a short list of nearby gas/service pulled from the **existing POI search adapter**.
- **Unfamiliar area** *(M)* — a "what's around you right now" safety snapshot for the current location: lighting, police, parks, and recent community reports, built from **`lib/api/zones.ts`** (the same data that powers the map). This turns the data layer into a glanceable safety read — the most on-thesis of the three.

### 2.5 /menu Quick Tiles
Fuel → navigate to /search fuel section. Notifications → toggle a real notification preference (reuse the departure-notification permission path).

---

## Workstream 3 — App Store compliance & legal

### Hard gates (must clear)
- **Privacy policy** — hosted URL, linked in App Store Connect and in-app. Emphasize the on-device, "not collected" posture honestly.
- **App Privacy nutrition label** — declare location (precise, when-in-use), contacts, mic/audio, photos, Apple identity. Most marked *"not collected"* (never leaves device); the disclosure must match reality exactly.
- **Permission purpose strings** (`app.json` → `infoPlist`) — specific, honest strings for: location-when-in-use, microphone, contacts, **camera + photo library** (new, for 2.3). No generic strings.
- **In-app account deletion** (5.1.1(v)) — a "Delete my account & data" destructive action in /menu that wipes user + trusted contact + recordings + reports + preferences. Reuses the per-namespace clears already used by sign-out. Apple-token revocation is a flagged open item (see the local-only decision note + Risks).
- **Apple-only sign-in** — keep only Sign in with Apple (Workstream 1, row 1). Compliant and simplest.
- **Stability pass** — device crash hunt across all flows. Apple rejects on any crash.
- **Review notes** — explain the Apple Sign In path and how to exercise the safety flow (trusted-contact setup) for the reviewer.

### Legal items (baked in, not optional)
- **SOS glyph swap** — replace the red medical cross (protected Red Cross emblem — Geneva Conventions + trademark) with a non-cross emergency symbol (leaning filled "SOS" or a warning triangle), keeping the red treatment and press-and-hold behavior.
- **Legal-advice disclaimer** — the pulled-over guidance + state gun-law disclosure carry an "informational, not legal advice; laws change; verify locally" notice. Verify ACLU-sourced copy is attributed or paraphrased (not reproduced verbatim beyond fair use).
- **911 disclaimer** — the SOS/911 affordance states "not a substitute for calling 911 directly; depends on device & network"; the dial path is an honest `tel:911` with no implied auto-dialing.
- **Data attribution** — an acknowledgements screen crediting OpenStreetMap (© OpenStreetMap contributors, ODbL), OSRM, and Open-Meteo per their licenses.

---

## Workstream 4 — Accessibility (full pass)

1. **VoiceOver correctness** — fix logged nits (Saved-row period→comma; missing `accessibilityHint`s on Saved rows + en-route Shield FAB; /safety-settings SOS row prompt) and add missing `accessibilityRole`s (map markers, cluster, placement pin, recommendations carousel as `list`). Add the distinct **SOS warning haptic** (`notificationAsync(Warning)` rather than the generic selection tap).
2. **Reduce Motion** — gate the home carousel `snapToInterval`/`decelerationRate` on `useReduceMotion()`; audit Welcome cloud-drift and `LayoutAnimation` calls for parity.
3. **Color-independence (WCAG 1.4.1)** — the daylight gradient must not encode day/twilight/night by color alone. Add a non-color cue along the polyline (`lineDashPattern`: solid = day, dashed = twilight, dotted = night) **and** an inline legend/label. Apply the same to the bottom-sheet daylight strip. (Highest case-study value in this workstream.)
4. **Dynamic Type — full AX5 everywhere** — broaden `dynamicType()` usage and reflow *every* screen cleanly at the maximum accessibility size (not just the safety flow). Add `numberOfLines`/truncation where overflow is unavoidable. This is the largest line-item; the dense map/browse screens (route card, carousels, menu tiles, bottom sheets) each need per-breakpoint reflow + device testing.

---

## Workstream 5 — Visual & v2 fidelity

**Gated on user-provided Figma SVG exports** for bundles 5.1 and 5.2.

1. **Hero Review illustrations** — replace the 120pt Ionicons stand-ins for What to Do / Have / Say / Know with real illustrations (same treatment Officer/Trooper received).
2. **Ionicons → custom-glyph sweep** — /en-route side buttons (Volume, Help, Recenter), the turn-maneuver arrow (now meaningful with real steps), /pulled-over Call/Text buttons, the turn-card mic.
3. **v2 bottom-sheet redesigns** *(committed, not stretch)* —
   - **/home** (Figma `1133:13690`): destination-with-caption header, weather + driving-conditions card, "Things to Do" recommendation section, photo + quote callout + tag rows. Feasible now that the weather adapter (Open-Meteo) and recommendations exist.
   - **/en-route** (Figma `1133:13328` / `:13329`): the v2 collapsed + full states (34pt ETA badge in freshgreen, bracketing FABs).
4. **Round 4 — multi-row recommendations** — restructure `HomeBrowseSheet` from single-carousel into a vertical stack of themed horizontal carousels. Build **Row 1 ("Trusted by your community")** first — the differentiator — then the "Open now" row and the five per-category rows. Chips become a quick-filter focus mode. Needs a `useRecommendationsBatch()` parallel-fetch hook (shared cache) and the **custom community-signal SVG** (64pt empty-state + 24pt section-header variants, burntgreen single-color). Watch: data-load cost, empty-state proliferation, total sheet scroll height.
5. **v2 fidelity on triage-touched screens** — /safety, /report, /menu reach their v2 Figma state in the same PRs that wire them (Workstreams 1–2).
6. **Copy/polish nits** — Trusted Contact Footer capitalization; the raw-`gap`→`spacing.*` token sweep.

---

## Phasing (Approach A: decision → blocker → polish)

Ordered so the riskiest external gate (Apple review) de-risks early and nothing is polished before it is final. Phases overlap where dependencies allow.

> **Implementation decomposition:** this spec is an umbrella covering ~2–3 months of work — too large for a single implementation plan. Each phase below becomes **its own `writing-plans` plan**, planned and executed in sequence (one phase's outcome informs the next). The first plan to write is Phase 0.

- **Phase 0 — Honesty pass** *(fast, mostly deletions)*: Workstream 1's CUT/HIDE/FIX rows. After this, zero visible dead-ends.
- **Phase 1 — Feature wiring**: Workstream 2 (all "make-it-real" features), each screen brought to v2 fidelity as it is opened. Done before a11y/visual because those can't precede final screens, and because this locks the final permission set.
- **Phase 2 — Compliance gate**: feature-*independent* items (privacy policy, account deletion, SOS swap, disclaimers, attribution) start during Phase 0/1; feature-*dependent* items (permission strings + App Privacy label) finalize after Phase 1.
- **Phase 3 — Accessibility (full)**: Workstream 4, run on now-final screens.
- **Phase 4 — Visual & v2** *(gated on Figma exports)*: Workstream 5, including the bottom-sheet redesigns and Round 4.
- **Phase 5 — Submission prep**: crash/stability hunt, App Store Connect metadata + screenshots, review notes.

---

## Out of scope

- Real backend / cross-device community-report sync (local-only retained by choice; documented swap-in seam).
- Real-time live re-routing.
- Heavier data integrations: TIGER/Line, State DOT 511, FEMA/NOAA flooding.
- A20b rolling-window navigation fetch (#14).

## Dependencies & risks

- **Figma asset exports (user-provided)** gate Workstream 5 bundles 1–2 (and the Round 4 community-signal icon). Sequenced late so they don't block.
- **Privacy-policy hosting** — needs a URL before submission.
- **Apple Developer account / App Store Connect** access for submission prep.
- **Sign in with Apple token revocation** — may require a single serverless function (the only server-side concession in an otherwise local-only app), or proof that no tokens are persisted. Resolve before submission; it is the one place the no-backend decision touches Apple review.
- **OSRM public-demo rate limits** — turn-by-turn (2.2) leans on it; watch for throttling, keep the static fallback.
- **Roadside number sourcing** (2.4) — decide user-set vs national default.
- **Round 4 data-load cost** — 5+ parallel POI calls on mount; validate on device.

## Success criteria

- A full tap-through surfaces **zero** inert controls or "coming soon" alerts.
- Clears every App Store hard gate; passes review without a placeholder/compliance rejection.
- Full VoiceOver labeling, Reduce-Motion respect, color-independent route encoding, and AX5 reflow on every screen.
- v2 Figma fidelity across all shipped screens, with finished hero illustrations and a single coherent glyph family.
- Photographs cleanly for the case study; the daylight gradient, color-independence, AX5 safety reflow, and adapter swap-in are presentable as discrete craft stories.
