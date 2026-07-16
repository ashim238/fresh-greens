export const LEGACY_ACCOUNT_GENERATION = 0;

export type DrainResult =
  | { kind: 'drained' }
  | { kind: 'timed-out'; pendingCount: number };

export class AccountOperationClosedError extends Error {
  readonly code = 'ACCOUNT_OPERATION_CLOSED';

  constructor(message = 'Account operations are closed') {
    super(message);
    this.name = 'AccountOperationClosedError';
  }
}

export function assertAccountOperationOpen(signal: AbortSignal): void {
  if (signal.aborted) throw new AccountOperationClosedError();
}

export async function runBestEffortAccountOperation(
  operation: (signal: AbortSignal) => Promise<void>,
  onError?: (error: unknown) => void,
): Promise<void> {
  try {
    await accountOperationGate.runCurrent(operation);
  } catch (error) {
    if (error instanceof AccountOperationClosedError) return;
    onError?.(error);
  }
}

type ActiveOperation = {
  controller: AbortController;
};

type GatePhase = 'open' | 'sealed';

export class AccountOperationGate {
  private generation: number;
  private phase: GatePhase = 'open';
  private drained = false;
  private readonly activeOperations = new Set<ActiveOperation>();
  private readonly drainWaiters = new Set<() => void>();

  constructor(initialGeneration = LEGACY_ACCOUNT_GENERATION) {
    this.generation = initialGeneration;
  }

  currentGeneration(): number {
    return this.generation;
  }

  advanceOpenGeneration(generation: number): void {
    if (
      this.phase !== 'open' ||
      this.activeOperations.size > 0 ||
      generation !== this.generation + 1
    ) {
      throw new AccountOperationClosedError(
        `Cannot advance to account generation ${generation}`,
      );
    }

    this.generation = generation;
  }

  open(generation: number): void {
    if (
      this.phase !== 'sealed' ||
      !this.drained ||
      generation !== this.generation + 1
    ) {
      throw new AccountOperationClosedError(
        `Cannot open account generation ${generation}`,
      );
    }

    this.generation = generation;
    this.phase = 'open';
    this.drained = false;
  }

  runCurrent<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (this.phase !== 'open') {
      return Promise.reject(new AccountOperationClosedError());
    }

    const activeOperation: ActiveOperation = {
      controller: new AbortController(),
    };
    this.activeOperations.add(activeOperation);

    let result: Promise<T>;
    try {
      result = Promise.resolve(operation(activeOperation.controller.signal));
    } catch (error) {
      this.complete(activeOperation);
      return Promise.reject(error);
    }

    return result.finally(() => {
      this.complete(activeOperation);
    });
  }

  seal(generation: number): void {
    this.assertCurrentGeneration(generation);
    if (this.phase === 'sealed') return;

    this.phase = 'sealed';
    this.drained = false;
    for (const operation of this.activeOperations) {
      operation.controller.abort();
    }
  }

  drain(generation: number, timeoutMs: number): Promise<DrainResult> {
    try {
      this.assertCurrentGeneration(generation);
      if (this.phase !== 'sealed') {
        throw new AccountOperationClosedError(
          `Account generation ${generation} is still open`,
        );
      }
    } catch (error) {
      return Promise.reject(error);
    }

    if (this.activeOperations.size === 0) {
      this.drained = true;
      return Promise.resolve({ kind: 'drained' });
    }

    return new Promise<DrainResult>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;

      const finish = (result: DrainResult) => {
        if (settled) return;
        settled = true;
        this.drainWaiters.delete(onDrained);
        if (timer !== undefined) clearTimeout(timer);
        if (result.kind === 'drained') this.drained = true;
        resolve(result);
      };
      const onDrained = () => finish({ kind: 'drained' });

      this.drainWaiters.add(onDrained);
      timer = setTimeout(() => {
        finish({
          kind: 'timed-out',
          pendingCount: this.activeOperations.size,
        });
      }, Math.max(0, timeoutMs));
    });
  }

  private assertCurrentGeneration(generation: number): void {
    if (generation !== this.generation) {
      throw new AccountOperationClosedError(
        `Account generation ${generation} is not current`,
      );
    }
  }

  private complete(operation: ActiveOperation): void {
    if (!this.activeOperations.delete(operation)) return;
    if (this.activeOperations.size > 0) return;

    for (const waiter of [...this.drainWaiters]) waiter();
  }
}

export const accountOperationGate = new AccountOperationGate(
  LEGACY_ACCOUNT_GENERATION,
);
