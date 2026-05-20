import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects local task filing. Completing, archiving, or
// abandoning a task is a dashboard organization action only; it must not close
// Linear issues, send Jules feedback, touch GitHub, or mutate local Git.

const BASE_URL = 'http://127.0.0.1:8200';
const generatedAt = '2026-05-20T03:00:00.000Z';
let recordedDisposition = null;

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

const server = new HttpServer(8200, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return buildSnapshot(null);
  },
  async recordTaskDisposition(taskId, input) {
    if (input.state !== 'active' && !String(input.reason || '').trim()) {
      throw new Error('A reason is required when completing, archiving, or abandoning a task.');
    }
    recordedDisposition = { taskId, input };
    return buildSnapshot({
      taskId,
      taskKind: 'handoff',
      state: input.state,
      reason: input.reason,
      recordedAt: generatedAt,
      recordedBy: input.recordedBy || 'operator',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
      mutatesGit: false,
    });
  },
};

try {
  await server.start();

  const detailBefore = await getJson(`${BASE_URL}/api/v1/tasks/handoff-disposition`);
  assert.equal(detailBefore.kind, 'handoff');
  assert.equal(detailBefore.taskDisposition, null);
  assert.equal(detailBefore.links.taskDisposition, `${BASE_URL}/api/v1/tasks/handoff-disposition/disposition`);

  const afterArchive = await postJson(`${BASE_URL}/api/v1/tasks/handoff-disposition/disposition`, {
    state: 'abandoned',
    reason: 'Jules task was superseded by a cleaner follow-up.',
    recordedBy: 'codex_foreman',
  });
  assert.deepEqual(recordedDisposition, {
    taskId: 'handoff-disposition',
    input: {
      state: 'abandoned',
      reason: 'Jules task was superseded by a cleaner follow-up.',
      recordedBy: 'codex_foreman',
    },
  });
  assert.equal(afterArchive.handoffs[0].taskDisposition.state, 'abandoned');
  assert.equal(afterArchive.handoffs[0].taskDisposition.mutatesExternalSystems, false);
  assert.equal(afterArchive.handoffs[0].taskDisposition.mutatesLocalFiles, false);
  assert.equal(afterArchive.handoffs[0].taskDisposition.mutatesGit, false);

  const badPost = await postJson(`${BASE_URL}/api/v1/tasks/handoff-disposition/disposition`, {
    state: 'archived',
    reason: '',
  }, { expectStatus: 400 });
  assert.equal(badPost.error.code, 'bad_task_disposition');
} finally {
  await server.stop();
}

function buildSnapshot(taskDisposition) {
  return {
    drafts: [],
    handoffs: [{
      id: 'handoff-disposition',
      draftId: 'draft-disposition',
      title: 'Task filing baseline',
      executor: 'jules',
      status: 'sent_to_jules',
      prompt: 'Keep abandoned task handling local to Symphony.',
      expectedFiles: ['conductor/symphony/src/task-intake.ts'],
      verificationCommands: ['npm run verify:jules-contract'],
      createdAt: generatedAt,
      updatedAt: generatedAt,
      operatorMessages: [],
      planApprovals: [],
      taskMessages: [],
      taskDisposition,
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
      nextAction: { code: 'ready', tone: 'ready', label: 'Ready', command: null, summary: 'Ready.', steps: [] },
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
