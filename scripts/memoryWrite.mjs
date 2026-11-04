/**
 * @file scripts/memoryWrite.mjs
 * Hash-checked (optimistic) writes for the shared agent memory store.
 *
 * What this file does:
 * 1. `readMemory(file)` returns the text and its sha256 digest.
 * 2. `writeMemoryIfUnchanged(file, expectedHash, text)` writes ONLY if the file
 *    still hashes to what the caller read. Otherwise it throws
 *    `MemoryConflictError` so the caller re-reads and retries.
 * 3. `updateMemory(file, mutate)` is the safe read-modify-write loop: read, mutate,
 *    write-if-unchanged, retry on conflict.
 *
 * Why it exists:
 * The memory store (`~/.claude/projects/<project>/memory/`) sits OUTSIDE the git
 * checkout, so Agora's WF-G260 lock digest cannot protect it — yet every
 * concurrent Claude session reads and writes it. This mirrors the production
 * rule from Anthropic's memory talk: hash, draft, re-hash; on a mismatch, re-pull
 * and retry. A lost write on a memory file silently erases another session's
 * learning, so a conflict must be loud, never swallowed.
 *
 * What is preserved: plain Markdown memory files; no format change. The Windows
 * write-handle retry comes from the existing `writeWithRetry` helper.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { writeFileWithRetry } from './writeWithRetry.mjs';

/** sha256 hex of a UTF-8 string. */
export const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/** Read a memory file. A missing file reads as empty text with the empty-string hash. */
export async function readMemory(file) {
  let text = '';
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return { text, hash: sha256(text) };
}

export class MemoryConflictError extends Error {
  constructor(file, expected, actual) {
    super(`memory conflict on ${file}: expected ${expected.slice(0, 12)}, found ${actual.slice(0, 12)} — re-read and retry`);
    this.name = 'MemoryConflictError';
    this.file = file;
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Write `newText` only if `file` still hashes to `expectedHash`.
 * Re-hashes after the write to detect a write that landed during ours.
 * Returns `{ attempts, hash }`; throws MemoryConflictError on any mismatch.
 */
export async function writeMemoryIfUnchanged(file, expectedHash, newText) {
  const { hash: current } = await readMemory(file);
  if (current !== expectedHash) throw new MemoryConflictError(file, expectedHash, current);
  const attempts = await writeFileWithRetry(file, newText);
  const wanted = sha256(newText);
  const { hash: after } = await readMemory(file);
  if (after !== wanted) throw new MemoryConflictError(file, wanted, after);
  return { attempts, hash: after };
}

/**
 * Safe read-modify-write. `mutate(text)` returns the new text (may be async).
 * Retries the whole loop on a conflict, up to `retries` times.
 * Returns `{ changed, hash, attempts?, retriesUsed }`.
 */
export async function updateMemory(file, mutate, { retries = 5 } = {}) {
  for (let i = 0; ; i++) {
    const { text, hash } = await readMemory(file);
    const next = await mutate(text);
    if (next === text) return { changed: false, hash, retriesUsed: i };
    try {
      const result = await writeMemoryIfUnchanged(file, hash, next);
      return { changed: true, ...result, retriesUsed: i };
    } catch (error) {
      if (!(error instanceof MemoryConflictError) || i >= retries) throw error;
    }
  }
}

// --- tiny CLI -------------------------------------------------------------
//   node scripts/memoryWrite.mjs hash <file>
//   node scripts/memoryWrite.mjs write <file> --expect <sha256> --from <textfile>
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, file, ...rest] = process.argv.slice(2);
  const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  if (cmd === 'hash' && file) {
    const { hash } = await readMemory(file);
    console.log(hash);
  } else if (cmd === 'write' && file && flag('--expect') && flag('--from')) {
    const text = await readFile(flag('--from'), 'utf8');
    try {
      const r = await writeMemoryIfUnchanged(file, flag('--expect'), text);
      console.log(`wrote ${file} (attempts ${r.attempts}) hash ${r.hash}`);
    } catch (error) {
      console.error(error.message);
      process.exit(error instanceof MemoryConflictError ? 3 : 1);
    }
  } else {
    console.error('usage: memoryWrite.mjs hash <file> | write <file> --expect <sha256> --from <textfile>');
    process.exit(2);
  }
}
