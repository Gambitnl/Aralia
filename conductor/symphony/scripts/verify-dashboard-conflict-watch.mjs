import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// This verifier protects the dashboard/API alignment for multi-Jules conflict
// monitoring. The server now returns a machine-readable conflict_watch object;
// the browser should render that authoritative payload so the human view and
// headless foreman view do not drift into two different conflict policies.

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');

assert(dashboardSource.includes('renderCrossHandoffConflictWatch(snapshot.conflict_watch, handoffs)'));
assert(dashboardSource.includes('function renderApiConflictWatch(conflictWatch)'));
assert(dashboardSource.includes('The API owns this summary'));
assert(dashboardSource.includes('The older client-side calculation'));
assert(dashboardSource.includes('conflictWatch.summary'));

// Execute the browser renderer in a tiny DOM-like sandbox instead of only
// checking for source strings. This catches regressions where the dashboard
// still names conflict_watch but silently drops fields operators need.
const inertElement = {
  addEventListener() {},
  set innerHTML(_value) {},
  get innerHTML() {
    return '';
  },
  firstChild: { nodeValue: '' },
};
const executableSource = dashboardSource.replace(
  /\nrefreshDashboard\(\);\r?\nstartLiveRefresh\(\);\r?\n/,
  '\n// Top-level browser refresh is disabled by the contract verifier.\n'
);
const sandbox = {
  document: {
    getElementById() {
      return inertElement;
    },
    documentElement: { scrollHeight: 0 },
    body: { scrollHeight: 0 },
  },
  window: {
    scrollX: 0,
    scrollY: 0,
    pageXOffset: 0,
    pageYOffset: 0,
    innerHeight: 900,
    scrollTo() {},
  },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  URL,
  EventSource: undefined,
};

vm.runInNewContext(executableSource, sandbox, { filename: 'dashboard.js' });

const rendered = sandbox.renderCrossHandoffConflictWatch({
  status: 'blocked',
  summary: 'Scout must bridge two Jules PRs before Core merges either one.',
  overlap_files: [{
    path: 'src/components/Widget/index.ts',
    handoffs: [
      { id: 'handoff-a', title: 'Refresh widget state', pull_request_url: 'https://github.com/example/aralia/pull/41' },
      { id: 'handoff-b', title: 'Tune widget render', pull_request_url: 'https://github.com/example/aralia/pull/42' },
    ],
  }],
  risk_files: [{
    path: 'package.json',
    handoff_id: 'handoff-b',
    title: 'Tune widget render',
    pull_request_url: 'https://github.com/example/aralia/pull/42',
    risk: 'high',
    reason: 'Shared dependency manifest',
  }],
  next_action: null,
});

assert.match(rendered, /Scout must bridge two Jules PRs/);
assert.match(rendered, /src\/components\/Widget\/index\.ts/);
assert.match(rendered, /href="https:\/\/github\.com\/example\/aralia\/pull\/41"/);
assert.match(rendered, /href="https:\/\/github\.com\/example\/aralia\/pull\/42"/);
assert.match(rendered, /package\.json/);

const queueActionHtml = sandbox.renderQueueNextAction({
  code: 'bridge_cross_handoff_conflicts',
  tone: 'blocked',
  label: 'Bridge Jules PR Conflicts',
  summary: 'Scout must bridge overlapping Jules PR files before Core merges either PR.',
  source_type: 'conflict_watch',
  source_id: null,
  affected_pr_urls: [
    'https://github.com/example/aralia/pull/41',
    'https://github.com/example/aralia/pull/42',
  ],
  overlap_file_paths: ['src/components/Widget/index.ts'],
  risk_file_paths: ['package.json'],
  steps: [
    'Open the overlapping Jules PRs listed in affected_pr_urls and conflict_watch.overlap_files.',
    'Have Scout decide which PR owns each shared file before Core merges either PR.',
  ],
});

assert.match(queueActionHtml, /Queue next action: Bridge Jules PR Conflicts/);
assert.match(queueActionHtml, /Affected Jules PRs/);
assert.match(queueActionHtml, /href="https:\/\/github\.com\/example\/aralia\/pull\/41"/);
assert.match(queueActionHtml, /href="https:\/\/github\.com\/example\/aralia\/pull\/42"/);
assert.match(queueActionHtml, /src\/components\/Widget\/index\.ts/);
assert.match(queueActionHtml, /package\.json/);

const riskQueueActionHtml = sandbox.renderQueueNextAction({
  code: 'bridge_conflict_prone_files',
  tone: 'blocked',
  label: 'Bridge Conflict-Prone Files',
  summary: 'Scout should review conflict-prone Jules PR files before Core merges.',
  source_type: 'conflict_watch',
  source_id: null,
  affected_pr_urls: [
    'https://github.com/example/aralia/pull/43',
  ],
  overlap_file_paths: [],
  risk_file_paths: ['package.json'],
  steps: [
    'Open the affected Jules PRs listed in affected_pr_urls and conflict_watch.risk_files.',
    'Have Scout review the conflict-prone files before Core validates or merges.',
  ],
});

assert.match(riskQueueActionHtml, /Queue next action: Bridge Conflict-Prone Files/);
assert.match(riskQueueActionHtml, /Affected Jules PRs/);
assert.match(riskQueueActionHtml, /href="https:\/\/github\.com\/example\/aralia\/pull\/43"/);
assert.match(riskQueueActionHtml, /Conflict-prone files/);
assert.match(riskQueueActionHtml, /package\.json/);

const planApprovalCardHtml = sandbox.renderCardNextAction({
  code: 'approve_jules_plan',
  tone: 'ready',
  label: 'Approve Jules Plan',
  summary: 'Jules is waiting for the operator to approve its proposed plan before it continues.',
  url: 'http://127.0.0.1:8081/api/v1/jules-handoffs/handoff-plan/approve-plan',
  method: 'POST',
  jules_session_id: 'jules-plan-session',
  jules_session_url: 'https://jules.google.com/session/jules-plan-session',
  steps: [
    'Review the Jules plan in the session link or latest status output.',
    'Approve only if the plan respects the write scope and verification contract.',
  ],
});

assert.match(planApprovalCardHtml, /Next dashboard action: Approve Jules Plan/);
assert.match(planApprovalCardHtml, /Jules session/);
assert.match(planApprovalCardHtml, /href="https:\/\/jules\.google\.com\/session\/jules-plan-session"/);
assert.match(planApprovalCardHtml, /jules-plan-session/);

const feedbackCardHtml = sandbox.renderCardNextAction({
  code: 'send_jules_feedback',
  tone: 'ready',
  label: 'Send Jules Feedback',
  summary: 'Jules is waiting for operator feedback before it can continue.',
  url: 'http://127.0.0.1:8081/api/v1/jules-handoffs/handoff-feedback/message',
  method: 'POST',
  jules_session_id: 'jules-feedback-session',
  jules_session_url: 'https://jules.google.com/session/jules-feedback-session',
  request_body_schema: { body: 'string' },
  request_body_example: {
    body: 'Short bounded feedback for Jules after inspecting the session request.',
  },
  steps: [
    'Open the Jules session to read the request.',
    'Write a bounded operator note that preserves the task scope.',
  ],
});

assert.match(feedbackCardHtml, /Next dashboard action: Send Jules Feedback/);
assert.match(feedbackCardHtml, /Request body/);
assert.match(feedbackCardHtml, /&quot;body&quot;: &quot;string&quot;/);
assert.match(feedbackCardHtml, /Short bounded feedback for Jules/);

const draftQueueHtml = sandbox.renderQueueNextAction({
  code: 'draft_task',
  tone: 'waiting',
  label: 'Draft a Jules Task',
  summary: 'GitHub is ready, but there are no local drafts or Jules handoffs yet.',
  url: 'http://127.0.0.1:8081/api/v1/task-drafts',
  method: 'POST',
  source_type: 'task_queue',
  source_id: null,
  request_body_schema: {
    title: 'string',
    body: 'string',
    expectedFiles: 'string[] | newline-separated string',
    verificationCommands: 'string[] | newline-separated string',
  },
  request_body_example: {
    title: 'Bounded Jules task title',
    body: 'Plain-language task details, constraints, and intended result.',
    expectedFiles: ['src/path/or/write-scope'],
    verificationCommands: ['npm.cmd run build'],
  },
  steps: ['Describe a bounded task for Jules.'],
});

assert.match(draftQueueHtml, /Queue next action: Draft a Jules Task/);
assert.match(draftQueueHtml, /Request body/);
assert.match(draftQueueHtml, /&quot;expectedFiles&quot;: &quot;string\[\] \| newline-separated string&quot;/);
assert.match(draftQueueHtml, /Bounded Jules task title/);

const prActionHtml = sandbox.renderCardNextAction({
  code: 'resolve_pull_request_blockers',
  tone: 'blocked',
  label: 'Resolve PR Blockers',
  summary: 'GitHub reports a closed, conflicting, or failing PR state.',
  url: 'http://127.0.0.1:8081/api/v1/jules-handoffs/handoff-blocked/refresh-pr',
  method: 'POST',
  command: 'gh pr view 1 --comments',
  github_pull_request_url: 'https://github.com/example/repo/pull/1',
  steps: [
    'Inspect failed checks, conflicts, or risky files.',
    'Send follow-up work to Jules or repair the PR.',
  ],
});

assert.match(prActionHtml, /Next dashboard action: Resolve PR Blockers/);
assert.match(prActionHtml, /GitHub PR/);
assert.match(prActionHtml, /href="https:\/\/github\.com\/example\/repo\/pull\/1"/);
assert.match(prActionHtml, /Command/);
assert.match(prActionHtml, /gh pr view 1 --comments/);
