import {
  adaptiveCorridorRadius,
  planCorridor,
} from '../../lib/corridor/planner';
import { pathLengthMeters } from '../../lib/geo';
import type { Coordinate } from '../../lib/api/zones';

function straightLongPath(): Coordinate[] {
  return [
    { latitude: 0, longitude: 0 },
    { latitude: 0.7, longitude: 0 },
  ];
}

function denseCurvyLongPath(): Coordinate[] {
  return Array.from({ length: 50 }, (_, index) => ({
    latitude: index * 0.01,
    longitude: index % 2 === 0 ? 0 : 0.01,
  }));
}

describe('adaptive corridor radius', () => {
  test('tightens around dense curvy geometry and stays wider for sparse straight stretches', () => {
    const sparse = straightLongPath();
    const dense = denseCurvyLongPath();
    const sparseRadius = adaptiveCorridorRadius(
      sparse,
      pathLengthMeters(sparse),
      sparse[0],
    );
    const denseRadius = adaptiveCorridorRadius(
      dense,
      pathLengthMeters(dense),
      dense[Math.floor(dense.length / 2)],
    );

    expect(denseRadius).toBeLessThan(sparseRadius);
  });

  test('plans around samples with adaptive per-anchor radii', () => {
    const path = denseCurvyLongPath();
    const plan = planCorridor(path);
    const aroundRadii = plan.wave1
      .filter((request) => request.kind === 'around')
      .map((request) => request.radiusMeters);

    expect(aroundRadii.length).toBeGreaterThan(0);
    expect(new Set(aroundRadii).size).toBeGreaterThan(1);
  });
});
