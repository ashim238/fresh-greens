type AsyncAction =
  | { kind: 'reject'; error: Error }
  | { kind: 'defer'; gate: Deferred<void> };

const mockSyncOperations = [
  'File.copy',
  'File.write',
  'File.create',
  'File.delete',
  'Directory.create',
  'Directory.delete',
  'Directory.list',
] as const;

type SyncOperation = (typeof mockSyncOperations)[number];

export type Deferred<T> = {
  promise: Promise<T>;
  readonly settled: boolean;
  resolve(value?: T | PromiseLike<T>): void;
  reject(error?: unknown): void;
};

export const FIXED_NOW = new Date('2026-07-15T12:00:00.000Z');

const mockPendingDeferred = new Set<object>();
const mockAsyncActions = new Map<string, AsyncAction[]>();
const mockSyncFailures = new Map<SyncOperation, Error[]>();
const mockTrackedAbortControllers = new Set<AbortController>();
let mockHarnessGeneration = 0;

type ActiveWait = {
  reset(): void;
};

const mockActiveWaits = new Set<ActiveWait>();

export class HarnessResetError extends Error {
  readonly code = 'HARNESS_RESET';

  constructor() {
    super('Test harness reset while deferred work was pending');
    this.name = 'HarnessResetError';
  }
}

function mockQueueAction(operation: string, action: AsyncAction): void {
  const queue = mockAsyncActions.get(operation) ?? [];
  queue.push(action);
  mockAsyncActions.set(operation, queue);
}

async function mockRunAsync<T>(
  operation: string,
  fallback: () => T | Promise<T>,
): Promise<T> {
  const generation = mockHarnessGeneration;
  const queue = mockAsyncActions.get(operation);
  const action = queue?.shift();
  if (queue?.length === 0) mockAsyncActions.delete(operation);
  if (action?.kind === 'reject') throw action.error;
  if (action?.kind === 'defer') {
    await new Promise<void>((resolve, reject) => {
      let finished = false;
      const finish = (next: () => void) => {
        if (finished) return;
        finished = true;
        mockActiveWaits.delete(wait);
        next();
      };
      const wait: ActiveWait = {
        reset: () => finish(() => reject(new HarnessResetError())),
      };
      mockActiveWaits.add(wait);
      action.gate.promise.then(
        () =>
          finish(() => {
            if (generation !== mockHarnessGeneration) {
              reject(new HarnessResetError());
              return;
            }
            resolve();
          }),
        (error) => finish(() => reject(error)),
      );
    });
  }
  return fallback();
}

function mockFailSync(operation: SyncOperation): void {
  const queue = mockSyncFailures.get(operation);
  const error = queue?.shift();
  if (queue?.length === 0) mockSyncFailures.delete(operation);
  if (error) throw error;
}

function mockAsyncControls<const Operation extends string>(
  prefix: string,
  operations: readonly Operation[],
) {
  const allowed = new Set<string>(operations);
  const validate = (operation: Operation) => {
    if (!allowed.has(operation)) {
      throw new Error(`Unknown ${prefix} operation: ${operation}`);
    }
  };

  return {
    failNext(operation: Operation, error: Error): void {
      validate(operation);
      mockQueueAction(`${prefix}.${operation}`, { kind: 'reject', error });
    },
    deferNext(operation: Operation, gate: Deferred<void>): void {
      validate(operation);
      mockQueueAction(`${prefix}.${operation}`, {
        kind: 'defer',
        gate,
      });
    },
  };
}

export function deferred<T>(): Deferred<T> {
  const token = {};
  let settled = false;
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  let rejectPromise!: (error?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  mockPendingDeferred.add(token);

  return {
    promise,
    get settled() {
      return settled;
    },
    resolve(value) {
      if (settled) return;
      settled = true;
      mockPendingDeferred.delete(token);
      resolvePromise(value as T | PromiseLike<T>);
    },
    reject(error) {
      if (settled) return;
      settled = true;
      mockPendingDeferred.delete(token);
      rejectPromise(error);
    },
  };
}

export function pendingDeferredCount(): number {
  return mockPendingDeferred.size;
}

export function assertHarnessIdle(): void {
  const problems: string[] = [];
  if (mockAsyncActions.size > 0) {
    problems.push(`unused async actions: ${[...mockAsyncActions.keys()].join(', ')}`);
  }
  if (mockSyncFailures.size > 0) {
    problems.push(`unused sync failures: ${[...mockSyncFailures.keys()].join(', ')}`);
  }
  if (mockActiveWaits.size > 0) {
    problems.push(`active deferred operations: ${mockActiveWaits.size}`);
  }
  if (mockPendingDeferred.size > 0) {
    problems.push(`pending deferred work: ${mockPendingDeferred.size}`);
  }
  if (problems.length > 0) {
    throw new Error(`Test harness is not idle; ${problems.join('; ')}`);
  }
}

const mockAsyncStorageValues = new Map<string, string>();

const mockAsyncStorageGetItem = jest.fn<Promise<string | null>, [string]>();
const mockAsyncStorageSetItem = jest.fn<Promise<void>, [string, string]>();
const mockAsyncStorageRemoveItem = jest.fn<Promise<void>, [string]>();
const mockAsyncStorageClear = jest.fn<Promise<void>, []>();
const mockAsyncStorageGetAllKeys = jest.fn<Promise<readonly string[]>, []>();
const mockAsyncStorageMultiGet = jest.fn<
  Promise<readonly [string, string | null][]>,
  [readonly string[]]
>();
const mockAsyncStorageMultiSet = jest.fn<
  Promise<void>,
  [readonly (readonly [string, string])[]]
>();
const mockAsyncStorageMultiRemove = jest.fn<Promise<void>, [readonly string[]]>();

export const asyncStorageState = {
  values: mockAsyncStorageValues,
  ...mockAsyncControls('AsyncStorage', [
    'getItem',
    'setItem',
    'removeItem',
    'clear',
    'getAllKeys',
    'multiGet',
    'multiSet',
    'multiRemove',
  ] as const),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: mockAsyncStorageGetItem,
    setItem: mockAsyncStorageSetItem,
    removeItem: mockAsyncStorageRemoveItem,
    clear: mockAsyncStorageClear,
    getAllKeys: mockAsyncStorageGetAllKeys,
    multiGet: mockAsyncStorageMultiGet,
    multiSet: mockAsyncStorageMultiSet,
    multiRemove: mockAsyncStorageMultiRemove,
  },
}));

const mockSecureStoreValues = new Map<string, string>();
const mockSecureStoreGetItem = jest.fn<Promise<string | null>, [string]>();
const mockSecureStoreSetItem = jest.fn<
  Promise<void>,
  [string, string, Record<string, unknown>?]
>();
const mockSecureStoreDeleteItem = jest.fn<Promise<void>, [string]>();
const mockSecureStoreIsAvailable = jest.fn<Promise<boolean>, []>();

export const secureStoreState = {
  values: mockSecureStoreValues,
  ...mockAsyncControls('SecureStore', [
    'getItemAsync',
    'setItemAsync',
    'deleteItemAsync',
    'isAvailableAsync',
  ] as const),
};

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  getItemAsync: mockSecureStoreGetItem,
  setItemAsync: mockSecureStoreSetItem,
  deleteItemAsync: mockSecureStoreDeleteItem,
  isAvailableAsync: mockSecureStoreIsAvailable,
}));

type MockFileContents = string | Uint8Array;

const mockFiles = new Map<string, MockFileContents>();
const mockDirectories = new Set<string>();

function mockUriPart(part: string | { uri: string }): string {
  return typeof part === 'string' ? part : part.uri;
}

function mockJoinUri(parts: (string | { uri: string })[]): string {
  const [first = '', ...rest] = parts.map(mockUriPart);
  return rest.reduce(
    (uri, part) => `${uri.replace(/\/$/, '')}/${part.replace(/^\//, '')}`,
    first,
  );
}

function mockName(uri: string): string {
  return uri.replace(/\/$/, '').split('/').pop() ?? '';
}

function mockParentUri(uri: string): string {
  const normalized = uri.replace(/\/$/, '');
  return normalized.slice(0, normalized.lastIndexOf('/'));
}

function mockDeletePath(uri: string): boolean {
  const normalized = uri.replace(/\/$/, '');
  let deleted = mockFiles.delete(uri) || mockFiles.delete(normalized);
  deleted = mockDirectories.delete(normalized) || deleted;
  for (const fileUri of [...mockFiles.keys()]) {
    if (fileUri.startsWith(`${normalized}/`)) {
      mockFiles.delete(fileUri);
      deleted = true;
    }
  }
  for (const directoryUri of [...mockDirectories]) {
    if (directoryUri.startsWith(`${normalized}/`)) {
      mockDirectories.delete(directoryUri);
      deleted = true;
    }
  }
  return deleted;
}

const mockLegacyCopyAsync = jest.fn<
  Promise<void>,
  [{ from: string; to: string }]
>();
const mockLegacyMakeDirectoryAsync = jest.fn<
  Promise<void>,
  [string, { intermediates?: boolean }?]
>();
const mockLegacyDeleteAsync = jest.fn<
  Promise<void>,
  [string, { idempotent?: boolean }?]
>();
const mockLegacyGetInfoAsync = jest.fn<Promise<{ exists: boolean; uri: string }>, [string]>();

export const fileSystemState = {
  files: mockFiles,
  directories: mockDirectories,
  ...mockAsyncControls('FileSystem', [
    'copyAsync',
    'makeDirectoryAsync',
    'deleteAsync',
    'getInfoAsync',
  ] as const),
  failNextSync(operation: SyncOperation, error: Error): void {
    if (!(mockSyncOperations as readonly string[]).includes(operation)) {
      throw new Error(`Unknown synchronous FileSystem operation: ${operation}`);
    }
    const queue = mockSyncFailures.get(operation) ?? [];
    queue.push(error);
    mockSyncFailures.set(operation, queue);
  },
  seedFile(uri: string, contents: MockFileContents = ''): void {
    mockFiles.set(uri, contents);
  },
  seedDirectory(uri: string): void {
    mockDirectories.add(uri.replace(/\/$/, ''));
  },
};

jest.mock('expo-file-system', () => {
  class Directory {
    readonly uri: string;

    constructor(...parts: (string | { uri: string })[]) {
      this.uri = mockJoinUri(parts);
    }

    get exists() {
      return mockDirectories.has(this.uri);
    }

    get name() {
      return mockName(this.uri);
    }

    get parentDirectory() {
      return new Directory(mockParentUri(this.uri));
    }

    create(options?: { idempotent?: boolean }) {
      mockFailSync('Directory.create');
      if (this.exists && !options?.idempotent) {
        throw new Error(`Directory already exists: ${this.uri}`);
      }
      mockDirectories.add(this.uri);
    }

    delete() {
      mockFailSync('Directory.delete');
      if (!this.exists) throw new Error(`Missing directory: ${this.uri}`);
      mockDirectories.delete(this.uri);
      for (const uri of [...mockFiles.keys()]) {
        if (uri.startsWith(`${this.uri}/`)) mockFiles.delete(uri);
      }
      for (const uri of [...mockDirectories]) {
        if (uri.startsWith(`${this.uri}/`)) mockDirectories.delete(uri);
      }
    }

    list() {
      mockFailSync('Directory.list');
      if (!this.exists) throw new Error(`Missing directory: ${this.uri}`);
      const prefix = `${this.uri}/`;
      const children: (Directory | File)[] = [];
      for (const uri of mockDirectories) {
        if (uri.startsWith(prefix) && !uri.slice(prefix.length).includes('/')) {
          children.push(new Directory(uri));
        }
      }
      for (const uri of mockFiles.keys()) {
        if (uri.startsWith(prefix) && !uri.slice(prefix.length).includes('/')) {
          children.push(new File(uri));
        }
      }
      return children;
    }

    createFile(name: string) {
      const file = new File(this, name);
      file.create();
      return file;
    }

    createDirectory(name: string) {
      const directory = new Directory(this, name);
      directory.create();
      return directory;
    }
  }

  class File {
    readonly uri: string;

    constructor(...parts: (string | { uri: string })[]) {
      this.uri = mockJoinUri(parts);
    }

    get exists() {
      return mockFiles.has(this.uri);
    }

    get name() {
      return mockName(this.uri);
    }

    get extension() {
      const dot = this.name.lastIndexOf('.');
      return dot < 0 ? '' : this.name.slice(dot);
    }

    get parentDirectory() {
      return new Directory(mockParentUri(this.uri));
    }

    create(options?: { overwrite?: boolean }) {
      mockFailSync('File.create');
      if (this.exists && !options?.overwrite) {
        throw new Error(`File already exists: ${this.uri}`);
      }
      mockFiles.set(this.uri, '');
    }

    copy(destination: File | Directory) {
      mockFailSync('File.copy');
      if (!this.exists) throw new Error(`Missing file: ${this.uri}`);
      const destinationUri =
        destination instanceof Directory
          ? mockJoinUri([destination, this.name])
          : destination.uri;
      mockFiles.set(destinationUri, mockFiles.get(this.uri)!);
    }

    write(contents: MockFileContents) {
      mockFailSync('File.write');
      mockFiles.set(this.uri, contents);
    }

    delete() {
      mockFailSync('File.delete');
      if (!this.exists) throw new Error(`Missing file: ${this.uri}`);
      mockFiles.delete(this.uri);
    }

    text() {
      if (!this.exists) return Promise.reject(new Error(`Missing file: ${this.uri}`));
      const contents = mockFiles.get(this.uri)!;
      return Promise.resolve(
        typeof contents === 'string' ? contents : new TextDecoder().decode(contents),
      );
    }

    textSync() {
      if (!this.exists) throw new Error(`Missing file: ${this.uri}`);
      const contents = mockFiles.get(this.uri)!;
      return typeof contents === 'string' ? contents : new TextDecoder().decode(contents);
    }
  }

  const document = new Directory('file:///documents');
  const cache = new Directory('file:///cache');

  return {
    Directory,
    File,
    Paths: { document, cache },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
  copyAsync: mockLegacyCopyAsync,
  makeDirectoryAsync: mockLegacyMakeDirectoryAsync,
  deleteAsync: mockLegacyDeleteAsync,
  getInfoAsync: mockLegacyGetInfoAsync,
}));

type MockNotificationRequest = {
  identifier: string;
  content: Record<string, unknown>;
  trigger: unknown;
};

const mockScheduledNotifications = new Map<string, MockNotificationRequest>();
let mockNotificationSequence = 0;
let mockNotificationPermission = { granted: true, canAskAgain: true, status: 'granted' };

const mockSetNotificationHandler = jest.fn<void, [unknown]>();
const mockGetPermissions = jest.fn<Promise<typeof mockNotificationPermission>, []>();
const mockRequestPermissions = jest.fn<Promise<typeof mockNotificationPermission>, [unknown?]>();
const mockScheduleNotification = jest.fn<
  Promise<string>,
  [{ content: Record<string, unknown>; trigger: unknown }]
>();
const mockCancelScheduledNotification = jest.fn<Promise<void>, [string]>();
const mockCancelAllScheduledNotifications = jest.fn<Promise<void>, []>();
const mockGetAllScheduledNotifications = jest.fn<Promise<MockNotificationRequest[]>, []>();

export const notificationsState = {
  scheduled: mockScheduledNotifications,
  ...mockAsyncControls('Notifications', [
    'getPermissionsAsync',
    'requestPermissionsAsync',
    'scheduleNotificationAsync',
    'cancelScheduledNotificationAsync',
    'cancelAllScheduledNotificationsAsync',
    'getAllScheduledNotificationsAsync',
  ] as const),
  setPermission(permission: Partial<typeof mockNotificationPermission>): void {
    mockNotificationPermission = { ...mockNotificationPermission, ...permission };
  },
};

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
  },
  setNotificationHandler: mockSetNotificationHandler,
  getPermissionsAsync: mockGetPermissions,
  requestPermissionsAsync: mockRequestPermissions,
  scheduleNotificationAsync: mockScheduleNotification,
  cancelScheduledNotificationAsync: mockCancelScheduledNotification,
  cancelAllScheduledNotificationsAsync: mockCancelAllScheduledNotifications,
  getAllScheduledNotificationsAsync: mockGetAllScheduledNotifications,
}));

type MockPickerResult = {
  canceled: boolean;
  assets?: { uri: string }[];
};

let mockPickerPermission = { granted: true, canAskAgain: true, status: 'granted' };
let mockPickerResult: MockPickerResult = { canceled: true };
const mockRequestCameraPermissions = jest.fn<Promise<typeof mockPickerPermission>, []>();
const mockRequestMediaPermissions = jest.fn<Promise<typeof mockPickerPermission>, []>();
const mockLaunchCamera = jest.fn<Promise<MockPickerResult>, [unknown?]>();
const mockLaunchImageLibrary = jest.fn<Promise<MockPickerResult>, [unknown?]>();

export const imagePickerState = {
  ...mockAsyncControls('ImagePicker', [
    'requestCameraPermissionsAsync',
    'requestMediaLibraryPermissionsAsync',
    'launchCameraAsync',
    'launchImageLibraryAsync',
  ] as const),
  setPermission(permission: Partial<typeof mockPickerPermission>): void {
    mockPickerPermission = { ...mockPickerPermission, ...permission };
  },
  setResult(result: MockPickerResult): void {
    mockPickerResult = result;
  },
};

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: mockRequestCameraPermissions,
  requestMediaLibraryPermissionsAsync: mockRequestMediaPermissions,
  launchCameraAsync: mockLaunchCamera,
  launchImageLibraryAsync: mockLaunchImageLibrary,
}));

export const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

let mockRouterPathname = '/';
let mockRouterSearchParams: Record<string, string> = {};
let mockRouterHistory = ['/'];

const mockRouter = {
  push: jest.fn<void, [unknown]>(),
  replace: jest.fn<void, [unknown]>(),
  back: jest.fn<void, []>(),
  dismiss: jest.fn<void, []>(),
  dismissAll: jest.fn<void, []>(),
  canGoBack: jest.fn<boolean, []>(),
  canDismiss: jest.fn<boolean, []>(),
  setParams: jest.fn<void, [Record<string, unknown>]>(),
  navigate: jest.fn<void, [unknown]>(),
  reload: jest.fn<void, []>(),
};

export const routerMock = mockRouter;

const mockUseRouter = jest.fn();
const mockUsePathname = jest.fn();
const mockUseSegments = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockUseGlobalSearchParams = jest.fn();
const mockUseNavigation = jest.fn();
const mockUseFocusEffect = jest.fn();

const mockRouterStackState = {
  visibleScreens: new Set<string>(),
};
export const routerStackState = mockRouterStackState;

function mockHrefPath(href: unknown): string {
  if (typeof href === 'string') return href.split('?')[0] || '/';
  if (href && typeof href === 'object' && 'pathname' in href) {
    return String((href as { pathname: unknown }).pathname);
  }
  return '/';
}

export function setRouterState(
  pathname: string,
  searchParams: Record<string, string> = {},
): void {
  mockRouterPathname = pathname;
  mockRouterSearchParams = { ...searchParams };
  mockRouterHistory = [pathname];
}

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  Stack.Screen = ({ name }: { name: string }) => {
    mockRouterStackState.visibleScreens.add(name);
    return null;
  };
  Stack.Protected = ({
    children,
    guard,
  }: {
    children?: React.ReactNode;
    guard: boolean;
  }) => (guard ? React.createElement(React.Fragment, null, children) : null);
  const Slot = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  return {
    router: mockRouter,
    useRouter: mockUseRouter,
    usePathname: mockUsePathname,
    useSegments: mockUseSegments,
    useLocalSearchParams: mockUseLocalSearchParams,
    useGlobalSearchParams: mockUseGlobalSearchParams,
    useNavigation: mockUseNavigation,
    useFocusEffect: mockUseFocusEffect,
    Redirect: ({ href }: { href: unknown }) => {
      React.useEffect(() => mockRouter.replace(href), [href]);
      return null;
    },
    Stack,
    Slot,
    Link: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

export function setHarnessTime(value: Date | string | number): void {
  jest.setSystemTime(new Date(value));
}

export function createTrackedAbortController(): AbortController {
  const controller = new AbortController();
  mockTrackedAbortControllers.add(controller);
  controller.signal.addEventListener(
    'abort',
    () => mockTrackedAbortControllers.delete(controller),
    { once: true },
  );
  return controller;
}

function mockAbortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function mockDefaultFetch(
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) {
      reject(mockAbortError());
      return;
    }

    let settled = false;
    const finish = (complete: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      complete();
    };
    const onAbort = () => finish(() => reject(mockAbortError()));
    signal?.addEventListener('abort', onAbort, { once: true });

    void Promise.resolve().then(() =>
      finish(() =>
        resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
          text: async () => '',
        } as Response),
      ),
    );
  });
}

function mockConfigureImplementations(): void {
  mockAsyncStorageGetItem.mockImplementation((key) =>
    mockRunAsync('AsyncStorage.getItem', () => mockAsyncStorageValues.get(key) ?? null),
  );
  mockAsyncStorageSetItem.mockImplementation((key, value) =>
    mockRunAsync('AsyncStorage.setItem', () => {
      mockAsyncStorageValues.set(key, value);
    }),
  );
  mockAsyncStorageRemoveItem.mockImplementation((key) =>
    mockRunAsync('AsyncStorage.removeItem', () => {
      mockAsyncStorageValues.delete(key);
    }),
  );
  mockAsyncStorageClear.mockImplementation(() =>
    mockRunAsync('AsyncStorage.clear', () => mockAsyncStorageValues.clear()),
  );
  mockAsyncStorageGetAllKeys.mockImplementation(() =>
    mockRunAsync('AsyncStorage.getAllKeys', () => [...mockAsyncStorageValues.keys()]),
  );
  mockAsyncStorageMultiGet.mockImplementation((keys) =>
    mockRunAsync('AsyncStorage.multiGet', () =>
      keys.map((key) => [key, mockAsyncStorageValues.get(key) ?? null] as const),
    ),
  );
  mockAsyncStorageMultiSet.mockImplementation((entries) =>
    mockRunAsync('AsyncStorage.multiSet', () => {
      for (const [key, value] of entries) mockAsyncStorageValues.set(key, value);
    }),
  );
  mockAsyncStorageMultiRemove.mockImplementation((keys) =>
    mockRunAsync('AsyncStorage.multiRemove', () => {
      for (const key of keys) mockAsyncStorageValues.delete(key);
    }),
  );

  mockSecureStoreGetItem.mockImplementation((key) =>
    mockRunAsync('SecureStore.getItemAsync', () => mockSecureStoreValues.get(key) ?? null),
  );
  mockSecureStoreSetItem.mockImplementation((key, value) =>
    mockRunAsync('SecureStore.setItemAsync', () => {
      mockSecureStoreValues.set(key, value);
    }),
  );
  mockSecureStoreDeleteItem.mockImplementation((key) =>
    mockRunAsync('SecureStore.deleteItemAsync', () => {
      mockSecureStoreValues.delete(key);
    }),
  );
  mockSecureStoreIsAvailable.mockImplementation(() =>
    mockRunAsync('SecureStore.isAvailableAsync', () => true),
  );

  mockLegacyCopyAsync.mockImplementation(({ from, to }) =>
    mockRunAsync('FileSystem.copyAsync', () => {
      if (!mockFiles.has(from)) throw new Error(`Missing file: ${from}`);
      mockFiles.set(to, mockFiles.get(from)!);
    }),
  );
  mockLegacyMakeDirectoryAsync.mockImplementation((uri) =>
    mockRunAsync('FileSystem.makeDirectoryAsync', () => {
      mockDirectories.add(uri.replace(/\/$/, ''));
    }),
  );
  mockLegacyDeleteAsync.mockImplementation((uri, options) =>
    mockRunAsync('FileSystem.deleteAsync', () => {
      const deleted = mockDeletePath(uri);
      if (!deleted && !options?.idempotent) throw new Error(`Missing path: ${uri}`);
    }),
  );
  mockLegacyGetInfoAsync.mockImplementation((uri) =>
    mockRunAsync('FileSystem.getInfoAsync', () => ({
      exists: mockFiles.has(uri) || mockDirectories.has(uri.replace(/\/$/, '')),
      uri,
    })),
  );

  mockGetPermissions.mockImplementation(() =>
    mockRunAsync('Notifications.getPermissionsAsync', () => ({ ...mockNotificationPermission })),
  );
  mockRequestPermissions.mockImplementation(() =>
    mockRunAsync('Notifications.requestPermissionsAsync', () => ({ ...mockNotificationPermission })),
  );
  mockScheduleNotification.mockImplementation((request) =>
    mockRunAsync('Notifications.scheduleNotificationAsync', () => {
      const identifier = `notification-${++mockNotificationSequence}`;
      mockScheduledNotifications.set(identifier, { identifier, ...request });
      return identifier;
    }),
  );
  mockCancelScheduledNotification.mockImplementation((identifier) =>
    mockRunAsync('Notifications.cancelScheduledNotificationAsync', () => {
      mockScheduledNotifications.delete(identifier);
    }),
  );
  mockCancelAllScheduledNotifications.mockImplementation(() =>
    mockRunAsync('Notifications.cancelAllScheduledNotificationsAsync', () => {
      mockScheduledNotifications.clear();
    }),
  );
  mockGetAllScheduledNotifications.mockImplementation(() =>
    mockRunAsync('Notifications.getAllScheduledNotificationsAsync', () => [
      ...mockScheduledNotifications.values(),
    ]),
  );

  mockRequestCameraPermissions.mockImplementation(() =>
    mockRunAsync('ImagePicker.requestCameraPermissionsAsync', () => ({ ...mockPickerPermission })),
  );
  mockRequestMediaPermissions.mockImplementation(() =>
    mockRunAsync('ImagePicker.requestMediaLibraryPermissionsAsync', () => ({ ...mockPickerPermission })),
  );
  mockLaunchCamera.mockImplementation(() =>
    mockRunAsync('ImagePicker.launchCameraAsync', () => mockPickerResult),
  );
  mockLaunchImageLibrary.mockImplementation(() =>
    mockRunAsync('ImagePicker.launchImageLibraryAsync', () => mockPickerResult),
  );

  fetchMock.mockImplementation(mockDefaultFetch);
  globalThis.fetch = fetchMock as typeof fetch;

  routerMock.push.mockImplementation((href) => {
    mockRouterPathname = mockHrefPath(href);
    mockRouterHistory.push(mockRouterPathname);
  });
  routerMock.replace.mockImplementation((href) => {
    mockRouterPathname = mockHrefPath(href);
    mockRouterHistory[mockRouterHistory.length - 1] = mockRouterPathname;
  });
  routerMock.back.mockImplementation(() => {
    if (mockRouterHistory.length > 1) mockRouterHistory.pop();
    mockRouterPathname = mockRouterHistory.at(-1) ?? '/';
  });
  routerMock.canGoBack.mockImplementation(() => mockRouterHistory.length > 1);
  routerMock.canDismiss.mockImplementation(() => mockRouterHistory.length > 1);
  routerMock.setParams.mockImplementation((params) => {
    mockRouterSearchParams = Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    );
  });
  routerMock.navigate.mockImplementation((href) => routerMock.push(href));
  mockUseRouter.mockImplementation(() => mockRouter);
  mockUsePathname.mockImplementation(() => mockRouterPathname);
  mockUseSegments.mockImplementation(() =>
    mockRouterPathname.split('/').filter(Boolean),
  );
  mockUseLocalSearchParams.mockImplementation(() => ({ ...mockRouterSearchParams }));
  mockUseGlobalSearchParams.mockImplementation(() => ({ ...mockRouterSearchParams }));
  mockUseNavigation.mockImplementation(() => ({ setOptions: jest.fn() }));
  mockUseFocusEffect.mockImplementation(
    (callback: () => void | (() => void)) => {
      const React = require('react') as typeof import('react');
      React.useEffect(callback, [callback]);
    },
  );
}

export function resetTestHarness(): void {
  mockHarnessGeneration += 1;
  for (const wait of mockActiveWaits) wait.reset();
  mockActiveWaits.clear();
  for (const controller of mockTrackedAbortControllers) controller.abort('harness reset');
  mockTrackedAbortControllers.clear();
  mockPendingDeferred.clear();
  mockAsyncActions.clear();
  mockSyncFailures.clear();
  mockAsyncStorageValues.clear();
  mockSecureStoreValues.clear();
  mockFiles.clear();
  mockDirectories.clear();
  mockDirectories.add('file:///documents');
  mockDirectories.add('file:///cache');
  mockScheduledNotifications.clear();
  mockNotificationSequence = 0;
  mockNotificationPermission = { granted: true, canAskAgain: true, status: 'granted' };
  mockPickerPermission = { granted: true, canAskAgain: true, status: 'granted' };
  mockPickerResult = { canceled: true };
  mockRouterPathname = '/';
  mockRouterSearchParams = {};
  mockRouterHistory = ['/'];
  routerStackState.visibleScreens.clear();

  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
  jest.resetAllMocks();
  mockConfigureImplementations();
}

resetTestHarness();
