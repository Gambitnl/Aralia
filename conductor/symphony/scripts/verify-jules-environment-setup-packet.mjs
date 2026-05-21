import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// Jules environment setup is an external Jules configuration action. This
// verifier protects Symphony's local, read-only packet so the dashboard records
// the actual Spell Phase 1 setup boundary and points to the next Package 2
// dispatch proof instead of keeping a stale missing-snapshot blocker.

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
  assert.equal(packet.status, 'package2_scoped_snapshot_passed');
  assert.equal(packet.mutatesExternalSystems, false);
  assert.equal(packet.mutatesLocalFiles, false);
  assert.deepEqual(packet.recommendedScript, [
    'npm ci --no-audit --no-fund',
    'npm run validate:spells',
    'npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose',
  ]);
  assert.deepEqual(packet.diagnosticScript, [
    'npm ci --no-audit --no-fund',
    'npm run typecheck',
    'npm run validate:spells',
  ]);
  assert.match(packet.summary, /snapshot boundary has been recorded/);
  assert.match(packet.summary, /Package 2 scoped setup passed/);
  assert.doesNotMatch(packet.summary, /ARA-6|PR #931/);
  assert.match(packet.currentBlockers.join('\n'), /No environment-snapshot blocker remains for Package 2/);
  assert.match(packet.currentBlockers.join('\n'), /Broad clean-clone typecheck remains classified/);
  assert(packet.completedEvidence.includes('docs/tasks/spells/evidence/jules-env-config-spell-phase1-package2-scoped-snapshot-passed-2026-05-21.png'));
  assert.equal(packet.documentedJulesEnvironment.taskRuntime, 'short-lived Ubuntu VM');
  assert(packet.documentedJulesEnvironment.preinstalledTools.includes('rg'));
  assert.equal(packet.documentedJulesEnvironment.nodeVersion, '22.16.0');
  assert.equal(packet.documentedJulesEnvironment.npmVersion, '11.4.2');
  assert.equal(packet.documentedJulesEnvironment.sourceUrl, 'https://jules.google/docs/environment/');
  assert.equal(packet.operatorAction.canRunNow, true);
  assert.equal(packet.operatorAction.requiresOperatorApproval, false);
  assert.equal(packet.operatorAction.mutatesExternalSystemsIfRun, false);
  assert.equal(packet.operatorAction.mutatesLocalFilesIfRun, false);
  assert.match(packet.operatorAction.detail, /environment snapshot gate is clear for Package 2/);
  assert.match(packet.nextExpectedProof, /PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD\.json/);
  assert.match(packet.nextExpectedProof, /PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT\.md/);
} finally {
  await server.stop();
}

const serverSource = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
assert.match(serverSource, /\/api\/v1\/jules-environment-setup/);
assert.match(serverSource, /Jules Environment Setup/);
assert.match(serverSource, /Environment setup JSON/);
