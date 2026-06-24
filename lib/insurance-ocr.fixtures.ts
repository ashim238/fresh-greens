/**
 * Fixture-backed assertions for insurance card OCR heuristics.
 * Run manually: `npx tsx lib/insurance-ocr.fixtures.ts`
 * (No Jest in this repo yet; keeps pure-fn coverage lightweight.)
 */

import { parseInsuranceFromOcr } from './insurance-ocr';

type Fixture = {
  name: string;
  lines: string[];
  expect: { carrierName?: string; policyNumber?: string };
};

const FIXTURES: Fixture[] = [
  {
    name: 'labeled policy',
    lines: ['STATE FARM', 'Policy # ABC-123456789', 'Effective 01/01/2026'],
    expect: { carrierName: 'STATE FARM', policyNumber: 'ABC-123456789' },
  },
  {
    name: 'member id label',
    lines: ['GEICO', 'Member ID: 1234567890'],
    expect: { carrierName: 'GEICO', policyNumber: '1234567890' },
  },
  {
    name: 'noisy fallback',
    lines: ['USAA', 'INSURED', '987654321012'],
    expect: { carrierName: 'USAA' },
  },
];

function runFixtures(): void {
  let failed = 0;
  for (const fixture of FIXTURES) {
    const result = parseInsuranceFromOcr(fixture.lines);
    for (const key of ['carrierName', 'policyNumber'] as const) {
      const expected = fixture.expect[key];
      if (expected === undefined) continue;
      if (result[key] !== expected) {
        failed += 1;
        console.error(
          `[FAIL] ${fixture.name}.${key}: expected ${expected}, got ${result[key]}`,
        );
      }
    }
  }
  if (failed > 0) {
    process.exitCode = 1;
    console.error(`${failed} assertion(s) failed`);
  } else {
    console.log(`All ${FIXTURES.length} insurance OCR fixtures passed.`);
  }
}

runFixtures();
