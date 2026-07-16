import { createRequestGeneration } from '../../lib/request-generation';

describe('request generation guard', () => {
  test('beginning a newer request makes older request results stale', () => {
    const generation = createRequestGeneration();

    const first = generation.begin();
    const second = generation.begin();

    expect(generation.isCurrent(first)).toBe(false);
    expect(generation.isCurrent(second)).toBe(true);
  });

  test('invalidating without a new request drops in-flight work after clears or edits', () => {
    const generation = createRequestGeneration();

    const pending = generation.begin();
    generation.invalidate();

    expect(generation.isCurrent(pending)).toBe(false);
  });
});
