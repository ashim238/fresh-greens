# Settings Register Refresh — Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all six settings-class pages to the iOS-native grouped-settings register (gray page bg + white row-group cards + SettingsHeader chrome) via three new shared primitives, retrofitting each page to consume them.

**Architecture:** Three new components under `components/settings/` (SettingsHeader, RowGroup, SettingsRow) define the register once. Each of the six pages (`/menu`, `/zone-preferences`, `/safety-settings`, `/saved-places`, `/fuel`, `/legal`) is then retrofitted to consume them: page bg flips to `colors.systemGroupedBackground`, the bare back-chevron strip becomes a SettingsHeader (title + chevron-back + close-X), and row content is wrapped in RowGroup cards. Hero glyphs on child pages retire.

**Tech Stack:** React Native + Expo + TypeScript, expo-router, Phosphor deep-imported icons, theme tokens (`colors`, `spacing`, `typography`, `shadows`, `radii`), `dynamicType()`.

**Spec:** [docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md](../specs/2026-06-01-settings-register-refresh-design.md)

**This is Plan 1 of 2.** Plan 2 (Connect-calendar feature) is written after this lands. This plan ships the register + the carousel with only the Refuel tile; the Connect-calendar tile arrives in Plan 2.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `components/settings/SettingsHeader.tsx` | create | Page header: centered title, optional chevron-back (left), always-present close-X (right). |
| `components/settings/RowGroup.tsx` | create | White card wrapping a contiguous row set; optional eyebrow caption above + footer caption below; hairline separators between children. |
| `components/settings/SettingsRow.tsx` | create | One settings row: icon + label + (value / chevron / toggle / none). `destructive` red variant. (`segmented` variant is interface-only — no renderer in Plan 1.) |
| `app/menu.tsx` | modify | Hub retrofit: SettingsHeader (close-only), profile card, progressive carousel (Refuel tile only), two RowGroups + Refuel-reminders row, sign-out RowGroup. |
| `app/zone-preferences.tsx` | modify | SettingsHeader + two RowGroups, retire hero glyph, gray bg. |
| `app/safety-settings.tsx` | modify | SettingsHeader + one RowGroup, retire hero glyph, gray bg. |
| `app/saved-places.tsx` | modify | SettingsHeader + RowGroup list, retire hero glyph, gray bg, empty state on gray. |
| `app/fuel.tsx` | modify | SettingsHeader + form regrouped into RowGroups, gray bg. |
| `app/legal.tsx` | modify | SettingsHeader, tab pills kept, content card on gray. |

No test runner exists in this project — verification is `tsc` (per task) + a simulator pass (Task 10), matching the established pattern. Each step's "test" is a typecheck against the pre-existing baseline.

**Pre-existing tsc baseline** (these errors exist before this plan and are NOT regressions — ignore them in every typecheck step): `Cannot find module '@expo/vector-icons'` is GONE as of the Phosphor migration; the remaining baseline is `Cannot find module '../assets/illustrations/avatar.png'` and `@vercel/node` in `proxy/`. The canonical filter is:
```bash
npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"
```
Empty output = clean.

---

## Task 1: SettingsHeader primitive

**Files:**
- Create: `components/settings/SettingsHeader.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/settings/SettingsHeader.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { X } from 'phosphor-react-native/src/icons/X';

import { colors } from '../../theme/colors';
import { dynamicType } from '../../theme/dynamic-type';
import { pressedDim } from '../../theme/interaction';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

/**
 * Settings page header. Three slots: optional chevron-back (left),
 * centered title, always-present close-X (right).
 *
 * Per the settings-register spec (Q2-a): the settings-tree ROOT
 * (/menu) passes only `onClose` — there's no parent to point a back
 * chevron at, so the left slot renders an equal-width spacer to keep
 * the title centered. CHILD pages pass both `onBack` (pop to /menu)
 * and `onClose` (exit the whole flow to /home).
 *
 * Both controls are 44pt visual tap targets per .cursorrules.
 */
export function SettingsHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={({ pressed }) => [styles.control, pressed && pressedDim]}
        >
          <CaretLeft size={28} color={colors.black} weight="regular" />
        </Pressable>
      ) : (
        <View style={styles.control} />
      )}

      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        style={({ pressed }) => [styles.control, pressed && pressedDim]}
      >
        <X size={24} color={colors.black} weight="regular" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  // 44pt visual tap target on both controls; the spacer matches so the
  // centered title stays optically centered whether or not onBack is set.
  control: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
    textAlign: 'center',
    flex: 1,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep SettingsHeader`
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add components/settings/SettingsHeader.tsx
git commit -m "feat(settings): SettingsHeader primitive

Page header for the settings register: optional chevron-back (left),
centered title, always-present close-X (right). Root (/menu) passes
onClose only (left renders a spacer to keep the title centered);
child pages pass both. 44pt tap targets per .cursorrules.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 2: RowGroup primitive

**Files:**
- Create: `components/settings/RowGroup.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/settings/RowGroup.tsx
import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { dynamicType } from '../../theme/dynamic-type';
import { radii } from '../../theme/radii';
import { shadows } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

/**
 * A white card wrapping a contiguous set of SettingsRows, sitting on
 * the grouped-gray page background. Optional uppercase eyebrow caption
 * above the card and a small footer caption below it (the iOS grouped-
 * settings pattern). RowGroup owns the inter-row hairline separators
 * so SettingsRow stays position-agnostic.
 *
 * Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md
 */
export function RowGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.wrap}>
      {title ? (
        <Text style={styles.eyebrow} accessibilityRole="header">
          {title.toUpperCase()}
        </Text>
      ) : null}

      <View style={styles.card}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {row}
            {i < rows.length - 1 ? <View style={styles.separator} /> : null}
          </Fragment>
        ))}
      </View>

      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  // Uppercase section caption, sits above the card with a small inset
  // so it aligns to the card's content, iOS-style.
  eyebrow: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.labelSecondary,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    overflow: 'hidden',
    ...shadows.e1,
  },
  // Hairline separator inset to clear the row icon+gap column (~52pt)
  // so it runs under the label text, not the icon — iOS-style.
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorderSubtle,
    marginLeft: 52,
  },
  footer: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
    paddingHorizontal: spacing.md,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep RowGroup`
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add components/settings/RowGroup.tsx
git commit -m "feat(settings): RowGroup primitive

White card wrapping a contiguous row set on the grouped-gray bg.
Optional uppercase eyebrow caption + footer caption. Owns the inter-
row hairline separators (52pt left-inset) so SettingsRow stays
position-agnostic.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 3: SettingsRow primitive

**Files:**
- Create: `components/settings/SettingsRow.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/settings/SettingsRow.tsx
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';

import { colors } from '../../theme/colors';
import { dynamicType } from '../../theme/dynamic-type';
import { pressedDim } from '../../theme/interaction';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Trailing = 'chevron' | 'toggle' | 'segmented' | 'none';

/**
 * One settings row. Icon (optional) + label + a trailing affordance.
 *
 * trailing:
 *   'chevron' (default) — pushes to a sub-page; row is a Pressable.
 *   'toggle'            — RN Switch; row is NOT a Pressable (the Switch
 *                         owns interaction).
 *   'none'              — static / value-only row.
 *   'segmented'         — INTERFACE ONLY in Plan 1. No renderer here;
 *                         the prop slots are reserved for Phase B's
 *                         distance-units row. Passing 'segmented' in
 *                         Plan 1 renders as 'none' (no crash, no pill).
 *
 * `value` renders right-aligned text before the trailing affordance
 * (e.g. "English (US)"). `destructive` makes the row a centered red
 * label with no icon / no trailing (Sign out).
 *
 * Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md
 */
export function SettingsRow({
  icon,
  label,
  value,
  trailing = 'chevron',
  toggleValue,
  onToggle,
  onPress,
  destructive,
  accessibilityHint,
}: {
  icon?: ReactNode;
  label: string;
  value?: string;
  trailing?: Trailing;
  toggleValue?: boolean;
  onToggle?: (next: boolean) => void;
  // segmented* props reserved for Phase B; intentionally omitted here.
  onPress?: () => void;
  destructive?: boolean;
  accessibilityHint?: string;
}) {
  if (destructive) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.row, pressed && pressedDim]}
      >
        <Text style={[styles.label, styles.destructiveLabel]}>{label}</Text>
      </Pressable>
    );
  }

  const isToggle = trailing === 'toggle';

  const body = (
    <>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={styles.label}>{label}</Text>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {trailing === 'chevron' ? (
        <CaretRight size={16} color={colors.labelTertiary} weight="regular" />
      ) : null}
      {isToggle ? (
        <Switch
          value={!!toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: colors.cardBorderSubtle, true: colors.freshgreen }}
          thumbColor={colors.white}
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
        />
      ) : null}
    </>
  );

  // Toggle rows are not Pressables — the Switch owns interaction.
  if (isToggle) {
    return <View style={styles.row}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && onPress && pressedDim]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
    flex: 1,
  },
  value: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelSecondary,
  },
  destructiveLabel: {
    ...dynamicType(typography.bodyRegular),
    color: colors.red,
    textAlign: 'center',
    flex: 1,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep SettingsRow`
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add components/settings/SettingsRow.tsx
git commit -m "feat(settings): SettingsRow primitive

One settings row: optional icon + label + trailing (chevron / toggle /
value / none) + destructive red variant. Toggle rows are non-Pressable
(Switch owns interaction); chevron/none rows are Pressables. The
'segmented' trailing is interface-only in Plan 1 (renders as 'none') —
its renderer + props arrive in Phase B.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 4: `/menu` hub retrofit

**Files:**
- Modify: `app/menu.tsx`

This is the most involved retrofit. The profile card, progressive carousel, RowGroups, and sign-out all change. The existing handlers (`handleSignOut`, `handleZonePreferences`, etc.), the `displayName` ladder, `useFuelProfile`, and routing targets all stay.

- [ ] **Step 1: Add imports**

At the top import group, add:
```tsx
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { RowGroup } from '../components/settings/RowGroup';
import { SettingsRow } from '../components/settings/SettingsRow';
import { GasPump } from 'phosphor-react-native/src/icons/GasPump';
```
And ensure `useFuelProfile` is imported (it already is — it's used for `clearFuelProfile` in sign-out). Also confirm `colors` includes `systemGroupedBackground` (it does).

- [ ] **Step 2: Add the carousel-eligibility derivation**

In the component body, near the other `use*` hooks, read the fuel profile for the progressive tile:
```tsx
// Progressive carousel: a tile shows only while its underlying setting
// is UNSET. Refuel reminders is set once remindersEnabled is true.
// (Connect-calendar tile arrives in Plan 2.)
const { profile: fuelProfile } = useFuelProfile();
const showFuelTile = !fuelProfile?.remindersEnabled;
```
Note: `useFuelProfile` is currently destructured only for `clearAll: clearFuelProfile` in the sign-out handler. Extend that destructure to also pull `profile`, or call the hook once and use both. Use the existing call site — change `const { clearAll: clearFuelProfile } = useFuelProfile();` to `const { profile: fuelProfile, clearAll: clearFuelProfile } = useFuelProfile();`.

- [ ] **Step 3: Add the Refuel-reminders handler**

Next to `handleZonePreferences` / `handleSafety` / `handleSavedPlaces` / `handleLegal`:
```tsx
function handleFuel() {
  router.push('/fuel');
}
```

- [ ] **Step 4: Replace the header + scroll content**

Replace the entire `return (...)` JSX from the `<View style={styles.header}>` block through the end of the sign-out `<View style={styles.signOutWrap}>` block with the new structure. The new render:

```tsx
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SettingsHeader title="Settings" onClose={handleBack} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile card — identity anchor, non-tappable (no profile
              edit surface yet). */}
          <View
            style={styles.profileCard}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Hey there, ${displayName}`}
          >
            <Image
              source={AvatarPng}
              style={styles.profileAvatar}
              resizeMode="cover"
              accessible={false}
              accessibilityIgnoresInvertColors
            />
            <View style={styles.profileTextStack}>
              <Text style={styles.profileGreeting}>Hey there,</Text>
              <Text
                style={styles.profileName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {displayName}
              </Text>
            </View>
          </View>

          {/* Progressive carousel — only renders while at least one
              high-impact setting is unset. Plan 1 has one candidate
              tile (Refuel reminders). When it's configured, the whole
              section disappears. */}
          {showFuelTile && (
            <Pressable
              style={({ pressed }) => [styles.tileCard, pressed && pressedDim]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                router.push('/fuel');
              }}
              accessibilityRole="button"
              accessibilityLabel="Set up refuel reminders. Add your fuel cadence so you don't run low in an unsafe spot."
            >
              <View style={styles.tileIcon}>
                <FuelIcon width={32} height={32} />
              </View>
              <Text style={styles.tileTitle}>Set up refuel reminders</Text>
              <Text style={styles.tileSubtitle}>
                Add your fuel cadence so you don&apos;t run low in an unsafe spot.
              </Text>
            </Pressable>
          )}

          {/* App-config group */}
          <RowGroup>
            <SettingsRow
              icon={<GasPump size={24} color={colors.black} weight="duotone" />}
              label="Refuel reminders"
              onPress={handleFuel}
            />
            <SettingsRow
              icon={<MapPinArea size={24} color={colors.black} weight="duotone" />}
              label="Zone Preferences"
              onPress={handleZonePreferences}
            />
            <SettingsRow
              icon={<Shield size={24} color={colors.black} weight="duotone" />}
              label="Safety"
              onPress={handleSafety}
            />
            <SettingsRow
              icon={<Bookmark size={24} color={colors.black} weight="duotone" />}
              label="Saved places"
              onPress={handleSavedPlaces}
            />
          </RowGroup>

          {/* About group */}
          <RowGroup>
            <SettingsRow
              icon={<FileText size={24} color={colors.black} weight="duotone" />}
              label="Privacy & Terms"
              onPress={handleLegal}
            />
          </RowGroup>

          {/* Sign out — destructive, its own bottom group */}
          <RowGroup>
            <SettingsRow
              label="Sign out"
              destructive
              onPress={handleSignOut}
            />
          </RowGroup>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
```

Notes:
- `handleBack` (the existing function that calls `router.back()`) is reused as `onClose` — on `/menu`, closing the settings hub returns to wherever the user came from (typically `/home`), which is exactly `router.back()`. No behavior change to the dismiss target; only the control's glyph changes (chevron → X).
- The `FlatList` carousel + `PageControl` are removed. With one tile in Plan 1 there's no horizontal scroll; the single tile renders as a full-width card. (Plan 2 reintroduces the horizontal FlatList when there are 2 candidate tiles. For Plan 1, a single conditional Pressable card is correct and simpler.)
- `QUICK_TILES`, `activeQuickIndex` state, `handleQuickScrollEnd`, `TILE_GAP`/`TILE_WIDTH`/`SNAP_INTERVAL`, `PageControl` import, and the `signOutWrap`/`signOutPressable`/`signOutText` styles + the disabled/ActivityIndicator sign-out treatment become unused. Delete them (see Step 6).

- [ ] **Step 5: Update styles**

In the StyleSheet:
- `root.backgroundColor`: `colors.white` → `colors.systemGroupedBackground`.
- `scrollContent`: set `padding: spacing.lg` and `gap: spacing.lg` (the gray gutter between groups). Remove any prior horizontal-only padding that assumed full-bleed rows.
- Add `profileCard` (replaces `profileRow` + `divider`):
```tsx
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    ...shadows.e1,
  },
```
- Keep `profileAvatar`, `profileTextStack`, `profileGreeting`, `profileName` as-is (they style content inside the card).
- Keep `tileCard`, `tileIcon`, `tileTitle`, `tileSubtitle` but ensure `tileCard` is a standalone white card: it should already have `backgroundColor: colors.white` + border/shadow; if it uses the wiltedgreen border treatment, leave it — the carousel tile is allowed its own accent per the existing design. Drop the `width: TILE_WIDTH` inline (no longer in a horizontal list).
- Add `import { radii } from '../theme/radii';` and `import { shadows } from '../theme/shadows';` if not already imported (shadows likely is; radii likely is not — check).

- [ ] **Step 6: Delete orphaned code**

Remove now-unused symbols: `QUICK_TILES` const + its `QuickTile`/`QuickTileEntry` types, `PageControl` import, `FlatList` import (if unused elsewhere in the file), `activeQuickIndex` + `setActiveQuickIndex`, `handleQuickScrollEnd`, `TILE_GAP`/`TILE_WIDTH`/`SNAP_INTERVAL`, `reduceMotion` (if now unused — it was used by the carousel snap), the inline `SettingsRow` function (replaced by the imported primitive), and the `row`/`rowIconWrap`/`rowLabel`/`rowList`/`divider`/`profileRow`/`quickWrap`/`quickContent`/`signOutWrap`/`signOutPressable`/`signOutText` styles. **Run a grep for each deleted symbol name to confirm no remaining references before deleting its definition.**

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"`
Expected: empty. (If anything references a deleted symbol, it surfaces here — fix by removing the reference.)

- [ ] **Step 8: Commit**

```bash
git add app/menu.tsx
git commit -m "feat(menu): retrofit hub to settings register

SettingsHeader (title=Settings, close-X only — root has no parent).
Profile becomes a white card on grouped-gray. Carousel becomes a
single progressive Refuel-reminders tile that hides once reminders
are enabled (Plan 2 reintroduces the horizontal FlatList for the 2nd
tile). Rows split into app-config + about + sign-out RowGroups, with
a NEW Refuel-reminders row (closes the carousel-only access gap).
Sign-out becomes a destructive SettingsRow. Inline SettingsRow,
QUICK_TILES, PageControl, and the old custom sign-out link removed.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 5: `/zone-preferences` retrofit

**Files:**
- Modify: `app/zone-preferences.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { RowGroup } from '../components/settings/RowGroup';
import { SettingsRow } from '../components/settings/SettingsRow';
```
Remove the `CaretLeft` import (the header primitive owns it now) and the `MapPinArea` import (hero glyph retires) — but ONLY if they're not used elsewhere in the file (grep first).

- [ ] **Step 2: Replace header + title row + toggle layout**

Replace the bare back-chevron strip + the 48pt `MapPinArea` hero title row with a SettingsHeader, and wrap the toggles in two RowGroups. The new render body inside `<SafeAreaView>`:

```tsx
        <SettingsHeader
          title="Zone Preferences"
          onBack={() => router.back()}
          onClose={handleClose}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <RowGroup>
            <SettingsRow
              label="Show zones overlay"
              trailing="toggle"
              toggleValue={preferences.showZones}
              onToggle={(v) => setPreference('showZones', v)}
              accessibilityHint="Shows or hides the zone safety overlay on the map"
            />
          </RowGroup>

          <RowGroup
            title="What we flag"
            footer="Affects route scoring and map flags."
          >
            <SettingsRow
              label="Police presence"
              trailing="toggle"
              toggleValue={preferences.flagPolice}
              onToggle={(v) => setPreference('flagPolice', v)}
              accessibilityHint="Routes around mapped police presence when on"
            />
            <SettingsRow
              label="Low-light areas"
              trailing="toggle"
              toggleValue={preferences.flagLowLight}
              onToggle={(v) => setPreference('flagLowLight', v)}
              accessibilityHint="Routes around poorly-lit streets when on"
            />
            <SettingsRow
              label="Community reports"
              trailing="toggle"
              toggleValue={preferences.flagCommunityReports}
              onToggle={(v) => setPreference('flagCommunityReports', v)}
              accessibilityHint="Factors neighbor-submitted reports when on"
            />
          </RowGroup>
        </ScrollView>
```

Notes:
- Use the existing `setPreference` / preferences-reading hook surface this file already imports. The file currently reads `preferences.showZones` etc.; preserve that. If the file uses `DEFAULT_PREFERENCES` fallback (`const prefs = preferences ?? DEFAULT_PREFERENCES`), keep that pattern and read from `prefs`.
- `handleClose`: add a handler `function handleClose() { router.canGoBack() ? router.dismissAll?.() ?? router.back() : router.replace('/home'); }` — simplest correct version: `function handleClose() { router.back(); }` if the page is always one level under /menu. **Use `router.dismissAll()` if available; otherwise** define `handleClose` as popping to `/home`: `router.replace('/home')` is the safe universal close. Pick `router.replace('/home')` for the close-X so "close" always means "leave settings entirely," distinct from chevron-back's "up one level."

- [ ] **Step 3: Update styles**

- Page `root.backgroundColor` (or the equivalent top container) → `colors.systemGroupedBackground`.
- `scrollContent`: `padding: spacing.lg`, `gap: spacing.lg`.
- Delete the retired styles: the hero `titleRow`, `pageTitle`, the old `header`/`headerBackBtn` (replaced by SettingsHeader), and the old `groupCaption`/`toggleRow`/`toggleLabel` if RowGroup+SettingsRow now own that styling. Grep each before deleting.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"`
Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add app/zone-preferences.tsx
git commit -m "feat(zone-preferences): retrofit to settings register

SettingsHeader (title + chevron-back + close-X), two RowGroups
(display toggle / 'What we flag' flags with footer caption), grouped-
gray bg. 48pt MapPinArea hero glyph retires — page identity moves to
the header title. Same usePreferences surface, no behavior change.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 6: `/safety-settings` retrofit

**Files:**
- Modify: `app/safety-settings.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { RowGroup } from '../components/settings/RowGroup';
import { SettingsRow } from '../components/settings/SettingsRow';
```
Remove `CaretLeft` (header owns it) and `Shield` (hero glyph retires) if unused elsewhere — grep. The per-row glyphs (Emergency-SOS red asterisk, UserCircle for Trusted Contact, Microphone for Recordings) STAY as row icons.

- [ ] **Step 2: Replace header + hero + row list**

```tsx
        <SettingsHeader
          title="Safety"
          onBack={() => router.back()}
          onClose={() => router.replace('/home')}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <RowGroup>
            <SettingsRow
              icon={<Asterisk size={24} color={colors.red} weight="bold" />}
              label="Emergency SOS"
              value="Reach a trusted contact or 911"
              onPress={() => router.push('/emergency')}
            />
            <SettingsRow
              icon={<UserCircle size={24} color={colors.black} weight="duotone" />}
              label="Trusted Contact"
              value={trustedContactValue}
              onPress={handleEditTrustedContact}
            />
            <SettingsRow
              icon={<Microphone size={24} color={colors.black} weight="duotone" />}
              label="Recordings"
              onPress={handleRecordings}
            />
          </RowGroup>
        </ScrollView>
```

Notes:
- Reuse the file's existing `trustedContactValue` (the "name when set / 'Add someone you trust' otherwise" string) and existing handlers `handleEditTrustedContact` / `handleRecordings`. The Emergency-SOS `value` text replaces the prior sub-line.
- The `value` field will render the sub-line text right-aligned per the SettingsRow primitive. If the spec's intent is for these sub-lines to read as left-aligned secondary text under the label (the prior two-line row), note that SettingsRow's `value` is right-aligned (iOS Settings style). For this retrofit, right-aligned `value` is the chosen register — accept the visual change. (If a two-line label+sub-line variant is wanted later, that's a SettingsRow enhancement, out of scope here.)
- The per-row glyph sizes drop from 28pt (old hero-adjacent rows) to 24pt to match the SettingsRow icon column. Keep the Asterisk red + bold, UserCircle/Microphone black + duotone.

- [ ] **Step 3: Update styles**

- Top container bg → `colors.systemGroupedBackground`.
- `scrollContent`: `padding: spacing.lg`, `gap: spacing.lg`.
- Delete retired styles: hero `titleRow`/`pageTitle`, old `header`/`headerBackBtn`, the old `row`/`rowTextStack`/`rowLabel`/`rowValue`/`rowGroup` if now owned by the primitives. Grep each.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"`
Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add app/safety-settings.tsx
git commit -m "feat(safety-settings): retrofit to settings register

SettingsHeader + one RowGroup (Emergency SOS / Trusted Contact /
Recordings), grouped-gray bg. 48pt Shield hero retires; per-row
glyphs stay (red Asterisk SOS, UserCircle, Microphone) at 24pt.
Same handlers + trustedContactValue, no behavior change.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 7: `/saved-places` retrofit

**Files:**
- Modify: `app/saved-places.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { RowGroup } from '../components/settings/RowGroup';
```
Keep `CaretLeft`? No — header owns it; remove if unused. Remove `Bookmark` (hero retires) if unused. The per-row `House`/`MapPin` glyphs and the `Trash` remove-affordance STAY (they're in the row, not the hero). This page uses its own bespoke `SavedPlaceRow` (icon + name + date + Trash), which is NOT the generic SettingsRow — keep `SavedPlaceRow`, just place it inside a RowGroup.

- [ ] **Step 2: Replace header + wrap list**

```tsx
        <SettingsHeader
          title="Saved places"
          onBack={() => router.back()}
          onClose={() => router.replace('/home')}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {savedPlaces.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No saved places yet</Text>
              <Text style={styles.emptyBody}>
                Save a Home from the map or a landmark from Search, and
                they&apos;ll appear here so you can review or remove them.
              </Text>
            </View>
          ) : (
            <RowGroup>
              {savedPlaces.map((place) => (
                <SavedPlaceRow
                  key={place.id}
                  place={place}
                  onRemove={() => handleRemove(place)}
                />
              ))}
            </RowGroup>
          )}
        </ScrollView>
```

Notes:
- `SavedPlaceRow` stays as the bespoke row component (it has a Trash button, not a chevron). RowGroup wraps it and provides the separators. Verify `SavedPlaceRow`'s outer style no longer needs its own card chrome (`shadows.e1` / borderRadius) — RowGroup owns the card now, so strip per-row card styling from `SavedPlaceRow` (it should be a flat row; grep its style for `shadows`/`borderRadius`/`backgroundColor` and remove those, keeping padding + flexDirection).
- Empty state sits directly on the gray bg (no white card) per spec.

- [ ] **Step 3: Update styles**

- Top container bg → `colors.systemGroupedBackground`.
- `scrollContent`: `padding: spacing.lg`, `gap: spacing.lg`.
- `SavedPlaceRow`'s `row` style: remove `backgroundColor`, `borderRadius`, `shadows.e1` (RowGroup owns the card). Keep `flexDirection`, `alignItems`, `gap`, `minHeight`, `paddingHorizontal: spacing.md`, `paddingVertical: spacing.sm`.
- Delete retired hero `titleRow`/`pageTitle` + old `header`/`headerBackBtn`. Grep.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"`
Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add app/saved-places.tsx
git commit -m "feat(saved-places): retrofit to settings register

SettingsHeader + the saved-place rows wrapped in a RowGroup (the
bespoke SavedPlaceRow stays — it has a Trash affordance, not a
chevron — but sheds its per-row card chrome to RowGroup). Empty state
sits on the grouped-gray bg. 48pt Bookmark hero retires.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 8: `/fuel` retrofit

**Files:**
- Modify: `app/fuel.tsx`

`/fuel` is a form (TextInput, fuel-type picker, Switch, cadence stepper, status + "I filled up"). Retrofit wraps the form fields in RowGroups under a SettingsHeader. The form LOGIC (handlers, `useFuelProfile`, hydration, save) is unchanged — only chrome + grouping.

- [ ] **Step 1: Add imports**

```tsx
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { RowGroup } from '../components/settings/RowGroup';
```
Remove `CaretLeft` (header owns it) if unused.

- [ ] **Step 2: Replace header + group the form**

Replace the bare chevron strip + title with SettingsHeader, and wrap the existing form controls in RowGroups. Keep every existing control (TextInput for car name, the 4-way fuel-type picker, the reminders Switch, the cadence stepper, the status block + "I filled up"). Structure:

```tsx
        <SettingsHeader
          title="Refuel reminders"
          onBack={() => router.back()}
          onClose={() => router.replace('/home')}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <RowGroup title="Your car">
            {/* existing car-name TextInput row */}
            {/* existing fuel-type picker (4-way) — rendered as-is inside
                the group; the segmented primitive lands in Phase B */}
          </RowGroup>

          <RowGroup title="Reminder">
            {/* existing reminders-enabled Switch row */}
            {/* existing cadence stepper row */}
          </RowGroup>

          {profile?.remindersEnabled && nextLabel && (
            <RowGroup footer="Tap “I filled up” to reset the cadence clock.">
              {/* existing "Next reminder: …" status + "I filled up" button */}
            </RowGroup>
          )}

          {/* existing Save button stays below the groups (full-width CTA,
              not a row) */}
        </ScrollView>
```

Notes:
- This is a structural wrap of EXISTING controls, not a rewrite. Move each existing form control inside the appropriate RowGroup, preserving its handlers, state bindings, and the existing `keyboardShouldPersistTaps`/`KeyboardAvoidingView` behavior (keep the KeyboardAvoidingView wrapper if present).
- The fuel-type picker stays exactly as today (4 pressable chips/segments). Don't convert it to the SettingsRow `segmented` variant — that renderer doesn't exist until Phase B.
- The Save button (`handleSave`) stays as a full-width CTA below the groups, not inside a RowGroup.
- Because `/fuel` is reached BOTH from `/menu`'s row AND (in Plan 1) the carousel tile, `onBack` returns to wherever it came from (`router.back()`); `onClose` exits settings to `/home`.

- [ ] **Step 3: Update styles**

- Top container bg → `colors.systemGroupedBackground`.
- `scrollContent`: `padding: spacing.lg`, `gap: spacing.lg`.
- Form-field rows: each control's row gets `paddingHorizontal: spacing.md`, `paddingVertical: spacing.sm`, `minHeight: 44`, flat (no per-row card chrome — RowGroup owns it). The existing `title.paddingTop: spacing.lg` chevron-spacing fix is removed (the SettingsHeader supersedes the old title element).
- Delete retired `header`/title styles. Grep.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"`
Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add app/fuel.tsx
git commit -m "feat(fuel): retrofit to settings register

SettingsHeader (title=Refuel reminders) + form regrouped into
RowGroups (Your car / Reminder / current-state). Fuel-type picker
stays as-is (segmented primitive deferred to Phase B). Save stays a
full-width CTA below the groups. Grouped-gray bg. Form logic, hooks,
and handlers unchanged — chrome + grouping only.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 9: `/legal` retrofit

**Files:**
- Modify: `app/legal.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { SettingsHeader } from '../components/settings/SettingsHeader';
```
Remove `CaretLeft` if it was the page's back control and is now unused. RowGroup may or may not be needed (the content body can wrap in a single card View directly — see below).

- [ ] **Step 2: Replace header; wrap content in a card**

```tsx
        <SettingsHeader
          title="Privacy & Terms"
          onBack={() => router.back()}
          onClose={() => router.replace('/home')}
        />

        {/* tab pills stay exactly as today — they're the page's primary nav */}
        {/* …existing tab-pill row… */}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentCard}>
            {/* existing active-tab markdown/legal body */}
          </View>
        </ScrollView>
```

Notes:
- Keep the Privacy/Terms/Licenses tab pills and their active-state logic untouched — they're not SettingsRows, they're the page's own segmented nav.
- The legal body text wraps in a white card (`contentCard`) on the gray bg, rather than a RowGroup (it's prose, not rows). Use the same card chrome RowGroup uses so it reads consistent: `backgroundColor: colors.white`, `borderRadius: radii.md`, `padding: spacing.md`, `shadows.e1`.

- [ ] **Step 3: Update styles**

- Top container bg → `colors.systemGroupedBackground`.
- `scrollContent`: `padding: spacing.lg`, `gap: spacing.lg`.
- Add `contentCard` style (white card chrome above).
- Delete retired `header`/`headerBackBtn` if replaced by SettingsHeader. Grep.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"`
Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add app/legal.tsx
git commit -m "feat(legal): retrofit to settings register

SettingsHeader + content body wrapped in a white card on grouped-gray.
Privacy/Terms/Licenses tab pills kept as-is (page's primary nav).

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 10: Verification

**Files:** none modified.

- [ ] **Step 1: Full typecheck baseline**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"; echo "tsc done"`
Expected: empty then `tsc done`.

- [ ] **Step 2: Orphan sweep**

For each page, grep for symbols the retrofit should have removed (old `header`/`headerBackBtn`/`titleRow`/`pageTitle` styles, inline `SettingsRow` in menu, `QUICK_TILES`, `PageControl`, `FlatList`):
```bash
grep -n "titleRow\|pageTitle\|QUICK_TILES\|PageControl\|signOutWrap\|signOutPressable" app/menu.tsx app/zone-preferences.tsx app/safety-settings.tsx app/saved-places.tsx app/fuel.tsx app/legal.tsx
```
Expected: empty (all retired symbols gone).

- [ ] **Step 3: Simulator pass**

Launch (`npx expo start --ios`). For each of the 6 pages:
1. **Header chrome** — `/menu` shows title "Settings" + close-X only (NO chevron). Each child page shows chevron-back + title + close-X.
2. **Navigation** — child chevron-back returns to `/menu`; child close-X exits to `/home`; `/menu` close-X exits to `/home`.
3. **Grouped register** — gray page bg, white row-group cards, visible gray gutter between groups, hairline separators between rows within a group (inset under the label, not the icon).
4. **`/menu` progressive carousel** — with refuel reminders OFF, the "Set up refuel reminders" tile shows. Enable reminders in `/fuel`, return to `/menu` → tile is gone. The "Refuel reminders" row in the app-config group is present in both states.
5. **Toggles** — `/zone-preferences` toggles flip and persist (background → reopen).
6. **Sign out** — `/menu`'s sign-out row is red, centered, and runs the existing sign-out flow.

- [ ] **Step 4: Dynamic Type spot check**

Bump iOS text size to a large accessibility setting. Confirm row labels (17pt base) scale, titles scale, and no row clips. The `dynamicType()` wraps carry this; this step confirms no fixed-height row truncates.

- [ ] **Step 5: No final commit needed**

The feature shipped across Tasks 1–9. If verification surfaced issues, fix as new commits before considering the plan complete.

---

## Self-review (writing-plans skill)

**Spec coverage:**
- Spec § New primitives → Tasks 1–3. ✓
- Spec § `/menu` (hub) → Task 4. ✓ (profile card, progressive carousel w/ Refuel tile only, app-config + about + sign-out RowGroups, new Refuel-reminders row, close-X-only header). The Connect-calendar tile is correctly absent — it's Plan 2.
- Spec § `/zone-preferences` → Task 5. ✓ (two RowGroups, eyebrow + footer, hero retire).
- Spec § `/safety-settings` → Task 6. ✓ (one RowGroup, per-row glyphs stay, hero retire).
- Spec § `/saved-places` → Task 7. ✓ (RowGroup wraps bespoke SavedPlaceRow, empty state on gray, hero retire).
- Spec § `/fuel` → Task 8. ✓ (form regrouped, picker as-is, Save CTA below).
- Spec § `/legal` → Task 9. ✓ (tab pills kept, content card on gray).
- Spec § Accessibility → covered per-task (44pt controls in Task 1, eyebrow `role=header` in Task 2, toggle label+hint in Tasks 3/5, destructive label in Tasks 3/4).
- Spec § calendar feature → correctly NOT in this plan (Plan 2).

**Placeholder scan:** Retrofit tasks (5–9) intentionally reference "the existing X control" because the retrofit *moves* existing code rather than rewriting it — each such reference names the exact control + its existing handler/state binding + shows the new wrapping JSX, which is the actual code change. Net-new code (the 3 primitives, `/menu`'s new render) is shown in full. No "TBD"/"handle appropriately"/vague-error-handling.

**Type consistency:** Primitive prop names (`title`/`onBack`/`onClose` on SettingsHeader; `title`/`footer`/`children` on RowGroup; `icon`/`label`/`value`/`trailing`/`toggleValue`/`onToggle`/`onPress`/`destructive`/`accessibilityHint` on SettingsRow) are used identically across all consuming tasks. `setPreference` (zone-prefs), `trustedContactValue` + `handleEditTrustedContact` + `handleRecordings` (safety-settings), `SavedPlaceRow` + `handleRemove` (saved-places), `useFuelProfile` (`profile` + `clearAll`) match the existing files' surfaces.

**One judgment flagged for the implementer:** Task 6's `/safety-settings` sub-lines become right-aligned `value` text (iOS Settings style) instead of the prior left-aligned two-line label+subline. This is a deliberate register change, noted in the task. If it reads worse in the simulator than the two-line treatment, that's a SettingsRow `subtitle` enhancement to consider — out of scope for this plan, log it.

No gaps. Plan complete.
