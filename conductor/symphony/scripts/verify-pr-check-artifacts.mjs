import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizePullRequestChecks } from '../dist/task-intake.js';

// This verifier protects the bridge between GitHub Actions improvements and
// Symphony's PR foreman surface. A CI job is not useful to Symphony if its
// machine-readable artifact stays buried in GitHub logs.

const checks = summarizePullRequestChecks([
  {
    name: 'Quality Scan (advisory)',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    detailsUrl: 'https://github.com/example/aralia/actions/runs/123456789/job/987654321',
  },
  {
    name: 'Build',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
  },
]);

assert.equal(checks.conclusion, 'passing');
assert.equal(checks.artifacts.length, 1);
assert.equal(checks.artifacts[0].checkName, 'Quality Scan (advisory)');
assert.equal(checks.artifacts[0].artifactName, 'quality-scan-json');
assert.equal(checks.artifacts[0].detailsUrl, 'https://github.com/example/aralia/actions/runs/123456789/job/987654321');
assert.match(checks.artifacts[0].summary, /GitHub step summary/);
assert.match(checks.artifacts[0].summary, /Machine-readable/);

const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
assert.match(dashboard, /function renderPullRequestCheckArtifacts/);
assert.match(dashboard, /quality-scan-json/);
assert.match(dashboard, /GitHub step summary/);
assert.match(dashboard, /Machine-readable CI artifact/);
assert.match(dashboard, /artifact\.detailsUrl/);
assert.match(dashboard, /Open check details/);
