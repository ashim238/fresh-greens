import { useRef, useState } from 'react';
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
import { ListBullets } from 'phosphor-react-native/src/icons/ListBullets';
import { X } from 'phosphor-react-native/src/icons/X';

import {
  cloudDesaturate,
  DAYLIGHT_DASH_PATTERN,
  DAYLIGHT_LEGEND_ANCHORS,
} from '../lib/daylight';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const entries = {
  day: { label: 'Daylight', pattern: 'Solid' },
  twilight: { label: 'Dusk', pattern: 'Dashed' },
  night: { label: 'After dark', pattern: 'Dotted' },
} as const;

export function DaylightMapKey({
  cloudCoverPct,
  availableHeight,
  onTriggerHeightChange,
  style,
}: {
  cloudCoverPct?: number;
  /** Clear height above the sheet, including the trigger. */
  availableHeight?: number;
  onTriggerHeightChange?: (height: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<View>(null);
  const modalClose = useRef<View>(null);
  const { fontScale } = useWindowDimensions();
  const lineHeight = Math.ceil(typography.footnoteRegular.lineHeight * Math.min(fontScale, 2));
  const headerHeight = Math.max(44, lineHeight + 2 * spacing.xs);
  const fullHeight = headerHeight + 3 * lineHeight + 2 * spacing.sm + spacing.md;
  // A tall sheet, large text or a short viewport can leave room for the
  // button alone. Present the same key in a native modal in that case.
  const inModal = expanded && (
    fontScale > 1.4 || (availableHeight != null && availableHeight < fullHeight)
  );
  const inline = expanded && !inModal;
  const focusTrigger = () => {
    if (trigger.current) AccessibilityInfo.sendAccessibilityEvent(trigger.current, 'focus');
  };
  const close = () => {
    setExpanded(false);
    // On iOS, wait for the native modal to relinquish VoiceOver focus.
    if (!inModal || Platform.OS !== 'ios') requestAnimationFrame(focusTrigger);
  };

  const legend = expanded && (
    <View style={styles.entries}>
      {DAYLIGHT_LEGEND_ANCHORS.map(({ band, color }) => {
        const { label, pattern } = entries[band];
        return (
          <View
            key={band}
            style={styles.entry}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${pattern} line, ${label}`}
            onAccessibilityEscape={close}
          >
            <Svg width={spacing.xl} height={spacing.sm} viewBox="0 0 32 8" accessible={false}>
              {/* A dark edge keeps the pale daylight swatch legible on white. */}
              {band === 'day' && (
                <Line
                  x1="2" x2="30" y1="4" y2="4"
                  stroke={colors.labelSecondary}
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              )}
              <Line
                x1="2" x2="30" y1="4" y2="4"
                stroke={cloudDesaturate(color, cloudCoverPct)}
                strokeWidth={band === 'night' ? 3 : 4}
                strokeDasharray={DAYLIGHT_DASH_PATTERN[band]}
                strokeLinecap={band === 'twilight' ? 'butt' : 'round'}
              />
            </Svg>
            <Text
              maxFontSizeMultiplier={2}
              style={[styles.label, dynamicType(typography.footnoteRegular, 2)]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );

  function renderToggle(showClose: boolean, ref: typeof trigger) {
    return (
      <Pressable
        ref={ref}
        onLayout={(event) => onTriggerHeightChange?.(event.nativeEvent.layout.height)}
        accessibilityRole="button"
        accessibilityLabel={showClose ? 'Close map key' : 'Map key'}
        accessibilityHint={showClose ? undefined : 'Shows the daylight patterns on your route'}
        accessibilityState={{ expanded }}
        onPress={showClose ? close : () => setExpanded(true)}
        onAccessibilityEscape={showClose ? close : undefined}
        style={({ pressed }) => [styles.toggle, pressed && pressedDim]}
      >
        {!showClose && <ListBullets size={spacing.md} color={colors.wiltedgreen} weight="bold" />}
        <Text
          maxFontSizeMultiplier={2}
          style={[styles.title, dynamicType(typography.footnoteEmphasized, 2)]}
        >
          Map key
        </Text>
        {showClose && <X size={spacing.md} color={colors.labelSecondary} weight="bold" />}
      </Pressable>
    );
  }

  return (
    <>
      <View style={[styles.surface, inline && styles.openSurface, style]}>
        {renderToggle(inline, trigger)}
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
            {renderToggle(true, modalClose)}
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
    color: colors.wiltedgreen,
    flexShrink: 1,
  },
  entries: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    color: colors.labelSecondary,
    flexShrink: 1,
  },
});
