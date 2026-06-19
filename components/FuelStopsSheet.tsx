import { useEffect, useMemo, useRef } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { X } from 'phosphor-react-native/src/icons/X';

import { type Place } from '../lib/api/places';
import { fuelPriceLabel } from '../lib/api/fuel-prices';
import { type FuelType } from '../lib/api/fuel';
import { ROUTE_PROXIMITY_MILES } from '../hooks/useRouteFuelStops';
import { getErrorMessage } from '../lib/error-message';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { DragHandle } from './DragHandle';
import { PreferredStar } from './PreferredStar';

function fuelNoun(fuelType: FuelType, count: number): string {
  if (fuelType === 'electric') {
    return count === 1 ? 'charger' : 'chargers';
  }
  return count === 1 ? 'station' : 'stations';
}

function buildSubtitle(
  fuelType: FuelType,
  stopCount: number,
  trustedCount: number,
  carName?: string,
): string {
  const vehicle = carName ? ` for ${carName}` : '';
  if (stopCount === 0) {
    return `Searching ${fuelNoun(fuelType, 2)} within ~${ROUTE_PROXIMITY_MILES} mi of your route${vehicle}…`;
  }
  const trusted =
    trustedCount > 0
      ? ` · ${trustedCount} trusted by you`
      : '';
  return `${stopCount} ${fuelNoun(fuelType, stopCount)} within ~${ROUTE_PROXIMITY_MILES} mi of your route${vehicle}. Nearest to you first${trusted}.`;
}

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
  refuelDue = false,
  carName,
  onSelectStop,
  onClose,
  isPreferred,
  onTogglePreferred,
  highlightStopId,
}: {
  visible: boolean;
  loading: boolean;
  error: boolean;
  stops: Place[];
  fuelType: FuelType;
  /** Refuel reminder cadence has passed — surfaces a briefing banner. */
  refuelDue?: boolean;
  carName?: string;
  onSelectStop: (stop: Place) => void;
  onClose: () => void;
  isPreferred: (stop: Place) => boolean;
  onTogglePreferred: (stop: Place) => void;
  /** Scroll-to and emphasize a row (e.g. from an on-map fuel pin tap). */
  highlightStopId?: string | null;
}) {
  const listRef = useRef<FlatList<Place>>(null);
  const title =
    fuelType === 'electric' ? 'Charging on your route' : 'Gas on your route';

  const trustedCount = useMemo(
    () => stops.filter((s) => isPreferred(s)).length,
    [stops, isPreferred],
  );

  const subtitle = useMemo(() => {
    if (loading) {
      return buildSubtitle(fuelType, 0, 0, carName);
    }
    if (error) {
      return getErrorMessage('load', 'transient').body;
    }
    if (stops.length === 0) {
      return `No ${fuelNoun(fuelType, 2)} found within ~${ROUTE_PROXIMITY_MILES} mi of this route. Try another route or search Gas from Home.`;
    }
    return buildSubtitle(fuelType, stops.length, trustedCount, carName);
  }, [loading, error, stops.length, fuelType, trustedCount, carName]);

  useEffect(() => {
    if (!visible || loading || stops.length === 0) return;
    if (highlightStopId) {
      const index = stops.findIndex((s) => s.id === highlightStopId);
      if (index < 0) return;
      const id = setTimeout(() => {
        listRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.35,
        });
      }, 280);
      return () => clearTimeout(id);
    }
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [visible, loading, stops, highlightStopId]);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessible={false}
        accessibilityViewIsModal
      >
        <Pressable style={styles.card} onPress={() => {}}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.handleWrap}>
              <DragHandle />
            </View>

            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title} accessibilityRole="header">
                  {title}
                </Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close fuel stops"
                style={tapTarget44}
              >
                <X size={24} color={colors.labelSecondary} weight="regular" />
              </Pressable>
            </View>

            {refuelDue && !loading && !error && (
              <View style={styles.dueBanner} accessibilityRole="text">
                <Text style={styles.dueBannerText}>
                  Your refuel reminder is due — pick a stop and tap the star to save ones you trust.
                </Text>
              </View>
            )}

            {loading ? (
              <Text style={styles.message}>Finding stops near your route…</Text>
            ) : error ? null : stops.length === 0 ? (
              <Text style={styles.message}>
                Expand your search from Home using the Gas tile, or adjust your route and try again.
              </Text>
            ) : (
              <FlatList
                ref={listRef}
                data={stops}
                keyExtractor={(s) => s.id}
                accessibilityRole="list"
                style={styles.list}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                  <Text style={styles.listHeader}>
                    Tap a stop to reroute there. Star a stop to trust it on future trips.
                  </Text>
                }
                onScrollToIndexFailed={(info) => {
                  listRef.current?.scrollToOffset({
                    offset: Math.max(0, info.averageItemLength * info.index),
                    animated: true,
                  });
                }}
                renderItem={({ item }) => {
                  const highlighted = item.id === highlightStopId;
                  const pricePart = fuelPriceLabel(item.fuelPrice);
                  const meta = pricePart
                    ? `${pricePart} · ${item.distanceMiles} mi from you · along your route`
                    : `${item.distanceMiles} mi from you · along your route`;
                  return (
                    <View style={styles.rowOuter}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.row,
                          highlighted && styles.rowHighlighted,
                          pressed && pressedDim,
                        ]}
                        onPress={() => onSelectStop(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name}, ${pricePart ? `${pricePart}, ` : ''}${item.distanceMiles} miles from you along your route${isPreferred(item) ? ', trusted by you' : ''}`}
                        accessibilityHint="Reroutes to this stop as your destination"
                      >
                        <View style={styles.rowText}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {isPreferred(item) ? (
                            <View style={styles.trustedBadge}>
                              <Text style={styles.trustedBadgeText}>
                                Trusted by you
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.rowAddress} numberOfLines={2}>
                              {item.address}
                            </Text>
                          )}
                          <Text style={styles.rowMeta}>{meta}</Text>
                        </View>
                        <PreferredStar
                          preferred={isPreferred(item)}
                          onToggle={() => onTogglePreferred(item)}
                        />
                      </Pressable>
                    </View>
                  );
                }}
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
    backgroundColor: colors.modalScrimStrong,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '78%',
    ...shadows.sheet,
  },
  handleWrap: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...dynamicType(typography.title3Emphasized),
    color: colors.black,
  },
  subtitle: {
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
    color: colors.labelSecondary,
  },
  dueBanner: {
    backgroundColor: colors.fadedgreen,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  dueBannerText: {
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
    color: colors.burntgreen,
  },
  message: {
    ...dynamicType(relaxedLineHeight(typography.bodyRegular)),
    color: colors.labelSecondary,
    paddingVertical: spacing.lg,
  },
  list: { marginTop: spacing.xs },
  listContent: { paddingBottom: spacing.sm },
  listHeader: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
    paddingBottom: spacing.sm,
  },
  rowOuter: {
    borderBottomWidth: 1,
    borderBottomColor: colors.separatorSubtle,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  rowHighlighted: {
    backgroundColor: colors.fadedgreen,
  },
  rowText: { flex: 1, gap: 2 },
  rowName: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  rowAddress: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
  rowMeta: {
    ...dynamicType(typography.caption1Regular),
    color: colors.labelTertiary,
    marginTop: 2,
  },
  trustedBadge: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    backgroundColor: colors.fadedgreen,
  },
  trustedBadgeText: {
    ...typography.caption1Emphasized,
    color: colors.burntgreen,
  },
});
