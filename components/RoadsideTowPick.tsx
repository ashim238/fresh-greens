import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackButton } from './BackButton';
import { LoadingState } from './StateCard';
import { joinMetaParts } from './MetaSeparator';
import { enrichPlacesWithPhoneProgressive } from '../lib/api/enrich-place-phone';
import {
  TowSearchOfflineError,
  searchTowPlacesNear,
} from '../lib/api/search-tow-places';
import { AppleMapKitUnavailableError } from '../lib/api/sources/apple-mapkit';
import type { Place } from '../lib/api/places';
import { getErrorMessage } from '../lib/error-message';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = {
  locationCoords: { latitude: number; longitude: number } | null;
  onBack: () => void;
  /** Fires after `tel:` opens — parent advances to status with business name. */
  onTowCalled: (businessName: string) => void;
};

function formatDistanceMiles(miles: number): string {
  if (miles < 0.1) return 'Nearby';
  return `${miles.toFixed(1)} mi`;
}

/**
 * /roadside tow-pick sub-step — Mapbox ranks nearby tow POIs; MKLocalSearch
 * enriches each row with an optional phone. Progressive reveal per grill-me.
 */
export function RoadsideTowPick({ locationCoords, onBack, onTowCalled }: Props) {
  const [readyRows, setReadyRows] = useState<Place[]>([]);
  const [fetchingList, setFetchingList] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [noPhoneNoteId, setNoPhoneNoteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!locationCoords) {
        setFetchError('Allow location access so we can find tow trucks near you.');
        setFetchingList(false);
        return;
      }

      setFetchingList(true);
      setFetchError(null);
      setReadyRows([]);

      try {
        const places = await searchTowPlacesNear(locationCoords);
        if (cancelled) return;

        if (!places.length) {
          setFetchError(
            'No tow services found nearby. Try calling your roadside service instead.',
          );
          setFetchingList(false);
          return;
        }

        setFetchingList(false);
        setEnriching(true);

        for await (const enriched of enrichPlacesWithPhoneProgressive(places)) {
          if (cancelled) return;
          setReadyRows((prev) => [...prev, enriched]);
        }
      } catch (err) {
        console.warn('[RoadsideTowPick] load failed', err);
        if (!cancelled) {
          if (err instanceof TowSearchOfflineError) {
            setFetchError(err.message);
          } else if (err instanceof AppleMapKitUnavailableError) {
            setFetchError(err.message);
          } else {
            setFetchError(getErrorMessage('load', 'transient', err).body);
          }
          setFetchingList(false);
          setEnriching(false);
        }
      } finally {
        if (!cancelled) {
          setEnriching(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [locationCoords]);

  async function handleCall(place: Place) {
    if (!place.phone) {
      setNoPhoneNoteId(place.id);
      return;
    }

    const tel = `tel:${place.phone.replace(/[^\d+]/g, '')}`;
    const supported = await Linking.canOpenURL(tel);
    if (!supported) {
      Alert.alert('Cannot place call', 'This device cannot make phone calls.');
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    await Linking.openURL(tel);
    onTowCalled(place.name);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.stepBody}
      showsVerticalScrollIndicator={false}
    >
      <BackButton onPress={onBack} style={styles.backChevron} />

      <View style={styles.titleBlock}>
        <Text style={styles.subtitle}>Nearby help</Text>
        <Text style={styles.title} accessibilityRole="header">
          Find a tow truck nearby
        </Text>
      </View>

      {fetchingList && (
        <LoadingState
          text="Finding tow trucks near you…"
          style={styles.loadingCard}
        />
      )}

      {fetchError && !fetchingList && (
        <Text
          style={styles.errorText}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {fetchError}
        </Text>
      )}

      {!fetchingList && readyRows.length > 0 && (
        <View style={styles.list}>
          {readyRows.map((place) => {
            const callable = !!place.phone;
            return (
              <View key={place.id} style={styles.towRow}>
                <View style={styles.towInfo}>
                  <Text style={styles.towName} numberOfLines={2}>
                    {place.name}
                  </Text>
                  <View style={styles.towMetaRow}>
                    {joinMetaParts(
                      [formatDistanceMiles(place.distanceMiles), place.address],
                      { textStyle: styles.towMeta, numberOfLines: 2 },
                    )}
                  </View>
                  {noPhoneNoteId === place.id && (
                    <Text
                      style={styles.noPhoneNote}
                      accessibilityLiveRegion="polite"
                    >
                      No number on file for this business.
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => void handleCall(place)}
                  style={({ pressed }) => [
                    styles.callBtn,
                    !callable && styles.callBtnMuted,
                    pressed && pressedDim,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${place.name}`}
                  accessibilityHint={
                    callable
                      ? 'Opens the Phone app to dial this tow service'
                      : 'Phone number not available for this business'
                  }
                >
                  <Text
                    style={[
                      styles.callBtnLabel,
                      !callable && styles.callBtnLabelMuted,
                    ]}
                  >
                    Call
                  </Text>
                </Pressable>
              </View>
            );
          })}

          {enriching && (
            <View style={styles.footerSpinner}>
              <ActivityIndicator color={colors.freshgreen} />
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stepBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  backChevron: {
    marginTop: spacing.sm,
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  // Eyebrow + title — titleBlock gap matches /pulled-over and gives the
  // subtitle→title pair more breathing room than marginTop alone.
  titleBlock: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  subtitle: {
    ...dynamicType(relaxedLineHeight(typography.title3Regular)),
    color: colors.labelTertiary,
  },
  title: {
    ...dynamicType(relaxedLineHeight(typography.title1Emphasized)),
    color: colors.black,
  },
  loadingCard: {
    marginTop: spacing.md,
  },
  errorText: {
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
    color: colors.severityCritical, // readable error copy on light surface — .cursorrules #8
    marginTop: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  towRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 72,
  },
  towInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  towName: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  towMeta: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
  towMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  noPhoneNote: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
    marginTop: spacing.xs,
  },
  callBtn: {
    minWidth: 72,
    minHeight: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.freshgreen,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  callBtnMuted: {
    backgroundColor: colors.fillsTertiary,
    borderColor: colors.cardBorderSubtle,
  },
  callBtnLabel: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.white,
  },
  callBtnLabelMuted: {
    color: colors.labelTertiary,
  },
  footerSpinner: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
