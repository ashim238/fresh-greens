# Recording Reliability Design

**Status:** Approved in conversation on 2026-07-15

## Goal

Make every recording action truthful and recoverable. The app may show a recording as saved only after the audio file is in durable storage and its metadata is in the recordings index.

## Scope

This slice covers the pulled-over recording lifecycle and bulk recording deletion:

- Start recording only after microphone permission and recorder startup succeed.
- Route manual Stop and modal dismissal through one stop-and-save operation.
- Show explicit recording, saving, saved, and save-error states.
- Preserve retry information after a save failure.
- Require confirmation before discarding unsaved audio.
- Save recordings shorter than two seconds.
- Replace concurrent per-item bulk deletion with one atomic clear operation.
- Keep VoiceOver, Dynamic Type, and 44-point touch targets working across every state.

## Current failures

### Manual Stop reports success without saving

`handleStopRecording` stops the native recorder, sets `recordingStopped`, and clears the navigation guard. It never calls `addRecording`. The screen then renders “Recording saved” and “Saved to your phone,” even though the temporary audio was not copied into the documents directory or added to the recordings index.

The modal-dismiss path already stops and persists the recording through `saveRecordingMutation`. This working path is the reference for the shared operation.

### Recording becomes active before startup succeeds

The current effect sets `hasActiveRecording` before permission, audio-mode setup, recorder preparation, and `record()` finish. Permission denial or startup failure can therefore leave the navigation guard armed for a recording that never started.

### Delete All races against shared metadata

The recordings screen runs one `remove` mutation per ID with `Promise.all`. Every removal independently reads and rewrites the same AsyncStorage list. Concurrent operations can overwrite each other and leave metadata for files another operation deleted.

## Chosen approach

Use a small shared recording coordinator for this screen. It will own the transition from an active native recorder to a durable `Recording` entry. Manual Stop and modal dismissal will call the same operation.

This keeps the change focused while creating a testable boundary. A global recording manager remains a later iteration.

### Alternatives considered

1. Duplicate the dismissal-save logic inside the manual Stop handler. This is a smaller edit, but it leaves two persistence paths that can drift again.
2. Add a global recording manager now. This would support app-wide recording control, but the current bug does not require a new global state layer.

## Recording state model

The screen will replace loosely related booleans with an explicit state:

```ts
type RecordingStatus =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'saving'
  | 'saved'
  | 'unavailable'
  | 'save-error'
  | 'discarded';
```

The allowed transitions are:

```text
idle -> requesting-permission
requesting-permission -> recording
requesting-permission -> unavailable
recording -> saving
saving -> saved
saving -> save-error
save-error -> saving
save-error -> discarded
```

The navigation guard will be derived from the state instead of stored as a separate source of truth. It is active during `recording`, `saving`, and `save-error`. Permission denial, startup failure, durable save, and confirmed discard leave the guard inactive.

## Shared stop-and-save flow

The coordinator will accept a narrow recorder interface, recording metadata, and a persistence function. It will:

1. Stop the recorder when it is still recording.
2. Read the recorder URI after stopping.
3. Build one `AddRecordingInput` from the captured start time and armed-state snapshot.
4. Call the existing persistence mutation.
5. Return a typed result that distinguishes saved, missing-audio, stop failure, and persistence failure.

The screen will keep the last valid persistence input after a failed save. Retry will reuse that input without calling `stop()` again.

Recordings shorter than two seconds will follow the same save path. A user who pressed Stop asked the app to keep the captured audio.

## Bulk deletion

`useRecordings` will expose a `clearAll` mutation backed by `clearAllRecordings` from the adapter. The mutation will capture one snapshot for optimistic UI and restore that snapshot if clearing fails.

The recordings screen will call `clearAll.run()` once. Playback will stop before the operation begins. The confirmation sheet stays protected from repeated submission until the mutation settles.

This slice fixes the shared-metadata race. Durable retry for individual file-deletion failures remains part of the later storage-hardening work because the current adapter intentionally removes metadata after a file deletion error.

## Interface behavior

### Recording card

| State | Primary copy | Supporting behavior |
|---|---|---|
| Requesting permission | Preparing recording | Stop control hidden |
| Recording | Recording started | Timer, waveform, and Stop control visible |
| Saving | Saving recording | Stop disabled and progress announced |
| Saved | Recording saved | “Saved on this phone” shown only after persistence succeeds |
| Unavailable | Microphone unavailable | Guidance continues without recording controls |
| Save error | Recording needs attention | Persistent Retry and Discard actions remain visible |

The recording-state footnote shown before Stop will read “Saved on this phone when you stop.” This describes the upcoming behavior without claiming that persistence has already happened.

### Error banner

The existing persistent banner remains the save-recovery surface. The two-line text limit will be removed so accessibility text sizes can wrap. Retry will show a pending state. Discard will retain its destructive confirmation.

### VoiceOver

The screen will announce these changes:

- “Recording started.”
- “Saving recording.”
- “Recording saved.”
- “Recording could not be saved. Retry or discard the recording.”

Repeated announcements will be avoided when React rerenders without a state transition.

## Error handling

- Permission denial moves to `unavailable` and never arms the navigation guard.
- Recorder startup failure moves to `unavailable` and surfaces the existing recording error copy.
- Stop failure moves to `save-error`. The app does not claim a saved recording.
- A missing URI moves to `save-error` because there is no durable audio to index.
- Persistence failure retains the stopped source URI and metadata input for Retry.
- Navigation requested during saving waits for the result.
- Navigation requested after save failure stays on the screen until Retry succeeds or Discard is confirmed.

## Test strategy

The project will receive a declared Expo-compatible test setup before production changes begin. Pure coordinator tests will avoid React Native rendering. Hook and screen-state tests will use the native test environment where storage and React state must be exercised together.

Tests will cover:

- Successful manual stop calls persistence once and returns saved.
- Dismissal uses the same operation as manual Stop.
- Retry persists the stopped source without stopping twice.
- Stop failure never returns saved.
- Missing recorder URI never returns saved.
- Persistence failure retains a retryable input.
- A sub-two-second recording is persisted.
- Permission denial never marks recording active.
- Bulk clear invokes one adapter operation.
- Failed bulk clear restores the optimistic recordings snapshot.

## Acceptance criteria

- Manual Stop creates a durable recording visible on the recordings screen.
- Modal dismissal and manual Stop use one stop-and-save implementation.
- “Recording saved” cannot render before persistence succeeds.
- Permission denial and startup failure leave no false active-recording guard.
- Save failure provides Retry and confirmed Discard without losing the recovery input.
- Delete All performs one atomic metadata operation.
- Recording copy does not truncate at large Dynamic Type sizes.
- VoiceOver announces meaningful state transitions and can operate every action.
- The existing 44-point Stop, Retry, and Discard targets remain compliant.
- New regression tests fail against the old behavior and pass after the fix.

## Deferred global recording manager

A later iteration can lift recording ownership above the pulled-over screen. That manager becomes useful when recording must continue across route changes, survive a screen remount, expose app-wide recording status, or coordinate background behavior.

The later manager should reuse the coordinator and state model from this slice. It should add ownership and lifecycle scope without replacing tested persistence behavior.
