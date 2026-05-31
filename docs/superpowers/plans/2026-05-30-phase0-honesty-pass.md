# Phase 0 — Honesty Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every visible dead-end and placeholder from Fresh Greens so a tap-through surfaces no fake auth, no inert rows, and no "coming soon" alert (one documented exception — see Scope Corrections).

**Architecture:** Pure subtractive change across four screens plus one bug fix. No new modules, no new dependencies. Each task edits one screen, runs a typecheck, gets a manual simulator check, and commits. All work on a single branch `chore/phase0-honesty-pass`, squash-merged to `main` after a final acceptance sweep.

**Tech Stack:** React Native + Expo + TypeScript, expo-router. Theme tokens at `theme/*`.

---

## ⚠️ Verification model (read first)

**This project has no test runner** (no jest, no `test` script, no test files — confirmed). The TDD steps the writing-plans skill normally prescribes do not apply, and per `CLAUDE.md` (user instructions, which outrank the skill default) the verification rhythm is:

1. `npx tsc --noEmit` (typecheck) — the type system is the safety net.
2. A precise **manual simulator check** per task (described in each task).
3. A **code-reviewer subagent** pass on the branch diff before merge.

Phase 0 is entirely deletions + one logic fix, where a unit test would assert "the button is gone" — meaningless. So each task uses **edit → typecheck → manual check → commit** instead of red/green TDD.

**Typecheck command** (filters this repo's known, unrelated noise):
```bash
npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40
```
Expected after every task: **no output** (no errors referencing the edited files).

---

## ⚠️ Scope corrections (verified against current code, 2026-05-30)

The spec's Phase 0 list was written from `docs/` notes that have drifted. Three of the seven listed items are **already done or never existed** — do **not** create tasks for them:

- **"Remove report-photo coming-soon Alert"** — does not exist. `app/report.tsx:160–204` already implements real photo capture via `expo-image-picker` (camera permission → `launchCameraAsync` → durable copy). The `Alert.alert` at `report.tsx:164` is a legitimate *permission-denied* message and must stay. (Side effect: spec Workstream 2.3 "wire report photo" is already largely done.)
- **"Remove Schedule coming-soon Alert"** — does not exist. `app/home.tsx:1918` already calls the real `scheduleDepartureNotification`; the surrounding `Alert.alert`s are success/error *results*, not placeholders.
- **"Fix /menu profile row to full-opacity static header"** — already done. `app/menu.tsx:219–250` is already a full-opacity, non-tappable `<View>` (`accessibilityRole="text"`, no `opacity`, no `onPress`). The architecture doc's "0.5 opacity" line is stale.

**The one genuine remaining dead-end NOT covered by Phase 0:** the `/menu` Quick Tiles (`QUICK_TILES` carousel) still no-op with a "this tile lands in a future update" `Alert` (`menu.tsx:~324`). The spec assigns Quick Tiles to **WIRE in Phase 1**, so this plan leaves them. The acceptance sweep (Task 5) treats this as the lone documented exception — flag to the user whether to pull it forward.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `app/get-started.tsx` | First-time auth entry | Remove Google/Email placeholder buttons + orphaned imports/style; Apple-only. |
| `app/login.tsx` | Returning-user auth entry | Same removal; Apple-only. |
| `app/menu.tsx` | Settings hub | Remove 3 inert `SettingsRow`s + orphaned icon imports; simplify `SettingsRow` (drop `inert`). |
| `app/search.tsx` | Search landing | Remove Trending tile + all `comingSoon` machinery; fix query-tile deselect bug. |
| `app/report.tsx` | Community report flow | Honest picker subtitle copy (voice-confirm item). |

Four edit tasks + one acceptance task. Tasks are independent except Task 5 (gates merge).

---

### Task 1: Auth → Apple-only (`get-started.tsx` + `login.tsx`)

**Files:**
- Modify: `app/get-started.tsx`
- Modify: `app/login.tsx`

- [ ] **Step 1: `get-started.tsx` — remove the Google + Mail logo imports**

Replace (lines 15–17):
```tsx
import LogoApple from '../assets/illustrations/logo-apple.svg';
import LogoGoogle from '../assets/illustrations/logo-google.svg';
import LogoMail from '../assets/illustrations/logo-mail.svg';
```
with:
```tsx
import LogoApple from '../assets/illustrations/logo-apple.svg';
```

- [ ] **Step 2: `get-started.tsx` — update the docstring (lines 27–28)**

Replace:
```tsx
 * "Continue with Apple" is the only working auth provider. Google /
 * Email buttons are visual-only placeholders until those flows land.
```
with:
```tsx
 * Sign in with Apple is the only auth provider in v1 — deliberate: it
 * satisfies Apple's sign-in requirement and keeps the account model
 * minimal. No Google/Email placeholders.
```

- [ ] **Step 3: `get-started.tsx` — delete the placeholder comment + both Pressables**

Replace the block (lines 144–172, from the `{/* Google + Email ... */}` comment through the two `<Pressable>`s, ending just before the divider) so only the error line remains:
```tsx
            {/*
              Google + Email are visual-only placeholders. Apple Sign In
              is the only working provider in v1; these stay so the
              screen still matches the Figma layout, but they no-op on
              press until their flows are wired up.
            */}
            <Pressable
              style={[styles.outlinedButton, styles.outlinedButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google (not yet supported)"
              accessibilityState={{ disabled: true }}
              disabled
            >
              <LogoGoogle width={20} height={20} />
              <Text style={styles.outlinedButtonText}>Continue with Google</Text>
            </Pressable>

            <Pressable
              style={[styles.outlinedButton, styles.outlinedButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Continue with Email (not yet supported)"
              accessibilityState={{ disabled: true }}
              disabled
            >
              <LogoMail width={20} height={20} />
              <Text style={styles.outlinedButtonText}>Continue with Email</Text>
            </Pressable>

            {error && <Text style={styles.errorText}>{error}</Text>}
```
with:
```tsx
            {error && <Text style={styles.errorText}>{error}</Text>}
```
(The `or` divider + "Already have an account? Log in" link directly below stay unchanged — the divider now separates the Apple sign-in from the log-in link, which still reads correctly.)

- [ ] **Step 4: `get-started.tsx` — delete the now-orphaned `outlinedButtonDisabled` style (lines 261–267)**

Remove entirely:
```tsx
  // Visible disabled treatment for the Google + Email buttons.
  // Without opacity styling, a reviewer who taps them gets ZERO
  // feedback and assumes the app is frozen. Half-opacity matches
  // the standard iOS disabled-control register.
  outlinedButtonDisabled: {
    opacity: 0.5,
  },
```

- [ ] **Step 5: `login.tsx` — remove the Google + Mail logo imports (lines 15–17)**

Same as Step 1: keep only `import LogoApple from '../assets/illustrations/logo-apple.svg';`.

- [ ] **Step 6: `login.tsx` — update the docstring (lines 30–35)**

Replace:
```tsx
 * Mirrors /get-started's visual register (same wiltedgreen sky, burnt-
 * green ground, Apple/Google/Email button column) but copy and routing
 * targets are tuned for users who already have an account:
```
with:
```tsx
 * Mirrors /get-started's visual register (same wiltedgreen sky, burnt-
 * green ground, Apple sign-in button) but copy and routing targets are
 * tuned for users who already have an account:
```
and replace:
```tsx
 * Apple is the only working provider; Google + Email are visual-only
 * placeholders matching the design intent. Same pattern as /get-started.
```
with:
```tsx
 * Sign in with Apple is the only auth provider in v1. Same pattern as
 * /get-started.
```

- [ ] **Step 7: `login.tsx` — delete both placeholder Pressables (lines 125–145)**

Replace:
```tsx
            <Pressable
              style={styles.outlinedButton}
              accessibilityRole="button"
              accessibilityLabel="Log in with Google (not yet supported)"
              disabled
            >
              <LogoGoogle width={20} height={20} />
              <Text style={styles.outlinedButtonText}>Log in with Google</Text>
            </Pressable>

            <Pressable
              style={styles.outlinedButton}
              accessibilityRole="button"
              accessibilityLabel="Log in with Email (not yet supported)"
              disabled
            >
              <LogoMail width={20} height={20} />
              <Text style={styles.outlinedButtonText}>Log in with Email</Text>
            </Pressable>

            {error && <Text style={styles.errorText}>{error}</Text>}
```
with:
```tsx
            {error && <Text style={styles.errorText}>{error}</Text>}
```
(`login.tsx` has no `outlinedButtonDisabled` style and still uses `pressedDim` elsewhere — no orphan cleanup needed here.)

- [ ] **Step 8: Typecheck**

Run the typecheck command from the Verification model section. Expected: no output. (If `noUnusedLocals` is off and `LogoGoogle`/`LogoMail` were somehow still referenced, tsc would error — it won't, they're gone.)

- [ ] **Step 9: Manual simulator check**

Launch the app (`npm run ios` / Expo Go). From a signed-out state: the **Get Started** screen shows exactly one provider button ("Continue with Apple"), the `or` divider, and the "Already have an account? Log in" link — no Google/Email rows. Tap "Log in" → the **Login** screen likewise shows only "Log in with Apple". No dimmed/dead buttons anywhere on either screen.

- [ ] **Step 10: Commit**

```bash
git add app/get-started.tsx app/login.tsx
git commit -m "chore: drop Google/Email auth placeholders (Apple-only)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: /menu — cut inert rows + simplify `SettingsRow` (`menu.tsx`)

**Files:**
- Modify: `app/menu.tsx`

- [ ] **Step 1: Remove the three orphaned Phosphor icon imports**

The inert rows are the only consumers of `Calendar`, `GearSix`, `PaintRoller`. Replace the import block (lines 7–13):
```tsx
import { Calendar } from 'phosphor-react-native/src/icons/Calendar';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretUp } from 'phosphor-react-native/src/icons/CaretUp';
import { GearSix } from 'phosphor-react-native/src/icons/GearSix';
import { MapPinArea } from 'phosphor-react-native/src/icons/MapPinArea';
import { PaintRoller } from 'phosphor-react-native/src/icons/PaintRoller';
import { Shield } from 'phosphor-react-native/src/icons/Shield';
```
with:
```tsx
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretUp } from 'phosphor-react-native/src/icons/CaretUp';
import { MapPinArea } from 'phosphor-react-native/src/icons/MapPinArea';
import { Shield } from 'phosphor-react-native/src/icons/Shield';
```
(Keep `Shield` — the Safety row. Keep `CaretDown`/`CaretUp`/`MapPinArea` — used by `ZonePreferencesRow`.)

- [ ] **Step 2: Delete the three inert `SettingsRow`s (lines 271–287)**

Remove entirely (leaving the Safety `SettingsRow` at 265–269 as the last child of the `rowList`):
```tsx
            <SettingsRow
              icon={<GearSix size={24} color={colors.black} weight="duotone" />}
              label="Settings"
              inert
            />

            <SettingsRow
              icon={<Calendar size={24} color={colors.black} weight="duotone" />}
              label="Schedule a drive"
              inert
            />

            <SettingsRow
              icon={<PaintRoller size={24} color={colors.black} weight="duotone" />}
              label="Theme"
              inert
            />
```

- [ ] **Step 3: Simplify the `SettingsRow` component — drop the `inert` prop (lines 529–569)**

The `inert` prop now has zero callers. Replace the docstring + component head + body:
```tsx
/**
 * Single push-to-route settings row.
 *
 *   inert — "planned but not yet built." Drops opacity to 0.5,
 *   removes chevron, no-ops on tap. Same v1 affordance.
 */
function SettingsRow({
  icon,
  label,
  onPress,
  inert = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  inert?: boolean;
}) {
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      style={({ pressed }) => [
        styles.row,
        inert && styles.rowInert,
        pressed && !inert && pressedDim,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert }}
      accessibilityHint={inert ? 'Coming soon' : undefined}
    >
      <View style={styles.rowIconWrap}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      {!inert && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.labelTertiary}
        />
      )}
    </Pressable>
```
with:
```tsx
/**
 * Single push-to-route settings row.
 */
function SettingsRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && pressedDim]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowIconWrap}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.labelTertiary}
      />
    </Pressable>
```

- [ ] **Step 4: Delete the orphaned `rowInert` style (lines 664–666)**

Remove:
```tsx
  rowInert: {
    opacity: 0.5,
  },
```

- [ ] **Step 5: Update the top-of-file docstring references to the inert rows**

Remove the three inert-row lines from the ASCII menu diagram (lines 73–75):
```tsx
 *   ⚙  Settings                  ›  inert (TODO)
 *   📅 Schedule a drive          ›  inert (TODO)
 *   🎨 Theme                     ›  inert (TODO)
```
and delete the stale sentence near line 104 that begins `Inert rows still render at 50% opacity with no chevron` (it describes behavior that no longer exists). Reword the surrounding sentence so the menu is described as showing Zone Preferences + Safety only.

- [ ] **Step 6: Typecheck**

Run the typecheck command. Expected: no output. (Confirms `GearSix`/`Calendar`/`PaintRoller` are fully removed and `SettingsRow`'s new signature has no stale callers.)

- [ ] **Step 7: Manual simulator check**

Open `/menu` (tap the /home avatar). The settings list shows exactly two rows: **Zone Preferences** (the accordion) and **Safety** (chevron → /safety-settings). No Settings / Schedule a drive / Theme rows, no dimmed rows. The profile header and Quick Tiles carousel are unchanged.

- [ ] **Step 8: Commit**

```bash
git add app/menu.tsx
git commit -m "chore: cut inert /menu rows (Settings, Schedule, Theme)

Removes the three no-op placeholder rows and the now-dead 'inert'
affordance on SettingsRow. /menu now lists only real destinations.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: /search — cut Trending + fix tile-deselect bug (`search.tsx`)

**Files:**
- Modify: `app/search.tsx`

- [ ] **Step 1: Remove the Trending icon import (line 23)**

Delete:
```tsx
import QuickToolTrending from '../assets/illustrations/quick-tools-trending.svg';
```

- [ ] **Step 2: Remove the `comingSoon` field from the `QuickTool` type (lines ~90–98)**

Replace:
```tsx
   * `Saved` has no query: tapping it toggles an inline list of the
   * user's saved places + regular destinations (see `buildSavedRows`).
   * `Trending` is `comingSoon` — no analytics source to make it honest.
   */
  query?: string;
  /** Marks a tile whose feature isn't wired yet (renders a "Soon" cue,
      taps surface a coming-soon Alert instead of acting). */
  comingSoon?: boolean;
};
```
with:
```tsx
   * `Saved` has no query: tapping it toggles an inline list of the
   * user's saved places + regular destinations (see `buildSavedRows`).
   */
  query?: string;
};
```

- [ ] **Step 3: Remove the Trending entry from `QUICK_TOOLS` (line 102)**

Replace:
```tsx
  { id: 'saved', label: 'Saved', Icon: QuickToolSaved },
  { id: 'trending', label: 'Trending', Icon: QuickToolTrending, comingSoon: true },
  { id: 'food', label: 'Food', Icon: QuickToolFood, query: 'restaurant' },
```
with:
```tsx
  { id: 'saved', label: 'Saved', Icon: QuickToolSaved },
  { id: 'food', label: 'Food', Icon: QuickToolFood, query: 'restaurant' },
```

- [ ] **Step 4: Rewrite the tile `onPress` — drop the `comingSoon` branch AND fix the deselect bug (lines 539–564)**

The bug: tapping a selected query tile (Food/Gas/Parking) deselects it visually but `setQuery(tool.query)` still runs, leaving the stale query in the bar. Fix: branch on whether the tap *selects* or *deselects*. Replace:
```tsx
                        onPress={() => {
                          // Three paths:
                          //   1. comingSoon (Trending) → honest "coming
                          //      soon" Alert; the tile never enters a
                          //      selected state it can't act on.
                          //   2. has a `query` (Food/Gas/Parking) → set
                          //      the search text; the debounced
                          //      autocomplete effect fires the Mapbox
                          //      call. Selected state is confirmation.
                          //   3. no query (Saved) → toggle the selected
                          //      state, which reveals the inline Saved
                          //      list below the tiles.
                          if (tool.comingSoon) {
                            Alert.alert(
                              tool.label,
                              `${tool.label} spots are coming in a future update.`,
                            );
                            return;
                          }
                          setSelectedToolId((prev) =>
                            prev === tool.id ? null : tool.id,
                          );
                          if (tool.query) {
                            setQuery(tool.query);
                          }
                        }}
```
with:
```tsx
                        onPress={() => {
                          // Two paths:
                          //   1. has a `query` (Food/Gas/Parking) → toggle
                          //      selection AND mirror it into the search
                          //      text: selecting sets the query (the
                          //      debounced autocomplete effect fires the
                          //      Mapbox call); DESELECTING clears it, so a
                          //      second tap fully backs out instead of
                          //      leaving a stale query behind.
                          //   2. no query (Saved) → toggle the selected
                          //      state, which reveals the inline Saved
                          //      list below the tiles.
                          const willSelect = selectedToolId !== tool.id;
                          setSelectedToolId(willSelect ? tool.id : null);
                          if (tool.query) {
                            setQuery(willSelect ? tool.query : '');
                          }
                        }}
```
(`selectedToolId` is already in scope at line 530 as `const isSelected = selectedToolId === tool.id`.)

- [ ] **Step 5: Simplify the `accessibilityHint` — drop the `comingSoon` branch (lines 568–574)**

Replace:
```tsx
                        accessibilityHint={
                          tool.comingSoon
                            ? 'Coming soon'
                            : tool.query
                              ? `Search for ${tool.label.toLowerCase()} nearby`
                              : 'Show your saved places'
                        }
```
with:
```tsx
                        accessibilityHint={
                          tool.query
                            ? `Search for ${tool.label.toLowerCase()} nearby`
                            : 'Show your saved places'
                        }
```

- [ ] **Step 6: Remove the "Soon" cue from the tile label (lines 577–582)**

Replace:
```tsx
                        <View style={styles.quickToolLabelWrap}>
                          <Text style={styles.quickToolLabel}>{tool.label}</Text>
                          {tool.comingSoon && (
                            <Text style={styles.quickToolSoon}>Soon</Text>
                          )}
                        </View>
```
with:
```tsx
                        <View style={styles.quickToolLabelWrap}>
                          <Text style={styles.quickToolLabel}>{tool.label}</Text>
                        </View>
```
(`quickToolLabelWrap` now wraps a single child; leave it — flattening risks a layout regression and isn't worth it.)

- [ ] **Step 7: Delete the orphaned `quickToolSoon` style (lines 885–890)**

Remove:
```tsx
  // "Soon" cue under a coming-soon tile's label — quiet caption gray so
  // the tile reads as not-yet-available without looking broken/disabled.
  quickToolSoon: {
    ...typography.caption1Regular,
    color: colors.mutedSecondary,
  },
```
(Leave the `Alert` import — still used at `search.tsx:461` and `:659`. Leave the `colors.mutedSecondary` token — it's a shared theme export, not a local.)

- [ ] **Step 8: Typecheck**

Run the typecheck command. Expected: no output. (Confirms `QuickToolTrending`, `comingSoon`, and `quickToolSoon` are fully removed with no dangling references.)

- [ ] **Step 9: Manual simulator check**

Open `/search`. The Quick Tools row reads **Saved · Food · Gas · Parking** — no Trending tile, no "Soon" badge. Tap **Food**: the tile highlights and the query bar fills with "restaurant" (autocomplete fires). Tap **Food again**: the tile de-highlights **and the query bar clears** (this is the bug fix — previously the query stayed). Repeat with Gas/Parking. Tapping **Saved** still toggles the inline saved list.

- [ ] **Step 10: Commit**

```bash
git add app/search.tsx
git commit -m "fix: cut /search Trending tile; clear query on tile deselect

Removes the coming-soon Trending tile and its machinery, and fixes the
query-tile deselect bug (second tap now clears the search text instead
of re-setting it).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: /report — honest picker copy (`report.tsx`) — VOICE-CONFIRM

**Files:**
- Modify: `app/report.tsx`

> **Voice note for the implementer/reviewer:** this is the one subjective item. The current picker subtitle "Let the community know what's going on near you" promises *reach to other people* — but v1 is device-local (reports don't sync). The fix reframes it as a *contribution* (honest: the report goes onto the user's map) without claiming present broadcast. The proposed copy below is the recommendation; the user owns the thesis voice and may override the exact words. The Thank-You subtitle ("Reports like yours keep Fresh Greens fresh.", `report.tsx:711`) is already honest (no reach claim) — leave it.

- [ ] **Step 1: Reword the picker subtitle (lines 425–427)**

Replace:
```tsx
        <Text style={styles.subtitle}>
          Let the community know what&rsquo;s going on near you.
        </Text>
```
with:
```tsx
        <Text style={styles.subtitle}>
          Flag what&rsquo;s going on near you.
        </Text>
```
(Alternative if the user prefers to keep the data-contribution frame: `Add what you&rsquo;re seeing to the map.`)

- [ ] **Step 2: Typecheck**

Run the typecheck command. Expected: no output.

- [ ] **Step 3: Manual simulator check**

Open `/report` (the /home or /en-route Report FAB). The picker subtitle under "Report" reads "Flag what's going on near you." (or the confirmed alternative). Submit a report → the Thank-You subtitle is unchanged.

- [ ] **Step 4: Commit**

```bash
git add app/report.tsx
git commit -m "polish: honest /report picker copy for local-only v1

Reframes the picker subtitle from a reach claim ('let the community
know') to a contribution frame, since v1 reports are device-local.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Phase 0 acceptance sweep + merge

**Files:** none (verification + merge only)

- [ ] **Step 1: Full typecheck**

Run the typecheck command once more against the full tree. Expected: no output.

- [ ] **Step 2: Dead-end tap-through (simulator)**

Walk the whole app and confirm **zero** reachable placeholder/dead surfaces, with the ONE documented exception:
- Get Started + Login → only "Continue/Log in with Apple".
- /menu → only Zone Preferences + Safety rows; full-opacity profile header.
- /search → no Trending; query tiles select/deselect cleanly (query clears on deselect).
- /report → honest picker subtitle; photo capture works (real, pre-existing).
- **Documented exception:** the /menu **Quick Tiles** (Fuel, Notifications) still no-op with a "future update" Alert. This is assigned to **Phase 1 (wire)** by the spec. Do **not** treat it as a Phase 0 failure — but record it in the merge note and confirm with the user whether to pull it into Phase 0.

- [ ] **Step 3: Code-reviewer subagent**

Dispatch the `code-reviewer` agent on the branch diff (`git diff main...chore/phase0-honesty-pass`). Confirm: no orphaned imports/styles/props left behind, docstrings updated (no stale "inert"/"coming soon"/"placeholder" references), reserved-color rule intact, and the deselect fix reads correctly. Fix anything it flags, then re-review.

- [ ] **Step 4: Squash-merge to `main`**

Per project rhythm (merge-to-main is the default once the review is clean):
```bash
git checkout main
git merge --squash chore/phase0-honesty-pass
git commit -m "feat: Phase 0 honesty pass — remove visible dead-ends

Apple-only auth, cut inert /menu rows, cut /search Trending + fix tile
deselect, honest /report copy. See docs/superpowers/plans/2026-05-30-
phase0-honesty-pass.md. Quick Tiles dead-end deferred to Phase 1 (wire).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git branch -D chore/phase0-honesty-pass
```

- [ ] **Step 5: Append a `docs/learnings.md` entry**

Per workflow Step 11, add a newest-at-top entry noting the key learning: the spec's Phase 0 list had drifted from code (photo capture, schedule, and the profile row were already done) — grounding the plan in real source before writing tasks caught three no-op tasks. One line per takeaway.

---

## Self-Review

**1. Spec coverage** — Phase 0 spec items vs tasks:
- Hide Google/Email auth → Task 1. ✅
- Cut /menu inert rows → Task 2. ✅
- Cut /search Trending → Task 3. ✅
- Remove "coming soon" Alerts (report photo, Schedule) → **N/A, don't exist** (Scope Corrections). The only real one left (Quick Tiles) is Phase 1 by spec; documented in Task 5. ✅
- Fix /menu profile row → **already done** (Scope Corrections). ✅
- Fix /search tile-deselect → Task 3, Step 4. ✅
- Honest report copy → Task 4. ✅

No gaps.

**2. Placeholder scan** — every code step shows the exact before/after. The one judgment item (report copy) ships concrete proposed text + a labeled alternative, not a "TBD". The docstring update in Task 2 Step 5 quotes the exact lines to remove and a unique anchor string for the sentence to delete. No "handle edge cases"/"similar to Task N" placeholders.

**3. Type/name consistency** — `selectedToolId`, `setSelectedToolId`, `setQuery`, `tool.query`, `SettingsRow`, `QuickTool`, `QUICK_TOOLS`, `rowInert`, `outlinedButtonDisabled`, `quickToolSoon` all match the symbols read from current source. The `SettingsRow` simplified signature (`{ icon, label, onPress }`) has no remaining `inert` callers after Task 2 Step 2. `willSelect` is newly introduced and self-contained.
