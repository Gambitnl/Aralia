#!/usr/bin/env node

/*
 * This script is the fast safety gate for ordinary Aralia pushes.
 *
 * It checks for publishing hazards that mean the repo is not in one coherent
 * state, without turning every sync into a full TypeScript or lint cleanup pass.
 * Full verification still lives in npm run verify and strict pre-push mode.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// ============================================================================
// Process Helpers
// ============================================================================
// These helpers keep Git calls readable and convert command failures into plain
// text results instead of stack traces.
// ============================================================================
function run(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function tryRun(command, args) {
  try {
    return run(command, args);
  } catch {
    return '';
  }
}

function addChangedFiles(files, commandArgs) {
  const output = tryRun('git', commandArgs);
  for (const file of output.split(/\r?\n/).filter(Boolean)) {
    files.add(file);
  }
}

// ============================================================================
// Repo Location
// ============================================================================
// Run from the repo root so every path in the report is stable, whether this is
// called by npm, a Git hook, or an agent checking the workflow by hand.
// ============================================================================
const repoRoot = run('git', ['rev-parse', '--show-toplevel']);
process.chdir(repoRoot);

const failures = [];

// ============================================================================
// Changed File Scope
// ============================================================================
// Ordinary sync should not be blocked by unrelated debt already present on the
// shared branch. The fast checks below focus on files changed locally, files in
// commits not yet on the upstream branch, and untracked files that are about to
// become part of the work.
// ============================================================================
const changedFiles = new Set();
const upstream = tryRun('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);

if (upstream) {
  const mergeBase = tryRun('git', ['merge-base', 'HEAD', upstream]);
  if (mergeBase) {
    addChangedFiles(changedFiles, ['diff', '--name-only', `${mergeBase}..HEAD`]);
  }
}

addChangedFiles(changedFiles, ['diff', '--name-only']);
addChangedFiles(changedFiles, ['diff', '--cached', '--name-only']);
addChangedFiles(changedFiles, ['ls-files', '--others', '--exclude-standard']);

// ============================================================================
// Merge Conflict Check
// ============================================================================
// If Git still has unmerged index entries, the branch has not made a real merge
// decision yet. Publishing from that state would hide unfinished conflict work.
// ============================================================================
const unmergedEntries = run('git', ['ls-files', '-u']);
if (unmergedEntries) {
  const files = new Set(
    unmergedEntries
      .split(/\r?\n/)
      .map((line) => line.split('\t').at(-1))
      .filter(Boolean),
  );
  failures.push(`Unresolved merge conflicts: ${[...files].join(', ')}`);
}

// ============================================================================
// Conflict Marker Check
// ============================================================================
// Sometimes conflict text gets committed even after Git believes the merge is
// resolved. Only the distinctive opening/closing markers are checked to avoid
// false positives from ordinary Markdown tables or code separators.
// ============================================================================
const textLikeExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.yml',
  '.yaml',
]);

for (const file of changedFiles) {
  const ext = path.extname(file).toLowerCase();
  if (!textLikeExtensions.has(ext)) continue;
  if (!fs.existsSync(file)) continue;

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (/^(<<<<<<<|>>>>>>>) /.test(line)) {
      failures.push(`Conflict marker in ${file}:${index + 1}`);
    }
  });
}

// ============================================================================
// Critical JSON Check
// ============================================================================
// JSON parse failures are cheap to detect and often break runtime data loading.
// This deliberately checks data/config syntax, not the full schema model.
// ============================================================================
const jsonRoots = [
  'package.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.scripts.json',
  'tsconfig.character.json',
  'tsconfig.combat.json',
  'tsconfig.services.json',
  'tsconfig.world.json',
  'public/data',
  'src/systems/spells/schema',
];

function isCriticalJson(file) {
  if (!file.endsWith('.json')) return false;
  return jsonRoots.some((entry) => file === entry || file.startsWith(`${entry}/`));
}

const jsonFiles = [...changedFiles]
  .filter(isCriticalJson)
  .map((file) => path.join(repoRoot, file))
  .filter((file) => fs.existsSync(file));

for (const file of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`Invalid JSON in ${path.relative(repoRoot, file)}: ${error.message}`);
  }
}

// ============================================================================
// Report
// ============================================================================
// A clean sync-check means the repo can be published from a Git/data-syntax
// standpoint. It does not claim the app is fully typechecked, linted, tested, or
// visually verified.
// ============================================================================
if (failures.length > 0) {
  console.error('\n!! Aralia sync-check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Aralia sync-check passed: no unresolved conflicts, conflict markers, or critical JSON syntax failures.');
