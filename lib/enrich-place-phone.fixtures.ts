/**
 * Fixture-backed assertions for Mapbox→MapKit phone matching heuristics.
 * Run: `npx tsx lib/enrich-place-phone.fixtures.ts`
 *
 * Live MK search is UNVERIFIED-IN-RUNTIME — needs iOS dev build.
 */

import { matchMapKitPhoneForPlace } from './api/match-mapkit-phone';
import type { MapKitSearchResult } from './api/sources/apple-mapkit';

type Fixture = {
  name: string;
  place: { name: string; latitude: number; longitude: number };
  candidates: MapKitSearchResult[];
  expectPhone?: string;
};

const BASE = { latitude: 40.6782, longitude: -73.9442 };

const FIXTURES: Fixture[] = [
  {
    name: 'exact name + nearby coords',
    place: { name: "Joe's Towing", ...BASE },
    candidates: [
      {
        name: "Joe's Towing & Recovery",
        latitude: BASE.latitude + 0.0001,
        longitude: BASE.longitude,
        phoneNumber: '+1 (718) 555-0100',
      },
    ],
    expectPhone: '+1 (718) 555-0100',
  },
  {
    name: 'rejects far candidate',
    place: { name: 'City Tow', ...BASE },
    candidates: [
      {
        name: 'City Tow',
        latitude: BASE.latitude + 0.05,
        longitude: BASE.longitude,
        phoneNumber: '+1 (718) 555-0199',
      },
    ],
    expectPhone: undefined,
  },
  {
    name: 'picks closest of two matches',
    place: { name: 'AAA Roadside', ...BASE },
    candidates: [
      {
        name: 'AAA Roadside Assistance',
        latitude: BASE.latitude + 0.0003,
        longitude: BASE.longitude,
        phoneNumber: '+1 (800) 555-0002',
      },
      {
        name: 'AAA Roadside Assistance',
        latitude: BASE.latitude + 0.0001,
        longitude: BASE.longitude,
        phoneNumber: '+1 (800) 555-0001',
      },
    ],
    expectPhone: '+1 (800) 555-0001',
  },
];

function runFixtures(): void {
  let failed = 0;
  for (const fixture of FIXTURES) {
    const phone = matchMapKitPhoneForPlace(fixture.place, fixture.candidates);
    if (phone !== fixture.expectPhone) {
      failed += 1;
      console.error(
        `FAIL ${fixture.name}: expected ${fixture.expectPhone ?? 'undefined'}, got ${phone ?? 'undefined'}`,
      );
    } else {
      console.log(`ok ${fixture.name}`);
    }
  }
  if (failed > 0) {
    process.exit(1);
  }
  console.log(`\n${FIXTURES.length} fixtures passed.`);
}

runFixtures();
