# Route Trust Native Audit

**Date:** 2026-07-16
**Scope:** Route scoring evidence isolation, corridor cleanup, adaptive corridor width, and the first offline route-resilience handoff across `/home`, `RoutePreviewCard`, and `/en-route`.

This began as a source, test, and limited-simulator-launch audit. A later app-hardening pass reached the main route preview and collapsed `/en-route` surface on an iPhone 17 Pro simulator at standard Large and AX5 text sizes. Those layout states are now runtime-supported. The full route-start interaction, expanded en-route details, VoiceOver behavior, and forced failure states remain pending, so runtime-dependent scores stay capped at 3/4 and this is not a full device pass.

For the current cross-surface status and runtime evidence ledger, see the [App Hardening Impeccable Audit](./2026-07-16-app-hardening-impeccable-audit.md). This route-trust audit remains the narrower record for scoring, corridor, and resilience findings.

## Automated evidence

| Command | Result | Current output |
|---|---|---|
| `npm test -- route-trust/route-preview-resilience-source.test.ts route-trust/route-resilience.test.ts` | Pass, exit 0 | 2/2 suites and 5/5 tests passed |
| `npm test -- --runInBand __tests__/native-hardening/route-preview-large-text-source.test.ts __tests__/native-hardening/en-route-large-text-source.test.ts` | Pass, exit 0 | 2/2 suites and 7/7 tests passed |
| `npm run typecheck` | Pass, exit 0 | `tsc -p tsconfig.app.json --noEmit` completed with no diagnostics |
| `npm run ios -- --device "iPhone 17 Pro"` | Pass with warning, stopped after launch | Built, installed, opened on the booted iPhone 17 Pro simulator, and bundled successfully. Warning: `Pods/react-native-maps-ReactNativeMapsPrivacy` declares an older iOS deployment target. |
| `xcrun simctl io booted screenshot ...` | Pass, exit 0 | Captured first-run and login screenshots from the launched simulator. |

The later hardening pass added focused source contracts for the completed large-text work:

- `__tests__/native-hardening/route-preview-large-text-source.test.ts` covers route-summary reflow, flexible actions, readable destination and ETA treatment, and the definite large-text scroll frame.
- `__tests__/native-hardening/en-route-large-text-source.test.ts` covers bounded navigation chrome and a scrollable expanded-sheet content region above the pinned End Trip action.

Earlier in this route-trust implementation pass, the full focused route-trust cluster and full Jest suite passed after the v1/v2 zone-tile purge compatibility fix. Re-run the full suite after any additional audit fixes.

## Provisional native audit score

| Dimension | Score | Evidence-based finding |
|---|---:|---|
| Accessibility | 3/4 | Route chips, retry chips, route cycling, no-route state, offline/degraded route states, and the Go preparation state expose labels or state. Standard and AX5 layout are observed for the main route preview and collapsed en-route surface. VoiceOver order, speech cadence, and rendered target measurement remain device-pending. |
| Performance | 3/4 | Corridor collection is tiled, route scoring is pure and route-scoped, route prep is async and guarded against duplicate taps, and fallback refetching is interval-based. Runtime render cost, MapView marker churn, and weak-network behavior remain unprofiled. |
| Appearance & Theming | 3/4 | The UI stays within Fresh Greens tokens, green interaction color, muted status pills, and reserved-color discipline. The main route preview and collapsed en-route layout have been observed at standard and AX5 sizes. Expanded-state composition and a clean Release capture remain pending. |
| Platform Conformance | 3/4 | Source uses React Native/Expo primitives, SafeAreaView-backed sheets, 44pt controls, native alerts where appropriate, and native map controls. The route preview and collapsed en-route surface rendered in iOS Simulator, while the full route-start sequence and Android behavior remain pending. |
| Adaptivity | 3/4 | Route preview chips and summary content reflow, action controls can grow, and the large-text sheet has a definite scrollable frame. Standard and AX5 checks passed on the iPhone 17 Pro simulator. Small-phone, landscape, expanded-sheet interaction, split-view, and Android edge-to-edge behavior remain unobserved. |
| **Total** | **15/20** | **Good, provisional pending native verification** |

Platform conformance verdict: **Source conformance and standard/AX5 simulator layout supported. Full route interaction verdict pending.** The app built, installed, opened, and rendered the main route preview and collapsed en-route surface in the iPhone 17 Pro simulator. The audit still has not completed the end-to-end sequence of selecting a destination, cycling alternatives, pressing Go, expanding en-route details, tracing VoiceOver, or simulating weak network and storage failures.

## User-state map

| State | What the driver sees | Evidence | Audit result |
|---|---|---|---|
| Route calculating | “Mapping the safest way there…” loading state | `RoutePreviewCard` renders `LoadingState` while route fetch is in flight. | Supported by source. |
| No route | “No route available” with destination-specific explanation | `RoutePreviewCard` exposes a text role and accessibility label for no-route. | Supported by source. |
| Corridor loading / partial | Route appears while hazard chips wait for zone evidence | Chips are withheld until evidence is ready, failed, or complete enough for all-clear. | Supported by source; runtime timing pending. |
| Corridor fetch failed | “Couldn’t check route · Retry” | Retry chip is a labeled button with a polite live region wrapper. | Supported by source. |
| Hazards found | “Along this route:” with per-route hazard and safe-zone chips | Route chips now use the selected route’s evidence only, and Mapbox incidents remain route-owned. | Supported by source and route-trust tests. |
| No hazards found | “All clear” only after corridor evidence is ready and complete | Empty Overpass responses are valid no-hazard evidence, not fallback mock hazards. | Supported by source and tests. |
| Go pressed | Go changes to “Preparing…” and is disabled while the route backup is written | `RoutePreviewCard` now owns an explicit `idle` / `preparing` state and sets accessibility busy/disabled. | Fixed during this audit and covered by source test. |
| Route backup ready | `/en-route` shows “Route saved” | `/home` passes `routePrepStatus='ready'` after the offline route-resilience bundle saves. | Fixed during this audit and covered by source test; runtime visibility pending. |
| Route backup degraded | `/en-route` shows “Backup limited” while still starting navigation | Failed bundle writes are non-blocking but truthful through `routePrepStatus='degraded'`. | Fixed during this audit and covered by source test; forced storage failure pending. |
| Offline route source | `/en-route` shows “Offline route” or “Demo route” | Existing source/cache/mock pill remains distinct from the new route-backup status. | Supported by source; network simulation pending. |

In lay terms: the route-trust stack now behaves like labeled layers of tracing paper. Public/shared corridor hazards are one sheet, each route’s own live incidents are another sheet, the score looks only at the sheets belonging to that candidate route, and the UI now tells the driver when it is packing a small offline copy before the drive starts.

## Findings

### Closed during this audit

- **[P2] Go had hidden offline-prep work.** Pressing Go wrote the route-resilience bundle before navigation, but the button stayed visually identical and failures only reached `console.warn`. That made a safety-relevant state invisible.
  - **Fix:** `RoutePreviewCard` now shows “Preparing…”, disables duplicate presses with accessibility busy/disabled state, and passes `routePrepStatus` to `/en-route`.
  - **Fix:** `/en-route` now surfaces “Route saved” or “Backup limited” as a quiet status pill.
  - **Tests:** `route-preview-resilience-source.test.ts` guards the visible prep and degraded-state handoff.

### Remaining source-supported risks

- **[P1 release-evidence] End-to-end route interaction is still outstanding.** The standard and AX5 route-preview and collapsed en-route layouts are observed, but release claims still need a simulator or device pass that chooses a destination, cycles routes, retries a corridor fetch, presses Go, expands `/en-route`, and repeats with weak network or storage failure.
- **[P2 dependency hygiene] `react-native-maps` privacy bundle reports an old iOS deployment target during simulator build.** The app still built and launched, so this is not a route-trust blocker, but it belongs in native hardening follow-up.
- **[P2 adaptivity] Small-phone, landscape, and expanded-state layout remain unverified.** The main route preview and collapsed en-route surface have standard and AX5 runtime evidence on an iPhone 17 Pro simulator. The smallest supported iPhone width, rotation behavior, and expanded en-route details still need rendered checks.
- **[P2 accessibility] VoiceOver order and announcements are unverified.** Source labels are present, but the route chip cluster, polite retry state, Go busy state, and `/en-route` backup pill need a real VoiceOver trace.
- **[P2 Android conformance] Android predictive Back is disabled in `app.json`.** This is outside the route-scoring algorithm itself but belongs to the broader native/device audit because Android’s system Back expectation is explicit.
- **[P3 resilience depth] The current offline bundle is an essential handoff, not the full later resilience layer.** It stores selected route, validated evidence, policy version, and route-set identity. Weak-signal zone detection, passive prefetch around known tunnels, and richer degraded-mode copy remain future increments.

## Positive findings

- Route scoring now isolates route-owned incidents instead of letting one alternative’s evidence contaminate another.
- Shared corridor zones and per-route Mapbox incidents are separate layers, which supports the product claim that safety decisions are independently auditable.
- Corridor fetching now evaluates every candidate route instead of only the first route’s coordinates.
- Empty successful provider responses are treated as truthful no-hazard evidence instead of accidentally falling back to mock hazards.
- Adaptive corridor width is centralized in the corridor planner and tested against dense/curvy and sparse/straight geometry.
- The UI avoids alarmist reserved colors for degraded route-backup state; it uses muted status treatment rather than hazard treatment.

## Prioritized next actions

1. **[P1] `/impeccable harden app/home.tsx components/RoutePreviewCard.tsx app/en-route.tsx`:** Run the full route-start interaction on a booted iPhone simulator or device and record the ready and degraded backup states. The standard and AX5 layout checks for the main preview and collapsed navigation surface are complete.
2. **[P2] `/impeccable adapt components/RoutePreviewCard.tsx app/en-route.tsx`:** Check the smallest supported iPhone width, landscape or rotation behavior, and the expanded en-route sheet. AX5 on the iPhone 17 Pro simulator is complete for the main route preview and collapsed en-route surface.
3. **[P2] `/impeccable harden app/en-route.tsx`:** Simulate weak network and forced route-resilience storage failure to verify “Backup limited” is visible but non-blocking.
4. **[P2] `/impeccable audit app.json`:** Decide whether Android predictive Back should be enabled or explicitly documented as deferred with rationale.
5. **[P3] `/impeccable polish`:** Reconcile this route-specific record with the broader app-hardening audit after the remaining runtime, VoiceOver, and failure-state checks.
