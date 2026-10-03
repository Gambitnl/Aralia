/**
 * This file powers the headless `--sync` and `--check` modes for dependency
 * advisory headers.
 *
 * - `--sync` agents call after changing exports/imports so each file keeps an
 *   up-to-date "stop sign" block that explains dependency blast radius.
 * - `--check` compares the Dependents/Imports/label already recorded in each
 *   header against a freshly computed graph, so drift (GG-84) is surfaced
 *   automatically instead of only being noticed during a manual re-sync.
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateGraphData } from './graphBuilder';
import { isPureReExportBarrel } from './analyzer';
import type { FileNode, GraphData } from './types';

// ============================================================================
// Sync Configuration
// ============================================================================
// These constants define supported file types and the marker block boundaries
// that protect existing source code from accidental overwrite.
// ============================================================================

const SRC_DIR = path.join(process.cwd(), 'src');
const INCLUDED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const SYNC_MARKER_START = '// @dependencies-start';
const SYNC_MARKER_END = '// @dependencies-end';

// ============================================================================
// Public Sync Entry
// ============================================================================
// This function updates one target file by scanning the entire graph, producing
// a dependency advisory message, and replacing only the marker block.
// ============================================================================

export interface ScopedSyncOptions {
  /**
   * Hard-scope the run. Every write is asserted to be one of the named paths
   * before it happens, and dependents are reported as stale instead of being
   * rewritten. This is the mode a shared checkout should use: another agent may
   * hold a lock on a dependent, and silently editing it breaks that contract.
   */
  only?: boolean;
  /** Compute and report, write nothing. Used by tests and by dry orchestration passes. */
  dryRun?: boolean;
}

export type ScopedSyncStatus = 'updated' | 'unchanged' | 'skipped' | 'not-in-graph' | 'failed';

export interface ScopedSyncFileResult {
  file: string;
  status: ScopedSyncStatus;
  reason?: string;
  /** Dominant line ending detected in the target, which the written header matches. */
  eol?: 'CRLF' | 'LF';
  /** True when an existing leading doc comment was kept and the header placed after it. */
  keptLeadingJsDoc?: boolean;
}

export interface ScopedSyncReport {
  results: ScopedSyncFileResult[];
  /**
   * Dependents of the named targets that were deliberately NOT written. Their
   * headers may now be stale; the caller decides when to sync them, under its
   * own locks.
   */
  staleDependents: string[];
}

/**
 * Sync advisory headers for many files in one pass, reusing a single graph build.
 *
 * WF-G115 behavior, all four parts:
 *  - scoped: only the named files are ever written (`only` asserts it);
 *  - EOL-preserving: the header is emitted with the target's dominant line ending;
 *  - JSDoc-preserving: an existing leading doc comment is kept and the header
 *    inserted after it, rather than replacing it;
 *  - batched: the dependency graph is built once for the whole list.
 */
export async function syncFilesScoped(
  targetPaths: string[],
  options: ScopedSyncOptions = {},
): Promise<ScopedSyncReport> {
  const results: ScopedSyncFileResult[] = [];
  const allowed = new Set(targetPaths.map((p) => path.resolve(p)));

  console.info(`[sync] Analyzing dependency web for ${targetPaths.length} file(s)...`);
  const graph = await generateGraphData();

  const staleDependents = new Set<string>();

  for (const targetPath of targetPaths) {
    const fullPath = path.resolve(targetPath);
    const extension = path.extname(fullPath).toLowerCase();

    // Refuse unsupported file types so binary/assets are never mutated by mistake.
    if (!INCLUDED_EXTENSIONS.includes(extension)) {
      results.push({ file: targetPath, status: 'skipped', reason: `unsupported extension (${INCLUDED_EXTENSIONS.join(', ')} only)` });
      continue;
    }

    // Keep tooling scripts out of advisory mutation because they are not part of src graph safety headers.
    if (isScriptPath(fullPath)) {
      results.push({ file: targetPath, status: 'skipped', reason: 'scripts are excluded' });
      continue;
    }

    const targetNode = findNodeForFile(graph, fullPath);
    if (!targetNode) {
      results.push({ file: targetPath, status: 'not-in-graph', reason: 'not found in the dependency map (is it inside src/?)' });
      continue;
    }

    // Every dependent is recorded as stale rather than followed. Rewriting a
    // dependent is what made this tool unsafe to run in a shared checkout.
    for (const dependent of targetNode.importedBy) {
      const dependentFull = path.resolve(SRC_DIR, dependent.replace(/\\/g, '/'));
      if (!allowed.has(dependentFull)) staleDependents.add(dependent.replace(/\\/g, '/'));
    }

    try {
      const currentContent = fs.readFileSync(fullPath, 'utf8');
      const summary = buildAdvisorySummary(targetNode, currentContent);
      const eol = detectDominantEol(currentContent);

      if (isHeaderCurrent(currentContent, summary, eol)) {
        results.push({ file: targetPath, status: 'unchanged', eol: eol === '\r\n' ? 'CRLF' : 'LF' });
        continue;
      }

      const placement = placeAdvisoryHeader(currentContent, renderSyncBlock(summary), eol);

      if (options.only && !allowed.has(fullPath)) {
        // Unreachable by construction; kept as a loud invariant so a future
        // refactor cannot quietly reintroduce dependent-rewriting.
        results.push({ file: targetPath, status: 'failed', reason: 'scope violation: write target was not on the command line' });
        continue;
      }

      if (!options.dryRun) fs.writeFileSync(fullPath, placement.content, 'utf8');

      results.push({
        file: targetPath,
        status: 'updated',
        eol: eol === '\r\n' ? 'CRLF' : 'LF',
        keptLeadingJsDoc: placement.keptLeadingJsDoc,
      });
    } catch (error) {
      results.push({ file: targetPath, status: 'failed', reason: String(error) });
    }
  }

  return { results, staleDependents: Array.from(staleDependents).sort() };
}

/** Print a scoped sync report so a run says exactly what it changed and what it left alone. */
export function printScopedSyncReport(report: ScopedSyncReport): void {
  for (const result of report.results) {
    if (result.status === 'updated') {
      const jsdoc = result.keptLeadingJsDoc ? ', kept leading JSDoc' : '';
      console.info(`[sync] updated   ${result.file} (${result.eol}${jsdoc})`);
    } else if (result.status === 'unchanged') {
      console.info(`[sync] unchanged ${result.file} (header already current)`);
    } else {
      console.warn(`[sync] ${result.status.padEnd(9)} ${result.file}${result.reason ? ` — ${result.reason}` : ''}`);
    }
  }

  const updated = report.results.filter((r) => r.status === 'updated').length;
  const unchanged = report.results.filter((r) => r.status === 'unchanged').length;
  console.info(`[sync] ${updated} updated, ${unchanged} unchanged, ${report.results.length - updated - unchanged} skipped/failed.`);

  if (report.staleDependents.length > 0) {
    console.info(`[sync] ${report.staleDependents.length} dependent(s) may now be stale and were NOT written (scoped mode):`);
    for (const dependent of report.staleDependents) console.info(`         ${dependent}`);
  }
}

/**
 * Legacy single-file entry point. Kept so existing workflow commands and the
 * AGENTS.md snippet keep working; it now runs through the scoped implementation.
 */
export async function syncFileDependencies(targetPath: string): Promise<void> {
  const report = await syncFilesScoped([targetPath], { only: true });
  printScopedSyncReport(report);
}

// ============================================================================
// EOL + Placement Helpers (WF-G115)
// ============================================================================
// The old writer produced `header + '\n\n' + content.trimStart()`. That did two
// kinds of damage on a shared checkout: it stamped LF newlines into CRLF files
// (BattleMap3DGpuScene.tsx ended up 1032 CRLF / 16 LF), and it pushed or ate the
// file's own `@file` doc comment. These helpers fix both, and are exported so a
// fixture test can assert them without running a graph build.
// ============================================================================

/** Dominant line ending of a file. Ties and empty files resolve to LF. */
export function detectDominantEol(content: string): '\r\n' | '\n' {
  const crlf = (content.match(/\r\n/g) || []).length;
  const total = (content.match(/\n/g) || []).length;
  return crlf > total - crlf ? '\r\n' : '\n';
}

export interface HeaderPlacement {
  content: string;
  keptLeadingJsDoc: boolean;
}

/**
 * Produce the new file content: existing advisory blocks removed, the fresh
 * block inserted after any leading doc comment the author wrote, and the block's
 * own newlines rewritten to `eol`. Nothing else in the file is touched, so a
 * file's interior line endings and content survive verbatim.
 */
export function placeAdvisoryHeader(currentContent: string, syncBlock: string, eol: '\r\n' | '\n'): HeaderPlacement {
  const hasBom = currentContent.startsWith('\uFEFF');
  const bom = hasBom ? '\uFEFF' : '';
  let body = hasBom ? currentContent.slice(1) : currentContent;

  // Drop every previously generated block, wherever it sits, plus the blank
  // line it left behind. Repeat runs replace rather than stack.
  body = body.replace(
    /\/\/ @dependencies-start[\s\S]*?\/\/ @dependencies-end(\r?\n)?(\r?\n)?/g,
    '',
  );

  // Older headers were written as a bare `/** ... */` with no markers around
  // them. Those are still ours, so drop them too; the tightened
  // `isAdvisoryBlock` keeps this from touching an authored doc comment.
  body = stripLegacyAdvisoryBlocks(body);

  const block = syncBlock.split('\n').join(eol);

  const jsDocEnd = findLeadingJsDocEnd(body);
  if (jsDocEnd !== -1) {
    const before = body.slice(0, jsDocEnd);
    const after = body.slice(jsDocEnd).replace(/^(\r?\n)+/, '');
    return { content: `${bom}${before}${eol}${eol}${block}${eol}${eol}${after}`, keptLeadingJsDoc: true };
  }

  return { content: `${bom}${block}${eol}${eol}${body.replace(/^\s+/, '')}`, keptLeadingJsDoc: false };
}

/**
 * Index just past the `*\/` of a leading author-written doc comment, or -1 when
 * the file does not start with one (or starts with a block we generated).
 */
function findLeadingJsDocEnd(body: string): number {
  const leading = body.length - body.trimStart().length;
  const trimmed = body.slice(leading);
  if (!trimmed.startsWith('/**')) return -1;

  const blockEnd = trimmed.indexOf('*/');
  if (blockEnd === -1) return -1;

  const block = trimmed.slice(0, blockEnd + 2);
  if (isAdvisoryBlock(block)) return -1;

  return leading + blockEnd + 2;
}

/**
 * True when the file already carries a header with the same facts, written with
 * the file's dominant line ending. Skipping those avoids timestamp-only churn on
 * files an orchestrator sweeps every wave.
 */
function isHeaderCurrent(currentContent: string, summary: AdvisorySummary, eol: '\r\n' | '\n'): boolean {
  const startIdx = currentContent.indexOf(SYNC_MARKER_START);
  if (startIdx === -1) return false;
  const endIdx = currentContent.indexOf(SYNC_MARKER_END, startIdx);
  if (endIdx === -1) return false;

  const blockText = currentContent.slice(startIdx, endIdx + SYNC_MARKER_END.length);
  const blockCrlf = (blockText.match(/\r\n/g) || []).length;
  const blockLf = (blockText.match(/\n/g) || []).length;
  const blockIsCrlf = blockCrlf === blockLf && blockLf > 0;
  if (blockIsCrlf !== (eol === '\r\n')) return false;

  const actual = extractActualHeader(currentContent);
  if (!actual) return false;

  return actual.dependents === summary.dependents
    && actual.imports === expectedImportsLabel(summary.importsCount)
    && actual.label === summary.advisoryLabel;
}

// ============================================================================
// Header Drift Check (GG-84)
// ============================================================================
// Compares the recorded header summary against the freshly computed one. The
// timestamp is intentionally ignored — only the factual Dependents/Imports/
// advisory-label fields can drift, and those are what multi-agent safety
// decisions read.
// ============================================================================

export interface AdvisorySummary {
  advisoryLabel: string;
  dependents: string;
  importsCount: number;
}

export interface HeaderCheckResult {
  file: string;
  ok: boolean;
  reason: 'ok' | 'missing-header' | 'drift' | 'not-in-graph' | 'unsupported';
  expected?: string;
  actual?: string;
}

/** Compute the factual header fields for a node without touching the file. */
export function buildAdvisorySummary(node: FileNode, currentContent: string): AdvisorySummary {
  const isBridge = isPureReExportBarrel(currentContent);
  const dependentsCount = node.importedBy.length;
  return {
    advisoryLabel: buildAdvisoryLabel(isBridge, dependentsCount),
    dependents: dependentsCount > 0 ? formatDependents(node.importedBy) : 'None (Orphan)',
    importsCount: node.imports.length,
  };
}

/** Render the full advisory marker block from a summary (shared by sync + tests). */
export function renderSyncBlock(summary: AdvisorySummary): string {
  const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam' });
  const importsLabel = summary.importsCount === 0 ? 'None' : summary.importsCount + ' files';

  return `${SYNC_MARKER_START}
/**
 * ARCHITECTURAL ADVISORY:
 * ${summary.advisoryLabel}
 *
 * Last Sync: ${timestamp}
 * Dependents: ${summary.dependents}
 * Imports: ${importsLabel}
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
${SYNC_MARKER_END}`;
}

/** Check a single file against a precomputed graph (so callers build the graph once). */
export function checkFileDependencies(targetPath: string, graph: GraphData): HeaderCheckResult {
  const fullPath = path.resolve(targetPath);
  const extension = path.extname(fullPath).toLowerCase();

  if (!INCLUDED_EXTENSIONS.includes(extension) || isScriptPath(fullPath)) {
    return { file: fullPath, ok: true, reason: 'unsupported' };
  }

  const targetNode = findNodeForFile(graph, fullPath);
  if (!targetNode) {
    return { file: fullPath, ok: false, reason: 'not-in-graph' };
  }

  const currentContent = fs.readFileSync(fullPath, 'utf8');
  const actual = extractActualHeader(currentContent);
  if (!actual) {
    return { file: fullPath, ok: false, reason: 'missing-header' };
  }

  const expected = buildAdvisorySummary(targetNode, currentContent);

  const expectedLine = `Dependents: ${expected.dependents} · Imports: ${expected.importsCount === 0 ? 'None' : expected.importsCount + ' files'} · ${expected.advisoryLabel}`;
  const actualLine = `Dependents: ${actual.dependents} · Imports: ${actual.imports} · ${actual.label}`;

  if (actual.dependents !== expected.dependents || actual.imports !== expectedImportsLabel(expected.importsCount) || actual.label !== expected.advisoryLabel) {
    return { file: fullPath, ok: false, reason: 'drift', expected: expectedLine, actual: actualLine };
  }

  return { file: fullPath, ok: true, reason: 'ok' };
}

/**
 * Walk a directory tree and return every supported source file that already
 * carries an advisory header. Files without a header are intentionally out of
 * scope — the check verifies drift on recorded headers, not header adoption.
 */
export function collectSyncedFilePaths(dir = SRC_DIR): string[] {
  const results: string[] = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
        stack.push(full);
      } else if (entry.isFile() && INCLUDED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes(SYNC_MARKER_START)) results.push(full);
        } catch {
          // Unreadable files are skipped rather than failing the whole check.
        }
      }
    }
  }

  return results;
}

// ============================================================================
// Label + Formatting Helpers
// ============================================================================
// These helpers keep the advisory language and dependent formatting consistent
// across all sync updates.
// ============================================================================

function isScriptPath(fullPath: string): boolean {
  return fullPath.includes(path.sep + 'scripts' + path.sep) || fullPath.includes(path.sep + 'scripts/');
}

function findNodeForFile(graph: GraphData, fullPath: string): FileNode | undefined {
  const relativeTarget = path.relative(SRC_DIR, fullPath).replace(/\\/g, '/');
  return graph.nodes.find((node) => node.id === relativeTarget || node.relativePath === relativeTarget);
}

function expectedImportsLabel(importsCount: number): string {
  return importsCount === 0 ? 'None' : importsCount + ' files';
}

function buildAdvisoryLabel(isBridge: boolean, dependentsCount: number): string {
  if (isBridge) return 'RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.';
  if (dependentsCount === 0) return 'This file appears to be an ISOLATED UTILITY or ORPHAN.';
  if (dependentsCount > 10) return 'CRITICAL CORE SYSTEM: Changes here ripple across the entire city.';
  if (dependentsCount > 3) return 'SHARED UTILITY: Multiple systems rely on these exports.';
  return 'LOCAL HELPER: This file has a small, manageable dependency footprint.';
}

function formatDependents(dependentIds: string[]): string {
  return Array.from(new Set(dependentIds.map((id) => id.replace(/\\/g, '/'))))
    .sort()
    .join(', ');
}

/** Parse the recorded Dependents/Imports/label from an existing header block. */
function extractActualHeader(fileContent: string): { dependents: string; imports: string; label: string } | undefined {
  const startIdx = fileContent.indexOf(SYNC_MARKER_START);
  if (startIdx === -1) return undefined;

  const endIdx = fileContent.indexOf(SYNC_MARKER_END, startIdx);
  if (endIdx === -1) return undefined;

  const block = fileContent.slice(startIdx, endIdx);

  // Normalize: strip the `/**`/`*/` and `* ` doc-comment prefixes so field
  // lines can be matched by their leading token rather than their indentation.
  const lines = block
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trim())
    .filter((l) => l.length > 0 && l !== '/' && l !== '*/');

  const advisoryIdx = lines.findIndex((l) => l.startsWith('ARCHITECTURAL ADVISORY'));
  const label = advisoryIdx >= 0 && lines[advisoryIdx + 1] ? lines[advisoryIdx + 1] : '';

  return {
    dependents: fieldValue(lines.find((l) => l.startsWith('Dependents:'))),
    imports: fieldValue(lines.find((l) => l.startsWith('Imports:'))),
    label,
  };
}

function fieldValue(line: string | undefined): string {
  if (!line) return '';
  const idx = line.indexOf(':');
  return idx === -1 ? '' : line.slice(idx + 1).trim();
}

export function stripLegacyAdvisoryBlocks(fileContent: string): string {
  let remaining = fileContent.replace(/^\uFEFF/, '');

  while (true) {
    const trimmed = remaining.trimStart();
    if (!trimmed.startsWith(SYNC_MARKER_START) && !trimmed.startsWith('/**')) {
      return remaining;
    }

    if (trimmed.startsWith(SYNC_MARKER_START)) {
      const markerEnd = trimmed.indexOf(SYNC_MARKER_END);
      if (markerEnd === -1) return remaining;
      remaining = trimmed.slice(markerEnd + SYNC_MARKER_END.length);
      continue;
    }

    const blockEnd = trimmed.indexOf('*/');
    if (blockEnd === -1) return remaining;

    const block = trimmed.slice(0, blockEnd + 2);
    if (!isAdvisoryBlock(block)) {
      return remaining;
    }

    remaining = trimmed.slice(blockEnd + 2);
  }
}

/**
 * Decide whether a leading `/** ... *\/` block is one WE wrote.
 *
 * WF-G115: this used to also match on a bare `Dependents:` or `Imports:` line,
 * which is ordinary English that a hand-written `@file` header can easily
 * contain — and matching it meant the sync tool deleted the author's own doc
 * comment. The three phrases below are unique to `renderSyncBlock`, so a
 * human-authored header can no longer be mistaken for generated output.
 */
function isAdvisoryBlock(block: string): boolean {
  return block.includes('ARCHITECTURAL ADVISORY:')
    || block.includes('MULTI-AGENT SAFETY:')
    || block.includes('Last Sync:');
}
