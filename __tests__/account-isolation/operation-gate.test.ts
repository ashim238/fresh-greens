import {
  AccountOperationClosedError,
  AccountOperationGate,
  LEGACY_ACCOUNT_GENERATION,
  accountOperationGate,
} from '../../lib/account-session/operation-gate';
import {
  assertHarnessIdle,
  deferred,
  resetTestHarness,
} from './test-harness';

describe('AccountOperationGate', () => {
  beforeEach(() => {
    resetTestHarness();
  });

  afterEach(() => {
    assertHarnessIdle();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('the singleton starts open at legacy generation zero', async () => {
    expect(LEGACY_ACCOUNT_GENERATION).toBe(0);
    expect(accountOperationGate.currentGeneration()).toBe(0);

    await expect(
      accountOperationGate.runCurrent(async (signal) => {
        expect(signal.aborted).toBe(false);
        return 'legacy result';
      }),
    ).resolves.toBe('legacy result');
  });

  test('tracks an operation before invoking it so a synchronous seal aborts it', async () => {
    const gate = new AccountOperationGate();
    const work = deferred<void>();
    let signalDuringInvocation: AbortSignal | undefined;

    const operation = gate.runCurrent(async (signal) => {
      gate.seal(LEGACY_ACCOUNT_GENERATION);
      signalDuringInvocation = signal;
      await work.promise;
    });

    expect(signalDuringInvocation?.aborted).toBe(true);

    const draining = gate.drain(LEGACY_ACCOUNT_GENERATION, 100);
    work.resolve();

    await expect(operation).resolves.toBeUndefined();
    await expect(draining).resolves.toEqual({ kind: 'drained' });
  });

  test('seals synchronously, aborts cancellable work, and rejects new work', async () => {
    const gate = new AccountOperationGate();
    const abortObserved = deferred<void>();
    let abortCount = 0;

    const operation = gate.runCurrent(
      (signal) =>
        new Promise<void>((resolve) => {
          signal.addEventListener(
            'abort',
            () => {
              abortCount += 1;
              abortObserved.resolve();
              resolve();
            },
            { once: true },
          );
        }),
    );

    gate.seal(LEGACY_ACCOUNT_GENERATION);

    expect(abortCount).toBe(1);
    await expect(
      gate.runCurrent(async () => 'too late'),
    ).rejects.toMatchObject({
      name: 'AccountOperationClosedError',
      code: 'ACCOUNT_OPERATION_CLOSED',
    });

    await abortObserved.promise;
    await operation;
    await expect(gate.drain(LEGACY_ACCOUNT_GENERATION, 100)).resolves.toEqual({
      kind: 'drained',
    });
  });

  test('repeated same-generation seals are idempotent', async () => {
    const gate = new AccountOperationGate();
    const work = deferred<void>();
    let abortCount = 0;

    const operation = gate.runCurrent(async (signal) => {
      signal.addEventListener('abort', () => {
        abortCount += 1;
      });
      await work.promise;
    });

    gate.seal(0);
    gate.seal(0);

    expect(abortCount).toBe(1);

    const draining = gate.drain(0, 100);
    work.resolve();
    await operation;
    await expect(draining).resolves.toEqual({ kind: 'drained' });
  });

  test('keeps noncancellable work pending until its promise settles', async () => {
    const gate = new AccountOperationGate();
    const work = deferred<string>();
    const operation = gate.runCurrent(() => work.promise);

    gate.seal(0);
    const draining = gate.drain(0, 100);

    let drainSettled = false;
    void draining.then(() => {
      drainSettled = true;
    });
    await Promise.resolve();
    expect(drainSettled).toBe(false);

    work.resolve('finished');

    await expect(operation).resolves.toBe('finished');
    await expect(draining).resolves.toEqual({ kind: 'drained' });
  });

  test('times out at the exact bound with the current pending count', async () => {
    const gate = new AccountOperationGate();
    const first = deferred<void>();
    const second = deferred<void>();
    const firstOperation = gate.runCurrent(() => first.promise);
    const secondOperation = gate.runCurrent(() => second.promise);

    gate.seal(0);
    const draining = gate.drain(0, 50);
    let result: unknown;
    void draining.then((value) => {
      result = value;
    });

    await jest.advanceTimersByTimeAsync(49);
    expect(result).toBeUndefined();

    first.resolve();
    await firstOperation;
    await jest.advanceTimersByTimeAsync(1);

    await expect(draining).resolves.toEqual({
      kind: 'timed-out',
      pendingCount: 1,
    });

    second.resolve();
    await secondOperation;
  });

  test('clears each bounded-drain timer when work settles', async () => {
    const gate = new AccountOperationGate();
    const work = deferred<void>();
    const operation = gate.runCurrent(() => work.promise);

    gate.seal(0);
    const shortDrain = gate.drain(0, 100);
    const longDrain = gate.drain(0, 1_000);
    expect(jest.getTimerCount()).toBe(2);

    work.resolve();
    await operation;

    await expect(shortDrain).resolves.toEqual({ kind: 'drained' });
    await expect(longDrain).resolves.toEqual({ kind: 'drained' });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('repeated drains observe the current pending set without dropping work', async () => {
    const gate = new AccountOperationGate();
    const work = deferred<void>();
    const operation = gate.runCurrent(() => work.promise);

    gate.seal(0);
    const firstDrain = gate.drain(0, 10);
    await jest.advanceTimersByTimeAsync(10);
    await expect(firstDrain).resolves.toEqual({
      kind: 'timed-out',
      pendingCount: 1,
    });

    const retry = gate.drain(0, 100);
    work.resolve();
    await operation;

    await expect(retry).resolves.toEqual({ kind: 'drained' });
    await expect(gate.drain(0, 100)).resolves.toEqual({ kind: 'drained' });
  });

  test('rejects stale, future, and unsealed generations', async () => {
    const gate = new AccountOperationGate(1);

    expect(() => gate.seal(0)).toThrow(AccountOperationClosedError);
    expect(() => gate.seal(2)).toThrow(AccountOperationClosedError);
    await expect(gate.drain(0, 100)).rejects.toBeInstanceOf(
      AccountOperationClosedError,
    );
    await expect(gate.drain(2, 100)).rejects.toBeInstanceOf(
      AccountOperationClosedError,
    );
    await expect(gate.drain(1, 100)).rejects.toBeInstanceOf(
      AccountOperationClosedError,
    );
  });

  test('opens the next generation only after an explicit seal and drain', async () => {
    const gate = new AccountOperationGate();

    expect(() => gate.open(1)).toThrow(AccountOperationClosedError);

    gate.seal(0);
    expect(() => gate.open(1)).toThrow(AccountOperationClosedError);

    await expect(gate.drain(0, 100)).resolves.toEqual({ kind: 'drained' });

    expect(() => gate.open(0)).toThrow(AccountOperationClosedError);
    expect(() => gate.open(2)).toThrow(AccountOperationClosedError);

    gate.open(1);

    expect(gate.currentGeneration()).toBe(1);
    await expect(gate.runCurrent(async () => 'generation one')).resolves.toBe(
      'generation one',
    );
  });

  test('advances an idle open gate when a new account becomes active', async () => {
    const gate = new AccountOperationGate();

    gate.advanceOpenGeneration(1);

    expect(gate.currentGeneration()).toBe(1);
    expect(() => gate.advanceOpenGeneration(1)).toThrow(
      AccountOperationClosedError,
    );
    expect(() => gate.advanceOpenGeneration(3)).toThrow(
      AccountOperationClosedError,
    );

    const work = deferred<void>();
    const operation = gate.runCurrent(() => work.promise);
    expect(() => gate.advanceOpenGeneration(2)).toThrow(
      AccountOperationClosedError,
    );
    work.resolve();
    await operation;
  });
});
