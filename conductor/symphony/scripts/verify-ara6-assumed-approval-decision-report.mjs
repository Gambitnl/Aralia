import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * This verifier protects the ARA-6 assumed-approval report.
 *
 * The operator allowed this one test flow to keep moving without stopping at
 * every phase boundary. That only stays safe if the report records what the
 * agent decided, why it decided that, what it mutated, and what proof must come
 * next.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

// Read the durable report and the two status ledgers that should point at it.
const report = readFileSync(
  join(root, 'docs', 'decision-reports', 'ARA-6_ASSUMED_APPROVAL_DECISIONS.md'),
  'utf8'
);
const openTasks = readFileSync(join(root, 'docs', 'tasks', 'SYMPHONY_OPEN_TASKS.md'), 'utf8');
const audit = readFileSync(join(root, 'JULES_MIDDLEMAN_AUDIT.md'), 'utf8');

// The report must make the scope narrow so later agents do not treat this as a
// general approval bypass.
assert.match(report, /scoped only to this ARA-6 flow/);
assert.match(report, /does not generalize to\s+future tasks/);

// Decision 1 records the first external mutation and the exact reason it looked
// acceptable before GitHub revealed the poison-file conflict.
assert.match(report, /Decision 1: Push Local Lockfile Repair/);
assert.match(report, /Phase: `github_pr`/);
assert.match(report, /Options considered: push the local repair commit, wait/);
assert.match(report, /Decision made by agent: pushed local worktree commit `19eb1cd4`/);
assert.match(report, /repair base\s+matched PR head `0c0d9480`/);
assert.match(report, /Mutation performed: pushed/);
assert.match(report, /Poison File Check still failed/);
assert.match(report, /Next expected proof: inspect the remaining failing logs/);

// Decision 2 records the corrective repair that preserved the no-lockfile PR
// policy while keeping the PR moving through checks.
assert.match(report, /Decision 2: Replace Forbidden Lockfile Repair With CI Install-Lane Repair/);
assert.match(report, /Decision made by agent: created and pushed commit `f755df2b`/);
assert.match(report, /removes\s+the PR lockfile diff/);
assert.match(report, /`npm install --no-audit --no-fund`/);
assert.match(report, /full `npm run lint`\s+exits with 0 errors/);
assert.match(report, /`npx tsc --noEmit` passes/);
assert.match(report, /`npm run build` passes/);
assert.match(report, /Result: PR #931 advanced to head `f755df2b`/);
assert.match(report, /Poison File Check passed/);
assert.match(report, /Build, Lint, Tests, and Quality Scan still failed at `npm ci`/);
assert.match(report, /workflow install\s+step used by GitHub for this PR did not switch/);
assert.match(report, /Next expected proof: treat the remaining blocker as a coordinator lockfile/);

// Decision 3 records the stop condition: after two bounded pushes, the remaining
// failure belongs to the coordinator/base dependency lane rather than PR-local
// edits.
assert.match(report, /Decision 3: Stop PR-Local Repair And Escalate The Lockfile Boundary/);
assert.match(report, /Decision made by agent: stop mutating PR #931/);
assert.match(report, /no third PR push was made/);
assert.match(report, /blocked by the base\s+lockfile mismatch/);
assert.match(report, /Jules pushed bot commit `bb44a2f7`/);
assert.match(report, /final PR diff to the task note plus the two test\s+files/);

// The live docs must point future foremen to the report instead of making them
// infer approval decisions from chat history.
assert.match(openTasks, /ARA-6_ASSUMED_APPROVAL_DECISIONS\.md/);
assert.match(openTasks, /Assumed approval has already been used for the two ARA-6 repair pushes/);
assert.match(openTasks, /PR #931 head `bb44a2f7`/);
assert.match(openTasks, /coordinator-owned base lockfile mismatch/);
assert.match(audit, /ARA-6_ASSUMED_APPROVAL_DECISIONS\.md/);
assert.match(audit, /coordinator-owned base lockfile blocker/);
assert.match(audit, /Jules then pushed bot commit `bb44a2f7`/);
