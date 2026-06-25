import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ComponentType } from 'react';

import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
import { Flag } from 'phosphor-react-native/src/icons/Flag';
import { Moon } from 'phosphor-react-native/src/icons/Moon';
import { PawPrint } from 'phosphor-react-native/src/icons/PawPrint';
import { ShieldStar } from 'phosphor-react-native/src/icons/ShieldStar';
import { Wrench } from 'phosphor-react-native/src/icons/Wrench';
import { X } from 'phosphor-react-native/src/icons/X';

import { MetaSeparator } from './MetaSeparator';
import { type RouteCondition } from '../lib/scoring';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { radii } from '../theme/radii';
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

type PhosphorIcon = ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' | 'duotone' | 'thin' | 'light' }>;

const CONDITION_META: Record<RouteCondition, { label: string; Icon: PhosphorIcon }> = {
  community: { label: 'Community flag', Icon: Flag },
  'low-light': { label: 'Low light', Icon: Moon },
  wildlife: { label: 'Wildlife', Icon: PawPrint },
  police: { label: 'Police', Icon: ShieldStar },
  road: { label: 'Road', Icon: Wrench },
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
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [tapTarget44, pressed && pressedDim]}
              >
                <X size={24} color={colors.labelSecondary} weight="regular" />
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
                      <CheckCircle size={20} color={colors.freshgreen} weight="fill" />
                    )}
                  </View>
                  <Text style={[styles.descriptor, item.isRecommended && styles.descriptorSafe]}>
                    {item.descriptor}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>{item.arrivalLabel}</Text>
                    <MetaSeparator style={styles.metaSeparator} />
                    <Text style={styles.meta}>{item.distanceLabel}</Text>
                  </View>
                  {item.conditions.length > 0 && (
                    <View style={styles.chips}>
                      {item.conditions.map((c) => {
                        const { Icon, label } = CONDITION_META[c];
                        return (
                          <View key={c} style={styles.chip}>
                            <Icon size={13} color={colors.labelSecondary} weight="regular" />
                            <Text style={styles.chipText}>{label}</Text>
                          </View>
                        );
                      })}
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
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
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
  title: { ...dynamicType(typography.title3Emphasized), color: colors.black },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.separatorSubtle,
    gap: spacing.xs,
  },
  rowActive: {},
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  duration: { ...dynamicType(typography.title2Emphasized), color: colors.black },
  descriptor: { ...dynamicType(typography.subheadlineRegular), color: colors.labelSecondary },
  descriptorSafe: { ...dynamicType(typography.subheadlineEmphasized), color: colors.freshgreen },
  meta: { ...dynamicType(typography.footnoteRegular), color: colors.labelSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaSeparator: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chipText: { ...dynamicType(typography.caption1Regular), color: colors.labelSecondary },
});
