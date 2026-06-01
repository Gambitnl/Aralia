#!/usr/bin/env node

/*
 * This script enforces Aralia's local Git hygiene boundary.
 *
 * The project owner wants F:\Repos\Aralia to remain the primary tree on master,
 * with no quiet buildup of local branches or registered worktrees. The script
 * reports and blocks drift; it never deletes branches or worktrees by itself.
 */

const path = require('node:path');
const { execFileSync } = require('node:child_process');

// ============================================================================
// Process Helpers
// ============================================================================
// These helpers keep Git calls readable and make the final report specific
// enough for a human or future agent to fix the exact branch/worktree issue.
// ============================================================================
function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function splitList(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePath(value) {
  return path.resolve(value).replace(/\\/g, '/').toLowerCase();
}

function displayPath(value) {
  return path.resolve(value).replace(/\\/g, '/');
}

// ============================================================================
// Policy Inputs
// ============================================================================
// The defaults intentionally keep the local shape narrow: root checkout on
// master, no extra local branches, no extra registered worktrees. Exceptional
// cases must be made visible through explicit environment variables.
// ============================================================================
const repoRoot = run('git', ['rev-parse', '--show-toplevel']);
process.chdir(repoRoot);

const primaryTree = process.env.ARALIA_PRIMARY_TREE || 'F:\\Repos\\Aralia';
const primaryBranch = process.env.ARALIA_PRIMARY_BRANCH || 'master';
const allowedBranches = new Set([primaryBranch, ...splitList(process.env.ARALIA_GIT_HYGIENE_ALLOWED_BRANCHES)]);
const allowedWorktrees = new Set([
  normalizePath(primaryTree),
  ...splitList(process.env.ARALIA_GIT_HYGIENE_ALLOWED_WORKTREES).map(normalizePath),
]);

if (process.env.ARALIA_GIT_HYGIENE_BYPASS === '1') {
  console.warn('Git hygiene check bypassed because ARALIA_GIT_HYGIENE_BYPASS=1 is set.');
  console.warn(`Primary tree policy still expects ${displayPath(primaryTree)} on ${primaryBranch}.`);
  process.exit(0);
}

// ============================================================================
// Local Branch Audit
// ============================================================================
// Any branch outside the explicit allowlist is treated as unmanaged local growth.
// Agents should merge, delete, or deliberately allowlist it before pushing.
// ============================================================================
const branchOutput = run('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads']);
const localBranches = branchOutput.split(/\r?\n/).filter(Boolean);
const extraBranches = localBranches.filter((branch) => !allowedBranches.has(branch));

// ============================================================================
// Worktree Audit
// ============================================================================
// Registered worktrees are parsed from porcelain output so paths with spaces
// remain safe. Each block starts with "worktree <path>" and may include a branch.
// ============================================================================
const worktreeOutput = run('git', ['worktree', 'list', '--porcelain']);
const worktrees = [];
let current = null;

for (const line of worktreeOutput.split(/\r?\n/)) {
  if (line.startsWith('worktree ')) {
    if (current) worktrees.push(current);
    current = { path: line.slice('worktree '.length), branch: null };
    continue;
  }

  if (current && line.startsWith('branch ')) {
    current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
  }
}

if (current) worktrees.push(current);

const primaryKey = normalizePath(primaryTree);
const primaryWorktree = worktrees.find((entry) => normalizePath(entry.path) === primaryKey);
const extraWorktrees = worktrees.filter((entry) => !allowedWorktrees.has(normalizePath(entry.path)));

// ============================================================================
// Failure Collection
// ============================================================================
// Keep every finding in one report. That prevents a frustrating fix-one-rerun
// loop when both branches and worktrees have drifted.
// ============================================================================
const failures = [];

if (!primaryWorktree) {
  failures.push(`Primary tree is not registered as a Git worktree: ${displayPath(primaryTree)}`);
} else if (primaryWorktree.branch !== primaryBranch) {
  failures.push(
    `Primary tree must stay on ${primaryBranch}, but ${displayPath(primaryWorktree.path)} is on ${primaryWorktree.branch || 'detached HEAD'}`,
  );
}

if (extraBranches.length > 0) {
  failures.push(`Unmanaged local branches: ${extraBranches.join(', ')}`);
}

if (extraWorktrees.length > 0) {
  const summary = extraWorktrees
    .map((entry) => `${displayPath(entry.path)} (${entry.branch || 'detached HEAD'})`)
    .join(', ');
  failures.push(`Unmanaged registered worktrees: ${summary}`);
}

// ============================================================================
// Report
// ============================================================================
// Passing means the local Git shape is intentionally small. It does not claim
// that branches are merged, tests pass, or the repository is ready to publish.
// ============================================================================
if (failures.length > 0) {
  console.error('\n!! Aralia git hygiene check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error('');
  console.error('Expected local shape:');
  console.error(`- Primary tree: ${displayPath(primaryTree)}`);
  console.error(`- Primary branch: ${primaryBranch}`);
  console.error(`- Allowed branches: ${[...allowedBranches].join(', ')}`);
  console.error(`- Allowed worktrees: ${[...allowedWorktrees].join(', ')}`);
  console.error('');
  console.error('Temporary exceptions must be explicit:');
  console.error('- ARALIA_GIT_HYGIENE_ALLOWED_BRANCHES=branch-a,branch-b');
  console.error('- ARALIA_GIT_HYGIENE_ALLOWED_WORKTREES=F:/Repos/Aralia/.worktrees/example');
  console.error('- ARALIA_GIT_HYGIENE_BYPASS=1 for an emergency documented bypass');
  process.exit(1);
}

console.log(
  `Aralia git hygiene passed: primary tree ${displayPath(primaryTree)} is on ${primaryBranch}; ${localBranches.length} local branch(es), ${worktrees.length} worktree(s).`,
);
