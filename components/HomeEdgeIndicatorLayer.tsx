import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';

import { EdgeIndicator } from './EdgeIndicator';
import { variantForCategoryId } from './LandmarkMarker';
import type { SavedPlace } from '../lib/api/saved-places';
import type { TrustedContact } from '../lib/api/trusted-contact';
import type { Zone } from '../lib/api/zones';
import { regionToRevealCoordinates } from '../lib/clustering';
import {
  edgePositionForPoint,
  groupEdgeIndicators,
  isPointInRegion,
  type Region,
} from '../lib/edge-indicators';

type HomeEdgeIndicatorLayerProps = {
  mapRegion: Region;
  mapSize: { width: number; height: number };
  enabledReportZones: Zone[];
  home: SavedPlace | null;
  trustedContact: TrustedContact | null;
  bottomSheetHeight: number;
  mapRef: React.RefObject<MapView | null>;
};

export function HomeEdgeIndicatorLayer({
  mapRegion,
  mapSize,
  enabledReportZones,
  home,
  trustedContact,
  bottomSheetHeight,
  mapRef,
}: HomeEdgeIndicatorLayerProps) {
  // Chrome-aware insets: edge markers shouldn't land under the
  // search bar / menu button stack (top), the Report/Recenter
  // FAB stack (right), or the bottom sheet.
  //
  // The EdgeIndicator is a 72×72 box centered on its (x, y), so its
  // body reaches 36pt past its center toward each edge. Each inset
  // therefore clears the chrome's reach PLUS that 36pt half.
  const chromeInsets = {
    top: 232,
    right: 112,
    bottom: (bottomSheetHeight || 0) + 64,
    left: 44,
  };

  return (
    <View style={styles.edgeOverlay} pointerEvents="box-none">
      {(() => {
        const offScreen = enabledReportZones
          .filter(
            (z) =>
              z.geometry === 'point' &&
              z.coordinates.length > 0 &&
              !isPointInRegion(z.coordinates[0], mapRegion),
          )
          .map((zone) => ({
            item: zone,
            edge: edgePositionForPoint(zone.coordinates[0], mapRegion, mapSize, chromeInsets),
          }));
        const groups = groupEdgeIndicators(offScreen);
        return groups.map((group, i) => {
          const variant = variantForCategoryId(group.items[0].reportCategoryId);
          const first = group.items[0].coordinates[0];
          return (
            <EdgeIndicator
              key={`edge-group-${i}`}
              x={group.edge.x}
              y={group.edge.y}
              rotation={group.edge.rotation}
              variant={variant}
              categoryId={group.items[0].reportCategoryId}
              subTag={group.items[0].reportSubTag}
              count={group.items.length}
              accessibilityLabel={
                group.items.length === 1
                  ? `${group.items[0].label} (off-screen — tap to center)`
                  : `${group.items.length} reports nearby (off-screen — tap to zoom)`
              }
              onPress={() => {
                if (group.items.length === 1) {
                  mapRef.current?.animateToRegion(
                    {
                      latitude: first.latitude,
                      longitude: first.longitude,
                      latitudeDelta: mapRegion.latitudeDelta,
                      longitudeDelta: mapRegion.longitudeDelta,
                    },
                    400,
                  );
                } else {
                  const coords = group.items.map((z) => z.coordinates[0]);
                  mapRef.current?.animateToRegion(
                    regionToRevealCoordinates(coords, mapSize.width, mapSize.height),
                    400,
                  );
                }
              }}
            />
          );
        });
      })()}

      {home && !isPointInRegion(home, mapRegion) &&
        (() => {
          const edge = edgePositionForPoint(home, mapRegion, mapSize, chromeInsets);
          return (
            <EdgeIndicator
              x={edge.x}
              y={edge.y}
              rotation={edge.rotation}
              variant="positive"
              categoryId="home"
              accessibilityLabel={`${home.name} (off-screen — tap to center)`}
              onPress={() =>
                mapRef.current?.animateToRegion(
                  {
                    latitude: home.latitude,
                    longitude: home.longitude,
                    latitudeDelta: mapRegion.latitudeDelta,
                    longitudeDelta: mapRegion.longitudeDelta,
                  },
                  400,
                )
              }
            />
          );
        })()}

      {trustedContact?.latitude != null &&
        trustedContact.longitude != null &&
        !isPointInRegion(
          { latitude: trustedContact.latitude, longitude: trustedContact.longitude },
          mapRegion,
        ) &&
        (() => {
          const point = {
            latitude: trustedContact.latitude!,
            longitude: trustedContact.longitude!,
          };
          const edge = edgePositionForPoint(point, mapRegion, mapSize, chromeInsets);
          return (
            <EdgeIndicator
              x={edge.x}
              y={edge.y}
              rotation={edge.rotation}
              variant="positive"
              categoryId="trusted-friend"
              accessibilityLabel={`${trustedContact.name} (off-screen — tap to center)`}
              onPress={() =>
                mapRef.current?.animateToRegion(
                  {
                    ...point,
                    latitudeDelta: mapRegion.latitudeDelta,
                    longitudeDelta: mapRegion.longitudeDelta,
                  },
                  400,
                )
              }
            />
          );
        })()}
    </View>
  );
}

const styles = StyleSheet.create({
  edgeOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
});
