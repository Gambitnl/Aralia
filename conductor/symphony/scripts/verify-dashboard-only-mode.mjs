import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';

// This verifier protects the safe live-inspection mode. The user needs to
// watch the real dashboard and Git preflight in the Codex app browser without
// accidentally claiming Linear issues or spawning Codex workers. This starts
// the built CLI in dashboard-only mode and proves the HTTP dashboard comes up
// while no worker dispatch happens.

const port = 8191;
const child = spawn(process.execPath, ['dist/index.js', 'WORKFLOW-mock.md', '--port', String(port), '--dashboard-only'], {
  cwd: new URL('..', import.meta.url),
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let output = '';
child.stdout.on('data', chunk => {
  output += chunk.toString();
});
child.stderr.on('data', chunk => {
  output += chunk.toString();
});

try {
  await waitForDashboard(port, 10_000);

  const state = await getJson(`http://127.0.0.1:${port}/api/v1/state`);
  assert.equal(state.dispatch_control.enabled, false, 'Dashboard-only mode must expose dispatch as paused.');
  assert.equal(state.dispatch_control.status, 'paused');
  assert.equal(state.dashboard.dispatch_control_url, `http://127.0.0.1:${port}/api/v1/dispatch-control`);
  assert.equal(state.counts.running, 0, 'Dashboard-only mode must not dispatch running workers.');
  assert.equal(state.counts.retrying, 0, 'Dashboard-only mode must not schedule worker retries.');
  assert.deepEqual(state.worker_roster, [], 'Dashboard-only mode should expose an empty worker roster.');
  assert.equal(state.dashboard.base_url, `http://127.0.0.1:${port}`);

  const dispatchControl = await getJson(`http://127.0.0.1:${port}/api/v1/dispatch-control`);
  assert.equal(dispatchControl.enabled, false, 'Dispatch control endpoint should default to paused.');

  const taskDrafts = await getJson(`http://127.0.0.1:${port}/api/v1/task-drafts`);
  assert(taskDrafts.preflight, 'Dashboard-only mode must still expose task intake and Git preflight.');
  assert(taskDrafts.links.gitPreflight.endsWith('/api/v1/git-preflight'));

  await delay(1200);
  assert.doesNotMatch(output, /Dispatching issue/, 'Dashboard-only mode must not dispatch mock or Linear issues.');
  assert.doesNotMatch(output, /Launching Codex app-server/, 'Dashboard-only mode must not spawn Codex workers.');
  assert.match(output, /dashboardOnly=true|dashboard_only=true|dashboardOnly: true|dashboardOnly/);
} finally {
  child.kill('SIGINT');
  await waitForExit(child, 5000).catch(() => {
    child.kill('SIGKILL');
  });
}

async function waitForDashboard(targetPort, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      await getText(`http://127.0.0.1:${targetPort}/`);
      return;
    } catch (error) {
      lastError = error;
      await delay(150);
    }
  }

  throw new Error(`Dashboard did not start on ${targetPort}: ${lastError?.message || 'timeout'}\n${output}`);
}

async function getJson(url) {
  const text = await getText(url);
  return JSON.parse(text);
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

async function waitForExit(process, timeoutMs) {
  if (process.exitCode !== null) return;

  await Promise.race([
    new Promise(resolve => process.once('exit', resolve)),
    delay(timeoutMs).then(() => {
      throw new Error('process did not exit');
    }),
  ]);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
