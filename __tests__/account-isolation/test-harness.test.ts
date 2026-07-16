import {
  FIXED_NOW,
  assertHarnessIdle,
  asyncStorageState,
  createTrackedAbortController,
  deferred,
  fetchMock,
  fileSystemState,
  imagePickerState,
  notificationsState,
  pendingDeferredCount,
  resetTestHarness,
  routerMock,
  secureStoreState,
  setHarnessTime,
} from './test-harness';

const AsyncStorage = require('@react-native-async-storage/async-storage')
  .default as typeof import('@react-native-async-storage/async-storage').default;
const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
const LegacyFileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
const Notifications = require('expo-notifications') as typeof import('expo-notifications');
const ExpoRouter = require('expo-router') as typeof import('expo-router');

describe('account isolation test harness', () => {
  beforeEach(() => {
    resetTestHarness();
  });

  afterEach(() => {
    assertHarnessIdle();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('reset clears AsyncStorage and SecureStore values and mock calls', async () => {
    await AsyncStorage.setItem('async-key', 'async-value');
    await SecureStore.setItemAsync('secure-key', 'secure-value');

    expect(asyncStorageState.values.get('async-key')).toBe('async-value');
    expect(secureStoreState.values.get('secure-key')).toBe('secure-value');

    resetTestHarness();

    expect(await AsyncStorage.getItem('async-key')).toBeNull();
    expect(await SecureStore.getItemAsync('secure-key')).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  test('deferred creates a real promise and reports settlement', async () => {
    const work = deferred<string>();

    expect(work.promise).toBeInstanceOf(Promise);
    expect(pendingDeferredCount()).toBe(1);

    work.resolve('settled');
    await expect(work.promise).resolves.toBe('settled');
    expect(pendingDeferredCount()).toBe(0);
  });

  test('async mocks release deferred work into their stateful fallback', async () => {
    const read = deferred<void>();
    asyncStorageState.values.set('async-key', 'stored-value');
    asyncStorageState.deferNext('getItem', read);

    const pendingRead = AsyncStorage.getItem('async-key');
    expect(pendingDeferredCount()).toBe(1);

    read.resolve();
    await expect(pendingRead).resolves.toBe('stored-value');
  });

  test.each([
    {
      name: 'AsyncStorage.setItem',
      start: () => {
        const gate = deferred<void>();
        asyncStorageState.deferNext('setItem', gate);
        return {
          gate,
          operation: AsyncStorage.setItem('async-key', 'async-value'),
          before: () => expect(asyncStorageState.values.has('async-key')).toBe(false),
          after: () => expect(asyncStorageState.values.get('async-key')).toBe('async-value'),
        };
      },
    },
    {
      name: 'AsyncStorage.removeItem',
      start: () => {
        asyncStorageState.values.set('async-key', 'async-value');
        const gate = deferred<void>();
        asyncStorageState.deferNext('removeItem', gate);
        return {
          gate,
          operation: AsyncStorage.removeItem('async-key'),
          before: () => expect(asyncStorageState.values.has('async-key')).toBe(true),
          after: () => expect(asyncStorageState.values.has('async-key')).toBe(false),
        };
      },
    },
    {
      name: 'SecureStore.setItemAsync',
      start: () => {
        const gate = deferred<void>();
        secureStoreState.deferNext('setItemAsync', gate);
        return {
          gate,
          operation: SecureStore.setItemAsync('secure-key', 'secure-value'),
          before: () => expect(secureStoreState.values.has('secure-key')).toBe(false),
          after: () => expect(secureStoreState.values.get('secure-key')).toBe('secure-value'),
        };
      },
    },
    {
      name: 'SecureStore.deleteItemAsync',
      start: () => {
        secureStoreState.values.set('secure-key', 'secure-value');
        const gate = deferred<void>();
        secureStoreState.deferNext('deleteItemAsync', gate);
        return {
          gate,
          operation: SecureStore.deleteItemAsync('secure-key'),
          before: () => expect(secureStoreState.values.has('secure-key')).toBe(true),
          after: () => expect(secureStoreState.values.has('secure-key')).toBe(false),
        };
      },
    },
  ])('deferred $name mutates state only after release', async ({ start }) => {
    const { gate, operation, before, after } = start();

    before();
    gate.resolve();
    await operation;
    after();
  });

  test.each([
    {
      name: 'copyAsync',
      start: () => {
        fileSystemState.seedFile('file:///source', 'source');
        const gate = deferred<void>();
        fileSystemState.deferNext('copyAsync', gate);
        return {
          gate,
          operation: LegacyFileSystem.copyAsync({
            from: 'file:///source',
            to: 'file:///documents/copied.txt',
          }),
          before: () => expect(fileSystemState.files.has('file:///documents/copied.txt')).toBe(false),
          after: () => expect(fileSystemState.files.get('file:///documents/copied.txt')).toBe('source'),
        };
      },
    },
    {
      name: 'makeDirectoryAsync',
      start: () => {
        const gate = deferred<void>();
        fileSystemState.deferNext('makeDirectoryAsync', gate);
        return {
          gate,
          operation: LegacyFileSystem.makeDirectoryAsync('file:///documents/owned'),
          before: () => expect(fileSystemState.directories.has('file:///documents/owned')).toBe(false),
          after: () => expect(fileSystemState.directories.has('file:///documents/owned')).toBe(true),
        };
      },
    },
    {
      name: 'deleteAsync',
      start: () => {
        fileSystemState.seedDirectory('file:///documents/owned');
        fileSystemState.seedDirectory('file:///documents/owned/nested');
        fileSystemState.seedFile('file:///documents/owned/nested/data.txt', 'data');
        const gate = deferred<void>();
        fileSystemState.deferNext('deleteAsync', gate);
        return {
          gate,
          operation: LegacyFileSystem.deleteAsync('file:///documents/owned'),
          before: () => expect(fileSystemState.files.has('file:///documents/owned/nested/data.txt')).toBe(true),
          after: () => {
            expect(fileSystemState.directories.has('file:///documents/owned')).toBe(false);
            expect(fileSystemState.directories.has('file:///documents/owned/nested')).toBe(false);
            expect(fileSystemState.files.has('file:///documents/owned/nested/data.txt')).toBe(false);
          },
        };
      },
    },
  ])('deferred legacy $name mutates state only after release', async ({ start }) => {
    const { gate, operation, before, after } = start();

    before();
    gate.resolve();
    await operation;
    after();
  });

  test('deferred notification schedule and cancel preserve their side effects', async () => {
    const scheduleGate = deferred<void>();
    notificationsState.deferNext('scheduleNotificationAsync', scheduleGate);
    const schedule = Notifications.scheduleNotificationAsync({
      content: { title: 'Owned reminder' },
      trigger: null,
    });

    expect(notificationsState.scheduled.size).toBe(0);
    scheduleGate.resolve();
    const identifier = await schedule;
    expect(notificationsState.scheduled.has(identifier)).toBe(true);

    const cancelGate = deferred<void>();
    notificationsState.deferNext('cancelScheduledNotificationAsync', cancelGate);
    const cancel = Notifications.cancelScheduledNotificationAsync(identifier);

    expect(notificationsState.scheduled.has(identifier)).toBe(true);
    cancelGate.resolve();
    await cancel;
    expect(notificationsState.scheduled.has(identifier)).toBe(false);
  });

  test('reset rejects unresolved operations and blocks late side effects', async () => {
    const gate = deferred<void>();
    asyncStorageState.deferNext('setItem', gate);
    const operation = AsyncStorage.setItem('late-key', 'late-value');
    const outcome = operation.catch((error: unknown) => error);

    resetTestHarness();
    const error = await outcome;

    expect(error).toMatchObject({
      name: 'HarnessResetError',
      code: 'HARNESS_RESET',
    });
    gate.resolve();
    await Promise.resolve();
    expect(asyncStorageState.values.has('late-key')).toBe(false);
    expect(pendingDeferredCount()).toBe(0);
  });

  test('idle assertion catches unused controls and unresolved deferred work', async () => {
    asyncStorageState.failNext('getItem', new Error('unused read failure'));
    expect(assertHarnessIdle).toThrow(/unused async.*AsyncStorage\.getItem/i);

    await expect(AsyncStorage.getItem('async-key')).rejects.toThrow('unused read failure');

    const gate = deferred<void>();
    asyncStorageState.deferNext('setItem', gate);
    expect(assertHarnessIdle).toThrow(/unused async.*AsyncStorage\.setItem.*pending deferred/i);

    const operation = AsyncStorage.setItem('async-key', 'async-value');
    expect(assertHarnessIdle).toThrow(/active deferred.*pending deferred/i);

    gate.resolve();
    await operation;
    expect(assertHarnessIdle).not.toThrow();
  });

  test('idle assertion catches an unused synchronous failure', () => {
    fileSystemState.failNextSync('File.write', new Error('unused write failure'));
    expect(assertHarnessIdle).toThrow(/unused sync.*File\.write/i);

    expect(() => new FileSystem.File('file:///source').write('contents')).toThrow(
      'unused write failure',
    );
    expect(assertHarnessIdle).not.toThrow();
  });

  test('each module rejects unknown operation names at runtime', () => {
    const error = new Error('should not queue');

    expect(() => asyncStorageState.failNext('gettItem' as never, error)).toThrow(
      /Unknown AsyncStorage operation: gettItem/,
    );
    expect(() => secureStoreState.failNext('gettItemAsync' as never, error)).toThrow(
      /Unknown SecureStore operation: gettItemAsync/,
    );
    expect(() => fileSystemState.failNext('copy' as never, error)).toThrow(
      /Unknown FileSystem operation: copy/,
    );
    expect(() => notificationsState.failNext('schedule' as never, error)).toThrow(
      /Unknown Notifications operation: schedule/,
    );
    expect(() => imagePickerState.failNext('launch' as never, error)).toThrow(
      /Unknown ImagePicker operation: launch/,
    );
    expect(() => fileSystemState.failNextSync('File.rename' as never, error)).toThrow(
      /Unknown synchronous FileSystem operation: File.rename/,
    );
  });

  if (false) {
    // @ts-expect-error AsyncStorage operation names are closed.
    asyncStorageState.failNext('gettItem', new Error());
    // @ts-expect-error SecureStore operation names are closed.
    secureStoreState.deferNext('gettItemAsync', deferred<void>());
    // @ts-expect-error FileSystem operation names are closed.
    fileSystemState.failNext('copy', new Error());
    // @ts-expect-error Notifications operation names are closed.
    notificationsState.deferNext('schedule', deferred<void>());
    // @ts-expect-error ImagePicker operation names are closed.
    imagePickerState.failNext('launch', new Error());
  }

  test('reset still clears consumed module mocks', async () => {
    await AsyncStorage.getItem('async-key');

    resetTestHarness();

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  test.each([
    ['File.copy', () => {
      fileSystemState.seedFile('file:///source', 'source');
      new FileSystem.File('file:///source').copy(new FileSystem.File('file:///target'));
    }],
    ['File.write', () => new FileSystem.File('file:///source').write('contents')],
    ['File.create', () => new FileSystem.File('file:///created').create()],
    ['File.delete', () => {
      fileSystemState.seedFile('file:///deleted', 'contents');
      new FileSystem.File('file:///deleted').delete();
    }],
    ['Directory.create', () => new FileSystem.Directory('file:///documents', 'owned').create()],
    ['Directory.delete', () => {
      fileSystemState.seedDirectory('file:///documents/deleted');
      new FileSystem.Directory('file:///documents', 'deleted').delete();
    }],
    ['Directory.list', () => {
      fileSystemState.seedDirectory('file:///documents/listed');
      new FileSystem.Directory('file:///documents', 'listed').list();
    }],
  ] as const)('injects and resets synchronous %s failures', (operation, invoke) => {
    fileSystemState.failNextSync(operation as never, new Error(`${operation} failed`));

    expect(invoke).toThrow(`${operation} failed`);

    resetTestHarness();

    expect(invoke).not.toThrow();
  });

  test('reset clears files, scheduled notifications, and notification mocks', async () => {
    fileSystemState.seedFile('file:///documents/owned.txt', 'owned');
    const identifier = await Notifications.scheduleNotificationAsync({
      content: { title: 'Owned reminder' },
      trigger: null,
    });

    expect(fileSystemState.files.has('file:///documents/owned.txt')).toBe(true);
    expect(notificationsState.scheduled.has(identifier)).toBe(true);

    resetTestHarness();

    expect(fileSystemState.files.size).toBe(0);
    expect(notificationsState.scheduled.size).toBe(0);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('reset restores fetch, time, abort, and router mocks', async () => {
    setHarnessTime('2030-01-02T03:04:05.000Z');
    const controller = createTrackedAbortController();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await fetch('https://example.test');
    ExpoRouter.router.push('/home');
    controller.abort('test abort');

    expect(Date.now()).toBe(new Date('2030-01-02T03:04:05.000Z').getTime());
    expect(routerMock.push).toHaveBeenCalledWith('/home');
    expect(controller.signal.aborted).toBe(true);

    resetTestHarness();

    expect(Date.now()).toBe(FIXED_NOW.getTime());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(ExpoRouter.usePathname()).toBe('/');
  });

  test('default fetch rejects AbortError for already-aborted and in-flight signals', async () => {
    const alreadyAborted = createTrackedAbortController();
    alreadyAborted.abort();

    await expect(
      fetch('https://example.test/already-aborted', {
        signal: alreadyAborted.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    const inFlight = createTrackedAbortController();
    const pending = fetch('https://example.test/in-flight', {
      signal: inFlight.signal,
    });
    inFlight.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('explicit fetch overrides remain in control of abort behavior', async () => {
    const controller = createTrackedAbortController();
    const overridden = new Response(null, { status: 204 });
    fetchMock.mockResolvedValueOnce(overridden);
    controller.abort();

    await expect(
      fetch('https://example.test/overridden', {
        signal: controller.signal,
      }),
    ).resolves.toBe(overridden);
  });
});
