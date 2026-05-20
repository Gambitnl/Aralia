import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// Jules environment setup is an external Jules configuration action. This
// verifier protects Symphony's local, read-only packet so the dashboard can
// recommend an honest setup script without clicking Run and Snapshot or hiding
// the current lockfile repair blocker.

const BASE_URL = 'http://127.0.0.1:8211';

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
      generated_at: '2026-05-20T00:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: BASE_URL },
    };
  },
};

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve({ statusCode: response.statusCode, body: JSON.parse(body) });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

const server = new HttpServer(8211, orchestrator, logger);

try {
  await server.start();
  const response = await getJson('/api/v1/jules-environment-setup');
  const packet = response.body;

  assert.equal(response.statusCode, 200);
  assert.equal(packet.status, 'blocked_by_lockfile_repair');
  assert.equal(packet.mutatesExternalSystems, false);
  assert.equal(packet.mutatesLocalFiles, false);
  assert.deepEqual(packet.recommendedScript, [
    'npm ci --no-audit --no-fund',
    'npm run typecheck',
  ]);
  assert.deepEqual(packet.diagnosticScript, [
    'npm install --no-audit --no-fund',
    'npm run typecheck',
  ]);
  assert.match(packet.summary, /Do not run a Jules environment snapshot yet/);
  assert.match(packet.currentBlockers.join('\n'), /PR #931 setup repair is prepared locally but not pushed/);
  assert.match(packet.currentBlockers.join('\n'), /npm ci is expected to fail/);
  assert.equal(packet.documentedJulesEnvironment.taskRuntime, 'short-lived Ubuntu VM');
  assert(packet.documentedJulesEnvironment.preinstalledTools.includes('rg'));
  assert.equal(packet.documentedJulesEnvironment.nodeVersion, '22.16.0');
  assert.equal(packet.documentedJulesEnvironment.npmVersion, '11.4.2');
  assert.equal(packet.documentedJulesEnvironment.sourceUrl, 'https://jules.google/docs/environment/');
  assert.equal(packet.operatorAction.canRunNow, false);
  assert.equal(packet.operatorAction.requiresOperatorApproval, true);
  assert.equal(packet.operatorAction.mutatesExternalSystemsIfRun, true);
  assert.equal(packet.operatorAction.mutatesLocalFilesIfRun, false);
  assert.match(packet.nextExpectedProof, /Operator-approved Jules Environment page snapshot/);
} finally {
  await server.stop();
}

const serverSource = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
assert.match(serverSource, /\/api\/v1\/jules-environment-setup/);
assert.match(serverSource, /Jules Environment Setup/);
assert.match(serverSource, /Environment setup JSON/);
