// tools/agora/taskLint.mjs
// WF-G111 (tooling half): a freshness check for a board task BODY, so an
// orchestrator can run it before dispatch instead of a worker discovering it
// mid-packet.
//
// WHY. On 2026-09-09, 14 of 40 expanded phase-2 task bodies were stale or wrong
// about the code: they named files that do not exist, invented action names
// (`TOGGLE_LEDGER_BOOK` never existed), and described systems that had already
// shipped. Workers spent up to a third of each packet proving a negative. Every
// one of those defects is mechanically detectable from the body text alone.
//
// WHAT it checks:
//   1. Every path-shaped token in the title/body/refs that is not a file or
//      directory in the checkout. Paths that DO exist but are gitignored are
//      reported separately as a note, not a defect — `git ls-files` cannot see
//      them, so a reader who greps the index would otherwise call them missing
//      (this is the real GG-145 case: PreviewTown3D.tsx exists and is ignored).
//   2. Every backticked code identifier that does not appear anywhere under
//      `src/`. An identifier a worker cannot grep is an identifier that does
//      not exist, or lives outside the tree the task points at.
//   3. Bare file names without directories (WF-G158).
//   4. Missing test paths with split file candidate detection (WF-G167):
//      vitest treats non-existent test paths as empty filters and exits 0!
//   5. Suspect missing-schema claims (WF-G165): claims that a schema is missing
//      or needs to be added when it already exists in `src/types/**`.
//   6. Unresolved type field claims (WF-G161): claims that specific fields come
//      from a type file that does not contain those fields.
//
// It NEVER refuses or rewrites a task: a body may legitimately name a file the
// task will create, or an identifier it will introduce. The output is evidence
// for a human or orchestrator decision.
//
// The filesystem and grep are injected, so the tests run without git.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

// A path-shaped token: at least one slash, no glob characters, and either a
// file extension or a top-level directory this repo actually has. The same
// shape client.mjs's WF-G81 ref check uses, widened to free body text.
const TOP_DIRS = /^(src|tools|docs|public|scripts|tests|misc|conductor|\.agent|\.claude)\//;

/**
 * Strip markdown/prose punctuation that clings to a token in a sentence.
 *
 * Underscore is deliberately NOT stripped: `__tests__` is a real directory name
 * here, and trimming it turned `src/.../__tests__/x.test.ts` into a path that
 * does not exist, which the lint then reported as a defect of its own making.
 */
function trimToken(raw) {
  return String(raw)
    .replace(/^[(\[{'"`*]+/, '')
    .replace(/[)\]}'"`*,.;:!?]+$/, '');
}

/** Every distinct path-shaped token in a block of text, in first-seen order. */
export function extractPathTokens(text) {
  const out = [];
  const seen = new Set();
  for (const rawToken of String(text || '').split(/[\s|]+/)) {
    // Glob and placeholder characters are checked on the RAW token: trimming a
    // trailing '*' first would turn `src/a/**` into a plausible-looking path.
    if (/[*?<>]/.test(rawToken)) continue;
    // Directory refs often end in '/', and Windows-authored packets may use
    // backslashes. Normalize both before deciding whether the path exists.
    const token = trimToken(rawToken).replace(/\\/g, '/').replace(/\/+$/, '');
    if (!token || !token.includes('/')) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(token)) continue; // planmap:, https:, workflow:
    if (!/^[A-Za-z0-9_.@-]+(\/[A-Za-z0-9_.@-]+)+$/.test(token)) continue;
    if (!/\.[A-Za-z0-9]{1,8}$/.test(token) && !TOP_DIRS.test(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

/**
 * Every distinct backticked CODE IDENTIFIER in a block of text.
 *
 * Deliberately conservative: a backticked English word ("`open`", "`done`") is
 * not an identifier claim, so an identifier must carry an uppercase letter or
 * an underscore — the shape of a constant, a type, a component or a camelCase
 * function. A trailing `()` is stripped. Path-shaped spans are left to the path
 * check above.
 */
export function extractBacktickedIdentifiers(text) {
  const out = [];
  const seen = new Set();
  const spans = String(text || '').match(/`[^`\n]+`/g) || [];
  for (const span of spans) {
    const inner = span.slice(1, -1).trim().replace(/\(\s*\)$/, '');
    if (!inner || inner.includes('/') || inner.includes(' ')) continue;
    // A dotted or member expression is checked by its LAST segment, which is
    // the name that has to exist somewhere in the source.
    const name = inner.split('.').pop();
    if (!/^[A-Za-z_$][A-Za-z0-9_$]{2,}$/.test(name)) continue;
    if (!/[A-Z_]/.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/** Default existence probe. */
function defaultExists(repoRoot, rel) {
  return fs.existsSync(path.resolve(repoRoot, rel));
}

/**
 * Default gitignore probe, batched: one `git check-ignore --stdin` for the
 * whole list rather than a process per path.
 */
export function defaultIgnoredPaths(repoRoot, paths) {
  if (!paths.length) return new Set();
  try {
    const r = spawnSync('git', ['-C', repoRoot, 'check-ignore', '--stdin'], {
      input: paths.join('\n'),
      encoding: 'utf8',
    });
    // exit 0 = some ignored, 1 = none ignored, 128 = not a repo. Only stdout matters.
    return new Set(String(r.stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** Default source grep: does this identifier appear anywhere under src/? */
export function defaultGrepSrc(repoRoot, name) {
  try {
    const r = spawnSync('git', ['-C', repoRoot, 'grep', '--no-index', '-l', '-F', '-e', name, '--', 'src'], {
      encoding: 'utf8',
    });
    return Boolean(String(r.stdout || '').trim());
  } catch {
    return true; // a broken grep must never manufacture a false "missing"
  }
}

/**
 * Every distinct BARE source file name in a block of text: `useTurnOrder.ts`,
 * `Foo.tsx`, `bar.mjs` with no directory. WF-G158 (2026-09-13): a task body
 * said "(same file or useTurnOrder.ts)" — no slash, so the path check never
 * saw it, and the file does not exist anywhere in the repo.
 */
export function extractBareFileNames(text) {
  const out = [];
  const seen = new Set();
  for (const rawToken of String(text || '').split(/[\s|(),;:]+/)) {
    const token = trimToken(rawToken).replace(/^`|`$/g, '');
    if (!token || token.includes('/') || token.includes('\\')) continue;
    if (!/^[A-Za-z0-9_.-]+\.(ts|tsx|mjs|cjs|js|jsx|json|md)$/.test(token)) continue;
    if (/^\.\w/.test(token)) continue; // ".ts" style fragments
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

/** Does any tracked or untracked (non-ignored) file in the repo carry this basename? */
export function defaultBasenameExists(repoRoot, name) {
  const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', `*/${name}`, name], {
    cwd: repoRoot, encoding: 'utf8',
  });
  return r.status === 0 && r.stdout.trim().length > 0;
}

// ---------------------------------------------------------------------------
// WF-G167: Missing test paths and split test candidates.
// vitest treats a non-existent test file as an empty filter rather than an
// error, silently reporting a green run without executing the intended tests.
// ---------------------------------------------------------------------------

/** Does this path token look like a test suite? */
export function isTestPath(pathStr) {
  return /\.(test|spec)\.[cm]?[jt]sx?$/i.test(pathStr) || pathStr.includes('/__tests__/') || pathStr.includes('\\__tests__\\');
}

/**
 * When a named test path is missing, check if its directory exists and holds
 * split test files (e.g. combatUtils_attack.test.ts instead of combatUtils.test.ts).
 */
export function defaultFindSplitCandidates(repoRoot, missingTestPath) {
  const norm = String(missingTestPath || '').replace(/\\/g, '/');
  const dir = path.resolve(repoRoot, path.dirname(norm));
  const base = path.basename(norm).replace(/\.(test|spec)\.[cm]?[jt]sx?$/i, '');
  if (!fs.existsSync(dir)) return [];
  try {
    const entries = fs.readdirSync(dir);
    return entries.filter((f) => {
      if (!isTestPath(f)) return false;
      return f.startsWith(`${base}_`) || f.startsWith(`${base}.`);
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// WF-G165: Missing schema assertion detector.
// Catches tasks claiming "no schema" or "add a schema for X" when type X is
// already defined under src/types/**, avoiding duplicate type creation.
// ---------------------------------------------------------------------------

export function extractSchemaClaims(text) {
  const claims = [];
  const seen = new Set();
  const patterns = [
    /(?:add(?: a)?|create|missing|no|needs?)\s+schema\s+(?:for\s+)?([A-Za-z0-9_$]+)/gi,
    /(?:schema\s+ors+handlers+(?:fors+)?)([A-Za-z0-9_$]+)/gi,
    /([A-Za-z0-9_$]+)(?::[^\s]*)?\s+(?:hass+nos+schema|nos+schemas+ors+handler)/gi,
  ];

  const stopWords = new Set(['in', 'for', 'a', 'the', 'and', 'or', 'to', 'of', 'with', 'from', 'this', 'that', 'no', 'schema']);

  for (const pat of patterns) {
    let match;
    while ((match = pat.exec(text)) !== null) {
      const typeName = match[1];
      if (!typeName || stopWords.has(typeName.toLowerCase()) || typeName.length < 3) continue;
      if (seen.has(typeName.toLowerCase())) continue;
      seen.add(typeName.toLowerCase());
      claims.push({ claim: match[0], typeName });
    }
  }
  return claims;
}

export function defaultGrepTypes(repoRoot, typeName) {
  try {
    const r = spawnSync('git', ['-C', repoRoot, 'grep', '--no-index', '-l', '-i', '-E', `(interface|type)\\s+${typeName}\\b|\\b${typeName}\\s*:`, '--', 'src/types'], {
      encoding: 'utf8',
    });
    if (r.status !== 0 && r.status !== 1) return [];
    return String(r.stdout || '')
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/\\/g, '/'))
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// WF-G161: Field and file contract resolution.
// Catches tasks prescribing named fields from a type/source file where that
// file does not actually declare or contain those fields.
// ---------------------------------------------------------------------------

export function extractTypeFieldClaims(text) {
  const claims = [];
  // Case 1: "(wealth, biome, dominant races from src/types/world.ts)"
  const pat1 = /\(([^)]+?)\s+from\s+([A-Za-z0-9_./-]+\.(?:ts|tsx))\)/gi;
  let match;
  while ((match = pat1.exec(text)) !== null) {
    const rawFields = match[1];
    const file = match[2];
    const fields = rawFields
      .split(/[,;\s]+/)
      .map((f) => f.trim().replace(/^[`'"]|[`'"]$/g, ''))
      .filter((f) => f && !['and', 'or', 'the', 'of', 'from', 'in', 'to', 'with'].includes(f.toLowerCase()));
    claims.push({ raw: match[0], file, fields });
  }

  // Case 2: "from src/types/world.ts (wealth, biome)"
  const pat2 = /from\s+([A-Za-z0-9_./-]+\.(?:ts|tsx))\s*\(([^)]+)\)/gi;
  while ((match = pat2.exec(text)) !== null) {
    const file = match[1];
    const rawFields = match[2];
    const fields = rawFields
      .split(/[,;\s]+/)
      .map((f) => f.trim().replace(/^[`'"]|[`'"]$/g, ''))
      .filter((f) => f && !['and', 'or', 'the', 'of', 'from', 'in', 'to', 'with'].includes(f.toLowerCase()));
    claims.push({ raw: match[0], file, fields });
  }

  return claims;
}

export function defaultCheckFileFields(repoRoot, relPath, fields) {
  const fullPath = path.resolve(repoRoot, relPath);
  if (!fs.existsSync(fullPath)) return [];
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    return fields.filter((field) => {
      const regex = new RegExp(`\\b${field}\\b`, 'i');
      return !regex.test(content);
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// WF-G191 / WF-G193: declared path markers.
//
// A task that CREATES a file must name that file, and a task whose whole point
// is "this cited path no longer exists" must name that path too. Until now the
// lint reported both as MISSING PATHS, so a correct task could never lint
// clean: agora-f821.10 opened with the words "CREATES (new file, does not exist
// yet, this task creates it)" and still exited 1, and agora-f821.26/34 had to
// be rewritten into prose that never names the path.
//
// The body now carries a machine-read marker per line:
//
//   CREATES: src/utils/visuals/conditionPalette.ts
//   EXPECTED-ABSENT: docs/projects/town/GAPS.md
//
// A CREATES path is moved out of MISSING PATHS into NEW PATHS, which is a
// NOTE, not a defect — unless the path already exists, which means the claim
// is stale and the task would overwrite work that has landed.
//
// An EXPECTED-ABSENT path is an ASSERTION the lint checks in reverse: absent
// is clean, PRESENT is the defect. That is the whole value of the marker — the
// day the file comes back, the doc-repair task fails its own lint.
//
// Several paths may share one marker line, separated by a comma or a space.
// The marker is case-insensitive and accepts the CREATE/CREATES and
// EXPECTED-ABSENT/ABSENT spellings.
// ---------------------------------------------------------------------------
const CREATES_MARKER = /^[ \t>*-]*(?:CREATES?|NEW FILES?)[^:\r\n]*:(.+)$/gim;
const ABSENT_MARKER = /^[ \t>*-]*(?:EXPECTED-ABSENT|ABSENT|DELETES?|REMOVES?)[^:\r\n]*:(.+)$/gim;

function markedPaths(text, pattern) {
  const out = [];
  const seen = new Set();
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(String(text || ''))) !== null) {
    for (const token of extractPathTokens(match[1])) {
      if (seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

/** Paths the body declares the task will CREATE (WF-G191). */
export function extractDeclaredCreates(text) {
  return markedPaths(text, CREATES_MARKER);
}

/** Paths the body asserts do NOT exist (WF-G193). */
export function extractDeclaredAbsent(text) {
  return markedPaths(text, ABSENT_MARKER);
}

export function lintTask(task = {}, {
  repoRoot = REPO_ROOT,
  fileExists = (rel) => defaultExists(repoRoot, rel),
  ignoredPaths = (paths) => defaultIgnoredPaths(repoRoot, paths),
  grepSrc = (name) => defaultGrepSrc(repoRoot, name),
  basenameExists = (name) => defaultBasenameExists(repoRoot, name),
  findSplitCandidates = (p) => defaultFindSplitCandidates(repoRoot, p),
  grepTypes = (name) => defaultGrepTypes(repoRoot, name),
  checkFileFields = (p, fields) => defaultCheckFileFields(repoRoot, p, fields),
} = {}) {
  const refs = Array.isArray(task.refs) ? task.refs : [];
  const text = [task.title || '', task.body || '', ...refs].join('\n');
  const paths = extractPathTokens(text);
  const identifiers = extractBacktickedIdentifiers(text);
  const fileNames = extractBareFileNames(text);

  // WF-G191 / WF-G193: the body may DECLARE what it creates and what it
  // asserts is absent. Those declarations change how a path is judged, so they
  // are read before the existence check, not bolted on after it.
  const declaredCreates = extractDeclaredCreates(text);
  const declaredAbsent = extractDeclaredAbsent(text);
  const declared = new Set([...declaredCreates, ...declaredAbsent]);

  const missingPaths = paths.filter((p) => !declared.has(p) && !fileExists(p));
  const presentPaths = paths.filter((p) => fileExists(p));
  // A declared CREATES path that is MISSING is correct — the task creates it.
  // A declared CREATES path that already EXISTS is a stale claim: acting on it
  // would overwrite a file that has already landed.
  const newPaths = declaredCreates.filter((p) => !fileExists(p));
  const staleCreates = declaredCreates.filter((p) => fileExists(p));
  // An EXPECTED-ABSENT path that EXISTS breaks the assertion the body makes.
  const presentDespiteAbsent = declaredAbsent.filter((p) => fileExists(p));
  // Only paths that EXIST can be gitignored; a missing path is missing whatever
  // the ignore rules say.
  const ignored = [...ignoredPaths(presentPaths)];
  const missingIdentifiers = identifiers.filter((name) => !grepSrc(name));
  // A bare file name that belongs to a declared path is covered by that
  // declaration (WF-G193 reported exactly this double report).
  const declaredBaseNames = new Set([...declared].map((p) => p.split('/').pop()));
  const missingFileNames = fileNames.filter((name) => !declaredBaseNames.has(name) && !basenameExists(name));

  // WF-G167: Missing test paths with split file candidate detection
  const missingTestPaths = missingPaths
    .filter((p) => !declared.has(p))
    .filter(isTestPath)
    .map((p) => ({
      path: p,
      splitCandidates: findSplitCandidates(p),
    }));

  // WF-G165: Claims that a schema is missing when it already exists under src/types/**
  const schemaClaims = extractSchemaClaims(text);
  const suspectSchemaClaims = [];
  for (const c of schemaClaims) {
    const hits = grepTypes(c.typeName);
    if (hits && hits.length > 0) {
      suspectSchemaClaims.push({
        ...c,
        existingLocations: hits,
      });
    }
  }

  // WF-G161: DO step claims fields exist in a type file where they do not
  const typeFieldClaims = extractTypeFieldClaims(text);
  const unresolvedTypeFields = [];
  for (const c of typeFieldClaims) {
    if (fileExists(c.file)) {
      const missing = checkFileFields(c.file, c.fields);
      if (missing && missing.length > 0) {
        unresolvedTypeFields.push({
          file: c.file,
          missingFields: missing,
          claim: c.raw,
        });
      }
    }
  }

  return {
    taskId: task.id || '',
    checkedPaths: paths,
    checkedIdentifiers: identifiers,
    checkedFileNames: fileNames,
    missingPaths,
    ignoredPaths: ignored,
    missingIdentifiers,
    missingFileNames,
    missingTestPaths,
    suspectSchemaClaims,
    unresolvedTypeFields,
    declaredCreates,
    declaredAbsent,
    newPaths,
    staleCreates,
    presentDespiteAbsent,
    clean: missingPaths.length === 0 &&
      missingIdentifiers.length === 0 &&
      missingFileNames.length === 0 &&
      missingTestPaths.length === 0 &&
      suspectSchemaClaims.length === 0 &&
      unresolvedTypeFields.length === 0 &&
      staleCreates.length === 0 &&
      presentDespiteAbsent.length === 0,
  };
}

/** Human-readable report lines for a lint result. */
export function formatLintReport(result) {
  const lines = [];
  lines.push(`task lint ${result.taskId || '(unsaved)'} — ${result.checkedPaths.length} path(s), ${result.checkedIdentifiers.length} identifier(s) checked`);
  if (result.missingPaths.length) {
    lines.push(`  MISSING PATHS (${result.missingPaths.length}) — not in this checkout:`);
    for (const p of result.missingPaths) lines.push(`    ${p}`);
  }
  if ((result.missingTestPaths || []).length) {
    lines.push(`  MISSING TEST PATHS (${result.missingTestPaths.length}) (WF-G167) — vitest treats unmatched paths as empty filters and exits 0!:`);
    for (const item of result.missingTestPaths) {
      if (item.splitCandidates && item.splitCandidates.length) {
        lines.push(`    ${item.path} -> split test suites found: ${item.splitCandidates.join(', ')}`);
      } else {
        lines.push(`    ${item.path}`);
      }
    }
  }
  if (result.missingIdentifiers.length) {
    lines.push(`  UNGREPPABLE IDENTIFIERS (${result.missingIdentifiers.length}) — no hit under src/:`);
    for (const n of result.missingIdentifiers) lines.push(`    ${n}`);
  }
  if ((result.missingFileNames || []).length) {
    lines.push(`  MISSING FILE NAMES (${result.missingFileNames.length}) — no file with this name anywhere in the repo (WF-G158):`);
    for (const n of result.missingFileNames) lines.push(`    ${n}`);
  }
  if ((result.suspectSchemaClaims || []).length) {
    lines.push(`  SUSPECT SCHEMA CLAIMS (${result.suspectSchemaClaims.length}) (WF-G165) — task claims schema is missing, but type exists under src/types/:`);
    for (const item of result.suspectSchemaClaims) {
      lines.push(`    "${item.claim}" -> found in: ${item.existingLocations.join(', ')}`);
    }
    lines.push(`    Rule: grep src/types/** before prescribing new schemas to prevent duplicate types.`);
  }
  if ((result.unresolvedTypeFields || []).length) {
    lines.push(`  UNRESOLVED TYPE FIELDS (${result.unresolvedTypeFields.length}) (WF-G161) — named fields not found in target file:`);
    for (const item of result.unresolvedTypeFields) {
      lines.push(`    ${item.file}: missing [${item.missingFields.join(', ')}]`);
    }
    lines.push(`    Rule: grep target file before prescribing field sources; if unresolved, record in EVIDENCE as 'source unresolved'.`);
  }
  // WF-G191: a declared CREATES path that already exists is a STALE claim.
  if ((result.staleCreates || []).length) {
    lines.push(`  STALE CREATES (${result.staleCreates.length}) (WF-G191) — the body says the task creates these, but they already exist:`);
    for (const p of result.staleCreates) lines.push(`    ${p}`);
    lines.push('    Read the file first: this task would overwrite work that has already landed.');
  }
  // WF-G193: an EXPECTED-ABSENT path that exists breaks the body's assertion.
  if ((result.presentDespiteAbsent || []).length) {
    lines.push(`  PRESENT DESPITE EXPECTED-ABSENT (${result.presentDespiteAbsent.length}) (WF-G193) — the body asserts these do not exist, but they do:`);
    for (const p of result.presentDespiteAbsent) lines.push(`    ${p}`);
    lines.push('    The premise of this task has changed. Re-read the paths before you act.');
  }
  if (result.ignoredPaths.length) {
    lines.push(`  note: ${result.ignoredPaths.length} named path(s) exist but are GITIGNORED (a reader grepping the index will not find them):`);
    for (const p of result.ignoredPaths) lines.push(`    ${p}`);
  }
  // A NOTE, never a defect: these are the paths the task exists to create or
  // to prove absent, and the body says so.
  if ((result.newPaths || []).length) {
    lines.push(`  NEW PATHS (${result.newPaths.length}) (WF-G191) — declared with a CREATES: line; this task creates them:`);
    for (const p of result.newPaths) lines.push(`    ${p}`);
  }
  if ((result.declaredAbsent || []).length) {
    const clear = result.declaredAbsent.filter((p) => !(result.presentDespiteAbsent || []).includes(p));
    if (clear.length) {
      lines.push(`  EXPECTED ABSENT (${clear.length}) (WF-G193) — declared with an EXPECTED-ABSENT: line, and confirmed absent:`);
      for (const p of clear) lines.push(`    ${p}`);
    }
  }
  if (result.clean) {
    lines.push('  clean: every named path exists or is declared, and every backticked identifier greps in src/.');
  } else {
    lines.push('  A body may legitimately name a path the task CREATES or asserts is ABSENT.');
    lines.push('  Fix the stale ones, and declare the rest on their own body line:');
    lines.push('    CREATES: <path>            the task creates this file (reported as a NEW PATH, not a defect)');
    lines.push('    EXPECTED-ABSENT: <path>    the task asserts this file is gone (lint FAILS if it comes back)');
  }
  return lines;
}
