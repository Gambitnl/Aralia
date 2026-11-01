/**
 * @file scripts/writeWithRetry.mjs
 * Shared Node.js file-write helper for the Windows shared checkout.
 *
 * What this file does:
 * 1. Retries transient Windows write-open races (`UNKNOWN` errno `-4094` and
 *    `EBUSY`) via `writeFileWithRetry` while surfacing all other errors
 *    immediately.
 * 2. Provides `writeFilesWithRetry` for multi-file patch scripts so a failure
 *    partway through a batch rolls back earlier writes in the same batch
 *    rather than leaving the working tree half-patched (WF-G329).
 *
 * Why it exists:
 * A concurrent watcher (such as the Vite dev server or OS indexer) can briefly
 * hold a file handle on Windows while an agent script writes a locked path.
 */
import {
  readFile as nodeReadFile,
  rm as nodeRm,
  writeFile as nodeWriteFile,
} from 'node:fs/promises';

/**
 * Return true only for transient Windows file-handle contention errors
 * (`EBUSY` or `UNKNOWN` with `errno === -4094`).
 */
export function isTransientWriteError(error) {
  return error?.code === 'EBUSY'
    || (error?.code === 'UNKNOWN' && Number(error.errno) === -4094);
}

/**
 * Write a complete replacement for one path, with a bounded Windows retry.
 * Returns the number of attempts used so callers can report a recovered race.
 * The injectable writer/wait are for tests; ordinary callers need only file/data.
 */
export async function writeFileWithRetry(file, data, {
  attempts = 20,
  delayMs = 300,
  writeFile = nodeWriteFile,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  if (!Number.isInteger(attempts) || attempts < 1) throw new RangeError('attempts must be a positive integer');
  if (!Number.isInteger(delayMs) || delayMs < 0) throw new RangeError('delayMs must be a nonnegative integer');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await writeFile(file, data);
      return attempt;
    } catch (error) {
      if (!isTransientWriteError(error) || attempt === attempts) throw error;
      await wait(delayMs);
    }
  }
}

/**
 * Normalize a batch input (Array of `[file, data]` tuples, Array of
 * `{ file, data }` objects, or plain Record) into `Array<{ file, data }>`.
 */
function normalizeBatchEntries(entries) {
  if (Array.isArray(entries)) {
    return entries.map((entry) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        return { file: entry[0], data: entry[1] };
      }
      if (entry && typeof entry === 'object' && typeof entry.file === 'string') {
        return { file: entry.file, data: entry.data };
      }
      throw new TypeError('Each batch entry must be [file, data] or { file, data }');
    });
  }
  if (entries && typeof entries === 'object') {
    return Object.entries(entries).map(([file, data]) => ({ file, data }));
  }
  throw new TypeError('entries must be an array or object of file writes');
}

/**
 * Write multiple files sequentially with `writeFileWithRetry` and roll back
 * already-written files in the batch if a subsequent write fails (WF-G329).
 * Returns `{ attemptsByFile, totalAttempts }`.
 */
export async function writeFilesWithRetry(entries, {
  attempts = 20,
  delayMs = 300,
  readFile = nodeReadFile,
  writeFile = nodeWriteFile,
  removeFile = (target) => nodeRm(target, { force: true }),
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const normalized = normalizeBatchEntries(entries);
  const snapshots = [];

  for (const { file } of normalized) {
    try {
      const prior = await readFile(file);
      snapshots.push({ file, existed: true, prior });
    } catch (error) {
      if (error?.code === 'ENOENT') {
        snapshots.push({ file, existed: false, prior: null });
      } else {
        throw error;
      }
    }
  }

  const attemptsByFile = {};
  let totalAttempts = 0;
  const completedSnapshots = [];

  try {
    for (let index = 0; index < normalized.length; index++) {
      const { file, data } = normalized[index];
      const used = await writeFileWithRetry(file, data, {
        attempts,
        delayMs,
        writeFile,
        wait,
      });
      attemptsByFile[file] = used;
      totalAttempts += used;
      completedSnapshots.push(snapshots[index]);
    }
    return { attemptsByFile, totalAttempts };
  } catch (writeError) {
    // Roll back completed writes in reverse order so a multi-file patch never
    // leaves the checkout half-applied when a later file fails.
    for (let index = completedSnapshots.length - 1; index >= 0; index--) {
      const snap = completedSnapshots[index];
      if (snap.existed) {
        await writeFileWithRetry(snap.file, snap.prior, {
          attempts,
          delayMs,
          writeFile,
          wait,
        });
      } else {
        await removeFile(snap.file);
      }
    }
    throw writeError;
  }
}
