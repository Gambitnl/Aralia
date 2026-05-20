import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the first task-scoped chat surface. These messages
// are local Symphony task notes for the operator/Codex foreman conversation;
// they must not send feedback to Jules, create Linear issues, mutate GitHub, or
// touch local Git. The separate Jules message endpoint remains the explicit
// external feedback path.

const BASE_URL = 'http://127.0.0.1:8198';
const generatedAt = '2026-05-20T01:00:00.000Z';
let recordedTaskMessage = null;

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

const server = new HttpServer(8198, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return buildSnapshot();
  },
  async recordTaskMessage(taskId, input) {
    recordedTaskMessage = { taskId, input };
    return {
      ...buildSnapshot(),
      handoffs: [{
        ...buildSnapshot().handoffs[0],
        taskMessages: [{
          id: 'task-message-recorded',
          taskId,
          taskKind: 'handoff',
          author: input.author,
          body: input.body,
          createdAt: generatedAt,
          source: 'task_chat',
          mutatesExternalSystems: false,
          mutatesLocalFiles: false,
          mutatesGit: false,
        }],
      }],
    };
  },
};

try {
  await server.start();

  const detailBefore = await getJson(`${BASE_URL}/api/v1/tasks/handoff-message`);
  assert.equal(detailBefore.kind, 'handoff');
  assert.equal(detailBefore.taskMessages.length, 1);
  assert.equal(detailBefore.taskMessages[0].body, 'What exactly should the foreman clarify?');
  assert.equal(detailBefore.taskMessages[0].mutatesExternalSystems, false);
  assert.equal(detailBefore.links.taskMessages, `${BASE_URL}/api/v1/tasks/handoff-message/messages`);

  const afterPost = await postJson(`${BASE_URL}/api/v1/tasks/handoff-message/messages`, {
    author: 'codex_foreman',
    body: 'I will wait for the operator before sending Jules feedback.',
  });
  assert.equal(recordedTaskMessage.taskId, 'handoff-message');
  assert.deepEqual(recordedTaskMessage.input, {
    author: 'codex_foreman',
    body: 'I will wait for the operator before sending Jules feedback.',
  });
  assert.equal(afterPost.handoffs[0].taskMessages.length, 1);
  assert.equal(afterPost.handoffs[0].taskMessages[0].mutatesExternalSystems, false);
  assert.equal(afterPost.handoffs[0].taskMessages[0].mutatesLocalFiles, false);
  assert.equal(afterPost.handoffs[0].taskMessages[0].mutatesGit, false);
  assert.equal(afterPost.handoffs[0].taskMessages[0].author, 'codex_foreman');

  const badPost = await postJson(`${BASE_URL}/api/v1/tasks/handoff-message/messages`, {
    author: 'codex_foreman',
    body: '',
  }, { expectStatus: 400 });
  assert.equal(badPost.error.code, 'bad_task_message');
} finally {
  await server.stop();
}

function buildSnapshot() {
  return {
    drafts: [],
    handoffs: [{
      id: 'handoff-message',
      draftId: 'draft-message',
      title: 'Task chat baseline',
      executor: 'jules',
      status: 'sent_to_jules',
      prompt: 'Keep task-scoped discussion local unless the operator chooses Jules feedback.',
      expectedFiles: ['conductor/symphony/src/task-intake.ts'],
      verificationCommands: ['npm run verify:jules-contract'],
      createdAt: generatedAt,
      updatedAt: generatedAt,
      operatorMessages: [],
      planApprovals: [],
      taskMessages: [{
        id: 'task-message-existing',
        taskId: 'handoff-message',
        taskKind: 'handoff',
        author: 'operator',
        body: 'What exactly should the foreman clarify?',
        createdAt: generatedAt,
        source: 'task_chat',
        mutatesExternalSystems: false,
        mutatesLocalFiles: false,
        mutatesGit: false,
      }],
    }],
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

async function getJson(url) {
  return await requestJson('GET', url);
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
