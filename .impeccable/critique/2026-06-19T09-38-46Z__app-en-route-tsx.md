---
target: app/en-route.tsx
total_score: 28
p0_count: 1
p1_count: 2
timestamp: 2026-06-19T09-38-46Z
slug: app-en-route-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Route source clearly surfaced via pill + WifiSlash; loading ETA pulses; current speed shows before GPS resolves (dash); route-loaded announced once; no persistent "live GPS active" indicator at a glance; no signal when zone data still rolling in |
| 2 | Match Between System and World | 4 | Speed-limit sign shape, car marker rotating to heading, daylight dash-patterns on route, "now" threshold sub-30m — strong real-world metaphors; arrow icons map cleanly to maneuver kinds |
| 3 | User Control and Freedom | 3 | End trip always visible; drag-handle expands hazard panel; route comparison sheet allows mid-trip route switching; coach mark dismissed by tapping anywhere on screen (`Pressable` over `absoluteFill`), invisible and entirely undiscoverable; no explicit X/close affordance |
| 4 | Consistency and Standards | 3 | Token discipline strong; offline pill uses `rgba(255,255,255,0.2)` directly — not a token; `speedLimitCurrentNumber` inline-defines font size, weight, letter-spacing; `borderRadius: 100` instead of `radii.pill` on three sites; `routeBadgeTextActive` sets `color: colors.black` which is no-op |
| 5 | Error Prevention | 3 | Route re-fetch on fallback sources (90s retry, silent swap) thoughtful; off-route recalculation surfaces clearly; SOS button is one-tap path to `/emergency` with no confirmation — accidental brush of thumb triggers emergency contact flow; no haptic distinction from other three column buttons |
| 6 | Recognition Over Recall | 3 | Lane strip visual clear; hazard icons recognizable; side column icons have no persistent labels — labels appear only on first-run coach mark (one-time dismissal); coaching labels use `caption2Regular` (11pt) — below 12pt WCAG informational floor |
| 7 | Flexibility and Efficiency | 3 | Mid-trip destination change, route comparison, fuel stops sheet all exist; no shortcut to open safety menu or SOS from turn card itself; full reach from turn-card to SOS button column is thumb-stretch; no way to silence or temporarily dismiss hazard panel expansion without auto-collapse after 5 seconds |
| 8 | Aesthetic and Minimalist Design | 3 | Wiltedgreen header grounded and brand-correct; bottom sheet clean collapsed; in expanded state, up to three zones of copy stack simultaneously (hazard panel + fuel entry + ETA + secondary row + End trip) with uniform 16pt gaps — reads as single uniform column without clear visual hierarchy; 96pt yellow diamond in hazard panel visually heavy against 20pt copy |
| 9 | Help Users Recognize, Diagnose, and Recover | 2 | Off-route state clear ("Recalculating…"); mock/cache pill clear; when zone data roll fails silently (catch block ~line 1300), user gets no indication hazard overlay may be incomplete; no retry affordance; if route source is 'no-route', no user-facing message — turn card falls through to "Heading toward [dest]" indistinguishable from mock fallback |
| 10 | Help and Documentation | 1 | Coach mark one-time-only with no way to re-invoke; after dismissal, four side-column icons (SOS/Shield/Report/Recenter) have no discoverable labels at all; no in-app glossary, tooltip, or long-press fallback |
| **Total** | | **28/40** | **Functional — real in-car gaps in error recovery, discoverability, and one fatigue/misfire risk** |

## Anti-Patterns Verdict

**Not AI slop.** Screen genuinely disciplined. No gradient text, glassmorphism, decorative eyebrow labels, or generic-SaaS aesthetics. Reserved-color rule consistently applied across ~2800 lines — orange on hazard markers only, red on SOS glyph only, yellow strictly on caution-zone state and hazard markers, navy on safety shield. The "Then" footer uses burntgreen not as decoration but as tier distinction. Tone of in-screen copy ("Recalculating…", "now", "You've arrived") plain and human.

Minor token drift:
- `rgba(255, 255, 255, 0.2)` on offlinePill backgroundColor — not a named token; `colors.whiteFill12` exists at 12%, 20% variant belongs in `colors.ts`
- `borderRadius: 100` on three sites instead of `radii.pill`
- `speedLimitCurrentNumber` and `speedLimitNumber` define inline font metrics rather than spread from typography token

## Cognitive Load

| Item | Status | Notes |
|------|--------|-------|
| Single primary action per view state | Partial | Collapsed: ETA clear, End Trip prominent. Five side-column icons compete with turn card for attention simultaneously. |
| Labels for all interactive elements | Fail | Side column icons have no persistent labels. Coach mark one-shot. After dismissal: four unlabeled icons. |
| Progressive disclosure | Pass | Collapsed / Full sheet states well-designed. Hazard panel only in Full, fuel entry only in Full. |
| Information hierarchy follows attention sequence | Partial | Turn card → ETA → End Trip is right sequence. But in expanded sheet, hazard panel and fuel entry sit at same visual weight as ETA with no clear visual rank. |
| Motion is purposeful and deferrable | Pass | ETA pulse, lane strip fade-in, zone auto-expand all respect `useReduceMotion`. |
| Simultaneous-information count | Partial | At worst: turn card + turn hazard glyphs + speed sign (caution) + auto-expanded sheet + lane strip. Five concurrent information streams during zone entry event — exactly when cognitive load is highest. |
| Recovery from attention lapse | Pass | Turn card persists. Distance counts down. Recalculation explicit. |
| Spatial consistency of controls | Pass | Side column stays anchored above sheet. Speed sign stays bottom-left. |

## Emotional Journey

**Entry (just tapped Go):** Trust — route is loaded, car glyph appears with heading, wiltedgreen header establishes "companion, not alarm." Daylight gradient on route polyline quietly signals what drive ahead looks like. ETA pulses gently while loading. Composure preserved.

**Steady driving:** Calm competence. Turn instruction clear, "Then" footer provides mental projection. Speed sign neutral white. Side column visible but not intrusive.

**Approaching a hazard zone:** Hazard glyph appears on turn card. Speed sign flips to yellow. Then — tension point — sheet auto-expands with haptic tap, interrupting driver's visual scan of road ahead with full-panel change at bottom of screen. 96pt yellow diamond is loud visual arrival. 5-second auto-collapse too short for driver to read and dismiss deliberately while watching road. This is moment design drifts toward "alarmist safety-app red" territory — not in color, but in behavioral urgency.

**Off-route:** "Recalculating…" composed. Neutral NavigationArrow preserves calm. 90-second background retry invisible in right way.

**Arrival:** Route cache cleared, trip summary pushed automatically. Transition clean.

**Overall arc:** Starts grounded, maintains composure through most states, momentarily spikes in zone-entry moment. For this brand ("The Steady Companion"), that spike worth addressing.

## What's Working

**1. Reserved-color rule genuinely load-bearing.** Yellow caution-zone state on speed sign works precisely because yellow appears nowhere else in normal driving state. SOS burst reads as most emphatic button precisely because red appears only there. Whole bet of design system paying off in its most high-stakes surface.

**2. "no-route-found vs. loading" fallback chain is honest.** Pill system (mapbox → osrm → cache → mock) with explicit provenance labels, cache age stamps, and 90-second silent retry exactly right for thesis that values "honesty of disclosure." Degraded state labeled as degraded, not hidden.

**3. Lane strip is textbook.** Fade-in/out on approach, VoiceOver announcement on appearance transition, "all lanes go this way" filter preventing unnecessary noise, tabular-nums preventing digit jitter — lot of careful work for feature most apps punt on.

## Priority Issues

**[P0] SOS button: one accidental tap opens emergency flow**
- What: SOS at top of FAB column — furthest thumb reach in theory but reachable with bent thumb while steering right-handed. No confirmation, no haptic differentiation from other three buttons (all `Haptics.selectionAsync()`), no grace window.
- Why it matters: Accidental 911 call or emergency contact ping during routine traffic stop is real world harm for this user population. Black driver already in charged situation does not need phone unexpectedly pinging contact or surfacing 911 dialog.
- Fix: Hold-to-confirm gesture (500ms LongPress instead of onPress) with distinct `ImpactFeedbackStyle.Heavy` haptic on initiation and `NotificationFeedbackType.Success` on activation. Alternatively: 2-tap confirm (first tap → button flashes red and label changes to "Confirm SOS", second tap within 3s → opens `/emergency`). Add `onLongPress` to all three safety-row buttons with spoken tooltip via `AccessibilityInfo.announceForAccessibility`.

**[P1] Side-column icons permanently unlabeled after coach mark dismissal**
- What: Four side-column icons (SOS burst, shield, eye, recenter chevron) have no persistent text labels. `useCoachMark` system shows labels exactly once. Coaching labels use `typography.caption2Regular` (11pt) — below WCAG 1.4.4 informational floor.
- Why it matters: Safety column most consequential part of screen. New or occasional user who dismissed coach mark before reading — or forgot what shield vs. SOS vs. report button does — has no path to rediscovery except trial and error during live drive. 11pt label too small for glanceable reading in moving car under ambient street light.
- Fix: Promote coach-mark labels to `typography.footnoteRegular` (13pt) minimum. Add long-press callback on each FAB that announces `accessibilityLabel + " — " + accessibilityHint` via `AccessibilityInfo.announceForAccessibility`. Consider keeping labels semi-persistent (visible until dismissed per-label), or "?" button that re-shows labels on demand.

**[P1] Auto-expand sheet on zone entry too aggressive for driving moment**
- What: When driver enters caution zone, sheet expands automatically (haptic + layout change), shows 96pt yellow diamond and hazard copy, then auto-collapses after 5 seconds. No opt-out.
- Why it matters: Zone-entry event is exactly when driver needs to be watching road, not reading bottom-sheet expansion. Layout animation at bottom of screen creates saccade pull downward at moment eyes should stay on road. PRODUCT.md: "Safety through composure — never through urgency or alarm."
- Fix: Replace auto-expand with persistent-but-compact hazard pill anchored above bottom sheet that appears on zone entry and stays visible until zone exit. Expanded hazard panel remains available by dragging sheet up manually. Haptic on zone entry should stay — subtle Light haptic is right ambient signal.

**[P2] Speed sign shows posted limit as "—" permanently**
- What: Speed limit sign always shows "—" with `accessibilityLabel="Speed limit unknown"`. Acknowledged in code (v1 limitation: OSM maxspeed tags aren't wired). Sign styled and positioned as if it carries live data.
- Why it matters: Physical UI element that always shows "—" is not display-pending state — permanently broken affordance. Honesty-of-disclosure principle: "no affordance for state system can't deliver." Sign teaches user to distrust screen's other data.
- Fix (short-term): Remove static speed-limit sign UI entirely until OSM maxspeed wired. Keep current-speed pill (black with white digits) as standalone element — it IS live. Move caution-zone yellow signal to current-speed pill's border.
- Fix (long-term): Wire OSM maxspeed through zones adapter and re-introduce sign with real data.

**[P2] "no-route" source visually indistinguishable from loading**
- What: When `routeSource === 'no-route'`, screen renders with no explicit error message. Turn card falls through to "Heading toward [destination]" with neutral NavigationArrow — same appearance as mock-fallback path.
- Why it matters: Driver who has started driving and whose route turns out to be known-unroutable destination needs to know.
- Fix: Add `routeSource === 'no-route'` branch to turn card that shows "Route unavailable" copy and surfaces search FAB prominently with hint label ("Try a new destination").

**[P3] Drag-handle tap target comment is stale**
- What: `dragHandleTapTarget` has `paddingVertical: 20` (44pt painted height) — compliant. Comment in code says "the remaining HIG 44pt floor comes from `hitSlop` on the Pressable" — there is no `hitSlop` on this Pressable. Comment is stale.
- Fix: Compliant as-is (comment just stale). Discoverability gap is real but architectural — drag handle convention established enough on iOS that it reads as interactive to most users. Document that comment is wrong.

## Persona Red Flags

**Sam (accessibility):**
Screen has genuinely strong accessibility foundations: `a11yLabelForTurnCard` grammatically correct for VoiceOver, lane strip announces on appearance, route-loaded state announces once. Gaps:
- `caption2Regular` (11pt) coach-mark labels below WCAG 1.4.4 informational floor; not `dynamicType()`-wrapped so don't scale
- Auto-expand sheet announced via layout change, not via `AccessibilityInfo.announceForAccessibility`
- SOS long-press-to-confirm fix needs explicit consideration for VoiceOver — long-press in VoiceOver activates accessibility context menu

**Casey (distracted mobile, one-handed while driving):**
- Side button column requires right thumb to extend significantly upward to reach SOS (top). Highest-risk button requires hardest reach. Column order might serve Casey better as Recenter (most frequent, lowest) → Report → Safety → SOS
- Auto-expanding sheet during zone entry requires Casey to visually process layout change during moment she most needs to attend to road
- Report button has no `accessibilityHint`

**Black driver assessing safety in a charged moment:**

1. **SOS misfire.** Driver pulled over and opens app to activate share-location safety features could accidentally trigger SOS by brushing top button on column. Unexpected `/emergency` screen — with trusted-contact + 911 affordances — during charged traffic stop is not composed experience. Could increase rather than decrease tension.

2. **Auto-expand hazard sheet fires for "police presence" zones.** Driver enters zone flagged as having police presence will receive automatic haptic + sheet expansion + "Police presence near this turn" copy in large type. May read as app alarming rather than briefing. For persona already hyperaware of police presence, having app expand panel and announce in large type may be anxiety-amplifying, not composure-preserving.

3. **Community-report tap during navigation.** Tap report pin while driving → bottom ETA sheet disappears, ReportDetailCard replaces it. Driver now without End Trip button until card dismissed. Code comment acknowledges this ("if this proves too aggressive in real driving we can swap to auto-dismiss"). Should graduate from comment to fix.

## Minor Observations

- `routeBadgeTextActive` sets `color: colors.black` on `freshgreen` background. Black on `#41AD49` is approximately 2.9:1 — below 3:1 WCAG floor for text on UI components.
- `thenFooter` always shows `ArrowBendUpRight` regardless of actual next-next maneuver. Consider straight-ahead arrow as neutral default.
- `sideFabCoach` coach-mark dismiss target is full screen (`absoluteFill`). Pressable has `accessible={false}` — correct for overlay dimmer, but dismiss mechanism has no visible affordance for sighted users either.
- ETA uses `typography.largeTitleEmphasized` (34pt) — excellent glanceability. But when ETA is "—" (loading), dash character at 34pt very thin visual.
- `speedLimitCurrentNumber` set with `fontWeight: '700'` and `fontSize: 24` inline. Match no existing typography token.
- `LaneStrip` cell `minWidth: 32` with `height: 40` — tight lanes (5+ lane roads) may render cells narrower than 32pt.
- `handleRecenter` always recenters to `userCenter` (initial GPS fix), not live position. During long drive, this drifts further from car's actual location. **Functional bug.**

## Questions to Consider

1. SOS column order — top (proximity to turn card, hardest thumb reach) or bottom (easiest reach)? Frequency vs. severity tradeoff.
2. Police-presence hazard panel voice — is "Police presence near this turn" right copy register? Thesis is about *briefing* driver, not alarming. Would "Police checkpoint area" or "Check your speed — police area" better serve composure principle?
3. Coach-mark lifecycle — current system dismisses all four labels simultaneously on single tap anywhere. Per-label "I got it" more useful, or "tap to acknowledge you've read everything" intentional? What's plan for pilot user who tries app months after first run and can't remember what buttons do?
4. Zone-data freshness indicator — when corridor roll fails silently, driver has no idea hazard overlay may be stale. Even tiny colored dot on speed sign (green = live, gray = cached) would honor transparency principle.
5. Community-report card during driving — auto-dismiss or never-show? Current approach hides ETA sheet when report card is open.
