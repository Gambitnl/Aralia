import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildJulesStateReconciliation } from '../dist/task-intake.js';

// This verifier protects the explanation layer for Jules state mismatches.
// ARA-6 proved the local Jules record can say COMPLETED with no PR URL while
// Jules API/GitHub evidence has a PR. Symphony must show which evidence source
// reconciled that mismatch instead of pretending the stored Jules record was
// always complete.

const reconciled = buildJulesStateReconciliation({
  id: 'handoff-ara6',
  title: 'Add regression coverage for non-proficient weapon attack penalties',
  julesSessionId: '4101281510355198885',
  julesSessionUrl: 'https://jules.google.com/session/4101281510355198885',
  julesState: 'COMPLETED',
  githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
  githubPullRequestDiscovery: {
    status: 'matched',
    source: 'jules_api_session',
    handoffId: 'handoff-ara6',
    searchedAt: '2026-05-20T00:38:00.000Z',
    candidatesChecked: 1,
    matchedBy: ['jules_api_output'],
    url: 'https://github.com/Gambitnl/Aralia/pull/931',
    title: 'test: add regression coverage for non-proficient weapon attack penalties',
    headRefName: 'add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885',
    state: 'COMPLETED',
    summary: 'Matched GitHub PR from Jules API session output.',
    mutatesExternalSystems: false,
  },
  githubPullRequestRefreshError: null,
  lastPullRequestRefreshAt: '2026-05-20T00:40:00.000Z',
});

assert.equal(reconciled.status, 'reconciled_from_external_evidence');
assert.equal(reconciled.localStoredStateIncomplete, true);
assert.equal(reconciled.discoverySource, 'jules_api_session');
assert.deepEqual(reconciled.matchedBy, ['jules_api_output']);
assert.equal(reconciled.requiresBrowserCheck, false);
assert.equal(reconciled.mutatesExternalSystems, false);
assert.equal(reconciled.mutatesLocalFiles, false);
assert.match(reconciled.summary, /Jules API/);
assert.match(reconciled.nextExpectedProof, /Refresh PR checks/i);

const needsBrowser = buildJulesStateReconciliation({
  id: 'handoff-missing-pr',
  title: 'Missing PR example',
  julesSessionId: 'session-1',
  julesSessionUrl: 'https://jules.google.com/session/session-1',
  julesState: 'COMPLETED',
  githubPullRequestUrl: null,
  githubPullRequestDiscovery: {
    status: 'not_found',
    source: 'github_pr_list',
    handoffId: 'handoff-missing-pr',
    searchedAt: '2026-05-20T00:38:00.000Z',
    candidatesChecked: 100,
    matchedBy: [],
    url: null,
    title: null,
    headRefName: null,
    state: null,
    summary: 'No matching GitHub PR found.',
    mutatesExternalSystems: false,
  },
  githubPullRequestRefreshError: 'No matching GitHub PR found.',
  lastPullRequestRefreshAt: '2026-05-20T00:40:00.000Z',
});

assert.equal(needsBrowser.status, 'needs_browser_reconciliation');
assert.equal(needsBrowser.requiresBrowserCheck, true);
assert.match(needsBrowser.summary, /visible Jules session/i);

const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
assert.match(dashboard, /renderJulesStateReconciliation/);
assert.match(dashboard, /Jules state reconciliation/);
assert.match(dashboard, /julesStateReconciliation/);

const taskIntake = await readFile(new URL('../src/task-intake.ts', import.meta.url), 'utf8');
assert.match(taskIntake, /buildJulesStateReconciliation/);
assert.match(taskIntake, /reconciled_from_external_evidence/);
