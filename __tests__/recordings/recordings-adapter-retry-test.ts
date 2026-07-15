import { addRecording, type AddRecordingInput } from '../../lib/api/recordings';

type MockFileState = {
  exists: boolean;
  deleteCount: number;
  deleteError?: Error;
};

const mockFiles = new Map<string, MockFileState>();
const mockDestinationUris: string[] = [];
const mockGetItem = jest.fn<Promise<string | null>, [string]>();
const mockSetItem = jest.fn<Promise<void>, [string, string]>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
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
        mockFiles.set(this.uri, { exists: false, deleteCount: 0 });
      }
      if (name) mockDestinationUris.push(this.uri);
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
      const state = mockFiles.get(this.uri);
      if (!state) throw new Error('Missing file state');
      state.deleteCount += 1;
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

const sourceUri = 'file:///cache/retryable.m4a';
const input: AddRecordingInput = {
  sourceUri,
  durationMs: 1_500,
  armed: 'no',
  createdAt: 1_000,
};
const existingRecording = {
  id: 'existing-recording',
  uri: 'file:///documents/recordings/existing.m4a',
  durationMs: 8_000,
  armed: null,
  createdAt: 500,
};

describe('recordings adapter retry boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFiles.clear();
    mockDestinationUris.length = 0;
    mockFiles.set(sourceUri, { exists: true, deleteCount: 0 });
    mockGetItem.mockResolvedValue(null);
    jest.spyOn(Date, 'now').mockReturnValue(2_500);
    jest.spyOn(Math, 'random').mockReturnValue(0.25);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('preserves the source and removes the failed destination so the same input can retry', async () => {
    mockSetItem
      .mockRejectedValueOnce(new Error('metadata unavailable'))
      .mockResolvedValueOnce(undefined);

    await expect(addRecording(input)).rejects.toThrow('metadata unavailable');

    const failedDestination = mockDestinationUris[0];
    expect(mockFiles.get(sourceUri)).toMatchObject({
      exists: true,
      deleteCount: 0,
    });
    expect(mockFiles.get(failedDestination)).toMatchObject({
      exists: false,
      deleteCount: 1,
    });

    const recording = await addRecording(input);

    expect(recording.durationMs).toBe(1_500);
    expect(mockSetItem).toHaveBeenCalledTimes(2);
    expect(mockFiles.get(sourceUri)).toMatchObject({
      exists: false,
      deleteCount: 1,
    });
    expect(mockFiles.get(recording.uri)).toMatchObject({ exists: true });
  });

  test('reports committed metadata success even when temp-source cleanup fails', async () => {
    mockFiles.get(sourceUri)!.deleteError = new Error('cache cleanup failed');
    mockSetItem.mockResolvedValueOnce(undefined);

    await expect(addRecording(input)).resolves.toMatchObject({
      durationMs: 1_500,
      armed: 'no',
    });
    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockFiles.get(sourceUri)).toMatchObject({
      exists: true,
      deleteCount: 1,
    });
  });

  test.each([
    {
      name: 'AsyncStorage read rejection',
      failFirstRead: () => {
        mockGetItem.mockRejectedValueOnce(new Error('metadata read failed'));
      },
    },
    {
      name: 'malformed metadata JSON',
      failFirstRead: () => {
        mockGetItem.mockResolvedValueOnce('{not-valid-json');
      },
    },
  ])(
    '$name preserves source and existing entries for a same-input retry',
    async ({ failFirstRead }) => {
      failFirstRead();
      mockGetItem.mockResolvedValueOnce(JSON.stringify([existingRecording]));
      mockSetItem.mockResolvedValue(undefined);

      await expect(addRecording(input)).rejects.toBeInstanceOf(Error);

      const failedDestination = mockDestinationUris[0];
      expect(mockSetItem).not.toHaveBeenCalled();
      expect(mockFiles.get(sourceUri)).toMatchObject({
        exists: true,
        deleteCount: 0,
      });
      expect(mockFiles.get(failedDestination)).toMatchObject({
        exists: false,
        deleteCount: 1,
      });

      const recording = await addRecording(input);
      const stored = JSON.parse(mockSetItem.mock.calls[0][1]);

      expect(stored).toEqual([recording, existingRecording]);
      expect(mockFiles.get(sourceUri)).toMatchObject({
        exists: false,
        deleteCount: 1,
      });
    },
  );
});
