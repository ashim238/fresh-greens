import {
  clearAllRecordings,
  type Recording,
} from '../../lib/api/recordings';

type MockFileState = {
  exists: boolean;
  deleteError?: Error;
};

const storageKey = 'fresh-greens.recordings.v1';
const mockFiles = new Map<string, MockFileState>();
const mockGetItem = jest.fn<Promise<string | null>, [string]>();
const mockSetItem = jest.fn<Promise<void>, [string, string]>();
const mockRemoveItem = jest.fn<Promise<void>, [string]>();
const mockFileDelete = jest.fn<void, [string]>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
    removeItem: (key: string) => mockRemoveItem(key),
  },
}));

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;

    constructor(parent: string, name: string) {
      this.uri = `${parent}/${name}`;
    }

    create() {}
  }

  class File {
    uri: string;

    constructor(source: string | Directory, name?: string) {
      this.uri =
        typeof source === 'string' ? source : `${source.uri}/${name}`;
      if (!mockFiles.has(this.uri)) {
        mockFiles.set(this.uri, { exists: false });
      }
    }

    get exists() {
      return mockFiles.get(this.uri)?.exists ?? false;
    }

    copy(destination: File) {
      if (!this.exists) throw new Error(`Missing source: ${this.uri}`);
      const destinationState = mockFiles.get(destination.uri);
      if (!destinationState) throw new Error('Missing destination state');
      destinationState.exists = true;
    }

    delete() {
      mockFileDelete(this.uri);
      const state = mockFiles.get(this.uri);
      if (!state) throw new Error('Missing file state');
      if (state.deleteError) throw state.deleteError;
      state.exists = false;
    }
  }

  return {
    Directory,
    File,
    Paths: { document: 'file:///documents' },
  };
});

const recordings: Recording[] = [
  {
    id: 'rec-newer',
    uri: 'file:///documents/recordings/rec-newer.m4a',
    createdAt: 2_000,
    durationMs: 1_750,
    armed: 'yes',
  },
  {
    id: 'rec-older',
    uri: 'file:///documents/recordings/rec-older.m4a',
    createdAt: 1_000,
    durationMs: 3_250,
    armed: 'preferred-not-to-answer',
  },
];

describe('clearAllRecordings commit boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFiles.clear();
    for (const recording of recordings) {
      mockFiles.set(recording.uri, { exists: true });
    }
    mockGetItem.mockResolvedValue(JSON.stringify(recordings));
    mockRemoveItem.mockResolvedValue(undefined);
  });

  test('leaves every audio file untouched when metadata removal fails', async () => {
    const metadataError = new Error('metadata removal failed');
    mockRemoveItem.mockRejectedValue(metadataError);

    await expect(clearAllRecordings()).rejects.toBe(metadataError);

    expect(mockGetItem).toHaveBeenCalledWith(storageKey);
    expect(mockRemoveItem).toHaveBeenCalledWith(storageKey);
    expect(mockFileDelete).not.toHaveBeenCalled();
    for (const recording of recordings) {
      expect(mockFiles.get(recording.uri)?.exists).toBe(true);
    }
  });

  test('keeps committed metadata removed when one audio cleanup fails', async () => {
    mockFiles.get(recordings[0].uri)!.deleteError = new Error(
      'audio cleanup failed',
    );

    await expect(clearAllRecordings()).resolves.toBeUndefined();

    expect(mockRemoveItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockFileDelete).toHaveBeenCalledTimes(2);
    expect(mockFileDelete).toHaveBeenNthCalledWith(1, recordings[0].uri);
    expect(mockFileDelete).toHaveBeenNthCalledWith(2, recordings[1].uri);
    expect(mockFiles.get(recordings[0].uri)?.exists).toBe(true);
    expect(mockFiles.get(recordings[1].uri)?.exists).toBe(false);
  });

  test('commits metadata removal before deleting every audio file', async () => {
    await clearAllRecordings();

    expect(mockRemoveItem).toHaveBeenCalledWith(storageKey);
    expect(mockFileDelete).toHaveBeenCalledTimes(2);
    expect(mockRemoveItem.mock.invocationCallOrder[0]).toBeLessThan(
      mockFileDelete.mock.invocationCallOrder[0],
    );
    for (const recording of recordings) {
      expect(mockFiles.get(recording.uri)?.exists).toBe(false);
    }
  });

  test('removes empty metadata idempotently without touching audio files', async () => {
    mockGetItem.mockResolvedValue(null);

    await expect(clearAllRecordings()).resolves.toBeUndefined();

    expect(mockRemoveItem).toHaveBeenCalledWith(storageKey);
    expect(mockFileDelete).not.toHaveBeenCalled();
  });
});
