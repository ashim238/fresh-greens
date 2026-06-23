# Visual Maturity Phase 0 — Audit + Token Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-06-23-visual-maturity-program-design.md`](../specs/2026-06-23-visual-maturity-program-design.md)

**Goal:** Land the token foundation (`materials.ts`, `radii.ts`, `motion.ts`), the three new primitives (`MaterialSurface`, `SquircleIcon`, `useSpringPress`), the surface audit, and device verification — so all later Visual Maturity phases have a stable platform.

**Architecture:** Three new theme modules extend the existing `theme/` pattern (`colors.ts`, `typography.ts`, etc.). Three primitives compose those tokens with `expo-blur` (new dep) and `expo-linear-gradient` (already installed). One throwaway dev route lets us verify the high-risk integrations (blur × react-native-maps hit-test, gradient × Pressable × borderRadius on Android) before any surface migration touches a real screen. **No surface migrations in Phase 0** — those are Phase 1.

**Tech Stack:** React Native + Expo (managed), TypeScript, `expo-blur` (new), `expo-linear-gradient` (existing), `react-native-svg` (existing), `AccessibilityInfo` from react-native.

**Constraint:** No test runner — verification is `tsc --noEmit` + manual smoke on device. Per `docs/workflow.md`, the canonical typecheck command is:
```
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
The filtered output must be empty.

**Branch:** `program/visual-maturity-phase-0`

---

## File structure

| File | Responsibility | Notes |
|---|---|---|
| `theme/radii.ts` | Border-radius scale (xs/sm/md/lg/xl/pill). | Smallest module; no dependencies. |
| `theme/motion.ts` | Spring presets + duration scale + easing curves. | Pure data, no deps. |
| `theme/materials.ts` | Material tier config (`chrome`/`sheet`/`card`/`modal`). Blur intensity, tint, hairline color. | Imports `expo-blur` types only. |
| `hooks/useReduceTransparency.ts` | Reactive wrapper for `AccessibilityInfo.isReduceTransparencyEnabled`. | Mirrors `useReduceMotion.ts` pattern exactly. |
| `hooks/useSpringPress.tsx` | Press-down spring (scale 0.97 + opacity 0.85), `useReduceMotion` aware. Returns animated style. | Replaces inline `pressedDim` over time (Phase 3 work, not here). |
| `components/MaterialSurface.tsx` | Universal blur wrapper. Reduce-transparency fallback to solid token. | Composes `materials.ts` + `useReduceTransparency`. |
| `components/SquircleIcon.tsx` | Gradient squircle + glyph + color-aware shadow. | Composes `radii.ts` + `expo-linear-gradient` + existing glyph SVGs. |
| `docs/superpowers/specs/visual-maturity/surface-audit.md` | Per-surface change map for Phase 1+. | Documentation only. |
| `app/_dev-visual-maturity.tsx` | Temporary smoke route. Imports both primitives over a map background. **Deleted before PR.** | Verification scaffold only. |

---

## Task 0: Branch setup

**Files:** none

- [ ] **Step 1: Create branch from latest main**

```bash
git checkout main
git pull --ff-only
git checkout -b program/visual-maturity-phase-0
```

- [ ] **Step 2: Verify clean baseline tsc**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
Expected: empty output (no errors after filter).

---

## Task 1: Add `expo-blur` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `expo-blur` with Expo SDK alignment**

Run:
```bash
npx expo install expo-blur
```

Expected: `package.json` and `package-lock.json` updated with the SDK-aligned version (currently SDK 50+ aligns to `~15.x`; let `npx expo install` pick the version).

- [ ] **Step 2: Verify the dep is wired**

Run:
```bash
grep '"expo-blur"' package.json
```
Expected: one line, e.g. `"expo-blur": "~15.0.x",`.

- [ ] **Step 3: Verify typecheck**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
Expected: empty output.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add expo-blur for Visual Maturity material foundation"
```

---

## Task 2: `hooks/useReduceTransparency.ts`

Mirrors `hooks/useReduceMotion.ts` exactly — same pattern, different AccessibilityInfo method.

**Files:**
- Create: `hooks/useReduceTransparency.ts`

- [ ] **Step 1: Write the hook**

```ts
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Reactive wrapper around iOS's "Reduce Transparency" accessibility
 * setting (Settings → Accessibility → Display & Text Size → Reduce
 * Transparency). Returns `true` when the user has opted out of
 * translucent / blurred surfaces.
 *
 * Mirrors `useReduceMotion` exactly — same read-once-then-subscribe
 * pattern, same default-false bootstrap. Used by `MaterialSurface` to
 * collapse `BlurView` to a solid fallback when the user prefers
 * opaque surfaces.
 *
 * Android doesn't expose this setting; the call resolves to `false`
 * there, which matches our iOS-first posture (Android renders a solid
 * surface via the same fallback path because the BlurView still
 * collapses, just via the platform-default rather than user choice).
 */
export function useReduceTransparency(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (!cancelled) setReduceTransparency(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduceTransparency;
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add hooks/useReduceTransparency.ts
git commit -m "feat(hooks): add useReduceTransparency, mirrors useReduceMotion"
```

---

## Task 3: `theme/radii.ts`

**Files:**
- Create: `theme/radii.ts`

- [ ] **Step 1: Write the module**

```ts
// Fresh Greens — border-radius scale.
//
// 6/12/16/20/28 + pill. Extracted in the Visual Maturity Program after
// inline radii (16, 28, 1000, plus ad-hoc 12/20) drifted across cards,
// sheets, and chips. This module makes the scale explicit.
//
// Naming follows the same xs/sm/md/lg/xl pattern as spacing.ts so the
// two scales read consistently at call sites.
//
// Usage:
//   import { radii } from '../theme/radii';
//   borderRadius: radii.md,

export const radii = {
  /** Chips, small pills, micro-rounded edges. */
  xs: 6,
  /** Squircle icons, small cards, the friendly "rounded square" shape. */
  sm: 12,
  /** Standard cards. Matches the previous inline 16 default. */
  md: 16,
  /** Primary content cards — used when md feels too tight on dense content. */
  lg: 20,
  /** Sheet top corners. Matches the previous inline 28 used on bottom sheets. */
  xl: 28,
  /** Buttons, SearchBar, full pills. Equivalent to the previous `1000`. */
  pill: 1000,
} as const;

export type RadiiToken = keyof typeof radii;
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add theme/radii.ts
git commit -m "feat(theme): add radii scale (xs/sm/md/lg/xl/pill)"
```

---

## Task 4: `theme/motion.ts`

**Files:**
- Create: `theme/motion.ts`

- [ ] **Step 1: Write the module**

```ts
// Fresh Greens — motion tokens. Spring presets, duration scale, easing
// curves. Extracted in the Visual Maturity Program from inline animation
// values scattered across LandmarkMarker (tension 180, friction 12),
// trusted-contact-setup avatar spring (tension 180, friction 12), etc.
//
// "Warm + knowing" register: spring physics with mild overshoot, never
// bouncy. All durations ≤ 400ms — the program constraint.
//
// Usage:
//   import { springs, durations, easings } from '../theme/motion';
//   Animated.spring(value, { ...springs.gentle, toValue: 1, useNativeDriver: true });
//   Animated.timing(value, { duration: durations.standard, easing: easings.easeOut, ... });

/**
 * Spring presets — `useNativeDriver: true`-compatible. Apply via spread:
 *   Animated.spring(v, { ...springs.gentle, toValue: 1, useNativeDriver: true })
 *
 * Calibration: friction ≥ 14 across the board to suppress bounce. The
 * mild overshoot lands as "alive" instead of "Waze-cartoony" — the
 * program's brand-voice line.
 */
export const springs = {
  /** Default for content arrival, sheet rise, marker settle. Mild overshoot. */
  gentle: { tension: 180, friction: 14 },
  /** Press-down/release. Tighter spring, faster settle — feels responsive. */
  crisp: { tension: 240, friction: 16 },
  /** Final-state arrival (e.g. an icon snapping into place after a state change). */
  settle: { tension: 160, friction: 18 },
} as const;

/**
 * Duration scale — ceiling 400ms per program constraint. Use for
 * `Animated.timing` calls and non-spring motion. Numbers, not strings,
 * because RN's Animated API wants them numeric.
 */
export const durations = {
  /** Press-state opacity, micro-flicks. */
  instant: 100,
  /** Crossfades, state toggles. */
  quick: 200,
  /** Sheet transitions, list mounts. */
  standard: 300,
  /** Hero moments (route line draw, marker cascade). Program ceiling. */
  relaxed: 400,
} as const;

/**
 * Easing curves for non-spring motion. iOS-canonical: most exits use
 * `easeOut`, most A↔B transitions use `easeInOut`. Spring physics
 * cover the rest — reach for these only when a spring would feel
 * wrong (e.g. opacity-only fades).
 *
 * Returned as function names usable with `Easing.bezier(...)` callers
 * — but for the common cases, just import `Easing` from `react-native`
 * and use `Easing.out(Easing.cubic)` / `Easing.inOut(Easing.cubic)`.
 * These tokens exist as documentation + a centralization point should
 * we later move to custom bezier curves.
 */
export const easings = {
  /** Exits, dismissals, things leaving the screen. */
  easeOut: 'out',
  /** Reversible transitions, A↔B state. */
  easeInOut: 'inOut',
} as const;

export type SpringPreset = keyof typeof springs;
export type DurationToken = keyof typeof durations;
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add theme/motion.ts
git commit -m "feat(theme): add motion tokens (springs/durations/easings)"
```

---

## Task 5: `theme/materials.ts`

**Files:**
- Create: `theme/materials.ts`

- [ ] **Step 1: Write the module**

```ts
// Fresh Greens — material tokens. Surface translucency + blur tiers,
// mirroring Apple's UIBlurEffect styles narrowed to what the app
// actually needs. Each tier carries: blur intensity, tint color, tint
// opacity, hairline border color, and a reduce-transparency fallback.
//
// The tiers are consumed by `components/MaterialSurface.tsx` — surfaces
// don't read this module directly.
//
// Calibration baseline:
//   - chrome  → over-map FABs, search bar default state. Light + airy.
//   - sheet   → bottom sheets that rise from the screen edge. Heavier.
//   - card    → embedded cards on light-gray pages (settings rows).
//                Decorative blur — the page beneath isn't the map.
//   - modal   → full-screen modals over heavy content. Thickest blur.
//
// Tint / hairline values are tuned for the light-mode app surface; dark
// mode is a future-scope concern (the app is light-mode-only today).

import type { BlurTint } from 'expo-blur';

export type MaterialTier = 'chrome' | 'sheet' | 'card' | 'modal';

type MaterialConfig = {
  /** expo-blur intensity (0-100). iOS-native blur strength. */
  intensity: number;
  /** Light/dark/default tint per expo-blur. We use 'light' throughout
   *  for now; reserved so dark mode can swap later. */
  tint: BlurTint;
  /** Hairline border color — 0.5pt edge that separates layers without
   *  reading as a heavy border. Apple's signature on every UIVisualEffect. */
  hairline: string;
  /** Solid fallback background when reduce-transparency is on, OR when
   *  the platform doesn't honor BlurView (Android). Approximates the
   *  tier's perceived weight as an opaque color. */
  fallback: string;
};

export const materials: Record<MaterialTier, MaterialConfig> = {
  chrome: {
    intensity: 60,
    tint: 'light',
    hairline: 'rgba(255, 255, 255, 0.5)',
    fallback: '#FFFFFF',
  },
  sheet: {
    intensity: 80,
    tint: 'light',
    hairline: 'rgba(255, 255, 255, 0.6)',
    fallback: '#FFFFFF',
  },
  card: {
    intensity: 40,
    tint: 'light',
    hairline: 'rgba(0, 0, 0, 0.06)',
    fallback: '#FFFFFF',
  },
  modal: {
    intensity: 90,
    tint: 'light',
    hairline: 'rgba(255, 255, 255, 0.4)',
    fallback: '#FFFFFF',
  },
};
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add theme/materials.ts
git commit -m "feat(theme): add material tiers (chrome/sheet/card/modal)"
```

---

## Task 6: `components/MaterialSurface.tsx`

**Files:**
- Create: `components/MaterialSurface.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { BlurView } from 'expo-blur';

import { useReduceTransparency } from '../hooks/useReduceTransparency';
import { materials, type MaterialTier } from '../theme/materials';

/**
 * Universal material surface — wraps `expo-blur`'s `BlurView` with the
 * Fresh Greens tier system. Carries a 0.5pt hairline border by default
 * (the Apple signature on every UIVisualEffect). Falls back to a solid
 * surface when:
 *   - iOS user has Reduce Transparency on
 *   - Android (expo-blur on Android is best-effort; we render solid for
 *     deterministic UX rather than trust the platform fallback)
 *
 * Tiers (see `theme/materials.ts`):
 *   - chrome → FABs, search bar over map
 *   - sheet  → bottom sheets
 *   - card   → embedded cards on light-gray pages
 *   - modal  → full-screen modals
 *
 * Usage:
 *   <MaterialSurface tier="sheet" style={{ borderRadius: radii.xl }}>
 *     {children}
 *   </MaterialSurface>
 *
 * NOTE: Consumers control `borderRadius` via `style` — the surface
 * itself is shape-agnostic. The hairline border + blur respect whatever
 * radius the consumer applies. This is intentional: a FAB wants pill,
 * a sheet wants 28pt top corners, a card wants 16pt — one component
 * shouldn't bake the shape in.
 */
export function MaterialSurface({
  tier,
  children,
  style,
  hairline = true,
}: {
  tier: MaterialTier;
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Set false to suppress the 0.5pt hairline (rare — only when the
   *  consumer is handling its own border). Defaults true. */
  hairline?: boolean;
}) {
  const reduceTransparency = useReduceTransparency();
  const cfg = materials[tier];

  const borderStyle: ViewStyle | undefined = hairline
    ? { borderWidth: StyleSheet.hairlineWidth, borderColor: cfg.hairline }
    : undefined;

  if (reduceTransparency) {
    return (
      <View
        style={[styles.fallback, { backgroundColor: cfg.fallback }, borderStyle, style]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={cfg.intensity}
      tint={cfg.tint}
      style={[styles.blur, borderStyle, style]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    // BlurView clips its children to its bounds — consumers control
    // borderRadius via `style`. overflow:'hidden' is required because
    // BlurView's native impl doesn't always honor borderRadius without it.
    overflow: 'hidden',
  },
  fallback: {
    overflow: 'hidden',
  },
});
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add components/MaterialSurface.tsx
git commit -m "feat(components): MaterialSurface primitive (BlurView + reduce-transparency fallback)"
```

---

## Task 7: `hooks/useSpringPress.tsx`

**Files:**
- Create: `hooks/useSpringPress.tsx`

- [ ] **Step 1: Write the hook**

```tsx
import { useCallback, useMemo, useRef } from 'react';
import { Animated } from 'react-native';

import { useReduceMotion } from './useReduceMotion';
import { springs } from '../theme/motion';

/**
 * Universal press-down feedback spring — scale 0.97 + opacity 0.85 on
 * press-in, springs back to 1.0 / 1.0 on press-out. Uses the `crisp`
 * spring preset (faster settle than `gentle`).
 *
 * Replaces (over time, in Phase 3) the inline `pressedDim` opacity-only
 * pattern. Keep `pressedDim` for now in surfaces that haven't migrated.
 *
 * Reduce-motion aware: when the user has Reduce Motion on, the hook
 * returns static handlers that don't animate (the styled View renders
 * at the rest state always). The press still works; just doesn't move.
 *
 * Usage:
 *   const press = useSpringPress();
 *   <Animated.View style={press.style}>
 *     <Pressable onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
 *       ...
 *     </Pressable>
 *   </Animated.View>
 *
 * Or for Pressable-as-root:
 *   <Pressable onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
 *     <Animated.View style={press.style}>...</Animated.View>
 *   </Pressable>
 */
export function useSpringPress() {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      ...springs.crisp,
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
    Animated.spring(opacity, {
      ...springs.crisp,
      toValue: 0.85,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, scale, opacity]);

  const onPressOut = useCallback(() => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      ...springs.crisp,
      toValue: 1,
      useNativeDriver: true,
    }).start();
    Animated.spring(opacity, {
      ...springs.crisp,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, scale, opacity]);

  const style = useMemo(
    () => ({
      transform: [{ scale }],
      opacity,
    }),
    [scale, opacity],
  );

  return { onPressIn, onPressOut, style };
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add hooks/useSpringPress.tsx
git commit -m "feat(hooks): useSpringPress (scale 0.97 + opacity 0.85 spring, reduce-motion aware)"
```

---

## Task 8: `components/SquircleIcon.tsx`

**Files:**
- Create: `components/SquircleIcon.tsx`

Reuses the existing `assets/illustrations/mapmarker-glyph-*.svg` files. The squircle is a rounded rectangle at `radii.sm` (12pt), filled with a gradient matched to the category's variant (positive/black-owned/report). Shadow tint matches the gradient's primary color.

- [ ] **Step 1: Write the component**

```tsx
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import GlyphBlackOwned from '../assets/illustrations/mapmarker-glyph-black-owned.svg';
import GlyphFeltUnsafe from '../assets/illustrations/mapmarker-glyph-felt-unsafe.svg';
import GlyphFeltWelcome from '../assets/illustrations/mapmarker-glyph-felt-welcome.svg';
import GlyphHazard from '../assets/illustrations/mapmarker-glyph-hazard.svg';
import GlyphIncident from '../assets/illustrations/mapmarker-glyph-incident.svg';
import GlyphLighting from '../assets/illustrations/mapmarker-glyph-lighting.svg';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';

/**
 * Squircle category icon — gradient-filled rounded square with the
 * existing glyph SVG centered inside, plus a color-aware drop shadow
 * tinted to the gradient's primary color.
 *
 * Replaces (in Phase 2) the current circle-with-glyph pattern used by
 * LandmarkMarker, ReportDetailCard, and the /report picker tiles.
 *
 * Variants follow the same three-bucket sentiment system as
 * `LandmarkMarker.variantForCategoryId`:
 *   - 'positive'    → freshgreen → wiltedgreen
 *   - 'black-owned' → burntgreen (solid, no gradient — identity, not sentiment)
 *   - 'report'      → orange → slightlyDarkOrange
 *
 * Size scales the squircle and the glyph proportionally (glyph is
 * always 60% of the squircle).
 */

export type SquircleVariant = 'positive' | 'black-owned' | 'report';

const GRADIENTS: Record<SquircleVariant, readonly [string, string]> = {
  positive: [colors.freshgreen, colors.wiltedgreen],
  // black-owned stays solid burntgreen — identity marker, not sentiment.
  // The same color twice still renders the LinearGradient cleanly.
  'black-owned': [colors.burntgreen, colors.burntgreen],
  report: [colors.orange, colors.slightlyDarkOrange],
};

const SHADOW_TINT: Record<SquircleVariant, string> = {
  positive: colors.freshgreen,
  'black-owned': colors.burntgreen,
  report: colors.orange,
};

function GlyphForCategory({
  categoryId,
  size,
}: {
  categoryId: string;
  size: number;
}) {
  switch (categoryId) {
    case 'black-owned':
      return <GlyphBlackOwned width={size} height={size} />;
    case 'felt-welcome':
      return <GlyphFeltWelcome width={size} height={size} />;
    case 'felt-unsafe':
      return <GlyphFeltUnsafe width={size} height={size} />;
    case 'incident':
      return <GlyphIncident width={size} height={size} />;
    case 'lighting':
      return <GlyphLighting width={size} height={size} />;
    case 'hazard':
      return <GlyphHazard width={size} height={size} />;
    default:
      // Defensive fallback — keeps the icon visible if a new categoryId
      // is added before this dispatch is updated. Hazard reads as a
      // sensible "generic report."
      return <GlyphHazard width={size} height={size} />;
  }
}

export function SquircleIcon({
  categoryId,
  variant,
  size = 40,
  style,
}: {
  categoryId: string;
  variant: SquircleVariant;
  /** Outer squircle dimension. Glyph renders at 60% of this. Default 40. */
  size?: number;
  style?: ViewStyle;
}) {
  const glyphSize = Math.round(size * 0.6);
  const shadowStyle: ViewStyle = {
    shadowColor: SHADOW_TINT[variant],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  };

  return (
    <View style={[shadowStyle, style]}>
      <LinearGradient
        colors={GRADIENTS[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.squircle,
          { width: size, height: size, borderRadius: radii.sm },
        ]}
      >
        <GlyphForCategory categoryId={categoryId} size={glyphSize} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  squircle: {
    alignItems: 'center',
    justifyContent: 'center',
    // overflow:'hidden' so the gradient respects borderRadius — without
    // it, LinearGradient on Android paints past the rounded corners on
    // some devices.
    overflow: 'hidden',
  },
});
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add components/SquircleIcon.tsx
git commit -m "feat(components): SquircleIcon (gradient + glyph + color-aware shadow)"
```

---

## Task 9: Temporary smoke route

Adds a throwaway route at `/_dev-visual-maturity` that lays both primitives over a map background. The route exists only for Task 10's device verification — it's deleted before opening the PR (Task 12 step 2).

**Files:**
- Create: `app/_dev-visual-maturity.tsx`

- [ ] **Step 1: Write the smoke route**

```tsx
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaterialSurface } from '../components/MaterialSurface';
import { SquircleIcon } from '../components/SquircleIcon';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { typography } from '../theme/typography';

/**
 * TEMPORARY — Visual Maturity Phase 0 smoke route.
 *
 * Verifies the two high-risk integrations from the spec's Risk Register:
 *   - expo-blur × react-native-maps hit-test (does the map still pan
 *     when a MaterialSurface overlays part of the viewport? does a
 *     Pressable INSIDE a MaterialSurface still fire?)
 *   - expo-linear-gradient × Pressable × borderRadius on Android (does
 *     the gradient clip cleanly to the squircle radius when wrapped in
 *     a Pressable?)
 *
 * DELETE this file before opening the PR. The Phase 0 acceptance
 * checklist requires this file to be absent from the merged branch.
 */
export default function VisualMaturitySmoke() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 40.7128,
          longitude: -74.006,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <MaterialSurface
          tier="chrome"
          style={[styles.chromeBar, { borderRadius: radii.pill }]}
        >
          <Pressable onPress={() => router.back()}>
            <Text style={styles.label}>Back · tap should fire through chrome</Text>
          </Pressable>
        </MaterialSurface>

        <MaterialSurface
          tier="sheet"
          style={[styles.sheet, { borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl }]}
        >
          <Text style={[styles.label, styles.heading]}>Sheet tier</Text>
          <View style={styles.row}>
            <Pressable onPress={() => console.log('positive tapped')}>
              <SquircleIcon categoryId="felt-welcome" variant="positive" size={48} />
            </Pressable>
            <Pressable onPress={() => console.log('black-owned tapped')}>
              <SquircleIcon categoryId="black-owned" variant="black-owned" size={48} />
            </Pressable>
            <Pressable onPress={() => console.log('report tapped')}>
              <SquircleIcon categoryId="hazard" variant="report" size={48} />
            </Pressable>
          </View>
          <Text style={styles.caption}>
            Tap each icon → console should log; map should still pan around the sheet.
          </Text>
        </MaterialSurface>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  overlay: { flex: 1, justifyContent: 'space-between' },
  chromeBar: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sheet: {
    padding: 24,
    gap: 16,
  },
  row: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  label: { ...typography.bodyEmphasized, color: colors.black },
  heading: { ...typography.title3Emphasized },
  caption: { ...typography.footnoteRegular, color: colors.labelSecondary, textAlign: 'center' },
});
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add app/_dev-visual-maturity.tsx
git commit -m "chore(dev): add temporary visual-maturity smoke route (deleted before PR)"
```

---

## Task 10: Device verification

No code changes. Manual verification of the two Risk Register items from the spec.

- [ ] **Step 1: Run the app on iOS device or simulator**

Run:
```bash
npx expo start --ios
```

Navigate to `/_dev-visual-maturity` in the URL bar (or manually via Expo dev menu).

- [ ] **Step 2: Verify blur × map hit-test (iOS)**

Acceptance checklist:
- [ ] Top chrome bar renders as translucent over the map (you can see the map through it)
- [ ] Bottom sheet renders as translucent
- [ ] Tapping the chrome "Back" label dismisses the route
- [ ] Tapping each squircle icon logs to the console
- [ ] Panning the map AROUND the sheet still works (the un-overlaid portion of the map responds to gestures)
- [ ] Toggle iOS Settings → Accessibility → Display & Text Size → Reduce Transparency ON; both surfaces collapse to solid white. Toggle OFF; they return to translucent.

If any of the above fails, STOP — file a blocker in the PR description and surface to the user before continuing.

- [ ] **Step 3: Verify gradient × Pressable × borderRadius (Android, if available)**

If an Android device/emulator is set up:
```bash
npx expo start --android
```
Navigate to `/_dev-visual-maturity`.

Acceptance checklist:
- [ ] Squircle icons render with the gradient visible (not just solid)
- [ ] Gradient clips cleanly to the 12pt squircle radius (no overflow past corners)
- [ ] Tapping each squircle (wrapped in Pressable) fires the console log

If Android is not available in this environment, note that explicitly in the PR description as an iOS-verified-only acceptance, and queue an Android verification for a later session. Per the spec, Android render fidelity is a non-blocker; the must-not-crash bar is the requirement.

- [ ] **Step 4: Record the verification result**

Write a short note in `docs/learnings.md` under the new branch heading capturing what was verified, what wasn't, and any observations.

Format (per workflow.md §11):
```markdown
## program/visual-maturity-phase-0 (2026-06-23)

- expo-blur × react-native-maps hit-test on iOS: PASS — map pans around overlay, Pressables inside MaterialSurface fire correctly. Worth keeping: BlurView with overflow:'hidden' + borderRadius doesn't break gesture pass-through on iOS as of Expo SDK X.
- (etc. — fill with actual findings)
```

- [ ] **Step 5: Commit the learnings entry**

```bash
git add docs/learnings.md
git commit -m "docs(learnings): visual-maturity-phase-0 device verification notes"
```

---

## Task 11: Surface audit doc

The per-surface change map for Phase 1+. Walks the 25 screens from the Design Health Program closeout and assigns each surface to a MaterialSurface tier (or "no change"), notes the SquircleIcon migration needed (if any), notes the density regularization opportunities, and notes which surfaces are candidates for the four hero animations.

**Files:**
- Create: `docs/superpowers/specs/visual-maturity/surface-audit.md`

- [ ] **Step 1: Write the audit doc**

The audit follows the screen list from the Design Health Program closeout snapshot (`docs/superpowers/specs/phase-1-findings/2026-06-20-design-health-program-closeout.md`). For each screen, fill in the following table fields by reading the screen source:

```markdown
# Visual Maturity — Surface Audit

**Date:** 2026-06-23
**Spec:** [`../2026-06-23-visual-maturity-program-design.md`](../2026-06-23-visual-maturity-program-design.md)
**Status:** Phase 0 deliverable

Per-screen catalog of every surface that the Visual Maturity Program
will touch. Drives Phase 1 (material migration) and Phase 2 (polish)
sequencing. Each row names:
- Surface — the component or named element on the screen
- Current — what it renders as today (solid bg + token)
- Tier — the MaterialSurface tier it adopts in Phase 1 (or "no change")
- Polish — Phase 2 changes (SquircleIcon, gradient, density)
- Motion — Phase 3 candidates (hero or foundation only)

## /home

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| FloatingActionButton (menu, avatar) | colors.white + shadows.e2 | chrome | — | useSpringPress |
| SearchBar (default state) | colors.white + shadows.e2 | chrome | — | — |
| HomeBrowseSheet | colors.white | sheet | density regularization | staggered mount |
| ReportDetailCard | colors.white | sheet | SquircleIcon header | sheet spring rise |
| ZoneDetailCard | colors.white | sheet | density regularization | sheet spring rise |
| RouteHazardDetailCard | colors.white | sheet | SquircleIcon header | sheet spring rise |
| LandmarkMarker | composed pin+bg+glyph SVGs | no change (markers stay 3D) | replace inner bg+glyph with SquircleIcon (NO — keep teardrop shape; SquircleIcon is for flat-card use only) | marker drop-in cascade (hero) |
| Route polyline | daylight gradient | no change | — | route line draws on (hero) |
| Trusted-friend marker | TrustedFriendMarker SVG | no change | — | afterglow trail (hero) |

## /en-route

| Surface | Current | Tier | Polish | Motion |
|---|---|---|---|---|
| Side-FAB column (Volume, SOS, Shield, Recenter, Report) | colors.white + shadows.e2 (FAB) | chrome | — | useSpringPress |
| ETA pill | colors.white + shadows.e2 | chrome | — | — |
| EnRouteZone overlay | colors.white | card | density regularization | — |

... (continue for the remaining 23 screens: /safety, /safety-settings, /pulled-over, /recordings, /share-location, /roadside, /unfamiliar, /zone-preferences, /fuel, /trip-summary, /legal, /menu, /emergency, /permissions, /onboarding, /sign-out, /trusted-contact-setup, /report, /report-success, /search, /lifeline, /route-preview, /lane-strip-host — refer to the Design Health Program closeout for the canonical 25-screen list)

## Summary counts

After filling: report the total number of surfaces in each tier so Phase 1 sizing has hard numbers.

| Tier | Count |
|---|---|
| chrome | _(fill)_ |
| sheet | _(fill)_ |
| card | _(fill)_ |
| modal | _(fill)_ |
| no change | _(fill)_ |

## SquircleIcon migration sites

Single list of every place currently rendering the circle-bg-with-glyph pattern that SquircleIcon will replace in Phase 2:
1. _(fill from audit — components/ReportDetailCard.tsx iconWrap, app/report.tsx picker tiles, components/HomeBrowseSheet.tsx recommendation cards if applicable)_

## Hero motion target sites

1. **Route line draws on** — `app/home.tsx` selectedRoute polyline render
2. **Marker drop-in cascade** — `app/home.tsx` LandmarkMarker render loop on initial mount + new-report mount
3. **SOS countdown pulse** — `app/emergency.tsx` countdown disc
4. **Trusted-friend trail afterglow** — `app/home.tsx` trusted-friend marker render
```

The audit's job is to be COMPLETE, not pretty. Aim for 25 screen sections (matching the Design Health Program's 25-screen universe). For any surface where you're unsure of the tier, write `?` in the Tier column and add a one-line "why unsure" footnote at the bottom of that screen's table — those become Phase 1 design questions.

- [ ] **Step 2: Self-check the audit**

After writing, scan for:
- Any screen from the Design Health Program closeout's 25-screen list that's missing
- Any `?` tier without a footnote
- Any "no change" surface that's actually a sheet/card that should migrate

Fix inline.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/visual-maturity/surface-audit.md
git commit -m "docs(visual-maturity): surface audit — per-screen tier + polish + motion map"
```

---

## Task 12: Cleanup + PR

- [ ] **Step 1: Final typecheck**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
Expected: empty output.

- [ ] **Step 2: Delete the smoke route**

Run:
```bash
rm app/_dev-visual-maturity.tsx
```

- [ ] **Step 3: Final typecheck (post-delete)**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```
Expected: empty output.

- [ ] **Step 4: Commit cleanup**

```bash
git add -A
git commit -m "chore(dev): remove visual-maturity smoke route (verification complete)"
```

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin program/visual-maturity-phase-0
gh pr create --title "Visual Maturity Phase 0 — Token foundation + primitives" --body "$(cat <<'EOF'
## Summary

Phase 0 of the [Visual Maturity Program](../specs/2026-06-23-visual-maturity-program-design.md). Lands the token foundation and three primitives so Phases 1-3 have a stable platform. **No surface migrations in this PR** — those are Phase 1.

## What ships

- **3 new theme modules:** `theme/radii.ts`, `theme/motion.ts`, `theme/materials.ts`
- **3 new primitives:** `components/MaterialSurface.tsx`, `components/SquircleIcon.tsx`, `hooks/useSpringPress.tsx`
- **1 supporting hook:** `hooks/useReduceTransparency.ts`
- **1 new dependency:** `expo-blur` (SDK-aligned via `npx expo install`)
- **1 audit doc:** `docs/superpowers/specs/visual-maturity/surface-audit.md` — per-surface change map driving Phase 1+

## Verification

- `tsc --noEmit` clean (filtered for known env-level errors per workflow.md)
- Device-verified `expo-blur` × `react-native-maps` hit-test on iOS — see `docs/learnings.md` entry
- Reduce-transparency fallback verified by toggling iOS accessibility setting
- (Note Android verification status — done, deferred, or N/A)

## Test plan

- [ ] Reviewer skims the three token modules for naming consistency with existing `theme/` files
- [ ] Reviewer confirms `MaterialSurface` reduce-transparency fallback by toggling iOS Settings
- [ ] Reviewer confirms `SquircleIcon` renders for at least three categoryIds without crash (no surface uses it yet — manual import in a scratch screen is acceptable)
- [ ] Reviewer reads the surface audit and flags any obvious tier miscategorization

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Dispatch the per-PR review subagents**

Per `docs/workflow.md` §12, run `code-reviewer` and `mobile-ux-optimizer` in parallel. Briefs per workflow.md — paste them verbatim. Address findings; re-commit; re-push.

- [ ] **Step 7: Merge**

Once reviews pass and the user has confirmed:
```bash
gh pr merge <PR#> --squash --delete-branch
git checkout main
git pull --ff-only
```

---

## Acceptance summary

Phase 0 is done when:
- Branch `program/visual-maturity-phase-0` is merged to `main`
- `expo-blur` is in `package.json`
- `theme/radii.ts`, `theme/motion.ts`, `theme/materials.ts` exist and `tsc` clean
- `components/MaterialSurface.tsx`, `components/SquircleIcon.tsx`, `hooks/useSpringPress.tsx`, `hooks/useReduceTransparency.ts` exist and `tsc` clean
- `docs/superpowers/specs/visual-maturity/surface-audit.md` covers all 25 Design Health Program screens
- `docs/learnings.md` carries the branch-headed verification entry
- `app/_dev-visual-maturity.tsx` does NOT exist in the merged branch
- Phase 1 (material migration) is unblocked
