# Recommendation same-place dedup + multi-facet Trusted cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make recommendation dedup name-aware so co-located different places stop clobbering each other, and merge same-place reports in the Trusted-by-community row into one card with a combined vouch label.

**Architecture:** Two pure helpers (`normalizeName`, `samePlace`) replace the proximity-only collision test in the recommendation adapter; a `vouchLabelForReport` helper + a `facets?: string[]` field on `Recommendation` let `getTrustedByCommunity` accumulate distinct vouches per same-place group; the card renders the combined label when `facets` is present.

**Tech Stack:** TypeScript, React Native, Expo. No test runner exists in this repo (`.cursorrules` forbids adding deps without asking) — pure predicates are verified with a throwaway `node` assertion run during implementation, plus `npx tsc --noEmit` and a device test.

**Spec:** `docs/superpowers/specs/2026-06-03-recommendation-samePlace-facets-design.md`

---

## Task 1: `samePlace` primitive + name-aware dedup

**Files:**
- Modify: `lib/api/recommendations.ts` (add helpers ~near line 165 `distanceMilesBetween`; rework `dedupByProximity` at lines 591-609; update call sites at lines 162 and 525)

- [ ] **Step 1: Add `normalizeName`, `SAME_PLACE_DEG_SQ`, and `samePlace`**

Insert immediately above `function distanceMilesBetween` (currently line 165):

```ts
/**
 * Case/whitespace-insensitive name key for same-place matching. Mirrors
 * the one-liner in lib/api/preferred-stations.ts — kept local rather
 * than shared to avoid coupling the two adapters over a trivial
 * normalize (two copies is under the rule-of-three threshold).
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** ~50m, expressed as squared lat/lng degrees (cheap, no trig). */
const SAME_PLACE_DEG_SQ = (50 / 111000) ** 2;

/**
 * Two recs/points refer to the SAME place when their normalized names
 * match AND they sit within ~50m. Name is the disambiguator — proximity
 * alone collapses distinct neighbors (two storefronts within 50m read as
 * one, and the second is silently dropped). Same fix shape as
 * preferred-stations' `stationsMatch`.
 */
function samePlace(
  a: { name: string; latitude: number; longitude: number },
  b: { name: string; latitude: number; longitude: number },
): boolean {
  if (normalizeName(a.name) !== normalizeName(b.name)) return false;
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return dLat * dLat + dLng * dLng < SAME_PLACE_DEG_SQ;
}
```

- [ ] **Step 2: Replace `dedupByProximity` with `dedupBySamePlace`**

Replace the whole function (currently lines 591-609) with:

```ts
/**
 * Removes same-place duplicates across sources — same NORMALIZED NAME
 * within ~50m (see `samePlace`). Name-aware so two genuinely different
 * businesses within 50m both survive; proximity-only collapsed them and
 * dropped the second. Preserves the first occurrence (curated wins over
 * community wins over external) so the curator's editorial copy always
 * trumps a peer report or external listing of the same place.
 *
 * Tradeoff: a community report whose placeName didn't resolve (generic
 * fallback name) and the external listing of the same place will now
 * BOTH show, where proximity-only merged them. A generic-named duplicate
 * is strictly less bad than two distinct places collapsing to one.
 */
function dedupBySamePlace(recs: Recommendation[]): Recommendation[] {
  const kept: Recommendation[] = [];
  for (const rec of recs) {
    if (!kept.some((k) => samePlace(k, rec))) kept.push(rec);
  }
  return kept;
}
```

- [ ] **Step 3: Update the two call sites**

Line 162, inside `getRecommendations`:

```ts
  return annotateDistance(dedupBySamePlace(merged), query.userLocation);
```

Line 525, inside `getOpenNow`:

```ts
    const deduped = dedupBySamePlace(sorted);
```

- [ ] **Step 4: Verify the predicate with a throwaway node run**

Run (paste-and-run; NOT committed, no dep — pure JS mirror of the logic to confirm the math/branches):

```bash
node --input-type=module -e '
const N = (s) => s.trim().toLowerCase();
const D = (50/111000)**2;
const same = (a,b) => N(a.name)===N(b.name) && ((a.latitude-b.latitude)**2 + (a.longitude-b.longitude)**2) < D;
const near = {latitude:40.0000, longitude:-73.0000};
const near2 = {latitude:40.0003, longitude:-73.0000}; // ~33m
const far = {latitude:40.0010, longitude:-73.0000};   // ~111m
console.log("same name + near =", same({name:"Sisters",...near},{name:"sisters ",...near2}), "(expect true)");
console.log("diff name + near =", same({name:"Sisters",...near},{name:"Joe Pizza",...near2}), "(expect false)");
console.log("same name + far  =", same({name:"Sisters",...near},{name:"Sisters",...far}), "(expect false)");
'
```

Expected output:
```
same name + near = true (expect true)
diff name + near = false (expect false)
same name + far  = false (expect false)
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"`
Expected: no output for `recommendations.ts` (pre-existing avatar/proxy errors are unrelated).

- [ ] **Step 6: Commit**

```bash
git add lib/api/recommendations.ts
git commit -m "fix(recommendations): name-aware same-place dedup so co-located neighbors don't clobber"
```

---

## Task 2: `vouchLabelForReport` + facet accumulation in the Trusted row

**Files:**
- Modify: `lib/api/recommendations.ts` (add `Recommendation.facets` near line 110; add `VOUCH_LABEL` + `vouchLabelForReport` near `recCategoryForReport` line 270-279; rework `getTrustedByCommunity` Step-2 grouping lines 424-459)

- [ ] **Step 1: Add the `facets` field to `Recommendation`**

Insert after the `photoName` field (currently ends line 110), before the closing `};`:

```ts
  /**
   * Distinct human-readable vouch labels when this card represents a
   * same-place group trusted in more than one way (e.g.
   * ['Black-owned', 'Felt welcome']). Populated ONLY by
   * getTrustedByCommunity, ONLY when a group has >= 2 distinct vouches.
   * Undefined everywhere else — the card's default pill is unchanged.
   */
  facets?: string[];
```

- [ ] **Step 2: Add `VOUCH_LABEL` map + `vouchLabelForReport`**

Insert immediately after `recCategoryForReport` (currently ends line 279):

```ts
/**
 * Display labels for the "vouch" register surfaced on the Trusted-by-
 * community card. Distinct from HomeBrowseSheet's CATEGORY_LABELS (which
 * is keyed by RecommendationCategory and uses title-case "Black-Owned"):
 * this register reads as a community vouch and intentionally adds
 * "Felt welcome", which has no RecommendationCategory (general felt-
 * welcome routes to none).
 */
const VOUCH_LABEL: Record<RecommendationCategory, string> = {
  'black-owned': 'Black-owned',
  'women-owned': 'Women-owned',
  'lgbtq-welcoming': 'LGBTQ+ welcoming',
  restroom: 'Open restroom',
  'late-night-warm-welcome': 'Late-night welcome',
};

/**
 * The vouch label for a single report. Routes via recCategoryForReport
 * (black-owned, or felt-welcome + identity subTag); a felt-welcome report
 * with a place-type or no subTag falls through to "Felt welcome" — the
 * most fundamental vouch. The final "Trusted" is defensive and should be
 * unreachable (the trusted-row candidate filter already excludes non-
 * routing, non-felt-welcome reports).
 */
function vouchLabelForReport(
  categoryId: string,
  subTag: string | undefined,
): string {
  const routed = recCategoryForReport(categoryId, subTag);
  if (routed) return VOUCH_LABEL[routed];
  if (categoryId === 'felt-welcome') return 'Felt welcome';
  return 'Trusted';
}
```

- [ ] **Step 3: Accumulate vouch labels per group in `getTrustedByCommunity`**

The Step-2 grouping currently (lines 434-459) is:

```ts
    type Group = {
      anchor: { latitude: number; longitude: number };
      rec: Recommendation;
      count: number;
      mostRecentTs: number;
    };
    const groups: Group[] = [];
    for (const { rec, timestamp } of candidates) {
      const existing = groups.find(
        (g) => distanceMilesBetween(g.anchor, rec) <= TRUSTED_GROUP_PROXIMITY_MILES,
      );
      if (existing) {
        existing.count += 1;
        if (timestamp > existing.mostRecentTs) {
          existing.mostRecentTs = timestamp;
          existing.rec = rec; // freshest metadata wins the display
        }
      } else {
        groups.push({
          anchor: { latitude: rec.latitude, longitude: rec.longitude },
          rec,
          count: 1,
          mostRecentTs: timestamp,
        });
      }
    }
```

The grouping needs the per-candidate vouch label, so the candidate must carry it. In Step 1 of `getTrustedByCommunity` (the `candidates.push({...})` block, currently lines 406-420), the `Candidate` type is `{ rec; timestamp }`. Change the type and the push to also carry `vouch`:

Change the `Candidate` type declaration (currently line 394):

```ts
    type Candidate = { rec: Recommendation; timestamp: number; vouch: string };
```

Change the `candidates.push({...})` call (currently lines 406-420) to add the `vouch` field after `timestamp: r.timestamp,`:

```ts
        timestamp: r.timestamp,
        vouch: vouchLabelForReport(r.categoryId, r.subTag),
```

Now replace the Step-2 grouping block (lines 434-459 shown above) with the name-aware, facet-accumulating version:

```ts
    type Group = {
      anchor: { name: string; latitude: number; longitude: number };
      rec: Recommendation;
      count: number;
      mostRecentTs: number;
      vouches: Set<string>;
    };
    const groups: Group[] = [];
    for (const { rec, timestamp, vouch } of candidates) {
      // Group membership is samePlace (normalized name AND ~50m), not
      // proximity alone — so different-name neighbors start their own
      // group instead of merging, while the same place reported under
      // multiple categories collapses into one and accumulates vouches.
      const existing = groups.find((g) => samePlace(g.anchor, rec));
      if (existing) {
        existing.count += 1;
        existing.vouches.add(vouch);
        if (timestamp > existing.mostRecentTs) {
          existing.mostRecentTs = timestamp;
          existing.rec = rec; // freshest metadata wins the display
        }
      } else {
        groups.push({
          anchor: { name: rec.name, latitude: rec.latitude, longitude: rec.longitude },
          rec,
          count: 1,
          mostRecentTs: timestamp,
          vouches: new Set([vouch]),
        });
      }
    }
```

Note: `samePlace` reads `anchor.name`, so the anchor now carries `name`
(the first report's name — the fixed-reference rationale in the existing
Step-2 comment still holds). `TRUSTED_GROUP_PROXIMITY_MILES` is no longer
referenced by the grouping; it stays defined (harmless) unless tsc's
`noUnusedLocals` flags it — if it does, delete its declaration (line 367)
in this step.

- [ ] **Step 4: Attach `facets` to the display rec in Step 3 (score/rank)**

The Step-3 scoring (currently lines 461-474) maps groups to `{ rec, score }` then slices the top recs. The `rec` returned must carry `facets` when the group has ≥2 distinct vouches. Change the `scored` map (currently lines 464-470) to spread facets onto the rec:

```ts
    const scored = groups.map((g) => {
      const daysSince = (now - g.mostRecentTs) / (1000 * 60 * 60 * 24);
      const recency = 1 / (1 + daysSince / TRUSTED_RECENCY_HALF_LIFE_DAYS);
      const count = Math.min(1, Math.log10(g.count + 1) / countNorm);
      const score = TRUSTED_RECENCY_WEIGHT * recency + TRUSTED_COUNT_WEIGHT * count;
      // Surface multiple vouches as facets; single-vouch groups leave
      // facets undefined (unchanged card behavior).
      const rec =
        g.vouches.size >= 2 ? { ...g.rec, facets: [...g.vouches] } : g.rec;
      return { rec, score };
    });
```

- [ ] **Step 5: Verify `vouchLabelForReport` with a throwaway node run**

Run (NOT committed — JS mirror confirming each branch):

```bash
node --input-type=module -e '
const IDENT = {"Women-owned":"women-owned","LGBTQ+ welcoming":"lgbtq-welcoming","Open restroom":"restroom","Late-night welcome":"late-night-warm-welcome"};
const VOUCH = {"black-owned":"Black-owned","women-owned":"Women-owned","lgbtq-welcoming":"LGBTQ+ welcoming","restroom":"Open restroom","late-night-warm-welcome":"Late-night welcome"};
const routed = (c,s) => c==="black-owned" ? "black-owned" : (c==="felt-welcome" && s ? (IDENT[s] ?? null) : null);
const label = (c,s) => { const r = routed(c,s); if (r) return VOUCH[r]; if (c==="felt-welcome") return "Felt welcome"; return "Trusted"; };
console.log(label("black-owned","Restaurant"), "(expect Black-owned)");
console.log(label("felt-welcome","Women-owned"), "(expect Women-owned)");
console.log(label("felt-welcome","Restaurant"), "(expect Felt welcome)");
console.log(label("felt-welcome",undefined), "(expect Felt welcome)");
'
```

Expected output:
```
Black-owned (expect Black-owned)
Women-owned (expect Women-owned)
Felt welcome (expect Felt welcome)
Felt welcome (expect Felt welcome)
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"`
Expected: no output for `recommendations.ts`. (If `TRUSTED_GROUP_PROXIMITY_MILES` is flagged unused, delete its declaration line and re-run.)

- [ ] **Step 7: Commit**

```bash
git add lib/api/recommendations.ts
git commit -m "feat(recommendations): accumulate distinct vouch facets for same-place Trusted-row groups"
```

---

## Task 3: Render the combined facet label on the card

**Files:**
- Modify: `components/HomeBrowseSheet.tsx` (`RecommendationCard`: a11y label line 957; category pill lines 1058-1060)

- [ ] **Step 1: Derive the combined pill text**

Inside `RecommendationCard`, after `const r = recommendation;` (currently line 933), add:

```ts
  // When the rec is a multi-vouch same-place group (Trusted row only),
  // the category pill shows the combined vouch label ("Black-owned ·
  // Felt welcome") instead of the single categoryLabel. Capped at 2
  // facets with a "+N" overflow so the pill never wraps; numberOfLines
  // on the Text is the backstop. facets is undefined for every other
  // card, so this is a no-op outside the Trusted row.
  const FACET_DISPLAY_CAP = 2;
  const categoryPillText =
    r.facets && r.facets.length > 0
      ? r.facets.slice(0, FACET_DISPLAY_CAP).join(' · ') +
        (r.facets.length > FACET_DISPLAY_CAP
          ? ` +${r.facets.length - FACET_DISPLAY_CAP}`
          : '')
      : r.categoryLabel;
```

- [ ] **Step 2: Use it in the a11y label**

In the `a11yLabel` array (currently line 957), replace `r.categoryLabel,` with:

```ts
    categoryPillText,
```

- [ ] **Step 3: Use it in the category pill**

Replace the category pill (currently lines 1058-1060):

```ts
          <View style={styles.tag}>
            <Text style={styles.tagText}>{r.categoryLabel}</Text>
          </View>
```

with:

```ts
          <View style={styles.tag}>
            <Text style={styles.tagText} numberOfLines={1}>{categoryPillText}</Text>
          </View>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"`
Expected: no output for `HomeBrowseSheet.tsx`.

- [ ] **Step 5: Commit**

```bash
git add components/HomeBrowseSheet.tsx
git commit -m "feat(home-browse): render combined vouch label on multi-facet Trusted cards"
```

---

## Task 4: Device verification + learnings

**Files:**
- Modify: `docs/learnings.md` (append a branch-headed entry per workflow Step 11)

- [ ] **Step 1: Device test — multi-facet merge**

In the running app: drop two community reports at one address — a
Black-owned report and a Felt-welcome report (same place name). Open the
browse sheet's "Trusted by your community" row. Expected: ONE card whose
category pill reads "Black-owned · Felt welcome".

- [ ] **Step 2: Device test — neighbors don't clobber**

Drop two reports with DIFFERENT names within ~50m (e.g. "Sisters" and
"Corner Barber"). Expected: TWO cards, neither dropped.

- [ ] **Step 3: Append a learnings entry**

Append to the TOP of `docs/learnings.md` (newest-first) a branch-headed
entry covering: the name+proximity identity pattern reused a third time
(preferred-stations → here), so it's now a codebase rule worth naming;
and the "first-occurrence-wins dedup silently DROPS the loser's data —
accumulate instead of discard when the loser carries unique info"
insight.

- [ ] **Step 4: Commit**

```bash
git add docs/learnings.md
git commit -m "docs(learnings): name+proximity identity is now a 3x pattern; dedup that drops data should accumulate it"
```

---

## Self-Review

**Spec coverage:**
- (a) name-aware dedup → Task 1 (`samePlace`, `dedupBySamePlace`, both call sites). ✓
- (a) name-aware Trusted grouping → Task 2 Step 3 (`samePlace` group membership). ✓
- (b) vouch label per report → Task 2 Steps 2. ✓
- (b) facet accumulation → Task 2 Steps 3-4. ✓
- (b) `facets` field → Task 2 Step 1. ✓
- (b) combined pill + a11y → Task 3. ✓
- Testing (throwaway node + tsc + device) → Tasks 1/2 verify steps + Task 4. ✓

**Placeholder scan:** none — every code step shows complete code.

**Type consistency:** `samePlace` (Task 1) reads `{name, latitude, longitude}`; Task 2's `Group.anchor` carries `name` to satisfy it. `Candidate` gains `vouch: string` (Task 2 Step 3) and is destructured as `{ rec, timestamp, vouch }` in the same step. `facets?: string[]` (Task 2 Step 1) is read as `r.facets` in Task 3. `vouchLabelForReport` returns `string`, stored in `Set<string>`, spread to `facets: string[]`. Consistent.
