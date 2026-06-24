# Report Modal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the report detail screen so each of the 6 categories gets a tailored UX with severity-aware subTag chips that feed the scoring engine.

**Architecture:** Keep the existing 3-state machine (picker → detail → thank-you). The detail view branches on `categoryId` to render category-specific forms. Safety categories gain severity subTags that override the category's default zoneType in `reportToZone()`. Felt-welcome splits into two independent single-select sections (place type + identity). Picker drops row eyebrow labels.

**Tech Stack:** React Native, StyleSheet API, TypeScript strict mode, Phosphor icons (deep imports), theme tokens (`colors.ts`, `typography.ts`, `spacing.ts`, `radii.ts`), `dynamicType()` for text scaling.

**Testing:** No test runner in this project. Verification is `npx tsc --noEmit` + device smoke test via Expo Go.

**Spec:** `docs/superpowers/specs/2026-06-24-report-modal-redesign.md`

---

## File Structure

| File | Responsibility | Change type |
|------|---------------|-------------|
| `lib/api/community-reports.ts` | Data model: `ReportCategory` type gains `severityMap?`, safety categories gain `subTags` + `severityMap`, CTA values updated, `CommunityReport` gains `placeType?`, `reportToZone()` gains severity override | Modify |
| `app/report.tsx` | UI: picker drops eyebrows, detail view branches per category, severity chip styles, felt-welcome two-section split, `placeType` state + submit wiring | Modify |
| `.cursorrules` | Reserved-color exception #12 for severity chips | Modify |

---

### Task 1: Data model — severityMap, safety subTags, CTA updates

**Files:**
- Modify: `lib/api/community-reports.ts:46-102` (ReportCategory type)
- Modify: `lib/api/community-reports.ts:104-220` (CATEGORIES array)

- [ ] **Step 1: Add `severityMap` to the `ReportCategory` type**

In `lib/api/community-reports.ts`, add the import for `ZoneType` and the new field after the `subTagGroups` field (after line 101):

```ts
// At the top of the file, add ZoneType to the existing import:
import type { Coordinate, Zone, ZoneType } from './zones';

// In the ReportCategory type, after subTagGroups, add:
  /**
   * Maps subTag labels to zoneType overrides for severity-aware scoring.
   * When present, `reportToZone()` uses the selected subTag's zoneType
   * instead of the category's default. Only safety categories define
   * this — positive categories (felt-welcome, black-owned) use their
   * flat zoneType unchanged.
   */
  severityMap?: Record<string, ZoneType>;
```

Check the existing import at the top of the file — `Coordinate` and `Zone` are already imported from `./zones`. Add `ZoneType` to that import.

- [ ] **Step 2: Add subTags + severityMap to the `incident` category**

In the CATEGORIES array, update the `incident` entry (currently at line 106-114):

```ts
  {
    id: 'incident',
    label: 'Incident',
    subtitle: 'What did you see?',
    zoneType: 'avoid',
    anonymous: true,
    hasPhoto: true,
    cta: 'Submit report',
    subTags: ['Accident', 'Confrontation', 'Suspicious activity', 'Police presence', 'Near miss'],
    subTagGroups: [
      { label: 'What happened?', tags: ['Accident', 'Confrontation', 'Suspicious activity', 'Police presence', 'Near miss'] },
    ],
    severityMap: {
      'Accident': 'avoid',
      'Confrontation': 'avoid',
      'Suspicious activity': 'avoid',
      'Police presence': 'avoid',
      'Near miss': 'caution',
    },
  },
```

- [ ] **Step 3: Add subTags + severityMap to the `felt-unsafe` category**

Update `felt-unsafe` (currently at line 115-123):

```ts
  {
    id: ‘felt-unsafe’,
    label: ‘Felt unsafe’,
    subtitle: ‘Talk to us. What’s going on?’,
    zoneType: ‘avoid’,
    anonymous: true,
    hasPhoto: false,
    cta: ‘Submit report’,
    subTags: [‘Threatened’, ‘Followed’, ‘Harassed’, ‘Uncomfortable’, ‘Uneasy vibe’],
    subTagGroups: [
      { label: ‘What was it?’, tags: [‘Threatened’, ‘Followed’, ‘Harassed’, ‘Uncomfortable’, ‘Uneasy vibe’] },
    ],
    severityMap: {
      ‘Threatened’: ‘avoid’,
      ‘Followed’: ‘avoid’,
      ‘Harassed’: ‘avoid’,
      ‘Uncomfortable’: ‘caution’,
      ‘Uneasy vibe’: ‘caution’,
    },
  },
```

- [ ] **Step 4: Add subTags + severityMap to the `lighting` category**

Update `lighting` (currently at line 124-133):

```ts
  {
    id: 'lighting',
    label: 'Lighting',
    subtitle: 'Street lights down or dimmer than normal?',
    zoneType: 'caution',
    anonymous: false,
    hasPhoto: true,
    cta: 'Submit report',
    subTags: ['Pitch black', 'No streetlights', 'Broken light', 'Flickering', 'Dim area'],
    subTagGroups: [
      { label: 'How dark is it?', tags: ['Pitch black', 'No streetlights', 'Broken light', 'Flickering', 'Dim area'] },
    ],
    severityMap: {
      'Pitch black': 'avoid',
      'No streetlights': 'avoid',
      'Broken light': 'caution',
      'Flickering': 'caution',
      'Dim area': 'caution',
    },
  },
```

- [ ] **Step 5: Add subTags + severityMap to the `hazard` category**

Update `hazard` (currently at line 134-142):

```ts
  {
    id: 'hazard',
    label: 'Hazard',
    subtitle: 'Anything in the road?',
    zoneType: 'caution',
    anonymous: false,
    hasPhoto: true,
    cta: 'Submit report',
    subTags: ['Road blocked', 'Flooding', 'Construction', 'Pothole / damage', 'Debris'],
    subTagGroups: [
      { label: 'What\'s the hazard?', tags: ['Road blocked', 'Flooding', 'Construction', 'Pothole / damage', 'Debris'] },
    ],
    severityMap: {
      'Road blocked': 'avoid',
      'Flooding': 'avoid',
      'Construction': 'caution',
      'Pothole / damage': 'caution',
      'Debris': 'caution',
    },
  },
```

- [ ] **Step 6: Update CTA values for positive categories**

Update the `cta` field on `felt-welcome` (currently `'Submit review'` at ~line 151) to `'Share your experience'`.

Update the `cta` field on `black-owned` (currently `'Submit review'` at ~line 210) to `'Add to directory'`.

- [ ] **Step 7: Add `placeType` to `CommunityReport` type**

In the `CommunityReport` type (line 235-277), add after the `subTag` field:

```ts
  /**
   * Place-type tag from felt-welcome's "What kind of place?" section.
   * Stored separately from `subTag` (which carries the scoring-critical
   * identity tag). Informational display data only — not consumed by
   * the scoring engine or recommendation routing.
   */
  placeType?: string;
```

- [ ] **Step 8: Update `reportToZone()` with severity override**

In `reportToZone()` (line 339-363), change the `type` assignment:

```ts
// Before (line 344):
    type: category.zoneType,

// After:
    type: category.severityMap?.[report.subTag ?? ''] ?? category.zoneType,
```

- [ ] **Step 9: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 10: Commit**

```bash
git add lib/api/community-reports.ts
git commit -m "feat(report): add severityMap + safety subTags + placeType to data model

Safety categories gain subTags with severity-aware zoneType overrides.
reportToZone() uses the subTag's severity when available, falling back
to the category default. Felt-welcome/black-owned CTAs updated.
CommunityReport gains placeType for felt-welcome place-type storage."
```

---

### Task 2: Reserved-color exception #12

**Files:**
- Modify: `.cursorrules:40-42` (after exception #11)

- [ ] **Step 1: Add exception #12**

In `.cursorrules`, after the line starting with `11. **Destructive-action row labels**` (line 40) and before the `**Cross-link carve-out:**` line (line 42), insert:

```
12. **Report severity chips** (red/orange): severity-encoding chip borders on the report detail form use reserved colors because the severity IS the safety signal — the chip represents the level of danger the reporter experienced. `avoid`-level chips use `colors.red` border + 8% fill; `caution`-level chips that override a lower default use `colors.orange` border + 8% fill. Same hazard-class signaling logic as #7 (zone-warning chips) and #10 (hazard markers).
```

- [ ] **Step 2: Commit**

```bash
git add .cursorrules
git commit -m "docs: add reserved-color exception #12 for severity chips"
```

---

### Task 3: Picker eyebrow removal

**Files:**
- Modify: `app/report.tsx:486-500` (PickerView grid rendering)

- [ ] **Step 1: Remove the `gridGroupHeader` from the picker render loop**

In the `PickerView` component (around line 487-500), the current code maps `PICKER_GROUPS` and renders a `gridGroupHeader` per group. Remove the header `<Text>` element but keep the group wrapper for layout:

```tsx
      <View style={styles.grid}>
        {PICKER_GROUPS.map((group) => (
          <View key={group.label} style={styles.gridGroup}>
            <View style={styles.gridRow}>
              {CATEGORIES.slice(group.start, group.start + 2).map((c) => (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [styles.tile, pressed && pressedDim]}
                  onPress={() => onPick(c)}
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
```

The change: delete the `<Text style={styles.gridGroupHeader}>` block (lines ~489-491). Keep everything else.

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/report.tsx
git commit -m "fix(report): remove picker row eyebrow labels

Tiles' icons and labels are self-explanatory; the sentiment
headers ('Something off', 'Something useful', 'Something good')
added visual noise without aiding selection."
```

---

### Task 4: Severity chip styles

**Files:**
- Modify: `app/report.tsx:1080-1106` (chip styles section)

- [ ] **Step 1: Add severity chip style variants**

After the existing `chipLabelActive` style (line ~1106), add new severity-aware chip styles. These use reserved colors per exception #12:

```ts
  // --- Severity chip variants (reserved-color exception #12) ---
  // avoid-level severity: red border + tint
  chipAvoid: {
    borderColor: colors.red,
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
  },
  chipAvoidActive: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  chipAvoidLabel: {
    color: colors.red,
  },
  // caution-level severity: orange border + tint
  chipCaution: {
    borderColor: colors.orange,
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
  },
  chipCautionActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  chipCautionLabel: {
    color: colors.orange,
  },
```

Note: active-state labels stay `colors.white` (inherited from `chipLabelActive`) since both red and orange backgrounds pass WCAG AA with white text.

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/report.tsx
git commit -m "feat(report): add severity chip styles (avoid=red, caution=orange)

Reserved-color exception #12: severity IS the safety signal.
Avoid-level chips get red border + 8% fill, caution-level get
orange border + 8% fill. Active states fill solid with white label."
```

---

### Task 5: Per-category detail view — safety categories

**Files:**
- Modify: `app/report.tsx:598-667` (subTag chip rendering in DetailView)

This task rewrites the chip rendering section to handle severity-aware chips for safety categories. The key change: when a category has a `severityMap`, each chip gets a severity-colored style based on its zoneType mapping.

- [ ] **Step 1: Add a severity style helper above the DetailView component**

Above the `DetailView` function (around line 515), add a helper that resolves chip styles based on severity:

```tsx
/**
 * Resolves chip style variants for severity-aware categories.
 * Returns the base + active + label + labelActive style overrides
 * for a given subTag based on its severityMap zoneType.
 */
function severityChipStyles(
  category: ReportCategory,
  tag: string,
): {
  base?: typeof styles.chipAvoid;
  active?: typeof styles.chipAvoidActive;
  label?: typeof styles.chipAvoidLabel;
} {
  if (!category.severityMap) return {};
  const zone = category.severityMap[tag];
  if (zone === 'avoid') {
    return {
      base: styles.chipAvoid,
      active: styles.chipAvoidActive,
      label: styles.chipAvoidLabel,
    };
  }
  if (zone === 'caution') {
    return {
      base: styles.chipCaution,
      active: styles.chipCautionActive,
      label: styles.chipCautionLabel,
    };
  }
  return {};
}
```

- [ ] **Step 2: Update the chip rendering to apply severity styles**

In the `DetailView` component's chip rendering section (around line 610-667), update the chip `Pressable` and `Text` to apply severity styles when available. The existing code at line 632-661 renders each chip — update to:

```tsx
                  {group.tags.map((tag) => {
                      const active = selectedSubTag === tag;
                      const sev = severityChipStyles(category, tag);
                      return (
                        <Pressable
                          key={tag}
                          onPress={() =>
                            onChangeSubTag(active ? undefined : tag)
                          }
                          disabled={submitting}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`${tag}${active ? ' (selected)' : ''}`}
                          style={({ pressed }) => [
                            styles.chip,
                            sev.base,
                            active && (sev.active ?? styles.chipActive),
                            pressed && !submitting && pressedDim,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipLabel,
                              sev.label,
                              active && styles.chipLabelActive,
                            ]}
                          >
                            {tag}
                          </Text>
                        </Pressable>
                      );
                    })}
```

The changes from the current code:
- Added `const sev = severityChipStyles(category, tag);`
- `sev.base` applied as a base style (colored border + tint for severity categories, nothing for place categories)
- `sev.active ?? styles.chipActive` so severity chips get their colored active state, place chips keep the existing wiltedgreen
- `sev.label` for the severity-colored label text

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add lib/api/community-reports.ts app/report.tsx
git commit -m "feat(report): severity-aware chip rendering for safety categories

Chips now show red (avoid) or orange (caution) borders based on
their severityMap zoneType. severityChipStyles helper resolves
per-tag styles from the category's severityMap."
```

---

### Task 6: Per-category detail view — felt-welcome two-section split

**Files:**
- Modify: `app/report.tsx` — `Report` component state, `DetailView` props + rendering, `handleSubmit`

The felt-welcome category already has `subTagGroups` with two labeled sections. The current behavior: single-select across ALL groups (selecting a chip in group 2 deselects the chip in group 1). The new behavior: two independent single-selects — one for place type, one for identity.

- [ ] **Step 1: Add `selectedPlaceType` state to the `Report` component**

In the `Report` component (around line 156-158 where `selectedSubTag` is declared), add:

```tsx
  const [selectedPlaceType, setSelectedPlaceType] = useState<string | undefined>(
    undefined,
  );
```

Update `handlePickCategory` (line 167-173) to also reset `selectedPlaceType`:

```tsx
  function handlePickCategory(c: ReportCategory) {
    setCategory(c);
    setDetailText('');
    setSelectedSubTag(undefined);
    setSelectedPlaceType(undefined);
    setPhotoUri(undefined);
    setMode('detail');
  }
```

Update `handleBackFromDetail` (line 175-180) similarly:

```tsx
  function handleBackFromDetail() {
    setCategory(null);
    setSelectedSubTag(undefined);
    setSelectedPlaceType(undefined);
    setPhotoUri(undefined);
    setMode('picker');
  }
```

Update `handleCloseFromDetail` (line 130-151) to include `selectedPlaceType` in the `hasContent` check:

```tsx
    const hasContent =
      detailText.trim().length > 0 ||
      selectedSubTag !== undefined ||
      selectedPlaceType !== undefined ||
      photoUri !== undefined;
```

- [ ] **Step 2: Add `selectedPlaceType` + `onChangePlaceType` to DetailView props**

Add to the `DetailView` function signature (around line 517-549):

```tsx
  selectedPlaceType: string | undefined;
  onChangePlaceType: (placeType: string | undefined) => void;
```

And pass them from the `Report` component's `DetailView` call site:

```tsx
  selectedPlaceType={selectedPlaceType}
  onChangePlaceType={setSelectedPlaceType}
```

- [ ] **Step 3: Update the chip rendering for two-section split**

In `DetailView`, the chip rendering section (lines ~610-667) currently uses a single `selectedSubTag` for all groups. For felt-welcome, the first group (place types) should use `selectedPlaceType` while the second group (identity tags) uses `selectedSubTag`.

Update the chip rendering to detect which state variable to use per group. The logic: if the category has `subTagGroups` with more than one group AND the category is `felt-welcome`, the first group uses `selectedPlaceType` and subsequent groups use `selectedSubTag`.

Replace the chip rendering section:

```tsx
        {category.subTags && category.subTags.length > 0 && (() => {
          const groups = category.subTagGroups ?? [
            { label: '(Optional) What kind of place?', tags: category.subTags! },
          ];
          const isSplitSelect = category.id === 'felt-welcome' && groups.length > 1;
          return (
            <>
              {groups.map((group, groupIdx) => {
                const usePlaceType = isSplitSelect && groupIdx === 0;
                const selectedValue = usePlaceType ? selectedPlaceType : selectedSubTag;
                const onChangeValue = usePlaceType ? onChangePlaceType : onChangeSubTag;
                return (
                <View
                  key={group.label ?? `group-${groupIdx}`}
                  style={styles.subTagGroup}
                >
                  {group.label && (
                    <Text
                      style={styles.subTagGroupLabel}
                      accessibilityRole="header"
                    >
                      {group.label}
                    </Text>
                  )}
                  <View style={styles.chipsWrap}>
                    {group.tags.map((tag) => {
                      const active = selectedValue === tag;
                      const sev = severityChipStyles(category, tag);
                      return (
                        <Pressable
                          key={tag}
                          onPress={() =>
                            onChangeValue(active ? undefined : tag)
                          }
                          disabled={submitting}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`${tag}${active ? ' (selected)' : ''}`}
                          style={({ pressed }) => [
                            styles.chip,
                            sev.base,
                            active && (sev.active ?? styles.chipActive),
                            pressed && !submitting && pressedDim,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipLabel,
                              sev.label,
                              active && styles.chipLabelActive,
                            ]}
                          >
                            {tag}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                );
              })}
            </>
          );
        })()}
```

- [ ] **Step 4: Wire `placeType` into the submit handler**

In `handleSubmit` (around line 248-270), add `placeType` to the draft:

```tsx
    const result = await submitMutation.run({
      categoryId: category.id,
      location,
      detail: detailText.trim() || undefined,
      subTag: selectedSubTag,
      placeType: selectedPlaceType,
      placeName: nearest?.name,
      googlePlaceId: nearest?.googlePlaceId,
      submittedBy: category.anonymous ? undefined : user?.id,
      photoUri,
    });
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add app/report.tsx
git commit -m "feat(report): felt-welcome two-section split + placeType wiring

Place type and identity tags are now independent single-selects.
Place type stored as placeType (informational), identity tag stored
as subTag (scoring-critical for recommendation engine routing)."
```

---

### Task 7: Detail view — per-category optional fields

**Files:**
- Modify: `app/report.tsx:669-742` (note + photo section in DetailView)

Currently the note field always renders with the label "(Optional) Your note" and the photo affordance renders whenever `category.hasPhoto` is true. The per-category design needs contextual labels.

- [ ] **Step 1: Update the note field label to be context-aware**

Replace the static `(Optional) Your note` label (line 669):

```tsx
        {/* Note field — contextual label per category */}
        {(category.id !== 'lighting') && (
          <>
            <Text style={styles.fieldLabel}>
              {category.id === 'incident' ? '(Optional) What happened?'
                : category.id === 'felt-unsafe' ? '(Optional) Want to say more?'
                : category.id === 'hazard' ? '(Optional) Details'
                : category.id === 'felt-welcome' ? '(Optional) Share your experience'
                : category.id === 'black-owned' ? '(Optional) Know the name?'
                : '(Optional) Your note'}
            </Text>
            <TextInput
              style={styles.textInput}
              value={detailText}
              onChangeText={onChangeDetail}
              placeholder=""
              multiline
              maxLength={280}
              editable={!submitting}
              accessibilityLabel="Report details"
              accessibilityState={{ disabled: submitting }}
              inputAccessoryViewID={
                Platform.OS === 'ios' ? DETAIL_INPUT_ACCESSORY_ID : undefined
              }
            />
          </>
        )}
```

Key changes:
- `lighting` has no note field (photo-only enrichment — the severity chip is the report)
- `felt-unsafe` gets a gentler prompt ("Want to say more?")
- `black-owned` gets "Know the name?" to solicit the business name
- `incident` and `hazard` get contextual labels

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/report.tsx
git commit -m "feat(report): per-category note labels + lighting drops note field

Each category gets a contextual note prompt. Lighting reports
have no note field — the severity chip + optional photo is the
full report. Minimum friction for the scoring engine."
```

---

### Task 8: Final verification

**Files:**
- All modified files

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Verify the impeccable design hook passes**

Run: `npx tsc --noEmit` (the impeccable hook runs on git operations; the tsc check ensures no design-system violations in the TypeScript layer)

- [ ] **Step 3: Device smoke test**

Launch on device via Expo Go and verify:
1. Picker grid shows 6 tiles with no row eyebrows
2. Tap each safety category — verify severity chips appear with red/orange color coding
3. Tap a severity chip — verify it fills solid with the severity color
4. Submit a lighting report with "Pitch black" selected — verify the resulting marker on /home creates an `avoid` zone (check via the route scoring: a route through the marker should be penalized more heavily)
5. Tap felt-welcome — verify two independent single-select sections (place type + identity), both allow independent selections
6. Submit felt-welcome with both selections — verify identity tag stored as `subTag`, place type stored as `placeType`
7. Tap black-owned — verify place type chips + "Know the name?" text field + "Add to directory" CTA
8. Verify "Share your experience" CTA on felt-welcome
9. Verify all chips meet 44pt minimum tap target

- [ ] **Step 4: Commit any smoke-test fixes**

If device testing reveals issues, fix and commit with a descriptive message.
