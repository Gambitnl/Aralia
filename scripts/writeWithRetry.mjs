// WF-G235 / WF-G301: patch/codegen scripts on the Windows shared checkout can
// lose a write-open race with Vite and receive UNKNOWN errno -4094 or EBUSY.
// Retry only those transient errors; every other failure stays visible.
import { writeFile as nodeWriteFile } from 'node:fs/promises';

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
