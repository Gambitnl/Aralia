/**
 * This file proves that Agora records fatal process failures before Node exits.
 *
 * Each test starts a disposable child process, installs the real fatal handlers, and triggers one
 * failure mode. This avoids crashing the test runner while still exercising the same process-level
 * behavior used by the detached daemon. Temporary logs live outside the repository and are removed
 * after every test.
 *
 * Verifies: fatalErrorLog.mjs
 * Uses: Node's built-in test runner and child-process support
 */

// ============================================================================
// Test Dependencies
// ============================================================================
// Built-in Node modules are sufficient, matching the zero-dependency production helper.
// ============================================================================

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

// ============================================================================
// Isolated Fatal-Process Harness
// ============================================================================
// The child imports the production handler, points it at a disposable log, and fails on the next
// turn of the event loop. A real child exit is stronger proof than calling the formatter directly.
// ============================================================================

const fatalModuleUrl = pathToFileURL(path.resolve('tools/agora/fatalErrorLog.mjs')).href;
const serverFile = path.resolve('tools/agora/server.mjs');

function runFatalChild(kind, message) {
  // Give every case its own directory so parallel or repeated test runs cannot share evidence.
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-fatal-log-'));
  const logFile = path.join(tempDir, 'daemon-crash.log');

  // Keep the inline program limited to installing the real production handler and inducing the
  // selected failure. Values are JSON-encoded so test messages cannot break the child source.
  const failureExpression = kind === 'uncaughtException'
    ? `throw new Error(${JSON.stringify(message)});`
    : `Promise.reject(new Error(${JSON.stringify(message)}));`;
  const childSource = `
    import { installFatalErrorHandlers } from ${JSON.stringify(fatalModuleUrl)};
    installFatalErrorHandlers({ logFile: ${JSON.stringify(logFile)} });
    setImmediate(() => { ${failureExpression} });
  `;

  // Run a separate Node process because the fatal handler intentionally exits with status 1.
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', childSource], {
    encoding: 'utf8',
  });

  // Read the record before cleanup, then remove all disposable proof regardless of assertions.
  const crashLog = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  fs.rmSync(tempDir, { recursive: true, force: true });
  return { child, crashLog };
}

// ============================================================================
// Fatal Failure Proofs
// ============================================================================
// Both Node fatal channels must name their event and preserve the original failure message.
// ============================================================================

test('uncaught exception writes attributable crash evidence before exit', () => {
  const message = 'WF-G25 induced uncaught exception';
  const { child, crashLog } = runFatalChild('uncaughtException', message);

  // A fatal daemon failure must remain visibly unsuccessful to supervisors and watchdogs.
  assert.equal(child.status, 1, child.stderr);
  assert.match(crashLog, /Agora fatal uncaughtException/);
  assert.match(crashLog, new RegExp(message));
});

test('unhandled rejection writes attributable crash evidence before exit', () => {
  const message = 'WF-G25 induced unhandled rejection';
  const { child, crashLog } = runFatalChild('unhandledRejection', message);

  // Promise failures receive the same durable evidence and non-zero outcome as thrown errors.
  assert.equal(child.status, 1, child.stderr);
  assert.match(crashLog, /Agora fatal unhandledRejection/);
  assert.match(crashLog, new RegExp(message));
});

test('daemon CLI ends a double start on a held port with a plain message, not a fatal log (WF-G108)', async () => {
  // WF-G108 (2026-09-09): this case used to expect EADDRINUSE to reach the fatal handler.
  // server.mjs gained a busy-port pre-probe on 2026-08-27 (5/5 recorded crashes were a second
  // `npm run agora` racing a live daemon), so a held port now ends with exit 0 and one
  // explanatory line, and NO crash log. The test proves that contract instead of the old one.
  // The two cases above still prove that a real fatal reaches daemon-crash.log with exit 1.
  const portHolder = net.createServer();
  await new Promise((resolve, reject) => {
    portHolder.once('error', reject);
    portHolder.listen(0, '127.0.0.1', resolve);
  });
  const address = portHolder.address();
  assert.equal(typeof address, 'object');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-server-busy-'));
  const child = spawnSync(process.execPath, [
    serverFile,
    '--port',
    String(address.port),
    '--dir',
    tempDir,
    '--no-activity-mirror',
  ], {
    encoding: 'utf8',
    timeout: 10_000,
  });

  await new Promise((resolve) => portHolder.close(resolve));

  const logFile = path.join(tempDir, 'daemon-crash.log');
  const crashLogExists = fs.existsSync(logFile);
  fs.rmSync(tempDir, { recursive: true, force: true });

  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /already listening on http:\/\/localhost:\d+/);
  assert.equal(crashLogExists, false, 'a double start is not a fatal failure and must not write daemon-crash.log');
});
