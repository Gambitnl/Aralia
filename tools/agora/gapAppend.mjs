// tools/agora/gapAppend.mjs
// WF-G113: daemon-backed gap intake — allocate the next gap id for a registry
// and append EXACTLY ONE row to it.
//
// WHY this exists. `docs/projects/GLOBAL_GAPS.md` was the hottest lock on the
// 2026-09-09 board: every worker owed it a one-row append, gap ids raced under
// concurrency (GG-126/130/131 and GG-140/141 vs 144/145 collided), Windows
// threw EBUSY mid-write, and three-hour locks held for a single row blocked six
// workers who then routed their rows through the orchestrator by hand. The
// intake the coordination contract mandates was the one thing workers could not
// reliably do.
//
// WHAT is preserved. Nothing here rewrites an existing row, reorders a table,
// or reformats a file. The append reads the registry's OWN header to decide
// which cell each value goes in (column order differs per project), keeps the
// file's existing EOL (GLOBAL_GAPS.md is CRLF in the worktree, WORKFLOW_GAPS.md
// is LF), and inserts one line after the last data row of the FIRST registry
// table — the "Resolved" archive tables below it are never touched.
//
// The column mapping is gapIndex.mjs's, imported rather than re-declared, so a
// writer and a reader can never drift apart. Columns gapIndex does not name
// (Why it matters, Next proof, Date, Notes, and GLOBAL_GAPS.md's routing
// columns) are matched here by the same loose header rule.
//
// Serialization is the CALLER's job: server.mjs holds a single in-process
// promise chain around this module so two concurrent POST /gaps requests
// allocate different ids. No Agora file lock is involved — the point of the
// gap is that a worker should not need one for a one-row append.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitRow, isDividerRow, mapColumns, normHeader } from './gapIndex.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

// ---------------------------------------------------------------------------
// WF-G206 / WF-G180: transient open failures on Windows.
//
// On this host an open() of a repo file fails at RANDOM with UNKNOWN (libuv
// errno -4094), EBUSY, EPERM or EACCES while another process holds a
// short-lived handle on it — the dashboard polling the registry, an editor, or
// a virus scanner. Measured bursts last up to about 1.5 s and the identical
// call then succeeds. See the memory note windows-atomic-write-blocked-by-
// serving: the chokidar watcher is NOT the holder, so ignoring the path in a
// watcher changes nothing; retrying is the fix.
//
// The budget rides out about 1.4 s. It is deliberately SHORTER than
// sync-surfaces.mjs's 10 s budget, because this code runs inside the daemon's
// event loop and a longer block would stall every other agent's request.
const OPEN_ATTEMPTS = 8;
const OPEN_BACKOFF_MS = 50;
const OPEN_BACKOFF_CAP_MS = 400;
const TRANSIENT_OPEN_CODES = new Set(['UNKNOWN', 'EBUSY', 'EPERM', 'EACCES', 'EMFILE', 'EAGAIN']);

/** Block the thread. Atomics rather than a spin loop: a spin burns a core
 *  competing with the very reader that must finish before the write can land. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function likelyHolderAdvice(file) {
  return `another process is holding ${path.basename(file)} open — the Agora dashboard polling the registry, an editor, or a virus scanner. Retry the command; it usually lands on the next attempt.`;
}

/**
 * Run one file operation, retrying a TRANSIENT open failure with backoff.
 * A non-transient error (ENOENT, a parse fault) is thrown at once, unchanged.
 * When the budget runs out the error NAMES the file, the errno and the likely
 * holder instead of the bare "UNKNOWN: unknown error" the daemon used to
 * return.
 */
export function withOpenRetry(file, fn, { attempts = OPEN_ATTEMPTS, sleep = sleepSync } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return fn();
    } catch (e) {
      if (!TRANSIENT_OPEN_CODES.has(e?.code)) throw e;
      lastError = e;
      if (attempt < attempts) sleep(Math.min(OPEN_BACKOFF_CAP_MS, OPEN_BACKOFF_MS * attempt));
    }
  }
  const err = new Error(
    `${file}: ${lastError.code} after ${attempts} attempts over ~1.4s — ${likelyHolderAdvice(file)}`,
  );
  err.code = lastError.code;
  err.transient = true;
  err.attempts = attempts;
  throw err;
}

const readRegistry = (file) => withOpenRetry(file, () => fs.readFileSync(file, 'utf8'));
const writeRegistry = (file, text) => withOpenRetry(file, () => fs.writeFileSync(file, text));

// Columns the gap registries carry that gapIndex.mjs has no reader for. They
// are matched with the same normalize-then-prefix rule so header spellings
// ("Next proof" vs "Next proof/check") all land.
const EXTRA_COLUMN_KEYS = [
  { key: 'whyItMatters', match: ['whyitmatters', 'why'] },
  { key: 'nextProof', match: ['nextproof', 'proof'] },
  { key: 'date', match: ['date'] },
  { key: 'notes', match: ['notes', 'note'] },
  { key: 'detectedDuring', match: ['detectedduring'] },
  { key: 'suspectedOwner', match: ['suspectedowner'] },
  { key: 'routingDecision', match: ['routingdecision'] },
  { key: 'destination', match: ['destination'] },
];

/**
 * Full column map for ONE registry header row: gapIndex's mapping first (so a
 * shared column always resolves identically), then the write-only extras for
 * any cell gapIndex left unclaimed.
 */
export function mapAllColumns(headerCells) {
  const cols = mapColumns(headerCells);
  const taken = new Set(Object.values(cols));
  headerCells.forEach((cell, i) => {
    if (taken.has(i)) return;
    const n = normHeader(cell);
    if (!n) return;
    for (const { key, match } of EXTRA_COLUMN_KEYS) {
      if (cols[key] !== undefined) continue;
      if (match.some((m) => n === m || n.startsWith(m))) {
        cols[key] = i;
        taken.add(i);
        break;
      }
    }
  });
  return cols;
}

/** Which physical file holds a project's gap registry. */
export function resolveGapsFile(project, repoRoot = REPO_ROOT) {
  const p = String(project || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!p) throw new Error('project is required (e.g. "global", "workflow", "spells")');
  // 'workflow' is the documented project name for the workflow registry, which
  // does not live under docs/projects at all (gapIndex.mjs tags it the same way).
  if (p === 'workflow') return path.join(repoRoot, 'tools', 'agora', 'WORKFLOW_GAPS.md');
  if (p === 'global' || p === 'GLOBAL') return path.join(repoRoot, 'docs', 'projects', 'GLOBAL_GAPS.md');
  const candidate = path.join(repoRoot, 'docs', 'projects', p, 'GAPS.md');
  if (!fs.existsSync(candidate)) {
    throw new Error(`no gap registry for project "${p}" (looked for docs/projects/${p}/GAPS.md)`);
  }
  return candidate;
}

/** The file's dominant EOL. A file with any CRLF is treated as a CRLF file. */
export function detectEol(raw) {
  return /\r\n/.test(raw) ? '\r\n' : '\n';
}

/**
 * Locate the FIRST registry table: its header index, column map, cell count,
 * every data-row index, and the index of the divider under the header.
 *
 * Blank lines INSIDE the table are bridged exactly as
 * gapIndex.parseGapsMarkdownWithWarnings bridges them (WF-G84): GLOBAL_GAPS.md
 * really does carry a blank line between GG-27 and GG-28, and a writer that
 * stopped there would mint an id 100+ numbers behind the rows below it.
 */
export function findRegistryTable(lines) {
  let headerIndex = -1;
  let cols = null;
  let colCount = 0;
  let dividerIndex = -1;
  const rowIndexes = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isRow = /^\s*\|/.test(line) && line.includes('|');
    if (!isRow) {
      if (!cols) continue;
      // Look past blank lines: a data row with the same cell count and no new
      // header is the SAME table, split by accident.
      let j = i;
      while (j < lines.length && lines[j].trim() === '') j++;
      const next = j < lines.length ? lines[j] : '';
      const nextIsRow = /^\s*\|/.test(next) && next.includes('|');
      if (j > i && nextIsRow) {
        const nextCells = splitRow(next);
        const nextHeader = mapColumns(nextCells);
        const looksLikeHeader = nextHeader.id !== undefined && nextHeader.status !== undefined;
        if (!looksLikeHeader && !isDividerRow(nextCells) && nextCells.length === colCount) {
          i = j - 1;
          continue;
        }
      }
      break; // the registry table ended — later tables are archives, never touched
    }
    const cells = splitRow(line);
    if (!cols) {
      const candidate = mapColumns(cells);
      if (candidate.id !== undefined && candidate.status !== undefined) {
        cols = mapAllColumns(cells);
        headerIndex = i;
        colCount = cells.length;
      }
      continue;
    }
    if (isDividerRow(cells)) { if (dividerIndex < 0) dividerIndex = i; continue; }
    rowIndexes.push(i);
  }
  if (!cols) return null;
  return { headerIndex, dividerIndex, cols, colCount, rowIndexes };
}

/**
 * The id prefix and next free number for a registry.
 *
 * The YAML header wins when it declares `id_prefix` / `next_free_id`
 * (WORKFLOW_GAPS.md does). Otherwise both are derived from the rows that exist
 * (GLOBAL_GAPS.md has no frontmatter): the prefix is the most common one and
 * the number is max + 1, so a hand-filed row is never overwritten.
 */
export function nextGapId(raw, rows) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  let prefix = '';
  let declaredNext = null;
  if (fm) {
    const pm = /^id_prefix:\s*["']?([A-Za-z][A-Za-z0-9_-]*?)["']?\s*$/m.exec(fm[1]);
    if (pm) prefix = pm[1];
    const nm = /^next_free_id:\s*["']?([A-Za-z][A-Za-z0-9_-]*?)(\d+)["']?\s*$/m.exec(fm[1]);
    if (nm) { prefix = prefix || nm[1]; declaredNext = Number(nm[2]); }
  }
  let maxSeen = 0;
  const prefixCounts = new Map();
  for (const id of rows) {
    const m = /^([A-Za-z][A-Za-z0-9_-]*?)(\d+)$/.exec(String(id).trim());
    if (!m) continue;
    prefixCounts.set(m[1], (prefixCounts.get(m[1]) || 0) + 1);
    if (!prefix || m[1] === prefix) maxSeen = Math.max(maxSeen, Number(m[2]));
  }
  if (!prefix && prefixCounts.size) {
    prefix = [...prefixCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    for (const id of rows) {
      const m = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$').exec(String(id).trim());
      if (m) maxSeen = Math.max(maxSeen, Number(m[1]));
    }
  }
  if (!prefix) throw new Error('cannot determine a gap id prefix for this registry');
  // The declared next_free_id is authoritative only while it is ahead of the
  // rows already filed; a stale header must never mint a duplicate id.
  const number = Math.max(declaredNext ?? 0, maxSeen + 1);
  return { id: `${prefix}${number}`, prefix, number };
}

/**
 * Every gap id filed anywhere in the file (WF-G123). The first table's id
 * column is read exactly; for every other table row the first three cells
 * are scanned, because the archive tables below do not share a column order
 * with the registry table and an id is never further right than that.
 */
export function allGapIds(lines, idColumn = 0) {
  const ids = [];
  const idShape = /^[A-Za-z][A-Za-z0-9_-]*?\d+$/;
  for (const line of lines) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = splitRow(line);
    if (isDividerRow(cells)) continue;
    const candidates = [cells[idColumn], ...cells.slice(0, 3)];
    for (const c of candidates) {
      const t = String(c || '').trim();
      if (idShape.test(t)) { ids.push(t); break; }
    }
  }
  return ids;
}

/** A cell may not contain a raw pipe or newline — either would break the table. */
function cellText(value, fallback = '—') {
  const s = String(value ?? '').replace(/\r?\n+/g, ' ').replace(/\|/g, '&#124;').trim();
  return s || fallback;
}

/**
 * Append one row to a project's gap registry and return the id it was given.
 *
 * `values` carries the row's content by COLUMN KEY (gap, evidence, whyItMatters,
 * nextAction, nextProof, severity, classification, surface, suggestedAgent,
 * registeredBy, registrantAgentId, registrantTaskId, notes, ...). Anything the
 * registry has a column for but the caller did not supply is filled with the
 * registry convention's em dash, never left blank — a blank cell silently
 * shifts every later column when a row is re-split.
 */
export function appendGapRow(file, values = {}, { repoRoot = REPO_ROOT } = {}) {
  const raw = readRegistry(file);
  const eol = detectEol(raw);
  // Split on either EOL and re-join on the file's own, so every untouched line
  // comes back byte-identical and a CRLF registry stays CRLF.
  const lines = raw.split(/\r?\n/);
  const table = findRegistryTable(lines);
  if (!table) throw new Error(`no gap registry table found in ${file}`);
  const { cols, colCount, rowIndexes, dividerIndex, headerIndex } = table;

  // WF-G123 (2026-09-09): the allocator used to read ids from the FIRST table
  // only. GLOBAL_GAPS.md keeps a second "untriaged" table below it whose rows
  // (GG-146..GG-163) were filed by hand, so `gap add` minted GG-146, GG-147,
  // GG-148 and GG-163 a second time. Every id-shaped cell in every table of
  // the file now counts, so the next number is ahead of ALL rows, whichever
  // table holds them.
  const existingIds = allGapIds(lines, cols.id);
  const { id, number } = nextGapId(raw, existingIds);

  const today = values.date || new Date().toISOString().slice(0, 10);
  const byKey = {
    ...values,
    id,
    status: values.status || 'open',
    date: today,
    // GLOBAL_GAPS.md routes rather than classifies. A row filed by a worker
    // that named no destination is being surfaced in place, which is the
    // honest default for the file whose whole purpose is surfacing.
    // The repo-relative path of THIS registry. `repoRoot` is a parameter
    // because a test (and the daemon under test) works against a fixture
    // root on another drive, where path.relative to the real repo returns an
    // absolute path and the cell becomes a machine-specific string.
    destination: values.destination || path.relative(repoRoot, file).split(path.sep).join('/'),
  };

  const cells = new Array(colCount).fill('—');
  for (const [key, index] of Object.entries(cols)) {
    if (index === undefined || index >= colCount) continue;
    cells[index] = cellText(byKey[key]);
  }
  const row = `| ${cells.join(' | ')} |`;

  // Each registry keeps its own row order and the append must not fight it:
  // WORKFLOW_GAPS.md files newest LAST, GLOBAL_GAPS.md files newest FIRST. The
  // direction is read from the rows themselves rather than hard-coded per file.
  const idNumber = (i) => {
    const m = /(\d+)$/.exec((splitRow(lines[i])[cols.id] || '').trim());
    return m ? Number(m[1]) : null;
  };
  const first = rowIndexes.length ? idNumber(rowIndexes[0]) : null;
  const last = rowIndexes.length ? idNumber(rowIndexes[rowIndexes.length - 1]) : null;
  const newestFirst = first !== null && last !== null && first > last;
  const at = rowIndexes.length
    ? (newestFirst ? rowIndexes[0] : rowIndexes[rowIndexes.length - 1] + 1)
    : (dividerIndex >= 0 ? dividerIndex + 1 : headerIndex + 1);
  lines.splice(at, 0, row);

  let out = lines.join(eol);
  // Keep the declared next_free_id ahead of the row just filed, so a later
  // hand-authored row (which reads the header, not the table) cannot collide.
  out = out.replace(
    /^(next_free_id:\s*)["']?([A-Za-z][A-Za-z0-9_-]*?)\d+["']?\s*$/m,
    (_m, head, prefix) => `${head}${prefix}${number + 1}`,
  );
  writeRegistry(file, out);
  return { id, file, row, line: at + 1 };
}

// Cells `gap update` may rewrite. Provenance (registeredBy, registrant ids) and
// the id itself are never on this list: a repair must not launder who filed it.
const UPDATABLE_KEYS = [
  'status', 'severity', 'classification', 'surface', 'suggestedAgent',
  'gap', 'evidence', 'whyItMatters', 'nextAction', 'nextProof', 'notes',
  'detectedDuring', 'suspectedOwner', 'routingDecision', 'destination',
];

/**
 * WF-G124 (2026-09-09): rewrite the named cells of ONE existing row, in
 * whichever table of the file holds it, and leave every other byte alone.
 *
 * `gap add` gave workers a lock-free append; a worker who then had to repair,
 * renumber or resolve its own row still had to take the hot registry lock and
 * hand-edit a 16-column line. This is the matching lock-free edit. Each table
 * is read with its OWN header, because the archive tables below the registry
 * do not share the registry's column order.
 *
 * `patch.note` APPENDS to the Notes cell ("; "-joined) so a repair never
 * erases the history a row carries; `patch.notes` replaces the cell outright.
 */
export function updateGapRow(file, id, patch = {}) {
  const wanted = String(id || '').trim();
  if (!wanted) throw new Error('gap id is required');
  const raw = readRegistry(file);
  const eol = detectEol(raw);
  const lines = raw.split(/\r?\n/);
  let cols = null;
  let colCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s*\|/.test(line)) continue;
    const cells = splitRow(line);
    if (isDividerRow(cells)) continue;
    const header = mapColumns(cells);
    if (header.id !== undefined && header.status !== undefined) {
      cols = mapAllColumns(cells);
      colCount = cells.length;
      continue;
    }
    if (!cols) continue;
    if ((cells[cols.id] || '').trim() !== wanted) continue;
    const changed = [];
    for (const key of UPDATABLE_KEYS) {
      if (patch[key] === undefined || patch[key] === null) continue;
      const index = cols[key];
      if (index === undefined || index >= colCount) {
        throw new Error(`this registry has no "${key}" column`);
      }
      cells[index] = cellText(patch[key]);
      changed.push(key);
    }
    if (patch.note !== undefined && patch.notes === undefined) {
      // GLOBAL_GAPS.md has no Notes column; its convention puts the closing
      // note in Next action ("RESOLVED <date> by <who>: ..."), so fall back there.
      const index = cols.notes ?? cols.nextAction;
      if (index === undefined) throw new Error('this registry has no Notes or Next action column');
      const prior = (cells[index] || '').trim();
      const clean = cellText(patch.note, '');
      cells[index] = prior && prior !== '—' ? `${prior}; ${clean}` : cellText(clean);
      changed.push('note');
    }
    if (!changed.length) throw new Error('nothing to update: name at least one cell');
    while (cells.length < colCount) cells.push('—');
    const row = `| ${cells.join(' | ')} |`;
    lines[i] = row;
    writeRegistry(file, lines.join(eol));
    return { id: wanted, file, row, line: i + 1, changed };
  }
  throw new Error(`no row with id ${wanted} in ${path.basename(file)}`);
}
