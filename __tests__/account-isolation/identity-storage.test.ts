import {
  asyncStorageState,
  resetTestHarness,
} from './test-harness';

const {
  getStoredUser,
  readStoredUserStrict,
  setStoredUser,
  updateStoredUserProfile,
  upsertUser,
} = require('../../lib/api/user') as typeof import('../../lib/api/user');

describe('identity storage', () => {
  beforeEach(() => {
    resetTestHarness();
  });

  afterEach(() => {
    resetTestHarness();
  });

  test('switching to a different user id does not inherit the previous profile', async () => {
    await setStoredUser({
      id: 'user-a',
      provider: 'apple',
      displayName: 'Alice Example',
      email: 'alice@example.com',
      initials: 'AE',
      avatarUri: 'file:///documents/avatar-a.png',
      signedInAt: 123,
    });

    await expect(
      upsertUser({
        id: 'user-b',
        provider: 'google',
      }),
    ).resolves.toMatchObject({
      id: 'user-b',
      provider: 'google',
      displayName: null,
      email: null,
      avatarUri: null,
    });

    expect(JSON.parse(asyncStorageState.values.get('fresh-greens.user.v1') as string)).toMatchObject({
      id: 'user-b',
      provider: 'google',
      displayName: null,
      email: null,
      avatarUri: null,
    });
  });

  test('migrating from a provider subject preserves the local profile', async () => {
    await setStoredUser({
      id: 'apple-provider-subject',
      provider: 'apple',
      displayName: 'Alice Example',
      email: 'apple-private-relay@example.com',
      initials: 'AE',
      avatarUri: 'file:///documents/avatar-a.png',
      signedInAt: 123,
    });

    await expect(
      upsertUser(
        {
          id: 'supabase-user',
          provider: 'apple',
          email: 'canonical@example.com',
        },
        { migrateFromId: 'apple-provider-subject' },
      ),
    ).resolves.toMatchObject({
      id: 'supabase-user',
      provider: 'apple',
      displayName: 'Alice Example',
      email: 'canonical@example.com',
      initials: 'AE',
      avatarUri: 'file:///documents/avatar-a.png',
    });
  });

  test('malformed stored JSON fails closed instead of exposing a guest session', async () => {
    asyncStorageState.values.set('fresh-greens.user.v1', '{not-valid-json');

    await expect(readStoredUserStrict()).rejects.toMatchObject({
      name: 'StoredUserCorruptError',
    });
    await expect(getStoredUser()).rejects.toMatchObject({
      name: 'StoredUserCorruptError',
    });
  });

  test('unreadable identity storage fails closed', async () => {
    const error = new Error('identity read failed');
    asyncStorageState.failNext('getItem', error);

    await expect(readStoredUserStrict()).rejects.toBe(error);
  });

  test('updating the same user id preserves identity while refreshing editable fields', async () => {
    await setStoredUser({
      id: 'user-a',
      provider: 'apple',
      displayName: 'Alice Example',
      email: 'alice@example.com',
      initials: 'AE',
      avatarUri: 'file:///documents/avatar-a.png',
      signedInAt: 123,
    });

    await expect(
      updateStoredUserProfile('user-a', {
        displayName: 'Alice Z Example',
      }),
    ).resolves.toMatchObject({
      id: 'user-a',
      provider: 'apple',
      displayName: 'Alice Z Example',
      email: 'alice@example.com',
      initials: 'AE',
      avatarUri: 'file:///documents/avatar-a.png',
      signedInAt: 123,
    });
  });
});
