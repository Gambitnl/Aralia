import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// This verifier protects the dashboard's readable activity layer. The worker
// stream still carries raw JSON-RPC, token deltas, and PowerShell commands, but
// the dashboard should translate that into operator language: "checked the
// Jules queue", "checked GitHub sync", or "this approval is waiting".

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
const readableStart = dashboardSource.indexOf('function readableIssueActivity');

assert(readableStart >= 0, 'dashboard.js should contain the readable activity helpers');

const context = vm.createContext({
  Date,
  JSON,
  Math,
  Number,
  RegExp,
  Set,
  String,
  console,
});

// Only evaluate the pure helper section. The top half of dashboard.js starts
// live fetch/EventSource refresh loops, which would make this verifier depend
// on a running local server instead of just the translation contract.
vm.runInContext(dashboardSource.slice(readableStart), context);

const commandEntry = {
  kind: 'command',
  title: 'powershell -NoLogo -Command "Invoke-RestMethod -Uri \'http://127.0.0.1:8081/api/v1/task-drafts\'"',
  detail: 'cwd: F:\\Repos\\Aralia\\conductor\\symphony\\.workspaces\\ARA-5',
  timestamp: '2026-05-17T00:00:00.000Z',
};

const readableCommand = context.humanizeActivity(commandEntry);

assert.equal(readableCommand.label, 'Command');
assert.equal(readableCommand.title, 'Checked Jules task queue');
assert.equal(
  readableCommand.operatorSummary,
  'The worker is reading the Jules task queue so it can see drafts, handoffs, and available actions.',
);
assert(readableCommand.detail.includes('Command: powershell -NoLogo -Command'));

const gitPreflightCommand = context.humanizeActivity({
  ...commandEntry,
  title: 'powershell -NoLogo -Command "Invoke-RestMethod -Uri \'http://127.0.0.1:8081/api/v1/git-preflight\'"',
});

assert.equal(gitPreflightCommand.title, 'Checked GitHub sync gate');
assert.equal(
  gitPreflightCommand.operatorSummary,
  'The worker is checking whether the current worktree and GitHub master are aligned before Jules starts cloud work.',
);

const rawJsonAssistantMessage = context.humanizeActivity({
  kind: 'assistant_message',
  title: 'Streaming text',
  detail: '{"rateLimits":{"primary":{"usedPercent":23},"secondary":{"usedPercent":4}}}',
  timestamp: '2026-05-17T00:00:01.000Z',
});

// Raw protocol captures are still available in the API, but they should not be
// promoted as readable dashboard activity because they are what made the page
// hard to understand in the first place.
assert.equal(rawJsonAssistantMessage, null);

const readableFeed = context.buildReadableActivity([
  {
    kind: 'usage',
    title: 'Rate limit status updated',
    detail: 'Primary window used: 23%\nWeekly window used: 4%',
    timestamp: '2026-05-17T00:00:02.000Z',
    source_type: 'rateLimits',
  },
  commandEntry,
]);

assert.equal(readableFeed.length, 1);
assert.equal(readableFeed[0].title, 'Checked Jules task queue');

