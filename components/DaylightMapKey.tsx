import { useEffect, useRef, useState, type Ref } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { MapTrifold } from 'phosphor-react-native/src/icons/MapTrifold';
import { X } from 'phosphor-react-native/src/icons/X';

import {
  cloudDesaturate,
  DAYLIGHT_DASH_PATTERN,
  PATTERNED_ROUTE_WIDTH,
  DAYLIGHT_LEGEND_ANCHORS,
} from '../lib/daylight';
import { colors } from '../theme/colors';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const entries = {
  day: { label: 'Daylight', pattern: 'Solid' },
  twilight: { label: 'Dusk', pattern: 'Dashed' },
  night: { label: 'After dark', pattern: 'Dotted' },
} as const;

type KeyContentProps = {
  cloudCoverPct?: number;
  compact?: boolean;
  firstEntryRef?: Ref<View>;
  onClose: () => void;
};

function MapKeyEntries({ cloudCoverPct, compact, firstEntryRef, onClose }: KeyContentProps) {
  return (
    <View style={compact ? styles.previewEntries : styles.drivingEntries}>
      {DAYLIGHT_LEGEND_ANCHORS.map(({ band, color }) => {
        const { label, pattern } = entries[band];
        return (
          <View
            key={band}
            ref={band === 'day' ? firstEntryRef : undefined}
            style={compact ? styles.previewEntry : styles.drivingEntry}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${pattern} line, ${label}`}
            onAccessibilityEscape={onClose}
          >
            <Svg width={spacing.xl} height={spacing.sm} viewBox="0 0 32 8" accessible={false}>
              <Line
                x1="2" x2="30" y1="4" y2="4"
                stroke={cloudDesaturate(color, cloudCoverPct)}
                strokeWidth={band === 'day' ? 4 : PATTERNED_ROUTE_WIDTH[band]}
                strokeDasharray={DAYLIGHT_DASH_PATTERN[band]}
                strokeLinecap={band === 'twilight' ? 'butt' : 'round'}
              />
            </Svg>
            <Text maxFontSizeMultiplier={2} style={styles.label}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

type ToggleProps = {
  ref?: Ref<View>;
  expanded: boolean;
  compact?: boolean;
  onPress: () => void;
};

function MapKeyToggle({ ref, expanded, compact, onPress }: ToggleProps) {
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Close map key' : 'Map key'}
      accessibilityHint={expanded ? undefined : 'Shows the daylight patterns on your route'}
      accessibilityState={{ expanded }}
      onPress={onPress}
      onAccessibilityEscape={expanded ? onPress : undefined}
      style={({ pressed }) => [compact ? tapTarget44 : styles.toggle, pressed && pressedDim]}
    >
      {!expanded && <MapTrifold size={spacing.md} color={colors.wiltedgreen} weight="bold" />}
      {!compact && (
        <Text maxFontSizeMultiplier={2} style={styles.title}>
          Map key
        </Text>
      )}
      {expanded && <X size={spacing.md} color={colors.labelSecondary} weight="bold" />}
    </Pressable>
  );
}

/** Planning shows each pattern immediately. Reserve its actual height above the sheet as labels wrap. */
export function PreviewDaylightMapKey({
  cloudCoverPct,
  expanded,
  onExpandedChange,
  onHeightChange,
  style,
}: {
  cloudCoverPct?: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onHeightChange: (height: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const trigger = useRef<View>(null);
  const firstEntry = useRef<View>(null);
  const focusOnOpen = useRef(false);
  useEffect(() => {
    if (!expanded || !focusOnOpen.current) return;
    const frame = requestAnimationFrame(() => {
      if (firstEntry.current) AccessibilityInfo.sendAccessibilityEvent(firstEntry.current, 'focus');
      focusOnOpen.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [expanded]);
  const open = () => {
    focusOnOpen.current = true;
    onExpandedChange(true);
  };
  const close = () => {
    focusOnOpen.current = false;
    onExpandedChange(false);
    requestAnimationFrame(() => {
      if (trigger.current) AccessibilityInfo.sendAccessibilityEvent(trigger.current, 'focus');
    });
  };

  return (
    <View
      style={[styles.surface, expanded && styles.previewPanel, style]}
      onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}
    >
      {expanded && (
        <MapKeyEntries compact firstEntryRef={firstEntry} cloudCoverPct={cloudCoverPct} onClose={close} />
      )}
      <MapKeyToggle
        ref={trigger}
        compact={expanded}
        expanded={expanded}
        onPress={expanded ? close : open}
      />
    </View>
  );
}

/** Driving puts the key away until requested; use a native modal if it will not fit above the sheet. */
export function DaylightMapKey({
  cloudCoverPct,
  availableHeight,
}: {
  cloudCoverPct?: number;
  availableHeight: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<View>(null);
  const modalClose = useRef<View>(null);
  const { fontScale } = useWindowDimensions();
  const lineHeight = Math.ceil(typography.footnoteRegular.lineHeight * Math.min(fontScale, 2));
  const headerHeight = Math.max(44, lineHeight + 2 * spacing.xs);
  const fullHeight = headerHeight + 3 * lineHeight + 2 * spacing.sm + spacing.md;
  const inModal = expanded && (fontScale > 1.4 || availableHeight < fullHeight);
  const inline = expanded && !inModal;
  const focusTrigger = () => {
    if (trigger.current) AccessibilityInfo.sendAccessibilityEvent(trigger.current, 'focus');
  };
  const close = () => {
    setExpanded(false);
    // On iOS, wait for the native modal to relinquish VoiceOver focus.
    if (!inModal || Platform.OS !== 'ios') requestAnimationFrame(focusTrigger);
  };
  const legend = <MapKeyEntries cloudCoverPct={cloudCoverPct} onClose={close} />;

  return (
    <>
      <View style={[styles.surface, inline && styles.openSurface]}>
        <MapKeyToggle
          ref={trigger}
          expanded={inline}
          onPress={inline ? close : () => setExpanded(true)}
        />
        {inline && legend}
      </View>
      <Modal
        visible={inModal}
        transparent
        onRequestClose={close}
        onDismiss={focusTrigger}
        onShow={() => {
          if (modalClose.current) AccessibilityInfo.sendAccessibilityEvent(modalClose.current, 'focus');
        }}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={close} />
          <View
            style={[styles.surface, styles.openSurface, styles.modalPanel]}
            accessibilityViewIsModal
            onAccessibilityEscape={close}
          >
            <MapKeyToggle ref={modalClose} expanded onPress={close} />
            {legend}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  surface: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    ...shadows.e2,
  },
  openSurface: {
    borderRadius: radii.lg,
  },
  previewPanel: {
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewEntries: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 1,
    columnGap: spacing.md,
    rowGap: spacing.sm,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
  },
  previewEntry: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.modalScrim,
  },
  modalPanel: {
    alignSelf: 'center',
  },
  toggle: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  title: {
    // Native Text scales both the glyphs and the explicit line height.
    ...typography.footnoteEmphasized,
    color: colors.wiltedgreen,
    flexShrink: 1,
  },
  drivingEntries: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  drivingEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.footnoteRegular,
    color: colors.labelSecondary,
    flexShrink: 1,
  },
});
