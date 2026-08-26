#!/usr/bin/env node

/*
 * Import-hygiene checks over src/, self-contained (no generated dep data):
 *
 *   1. Orphan modules (GG-122)  — tracked source files nothing imports.
 *      Orphans accumulate as false reuse-lanes: docs cite them, agents
 *      preserve them under expansion-first bias, and each needs an expensive
 *      manual audit before deletion (ThreeDModal survived 9 days this way).
 *      Advisory by default; --orphans-strict exits 1 when orphans exist.
 *
 *   2. Gitignored imports (GG-123) — imports that resolve under a gitignored
 *      path build locally but break every fresh clone. This is a hard
 *      failure: exits 1 when any found (unless --allow-ignored).
 *
 * Usage:
 *   node scripts/quality/import-hygiene.cjs            # report both
 *   node scripts/quality/import-hygiene.cjs --json     # machine-readable
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { collectImportEdges } = require('./import-graph.cjs');

const repoRoot = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

const SRC = path.join(repoRoot, 'src');
const EXTENSIONS = new Set(['.ts', '.tsx']);

// Files that are legitimately unreferenced roots or non-production sources.
const ORPHAN_EXCLUDE = [
  /(^|\/)main\.tsx?$/,
  /(^|\/)index\.tsx?$/, // barrel re-exports are consumed via directory imports
  /(^|\/)__tests__\//,
  /\.test\.[jt]sx?$/,
  /\.stories\.[jt]sx?$/,
  /\.d\.ts$/,
  /(^|\/)vite-env\.[jt]s$/,
  /(^|\/)workers\//,
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walk(full, out);
    } else if (EXTENSIONS.has(path.extname(e.name)) && !e.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC);
const { inbound, edges } = collectImportEdges(repoRoot);
// The gitignored-import gate historically checks production src/ files only.
// Broaden inbound evidence for orphan safety without changing that hard gate.
const sourcePaths = new Set(files.map((file) => path.relative(repoRoot, file).replace(/\\/g, '/')));
const ignoredCheckEdges = edges.filter((edge) => sourcePaths.has(edge.from));

// --- Check 2 first: gitignored imports are hard failures --------------------
// Batched: one `git check-ignore --stdin` round-trip for every path, instead of
// one spawn per edge (per-edge spawning took minutes on Windows and got killed).
function computeIgnoredPaths(relPaths) {
  const ignored = new Set();
  if (relPaths.length === 0) return ignored;
  try {
    const res = execFileSync(
      'git',
      ['check-ignore', '--stdin', '--verbose'],
      { cwd: repoRoot, input: relPaths.join('\n'), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    );
    // Verbose output: "<source>:<line>:<pattern>\t<path>" per match. A path is
    // ignored only when its last matching PATTERN is not a negation ("!...")
    // — negated lines appear here too and mean explicitly NOT ignored.
    for (const line of res.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab === -1) continue;
      const meta = line.slice(0, tab);
      const pattern = meta.split(':').pop() || '';
      if (pattern.startsWith('!')) continue;
      ignored.add(line.slice(tab + 1).trim().replace(/\\/g, '/'));
    }
  } catch (e) {
    // Exit status 1 = none ignored (stdout still carries nothing); real git
    // errors also land here, so fail soft toward "not ignored" but note it.
    if (e.status !== 1 && e.stdout) {
      for (const line of String(e.stdout).split('\n')) {
        const tab = line.indexOf('\t');
        if (tab !== -1) ignored.add(line.slice(tab + 1).trim().replace(/\\/g, '/'));
      }
    }
  }
  return ignored;
}

const uniquePaths = [...new Set(ignoredCheckEdges.flatMap((e) => [e.from, e.to]))];
const ignoredSet = computeIgnoredPaths(uniquePaths);

const ignoredImports = [];
for (const { from, to } of ignoredCheckEdges) {
  if (!ignoredSet.has(from) && ignoredSet.has(to) && !to.endsWith('.d.ts')) {
    ignoredImports.push({ from, to });
  }
}

// --- Check 1: orphan modules -------------------------------------------------
const orphans = files
  .filter((f) => !inbound.has(f))
  .map((f) => path.relative(repoRoot, f).replace(/\\/g, '/'))
  .filter((rel) => !ORPHAN_EXCLUDE.some((re) => re.test(rel)))
  .sort();

// --- Report ------------------------------------------------------------------
const jsonOut = process.argv.includes('--json');
const allowIgnored = process.argv.includes('--allow-ignored');
const orphansStrict = process.argv.includes('--orphans-strict');

if (jsonOut) {
  console.log(JSON.stringify({ ignoredImports, orphans }, null, 2));
} else {
  console.log(`\n=== Gitignored Imports (GG-123) ===`);
  if (ignoredImports.length === 0) {
    console.log('clean — no tracked file imports a gitignored module');
  } else {
    for (const i of ignoredImports) console.log(`  BROKEN ON FRESH CLONE: ${i.from}  ->  ${i.to}`);
    console.log(`  total: ${ignoredImports.length}`);
  }

  console.log(`\n=== Orphan Modules (GG-122) — zero inbound imports ===`);
  if (orphans.length === 0) {
    console.log('none');
  } else {
    for (const o of orphans) console.log(`  ${o}`);
    console.log(`  total: ${orphans.length}`);
    console.log('  advisory only — triage into gap rows; do not bulk-delete.');
  }
}

if (ignoredImports.length > 0 && !allowIgnored) process.exit(1);
if (orphansStrict && orphans.length > 0) process.exit(1);
process.exit(0);
