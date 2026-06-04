import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { X } from 'phosphor-react-native/src/icons/X';

import { type Place } from '../lib/api/places';
import { type FuelType } from '../lib/api/fuel';
import { colors } from '../theme/colors';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { PreferredStar } from './PreferredStar';

/**
 * FuelStopsSheet — gas/charging stations along the active route. Presented
 * as a bottom overlay sheet over /en-route (Modal so it sits above the map
 * + the en-route bottom sheet). Purely presentational: the parent owns the
 * data (useRouteFuelStops) and the select/close handlers.
 */
export function FuelStopsSheet({
  visible,
  loading,
  error,
  stops,
  fuelType,
  onSelectStop,
  onClose,
  isPreferred,
  onTogglePreferred,
}: {
  visible: boolean;
  loading: boolean;
  error: boolean;
  stops: Place[];
  fuelType: FuelType;
  onSelectStop: (stop: Place) => void;
  onClose: () => void;
  isPreferred: (stop: Place) => boolean;
  onTogglePreferred: (stop: Place) => void;
}) {
  const title = fuelType === 'electric' ? 'Charging on your route' : 'Gas on your route';

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessible={false}
        accessibilityViewIsModal
      >
        {/* Inner Pressable swallows taps so tapping the card doesn't close it. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                // 44pt painted floor (audit #10) — naked Pressable +
                // hitSlop is the carve-out violation .cursorrules forbids
                // (hitSlop is forgiveness padding on top of compliance,
                // not the compliance mechanism itself).
                style={tapTarget44}
              >
                <X size={24} color={colors.labelSecondary} weight="regular" />
              </Pressable>
            </View>

            {loading ? (
              <Text style={styles.message}>Finding stops near your route…</Text>
            ) : error ? (
              <Text style={styles.message}>Couldn't load stops. Check your connection and try again.</Text>
            ) : stops.length === 0 ? (
              <Text style={styles.message}>No stops found along your route.</Text>
            ) : (
              <FlatList
                data={stops}
                keyExtractor={(s) => s.id}
                accessibilityRole="list"
                style={styles.list}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [styles.row, pressed && pressedDim]}
                    onPress={() => onSelectStop(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${item.distanceMiles} miles away${isPreferred(item) ? ', trusted by you' : ''}`}
                    accessibilityHint="Shows this stop on the map"
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                      {isPreferred(item) ? (
                        <View style={styles.trustedBadge}>
                          <Text style={styles.trustedBadgeText}>Trusted by you</Text>
                        </View>
                      ) : (
                        <Text style={styles.rowAddress} numberOfLines={1}>{item.address}</Text>
                      )}
                    </View>
                    <Text style={styles.rowDistance}>{item.distanceMiles} mi</Text>
                    <PreferredStar
                      preferred={isPreferred(item)}
                      onToggle={() => onTogglePreferred(item)}
                    />
                  </Pressable>
                )}
              />
            )}
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
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
  // (closeBtn replaced by the shared `tapTarget44` token in audit #10
  //  review — applied directly at the close Pressable.)
  title: { ...typography.title3Emphasized, color: colors.black },
  message: { ...typography.bodyRegular, color: colors.labelSecondary, paddingVertical: spacing.lg },
  list: { marginTop: spacing.xs },
  listContent: { paddingBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.separatorSubtle,
  },
  rowText: { flex: 1, gap: 2 },
  rowName: { ...typography.bodyEmphasized, color: colors.black },
  rowAddress: { ...typography.footnoteRegular, color: colors.labelSecondary },
  rowDistance: { ...typography.subheadlineRegular, color: colors.labelSecondary },
  trustedBadge: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    backgroundColor: colors.fadedgreen,
  },
  trustedBadgeText: { ...typography.caption1Emphasized, color: colors.burntgreen },
});
