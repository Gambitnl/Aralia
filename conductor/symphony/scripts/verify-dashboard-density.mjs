import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// This verifier protects the main-dashboard density rule. The lower monitoring
// sections still need to exist, but idle usage, approval policy, running, and
// retry sections should not compete with the current foreman boundary. Urgent
// states must still open automatically so the operator does not miss work.

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');

assert.match(dashboardSource, /function renderDashboardDensitySection/);
assert.match(dashboardSource, /density-section/);
assert.match(dashboardSource, /No pending approvals/);
assert.match(dashboardSource, /No running issues/);
assert.match(dashboardSource, /No issues in retry queue/);

const roots = new Map();
const executableSource = dashboardSource.replace(
  /\nrefreshDashboard\(\);\r?\nstartLiveRefresh\(\);\r?\n/,
  '\n// Automatic dashboard refresh is disabled by the density verifier.\n',
);
const sandbox = {
  document: {
    getElementById(id) {
      if (!roots.has(id)) roots.set(id, makeRoot());
      return roots.get(id);
    },
    documentElement: { dataset: {}, scrollHeight: 0 },
    body: { scrollHeight: 0 },
  },
  window: {
    scrollX: 0,
    scrollY: 0,
    pageXOffset: 0,
    pageYOffset: 0,
    innerHeight: 900,
    matchMedia() {
      return { matches: false };
    },
    scrollTo() {},
  },
  localStorage: {
    getItem() {
      return null;
    },
    setItem() {},
  },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  URL,
  EventSource: undefined,
};

vm.runInNewContext(executableSource, sandbox, { filename: 'dashboard.js' });

const usageRoot = roots.get('usage-root');
const approvalRoot = roots.get('approval-root');
const runningRoot = roots.get('running-root');
const retryingRoot = roots.get('retrying-root');

sandbox.renderUsageTracker(baseState(), {});
assert.match(usageRoot.innerHTML, /<details class="density-section idle"/);
assert.doesNotMatch(usageRoot.innerHTML, /<details class="density-section idle" open>/);
assert.match(usageRoot.innerHTML, /Waiting for Codex usage data/);

sandbox.renderUsageTracker({
  ...baseState(),
  rate_limits: {
    primary: { usedPercent: 82, windowDurationMins: 300, resetsAt: 1790000000 },
  },
}, {});
assert.match(usageRoot.innerHTML, /<details class="density-section urgent" open>/);
assert.match(usageRoot.innerHTML, /Primary window/);

sandbox.renderApprovals([], {}, baseState());
assert.match(approvalRoot.innerHTML, /<details class="density-section idle card"/);
assert.match(approvalRoot.innerHTML, /No pending approvals/);
assert.match(approvalRoot.innerHTML, /Routine Approval Rules/);

sandbox.renderApprovals(['AR-1'], {
  'AR-1': {
    waiting_on_approval: true,
    issue_identifier: 'AR-1',
    worker_designation: 'Foreman-One',
    approval_summary: 'Approve test command',
    pending_approval: {
      can_respond: true,
      detail: 'The worker wants to run the verifier.',
      requested_at: '2026-05-17T00:00:00.000Z',
    },
    activity: [
      { kind: 'command', status: 'inProgress', title: 'Run verifier', detail: 'npm.cmd run verify:jules-contract' },
      { kind: 'approval', status: 'waiting', title: 'Approve command', detail: 'Command is waiting.' },
    ],
  },
}, baseState());
assert.match(approvalRoot.innerHTML, /approval needed/);
assert.doesNotMatch(approvalRoot.innerHTML, /density-section idle/);

sandbox.renderRunning([], {});
assert.match(runningRoot.innerHTML, /<details class="density-section idle"/);
assert.doesNotMatch(runningRoot.innerHTML, /<details class="density-section idle" open>/);
assert.match(runningRoot.innerHTML, /No running issues/);

sandbox.renderRunning([runningIssue()], { 'AR-2': { activity: [] } });
assert.match(runningRoot.innerHTML, /<details class="density-section active" open>/);
assert.match(runningRoot.innerHTML, /AR-2/);

sandbox.renderRetrying([]);
assert.match(retryingRoot.innerHTML, /<details class="density-section idle"/);
assert.doesNotMatch(retryingRoot.innerHTML, /<details class="density-section idle" open>/);
assert.match(retryingRoot.innerHTML, /No issues in retry queue/);

sandbox.renderRetrying([retryingIssue()]);
assert.match(retryingRoot.innerHTML, /<details class="density-section urgent" open>/);
assert.match(retryingRoot.innerHTML, /normal continuation retry/);

function makeRoot() {
  return {
    html: '',
    addEventListener() {},
    set innerHTML(value) {
      this.html = value;
    },
    get innerHTML() {
      return this.html;
    },
    firstChild: { nodeValue: '' },
  };
}

function baseState() {
  return {
    generated_at: '2026-05-17T00:00:00.000Z',
    running: [],
    retrying: [],
    codex_totals: { total_tokens: 0 },
    codex_policy: {
      approval_policy: 'on-failure',
      auto_approve_app_tools: ['linear.save_comment'],
    },
  };
}

function runningIssue() {
  return {
    issue_identifier: 'AR-2',
    detail_url: '/api/v1/AR-2/activity',
    worker_designation: 'Foreman-Two',
    waiting_on_approval: false,
    state: 'running',
    turn_count: 1,
    tokens: { input_tokens: 10, output_tokens: 20 },
    workspace_path: 'F:\\Repos\\Aralia',
    last_event: 'started',
    last_message: 'Running the task.',
  };
}

function retryingIssue() {
  return {
    issue_identifier: 'AR-3',
    detail_url: '/api/v1/AR-3/activity',
    worker_designation: 'Foreman-Three',
    attempt: 2,
    due_at: '2026-05-17T00:10:00.000Z',
    last_event: 'retry_scheduled',
    error: '',
  };
}
