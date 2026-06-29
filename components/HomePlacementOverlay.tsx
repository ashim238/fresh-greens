import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { X } from 'phosphor-react-native/src/icons/X';

import { DragHandle } from './DragHandle';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type HomePlacementOverlayProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

export function HomePlacementOverlay({ onConfirm, onCancel }: HomePlacementOverlayProps) {
  return (
    <SafeAreaView style={styles.placementBar} edges={['bottom']} pointerEvents="box-none">
      <View style={styles.placementDragHandleWrap}>
        <DragHandle />
      </View>
      <View style={styles.placementBarInner}>
        {/*
          Subtle placement hint. Figma v2 (1109:8139) had dropped this
          on the theory the orange pin's visual affordance was
          self-evident — but live testing showed users didn't realize
          the pin moves on map-tap, so it's restored as quiet
          footnote copy (usability over the Figma call). Sits 16pt
          above the action row via placementBarInner's gap.
        */}
        <Text style={styles.placementHint}>Tap the map to move the pin. Drag to move around.</Text>
        <View style={styles.placementActions}>
          <Pressable
            style={({ pressed }) => [styles.placementConfirm, pressed && pressedDim]}
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel="Confirm report location"
          >
            <Text style={styles.placementConfirmText}>Confirm</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.placementCancel, pressed && pressedDim]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel report placement"
          >
            <X size={20} color={colors.labelSecondary} weight="bold" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  placementBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 11,
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    ...shadows.sheet,
  },
  placementDragHandleWrap: {
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  placementBarInner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  placementHint: {
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
    color: colors.labelTertiary,
    textAlign: 'center',
  },
  placementActions: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  placementConfirm: {
    flex: 1,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.e1,
  },
  placementConfirmText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.white,
  } as const,
  placementCancel: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.e1,
  },
});
