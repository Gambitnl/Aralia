import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';

// This verifier protects the default-off dispatch gate. Starting Symphony in
// normal mode should serve the dashboard without polling trackers or launching
// workers until the operator explicitly enables assignment through the backend
// dispatch-control endpoint.

const port = 8192;
const child = spawn(process.execPath, ['dist/index.js', 'WORKFLOW-mock.md', '--port', String(port)], {
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

  const initialState = await getJson(`http://127.0.0.1:${port}/api/v1/state`);
  assert.equal(initialState.dispatch_control.enabled, false, 'Normal startup must default dispatch off.');
  assert.equal(initialState.dispatch_control.status, 'paused');
  assert.equal(initialState.counts.running, 0, 'Default-off startup must not have running workers.');
  assert.equal(initialState.counts.retrying, 0, 'Default-off startup must not have retrying workers.');
  assert.deepEqual(initialState.worker_roster, [], 'Default-off startup should expose an empty worker roster.');

  await delay(1200);
  assert.doesNotMatch(output, /Dispatching issue/, 'Default-off startup must not dispatch mock issues.');
  assert.doesNotMatch(output, /Launching Codex app-server/, 'Default-off startup must not spawn Codex workers.');

  const control = await getJson(`http://127.0.0.1:${port}/api/v1/dispatch-control`);
  assert.equal(control.enabled, false, 'Dispatch-control GET must report paused startup state.');

  const enabled = await postJson(`http://127.0.0.1:${port}/api/v1/dispatch-control`, { enabled: true });
  assert.equal(enabled.enabled, true, 'Dispatch-control POST should enable assignment.');
  assert.equal(enabled.status, 'enabled');

  await waitForOutput(/Dispatching issue/, 8000);

  const disabled = await postJson(`http://127.0.0.1:${port}/api/v1/dispatch-control`, { enabled: false });
  assert.equal(disabled.enabled, false, 'Dispatch-control POST should pause future assignment.');
  assert.equal(disabled.status, 'paused');
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

async function waitForOutput(pattern, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (pattern.test(output)) return;
    await delay(150);
  }

  throw new Error(`Expected output matching ${pattern}, got:\n${output}`);
}

async function getJson(url) {
  const text = await getText(url);
  return JSON.parse(text);
}

async function postJson(url, payload) {
  const text = await requestJson('POST', url, payload);
  return JSON.parse(text);
}

async function getText(url) {
  return await requestJson('GET', url);
}

async function requestJson(method, url, payload) {
  return await new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = payload === undefined ? null : JSON.stringify(payload);
    const request = http.request({
      method,
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      headers: body
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        : undefined,
    }, response => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        responseBody += chunk;
      });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}: ${responseBody}`));
          return;
        }
        resolve(responseBody);
      });
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
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
