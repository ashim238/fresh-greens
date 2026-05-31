# Unfamiliar Area + Share Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the remaining two `/safety` tiles (Unfamiliar area + Share location) as page-sheet modals backed by a shared `ShareSession` state machine, a persistent `<LiveSafetySheet />` widget on `/home` + `/en-route`, and a shared `<NotifyingPulse />` component that backfills Roadside Step 3.

**Architecture:** Shared infrastructure first (ShareSession adapter/hook, formatDuration helper, NotifyingPulse, LiveSafetySheet, LifelineModal). Then `/unfamiliar` (2-step) and `/share-location` (1-step) routes consume that infra. Final wiring connects `/safety` tiles + adds the no-contact gate.

**Tech Stack:** React Native + Expo (managed), expo-router (file-based), TypeScript, AsyncStorage, expo-haptics, expo-linking (`tel:` / `sms:`), Phosphor icons (deep imports), `useShareSession` hook (focus-refetch).

**Spec:** [docs/superpowers/specs/2026-05-31-unfamiliar-and-share-location-design.md](../specs/2026-05-31-unfamiliar-and-share-location-design.md)

---

## Conventions

- **No test runner in this project.** Each task ends with `npx tsc --noEmit 2>&1 | grep -iE "<file-glob>"` filtered for the touched files. Pre-existing project errors (`@expo/vector-icons` types on `app/fuel.tsx` / `app/roadside-setup.tsx`) are not blockers — only verify no NEW errors are introduced for the touched files.
- **Icons:** Phosphor for content (deep imports like `from 'phosphor-react-native/src/icons/Lightbulb'`); Ionicons `chevron-back` is the legacy convention for settings-modal back chevrons but these flows use Phosphor `CaretLeft` for internal back nav (matches `/roadside` Step 2 precedent).
- **Token substitutions** (same as Roadside): `typography.title2Emphasized` for big titles, `typography.bodyRegular` for body, `typography.bodyEmphasized` where bold is needed, `typography.footnoteRegular` / `typography.footnoteEmphasized` for small labels. NEVER spread a typography token then override `fontWeight` — use the emphasized variant.
- **Commit cadence:** one commit per task. Conventional prefix (`feat:` / `refactor:` / `docs:`).
- **Branch:** `feat/unfamiliar-and-share-location` (already created at `111333f`).
- **Working directory:** `/Users/mylesashitey/code/fresh-greens`.

---

## File Structure

**Create:**
- `lib/api/share-session.ts` — AsyncStorage adapter (~70 lines)
- `hooks/useShareSession.ts` — reactive wrapper (~70 lines)
- `components/NotifyingPulse.tsx` — shared pulse chip (~60 lines)
- `components/LiveSafetySheet.tsx` — persistent widget, collapsed + expanded (~200 lines)
- `components/LifelineModal.tsx` — "You're not alone" Call/Text modal (~120 lines)
- `app/unfamiliar.tsx` — 2-step modal route (~350 lines)
- `app/share-location.tsx` — 1-step modal route (~200 lines)

**Modify:**
- `lib/format.ts` — add `formatDuration(seconds)`
- `app/_layout.tsx` — register `/unfamiliar` + `/share-location` as modal routes
- `app/safety.tsx` — wire tiles + contact-gate + active-session cross-tile alert
- `app/home.tsx` — mount `<LiveSafetySheet />` at root
- `app/en-route.tsx` — mount `<LiveSafetySheet />` at root
- `app/roadside.tsx` — retrofit Step 3 inline pulse to use `<NotifyingPulse />`
- `docs/learnings.md` — entry on ShareSession single-active-session model

---

## Task 1: ShareSession adapter + hook + formatDuration helper

**Files:**
- Create: `lib/api/share-session.ts`
- Create: `hooks/useShareSession.ts`
- Modify: `lib/format.ts`

- [ ] **Step 1: Read `lib/format.ts` to understand existing patterns**

Run: `cat /Users/mylesashitey/code/fresh-greens/lib/format.ts`

Just inspect — don't modify yet. Note the export style.

- [ ] **Step 2: Append `formatDuration` to `lib/format.ts`**

Add this function to the existing file (append at the bottom):

```ts
/**
 * Format an elapsed-seconds count for a share-session duration display.
 *  < 60 min → "MM:SS"
 *  ≥ 60 min → "Hh MMm" (e.g. "1h 23m", "2h 04m")
 *
 * Stopwatch-honest at short durations; reads warmer than HH:MM:SS for
 * long-running sessions where the seconds are noise.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours === 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
}
```

- [ ] **Step 3: Create `lib/api/share-session.ts`**

```ts
// Fresh Greens — share-session adapter.
//
// Single global state for an active "I am sharing my live location with my
// trusted contact" session, of two flavors:
//   - 'unfamiliar'   → started inside /unfamiliar, persists until "I'm safe now"
//   - 'share-location' → started inside /share-location, persists until widget-end
//
// v1 is UI-state simulation — no real SMS or live-tracking; the session reflects
// the user's *intent* to share. Mirrors the existing Roadside / Pulled-over
// share-toggle patterns. Real backend hookup explicitly deferred.
//
// See docs/superpowers/specs/2026-05-31-unfamiliar-and-share-location-design.md.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fresh-greens.share-session.v1';

export type ShareSessionType = 'unfamiliar' | 'share-location';

export type ShareSession = {
  /** uuid; survives app kill, but does not change across re-entry of the same flow */
  id: string;
  type: ShareSessionType;
  /** Verbatim user selection — "Just in case", "I'm lost", etc. */
  reason: string;
  /** ISO string; anchors the duration counter. */
  startedAtIso: string;
};

/** Returns null when no session active. Same shape as roadside-profile adapter. */
export async function getStoredShareSession(): Promise<ShareSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ShareSession;
  } catch (err) {
    console.warn('getStoredShareSession failed', err);
    return null;
  }
}

export async function setStoredShareSession(
  session: ShareSession,
): Promise<ShareSession> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function clearStoredShareSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 4: Create `hooks/useShareSession.ts`**

```ts
import { useCallback, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import {
  clearStoredShareSession,
  getStoredShareSession,
  type ShareSession,
  type ShareSessionType,
  setStoredShareSession,
} from '../lib/api/share-session';

/**
 * Reactive wrapper around the share-session adapter. Single global active
 * session at a time (one Unfamiliar OR one Share Location, never both).
 * Re-reads on focus so a session started from another screen surfaces
 * without a remount.
 *
 * Same shape as useRoadsideProfile / useFuelProfile / useTrustedContact —
 * `loading` only flips false (never back to true on refocus) to avoid a flash.
 */
export function useShareSession() {
  const [session, setSession] = useState<ShareSession | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const stored = await getStoredShareSession();
        if (!cancelled) {
          setSession(stored);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Starts (or replaces) the active session. Caller is responsible for
  // preventing accidental cross-tile replacement — see /safety's guards.
  const startSession = useCallback(
    async (input: { type: ShareSessionType; reason: string }): Promise<ShareSession> => {
      const next: ShareSession = {
        id: `${input.type}-${Date.now()}`,
        type: input.type,
        reason: input.reason,
        startedAtIso: new Date().toISOString(),
      };
      setSession(next);
      await setStoredShareSession(next);
      return next;
    },
    [],
  );

  const endSession = useCallback(async () => {
    setSession(null);
    await clearStoredShareSession();
  }, []);

  return { session, loading, startSession, endSession };
}
```

- [ ] **Step 5: Type-check**

Run: `cd /Users/mylesashitey/code/fresh-greens && npx tsc --noEmit 2>&1 | grep -iE "share-session|format"`

Expected: zero output related to the new files.

- [ ] **Step 6: Commit**

```bash
cd /Users/mylesashitey/code/fresh-greens && git add lib/api/share-session.ts hooks/useShareSession.ts lib/format.ts && git commit -m "feat: ShareSession adapter, hook, and formatDuration helper"
```

---

## Task 2: `<NotifyingPulse />` component + retrofit Roadside Step 3

**Files:**
- Create: `components/NotifyingPulse.tsx`
- Modify: `app/roadside.tsx` (Step 3 pulse retrofit)

- [ ] **Step 1: Read existing Roadside pulse implementation for reference**

Open `/Users/mylesashitey/code/fresh-greens/app/roadside.tsx` and scan the styles `statusPulseRow`, `statusPulseDot`, `statusPulseLabel` plus the JSX where they're used (inside `LiveStatus`). The new component should produce identical visual output.

- [ ] **Step 2: Create `components/NotifyingPulse.tsx`**

```tsx
import { Animated, StyleSheet, Text, View } from 'react-native';

import { usePulseOpacity } from '../hooks/usePulseOpacity';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = {
  contactName: string;
  /** Optional override; defaults to `${contactName} is being notified`. */
  label?: string;
  /** Centered (flow footers) vs. row-left (inside widget chrome). Default: 'center'. */
  align?: 'center' | 'start';
};

/**
 * Shared "{contactName} is being notified" affordance — pulsing freshgreen dot
 * + label. Extracted from /roadside Step 3 (which was the original site) so
 * Unfamiliar, Share Location, and the LiveSafetySheet all share one source
 * of truth for the pattern.
 *
 * A11y: parent View carries the label; the animated dot is decorative
 * (`accessibilityElementsHidden`).
 */
export function NotifyingPulse({ contactName, label, align = 'center' }: Props) {
  const pulse = usePulseOpacity();
  const resolvedLabel = label ?? `${contactName} is being notified`;

  return (
    <View
      style={[
        styles.row,
        align === 'center' ? styles.alignCenter : styles.alignStart,
      ]}
      accessibilityLabel={resolvedLabel}
    >
      <Animated.View
        style={[styles.dot, { opacity: pulse }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={styles.label}>{resolvedLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  alignCenter: {
    justifyContent: 'center',
  },
  alignStart: {
    justifyContent: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.freshgreen,
  },
  label: {
    ...typography.footnoteRegular,
    color: colors.labelSecondary,
  },
});
```

If `typography.footnoteRegular` isn't the exact name used in the project, swap to whatever Roadside Step 3 uses for `statusPulseLabel` (read app/roadside.tsx styles to confirm).

- [ ] **Step 3: Retrofit `app/roadside.tsx` Step 3 to use NotifyingPulse**

In `app/roadside.tsx`'s `LiveStatus` component, find the existing block:

```tsx
{shareOn && contact && (
  <View
    style={styles.statusPulseRow}
    accessibilityLabel={`${contact.name} is being notified`}
  >
    <Animated.View
      style={[styles.statusPulseDot, { opacity: pulse }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
    <Text style={styles.statusPulseLabel}>
      {contact.name} is being notified
    </Text>
  </View>
)}
```

Replace it with:

```tsx
{shareOn && contact && <NotifyingPulse contactName={contact.name} />}
```

Then:
1. Remove the now-unused `usePulseOpacity` call (`const pulse = usePulseOpacity();` inside `LiveStatus`) — it's no longer referenced.
2. Remove the now-unused styles: `statusPulseRow`, `statusPulseDot`, `statusPulseLabel`.
3. Remove the now-unused `Animated` import IF it's not used elsewhere in the file (search to confirm; if other uses exist, keep it).
4. Remove the `usePulseOpacity` import IF it's no longer used (it shouldn't be after removing the local `pulse` call).
5. Add `import { NotifyingPulse } from '../components/NotifyingPulse';`

- [ ] **Step 4: Type-check**

Run: `cd /Users/mylesashitey/code/fresh-greens && npx tsc --noEmit 2>&1 | grep -iE "roadside\.tsx|NotifyingPulse"`

Expected: zero output from these files.

- [ ] **Step 5: Commit**

```bash
cd /Users/mylesashitey/code/fresh-greens && git add components/NotifyingPulse.tsx app/roadside.tsx && git commit -m "feat: NotifyingPulse component + retrofit Roadside Step 3"
```

---

## Task 3: `<LiveSafetySheet />` component

**Files:**
- Create: `components/LiveSafetySheet.tsx`

- [ ] **Step 1: Create the component**

`components/LiveSafetySheet.tsx`:

```tsx
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CaretUp } from 'phosphor-react-native/src/icons/CaretUp';

import { Button } from './Button';
import { DragHandle } from './DragHandle';
import { NotifyingPulse } from './NotifyingPulse';
import { useShareSession } from '../hooks/useShareSession';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { formatDuration } from '../lib/format';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Persistent sticky bottom widget surfacing the active ShareSession on
 * /home and /en-route. Returns null when no session is active.
 *
 * Collapsed (default): 64pt pill at the bottom, tap to expand.
 * Expanded: Modal sheet with DragHandle, full session detail, End-sharing
 *           CTA, NotifyingPulse footer.
 *
 * v1 simulates time-elapsed by ticking a local counter once per second.
 * The session itself is global state (useShareSession); the ticker is
 * presentation-only.
 *
 * Privacy: for type='unfamiliar' sessions the widget surfaces "Unfamiliar
 * area" as the session label, NOT the underlying problem (the user's
 * verbatim selection like "I'm being followed"). Glanceability + dignity.
 */
export function LiveSafetySheet() {
  const { session, endSession } = useShareSession();
  const { contact } = useTrustedContact();
  const [expanded, setExpanded] = useState(false);
  const [tickSeconds, setTickSeconds] = useState(0);

  // Recompute elapsed seconds once per second while a session is live.
  useEffect(() => {
    if (!session) {
      setTickSeconds(0);
      return;
    }
    const startedAt = new Date(session.startedAtIso).getTime();
    const update = () => {
      setTickSeconds(Math.floor((Date.now() - startedAt) / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session]);

  if (!session || !contact) return null;

  const duration = formatDuration(tickSeconds);
  const sessionTypeLabel =
    session.type === 'unfamiliar' ? 'Unfamiliar area' : 'Sharing location';
  const widgetReason =
    session.type === 'unfamiliar' ? 'Unfamiliar area' : session.reason;

  function handleEnd() {
    if (!session) return;
    if (session.type === 'unfamiliar') {
      Alert.alert(
        'End sharing?',
        'Your trusted contact will stop seeing your location.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End',
            style: 'destructive',
            onPress: async () => {
              setExpanded(false);
              await endSession();
            },
          },
        ],
      );
    } else {
      void (async () => {
        setExpanded(false);
        await endSession();
      })();
    }
  }

  return (
    <>
      {/* Collapsed pill — anchored to bottom of mounting surface */}
      <Pressable
        onPress={() => setExpanded(true)}
        style={({ pressed }) => [styles.collapsed, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel={`Sharing location with ${contact.name}. Tap to expand.`}
      >
        <NotifyingPulse
          contactName={contact.name}
          label={`${sessionTypeLabel} · ${duration}`}
          align="start"
        />
        <CaretUp size={18} color={colors.labelSecondary} weight="bold" />
      </Pressable>

      {/* Expanded sheet */}
      <Modal
        visible={expanded}
        transparent
        animationType="slide"
        onRequestClose={() => setExpanded(false)}
        accessibilityViewIsModal
      >
        <Pressable
          style={styles.scrim}
          onPress={() => setExpanded(false)}
          accessible={false}
          accessibilityElementsHidden
        >
          <Pressable style={styles.expandedCard} onPress={() => {}}>
            <DragHandle />

            <View style={styles.expandedBody}>
              <Text style={styles.expandedKicker}>Live</Text>
              <Text style={styles.expandedTitle} accessibilityRole="header">
                Sharing location
              </Text>

              <View style={styles.detailCard}>
                <View style={styles.activelyRow}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activelyLabel}>Actively sharing</Text>
                </View>
                <View style={styles.separator} />
                <View style={styles.contactRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{contact.initials}</Text>
                  </View>
                  <View>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactRelation}>Partner</Text>
                  </View>
                </View>
                <View style={styles.separator} />
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Duration</Text>
                  <Text style={styles.metaValue}>{duration}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Reason</Text>
                  <Text style={styles.metaValue}>{widgetReason}</Text>
                </View>
              </View>

              <View style={styles.endCtaWrap}>
                <Button
                  text="End sharing"
                  type="primary"
                  fill="outline"
                  onPress={handleEnd}
                  style={styles.endCtaStretch}
                />
              </View>

              <View style={styles.expandedFooter}>
                <NotifyingPulse contactName={contact.name} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Collapsed pill
  collapsed: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    height: 64,
    backgroundColor: colors.white,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    ...shadows.card,
    zIndex: 50,
  },
  // Scrim + expanded card
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  expandedCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.lg,
  },
  expandedBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  expandedKicker: {
    ...typography.footnoteRegular,
    color: colors.labelSecondary,
  },
  expandedTitle: {
    ...typography.title2Emphasized,
    color: colors.black,
  },
  // Detail card
  detailCard: {
    backgroundColor: colors.systemGroupedBackground,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  activelyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.freshgreen,
  },
  activelyLabel: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  separator: {
    height: 1,
    backgroundColor: colors.cardBorderSubtle,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.wiltedgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.footnoteEmphasized,
    color: colors.white,
  },
  contactName: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  contactRelation: {
    ...typography.footnoteRegular,
    color: colors.labelSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    ...typography.bodyRegular,
    color: colors.labelSecondary,
  },
  metaValue: {
    ...typography.bodyRegular,
    color: colors.black,
  },
  // CTAs
  endCtaWrap: {
    marginTop: spacing.sm,
  },
  endCtaStretch: {
    alignSelf: 'stretch',
  },
  expandedFooter: {
    paddingTop: spacing.xs,
  },
});
```

Notes:
- The `shadows.card` token may not exist verbatim — read `theme/shadows.ts` and substitute the closest existing shadow (likely `shadows.elevation1` or just `shadows.subtle`). Match what `/menu` rows use.
- If `typography.footnoteEmphasized` / `bodyEmphasized` keys differ from what Roadside uses, mirror Roadside's substitutions exactly.
- The avatar style (wiltedgreen circle + freshgreen ring) intentionally only uses wiltedgreen here for the collapsed-into-widget context; the LifelineModal uses the bigger freshgreen-ring version per Figma.

- [ ] **Step 2: Type-check**

Run: `cd /Users/mylesashitey/code/fresh-greens && npx tsc --noEmit 2>&1 | grep -iE "LiveSafetySheet"`

Expected: zero output. If you see token errors (e.g. `shadows.card` missing), substitute closest and re-run.

- [ ] **Step 3: Commit**

```bash
cd /Users/mylesashitey/code/fresh-greens && git add components/LiveSafetySheet.tsx && git commit -m "feat: LiveSafetySheet persistent widget (collapsed + expanded)"
```

---

## Task 4: Mount `<LiveSafetySheet />` on `/home` and `/en-route`

**Files:**
- Modify: `app/home.tsx`
- Modify: `app/en-route.tsx`

- [ ] **Step 1: Add the import + mount at root of `app/home.tsx`**

Open `/Users/mylesashitey/code/fresh-greens/app/home.tsx`. At the top of the existing local-component imports block, add:

```tsx
import { LiveSafetySheet } from '../components/LiveSafetySheet';
```

Find the return statement at ~line 1034 — the `<View style={styles.root}>` root View. The component renders `null` when there's no active session, so we just drop it inside the root. Add `<LiveSafetySheet />` as the **LAST child** of the root View (so it stacks above other absolutely-positioned children in z-order). Example:

```tsx
return (
  <View style={styles.root}>
    {/* …existing children — map, bottom sheet, daylight strip, etc.… */}
    <LiveSafetySheet />
  </View>
);
```

- [ ] **Step 2: Same for `app/en-route.tsx`**

Open `/Users/mylesashitey/code/fresh-greens/app/en-route.tsx`. Add the same import. Find the return at ~line 1114 (`<View style={styles.root}>`). Add `<LiveSafetySheet />` as the **LAST child** of the root View.

- [ ] **Step 3: Type-check**

Run: `cd /Users/mylesashitey/code/fresh-greens && npx tsc --noEmit 2>&1 | grep -iE "home\.tsx|en-route\.tsx"`

Expected: only pre-existing errors (if any). No new errors introduced.

- [ ] **Step 4: Commit**

```bash
cd /Users/mylesashitey/code/fresh-greens && git add app/home.tsx app/en-route.tsx && git commit -m "feat: mount LiveSafetySheet on /home and /en-route"
```

---

## Task 5: `<LifelineModal />` component

**Files:**
- Create: `components/LifelineModal.tsx`

- [ ] **Step 1: Create the component**

`components/LifelineModal.tsx`:

```tsx
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { Phone } from 'phosphor-react-native/src/icons/Phone';

import { Button } from './Button';
import { DragHandle } from './DragHandle';
import { NotifyingPulse } from './NotifyingPulse';
import type { TrustedContact } from '../lib/api/trusted-contact';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = {
  visible: boolean;
  onClose: () => void;
  contact: TrustedContact;
};

/**
 * "You're not alone." — Unfamiliar-area-only lifeline. Tapping the
 * NotifyingPulse footer in /unfamiliar opens this. Big avatar + Call /
 * Text shortcuts. Sharing continues during/after the call.
 *
 * Per spec scope-decision: lifeline is Unfamiliar-only — Roadside and
 * Pulled-over have their own contact-handling chrome; Share Location
 * stays light.
 */
export function LifelineModal({ visible, onClose, contact }: Props) {
  function handleCall() {
    const tel = `tel:${contact.phoneNumber.replace(/[^\d+]/g, '')}`;
    void Linking.openURL(tel);
  }

  function handleText() {
    const sms = `sms:${contact.phoneNumber.replace(/[^\d+]/g, '')}`;
    void Linking.openURL(sms);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessible={false}
        accessibilityElementsHidden
      >
        <Pressable style={styles.card} onPress={() => {}}>
          <DragHandle />

          <View style={styles.body}>
            <Text style={styles.title} accessibilityRole="header">
              You&apos;re not alone.
            </Text>
            <Text style={styles.subtitle}>
              Your Trusted Contact is alerted during emergencies and can see your current location.
            </Text>

            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{contact.initials}</Text>
              </View>
            </View>
            <Text style={styles.name}>{contact.name}</Text>

            <View style={styles.ctaStack}>
              <Button
                text="Call"
                type="primary"
                fill="fill"
                icon={<Phone size={20} color={colors.white} weight="regular" />}
                onPress={handleCall}
                style={styles.ctaStretch}
              />
              <Button
                text="Text"
                type="primary"
                fill="outline"
                icon={<ChatCircle size={20} color={colors.freshgreen} weight="regular" />}
                onPress={handleText}
                style={styles.ctaStretch}
              />
            </View>

            <View style={styles.footer}>
              <NotifyingPulse
                contactName={contact.name}
                label="Your Trusted Contact is being notified"
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.lg,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.title2Emphasized,
    color: colors.black,
    alignSelf: 'flex-start',
  },
  subtitle: {
    ...typography.bodyRegular,
    color: colors.labelSecondary,
    alignSelf: 'flex-start',
  },
  avatarRing: {
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 4,
    borderColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.burntgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.title2Emphasized,
    color: colors.white,
    fontSize: 44,
  },
  name: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  ctaStack: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  ctaStretch: {
    alignSelf: 'stretch',
  },
  footer: {
    paddingTop: spacing.lg,
  },
});
```

Notes:
- `colors.burntgreen` is from the existing token set (the dark-green deep-accent token). If it doesn't exist, substitute `colors.wiltedgreen`.
- The `fontSize: 44` override on `avatarText` is the only acceptable inline override — the typography ramp doesn't have a display token this large. Document this in code as the exception (the comment is the WHY).

- [ ] **Step 2: Type-check**

Run: `cd /Users/mylesashitey/code/fresh-greens && npx tsc --noEmit 2>&1 | grep -iE "LifelineModal"`

Expected: zero output.

- [ ] **Step 3: Commit**

```bash
cd /Users/mylesashitey/code/fresh-greens && git add components/LifelineModal.tsx && git commit -m "feat: LifelineModal — Unfamiliar-only Call/Text shortcut"
```

---

## Task 6: `/unfamiliar` route (2-step + LifelineModal + re-entry)

**Files:**
- Create: `app/unfamiliar.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Register `/unfamiliar` in the layout**

Open `app/_layout.tsx`. Add the following block ABOVE the `/roadside` block (same group of modal screens):

```tsx
{/*
  /unfamiliar — "Unfamiliar area" /safety sub-flow. Two-step page-sheet
  modal: problem picker → safe-destination picker. Auto-starts a global
  ShareSession on Step 1; the LiveSafetySheet widget on /home or /en-route
  carries the session forward after destination-routing.
*/}
<Stack.Screen
  name="unfamiliar"
  options={{ presentation: 'modal' }}
/>
```

- [ ] **Step 2: Create the route**

`app/unfamiliar.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as Location from 'expo-location';

import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { GasPump } from 'phosphor-react-native/src/icons/GasPump';
import { Lightbulb } from 'phosphor-react-native/src/icons/Lightbulb';
import { Road } from 'phosphor-react-native/src/icons/Road';

import { DragHandle } from '../components/DragHandle';
import { Button } from '../components/Button';
import { LifelineModal } from '../components/LifelineModal';
import { NotifyingPulse } from '../components/NotifyingPulse';
import { useShareSession } from '../hooks/useShareSession';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { searchPlaces } from '../lib/api/places';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Step = 'problem' | 'destination' | 'active';

type ProblemOption = {
  id: string;
  title: string;
  clarifier: string;
};

const PROBLEMS: ProblemOption[] = [
  { id: 'lost',     title: "I'm lost",         clarifier: "I don't recognize this area and need to get somewhere safe" },
  { id: 'unsafe',   title: 'I feel unsafe',    clarifier: 'Something about this area feels wrong — I want to leave' },
  { id: 'followed', title: "I'm being followed", clarifier: 'I think someone is tailing me' },
];

type DestinationOption = {
  id: 'well-lit' | 'gas-station' | 'on-ramp';
  title: string;
  Icon: typeof Lightbulb;
  /**
   * Mapbox / Apple Maps category seed for searchPlaces. "Well-lit" has no
   * literal category — we proxy to "open business" (the closest honest
   * approximation; documented in the spec's "Well-lit" rationale).
   */
  query: string;
};

const DESTINATIONS: DestinationOption[] = [
  { id: 'well-lit',    title: 'Take me to somewhere well-lit',  Icon: Lightbulb, query: 'open business' },
  { id: 'gas-station', title: 'Take me to a gas station',       Icon: GasPump,   query: 'gas station' },
  { id: 'on-ramp',     title: 'Take me to the nearest on-ramp', Icon: Road,      query: 'highway on-ramp' },
];

/**
 * /unfamiliar — Unfamiliar area /safety sub-flow.
 *
 * Step 1 (picker): pick the problem. Selection starts a global ShareSession
 *   and advances to Step 2.
 * Step 2 (destinations): pick a safe-destination category; nearest POI search
 *   + router.replace('/en-route?…') routes the user there. Modal dismisses;
 *   LiveSafetySheet on /en-route carries the active session forward.
 * Active (re-entry): if a session is already live when the route mounts, jump
 *   straight to a small "active session" view with end-sharing affordance.
 *
 * Footer pulse on Steps 1/2 is wrapped in a Pressable that opens LifelineModal.
 */
export default function Unfamiliar() {
  const router = useRouter();
  const { session, startSession, endSession } = useShareSession();
  const { contact } = useTrustedContact();
  const [step, setStep] = useState<Step>(() =>
    session?.type === 'unfamiliar' ? 'active' : 'problem',
  );
  const [lifelineOpen, setLifelineOpen] = useState(false);

  async function handleProblemPick(option: ProblemOption) {
    await startSession({ type: 'unfamiliar', reason: option.title });
    setStep('destination');
  }

  async function handleDestinationPick(option: DestinationOption) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location needed',
          'Allow location access so we can find nearby safe destinations.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const results = await searchPlaces(option.query, {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const hit = results[0];
      if (!hit) {
        Alert.alert(
          'No results',
          `Couldn't find a ${option.title.toLowerCase().replace('take me to ', '')} nearby. Try a different option.`,
        );
        return;
      }
      router.replace({
        pathname: '/en-route',
        params: {
          destination: `${hit.latitude},${hit.longitude}`,
          destinationName: hit.name,
        },
      });
    } catch (err) {
      console.warn('unfamiliar destination search failed', err);
      Alert.alert(
        'Search failed',
        'Could not search for nearby destinations. Try again in a moment.',
      );
    }
  }

  async function handleSafeNow() {
    await endSession();
    router.back();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <DragHandle />
        {step === 'problem' && (
          <ProblemPicker
            contactName={contact?.name ?? 'Your contact'}
            onPick={handleProblemPick}
            onLifeline={() => setLifelineOpen(true)}
          />
        )}
        {step === 'destination' && (
          <DestinationPicker
            contactName={contact?.name ?? 'Your contact'}
            onBack={() => setStep('problem')}
            onPick={handleDestinationPick}
            onSafeNow={handleSafeNow}
            onLifeline={() => setLifelineOpen(true)}
          />
        )}
        {step === 'active' && session && (
          <ActiveSessionView
            contactName={contact?.name ?? 'Your contact'}
            sessionReason={session.reason}
            onEnd={handleSafeNow}
          />
        )}
      </SafeAreaView>

      {contact && (
        <LifelineModal
          visible={lifelineOpen}
          onClose={() => setLifelineOpen(false)}
          contact={contact}
        />
      )}
    </View>
  );
}

function ProblemPicker({
  contactName,
  onPick,
  onLifeline,
}: {
  contactName: string;
  onPick: (option: ProblemOption) => void;
  onLifeline: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.subtitle}>Ok. You&apos;re somewhere unfamiliar.</Text>
      <Text style={styles.title} accessibilityRole="header">
        What&apos;s going on?
      </Text>

      <View style={styles.rowList}>
        {PROBLEMS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onPick(p)}
            style={({ pressed }) => [styles.twoLineRow, pressed && pressedDim]}
            accessibilityRole="button"
            accessibilityLabel={`${p.title}. ${p.clarifier}`}
          >
            <Text style={styles.rowTitle}>{p.title}</Text>
            <Text style={styles.rowClarifier}>{p.clarifier}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={onLifeline}
        style={styles.pulseFooter}
        accessibilityRole="button"
        accessibilityLabel={`${contactName} is being notified. Tap to call or text.`}
        hitSlop={8}
      >
        <NotifyingPulse contactName={contactName} />
      </Pressable>
    </ScrollView>
  );
}

function DestinationPicker({
  contactName,
  onBack,
  onPick,
  onSafeNow,
  onLifeline,
}: {
  contactName: string;
  onBack: () => void;
  onPick: (option: DestinationOption) => void;
  onSafeNow: () => void;
  onLifeline: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backChevron, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
      >
        <CaretLeft size={28} color={colors.black} weight="regular" />
      </Pressable>

      <Text style={styles.subtitle}>Let&apos;s get you someplace safe.</Text>
      <Text style={styles.title} accessibilityRole="header">
        Where do you want to go?
      </Text>
      <Text style={styles.aspirationalNote}>
        Fresh Greens saves your journey periodically to ensure we can get you back on track.
      </Text>

      <View style={styles.rowList}>
        {DESTINATIONS.map((d) => (
          <Pressable
            key={d.id}
            onPress={() => onPick(d)}
            style={({ pressed }) => [styles.iconRow, pressed && pressedDim]}
            accessibilityRole="button"
            accessibilityLabel={d.title}
          >
            <View style={styles.iconCircle}>
              <d.Icon size={24} color={colors.freshgreen} weight="regular" />
            </View>
            <Text style={styles.rowTitle}>{d.title}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.safeNowWrap}>
        <Button
          text="I'm safe now"
          type="primary"
          fill="outline"
          onPress={onSafeNow}
          style={styles.safeNowStretch}
        />
      </View>

      <Pressable
        onPress={onLifeline}
        style={styles.pulseFooter}
        accessibilityRole="button"
        accessibilityLabel={`${contactName} is being notified. Tap to call or text.`}
        hitSlop={8}
      >
        <NotifyingPulse contactName={contactName} />
      </Pressable>
    </ScrollView>
  );
}

function ActiveSessionView({
  contactName,
  sessionReason,
  onEnd,
}: {
  contactName: string;
  sessionReason: string;
  onEnd: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.subtitle}>Already on it.</Text>
      <Text style={styles.title} accessibilityRole="header">
        Sharing in Unfamiliar area.
      </Text>
      <Text style={styles.aspirationalNote}>Reason: {sessionReason}</Text>

      <View style={styles.safeNowWrap}>
        <Button
          text="I'm safe now"
          type="primary"
          fill="fill"
          onPress={onEnd}
          style={styles.safeNowStretch}
        />
      </View>

      <View style={styles.pulseFooter}>
        <NotifyingPulse contactName={contactName} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  backChevron: {
    marginTop: spacing.sm,
    width: 32,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  subtitle: {
    ...typography.bodyRegular,
    color: colors.labelSecondary,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.title2Emphasized,
    color: colors.black,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  aspirationalNote: {
    ...typography.footnoteRegular,
    color: colors.labelSecondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  rowList: {
    gap: spacing.sm,
  },
  twoLineRow: {
    backgroundColor: colors.systemGroupedBackground,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 76,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.systemGroupedBackground,
    borderRadius: 12,
    padding: spacing.md,
    minHeight: 60,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  rowClarifier: {
    ...typography.bodyRegular,
    color: colors.labelSecondary,
  },
  safeNowWrap: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  safeNowStretch: {
    alignSelf: 'stretch',
  },
  pulseFooter: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    alignItems: 'center',
  },
});
```

Notes:
- `searchPlaces(query, userLocation)` is the existing API in `lib/api/places.ts` — returns `Place[]` with `id / name / address / latitude / longitude / distanceMiles`. The plan threads location via `expo-location` per option-pick (we don't need a persistent listener — the request is one-shot per destination pick).
- The router params (`pathname` + `params` object) follow expo-router's typed-route shape — if /en-route's existing entry expects raw `?destination=` query strings, the implementer should adapt by reading `app/en-route.tsx`'s param parsing on mount.
- `aspirationalNote` uses negative `marginTop: -spacing.sm` to tuck under the title — adjust visually if needed.

- [ ] **Step 3: Type-check**

Run: `cd /Users/mylesashitey/code/fresh-greens && npx tsc --noEmit 2>&1 | grep -iE "unfamiliar"`

Expected: zero output.

- [ ] **Step 4: Commit**

```bash
cd /Users/mylesashitey/code/fresh-greens && git add app/_layout.tsx app/unfamiliar.tsx && git commit -m "feat: /unfamiliar route — problem + destination + active + LifelineModal"
```

---

## Task 7: `/share-location` route (single-step picker + re-entry)

**Files:**
- Create: `app/share-location.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Register `/share-location` in the layout**

Open `app/_layout.tsx`. Add the following block ABOVE the `/unfamiliar` block (or alongside, same group):

```tsx
{/*
  /share-location — proactive Share Location /safety sub-flow. Single-
  step reason picker; selection starts a global ShareSession and dismisses.
  LiveSafetySheet on /home or /en-route carries the session forward.
*/}
<Stack.Screen
  name="share-location"
  options={{ presentation: 'modal' }}
/>
```

- [ ] **Step 2: Create the route**

`app/share-location.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { DragHandle } from '../components/DragHandle';
import { NotifyingPulse } from '../components/NotifyingPulse';
import { useShareSession } from '../hooks/useShareSession';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type ReasonOption = {
  id: string;
  title: string;
  clarifier: string;
};

const REASONS: ReasonOption[] = [
  { id: 'new-place',   title: 'Heading somewhere new', clarifier: 'I want someone to know where I am' },
  { id: 'night-drive', title: 'Driving late at night', clarifier: 'I could use the additional peace of mind' },
  { id: 'uneasy',      title: 'I feel uneasy',         clarifier: "Something's off, and I could use the visibility" },
  { id: 'routine',     title: 'Just in case',          clarifier: 'Routine safety — nothing specific' },
];

/**
 * /share-location — proactive Share Location /safety sub-flow.
 *
 * Single step (reason picker). On selection: startSession + router.back()
 * to whatever was underneath (/home or /en-route). LiveSafetySheet
 * surfaces the active session there.
 *
 * Re-entry: if a share-location session is already live, render the
 * "active session" view with End-sharing CTA — never the picker.
 *
 * No lifeline footer (Unfamiliar-only per scope decision).
 */
export default function ShareLocation() {
  const router = useRouter();
  const { session, startSession, endSession } = useShareSession();
  const { contact } = useTrustedContact();
  const [busy, setBusy] = useState(false);

  const isActive = session?.type === 'share-location';

  async function handlePick(option: ReasonOption) {
    if (busy) return;
    setBusy(true);
    try {
      await startSession({ type: 'share-location', reason: option.title });
      router.back();
    } catch (err) {
      console.warn('share-location start failed', err);
      setBusy(false);
    }
  }

  async function handleEnd() {
    await endSession();
    router.back();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <DragHandle />
        {isActive && session ? (
          <ActiveView
            contactName={contact?.name ?? 'Your contact'}
            sessionReason={session.reason}
            onEnd={handleEnd}
          />
        ) : (
          <ReasonPicker
            contactName={contact?.name ?? 'Your contact'}
            onPick={handlePick}
            disabled={busy}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function ReasonPicker({
  contactName,
  onPick,
  disabled,
}: {
  contactName: string;
  onPick: (option: ReasonOption) => void;
  disabled: boolean;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.subtitle}>On it. Sharing your location now.</Text>
      <Text style={styles.title} accessibilityRole="header">
        What&apos;s the situation?
      </Text>

      <View style={styles.rowList}>
        {REASONS.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => onPick(r)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.twoLineRow,
              pressed && !disabled && pressedDim,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}. ${r.clarifier}`}
            accessibilityState={{ disabled }}
          >
            <Text style={styles.rowTitle}>{r.title}</Text>
            <Text style={styles.rowClarifier}>{r.clarifier}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.pulseFooter}>
        <NotifyingPulse contactName={contactName} />
      </View>
    </ScrollView>
  );
}

function ActiveView({
  contactName,
  sessionReason,
  onEnd,
}: {
  contactName: string;
  sessionReason: string;
  onEnd: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.subtitle}>Already on it.</Text>
      <Text style={styles.title} accessibilityRole="header">
        Sharing your location.
      </Text>
      <Text style={styles.aspirationalNote}>Reason: {sessionReason}</Text>

      <View style={styles.endWrap}>
        <Button
          text="End sharing"
          type="primary"
          fill="fill"
          onPress={onEnd}
          style={styles.endStretch}
        />
      </View>

      <View style={styles.pulseFooter}>
        <NotifyingPulse contactName={contactName} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  subtitle: {
    ...typography.bodyRegular,
    color: colors.labelSecondary,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.title2Emphasized,
    color: colors.black,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  aspirationalNote: {
    ...typography.footnoteRegular,
    color: colors.labelSecondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  rowList: {
    gap: spacing.sm,
  },
  twoLineRow: {
    backgroundColor: colors.systemGroupedBackground,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 76,
  },
  rowTitle: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  rowClarifier: {
    ...typography.bodyRegular,
    color: colors.labelSecondary,
  },
  endWrap: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  endStretch: {
    alignSelf: 'stretch',
  },
  pulseFooter: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    alignItems: 'center',
  },
});
```

- [ ] **Step 3: Type-check**

Run: `cd /Users/mylesashitey/code/fresh-greens && npx tsc --noEmit 2>&1 | grep -iE "share-location"`

Expected: zero output.

- [ ] **Step 4: Commit**

```bash
cd /Users/mylesashitey/code/fresh-greens && git add app/_layout.tsx app/share-location.tsx && git commit -m "feat: /share-location route — single-step reason picker + active view"
```

---

## Task 8: Wire `/safety` tiles + contact gate + cross-tile alert

**Files:**
- Modify: `app/safety.tsx`

- [ ] **Step 1: Read current safety tile structure**

Run: `cat /Users/mylesashitey/code/fresh-greens/app/safety.tsx`

Find the SafetyTab array (currently `id: 'unfamiliar'` and `id: 'share-location'` tiles have `href: null` placeholders) and the tile-rendering JSX (look for `onPress` on Pressable, or `href` consumed by a Link).

- [ ] **Step 2: Wire the tile hrefs + add the gate**

In `app/safety.tsx`:

1. **Update the tile array.** Find the two tiles with `id: 'unfamiliar'` and `id: 'share-location'`, change `href: null` to `href: '/unfamiliar'` and `href: '/share-location'` respectively. Remove the `// TODO` comments.

2. **Add the hooks** at the top of the `Safety` component (alongside any existing hooks):

```tsx
import { Alert } from 'react-native';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { useShareSession } from '../hooks/useShareSession';
```

```tsx
const { contact } = useTrustedContact();
const { session } = useShareSession();
```

3. **Replace the tile-tap handler.** Find the existing `onPress` on each Pressable tile and switch it to call a unified handler. Define the handler at component-scope:

```tsx
function handleTilePress(tile: SafetyTab) {
  const isShareFlow = tile.id === 'unfamiliar' || tile.id === 'share-location';

  // No-contact gate for the share-dependent flows
  if (isShareFlow && !contact) {
    Alert.alert(
      'Set a trusted contact',
      'These flows share your location with your trusted contact. Set one up first.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set up', onPress: () => router.push('/trusted-contact-setup') },
      ],
    );
    return;
  }

  // Cross-tile guard: prevent starting Unfamiliar while a share-location
  // session is active (or vice versa). Re-entering the SAME tile is fine
  // — that route handles its own active-state view.
  if (session && isShareFlow) {
    const sameTile =
      (tile.id === 'unfamiliar' && session.type === 'unfamiliar') ||
      (tile.id === 'share-location' && session.type === 'share-location');

    if (!sameTile) {
      const otherLabel =
        session.type === 'unfamiliar' ? 'Unfamiliar area' : 'Share Location';
      const desiredLabel =
        tile.id === 'unfamiliar' ? 'Unfamiliar area' : 'Share Location';
      Alert.alert(
        `You're in a ${otherLabel} session.`,
        `End it first to enter ${desiredLabel}.`,
        [{ text: 'OK' }],
      );
      return;
    }
  }

  if (tile.href) {
    router.push(tile.href);
  }
}
```

4. **Use the handler.** Change each Pressable's `onPress={...}` to `onPress={() => handleTilePress(tile)}`. The existing `href: null` check (which made Pulled-over alone tappable) is replaced — Pulled-over and Roadside still tap-through because they don't trip any gate.

(If the existing JSX uses `<Link>` from expo-router instead of `<Pressable onPress>`, swap to `<Pressable>` with the unified handler.)

- [ ] **Step 3: Type-check**

Run: `cd /Users/mylesashitey/code/fresh-greens && npx tsc --noEmit 2>&1 | grep -iE "safety\.tsx"`

Expected: only pre-existing errors. No new errors introduced.

- [ ] **Step 4: Commit**

```bash
cd /Users/mylesashitey/code/fresh-greens && git add app/safety.tsx && git commit -m "feat: wire /unfamiliar + /share-location tiles + no-contact gate + cross-tile guard"
```

---

## Task 9: Documentation — `docs/learnings.md` entry

**Files:**
- Modify: `docs/learnings.md`

- [ ] **Step 1: Append a branch-headed entry at the TOP**

Open `docs/learnings.md`. Insert this above the existing newest entry (newest-at-top convention):

```markdown
## feat/unfamiliar-and-share-location — single-active ShareSession + widget-as-persistence

Building `/unfamiliar` and `/share-location` raised the same architectural question Roadside dodged: *where does the active state live when the user dismisses the modal that started it?* Three options ruled out:

1. **State on the route itself** — dies on dismiss. Bad: user expects the share to persist when they navigate back to /home.
2. **In-flow toggles** like Roadside Step 2 / Pulled-over contact-phase — fine *inside* those flows; doesn't generalize because Unfamiliar Step 2's destination routing actively dismisses the modal mid-session.
3. **Per-flow context providers** — works but multiplies provider trees and forces the widget to subscribe to N possible sources.

Chose a **single global ShareSession** (`lib/api/share-session.ts` + `hooks/useShareSession.ts`) with a *single active session at a time*. Either Unfamiliar OR Share Location, never both. Cross-tile attempts are guarded at `/safety`. The same hook drives the persistent `<LiveSafetySheet />` widget mounted on both `/home` and `/en-route` — the widget IS the persistence affordance; the originating modal is ephemeral.

Carved out the in-flow share-toggles in Roadside Step 2 + Pulled-over contact phase to stay independent (they live inside their flows; no widget for those). The asymmetry is intentional: Roadside/Pulled-over have their own state chrome; standalone Share Location and Unfamiliar do not.

Extracted `<NotifyingPulse />` as the shared "{name} is being notified" affordance. Roadside Step 3's previously-inline pulse retrofitted to use it — now 5+ call sites converge on one component.

v1 ships as **UI-state simulation** — no real SMS, no live-tracking. The "Myles is being notified" pulse reflects intent, matching the existing thesis-scope shares in Roadside/Pulled-over. Real backend hookup deferred to post-v1 — flagged at the top of the spec.

**Privacy detail:** the `LiveSafetySheet` widget exposes the session *type* ("Unfamiliar area" / "Sharing location") but not the underlying problem for Unfamiliar sessions (the user's verbatim "I'm being followed" stays out of the always-visible widget — only their contact gets that context). Confirmation pattern is also asymmetric: ending an Unfamiliar session requires an Alert; Share Location ends single-tap. Honesty about stakes.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mylesashitey/code/fresh-greens && git add docs/learnings.md && git commit -m "docs: unfamiliar + share-location learnings entry"
```

---

## Final verification (after all tasks)

- [ ] **Type-check the whole branch**

Run: `cd /Users/mylesashitey/code/fresh-greens && npx tsc --noEmit 2>&1 | grep -ivE "@expo/vector-icons|@vercel/node"`

Expected: zero output (ignoring pre-existing environment errors).

- [ ] **Walk the flows in the simulator** (controller will dispatch this after all tasks)

End-to-end verification:
- /safety → Unfamiliar tile (with contact): Step 1 picker → pick "I'm lost" → Step 2 destinations → tap "gas station" → /en-route opens routed to a real gas station → LiveSafetySheet appears at bottom → expand → tap "End sharing" → Alert confirms → end → widget disappears.
- /safety → Unfamiliar tile (without contact): no-contact gate Alert → "Set up" → /trusted-contact-setup → return → re-tap tile → flow continues.
- /safety → Share Location tile (with contact): reason picker → pick "Just in case" → modal dismisses → widget appears on /home → expand → tap "End sharing" → single tap (no Alert) → widget disappears.
- Re-entry: with an active Unfamiliar session, /safety → Unfamiliar tile → opens to "Sharing in Unfamiliar area" active view, not picker.
- Cross-tile: Unfamiliar session active, /safety → Share Location → Alert "You're in an Unfamiliar area session." Cancel returns to /safety.
- Lifeline: /unfamiliar Step 1, tap pulse footer → LifelineModal → tap Call → dialer opens.
- Roadside retrofit: /safety → Roadside → setup if needed → Step 2 → call → Step 3 shows the same pulse via NotifyingPulse (visually identical to pre-retrofit).

- [ ] **Run the workflow Step 10 + Step 13 audit** before merging.

---

## Self-review

**Spec coverage check:**

| Spec section | Implementing task |
|---|---|
| ShareSession adapter + hook | Task 1 |
| formatDuration helper | Task 1 |
| NotifyingPulse component | Task 2 |
| Roadside Step 3 retrofit | Task 2 |
| LiveSafetySheet (collapsed + expanded) | Task 3 |
| Mount on /home + /en-route | Task 4 |
| LifelineModal | Task 5 |
| /unfamiliar Step 1 (problem picker) | Task 6 |
| /unfamiliar Step 2 (destination picker + POI search + routing) | Task 6 |
| /unfamiliar active re-entry view | Task 6 |
| Lifeline footer wiring (Unfamiliar only) | Task 6 |
| /share-location reason picker | Task 7 |
| /share-location re-entry | Task 7 |
| Layout registration | Tasks 6 + 7 |
| /safety tile wiring + no-contact gate + cross-tile guard | Task 8 |
| Aspirational journey-save copy on Unfamiliar Step 2 | Task 6 (literally in the body) |
| Privacy: widget surfaces session type, not problem | Task 3 (`widgetReason` logic) |
| End-sharing confirm asymmetry (Unfamiliar Alert vs share-location single-tap) | Task 3 (`handleEnd` logic) |
| docs/learnings.md entry | Task 9 |
| Dismissal traps explicitly NOT needed | Confirmed by absence; design rationale in spec |
| UI-state simulation (no SMS, no live tracking) | Implicit in Task 1; mentioned in adapter header |

No gaps.

**Placeholder scan:** every code step shows complete code. No "TBD" / "fill in" / "add error handling" without specifics. Token-substitution notes are concrete fallback instructions, not vagueness.

**Type consistency:** `ShareSession` defined once (Task 1), `ShareSessionType` once (Task 1), `ProblemOption` / `DestinationOption` local to Task 6, `ReasonOption` local to Task 7. `searchPlaces` is the existing API import (verified to be in `lib/api/places.ts` before this plan was written). Component props match call sites across tasks. `useShareSession`'s return shape (`{ session, loading, startSession, endSession }`) is consistent everywhere it's consumed.
