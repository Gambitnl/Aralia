/**
 * This file checks that every file path listed under a current-state heading in
 * Aralia's architecture domain docs (`docs/architecture/domains/*.md`) actually exists
 * in the repository worktree.
 *
 * It exists to prevent the failure recorded in WF-G195, where a domain doc carried
 * a retired warning at the top while still listing deleted or moved files under
 * "Verified Current Entry Points", "Current Domain Shape", or "What Is Materially
 * Implemented", sending agents on a wild-goose chase for missing files.
 *
 * Called by: CLI (`node tools/agora/domainDocCheck.mjs`) and unit tests (`domainDocCheck.test.mjs`).
 * Depends on: Node's built-in `node:fs` and `node:path` modules.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// Constants & Heading Classification
// ============================================================================
// This section defines which Markdown headings describe the live, current state
// of a domain and which headings describe historical, retired, planned, or missing
// items that are not expected to resolve in the current worktree.
// ============================================================================

// Matches headings that claim to describe current entry points, current shape,
// or materially implemented files.
const CURRENT_HEADING_RE = /\b(verified current|current entry|current domain|current state|current runtime|materially implemented|shared engine|protected gameplay|owned surface|key files|entry points)\b/i;

// Matches headings that explicitly describe historical, retired, deleted, missing,
// or future/planned work so their cited paths are not treated as live requirements.
const HISTORICAL_OR_PLANNED_HEADING_RE = /\b(retired|historical|deleted|removed|legacy|planned|future|open question|uncertaint|gap|not implemented|missing|drift)\b/i;

// Matches repo-relative file or directory paths inside inline Markdown code spans.
const INLINE_REPO_PATH_RE = /^(src|public|docs|scripts|tools)\/[A-Za-z0-9_./-]+$/;

// ============================================================================
// Path Extraction & Validation
// ============================================================================
// This section reads each domain Markdown document line by line, tracks the
// active heading hierarchy, and verifies that every concrete repo-relative path
// cited under a current-state heading exists on disk.
// ============================================================================

/**
 * Checks whether a heading line represents a current-state section.
 */
export function isCurrentStateHeading(headingText) {
  const clean = String(headingText || '').trim();
  if (!clean) return false;
  if (HISTORICAL_OR_PLANNED_HEADING_RE.test(clean)) return false;
  return CURRENT_HEADING_RE.test(clean);
}

/**
 * Extracts concrete repo-relative paths from a single Markdown line.
 * Skips fenced code blocks, wildcards (`*`), template placeholders (`{`, `<`),
 * and lines that explicitly declare a path absent or deleted.
 */
export function extractRepoPathsFromLine(lineText) {
  const line = String(lineText || '');
  // Skip lines that explicitly state a path is absent, deleted, retired, or not present.
  if (/\b(not present|deleted|removed|retired|absent|no longer exists|does not exist)\b/i.test(line)) {
    return [];
  }

  const paths = [];
  const matches = line.matchAll(/`([^`]+)`/g);
  for (const match of matches) {
    // Strip trailing `:line` or `#Lline` anchors if present.
    const rawToken = match[1].trim().split(/[:#]/)[0];
    if (!INLINE_REPO_PATH_RE.test(rawToken)) continue;
    paths.push(rawToken);
  }
  return paths;
}

/**
 * Scans a single domain doc's Markdown text against `repoRoot` and returns
 * all checked paths and any unresolved findings under current-state headings.
 */
export function checkDomainDocText(markdownText, { repoRoot, file = 'unknown.md' } = {}) {
  const rootDir = path.resolve(repoRoot || process.cwd());
  const lines = String(markdownText || '').split(/\r?\n/);

  let inFence = false;
  let activeH2 = '';
  let activeH3 = '';
  let inCurrentSection = false;

  const checked = [];
  const unresolved = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();

    // Toggle fenced code blocks so ASCII directory trees or code snippets are skipped.
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // Track ## and ### headings to know whether the reader is inside a current-state section.
    const headingMatch = trimmed.match(/^(#{2,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingTitle = headingMatch[2].trim();
      if (level === 2) {
        activeH2 = headingTitle;
        activeH3 = '';
        inCurrentSection = isCurrentStateHeading(activeH2);
      } else {
        activeH3 = headingTitle;
        if (HISTORICAL_OR_PLANNED_HEADING_RE.test(activeH3)) {
          inCurrentSection = false;
        } else {
          inCurrentSection = isCurrentStateHeading(activeH2) || isCurrentStateHeading(activeH3);
        }
      }
      continue;
    }

    if (!inCurrentSection) continue;

    // Check every backticked repo path on this line against the worktree.
    const candidatePaths = extractRepoPathsFromLine(line);
    for (const relPath of candidatePaths) {
      const absPath = path.join(rootDir, relPath);
      const exists = fs.existsSync(absPath);
      const heading = activeH3 ? `${activeH2} > ${activeH3}` : activeH2;
      const entry = {
        file,
        line: index + 1,
        heading,
        path: relPath,
      };
      checked.push(entry);
      if (!exists) {
        unresolved.push(entry);
      }
    }
  }

  // LOCAL-ONLY PATHS (2026-11-03, agora-257c; CI Tooling Tests job
  // 125639352404). Some current files are gitignored on purpose (AGENTS.md:
  // Design Preview holds local-only files; entities3d/vendor too). A clean
  // clone can never hold them, so CI reported 34 entity-studio and ui-modals
  // paths as stale although they exist in the owner's checkout. An absent path
  // that git ignores is reported as local-only, not as unresolved: no clone
  // can check it. Outside a git repository (a test temp folder) nothing is
  // ignored, so every absent path stays unresolved.
  const ignored = gitIgnoredPaths(rootDir, unresolved.map((entry) => entry.path));
  return {
    checked,
    unresolved: unresolved.filter((entry) => !ignored.has(entry.path)),
    localOnly: unresolved.filter((entry) => ignored.has(entry.path)),
  };
}

/**
 * Returns the subset of `relPaths` that `.gitignore` covers in `rootDir`,
 * through one `git check-ignore --stdin` call. Exit 1 means none is ignored;
 * any other failure (no git, not a repository) also means none.
 */
export function gitIgnoredPaths(rootDir, relPaths) {
  if (relPaths.length === 0) return new Set();
  try {
    const out = execFileSync('git', ['-C', rootDir, 'check-ignore', '--stdin'], {
      input: relPaths.join('\n'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return new Set(out.split(/\r?\n/).filter(Boolean).map((p) => p.replace(/\\/g, '/')));
  } catch (error) {
    return new Set();
  }
}

/**
 * Scans all `*.md` files in `docs/architecture/domains` (or a supplied directory)
 * and aggregates checked and unresolved current-state paths.
 */
export function checkAllDomainDocs({
  repoRoot = process.cwd(),
  domainsDir = 'docs/architecture/domains',
} = {}) {
  const rootDir = path.resolve(repoRoot);
  const absDomainsDir = path.resolve(rootDir, domainsDir);
  if (!fs.existsSync(absDomainsDir)) {
    return { filesScanned: 0, checkedCount: 0, unresolved: [] };
  }

  const docFiles = fs
    .readdirSync(absDomainsDir)
    .filter((name) => name.endsWith('.md'))
    .sort();

  let checkedCount = 0;
  const unresolved = [];
  const localOnly = [];

  for (const name of docFiles) {
    const absFile = path.join(absDomainsDir, name);
    const relFile = path.relative(rootDir, absFile).replace(/\\/g, '/');
    const text = fs.readFileSync(absFile, 'utf8');
    const result = checkDomainDocText(text, { repoRoot: rootDir, file: relFile });
    checkedCount += result.checked.length;
    unresolved.push(...result.unresolved);
    localOnly.push(...result.localOnly);
  }

  return {
    filesScanned: docFiles.length,
    checkedCount,
    unresolved,
    localOnly,
  };
}

// ============================================================================
// CLI Entry Point
// ============================================================================
// When invoked directly from the command line, scan all domain docs and exit
// non-zero if any current-state heading cites a path that does not exist.
// ============================================================================

const isDirectMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectMain) {
  const result = checkAllDomainDocs();
  if (result.unresolved.length > 0) {
    console.error(
      `domainDocCheck: ${result.unresolved.length} unresolved path(s) across ${result.filesScanned} domain doc(s):`
    );
    for (const item of result.unresolved) {
      console.error(`  ${item.file}:${item.line} [${item.heading}] -> ${item.path}`);
    }
    process.exit(1);
  }
  console.log(
    `domainDocCheck: OK (${result.filesScanned} domain docs scanned, ${result.checkedCount} current-state paths checked, 0 unresolved)`
  );
  if (result.localOnly.length > 0) {
    console.log(`domainDocCheck: ${result.localOnly.length} gitignored (local-only) path(s) are absent here and were not checked:`);
    for (const item of result.localOnly) console.log(`  ${item.file}:${item.line} -> ${item.path}`);
  }
}
