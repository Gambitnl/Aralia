import assert from 'node:assert/strict';
import { summarizePullRequestFiles } from '../dist/task-intake.js';

// This verifier protects the PR review contract after Jules returns cloud work.
// The operator's expected-file list is supposed to become a real review
// boundary: Scout/Core should see when Jules changed files outside that scope,
// and poison files such as lockfiles should stay visible before merge/local sync.

const scopedPr = {
  changedFiles: 2,
  additions: 18,
  deletions: 4,
  files: [
    {
      path: 'src/components/Widget/Widget.tsx',
      additions: 12,
      deletions: 2,
    },
    {
      path: 'src/components/Widget/index.ts',
      additions: 6,
      deletions: 2,
    },
  ],
};

// Directory scopes should be ergonomic for the dashboard. If the operator names
// `src/components/Widget`, Jules can touch files under that folder without
// tripping the out-of-scope alarm, while registry/index risk still asks Scout to
// take a closer look before Core merges.
const scopedSummary = summarizePullRequestFiles(scopedPr, ['src/components/Widget']);

assert.equal(scopedSummary.outOfScopeFiles.length, 0);
assert.equal(scopedSummary.risk, 'medium');
assert(scopedSummary.riskReasons.includes('Registry/index file changed.'));

const globScopedPr = {
  changedFiles: 3,
  additions: 80,
  deletions: 20,
  files: [
    { path: 'public/premade-characters/kael_ironvow.json', additions: 40, deletions: 10 },
    { path: 'src/utils/combat/__tests__/combatUtils_premade.test.ts', additions: 32, deletions: 0 },
    { path: 'src/utils/combat/combatUtils.ts', additions: 8, deletions: 10 },
  ],
};

// Spell Package 2 uses wildcard write scopes for premade fixtures and matching
// combat utility tests. Scout/Core should treat matching files as in-scope so
// real review focuses on CI, churn, and gameplay risk instead of a false scope
// alarm.
const globScopedSummary = summarizePullRequestFiles(globScopedPr, [
  'public/premade-characters/*.json',
  'src/utils/combat/combatUtils.ts',
  'src/utils/combat/__tests__/combatUtils_*.test.ts',
]);

assert.equal(globScopedSummary.outOfScopeFiles.length, 0);
assert.doesNotMatch(globScopedSummary.riskReasons.join(' '), /Outside declared Jules write scope/);

const outOfScopePr = {
  changedFiles: 3,
  additions: 44,
  deletions: 9,
  files: [
    {
      path: 'src/components/Widget/Widget.tsx',
      additions: 20,
      deletions: 4,
    },
    {
      path: 'package-lock.json',
      additions: 18,
      deletions: 5,
    },
    {
      path: 'src/systems/spells/index.ts',
      additions: 6,
      deletions: 0,
    },
  ],
};

const outOfScopeSummary = summarizePullRequestFiles(outOfScopePr, ['src/components/Widget']);

// Out-of-scope changes are high risk even if GitHub checks are green. This is
// the dashboard warning that keeps Jules PR review tied to the original task
// contract instead of treating every cloud diff as acceptable by default.
assert.equal(outOfScopeSummary.risk, 'high');
assert.deepEqual(outOfScopeSummary.outOfScopeFiles, [
  'package-lock.json',
  'src/systems/spells/index.ts',
]);
assert(outOfScopeSummary.riskReasons.includes('Outside declared Jules write scope.'));
assert(outOfScopeSummary.riskReasons.includes('Out-of-scope files changed: 2 file(s) outside declared Jules write scope.'));

