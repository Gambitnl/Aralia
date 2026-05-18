import assert from 'node:assert/strict';
import { buildTurnPrompt, renderPrompt } from '../dist/prompt-renderer.js';

// This verifier protects the instruction layer that turns Codex workers into
// Symphony foremen. A worker prompt must say "coordinate Jules, watch GitHub,
// and sync local master" before it sees the Linear issue body, otherwise the
// agent can drift back into broad local implementation.

const issue = {
  id: 'linear-id',
  identifier: 'ARA-123',
  title: 'Delegate a bounded Widget change',
  description: 'Use Jules for the coding work and monitor the PR.',
  priority: 2,
  state: 'Todo',
  branchName: null,
  url: 'https://linear.app/example/issue/ARA-123',
  labels: ['jules'],
  blockedBy: [],
  createdAt: new Date('2026-05-17T00:00:00.000Z'),
  updatedAt: new Date('2026-05-17T00:00:00.000Z'),
};

const worker = {
  designation: 'worker-ARA-123-run-0007',
  runNumber: 7,
  attempt: null,
  issueIdentifier: 'ARA-123',
  workspacePath: 'F:\\Repos\\Aralia\\conductor\\symphony\\.workspaces\\ARA-123',
  threadId: 'thread-123',
  model: 'gpt-5.5',
  reasoningEffort: 'high',
  startedAt: new Date('2026-05-17T00:01:00.000Z'),
};

const dashboardBaseUrl = 'http://127.0.0.1:8081';
const template = [
  '# Worker Issue',
  'Issue {{ issue.identifier }}: {{ issue.title }}',
  'Description: {{ issue.description }}',
].join('\n');

const firstTurnPrompt = await renderPrompt(template, issue, null, worker, dashboardBaseUrl);

// The first turn should carry both identity and workflow boundaries before the
// rendered issue content. That gives status comments a stable callsign and
// tells the worker which dashboard APIs to use as its control surface.
assert(firstTurnPrompt.includes('Symphony worker designation: worker-ARA-123-run-0007'));
assert(firstTurnPrompt.includes('This worker is only assigned to ARA-123.'));
assert(firstTurnPrompt.includes('Requested Codex model: gpt-5.5.'));
assert(firstTurnPrompt.includes('Requested reasoning effort: high.'));
assert(firstTurnPrompt.includes('Assigned issue dashboard API: http://127.0.0.1:8081/api/v1/ARA-123'));
assert(firstTurnPrompt.includes('Assigned issue activity API: http://127.0.0.1:8081/api/v1/ARA-123/activity'));
assert(firstTurnPrompt.includes('Your default job is to coordinate a bounded Jules task, not to implement broad code changes locally.'));
assert(firstTurnPrompt.includes('/api/v1/task-drafts'));
assert(firstTurnPrompt.includes('/api/v1/git-preflight'));
assert(firstTurnPrompt.includes('/api/v1/jules-handoffs/refresh-all'));
assert(firstTurnPrompt.includes('top-level `next_action`'));
assert(firstTurnPrompt.includes('Use `next_action.url` and `next_action.method` as the dashboard-approved control endpoint'));
assert(firstTurnPrompt.includes('When `next_action.request_body_schema` is present, follow that JSON shape exactly'));
assert(firstTurnPrompt.includes('When `next_action.affected_pr_urls` is present, open those Jules PRs before giving Scout/Core guidance'));
assert(firstTurnPrompt.includes('When `next_action.github_pull_request_url` is present, open that Jules PR before refreshing checks, giving Scout/Core guidance, or syncing local master'));
assert(firstTurnPrompt.includes('When `next_action.jules_session_url` is present, inspect that Jules session before approving plans or sending feedback'));
assert(firstTurnPrompt.includes('`conflict_watch.status` as `blocked`'));
assert(firstTurnPrompt.includes('`conflict_watch.status` as `attention`'));
assert(firstTurnPrompt.includes('bridge those overlapping Jules PR files through Scout before asking Core'));
assert(firstTurnPrompt.includes('Do local code edits only for Symphony/Jules orchestration itself'));
assert(firstTurnPrompt.includes('Issue ARA-123: Delegate a bounded Widget change'));

const continuationPrompt = await buildTurnPrompt(template, issue, 1, 2, 3, worker, dashboardBaseUrl);

// Continuation prompts are shorter, but they still need the foreman guardrails
// because retries and later turns are exactly where agents tend to drift away
// from the intended Jules/GitHub/local-sync workflow.
assert(continuationPrompt.includes('Symphony worker designation: worker-ARA-123-run-0007'));
assert(continuationPrompt.includes('Review the current foreman state: GitHub sync, Jules handoff/session, PR checks, merge readiness, and local sync.'));
assert(continuationPrompt.includes('Do not drift into broad local implementation unless the operator explicitly asked for local-only coding.'));
assert(continuationPrompt.includes('This is turn 2.'));
assert(continuationPrompt.includes('This is attempt 1.'));
