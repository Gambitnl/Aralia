#!/usr/bin/env node

/**
 * @file scripts/quality/sweep-stubs.mjs
 *
 * WHAT THIS FILE DOES:
 * This script is a deterministic quality, technical-debt, and architectural health scanner
 * for the Aralia codebase. It provides both routine background debt sweeps and isolated deep audits across:
 *  1. Debt & Stub Markers: TODO, DEBT, FIXME, HACK, XXX, DEFERRED, STUB, PLACEHOLDER,
 *     unimplemented errors, dummy return values, and empty filter placeholders.
 *     Extracted via a syntax-aware parser separating comments, strings, and executable code.
 *  2. Agora Task Cross-Referencing: Read-only cross-referencing against the local Agora
 *     HTTP daemon (http://localhost:4319). Checks if cited task IDs are active (open, claimed,
 *     in_progress, ready, blocked), needing completion review (done/closed), missing, or unverified when the daemon is offline.
 *  3. Durable Gap Cross-Referencing: Verifies cited global and project gap records
 *     independently of live assignment, preserving recorded future work.
 *  4. Type Safety Suppressions: @ts-ignore, @ts-expect-error, eslint-disable on any, and raw `as any`.
 *  5. Build & Clone Safety (GG-123): Catches tracked files importing gitignored files that break fresh clones,
 *     verified using `git ls-files` and `git check-ignore`.
 *  6. Image & Proof Leak Detection (AGENTS.md): Detects uncollapsed staged or untracked visual proof captures
 *     outside .agent/scratch/ using `git status --porcelain=v1 -z -uall`.
 *  7. Hardcoded Machine Paths: Flags single and escaped Windows paths (C:\Users, C:\\Users, F:\Repos) in src/.
 *  8. Forgotten Debug Traps: Catches debugger, console.trace, console.profile, and time/timeEnd in production.
 *  9. Orphan Module Candidates (GG-122): Analyzes inbound imports across src/, root entrypoints (index.tsx),
 *     and devtools/ to identify unreferenced modules (advisory only).
 * 10. Mixed Line-Ending Drift (WF-G80): Catches files with mixed CRLF and LF line endings.
 * 11. Broken Task & PlanMap References: Validates that files cited in active Agora tasks and PlanMap topics exist.
 * 12. Agora Agent State Audit: Distinguishes live active agents from inactive client-identity files on disk.
 * 13. Architectural Health: Reports subsystems with no discovered test files and files over 1,500 lines.
 *
 * WHY IT WAS BUILT THIS WAY:
 *  - Preservation-First & Expansion-First: Rather than deleting embryonic or incomplete code, the sweeper
 *    identifies debt so it can be registered on Agora. Unfinished systems remain preserved until explicit user decision.
 *  - Strict Verification Parity: Subsystems report explicit lifecycle statuses (passed, has_findings,
 *    unavailable, error). When required verification is unavailable (such as Agora being offline), strict
 *    mode rejects the scan rather than silently passing unverified debt.
 *  - Syntax Projections: Code checks, string literal checks, and comment marker checks are strictly decoupled
 *    to eliminate false positives (e.g. `console.trace(` inside string literals or `return null as any` in comments).
 *  - Stable Signatures: Findings receive a deterministic `findingId` based on its location and content
 *    hash to prevent duplicate Agora task churn when surrounding lines shift.
 *
 * HOW IT CONNECTS TO THE REST OF THE SYSTEM:
 *  - Executed manually via `npm run sweep:stubs` or via Node CLI.
 *  - Queried by automated background audit schedules.
 *  - Cross-references Agora tasks via read-only HTTP endpoints.
 *  - Validates PlanMap topics in `public/planmap/topics.json` and durable gaps through the existing gap-index parser.
 */

import fs from 'node:fs';
import path from 'node:path';
import { analyzeSource } from './sweep-syntax.mjs';
import { computeFindingId, loadGapRecords, classifyFinding, buildTaskProposals, compareReports, ACTIVE_TASK_STATES, CLOSED_TASK_STATES } from './sweep-triage.mjs';
export { computeFindingId, compareReports, ACTIVE_TASK_STATES, CLOSED_TASK_STATES } from './sweep-triage.mjs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// ============================================================================
// Section 1: Configuration & Directory Anchors
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = (() => {
  const candidate = path.resolve(__dirname, '..', '..');
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  return path.resolve('F:/Repos/Aralia');
})();
export const DEFAULT_SRC_DIR = path.join(REPO_ROOT, 'src');
export const AGORA_API_URL = process.env.AGORA_URL || 'http://localhost:4319';

// Explicit segment-based path exclusions.
// Naive substring matches (e.g. '.includes("dist")') previously pruned legitimate source files
// like `src/systems/worldforge/town/architectureDistricts.ts` and `src/services/BuildingGenerator.ts` (retired 2026-09-23).
// We now match exact path segments to protect genuine application code.
const EXCLUDED_DIR_SEGMENTS = /(?:^|\/)(?:node_modules|\.git|\.agent|dist|build|fixtures|\.cache|\.turbo)(?:\/|$)/;
const TEST_FILE_PATTERN = /\.(?:test|spec)\.[a-z0-9]+$/i;
const TEST_DIR_PATTERN = /(?:^|\/)__tests__(?:\/|$)/;
const SPECIFIC_EXCLUDED_FILES = /(?:^|\/)src\/test\/setup\.[jt]sx?$/;

/**
 * Determines whether a file path should be excluded from debt and quality scans.
 * Supports `{ includeTests: true }` so health audits can inspect test suites without exclusion.
 */
export function isExcluded(filePath, options = {}) {
  const norm = filePath.replace(/\\/g, '/');
  if (EXCLUDED_DIR_SEGMENTS.test(norm)) return true;
  if (SPECIFIC_EXCLUDED_FILES.test(norm)) return true;
  if (!options.includeTests) {
    if (/(?:^|\/)__mocks__(?:\/|$)/.test(norm)) return true;
    if (TEST_DIR_PATTERN.test(norm) || TEST_FILE_PATTERN.test(norm)) return true;
  }
  return false;
}

// ============================================================================
// Section 2: Git Helpers & Tracked Membership
// ============================================================================

/**
 * Returns a Set of all files currently tracked by Git.
 * Returns { error: string } if Git fails.
 */
export function getTrackedFiles(repoRoot = REPO_ROOT) {
  try {
    const stdout = execFileSync('git', ['ls-files', '-z'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return new Set(stdout.split('\0').map(l => l.replace(/\\/g, '/')).filter(Boolean));
  } catch (err) {
    return { error: err.message };
  }
}

// ============================================================================
// Section 3: Agora Daemon Read-Only Integration
// ============================================================================

// Agora task states per tools/agora/store.mjs:44.
// Blocked tasks represent valid registered work that cannot currently proceed,
// and must be recognized as tracked rather than discarded as unlisted.

/**
 * Queries the Agora daemon for tasks with a bounded 2000ms timeout.
 * Returns { data: Array|null, error: string|null }.
 */
// Validate the envelope and records before calling a live lookup verified. An HTTP 200
// with the wrong shape is a verification failure, not an empty board.
async function fetchAgoraCollection(kind, signal, { fetchImpl = fetch, url = AGORA_API_URL } = {}) {
  try {
    const res = await fetchImpl(url + '/' + kind, { signal: signal || AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText);
    const payload = await res.json();
    const data = Array.isArray(payload) ? payload : payload?.[kind];
    if (!Array.isArray(data)) throw new Error('Invalid Agora ' + kind + ' response: expected an array');
    const ids = new Set();
    for (const record of data) {
      if (!record || typeof record !== 'object') throw new Error('Invalid Agora record');
      if (kind === 'tasks') {
        if (typeof record.id !== 'string' || !record.id || typeof record.state !== 'string' ||
            (!ACTIVE_TASK_STATES.has(record.state) && !CLOSED_TASK_STATES.has(record.state)) ||
            (record.refs !== undefined && (!Array.isArray(record.refs) || record.refs.some(r => typeof r !== 'string')))) {
          throw new Error('Invalid Agora task identity, state or references');
        }
        if (ids.has(record.id.toLowerCase())) throw new Error('Duplicate Agora task: ' + record.id);
        ids.add(record.id.toLowerCase());
      } else if (typeof record.handle !== 'string' || !record.handle) {
        throw new Error('Invalid Agora agent handle');
      }
    }
    return { data, error: null };
  } catch (err) { return { data: null, error: err.message }; }
}

export function fetchAgoraTasks(signal, options) { return fetchAgoraCollection('tasks', signal, options); }
export function fetchAgoraAgents(signal, options) { return fetchAgoraCollection('agents', signal, options); }

// ============================================================================
// Section 4: File Traversal & Helpers
// ============================================================================

/**
 * Traverses a directory recursively, respecting path exclusions unless overridden.
 */
export function walkDirectory(dir, options = {}, fileList = []) {
  if (Array.isArray(options)) {
    fileList = options;
    options = {};
  }
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!isExcluded(fullPath, options)) {
        walkDirectory(fullPath, options, fileList);
      }
    } else if (entry.isFile()) {
      if (/\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(entry.name) && !isExcluded(fullPath, options)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

/**
 * Computes a stable, deterministic finding ID based on file path, finding type, and normalized text.
 * Prevents line-movement churn from generating duplicate Agora tasks.
 */
// Finding identity lives in sweep-triage.mjs so scans and task proposals share it.

// ============================================================================
// Section 5: Patterns & Comment Extraction Lexer
// ============================================================================

// Marker patterns
export const MARKER_REGEX = /\b(TODO|DEBT|FIXME|HACK|XXX|DEFERRED)(\([^)]+\))?[:\s]/i;
export const STUB_REGEX = /\bSTUB\b/i;
export const PLACEHOLDER_REGEX = /\bPLACEHOLDER\b/i;
export const UNIMPLEMENTED_REGEX = /\b(not\s+implemented|unimplemented)\b/i;
export const THROW_STUB_REGEX = /throw\s+new\s+Error\s*\(\s*['"`](?:not\s+implemented|stub|placeholder|todo)/i;
export const DUMMY_RETURN_REGEX = /return\s+null\s+as\s+any|return\s+\{\}\s+as\s+any|return\s+\[\]\s+as\s+any/i;
export const DUMMY_FILTER_REGEX = /filter\s*\(\s*\(\s*\)\s*=>\s*true\s*\)|filter\s*\(\s*\w+\s*=>\s*true\s*\)/i;
export const CONSOLE_STUB_REGEX = /console\.(?:warn|log|error)\s*\(\s*['"`](?:STUB|PLACEHOLDER|NOT IMPLEMENTED|TODO)/i;

// Type safety suppressions
export const TS_IGNORE_REGEX = /@ts-ignore|@ts-expect-error/;
export const ESLINT_TYPE_DISABLE_REGEX = /eslint-disable(?:-next-line)?\s+.*@typescript-eslint\/no-explicit-any/;
export const AS_ANY_REGEX = /\bas\s+any\b/;

// Debug traps (evaluated on executable code outside comments and strings)
export const DEBUG_TRAP_REGEX = /\bdebugger\s*(?:;|$)|console\.(trace|profile|profileEnd|time|timeEnd)\s*\(/;

// Hardcoded machine paths (tested against code and string literals, outside comments)
export const HARDCODED_PATH_REGEX = /(?:[A-Za-z]:[\\/]+(?:Users|Repos|Projects|Home)\b|(?<![A-Za-z0-9_])[A-Za-z]:\\\\(?:Users|Repos|Projects|Home)\b)/i;

// Task citation patterns
export const AGORA_TASK_REGEX = /\b(?:agora-[a-f0-9]+(?:\.[a-z0-9]+)?|task-\d+)\b/gi;
export const GG_GAP_REGEX = /\bGG-\d+\b/gi;

// Domain-specific explanatory prose where markers are legitimate historical or documentation context
export const DOMAIN_IGNORES = [
  /value is a placeholder that the reducer overrides/i,
  /rather than an invented placeholder/i,
  /placeholder for the ai generator/i,
  /those fields are stubbed/i,
  /legacy\/data stubs/i,
  /zeroed placeholder/i,
  /stub cells/i,
  /say so rather than filing a stub quietly/i,
  /serve a placeholder so the server still boots/i,
  /Glob and placeholder characters are checked/i,
  /module stub to store common functions/i,
  /RESOLVED \d{4}-\d{2}-\d{2}/i,
  /former TODO/i,
  /was TODO/i,
  /was DEFERRED/i,
  /was STUB/i,
  /not a workaround/i,
  /no.*hack:/i,
  /no.*workaround/i,
  /replace[sd].*placeholder/i,
  /placeholder that outlived/i,
  /tests? (?:inject|pass|use).*stub/i,
  /stub (?:atlas|context|client)/i,
  /rather than.*placeholder/i,
  /never draws a placeholder/i,
  /non-placeholder/i,
  /were always a placeholder/i,
  /flipper stubs?|stream to a stub|stub tubes?/i,
  /honest.*placeholder so a brand-new/i,
  /loading.*placeholder with honest/i,
  /shape" placeholder/i,
  /kept as a placeholder so every phase/i,
  /not fall back to the generic placeholder/i,
  /empty placeholder — not an actual/i,
  /(?:tests|suites) replace.*stub/i,
  /with stub components/i,
  /Patron selection is deferred to Level 3/i,
  /textures\.js (?:stub|is a no-op stub)|stub textures\.js/i,
  /read as an unfinished placeholder slab/i,
  /on deferred \/ software|deferred (?:rendering|\/ software)/i,
  /index 0 is (?:FMG's )?placeholder|element 0 is the literal 0 placeholder|placeholder layout are preserved/i,
];

/**
 * Scopes domain-specific prose ignores to informational comments only.
 * Explicit debt markers (TODO, DEBT, FIXME, HACK, XXX) and executable code stubs
 * must NEVER be suppressed by domain prose ignores.
 */
export function isSuppressedByDomainIgnores(matchedType, commentText) {
  if (matchedType !== 'STUB_COMMENT' && matchedType !== 'PLACEHOLDER_COMMENT' && matchedType !== 'UNIMPLEMENTED_COMMENT') {
    return false;
  }
  if (!commentText) return false;
  return DOMAIN_IGNORES.some(re => re.test(commentText));
}

/**
 * Tokenizes a source file into line descriptors, separating comments, strings, and executable code.
 * Handles regex literals (/pattern/) so that embedded quotes do not trigger string literal states.
 *
 * Produces:
 *  - `code`: Code with comments stripped but string literals intact.
 *  - `codeWithoutStrings`: Executable code with comments stripped AND string literals replaced with "".
 *  - `strings`: Array of string literal values extracted from the line.
 *  - `comments`: Array of comment text chunks extracted from the line.
 *  - `hasExecutableCode`: Boolean indicating whether executable code exists on this line.
 */
export function extractFileComments(sourceCode, fileName = 'source.tsx') {
  return analyzeSource(sourceCode, fileName).lines;
}

/**
 * Extracts task and gap citations for a line, strictly enforcing executable code boundaries.
 * Lookups above and below stop immediately if an intervening line contains executable code,
 * preventing unrelated TODOs from inheriting task IDs from code statements.
 */
export function getLineCitations(linesData, idx) {
  const current = linesData[idx];
  const sameLineAgora = new Set();
  const sameLineGaps = new Set();

  for (const c of current.comments) {
    const tMatches = c.match(AGORA_TASK_REGEX);
    if (tMatches) tMatches.forEach(id => sameLineAgora.add(id.toLowerCase()));
    const gMatches = c.match(GG_GAP_REGEX);
    if (gMatches) gMatches.forEach(g => sameLineGaps.add(g.toUpperCase()));
  }

  // If explicit citation on the exact same line, prefer it exclusively
  if (sameLineAgora.size > 0 || sameLineGaps.size > 0) {
    return {
      isExplicit: true,
      citedAgoraIds: Array.from(sameLineAgora),
      citedGaps: Array.from(sameLineGaps)
    };
  }

  const adjacentAgora = new Set();
  const adjacentGaps = new Set();

  // Scan upward within contiguous comment block. Stops immediately at executable code.
  for (let targetIdx = idx - 1; targetIdx >= 0; targetIdx--) {
    const target = linesData[targetIdx];
    if (target.hasExecutableCode) break;
    if (!target.comments || target.comments.length === 0) break;

    for (const c of target.comments) {
      const tMatches = c.match(AGORA_TASK_REGEX);
      if (tMatches) tMatches.forEach(id => adjacentAgora.add(id.toLowerCase()));
      const gMatches = c.match(GG_GAP_REGEX);
      if (gMatches) gMatches.forEach(g => adjacentGaps.add(g.toUpperCase()));
    }
  }

  // Scan downward: ONLY if current line does not have executable code (pure comment lines).
  // Executable stubs look UP to leading docblocks, but never down into subsequent statements.
  if (!current.hasExecutableCode) {
    for (let targetIdx = idx + 1; targetIdx < linesData.length; targetIdx++) {
      const target = linesData[targetIdx];
      if (target.hasExecutableCode) break;
      if (!target.comments || target.comments.length === 0) break;

      for (const c of target.comments) {
        const tMatches = c.match(AGORA_TASK_REGEX);
        if (tMatches) tMatches.forEach(id => adjacentAgora.add(id.toLowerCase()));
        const gMatches = c.match(GG_GAP_REGEX);
        if (gMatches) gMatches.forEach(g => adjacentGaps.add(g.toUpperCase()));
      }
    }
  }

  return {
    isExplicit: false,
    citedAgoraIds: Array.from(adjacentAgora),
    citedGaps: Array.from(adjacentGaps)
  };
}

// Files that are legitimately unreferenced roots or non-production sources for orphan module checks
const ORPHAN_EXCLUDE = [
  /(^|\/)main\.tsx?$/,
  /(^|\/)index\.tsx?$/,
  /(^|\/)__tests__\//,
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\.stories\.[jt]sx?$/,
  /\.d\.ts$/,
  /(^|\/)vite-env\.[jt]s$/,
  /(^|\/)workers\//,
  /Worker\.ts$/,
  /-entry\.[jt]sx?$/,
];

// ============================================================================
// Section 6: Comprehensive Module Specifier Resolver
// ============================================================================

export function resolveModuleSpecifier(fromFile, spec, repoRoot = REPO_ROOT) {
  // Vite query suffixes select a loader, not a different source file.
  spec = spec.replace(/[?#].*$/, '');
  let base;
  if (spec.startsWith('@/')) {
    base = path.join(path.join(repoRoot, 'src'), spec.slice(2));
  } else if (spec.startsWith('/src/')) {
    base = path.join(repoRoot, spec.slice(1));
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else {
    return null;
  }

  if (fs.existsSync(base) && fs.statSync(base).isFile()) {
    return base;
  }

  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}.json`,
    `${base}.d.ts`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
    path.join(base, 'index.mjs'),
  ];

  if (spec.endsWith('.js')) {
    const withoutJs = base.slice(0, -3);
    candidates.unshift(`${withoutJs}.ts`, `${withoutJs}.tsx`);
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

// ============================================================================
// Section 7: Isolated Subsystem Analyzers
// ============================================================================

/**
 * Analyzes Gitignored Imports (GG-123).
 * Returns { badImports: [], error?: string }
 */
export function analyzeGitignoredImports(repoRoot = REPO_ROOT, readAnalysis = file => analyzeSource(fs.readFileSync(file, 'utf8'), file)) {
  const trackedFiles = getTrackedFiles(repoRoot);
  if (trackedFiles.error) {
    return { badImports: [], error: `git ls-files failed: ${trackedFiles.error}` };
  }

  const filesToScan = walkDirectory(path.join(repoRoot, 'src'));
  const edges = [];

  for (const file of filesToScan) {
    const analysis = readAnalysis(file);
    if (analysis.errors.length) throw new Error('Cannot verify imports in ' + file + ': ' + analysis.errors[0].message);
    for (const imported of analysis.imports) {
      const spec = imported.specifier;
      if (!spec) continue;

      const target = resolveModuleSpecifier(file, spec, repoRoot);
      if (!target) continue;

      const fromRel = path.relative(repoRoot, file).replace(/\\/g, '/');
      const toRel = path.relative(repoRoot, target).replace(/\\/g, '/');
      edges.push({ from: fromRel, to: toRel });
    }
  }

  const uniqueTargets = [...new Set(edges.map(e => e.to))];
  const ignoredSet = new Set();

  if (uniqueTargets.length > 0) {
    try {
      const res = execFileSync(
        'git',
        ['check-ignore', '--stdin', '-z'],
        { cwd: repoRoot, input: uniqueTargets.join('\0')+'\0', encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
      );
      for (const ignored of res.split('\0').filter(Boolean)) ignoredSet.add(ignored.replace(/\\/g, '/'));
    } catch (err) {
      // Exit code 1 indicates none ignored, which is normal for check-ignore
      if (err.status !== 1) {
        return { badImports: [], error: `git check-ignore failed: ${err.message}` };
      }
    }
  }

  const seenEdges = new Set();
  const badImports = [];

  for (const { from, to } of edges) {
    const edgeKey = `${from} -> ${to}`;
    if (seenEdges.has(edgeKey)) continue;
    seenEdges.add(edgeKey);

    if (trackedFiles.has(from) && !trackedFiles.has(to) && ignoredSet.has(to)) {
      badImports.push({ from, to });
    }
  }

  return { badImports };
}

/**
 * Computes orphan module candidates (GG-122).
 */
export function analyzeOrphanModules(repoRoot = REPO_ROOT, readAnalysis = file => analyzeSource(fs.readFileSync(file, 'utf8'), file)) {
  const consumerFiles = [];

  for (const e of fs.readdirSync(repoRoot, { withFileTypes: true })) {
    if (e.isFile() && /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) {
      consumerFiles.push(path.join(repoRoot, e.name));
    }
  }

  consumerFiles.push(...walkDirectory(path.join(repoRoot, 'src')));
  if (fs.existsSync(path.join(repoRoot, 'devtools'))) consumerFiles.push(...walkDirectory(path.join(repoRoot, 'devtools')));
  if (fs.existsSync(path.join(repoRoot, 'tools'))) consumerFiles.push(...walkDirectory(path.join(repoRoot, 'tools')));

  const inbound = new Map();

  for (const file of consumerFiles) {
    const analysis = readAnalysis(file);
    if (analysis.errors.length) throw new Error('Cannot verify imports in ' + file + ': ' + analysis.errors[0].message);
    for (const imported of analysis.imports) {
      const spec = imported.specifier;
      if (!spec) continue;
      const target = resolveModuleSpecifier(file, spec, repoRoot);
      if (!target || target === file) continue;
      inbound.set(target, (inbound.get(target) || 0) + 1);
    }
  }

  const srcFiles = walkDirectory(path.join(repoRoot, 'src')).filter(f => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'));
  const orphans = srcFiles
    .filter(f => !inbound.has(f))
    .map(f => path.relative(repoRoot, f).replace(/\\/g, '/'))
    .filter(rel => !ORPHAN_EXCLUDE.some(re => re.test(rel)))
    .sort();

  return { orphans };
}

/**
 * Checks for accidental image/proof leaks in git status (AGENTS.md).
 * Uses `git status --porcelain=v1 -z -uall` to preserve status columns, avoid escaping/quoting issues,
 * and check both staged and untracked files explicitly.
 */
export function analyzeImageProofLeaks(repoRoot = REPO_ROOT) {
  try {
    const rawStatus = execFileSync('git', ['status', '--porcelain=v1', '-z', '-uall'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });

    const entries = [];
    const parts = rawStatus.split('\0');
    let i = 0;
    while (i < parts.length) {
      const part = parts[i];
      if (!part || part.length < 3) {
        i++;
        continue;
      }
      const statusCode = part.slice(0, 2);
      const filePath = part.slice(3).replace(/\\/g, '/');
      const isRename = statusCode[0] === 'R' || statusCode[0] === 'C' || statusCode[1] === 'R';
      if (isRename && i + 1 < parts.length) {
        entries.push({ statusCode, filePath, oldPath: parts[i + 1].replace(/\\/g, '/') });
        i += 2;
      } else {
        entries.push({ statusCode, filePath });
        i++;
      }
    }

    const PROOF_PATTERN = /(?:^|\/)(?:proof|screenshot|screen-shot|capture|diff|before|after|render-proof|visual-proof|test-[-_a-z0-9]+|preview-[-_a-z0-9]+)(?:[-_0-9a-z]*)\.(?:png|jpg|jpeg|webp|gif|mp4)$/i;
    const IMAGE_EXT_RE = /\.(?:png|jpg|jpeg|webp|gif|mp4)$/i;

    const leaks = [];

    for (const { statusCode, filePath } of entries) {
      if (!IMAGE_EXT_RE.test(filePath)) continue;

      const isUntracked = statusCode === '??';
      const isStaged = statusCode[0] === 'A' || statusCode[0] === 'M' || statusCode[0] === 'R' || statusCode[0] === 'C';
      const isModified = statusCode[1] === 'M';

      if (!isUntracked && !isStaged && !isModified) continue;

      if (filePath.startsWith('.agent/scratch/')) continue;

      const matchesProof = PROOF_PATTERN.test(filePath);

      if (matchesProof || /(?:^|\/)(?:screenshots?|proof|captures?|render-proof|visual-proof)(?:\/|$)/i.test(filePath)) {
        leaks.push({ file: filePath, status: statusCode, reason: 'Proof capture name or directory outside ignored scratch' });
      }
    }



    return { leaks };
  } catch (err) {
    return { leaks: [], error: `git status failed: ${err.message}` };
  }
}

/**
 * Validates links and feature references in public/planmap/topics.json.
 */
export function analyzePlanMapAlignment(repoRoot = REPO_ROOT) {
  const topicsFile = path.join(repoRoot, 'public/planmap/topics.json');
  if (!fs.existsSync(topicsFile)) {
    return { brokenLinks: [], error: 'public/planmap/topics.json not found' };
  }

  try {
    const topicsData = JSON.parse(fs.readFileSync(topicsFile, 'utf8'));
    const topicList = Array.isArray(topicsData) ? topicsData : topicsData?.topics;
    if (!Array.isArray(topicList)) throw new Error('Expected a topics array');
    const brokenLinks = [];

    for (const topic of topicList) {
      const topicLink = topic.link || topic.spec;
      if (topicLink && typeof topicLink === 'string' && topicLink.trim().length > 0) {
        const specRel = topicLink.replace(/\\/g, '/');
        const specFull = path.join(repoRoot, specRel);
        if (!fs.existsSync(specFull)) {
          brokenLinks.push({ topicId: topic.id, title: topic.title, type: 'topic-spec', link: specRel });
        }
      }

      if (Array.isArray(topic.features)) {
        for (const feat of topic.features) {
          const featLink = feat.link || feat.spec;
          if (featLink && typeof featLink === 'string' && featLink.trim().length > 0) {
            const specRel = featLink.replace(/\\/g, '/');
            const specFull = path.join(repoRoot, specRel);
            if (!fs.existsSync(specFull)) {
              brokenLinks.push({ topicId: topic.id, title: feat.title || feat.name || feat.slug, type: 'feature-spec', link: specRel });
            }
          }
        }
      }
    }

    return { brokenLinks };
  } catch (err) {
    return { brokenLinks: [], error: `Failed to parse public/planmap/topics.json: ${err.message}` };
  }
}

/**
 * Validates that file references cited in active Agora tasks exist on disk.
 */
export function analyzeTaskRefs(agoraTasks, repoRoot = REPO_ROOT) {
  if (!agoraTasks) return [];
  const brokenRefs = [];

  for (const task of agoraTasks) {
    if (CLOSED_TASK_STATES.has(task.state)) continue;
    if (!Array.isArray(task.refs)) continue;

    for (const ref of task.refs) {
      if (ref.startsWith('planmap:') || ref.startsWith('http')) continue;
      const refPath = ref.replace(/\\/g, '/');
      const fullPath = path.join(repoRoot, refPath);
      if (!fs.existsSync(fullPath)) {
        brokenRefs.push({ taskId: task.id, title: task.title, ref: refPath });
      }
    }
  }

  return brokenRefs;
}

/**
 * Audits active live agents vs client-identity files on disk.
 * Matches `client-identity.*.json` and `client-identity.json` per tools/agora/client.mjs:142
 * and parses URL-keyed identity dictionaries.
 */
export function analyzeAgentIdentities(agoraAgents, repoRoot = REPO_ROOT, agoraUrl = AGORA_API_URL) {
  const agoraDir = path.join(repoRoot, '.agent/agora');
  if (!fs.existsSync(agoraDir)) {
    return {
      activeCount: agoraAgents ? agoraAgents.length : 0,
      totalIdentities: 0,
      inactiveCount: 0,
      inactiveSamples: [],
      agoraOnline: agoraAgents !== null
    };
  }

  if (agoraAgents === null) return { activeCount: null, totalIdentities: fs.readdirSync(agoraDir).filter(f => /^client-identity(?:[.-].*)?\.json$/.test(f)).length, inactiveCount: null, inactiveSamples: [], agoraOnline: false };
  const activeHandles = new Set(agoraAgents.map(a => a.handle));
  const identityFiles = fs.readdirSync(agoraDir).filter(f => f.startsWith('client-identity') && f.endsWith('.json'));

  const inactiveSamples = [];
  let inactiveCount = 0;

  for (const file of identityFiles) {
    try {
      const raw = fs.readFileSync(path.join(agoraDir, file), 'utf8');
      const data = JSON.parse(raw);
      let identity = null;

      if (data && typeof data === 'object') {
        if (data.handle) {
          identity = data;
        } else if (data[agoraUrl]?.handle) {
          identity = data[agoraUrl];
        }
      }

      if (identity && identity.handle) {
        if (!activeHandles.has(identity.handle)) {
          inactiveCount++;
          if (inactiveSamples.length < 5) {
            inactiveSamples.push({
              file,
              handle: identity.handle,
              registeredAt: identity.registeredAt || identity.checkedIn || 'unknown',
              session: identity.sessionId || 'none'
            });
          }
        }
      }
    } catch (_e) {
      // Ignore unparseable or corrupt JSON
    }
  }

  return {
    activeCount: agoraAgents ? agoraAgents.length : 0,
    totalIdentities: identityFiles.length,
    inactiveCount,
    inactiveSamples,
    agoraOnline: agoraAgents !== null
  };
}

/**
 * Gathers high-level architectural health metrics.
 * Uses `{ includeTests: true }` when scanning systems so test suites are discovered,
 * preventing false reporting of tested subsystems as untested.
 */
export function analyzeArchitecturalHealth(repoRoot = REPO_ROOT) {
  const godFiles = [];
  const allSrcFiles = walkDirectory(path.join(repoRoot, 'src'));

  for (const file of allSrcFiles) {
    const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lineCount = content.split('\n').length;
    if (lineCount > 1500) {
      godFiles.push({ file: rel, lines: lineCount });
    }
  }
  godFiles.sort((a, b) => b.lines - a.lines);

  const untestedSystems = [];
  const systemsWithTests = [];
  const systemsDir = path.join(path.join(repoRoot, 'src'), 'systems');
  if (fs.existsSync(systemsDir)) {
    const subdirs = fs.readdirSync(systemsDir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const d of subdirs) {
      const sys = d.name;
      const sysPath = path.join(systemsDir, sys);
      const files = walkDirectory(sysPath, { includeTests: true });
      const testFiles = files.filter(f => TEST_FILE_PATTERN.test(f) || TEST_DIR_PATTERN.test(f.replace(/\\/g, '/')));
      if (testFiles.length === 0) {
        untestedSystems.push(sys);
      } else {
        systemsWithTests.push({ system: sys, testCount: testFiles.length });
      }
    }
  }

  return { godFiles, untestedSystems, systemsWithTests };
}

// ============================================================================
// Section 8: Task Scaffolding Generator (Shell-Safe & Preservation-First)
// ============================================================================

/**
 * Generates shell-safe PowerShell commands for Agora task creation.
 * Uses PowerShell verbatim single-quoted strings where every single quote is escaped as ''.
 * Completely avoids shell expansion of $(), backticks, and environment variables.
 */
export function generateScaffoldCommand(item) {
  // Accept both the legacy single finding and a grouped proposal. Commands are
  // suggestions only; this scanner never registers work or edits source files.
  const proposal = item.findings || item.evidence instanceof Array ? item : {
    title: `Investigate ${item.type} in ${path.basename(item.file)}`,
    findings: [item], refs: [item.file], existingTaskCandidates: item.relatedTasks || [],
  };
  const findings = proposal.findings || proposal.evidence;
  const refs = proposal.refs || [...new Set(findings.map(f => f.file))];
  const evidence = findings.map(f => `${f.findingId}: ${f.file}:${f.line || 1} [${f.type}] ${f.text || ''}`).join('\n');
  const body = `Evidence:\n${evidence}\n\n` +
    'Preserve current behavior, unfinished intent, and future feature scope.\n' +
    'First decide whether to link existing work, record deferred intent, investigate, or implement a missing capability.\n' +
    'Acceptance: document the intended behavior and decision; retain the finding IDs in the task; provide focused behavior evidence for any implementation.\n' +
    'A removed marker or absent scan finding is not proof of completion. Uncertain design choices need user decision.\n' +
    `Current behavior to preserve: ${proposal.currentBehavior || 'Inspect the evidence before choosing an implementation.'}\n` +
    `Missing capability or question: ${proposal.missingCapability || 'Confirm whether the observed placeholder represents unfinished behavior.'}\n` +
    `Next action: ${proposal.nextAction || 'Review existing work and choose a disposition.'}\n` +
    `Acceptance criteria: ${(proposal.acceptanceCriteria || []).join(' ')}\n` +
    `Existing task candidates to review before creation: ${JSON.stringify(proposal.existingCandidates || proposal.existingTaskCandidates || proposal.relatedTasks || [])}`;
  const quote = value => "'" + String(value).replace(/'/g, "''") + "'";
  // Agora requires an explicit campaign decision. This standalone suggestion
  // is for bounded triage; reviewers should use an existing campaign when one fits.
  return `node tools/agora/client.mjs task new ${quote(proposal.title)} --category architecture ` +
    '--standalone --reason ' + quote('Bounded scanner triage proposal; review existing campaigns and tasks before creating standalone work.') + ' ' +
    refs.map(ref => '--ref ' + quote(ref)).join(' ') + ' --body ' + quote(body);
}

const CHECK_OPTIONS = {
  imports: 'imports', orphans: 'orphans', leaks: 'leaks', paths: 'paths',
  debugTraps: 'debug_traps', eol: 'eol', agoraState: 'agora_state',
  planmap: 'planmap', health: 'health', typeDebt: 'type_debt', asAny: 'type_debt',
};
const AST_DEBT = new Set(['THROW_UNIMPLEMENTED', 'DUMMY_RETURN_AS_ANY', 'DUMMY_FILTER_STUB', 'CONSOLE_STUB']);
const TYPE_RULES = new Set(['TS_IGNORE_SUPPRESSION', 'ESLINT_TYPE_SUPPRESSION', 'AS_ANY_CAST']);
const needsTriage = f => ['unlisted', 'task_not_found', 'unmapped_gap', 'reference_review', 'completion_review'].includes(f.trackingStatus);

/**
 * Inspects source and durable records, then proposes decisions. Detection is
 * independent of gate policy: recording deferred work preserves it without
 * forcing it onto the active task board. All dependencies are read-only.
 */
export async function scanCodebase(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || REPO_ROOT);
  const full = !!(options.all || options.full);
  const requested = new Set(Object.entries(CHECK_OPTIONS).filter(([key]) => options[key]).map(([,check]) => check));
  // API callers receive the same selected checks as CLI callers. A requested
  // gate must never report success without inspecting the evidence it governs.
  if (options.gateTypeDebt) requested.add('type_debt');
  if (options.gateEol) requested.add('eol');
  if (full) Object.values(CHECK_OPTIONS).forEach(c => requested.add(c));
  if (full || requested.size === 0) requested.add('debt_markers');
  const checks = [...requested].sort();
  const routine = requested.has('debt_markers');
  const errors = [];
  const findings = [];
  // Full scans need the same static imports in several checks. Keep only the
  // small import/diagnostic summaries, not syntax trees or entire line arrays.
  const importCache = new Map();
  const readImports = file => {
    if (!importCache.has(file)) {
      const analysis = analyzeSource(fs.readFileSync(file,'utf8'),file);
      importCache.set(file,{imports:analysis.imports,errors:analysis.errors});
    }
    return importCache.get(file);
  };
  const subsystems = Object.fromEntries([...new Set(['debt_markers', ...Object.values(CHECK_OPTIONS)])].map(c => [c, {status: requested.has(c) ? 'passed' : 'skipped', findingsCount: 0}]));
  const fail = (subsystem, error, status = 'error') => {
    errors.push({subsystem, error: String(error)});
    subsystems[subsystem] = {...subsystems[subsystem], status, error: String(error), findingsCount: subsystems[subsystem]?.findingsCount || 0};
  };
  const needTasks = routine || requested.has('agora_state');
  const needAgents = requested.has('agora_state');
  const netOptions = {fetchImpl: options.fetchImpl || fetch, url: options.agoraUrl || AGORA_API_URL};
  const [taskResponse, agentResponse] = await Promise.all([
    needTasks ? fetchAgoraTasks(undefined, netOptions) : {data:null,error:null},
    needAgents ? fetchAgoraAgents(undefined, netOptions) : {data:null,error:null},
  ]);
  if (needTasks && taskResponse.error) fail('agora_tasks', taskResponse.error, 'unavailable');
  if (needAgents && agentResponse.error) fail('agora_agents', agentResponse.error, 'unavailable');
  const agoraOnline = Array.isArray(taskResponse.data);
  const tasks = taskResponse.data || [];
  const gapReport = routine ? loadGapRecords(repoRoot) : {records:[],errors:[]};
  for (const error of gapReport.errors) fail('gap_records', typeof error === 'string' ? error : JSON.stringify(error));
  const knownGapIds = new Set(gapReport.records.map(g => g.id.toUpperCase()));
  const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const gapIdPattern = new RegExp('\\b(?:WF-G\\d+' + [...knownGapIds].map(id=>'|'+escapeRegex(id)).join('') + ')\\b','gi');
  const durableIds = comment => [...new Set((comment.match(gapIdPattern)||[]).map(id=>id.toUpperCase()))];
  const context = {tasks, agoraOnline, gapRecords:gapReport.records, gapsAvailable:gapReport.errors.length === 0};

  const roots = options.dir ? [path.resolve(repoRoot, options.dir)] : full
    ? ['src', 'tools', 'public/vendor/azgaar/modules'].map(p => path.join(repoRoot,p))
    : [path.join(repoRoot,'src')];
  const fileChecks = ['debt_markers','paths','debug_traps','eol','type_debt'].filter(c=>requested.has(c));
  let sourceComplete = true;
  const scannedFiles = [];
  if (fileChecks.length) {
    for (const root of roots) {
      if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
        sourceComplete = false; fail('filesystem', 'Scan directory does not exist or is not a directory: ' + root); continue;
      }
      try { scannedFiles.push(...walkDirectory(root)); }
      catch (err) { sourceComplete = false; fail('filesystem', err.message); }
    }
  }
  const seenIds = new Map();
  const add = (item, subsystem, {debt = false} = {}) => {
    const baseId = computeFindingId(item.file, item.type, item.context || item.text, item.symbol || '', [...knownGapIds]);
    // Repeated equal statements in one symbol remain separate observations.
    // Occurrence suffixes are relative to equal findings, never source lines.
    const occurrence = (seenIds.get(baseId) || 0) + 1;
    seenIds.set(baseId, occurrence);
    const findingId = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
    const finding = {...item, findingId, subsystem,
      evidence: {rule:item.type, text:item.text, confidence:item.confidence || 'high'},
      citedAgoraIds:item.citedAgoraIds || [], citedGaps:item.citedGaps || []};
    findings.push(debt ? classifyFinding(finding, context) : {...finding, trackingStatus:'advisory', disposition:{action:'review',reason:'This observation alone does not justify removal or refactoring.'}});
  };
  for (const file of [...new Set(scannedFiles)].sort()) {
    const rel = path.relative(repoRoot,file).replace(/\\/g,'/');
    let buffer;
    try { buffer = fs.readFileSync(file); }
    catch(err) { sourceComplete=false; fail('filesystem', `${rel}: ${err.message}`); continue; }
    const source = buffer.toString('utf8');
    if (requested.has('eol') && /\r\n/.test(source) && /(?<!\r)\n/.test(source)) {
      add({file:rel,line:1,type:'MIXED_EOL',text:'Both CRLF and bare LF line endings'}, 'eol');
    }
    if (fileChecks.every(c=>c==='eol')) continue;
    const analysis = analyzeSource(source,file);
    importCache.set(file,{imports:analysis.imports,errors:analysis.errors});
    for (const error of analysis.errors) { sourceComplete=false; fail('syntax', `${rel}:${error.line}: ${error.message}`); }
    // Extend the existing same-block citation scoper with IDs from the actual
    // project registries. Unknown GG/WF citations remain visible for review.
    const citationLines = analysis.lines.map(line=>({...line, comments:line.comments.map(comment=>{
      return comment + durableIds(comment).map(id=>' [durable:'+id+']').join('');
    })}));
    const citationsAt = idx => {
      const citations = getLineCitations(citationLines,idx);
      const current = citationLines[idx];
      let comments = [...current.comments];
      const hasExplicit = comments.some(c => c.match(AGORA_TASK_REGEX) || c.match(GG_GAP_REGEX) || c.includes('[durable:'));
      if (!hasExplicit) {
        for (const direction of [-1,1]) {
          if (direction===1 && current.hasExecutableCode) continue;
          for(let j=idx+direction;j>=0&&j<citationLines.length;j+=direction) {
            const line=citationLines[j]; if(line.hasExecutableCode||!line.comments.length)break;
            comments.push(...line.comments);
          }
        }
      }
      const extra = comments.flatMap(c=>[...c.matchAll(/\[durable:([^\]]+)\]/g)].map(m=>m[1]));
      if (hasExplicit && extra.length) {
        citations.citedAgoraIds=[...new Set(current.comments.flatMap(c=>c.match(AGORA_TASK_REGEX)||[]).map(id=>id.toLowerCase()))];
        citations.citedGaps=[...new Set(current.comments.flatMap(c=>c.match(GG_GAP_REGEX)||[]).map(id=>id.toUpperCase()))];
      }
      return {...citations,isExplicit:hasExplicit,citedGaps:[...new Set([...citations.citedGaps,...extra])]};
    };
    for(const node of analysis.findings) {
      const subsystem = AST_DEBT.has(node.type) ? 'debt_markers' : TYPE_RULES.has(node.type) ? 'type_debt' : 'debug_traps';
      if (!requested.has(subsystem)) continue;
      let citations = citationsAt(node.line-1);
      // A multiline return/throw/call can cite its owner on the closing line.
      // Inspect only comments inside this syntax node's span, never a later
      // statement. Explicit annotations on the opening line retain priority.
      if (!citations.isExplicit && node.endLine > node.line) {
        const comments = analysis.lines.slice(node.line-1,node.endLine).flatMap(line=>line.comments);
        const tasks = [...new Set(comments.flatMap(c=>c.match(AGORA_TASK_REGEX)||[]).map(id=>id.toLowerCase()))];
        const gaps = [...new Set(comments.flatMap(c=>c.match(GG_GAP_REGEX)||[]).map(id=>id.toUpperCase()))];
        for(const comment of comments)gaps.push(...durableIds(comment));
        if(tasks.length||gaps.length)citations={isExplicit:true,citedAgoraIds:tasks,citedGaps:[...new Set(gaps)]};
      }
      add({...node,file:rel,...citations,isExplicitCitation:citations.isExplicit},subsystem,{debt:AST_DEBT.has(node.type)});
    }
    for(const line of analysis.lines) {
      if(requested.has('paths')) {
        for(const literal of line.strings.filter(v=>HARDCODED_PATH_REGEX.test(v))) {
          add({file:rel,line:line.lineNum,type:'HARDCODED_PATH',text:literal,context:literal,symbol:line.symbol},'paths');
        }
      }
      if(!routine || !line.comments.length) continue;
      const comment=line.comments.join(' ');
      const type=MARKER_REGEX.test(comment)?'MARKER':UNIMPLEMENTED_REGEX.test(comment)?'UNIMPLEMENTED_COMMENT':STUB_REGEX.test(comment)?'STUB_COMMENT':PLACEHOLDER_REGEX.test(comment)?'PLACEHOLDER_COMMENT':null;
      if(!type||isSuppressedByDomainIgnores(type,comment))continue;
      const citations=citationsAt(line.lineNum-1);
      add({file:rel,line:line.lineNum,type,text:comment,context:comment,symbol:line.symbol,confidence:type==='MARKER'?'high':'review',...citations,isExplicitCitation:citations.isExplicit},'debt_markers',{debt:true});
    }
  }
  const reports = {};
  const run = (check,fn) => {
    if(!requested.has(check)) return null;
    try {
      if (['imports','orphans','health'].includes(check) && !fs.existsSync(path.join(repoRoot,'src'))) {
        throw new Error('Required source directory is missing: ' + path.join(repoRoot,'src'));
      }
      const report=fn(); if(report?.error)fail(check,report.error); return report;
    }
    catch(err) { fail(check,err.message); return null; }
  };
  reports.importHygieneReport=run('imports',()=>analyzeGitignoredImports(repoRoot,readImports));
  reports.orphanReport=run('orphans',()=>analyzeOrphanModules(repoRoot,readImports));
  reports.imageLeaksReport=run('leaks',()=>analyzeImageProofLeaks(repoRoot));
  reports.planmapReport=run('planmap',()=>analyzePlanMapAlignment(repoRoot));
  reports.healthReport=run('health',()=>analyzeArchitecturalHealth(repoRoot));
  reports.agentIdentitiesReport=run('agora_state',()=>analyzeAgentIdentities(agentResponse.data,repoRoot,netOptions.url));
  reports.brokenTaskRefs=run('agora_state',()=>analyzeTaskRefs(taskResponse.data,repoRoot))||[];
  const external = (items,subsystem,type,convert) => (items||[]).forEach(item=>add({type,...convert(item)},subsystem));
  external(reports.importHygieneReport?.badImports,'imports','GITIGNORED_IMPORT',x=>({file:x.from,text:x.to,context:x.to,details:x}));
  external(reports.orphanReport?.orphans,'orphans','ORPHAN_CANDIDATE',x=>({file:x,text:'No static inbound import discovered'}));
  external(reports.imageLeaksReport?.leaks,'leaks','PROOF_CAPTURE_CANDIDATE',x=>({file:x.file,text:x.reason,details:x}));
  external(reports.planmapReport?.brokenLinks,'planmap','BROKEN_PLANMAP_LINK',x=>({file:'public/planmap/topics.json',text:x.link,context:`${x.topicId}:${x.link}`,details:x}));
  external(reports.brokenTaskRefs,'agora_state','BROKEN_TASK_REF',x=>({file:x.ref,text:`${x.taskId}: ${x.ref}`,details:x}));
  external(reports.healthReport?.godFiles,'health','LARGE_FILE',x=>({file:x.file,text:`${x.lines} lines; size alone is not a refactor instruction`}));
  external(reports.healthReport?.untestedSystems,'health','NO_TEST_FILES_DISCOVERED',x=>({file:`src/systems/${x}`,text:'No test files discovered; this is not a coverage measurement'}));
  for (const check of checks) {
    const count=findings.filter(f=>f.subsystem===check).length;
    const state=subsystems[check]; state.findingsCount=count;
    if(!['error','unavailable'].includes(state.status))state.status=count?'has_findings':'passed';
  }
  if(requested.has('agora_state')&&(!agoraOnline||agentResponse.data===null))subsystUnavailable('agora_state');
  function subsystUnavailable(name){subsystems[name].status='unavailable';}
  const debt=findings.filter(f=>f.subsystem==='debt_markers');
  const completionReview=debt.filter(f=>f.trackingStatus==='completion_review');
  const unverifiedOffline=debt.filter(f=>f.trackingStatus==='unverified_offline');
  const tracked=debt.filter(f=>['tracked','blocked','tracked_via_gap'].includes(f.trackingStatus));
  const recorded=debt.filter(f=>f.trackingStatus==='recorded_deferred');
  const unlisted=debt.filter(f=>['unlisted','task_not_found','reference_review'].includes(f.trackingStatus));
  const unmappedGaps=debt.filter(f=>f.trackingStatus==='unmapped_gap');
  const typeDebt=findings.filter(f=>f.subsystem==='type_debt');
  const debugTraps=findings.filter(f=>f.subsystem==='debug_traps');
  const hardcodedPaths=findings.filter(f=>f.subsystem==='paths');
  const mixedEolFiles=findings.filter(f=>f.subsystem==='eol').map(f=>f.file);
  const report={schemaVersion:2,scope:{repoRoot,roots:roots.map(r=>path.relative(repoRoot,r).replace(/\\/g,'/')).sort(),checks},
    coverage:{complete:sourceComplete&&!errors.some(e=>!['agora_tasks','agora_agents','gap_records'].includes(e.subsystem))&&
      !checks.some(check=>['error','unavailable'].includes(subsystems[check].status)),filesScanned:new Set(scannedFiles).size,exclusions:['dependency/build directories','ignored agent state','test files for production checks']},
    subsystems,findings,proposals:buildTaskProposals(debt.filter(needsTriage)),registryWarnings:gapReport.warnings||[],
    unlisted,tracked,recorded,completionReview,staleTasks:completionReview,unmappedGaps,unverifiedOffline,typeDebt,debugTraps,hardcodedPaths,mixedEolFiles,
    ...reports,subsystemErrors:errors,
    summary:{totalFilesScanned:new Set(scannedFiles).size,trackedCount:tracked.length,recordedCount:recorded.length,unlistedCount:unlisted.length,
      staleTasksCount:completionReview.length,completionReviewCount:completionReview.length,unmappedGapsCount:unmappedGaps.length,unverifiedOfflineCount:unverifiedOffline.length,
      typeDebtCount:typeDebt.length,debugTrapsCount:debugTraps.length,hardcodedPathsCount:hardcodedPaths.length,mixedEolCount:mixedEolFiles.length,
      gitignoredImportsCount:reports.importHygieneReport?.badImports.length||0,orphanCandidatesCount:reports.orphanReport?.orphans.length||0,
      imageLeaksCount:reports.imageLeaksReport?.leaks.length||0,brokenPlanmapLinksCount:reports.planmapReport?.brokenLinks.length||0,brokenTaskRefsCount:reports.brokenTaskRefs.length,
      subsystemErrorsCount:errors.length,agoraOnline:needTasks?agoraOnline:null}};
  report.gate=evaluateQualityGate(report,options);
  return report;
}

/** One policy is used by the API and CLI, regardless of how checks were selected. */
export function evaluateQualityGate(report, options={}) {
  const reasons=[];
  for(const error of report.subsystemErrors||[])reasons.push(`${error.subsystem}: ${error.error}`);
  for(const [check,state] of Object.entries(report.subsystems||{})) {
    if(['error','unavailable'].includes(state.status))reasons.push(`${check}: ${state.status}`);
  }
  if(report.coverage?.complete===false)reasons.push('Source scan is incomplete');
  const blocking=new Set(['imports','leaks','paths','debug_traps','planmap','agora_state']);
  if(options.gateTypeDebt)blocking.add('type_debt');
  if(options.gateEol)blocking.add('eol');
  for(const f of report.findings||[]) {
    if(blocking.has(f.subsystem))reasons.push(`${f.findingId}: ${f.type} in ${f.file}`);
    if(f.subsystem==='debt_markers' && (f.trackingStatus==='unverified_offline'||
      (needsTriage(f)&&f.evidence?.confidence!=='review')))reasons.push(`${f.findingId}: ${f.trackingStatus} needs a tracking or reconciliation decision`);
  }
  return {policy:'preservation',passed:reasons.length===0,reasons:[...new Set(reasons)],optIns:{typeDebt:!!options.gateTypeDebt,eol:!!options.gateEol}};
}

export function parseOptions(args) {
  const options={};
  const bools={'--all':'all','--full':'all','--json':'json','--strict':'strict','--scaffold':'scaffold',
    '--imports':'imports','--orphans':'orphans','--leaks':'leaks','--paths':'paths','--debug-traps':'debugTraps',
    '--eol':'eol','--agora-state':'agoraState','--planmap':'planmap','--health':'health','--type-debt':'typeDebt','--as-any':'asAny',
    '--gate-type-debt':'gateTypeDebt','--gate-eol':'gateEol'};
  const values={'--dir':'dir','--root':'repoRoot','--compare':'compare'};
  for(let i=0;i<args.length;i++) {
    if(bools[args[i]])options[bools[args[i]]]=true;
    else if(values[args[i]]) {const key=values[args[i]];if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing value for '+args[i]);options[key]=args[++i];}
    else throw new Error('Unknown option: '+args[i]);
  }
  // Gate opt-ins also select their check, so policy cannot silently do nothing.
  if(options.gateTypeDebt)options.typeDebt=true;
  if(options.gateEol)options.eol=true;
  return options;
}

export async function main(args=process.argv.slice(2)) {
  if(args.includes('--help')||args.includes('-h')) {
    console.log(`Aralia preservation-first debt scanner
Usage: node scripts/quality/sweep-stubs.mjs [options]
Default: source debt inventory with live Agora and durable gap verification.
--all / --full: select every check; --dir <path>: restrict source-file checks.
--imports --orphans --leaks --paths --debug-traps --eol --agora-state --planmap --health --type-debt --as-any
--strict: fail incomplete verification, selected concrete hazards, or untriaged high-confidence debt.
--gate-type-debt / --gate-eol: explicitly select and gate these otherwise advisory metrics.
--json: full schema-v2 report; --compare <previous.json>: compare compatible complete inventories.
--scaffold: print grouped investigation commands for review; never execute them.
--root <path>: repository root (defaults to this checkout).
Snapshots must be redirected to ignored scratch or an external location.
No-longer-detected findings are observations, never automatic completion.`);
    return 0;
  }
  const options=parseOptions(args);
  const report=await scanCodebase(options);
  if(options.compare) {
    try {
      const bytes=fs.readFileSync(path.resolve(options.compare));
      const text=bytes[0]===0xff && bytes[1]===0xfe ? bytes.subarray(2).toString('utf16le') : bytes.toString('utf8').replace(/^\uFEFF/,'');
      report.comparison=compareReports(JSON.parse(text),report);
    }
    catch(err) { report.subsystemErrors.push({subsystem:'comparison',error:err.message});report.subsystems.comparison={status:'error',findingsCount:0,error:err.message};report.summary.subsystemErrorsCount=report.subsystemErrors.length;report.gate=evaluateQualityGate(report,options); }
  }
  if(options.json) console.log(JSON.stringify(report,null,2));
  else {
    console.log(`Scanned ${report.summary.totalFilesScanned} source files. ${report.findings.length} observations; ${report.proposals.length} grouped triage proposals.`);
    for(const [check,state] of Object.entries(report.subsystems))if(state.status!=='skipped')console.log(`${check}: ${state.status} (${state.findingsCount})${state.error?' - '+state.error:''}`);
    for(const finding of report.findings)console.log(`${finding.findingId} ${finding.file}:${finding.line||1} [${finding.type}] ${finding.trackingStatus}: ${finding.text}`);
    console.log('Recorded or blocked work remains visible. Findings are evidence for a decision, not instructions to delete or refactor.');
    for(const warning of report.registryWarnings)console.log('Registry review: '+JSON.stringify(warning));
    if(report.completionReview.length)console.log('Finding remains after linked task completion: review delivered behavior, accepted scope, and remaining intent before changing commentary.');
    if(options.scaffold)for(const proposal of report.proposals)console.log('\nReview proposal:\n'+generateScaffoldCommand(proposal));
    if(report.comparison)console.log('Comparison (absence is not resolution): '+JSON.stringify(report.comparison));
    console.log(`Preservation gate: ${report.gate.passed?'passed':'needs attention'}`);
    for(const reason of report.gate.reasons)console.log('  - '+reason);
  }
  return options.strict&&!report.gate.passed?1:0;
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().then(code=>{process.exitCode=code;}).catch(err=>{
    if(process.argv.includes('--json'))console.log(JSON.stringify({schemaVersion:2,error:err.message,gate:{passed:false,reasons:[err.message]}}));
    else console.error('Sweep failed: '+err.message);
    process.exitCode=1;
  });
}
