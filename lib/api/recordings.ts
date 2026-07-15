// Fresh Greens — recordings adapter.
//
// Persistent local store for audio recordings captured during the
// /pulled-over safety flow. Same architectural shape as user.ts /
// trusted-contact.ts / preferences.ts: typed `Recording`, async public
// surface, AsyncStorage-backed metadata, backend-swap point preserved.
//
// Two layers of storage:
//   1. The audio file itself, in the device's documents directory
//      (persistent across cold starts, unlike expo-audio's default
//      cache-directory writes which get cleaned up).
//   2. Metadata in AsyncStorage (id, uri, timestamp, duration, armed
//      answer) — the queryable index that drives /recordings list.
//
// `addRecording` accepts the temp URI from expo-audio's recorder and
// copies the file into Paths.document/recordings/ before persisting
// the metadata. `removeRecording` deletes both halves.
//
// Uses expo-file-system v19's class-based API (File / Directory /
// Paths). Most file ops are synchronous in v19 — the public surface
// here stays async because metadata still goes through AsyncStorage,
// and an async signature is friendlier for any future backend swap.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const STORAGE_KEY = 'fresh-greens.recordings.v1';

export type ArmedAnswer = 'yes' | 'no' | 'preferred-not-to-answer';

/**
 * A single recording's metadata. The audio file lives at `uri` on
 * disk; this object is what's stored in AsyncStorage and listed in
 * the /recordings UI.
 */
export type Recording = {
  /** Stable ID (used as React keys, AsyncStorage shape). */
  id: string;
  /** File URI in the documents directory — persists across sessions. */
  uri: string;
  /** ms timestamp of when the recording started. */
  createdAt: number;
  /** Total duration in milliseconds. */
  durationMs: number;
  /** Armed-state context the recording was made in (null if unset). */
  armed: ArmedAnswer | null;
};

export type AddRecordingInput = {
  sourceUri: string;
  durationMs: number;
  armed: ArmedAnswer | null;
  createdAt?: number;
};

// Lazy getter — `Paths.document` reads native state, so we resolve
// it on first use rather than at module load.
function getRecordingsDirectory(): Directory {
  return new Directory(Paths.document, 'recordings');
}

// --- Public surface ------------------------------------------------------

/** Reads all stored recordings, newest first. */
export async function getRecordings(): Promise<Recording[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Recording[];
    if (!Array.isArray(parsed)) return [];
    // Sort newest first — matches typical "library" UX expectation.
    return parsed.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.warn('getRecordings failed', err);
    return [];
  }
}

/**
 * Persists a new recording. Copies the file from its source URI
 * (typically expo-audio's cache location) into the documents
 * directory so it survives across cold starts, then stores the
 * metadata pointing at the new persistent path.
 *
 * Returns the persisted Recording. Throws if the file copy fails —
 * caller should handle (typically: warn and skip metadata save so
 * we don't leave dangling pointers).
 */
export async function addRecording(input: AddRecordingInput): Promise<Recording> {
  const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = input.createdAt ?? Date.now();

  // Ensure the recordings directory exists. `idempotent: true` makes
  // the call a no-op if it's already there, no try/catch needed.
  const recordingsDir = getRecordingsDirectory();
  recordingsDir.create({ intermediates: true, idempotent: true });

  // Copy the source recording into our persistent location.
  const sourceFile = new File(input.sourceUri);
  const destFile = new File(recordingsDir, `${id}.m4a`);
  sourceFile.copy(destFile);

  const recording: Recording = {
    id,
    uri: destFile.uri,
    createdAt,
    durationMs: input.durationMs,
    armed: input.armed,
  };

  try {
    const existing = await getRecordings();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([recording, ...existing]),
    );
  } catch (error) {
    // Metadata is the commit boundary. Preserve the retryable source and
    // best-effort remove the unindexed destination if the commit fails.
    try {
      destFile.delete();
    } catch {
      /* noop */
    }
    throw error;
  }

  // Metadata now points at the persistent destination. Temp-source cleanup
  // is post-commit and must not turn a successful save into a reported error.
  try {
    sourceFile.delete();
  } catch {
    /* noop */
  }
  return recording;
}

/**
 * Deletes a recording's file and its metadata entry. Both halves
 * are removed in sequence; if the file delete fails we still
 * remove the metadata so the user doesn't see a "ghost" entry.
 */
export async function removeRecording(id: string): Promise<void> {
  const all = await getRecordings();
  const target = all.find((r) => r.id === id);
  if (!target) return;

  try {
    const file = new File(target.uri);
    if (file.exists) file.delete();
  } catch (err) {
    console.warn('Failed to delete recording file', target.uri, err);
  }

  const remaining = all.filter((r) => r.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

/** Removes all stored recordings (sign-out cleanup, factory reset). */
export async function clearAllRecordings(): Promise<void> {
  const all = await getRecordings();
  for (const r of all) {
    try {
      const file = new File(r.uri);
      if (file.exists) file.delete();
    } catch {
      /* noop */
    }
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
}
