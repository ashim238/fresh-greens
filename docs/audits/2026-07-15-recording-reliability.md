# Recording Reliability Audit

**Date:** 2026-07-15
**Scope:** `/pulled-over` recording lifecycle, local recording persistence, and the `/recordings` Delete All recovery path. This is a source-and-test audit at commit `5501d7f`; it is not an app-wide audit.

## Automated evidence

All prescribed commands were run fresh from the repository root.

| Command | Result | Current output |
|---|---|---|
| `npm run test:recordings` | Pass, exit 0 | 8/8 suites and 36/36 tests passed; 0 snapshots |
| `npm run typecheck` | Pass, exit 0 | `tsc -p tsconfig.app.json --noEmit` completed with no diagnostics |
| `npm ls --depth=0` | Pass, exit 0 | Complete top-level tree; no missing, invalid, or extraneous dependency errors |
| `git diff --check` | Pass, exit 0 | No output |

The focused tests cover truthful permission/start states, startup cancellation, one-stop persistence, deferred dismissal, retained retry input, confirmed discard, short recordings, adapter retry cleanup, the static card states, full-snapshot Delete All rollback, and the user-visible cleared state. They do not substitute for native audio, accessibility, layout, or relaunch checks.

### Native audit score

This score is scoped to the recording reliability surface and is based on source plus automated tests. Device-only uncertainty is reflected in the findings.

| Dimension | Score | Evidence-based finding |
|---|---:|---|
| Accessibility | 3/4 | Explicit labels, state announcements, scalable copy, 44 pt source tokens, and Reduce Motion branches are present; VoiceOver cadence, AX5 layout, and rendered target sizes remain unverified on iPhone. |
| Performance | 4/4 | Recording work is asynchronous, the timer updates once per second, waveform history is bounded, duplicate saves are guarded, and metering rerenders stop under Reduce Motion. No runtime profiling was performed. |
| Appearance & Theming | 4/4 | Recording UI uses project typography, spacing, radii, interaction, and semantic severity tokens; the persistent save-error treatment uses the reserved failure color for meaning. |
| Platform Conformance | 4/4 | Safe-area layout, native alerts, native-stack `usePreventRemove`, platform audio APIs, explicit 44 pt targets, and standard modal dismissal semantics read as native iOS patterns in source. |
| Adaptivity | 3/4 | Scrollable guidance, unclamped banner copy, and scaled line heights reduce clipping risk; AX5, landscape, and varying iPhone sizes have not been observed on a native runtime. |
| **Total** | **18/20** | **Excellent, with native verification still required** |

Platform conformance verdict: **Pass from source review.** The feature uses native recording, alert, sheet-navigation, safe-area, and accessibility primitives rather than web-shaped controls. This verdict does not claim that the rendered app passed the pending device checks.

## User-state review

The required state map is present in the final code. “Actions disabled” below means recording recovery actions; the safety guidance remains available.

| State | User-visible state map | Evidence | Audit result |
|---|---|---|---|
| `idle` / `requesting-permission` | **Preparing recording** → no Stop → dismissal allowed | The card maps both states to the same truthful copy and omits Stop (`components/PulledOverRecordingCard.tsx:18-37,114-122`). Protection excludes these states (`app/pulled-over.tsx:204-207`). | Supported by source and card/flow tests. |
| `recording` | **Recording started** → Stop available → dismissal saves first | The timer starts only in `recording`; successful native start triggers the state and announcement (`app/pulled-over.tsx:259-273,317-340`). Stop is shown only here (`components/PulledOverRecordingCard.tsx:124-153`). Dismissal is blocked behind Save & leave or confirmed discard (`app/pulled-over.tsx:475-550`). | Supported by source and flow tests; playable native output pending. |
| `saving` | **Saving recording** → recording actions disabled → dismissal waits | Save sets `saving` before awaiting stop/persist and announces it (`app/pulled-over.tsx:360-393`). The card omits Stop, retry controls are disabled while retrying, and deferred navigation dispatches only after `saved` (`components/PulledOverRecordingCard.tsx:114-122`; `components/RecordingSaveErrorBanner.tsx:35-80`; `app/pulled-over.tsx:451-457,493-507`). | Supported by source and pending-promise flow tests. |
| `saved` | **Recording saved** → no recovery action → dismissal allowed | Success clears retry input, commits `saved`, announces once through the explicit API path, removes navigation protection, and renders saved-on-phone copy (`app/pulled-over.tsx:390-392,451-457`; `components/PulledOverRecordingCard.tsx:27-28`). | Supported by source and flow tests; native playback pending. |
| `unavailable` | **Microphone unavailable** → guidance continues → dismissal allowed | Permission denial/start failure sets `unavailable`; the timer never starts and the card says guidance continues (`app/pulled-over.tsx:259-273,317-350`; `components/PulledOverRecordingCard.tsx:29-32`). This state is not protected from dismissal. | Supported by source and two automated unavailable cases; device permission behavior pending. |
| `save-error` | **Recording needs attention** → Retry or Discard → dismissal blocked | Failed persistence retains retry input, announces failure, pins the assertive banner, and keeps `usePreventRemove` active until Retry succeeds or Discard is confirmed (`app/pulled-over.tsx:381-386,397-449,475-528,661-670`). | Supported by source and failure/retry/discard tests; forced native storage failure pending. |
| `discarded` | recording card hidden → dismissal allowed | Confirmed discard stops if necessary, clears save state, sets `discarded`, removes the card, and releases pending navigation (`app/pulled-over.tsx:433-457`; `components/PulledOverRecordingCard.tsx:112`). | Supported by source and card/flow tests. |

Additional reliability evidence:

- Short recordings are preserved because duration is calculated with a zero floor and no minimum-duration rejection (`lib/recording-session.ts:50-86`); the focused test uses a 1.5-second recording.
- A persistence failure retains the exact retry input and does not stop the recorder a second time (`lib/recording-session.ts:36-47`; retry flow tests).
- Metadata is the add-recording commit boundary. If metadata persistence fails, the retryable source remains and the unindexed destination is removed; temp-source cleanup after commit cannot turn success into a reported failure (`lib/api/recordings.ts:89-135`).
- Delete All uses one bulk mutation and restores the complete in-memory snapshot on adapter failure (`hooks/useRecordings.ts:124-143`; screen and hook tests). On success, metadata is removed from persistent storage (`lib/api/recordings.ts:159-170`), but empty-after-relaunch still requires a device check.

## Accessibility review

### Source and automated evidence

- Meaningful lifecycle transitions call `AccessibilityInfo.announceForAccessibility` for started, saving, save failure, and saved states (`app/pulled-over.tsx:338-340,370-392,408-430`). The integration tests verify the explicit start announcement occurs once and saving/saved calls are not repeated during the tested paths.
- The save-error banner is assertive and exposes labeled Retry and destructive-dismiss controls. Both controls use the shared 44×44 pt target token and become disabled during retry (`components/RecordingSaveErrorBanner.tsx:47-80`; `theme/interaction.ts:70-75`).
- Stop has a 44 pt minimum height and a text label, not an icon-only affordance (`components/PulledOverRecordingCard.tsx:139-149,205-218`). Discard is presented by a native destructive alert after explicit confirmation.
- Recording state copy, timer, footnote, and error-banner copy use `dynamicType()`, which scales both glyph size and line height. The error copy has no `numberOfLines` clamp, and the focused test asserts that absence (`components/PulledOverRecordingCard.tsx:170-218`; `components/RecordingSaveErrorBanner.tsx:100-115`; `theme/dynamic-type.ts:32-38`).
- Reduce Motion stops metering-history updates, flattens waveform bars without hiding the timer or state copy, and skips the recording-start haptic/temporary label change (`app/pulled-over.tsx:561-588`; `components/PulledOverRecordingCard.tsx:63-110,124-153`).

### Accessibility risks

- **[P1 release-evidence risk] Native accessibility and interaction checks are incomplete.** No booted iPhone was available, so source-level accessibility work has not been validated with VoiceOver, AX5, Reduce Motion, or measured rendered targets.
- **[P2] Announcement cadence needs device verification.** The explicit announcement calls are deterministic in tests, but the saving status also uses a polite live region and the failure banner uses an assertive live region. Only VoiceOver can establish whether these combinations announce a meaningful state once rather than duplicate it.

## Device verification

`xcrun simctl list devices booted` was run outside the filesystem sandbox. It returned the installed `iOS 26.3` runtime header and no booted devices. No physical iPhone was available through this environment. The app was not built, dependencies were not installed, and no simulator or external state was changed.

| Native check | Status | Source/test coverage and remaining gap |
|---|---|---|
| VoiceOver announces each meaningful state once | **device verification pending** | Explicit calls and call-count tests cover selected paths; actual focus, live-region, and speech cadence require VoiceOver. |
| AX5 Dynamic Type keeps card and banner copy visible | **device verification pending** | Copy uses scaled font plus line height, the screen scrolls, and banner text is unclamped; only rendered AX5 layout can prove visibility and non-overlap. |
| Reduce Motion removes waveform animation without hiding information | **device verification pending** | Source flattens bars and stops metering rerenders while retaining timer/copy; runtime preference propagation and rendering were not observed. |
| Stop, Retry, and Discard remain at least 44×44 pt | **device verification pending** | Stop has `minHeight: 44`, Retry/dismiss use `tapTarget44`, and Discard uses a native alert; rendered point sizes were not measured. |
| Permission denial leaves the modal dismissible with no false timer | **device verification pending** | Automated tests prove `unavailable`, no protected state, and no timer chip; the real permission sheet and swipe dismissal were not exercised. |
| Manual Stop and swipe dismissal each create one playable recording | **device verification pending** | Tests prove one stop/persist and deferred navigation, but mocked files cannot establish native codec output or playback. |
| Forced save failure stays until Retry or confirmed Discard | **device verification pending** | The failure/retry/discard state machine is covered with mocked persistence; a real native filesystem/storage failure was not forced. |
| Delete All remains empty after relaunch | **device verification pending** | The bulk mutation, success state, and failure rollback are automated; no native cold relaunch verified persistent emptiness. |

## Remaining risks

No confirmed P0 or P1 production defect was found in this scoped source-and-test audit.

- **[P1 release-evidence] Native end-to-end verification is outstanding.** Playability, swipe-save behavior, VoiceOver cadence, AX5 layout, Reduce Motion, and relaunch persistence are the highest-priority release checks because mocks cannot prove native audio and OS behavior.
- **[P2 accessibility] A duplicate-announcement risk remains unmeasured.** Explicit saving/failure announcements coexist with live-region content on some phases. This is not a confirmed defect; verify it with VoiceOver before altering the announcement strategy.
- **[P2 environment/dependency] Known npm audit and transitive-package warnings remain.** The original test-harness install recorded 22 audit findings (1 low, 18 moderate, 2 high, 1 critical) and deprecated transitive packages. This audit's required `npm ls --depth=0` passed, which verifies dependency resolution but not vulnerability status. No fresh `npm audit` or dependency remediation was part of this task, so these findings are recorded as an environment/dependency risk, not as fixed.

### Positive findings

- The UI never claims recording has started before native permission, audio mode, preparation, and `record()` have completed.
- Navigation protection follows audio ownership: it activates only for recording, saving, or save-error and releases only after saved or discarded commits.
- Manual Stop and dismissal share one persistence coordinator, which removes divergent save behavior and preserves short recordings.
- Retry reuses retained input without a second stop, and adapter cleanup keeps the original source available when metadata persistence fails.
- Error recovery is visible and actionable: save failure remains pinned until successful Retry or confirmed Discard.
- The feature follows the project's native/token vocabulary, including native alerts, safe areas, semantic colors, scalable type, and painted 44 pt targets.

### Prioritized next actions

1. **[P1] `/impeccable harden`:** Run all eight pending checks on an already-booted iPhone simulator and at least one physical iPhone, capturing OS/device, result, and any native logs.
2. **[P2] `/impeccable adapt`:** Exercise AX5 on the smallest supported iPhone width and landscape; verify every card/banner line and all Stop, Retry, and Discard targets remain visible and measurable.
3. **[P2] `/impeccable harden`:** With VoiceOver enabled, trace started → saving → save-error → retry → saved and confirm each meaningful state is spoken once. Consolidate explicit/live-region announcements only if duplication is reproduced.
4. **[P2 dependency]:** Triage the known audit findings in a separate dependency-hardening workstream, preserving Expo/React/renderer compatibility and verifying the full transitive peer tree.
5. **[P3] `/impeccable polish`:** Re-run this scoped audit after native verification and any resulting fixes.
