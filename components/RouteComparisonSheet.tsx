import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type RouteCondition } from '../lib/scoring';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export type ComparisonRow = {
  id: string;
  durationLabel: string;   // "2h 44m"
  arrivalLabel: string;    // "Arrive 11:45 AM"
  distanceLabel: string;   // "186 mi"
  descriptor: string;      // "Safest route with current conditions" / "8 min faster"
  conditions: RouteCondition[];
  isActive: boolean;
  isRecommended: boolean;
};

const CONDITION_META: Record<RouteCondition, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  'low-light': { label: 'Low light', icon: 'moon' },
  wildlife: { label: 'Wildlife', icon: 'paw' },
  police: { label: 'Police', icon: 'shield' },
  road: { label: 'Road', icon: 'construct' },
};

/**
 * RouteComparisonSheet — compare the recommended route + alternates and
 * switch the active one. Presentational: the parent (/en-route) builds the
 * rows and owns selection. Bottom Modal overlay (same pattern as
 * FuelStopsSheet). Anchored to Figma 2:9033 (structure only).
 */
export function RouteComparisonSheet({
  visible,
  rows,
  onSelectRoute,
  onClose,
}: {
  visible: boolean;
  rows: ComparisonRow[];
  onSelectRoute: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessible={false} accessibilityViewIsModal>
        <Pressable style={styles.card} onPress={() => {}}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.header}>
              <Text style={styles.title}>Routes</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.labelSecondary} />
              </Pressable>
            </View>

            <FlatList
              data={rows}
              keyExtractor={(r) => r.id}
              accessibilityRole="list"
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    item.isActive && styles.rowActive,
                    pressed && pressedDim,
                  ]}
                  onPress={() => onSelectRoute(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.isActive }}
                  accessibilityLabel={`${item.durationLabel}, ${item.descriptor}. ${item.arrivalLabel}, ${item.distanceLabel}.`}
                  accessibilityHint={item.isActive ? 'Current route' : 'Switch to this route'}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.duration}>{item.durationLabel}</Text>
                    {item.isActive && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.freshgreen} />
                    )}
                  </View>
                  <Text style={[styles.descriptor, item.isRecommended && styles.descriptorSafe]}>
                    {item.descriptor}
                  </Text>
                  <Text style={styles.meta}>
                    {item.arrivalLabel} · {item.distanceLabel}
                  </Text>
                  {item.conditions.length > 0 && (
                    <View style={styles.chips}>
                      {item.conditions.map((c) => (
                        <View key={c} style={styles.chip}>
                          <Ionicons name={CONDITION_META[c].icon} size={13} color={colors.labelSecondary} />
                          <Text style={styles.chipText}>{CONDITION_META[c].label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>
              )}
            />
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  title: { ...typography.title3Emphasized, color: colors.black },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.separatorSubtle,
    gap: 4,
  },
  rowActive: {},
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  duration: { ...typography.title2Emphasized, color: colors.black },
  descriptor: { ...typography.subheadlineRegular, color: colors.labelSecondary },
  descriptorSafe: { ...typography.subheadlineEmphasized, color: colors.freshgreen },
  meta: { ...typography.footnoteRegular, color: colors.labelSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipText: { ...typography.caption1Regular, color: colors.labelSecondary },
});
