import type { Coordinate, Zone, ZoneBounds } from '../api/zones';

export type ZoneSourceId = 'osm-overpass';

export type SampleRequest =
  | {
      kind: 'around';
      center: Coordinate;
      radiusMeters: number;
      sources: ZoneSourceId[];
      legId?: string;
    }
  | {
      kind: 'bbox';
      bounds: ZoneBounds;
      sources: ZoneSourceId[];
      legId?: string;
    };

export type FetchBudget = {
  maxMs: number;
  maxCalls: number;
  maxParallel: number;
};

export type CorridorFetchMeta = {
  wave: number;
  requestsDone: number;
  done: boolean;
};

export type CorridorMode = 'preview' | 'navigation';

export type GetZonesForTripOptions = {
  mode?: CorridorMode;
  budget?: FetchBudget;
  onPartial?: (zones: Zone[], meta: CorridorFetchMeta) => void;
  userLocation?: Coordinate | null;
  /** Navigation only — prior rolls + preview coverage. */
  fetchedAlong?: { startM: number; endM: number }[];
  /** Navigation only — zones accumulated before this roll. */
  priorZones?: Zone[];
};

export type CorridorPlan = {
  wave1: SampleRequest[];
  wave2: SampleRequest[];
  pathMeters: number;
};
