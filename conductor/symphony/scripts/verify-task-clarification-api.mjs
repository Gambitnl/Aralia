import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the task-scoped clarification loop. Clarifications
// are structured local foreman questions and operator answers that happen
// before, or beside, Linear/Jules work. They must never send Jules feedback,
// create Linear issues, mutate GitHub, touch local files, or change Git.

const BASE_URL = 'http://127.0.0.1:8211';
const generatedAt = '2026-05-20T10:00:00.000Z';
let recordedClarification = null;

const logger = {
  child() {
    return logger;
  },
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const orchestrator = {
  getConfig() {
    return { tracker: { kind: 'linear', apiKey: 'test-key', projectSlug: 'aralia' } };
  },
  getDashboardBaseUrl() {
    return BASE_URL;
  },
  getSnapshot() {
    return {
      generated_at: generatedAt,
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { input_tokens: 0, output_tokens: 0, total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: BASE_URL },
    };
  },
};

const server = new HttpServer(8211, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return buildSnapshot([]);
  },
  async recordTaskClarification(taskId, input) {
    recordedClarification = { taskId, input };
    return buildSnapshot([{
      id: 'clarification-recorded',
      taskId,
      taskKind: 'draft',
      status: input.answer ? 'answered' : 'waiting_for_operator',
      question: input.question,
      answer: input.answer ?? null,
      requestedBy: 'codex_foreman',
      answeredBy: input.answer ? 'operator' : null,
      createdAt: generatedAt,
      answeredAt: input.answer ? generatedAt : null,
      source: 'foreman_clarification',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
      mutatesGit: false,
    }]);
  },
};

try {
  await server.start();

  const detailBefore = await getJson(`${BASE_URL}/api/v1/tasks/draft-clarify`);
  assert.equal(detailBefore.kind, 'draft');
  assert.equal(detailBefore.clarificationState.status, 'waiting_for_operator');
  assert.equal(detailBefore.clarificationState.pendingCount, 1);
  assert.equal(detailBefore.clarificationState.latestQuestion.question, 'Which files should Jules be allowed to edit?');
  assert.equal(detailBefore.clarificationState.mutatesExternalSystems, false);
  assert.equal(detailBefore.links.taskClarifications, `${BASE_URL}/api/v1/tasks/draft-clarify/clarifications`);
  assert.equal(detailBefore.needsHumanInput, true);

  const afterPost = await postJson(`${BASE_URL}/api/v1/tasks/draft-clarify/clarifications`, {
    question: 'Is the task allowed to touch CI setup files?',
    answer: 'No. Keep this Jules task scoped to regression tests only.',
  });
  assert.equal(recordedClarification.taskId, 'draft-clarify');
  assert.deepEqual(recordedClarification.input, {
    question: 'Is the task allowed to touch CI setup files?',
    answer: 'No. Keep this Jules task scoped to regression tests only.',
  });
  assert.equal(afterPost.drafts[0].taskClarifications.length, 1);
  assert.equal(afterPost.drafts[0].taskClarifications[0].status, 'answered');
  assert.equal(afterPost.drafts[0].taskClarifications[0].mutatesExternalSystems, false);
  assert.equal(afterPost.drafts[0].taskClarifications[0].mutatesLocalFiles, false);
  assert.equal(afterPost.drafts[0].taskClarifications[0].mutatesGit, false);

  const badPost = await postJson(`${BASE_URL}/api/v1/tasks/draft-clarify/clarifications`, {
    question: '',
  }, { expectStatus: 400 });
  assert.equal(badPost.error.code, 'bad_task_clarification');
} finally {
  await server.stop();
}

function buildSnapshot(taskClarifications) {
  return {
    drafts: [{
      id: 'draft-clarify',
      title: 'Clarify before Jules',
      body: 'Codex should clarify this task before sending it to Linear or Jules.',
      expectedFiles: ['src/commands/factory/__tests__/AbilityCommandFactory.test.ts'],
      verificationCommands: ['npm run test -- src/commands/factory/__tests__/AbilityCommandFactory.test.ts'],
      taskMessages: [],
      taskClarifications: taskClarifications.length ? taskClarifications : [{
        id: 'clarification-existing',
        taskId: 'draft-clarify',
        taskKind: 'draft',
        status: 'waiting_for_operator',
        question: 'Which files should Jules be allowed to edit?',
        answer: null,
        requestedBy: 'codex_foreman',
        answeredBy: null,
        createdAt: generatedAt,
        answeredAt: null,
        source: 'foreman_clarification',
        mutatesExternalSystems: false,
        mutatesLocalFiles: false,
        mutatesGit: false,
      }],
      taskDisposition: null,
      executor: 'jules',
      status: 'ready_for_handoff',
      linearIssueId: null,
      linearIssueIdentifier: null,
      linearIssueUrl: null,
      linearIssueCreatedAt: null,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    }],
    handoffs: [],
    preflight: {
      ok: true,
      checkedAt: generatedAt,
      repoRoot: 'F:\\Repos\\Aralia',
      baseBranch: 'master',
      remoteBranch: 'origin/master',
      currentBranch: 'master',
      localCommit: 'local',
      remoteCommit: 'remote',
      ahead: 0,
      behind: 0,
      dirtyFiles: 0,
      untrackedFiles: 0,
      blockers: [],
      summary: 'Ready.',
      details: [],
      dirtyFileSamples: [],
      untrackedFileSamples: [],
      resolutionPacket: { commands: {} },
      remediation: [],
      nextAction: { code: 'ready_for_jules', tone: 'ready', label: 'Ready', command: null, summary: 'Ready.', steps: [] },
      commands: {},
    },
    gitDisposition: { categories: [], decidedCount: 0, totalRequired: 0, readyForHumanSync: true, summary: 'No Git disposition decisions required.', updatedAt: null },
    gitSyncPlan: { generatedAt, status: 'ready', mutatesGit: false, canExecute: false, summary: 'Ready.', requiredDispositions: [], blockers: [], steps: [] },
    taskRouting: null,
    taskNudges: { total: 0, summary: 'No nudges.', latest: null, recent: [], nextNudgeAt: null, scheduler: { checkedAt: generatedAt, status: 'idle', summary: 'No nudges due.', dueCount: 0, waitingCount: 0, blockedCount: 0, nextDueAt: null, mutatesExternalSystems: false, due: [], waiting: [], blocked: [] } },
  };
}

async function getJson(url, options = {}) {
  return await requestJson('GET', url, null, options);
}

async function postJson(url, payload, options = {}) {
  return await requestJson('POST', url, payload, options);
}

async function requestJson(method, url, payload = null, options = {}) {
  return await new Promise((resolve, reject) => {
    const request = http.request(url, {
      method,
      headers: payload ? { 'Content-Type': 'application/json' } : {},
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        const expectedStatus = options.expectStatus ?? 200;
        if (response.statusCode !== expectedStatus) {
          reject(new Error(`Expected HTTP ${expectedStatus}, got ${response.statusCode}: ${body}`));
          return;
        }
        resolve(JSON.parse(body));
      });
    });
    request.on('error', reject);
    if (payload) request.write(JSON.stringify(payload));
    request.end();
  });
}
