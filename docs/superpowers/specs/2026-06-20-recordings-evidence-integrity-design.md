# Recordings Evidence Integrity — Design Spec

**Date:** 2026-06-20
**Status:** Approved (brainstorm complete; awaiting plan)
**Phase:** Design Health Program — Phase 3 PR C (of A/B/C/D/E)
**Synthesis source:** [`phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) Section 5

---

## Goal

Close the two highest-stakes recordings gaps Phase 1 flagged:

1. **P0-1 Recordings share/export** — recordings exist solely as legal protection during traffic stops; without an iOS Share Sheet path the user cannot get them off-device (to email, AirDrop, lawyer, cloud, etc.). The Phase 1 synthesis names this *the* single most safety-consequential gap in the app.
2. **P0-4 Single-row delete asymmetry** — the bulk "Delete all recordings" is gated behind the Figma 1133:12674 destructive-confirm Modal; the per-row Trash button skips that gate entirely. Backwards asymmetry for legally significant material: an accidental tap on the wrong row permanently destroys evidence.

Both belong to one user concern (evidence is mine, I control it), so they ship together.

## How the screen works today (verified)

- `app/recordings.tsx` renders a list of `RecordingCard` items. Each row currently has **Play** (freshgreen circle, left-anchored) and **Trash** (`labelTertiary`, right-anchored). No share affordance.
- The screen owns a `<Modal>` destructive-confirm overlay (Figma 1133:12674) gated by `showDeleteAllConfirm: boolean`. Tapping "Delete all recordings" sets it; the modal renders title + body + a single primary fill `"Yes, I'm sure"` Button. X close + scrim dismiss; `animationType` is gated on `useReduceMotion()`.
- Per-row `onDelete` prop calls `state.remove.run(id)` directly — no confirm gate. The synthesis flagged this asymmetry.
- `expo-sharing` is not installed. No source file uses `Sharing.shareAsync` anywhere. `expo-sharing` is supported in Expo Go (SDK 50+), so smoke-testing does not require an EAS dev build (`eas.json` is absent — that's M1.2 roadmap work, out of scope here).

## Scope

**1 new dep + 1 file + 3 atomic commits, low-blast-first.**

| File | Change | Commit |
|---|---|---|
| `package.json` / lockfile | `npx expo install expo-sharing` | 1 |
| `app/recordings.tsx` | Per-row Share button + `Sharing.shareAsync` handler | 2 |
| `app/recordings.tsx` | Replace `showDeleteAllConfirm: boolean` with a discriminated `confirm: { mode: 'all' } \| { mode: 'single'; id; createdAt } \| null`; gate per-row delete through it | 3 |

**Out of scope (deliberate, deferred via `docs/next-session.md`):**
- Long-press → context menu / multi-select.
- Bulk-share (selecting N recordings to share at once).
- Email/cloud destination templates beyond what the iOS Share Sheet provides natively.
- EAS dev build setup (M1.2 roadmap work).

---

## Design

### Commit 1 — install expo-sharing

```
npx expo install expo-sharing
```

This bumps `package.json` (`"expo-sharing": "~<version>"`) and the lockfile. No `app.json` plugin entry needed (the library self-registers). No iOS Info.plist key required to share locally-owned files; the iOS Share Sheet is a system surface and does not consume an entitlement for app-owned URIs.

### Commit 2 — per-row Share

**Phosphor import:** `import { Share } from 'phosphor-react-native/src/icons/Share';` (the project's deep-import convention).

**`expo-sharing` import:** `import * as Sharing from 'expo-sharing';`

**Handler (Recordings owner, alongside `handleDelete`):**

```ts
async function handleShare(uri: string, createdAt: number) {
  try {
    await Sharing.shareAsync(uri, {
      dialogTitle: `Recording from ${formatTimestamp(createdAt)}`,
      mimeType: 'audio/m4a',
    });
  } catch (err) {
    const { title, body } = getErrorMessage('recordings', 'transient', err);
    Alert.alert(title, body);
  }
}
```

`Sharing.shareAsync` returns when the Share Sheet dismisses (either action taken or cancelled). The try/catch covers the device-can't-share path (rare; e.g. `isAvailableAsync()` returns false). Uses the project's existing `getErrorMessage('recordings', 'transient')` taxonomy — no new error-copy domain.

**RecordingCard prop addition:** `onShare: (uri: string, createdAt: number) => void`.

**RecordingCard render:** new Pressable inserted **between Play and the text stack, OR between the text stack and Trash** — to be decided at render time by visual balance. The design intent is **Play / Share / Trash from left to right**, with Share immediately preceding Trash so the two destructive-class actions are spatially grouped on the right.

```tsx
<Pressable
  onPress={() => onShare(recording.uri, recording.createdAt)}
  style={({ pressed }) => [tapTarget44, pressed && pressedDim]}
  accessibilityRole="button"
  accessibilityLabel={`Share recording from ${formatTimestamp(recording.createdAt)}`}
>
  <Share size={24} color={colors.labelTertiary} weight="regular" />
</Pressable>
```

- **44pt painted target** via `tapTarget44` — no `hitSlop` (per the `.cursorrules` tap-target rule + PR 4).
- **Color** = `labelTertiary` — matches the neutral register of the Trash icon. The row's primary affordance is still Play (freshgreen circle); Share + Trash are equal-weight secondary actions on the row's right side.
- **Accessibility:** verb+object label (`"Share recording from ${date}"`) — no `accessibilityHint` needed per the `.cursorrules` Accessibility rule (self-evident verb).
- **Reserved-color rule:** unaffected (no reserved colors used).

### Commit 3 — single-row delete confirmation

Replace the boolean `showDeleteAllConfirm` with a discriminated request:

```ts
type ConfirmRequest =
  | { mode: 'all' }
  | { mode: 'single'; id: string; createdAt: number }
  | null;

const [confirm, setConfirm] = useState<ConfirmRequest>(null);
```

The bulk-delete handlers rename simply:
- `handleRequestDeleteAll()` → `setConfirm({ mode: 'all' })`
- `handleCancelConfirm()` → `setConfirm(null)` (covers both modes)
- `handleConfirmDelete()` — branches on `confirm?.mode`: all → existing parallel-remove; single → `state.remove.run(confirm.id)` then `setConfirm(null)`.

The per-row delete flow:
- `RecordingCard`'s `onDelete` prop signature changes from `(id: string) => void` to `(id: string, createdAt: number) => void` — the Modal needs the timestamp to render "Delete this recording from {date}?".
- The owner's `handleDelete(id, createdAt)` (formerly: invoked `state.remove.run(id)` directly) becomes: `setConfirm({ mode: 'single', id, createdAt })`. No deletion until the user confirms.

**Modal content switches on mode:**

```tsx
const isAll = confirm?.mode === 'all';
const isSingle = confirm?.mode === 'single';

<Modal visible={confirm !== null} ... >
  ...
  <Text style={styles.confirmTitle}>
    {isAll
      ? 'Are you sure you want to delete all recordings?'
      : `Delete this recording from ${formatTimestamp(confirm.createdAt)}?`}
  </Text>
  <Text style={styles.confirmBody}>
    Deleted files{' '}
    <Text style={styles.confirmBodyEmphasis}>cannot</Text> be recovered.
  </Text>
  <Button
    type="primary"
    fill="fill"
    text={isAll ? "Yes, I'm sure" : 'Yes, delete'}
    onPress={handleConfirmDelete}
    accessibilityLabel={isAll ? "Yes, I'm sure — delete all recordings" : 'Yes, delete this recording'}
    accessibilityHint={isAll ? undefined : 'Permanently deletes this recording'}
    loading={isAll && isDeletingAll /* single-delete is fast enough that no spinner state is needed */}
    style={styles.confirmActionBtn}
  />
</Modal>
```

- **Bulk-delete copy is preserved verbatim** ("Yes, I'm sure" — the existing high-friction phrasing for the irreversible-N case stays).
- **Single-delete copy** uses the calmer "Yes, delete" — still destructive, still requires intent, but doesn't carry the same urgency overhead. The body line ("Deleted files cannot be recovered.") is shared.
- **Accessibility hint** added on the single-delete CTA per the just-codified `.cursorrules` Accessibility rule (the bulk-delete CTA's existing label already states the outcome — no hint needed).
- **No new state for single-delete spinner:** single-row removal is a single AsyncStorage write; the existing `loading` spinner state stays scoped to `isDeletingAll`. If the future shows hot recordings or per-row failure modes, that's a follow-up.

### Reserved-color, tap-target, dismissal, accessibility — all conventions respected

- **Reserved-color rule:** Share icon uses `labelTertiary` (neutral); destructive copy uses the system register the Modal already employs.
- **Tap-target rule:** Share button wraps in `tapTarget44` (no `hitSlop`).
- **Dismissal convention** (`.cursorrules ## Dismissal`): the destructive-confirm Modal already follows the pattern (top-right X + scrim tap); unchanged.
- **Accessibility (VoiceOver):** Share is verb+object label (no hint); single-delete confirm gains a hint per the new convention.

---

## Testing

- **`tsc --noEmit`** clean after each commit.
- **No test runner** in the project.
- **Real-device smoke (user's responsibility, supported in Expo Go):**
  1. On `/recordings`, the row layout reads Play / text / Share / Trash — comfortably tappable (44pt each), no crowding.
  2. Tap Share → iOS Share Sheet opens with title "Recording from [date]"; Messages / Mail / AirDrop / Files all listed. Tap a destination → recording sends. Tap Cancel → returns to /recordings, no state change.
  3. Tap Trash → destructive-confirm overlay reads "Delete this recording from [date]?" + "Deleted files cannot be recovered." → "Yes, delete" CTA. Tap → only that row removed.
  4. Tap X / scrim → overlay closes, no deletion.
  5. Tap "Delete all recordings" (bulk path) → existing "Are you sure you want to delete all recordings?" copy + "Yes, I'm sure" CTA, unchanged behavior.
  6. VoiceOver smoke (any one row): Share announces "Share recording from [date], button"; Trash announces "Delete recording from [date], button"; the single-delete confirm CTA announces label + hint.

---

## Files

- **Modify:** `package.json` + lockfile (Commit 1)
- **Modify:** `app/recordings.tsx` (Commits 2 + 3 — handler, prop, render, state, Modal)
- **Modify:** `docs/next-session.md` (record the deferred items: long-press multi-select, bulk-share)
- **Untouched (deliberate):** all other screens; the destructive-confirm Modal's chrome (only its title + body + button text + label/hint react to `confirm.mode`); the bulk-delete behavior

## Verification (definition of done)

- [ ] `npx expo install expo-sharing` ran; `package.json` has `"expo-sharing"` under dependencies
- [ ] `Sharing` imported from `expo-sharing` in `app/recordings.tsx`; `Share` Phosphor icon imported
- [ ] `handleShare(uri, createdAt)` exists, calls `Sharing.shareAsync` with `dialogTitle` + `mimeType: 'audio/m4a'`, try/catches via `getErrorMessage('recordings', 'transient')`
- [ ] `RecordingCard` renders a third Pressable (Share) between text-stack and Trash, with `tapTarget44`, `labelTertiary` `Share` icon, verb+object accessibilityLabel
- [ ] `showDeleteAllConfirm: boolean` removed in favor of `confirm: ConfirmRequest`; Modal `visible={confirm !== null}`
- [ ] Per-row `handleDelete` sets `confirm: { mode: 'single', id, createdAt }` instead of removing immediately
- [ ] Modal title/body/CTA-text/CTA-label/CTA-hint all branch on `confirm?.mode`; bulk-delete copy unchanged
- [ ] `tsc --noEmit` passes after each commit
- [ ] `docs/next-session.md` records the deferred long-press / bulk-share items
- [ ] No reserved-color violations; no `hitSlop` introduced; no other screen touched

## Sequencing

PR C of Phase 3. Within it, low-blast-first:

1. **`chore(deps): add expo-sharing`** — single dep + lockfile.
2. **`feat(recordings): per-row Share to iOS Share Sheet`** — pure addition (a new Pressable + handler; no behavior change to existing affordances).
3. **`feat(recordings): single-row delete confirmation`** — extends the existing Modal to dual-mode + gates per-row delete through it. Behavior change: a Trash tap now opens a confirm instead of deleting immediately.
4. **verify + PR.**

After PR C merges, Phase 3 has 5 items remaining (P0-2, P0-3, P0-7, P1-9 in PR D; P1-10, P1-11 in PR E). Both need their own brainstorms — D for interaction-design judgment (hold-to-confirm SOS, trap-escape, hazard-sheet replacement), E for layout/CTA decisions (speed-limit sign, contact affordance). Then the final critique/audit closes the program.
