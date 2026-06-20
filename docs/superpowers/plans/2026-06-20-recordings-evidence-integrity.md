# Recordings Evidence Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two highest-stakes recordings gaps from Phase 1 — add iOS Share Sheet (`Sharing.shareAsync`) per recording, and gate per-row delete behind the existing destructive-confirm Modal (extended to dual-mode).

**Architecture:** One new dep (`expo-sharing`), one screen file (`app/recordings.tsx`), three behavior changes split into three atomic commits + one deferred-items docs commit. The existing destructive-confirm Modal extends cleanly to dual-mode via a discriminated `ConfirmRequest` state.

**Tech Stack:** React Native + Expo (managed). `expo-sharing` is supported in Expo Go (SDK 50+) — no EAS dev build required to smoke-test. tsc + manual smoke; agents cannot test the iOS Share Sheet itself (real-device only).

**Spec:** [`docs/superpowers/specs/2026-06-20-recordings-evidence-integrity-design.md`](../specs/2026-06-20-recordings-evidence-integrity-design.md)

---

## Pre-flight: branch

```bash
git checkout main && git pull --ff-only origin main
git checkout -b feat/phase3-recordings-evidence
```

Do NOT implement on `main`.

## File Structure

| File | Responsibility | Touched in commit |
|---|---|---|
| `package.json` + lockfile | new dep `expo-sharing` | 1 |
| `app/recordings.tsx` | imports, share handler, Share button render, prop threading | 2 |
| `app/recordings.tsx` | `ConfirmRequest` state, handler renames, Modal dual-mode, prop signature change | 3 |
| `docs/next-session.md` | deferred long-press / bulk-share notes | 4 |

**Context the implementer needs:**
- `app/recordings.tsx` is large (~500 lines) but well-structured. Locate edit sites by function/component name, not line number.
- Phosphor icon convention: deep imports from `phosphor-react-native/src/icons/<Glyph>` (e.g. `Share`). Do NOT use the package's barrel index.
- The existing destructive-confirm Modal at the bottom of the Recordings component is the visual register to extend — never invent a new modal.
- Project conventions (just codified): `tapTarget44` (no `hitSlop`), `accessibilityHint` for non-obvious outcomes (`.cursorrules ## Accessibility`).

---

### Task 1: install `expo-sharing`

**Files:**
- Modify: `package.json` + lockfile (one of `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` — repo uses npm; `package-lock.json`)

- [ ] **Step 1: Install via Expo's compatibility resolver**

Run: `npx expo install expo-sharing`
Expected: outputs `+ expo-sharing@~<version>` and updates `package.json` + `package-lock.json`. The version is whatever Expo's resolver picks for the project's current SDK; do not pin it manually.

- [ ] **Step 2: Verify dep entry + sanity tsc**

Run: `grep expo-sharing package.json`
Expected: line under `"dependencies"` showing `"expo-sharing": "~<version>"`.

Run: `npx tsc --noEmit`
Expected: exit 0. (No imports yet — this is the sanity gate to confirm install didn't break the project's TS resolution.)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add expo-sharing

For the per-row Share affordance on /recordings (Phase 3 PR C, P0-1).
Supported in Expo Go (SDK 50+) — no EAS dev build needed to smoke-test.
No app.json plugin entry required; no Info.plist key needed for
sharing locally-owned files. Single new dep + lockfile bump.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: per-row Share affordance

**Files:** `app/recordings.tsx` only.

- [ ] **Step 1: Add imports (top of file)**

Locate the existing Phosphor imports block (around the `Trash` / `X` imports). Add **one new line** alongside them:

```ts
import { Share } from 'phosphor-react-native/src/icons/Share';
```

Locate the `expo-router` / `expo-status-bar` / `expo-audio` imports block at the top. Add **one new line** in that group:

```ts
import * as Sharing from 'expo-sharing';
```

- [ ] **Step 2: Add the `handleShare` handler**

Locate the `handleDelete(id: string)` function in the Recordings owner component (around line 124). Insert `handleShare` immediately above it:

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

Note: `formatTimestamp`, `getErrorMessage`, and `Alert` are already imported.

- [ ] **Step 3: Thread `onShare` prop into `RecordingCard`**

In the `<RecordingCard ... />` render site (around line 231–237), add the `onShare` prop alongside the existing `onTogglePlay` / `onDelete`:

```tsx
<RecordingCard
  recording={recording}
  isActive={isActive}
  isPlaying={isPlaying}
  onTogglePlay={() => handleTogglePlay(recording.id)}
  onDelete={() => handleDelete(recording.id)}
  onShare={() => handleShare(recording.uri, recording.createdAt)}
/>
```

(`handleDelete` signature stays `(id)` for now — Task 3 changes it.)

- [ ] **Step 4: Add `onShare` to `RecordingCard`'s prop type**

Locate the `RecordingCard` function signature (around line 345). Update the destructured params + the type literal:

```tsx
function RecordingCard({
  recording,
  isActive,
  isPlaying,
  onTogglePlay,
  onDelete,
  onShare,
}: {
  recording: Recording;
  isActive: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
```

- [ ] **Step 5: Render the Share button between text-stack and Trash**

Inside the `RecordingCard` `<View style={[styles.card, ...]}>`, locate the Trash Pressable (around line 402). Insert a new Pressable **immediately before** it (so the row order becomes Play / textStack / Share / Trash):

```tsx
<Pressable
  onPress={onShare}
  style={({ pressed }) => [tapTarget44, pressed && pressedDim]}
  accessibilityRole="button"
  accessibilityLabel={`Share recording from ${formatTimestamp(recording.createdAt)}`}
>
  <Share size={24} color={colors.labelTertiary} weight="regular" />
</Pressable>
```

No `accessibilityHint` per `.cursorrules ## Accessibility` (the label is a self-evident verb+object). `tapTarget44` gives the 44pt painted floor per the dismissal/tap-target conventions; no `hitSlop`.

- [ ] **Step 6: Type-check + diff inspection**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `git diff app/recordings.tsx | rg '^[+-]' | rg -v '^(\+\+\+|---)' | head -60`
Expected: the added imports, the new `handleShare` function, the `onShare` thread + prop type addition, the new Share Pressable. NO change to existing Play / textStack / Trash blocks. NO change to bulk-delete state or Modal (those are Task 3).

- [ ] **Step 7: Commit**

```bash
git add app/recordings.tsx
git commit -m "feat(recordings): per-row Share to iOS Share Sheet

Adds a Share button between text-stack and Trash on each RecordingCard:
44pt painted target (tapTarget44, no hitSlop), labelTertiary Share glyph
(neutral register matching Trash; Play stays primary). Tapping invokes
Sharing.shareAsync with a dialogTitle naming the recording's date and
mimeType: 'audio/m4a'. Error path uses the existing recordings/transient
error-copy domain.

Closes Phase 1 P0-1 (the single most safety-consequential gap — recordings
exist solely as legal protection but couldn't leave the device).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: single-row delete confirmation

**Files:** `app/recordings.tsx` only. This is the behavior change.

- [ ] **Step 1: Replace `showDeleteAllConfirm` with `ConfirmRequest` state**

Locate `const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);` near the top of the Recordings component (around line 95 — find it by symbol name). Replace with:

```ts
type ConfirmRequest =
  | { mode: 'all' }
  | { mode: 'single'; id: string; createdAt: number }
  | null;
const [confirm, setConfirm] = useState<ConfirmRequest>(null);
```

- [ ] **Step 2: Rename handlers and rebuild their bodies**

Locate the three bulk-delete handlers (around lines 138–176). Replace them as follows.

**`handleRequestDeleteAll`** stays a function but its body becomes:
```ts
function handleRequestDeleteAll() {
  setConfirm({ mode: 'all' });
}
```

**`handleCancelDeleteAll`** is renamed `handleCancelConfirm` (it now covers both modes):
```ts
function handleCancelConfirm() {
  if (isDeletingAll) return;
  setConfirm(null);
}
```

**`handleConfirmDeleteAll`** is renamed `handleConfirmDelete` and branches on `confirm?.mode`. Replace its entire body:

```ts
async function handleConfirmDelete() {
  if (!confirm) return;
  if (confirm.mode === 'all') {
    if (isDeletingAll) return;
    setIsDeletingAll(true);
    if (playingId) {
      try {
        player.pause();
      } catch {
        /* noop */
      }
      setPlayingId(null);
    }
    // Iterate the local snapshot — capture before the first run() in case
    // state.recordings is replaced by an in-flight optimistic.
    const ids = state.ready && state.ok ? state.recordings.map((r) => r.id) : [];
    const results = await Promise.all(ids.map((id) => state.remove.run(id)));
    const anyFailed = results.some((r) => !r.ok);
    setConfirm(null);
    setIsDeletingAll(false);
    if (anyFailed) {
      const firstFailed = results.find(
        (r): r is { ok: false; error: Error } => !r.ok,
      );
      const firstErr = firstFailed?.error;
      const { title, body } = getErrorMessage('recordings', 'transient', firstErr);
      Alert.alert(title, body);
      return;
    }
    setJustDeletedAll(true);
    return;
  }
  // mode === 'single'
  const { id } = confirm;
  if (playingId === id) {
    try {
      player.pause();
    } catch {
      /* noop — player may not have a source loaded */
    }
    setPlayingId(null);
  }
  setConfirm(null);
  const result = await state.remove.run(id);
  if (!result.ok) {
    const { title, body } = getErrorMessage('recordings', 'transient', result.error);
    Alert.alert(title, body);
    return;
  }
}
```

The single-row branch keeps the play-pause-cleanup that previously lived in `handleDelete`. Closing `confirm` before awaiting `state.remove.run` keeps the modal from briefly showing after the user committed.

- [ ] **Step 3: Replace `handleDelete` body to open the confirm**

Locate `async function handleDelete(id: string)` (around line 124). Replace its entire body and update its signature:

```ts
function handleDelete(id: string, createdAt: number) {
  setConfirm({ mode: 'single', id, createdAt });
}
```

(No more `async` — opening the confirm is synchronous. The play-pause-cleanup + `state.remove.run` moved into `handleConfirmDelete` Step 2.)

- [ ] **Step 4: Update the `RecordingCard` consumer to pass `createdAt`**

In the `<RecordingCard ... />` render site (Task 2 left it as `onDelete={() => handleDelete(recording.id)}`). Change to:

```tsx
onDelete={() => handleDelete(recording.id, recording.createdAt)}
```

(`onShare` stays from Task 2.)

- [ ] **Step 5: Update `RecordingCard`'s `onDelete` prop type — no signature change at the prop boundary**

The `RecordingCard` prop type for `onDelete` stays `() => void` — the parent thunks it. **No change in `RecordingCard`'s signature.** This step is a no-op confirmation; do not edit the prop type.

- [ ] **Step 6: Update the Modal to branch on `confirm?.mode`**

Locate the `<Modal>` at the bottom of the Recordings component (around line 274–340). Update only the following pieces; leave scrim/card/X-close chrome unchanged.

Replace the `visible` prop:
```tsx
visible={confirm !== null}
```

Replace the `onRequestClose`:
```tsx
onRequestClose={handleCancelConfirm}
```

Replace the scrim Pressable's `onPress` (the outer Pressable):
```tsx
onPress={handleCancelConfirm}
```

Replace the X cancel Pressable's `onPress` + `disabled`:
```tsx
onPress={handleCancelConfirm}
disabled={confirm?.mode === 'all' && isDeletingAll}
```

Replace `<Text style={styles.confirmTitle}>...</Text>` block to:
```tsx
<Text style={styles.confirmTitle}>
  {confirm?.mode === 'all'
    ? 'Are you sure you want to delete all recordings?'
    : confirm?.mode === 'single'
      ? `Delete this recording from ${formatTimestamp(confirm.createdAt)}?`
      : ''}
</Text>
```

(The `''` branch never renders — Modal is hidden when `confirm === null` — but satisfies TS exhaustiveness.)

Replace the `<Button ...>` props block:
```tsx
<Button
  type="primary"
  fill="fill"
  text={confirm?.mode === 'single' ? 'Yes, delete' : "Yes, I'm sure"}
  onPress={handleConfirmDelete}
  accessibilityLabel={
    confirm?.mode === 'single'
      ? 'Yes, delete this recording'
      : "Yes, I'm sure — delete all recordings"
  }
  accessibilityHint={
    confirm?.mode === 'single' ? 'Permanently deletes this recording' : undefined
  }
  loading={confirm?.mode === 'all' && isDeletingAll}
  style={styles.confirmActionBtn}
/>
```

(`confirmBody` Text node is unchanged — same "Deleted files cannot be recovered." applies to both modes.)

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

If TS complains about `confirm` being possibly null in the `'single'` branch's `confirm.createdAt` access, narrow with: `confirm?.mode === 'single' ? `Delete this recording from ${formatTimestamp(confirm.createdAt)}?` : ''` — the outer ternary already gates on mode, so TS narrows `confirm` to the single-shape inside.

- [ ] **Step 8: Inspect the diff for unintended scope**

Run: `git diff app/recordings.tsx`
Expected: the state replacement, three handler bodies, `handleDelete` signature change, `RecordingCard` consumer's `createdAt` pass, Modal `visible` / `onRequestClose` / scrim `onPress` / X `onPress`+`disabled` / title / Button props. NO change to imports (those were Task 2), NO change to Play button, textStack, Trash, Share button, or any styles object.

- [ ] **Step 9: Commit**

```bash
git add app/recordings.tsx
git commit -m "feat(recordings): single-row delete confirmation

Replaces showDeleteAllConfirm: boolean with a discriminated
ConfirmRequest state so the existing destructive-confirm Modal
(Figma 1133:12674) handles both bulk and single-row delete.

Per-row Trash now opens the confirm rather than removing immediately.
Modal copy switches on mode: bulk-delete keeps its existing 'Yes,
I\\'m sure' copy verbatim; single-delete uses the calmer 'Yes, delete'
with a dynamic title naming the recording's date. accessibilityHint
('Permanently deletes this recording') added on single per the new
.cursorrules Accessibility convention. Play-pause-cleanup moves to
the confirm path so it fires when the user actually commits.

Closes Phase 1 P0-4 (delete asymmetry: bulk was gated, single wasn't —
backwards for legally-significant material).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: record deferred items + open PR

**Files:** `docs/next-session.md`

- [ ] **Step 1: Add deferred bullets**

Locate the `## Accessibility gaps` section (line ~188) or a "Recordings" / "polish" grouping near it. Add these bullets at the bottom of the most relevant existing group (if no Recordings group, append to "Interaction polish"):

```markdown
- **Recordings long-press → context menu / multi-select** — deferred from Phase 3 PR C (2026-06-20). Today: per-row Play / Share / Trash are individual taps. A long-press selection mode would unlock bulk-share (alongside bulk-delete) and per-row reordering if that ever comes up. Not blocking the pilot.
- **Recordings bulk-share** — deferred from Phase 3 PR C. Bulk-delete exists; bulk-share doesn't. Needs the multi-select gesture above first.
- **`Sharing.isAvailableAsync` gating on /recordings Share button** — today the try/catch around `Sharing.shareAsync` covers the unavailable case (rare on iOS; the system Share Sheet is always present on supported devices). If user reports confirm a class of devices/configurations where it fails silently, gate the button render on `isAvailableAsync` instead.
```

- [ ] **Step 2: Commit**

```bash
git add docs/next-session.md
git commit -m "docs(next-session): record deferred recordings items (Phase 3 PR C closeout)

Long-press → context menu / multi-select, bulk-share, and
Sharing.isAvailableAsync gating — deferred from PR C to keep its
scope tight to the two Phase 1 P0s (per-row Share + single-row
delete confirm).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 3: Final tsc + push + open PR**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `git diff main --stat`
Expected: 4 files — `package.json`, `package-lock.json`, `app/recordings.tsx`, `docs/next-session.md`. No others.

```bash
git push -u origin feat/phase3-recordings-evidence
gh pr create --title "feat(recordings): iOS Share Sheet + single-row delete confirmation" --body "$(cat <<'EOF'
## Phase 3 PR C — recordings evidence integrity

Closes the two highest-stakes recordings gaps Phase 1 flagged:

| Item | Pri | Fix |
|---|---|---|
| Recordings share/export | **P0** | New `expo-sharing` dep + per-row Share button (Phosphor `Share`, `labelTertiary`, 44pt painted) → iOS Share Sheet with `dialogTitle` naming the date and `mimeType: 'audio/m4a'`. |
| Single-row delete asymmetry | **P0** | Existing destructive-confirm Modal (Figma 1133:12674) extended to dual-mode via a discriminated `ConfirmRequest`. Per-row Trash now opens the confirm; bulk-delete copy unchanged ("Yes, I'm sure"), single-delete reads "Delete this recording from [date]?" → "Yes, delete" + `accessibilityHint: "Permanently deletes this recording"`. |

### Scope
- Hints respect the just-codified `.cursorrules ## Accessibility` convention; tap-target respects `## Tap targets`; reserved-color rule untouched.
- Deferred to `docs/next-session.md`: long-press multi-select, bulk-share, `Sharing.isAvailableAsync` gating.

### Verification
- `tsc --noEmit` clean.
- Diff is 4 files: `package.json`, `package-lock.json`, `app/recordings.tsx`, `docs/next-session.md`.
- **Real-device smoke (yours — agents cannot test the iOS Share Sheet):** see the spec's Testing section. `expo-sharing` is supported in Expo Go (SDK 50+), so a dev build is NOT required.

Spec: `docs/superpowers/specs/2026-06-20-recordings-evidence-integrity-design.md`
Plan: `docs/superpowers/plans/2026-06-20-recordings-evidence-integrity.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Report it back.

---

## Self-Review

**1. Spec coverage:**
- Spec Commit 1 (install) → Task 1. ✓
- Spec Commit 2 (per-row Share) → Task 2 (imports, handler, prop thread, render). ✓
- Spec Commit 3 (single-row confirm) → Task 3 (state, handler renames, signature, Modal dual-mode). ✓
- Spec Out-of-scope deferral → Task 4. ✓
- Spec Verification checklist — every box maps to a step (tsc per commit, diff scope per task, no-EAS-needed in PR body). ✓

**2. Placeholder scan:** No TBD; every code block is verbatim; every step shows exact code.

**3. Type/name consistency:** `ConfirmRequest`, `confirm`, `handleConfirmDelete`, `handleCancelConfirm`, `handleRequestDeleteAll`, `handleShare`, `handleDelete(id, createdAt)`, `onShare`, `onDelete: () => void` — names used identically across Tasks 2 and 3 + the diff-inspection greps. ✓

**4. Behavior-change visibility:** Task 3's behavior change (Trash → opens confirm, doesn't delete) is explicitly named in commit message + PR body so the reviewer's smoke flow accounts for it. ✓

No gaps found.
