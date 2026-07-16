import { act, renderHook, waitFor } from '@testing-library/react-native';

import { deferred, resetTestHarness } from './test-harness';
import { useHydratedResource } from '../../hooks/useHydratedResource';
import { useHydratedState } from '../../hooks/useHydratedState';
import { useMutation } from '../../hooks/useMutation';
import { accountOperationGate } from '../../lib/account-session/operation-gate';

let mockGeneration = 1;

jest.mock('../../lib/account-session/session-context', () => ({
  useSessionGeneration: () => mockGeneration,
}));

describe('generation-aware shared hooks', () => {
  beforeEach(() => {
    resetTestHarness();
    mockGeneration = 1;
  });

  afterEach(resetTestHarness);

  test('useHydratedState ignores a read from the previous account', async () => {
    const oldRead = deferred<string>();
    const newRead = deferred<string>();
    const read = jest
      .fn<Promise<string>, []>()
      .mockReturnValueOnce(oldRead.promise)
      .mockReturnValueOnce(newRead.promise);
    const view = await renderHook(() =>
      useHydratedState(read, { mountOnly: true }),
    );

    mockGeneration = 2;
    await view.rerender(undefined);
    await act(async () => {
      oldRead.resolve('old account');
      await oldRead.promise;
    });
    expect(view.result.current.ready).toBe(false);

    await act(async () => {
      newRead.resolve('new account');
      await newRead.promise;
    });
    await waitFor(() => expect(view.result.current.ready).toBe(true));
    expect(
      view.result.current.ready ? view.result.current.data : null,
    ).toBe('new account');
  });

  test('useHydratedResource ignores an old error after generation changes', async () => {
    const oldRead = deferred<string>();
    const newRead = deferred<string>();
    const read = jest
      .fn<Promise<string>, []>()
      .mockReturnValueOnce(oldRead.promise)
      .mockReturnValueOnce(newRead.promise);
    const view = await renderHook(() =>
      useHydratedResource(read, { mountOnly: true }),
    );

    mockGeneration = 2;
    await view.rerender(undefined);
    await act(async () => {
      oldRead.reject(new Error('old account read failed'));
      await oldRead.promise.catch(() => undefined);
    });
    expect(view.result.current.ready).toBe(false);

    await act(async () => {
      newRead.resolve('new account');
      await newRead.promise;
    });
    await waitFor(() =>
      expect(
        view.result.current.ready &&
          view.result.current.ok &&
          view.result.current.data,
      ).toBe('new account'),
    );
  });

  test('useMutation returns a closed-operation result when account changes', async () => {
    const persisted = deferred<string>();
    const persist = jest.fn(() => persisted.promise);
    const view = await renderHook(() => useMutation(persist));

    let resultPromise!: ReturnType<typeof view.result.current.run>;
    await act(async () => {
      resultPromise = view.result.current.run(undefined);
      await Promise.resolve();
    });
    expect(view.result.current.status).toBe('pending');

    mockGeneration = 2;
    await view.rerender(undefined);
    await act(async () => {
      persisted.resolve('old write');
      await persisted.promise;
    });

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      error: {
        name: 'AccountOperationClosedError',
        code: 'ACCOUNT_OPERATION_CLOSED',
      },
    });
    expect(view.result.current.status).toBe('idle');
  });

  test('useMutation remains tracked until persistence settles', async () => {
    const persisted = deferred<string>();
    const view = await renderHook(() => useMutation(() => persisted.promise));

    let resultPromise!: ReturnType<typeof view.result.current.run>;
    await act(async () => {
      resultPromise = view.result.current.run(undefined);
      await Promise.resolve();
    });
    accountOperationGate.seal(0);
    const draining = accountOperationGate.drain(0, 100);
    let drained = false;
    void draining.then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);

    await act(async () => {
      persisted.resolve('saved');
      await expect(resultPromise).resolves.toMatchObject({
        ok: false,
        error: { code: 'ACCOUNT_OPERATION_CLOSED' },
      });
    });
    await expect(draining).resolves.toEqual({ kind: 'drained' });
  });
});
