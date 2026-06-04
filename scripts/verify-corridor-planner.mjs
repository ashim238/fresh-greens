import { register } from 'node:module';

/** Extensionless relative imports (planner → geo) need `.ts` under Node strip-types. */
const resolveHook = `
export async function resolve(specifier, context, nextResolve) {
  const isRelative =
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier.startsWith('/');
  if (!isRelative) return nextResolve(specifier, context);
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      err?.code === 'ERR_MODULE_NOT_FOUND' &&
      !/\\.(ts|js|mjs|cjs|json|node)$/.test(specifier)
    ) {
      return nextResolve(specifier + '.ts', context);
    }
    throw err;
  }
}
`;
await register(
  `data:text/javascript,${encodeURIComponent(resolveHook)}`,
  { parentURL: import.meta.url },
);

const { planCorridor, classifyLegs } = await import('../lib/corridor/planner.ts');
const { pathLengthMeters } = await import('../lib/geo.ts');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const shortPath = [
  { latitude: 40.75, longitude: -73.99 },
  { latitude: 40.76, longitude: -73.98 },
];
const shortPlan = planCorridor(shortPath);
assert(shortPlan.wave1.length === 1, 'short trip: one wave1 request');
assert(shortPlan.wave1[0].kind === 'bbox', 'short trip: bbox');

const interstate = [];
for (let lng = -90; lng <= -85; lng += 0.2) {
  interstate.push({ latitude: 33.5, longitude: lng });
}
assert(pathLengthMeters(interstate) > 45_000, 'interstate fixture length');
const legs = classifyLegs(interstate);
assert(legs.some((l) => l.kind === 'straight'), 'interstate has straight leg');
const longPlan = planCorridor(interstate);
assert(
  longPlan.wave1.some((r) => r.kind === 'bbox'),
  'long trip: wave1 includes bbox',
);

console.log('corridor planner: OK');
