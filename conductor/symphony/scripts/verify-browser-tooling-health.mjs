import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { HttpServer } from '../dist/server.js';

/**
 * Verifies the read-only browser follow-along health contract.
 *
 * This does not automate Jules and does not claim the browser bridge is always
 * reachable from the Symphony server. It protects the operator-facing rule that
 * a direct Playwright "Transport closed" failure is not enough to conclude
 * Jules is unavailable, and it gives later foremen one JSON packet to read
 * before deciding how to observe a live Jules session.
 */

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
    return 'http://127.0.0.1:8207';
  },
  getSnapshot() {
    return {
      generated_at: '2026-05-20T00:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: 'http://127.0.0.1:8207' },
    };
  },
};

const server = new HttpServer(8207, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [],
      handoffs: [],
      preflight: {
        ok: true,
        summary: 'GitHub sync is ready.',
        blockers: [],
        nextAction: { label: 'No Git blocker', summary: 'Ready.' },
      },
      gitDisposition: { categories: [], decidedCount: 0, totalRequired: 0, readyForHumanSync: true, summary: 'Ready.', updatedAt: null },
      gitSyncPlan: { status: 'ready', summary: 'Ready.', canExecute: false, mutatesGit: false, blockers: [], steps: [] },
      taskRouting: null,
      taskNudges: {
        total: 0,
        summary: 'No browser-health proof nudges.',
        latest: null,
        recent: [],
        nextNudgeAt: null,
        scheduler: {
          checkedAt: '2026-05-20T00:00:00.000Z',
          status: 'idle',
          summary: 'No recorded nudges are scheduled.',
          dueCount: 0,
          waitingCount: 0,
          blockedCount: 0,
          nextDueAt: null,
          mutatesExternalSystems: false,
          due: [],
          waiting: [],
          blocked: [],
        },
      },
    };
  },
};

try {
  await server.start();

  const packet = JSON.parse(await getText('http://127.0.0.1:8207/api/v1/browser-tooling-health'));
  assert.equal(packet.status, 'browser_bridge_required');
  assert.equal(packet.mutatesExternalSystems, false);
  assert.equal(packet.mutatesLocalFiles, false);
  assert.equal(packet.primaryPath.label, 'Codex Browser plugin bridge');
  assert.equal(packet.primaryPath.operatorVisible, true);
  assert.equal(packet.unreliablePath.knownFailure, 'Transport closed');
  assert.match(packet.unreliablePath.meaning, /signed-in Jules tab is still visible/);
  assert.match(packet.summary, /Use the Codex Browser plugin in-app bridge/);
  assert.match(packet.summary, /not as proof that the Jules session cannot be observed/);
  assert.ok(packet.allowedUses.includes('Use the Browser plugin bridge for live Jules page checks.'));
  assert.ok(packet.disallowedUses.includes('Do not treat direct Playwright transport failure as evidence that Jules is unavailable.'));
  assert.ok(packet.observedEvidence.some((entry) => entry.includes('4101281510355198885')));
  assert.match(packet.nextExpectedProof, /Browser plugin in-app evidence/);

  const proof = await getText('http://127.0.0.1:8207/proof');
  assert.match(proof, /Browser Follow-along/);
  assert.match(proof, /Browser tooling health JSON/);
  assert.match(proof, /Codex Browser plugin bridge/);
  assert.match(proof, /Transport closed/);

  const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
  assert.match(dashboardSource, /Browser tooling health JSON/);
  assert.match(dashboardSource, /\/api\/v1\/browser-tooling-health/);
} finally {
  await server.stop();
}

async function getText(url) {
  return await new Promise((resolve, reject) => {
    http.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}: ${body}`));
          return;
        }
        resolve(body);
      });
    }).on('error', reject);
  });
}
