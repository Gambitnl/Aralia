/**
 * This file proves the WF-G30 watchdog distinguishes dead HTTP from stale Vite
 * source and never turns restart consent into authority over a foreign process.
 *
 * It uses disposable local HTTP servers and ChildProcess-shaped fixtures, so
 * the focused test cannot stop or restart any real development server.
 *
 * Called by: Vitest's focused scripts test run.
 * Depends on: scripts/dev-server-watchdog.cjs and Node's local HTTP server.
 */
import { EventEmitter } from 'node:events';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Shared watchdog and disposable-server fixtures
// ============================================================================
// The production module remains CommonJS for direct Node/preload use. Tests
// load that exact module rather than copying its hash or classification rules.
// ============================================================================

const require = createRequire(import.meta.url);
const {
  STATUS_FRESHNESS_FAILURE,
  STATUS_HEALTHY,
  STATUS_LIVENESS_FAILURE,
  appendEvidence,
  launchOwnedViteChild,
  probeDevServer,
  restartOwnedViteChild,
} = require('../dev-server-watchdog.cjs');

const repoRoot = path.resolve(import.meta.dirname, '../..');
const modulePath = 'scripts/__tests__/dev-server-watchdog.test.js';
const openServers = [];

async function listen(server) {
  openServers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP test address.');
  return address.port;
}

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map((server) => new Promise((resolve) => server.close(() => resolve()))),
  );
});

// ============================================================================
// Liveness and freshness classification
// ============================================================================
// Each server isolates one failure class. The expected and actual hashes in a
// stale result are also durable evidence that HTTP liveness alone did not pass.
// ============================================================================

describe('probeDevServer', () => {
  it('classifies a closed port as a liveness failure', async () => {
    const throwaway = createServer();
    const port = await listen(throwaway);
    await new Promise((resolve) => throwaway.close(() => resolve()));
    openServers.splice(openServers.indexOf(throwaway), 1);

    const result = await probeDevServer({
      baseUrl: `http://127.0.0.1:${port}/Aralia/`,
      modulePath,
      repoRoot,
      timeoutMs: 200,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(STATUS_LIVENESS_FAILURE);
    expect(result.freshness).toBeUndefined();
  });

  it('classifies a responsive server with old source as a freshness failure', async () => {
    const server = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/javascript' });
      response.end(request.url.includes('raw') ? 'export default "old source";' : '<title>Mock Vite</title>');
    });
    const port = await listen(server);

    const result = await probeDevServer({
      baseUrl: `http://127.0.0.1:${port}/Aralia/`,
      modulePath,
      repoRoot,
      timeoutMs: 500,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(STATUS_FRESHNESS_FAILURE);
    expect(result.freshness.expectedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.freshness.actualHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.freshness.actualHash).not.toBe(result.freshness.expectedHash);
  });

  it('passes only when the served raw module matches the checkout source', async () => {
    const currentSource = readFileSync(path.join(repoRoot, modulePath), 'utf8');
    const server = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/javascript' });
      response.end(request.url.includes('raw') ? `export default ${JSON.stringify(currentSource)};` : '<title>Mock Vite</title>');
    });
    const port = await listen(server);

    const result = await probeDevServer({
      baseUrl: `http://127.0.0.1:${port}/Aralia/`,
      modulePath,
      repoRoot,
      timeoutMs: 500,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(STATUS_HEALTHY);
    expect(result.freshness.actualHash).toBe(result.freshness.expectedHash);
  });

  it('bounds a listening server that never sends HTTP headers', async () => {
    const server = createServer(() => {
      // Intentionally leave the response open to reproduce a live socket with
      // a wedged event loop from the caller's point of view.
    });
    const port = await listen(server);
    const startedAt = Date.now();

    const result = await probeDevServer({
      baseUrl: `http://127.0.0.1:${port}/Aralia/`,
      modulePath,
      repoRoot,
      timeoutMs: 100,
    });

    expect(result.status).toBe(STATUS_LIVENESS_FAILURE);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });

  it('bounds a module response that hangs after the base page answers', async () => {
    const server = createServer((request, response) => {
      if (request.url.includes('raw')) return;
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<title>Live base</title>');
    });
    const port = await listen(server);
    const startedAt = Date.now();

    const result = await probeDevServer({
      baseUrl: `http://127.0.0.1:${port}/Aralia/`,
      modulePath,
      repoRoot,
      timeoutMs: 100,
    });

    expect(result.status).toBe(STATUS_FRESHNESS_FAILURE);
    expect(result.freshness.error).toContain('exceeded 100 ms');
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });
});

// ============================================================================
// Evidence and process-ownership boundary
// ============================================================================
// Restart tests inject inert process objects. Only a record minted by the
// watchdog can reach the stop callback, and consent remains separately required.
// ============================================================================

describe('watchdog evidence and recovery safety', () => {
  it('appends one readable JSON event to an ignored log', () => {
    const evidencePath = path.join(repoRoot, '.agent', 'scratch', `wf-g30-watchdog-test-${process.pid}.log`);
    if (existsSync(evidencePath)) unlinkSync(evidencePath);

    appendEvidence(evidencePath, { event: 'test_probe', status: STATUS_HEALTHY });
    const rows = readFileSync(evidencePath, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));

    expect(rows).toEqual([{ event: 'test_probe', status: STATUS_HEALTHY }]);
    unlinkSync(evidencePath);
  });

  it('refuses missing consent and foreign process records without stopping either', async () => {
    const ownedChild = Object.assign(new EventEmitter(), { pid: 101, exitCode: null, signalCode: null });
    const ownedRecord = launchOwnedViteChild({
      command: 'node',
      args: ['node_modules/vite/bin/vite.js', '--port', '3999'],
      spawnChild: () => ownedChild,
    });
    const stopChild = vi.fn();

    const noConsent = await restartOwnedViteChild(ownedRecord, { stopChild });
    const foreign = await restartOwnedViteChild(
      { child: ownedChild, command: 'node', args: ['node_modules/vite/bin/vite.js'], cwd: repoRoot },
      { consentRestartOwnedChild: true, stopChild },
    );

    expect(noConsent.action).toBe('consent_required');
    expect(foreign.action).toBe('foreign_owner_refused');
    expect(stopChild).not.toHaveBeenCalled();
  });

  it('restarts only its own child after explicit consent', async () => {
    const firstChild = Object.assign(new EventEmitter(), { pid: 201, exitCode: null, signalCode: null });
    const secondChild = Object.assign(new EventEmitter(), { pid: 202, exitCode: null, signalCode: null });
    const firstRecord = launchOwnedViteChild({
      command: 'node',
      args: ['node_modules/vite/bin/vite.js', '--port', '3999'],
      spawnChild: () => firstChild,
    });
    const stopChild = vi.fn(async (child) => {
      child.exitCode = 0;
    });
    const launchChild = vi.fn((launch) => launchOwnedViteChild({ ...launch, spawnChild: () => secondChild }));

    const result = await restartOwnedViteChild(firstRecord, {
      consentRestartOwnedChild: true,
      stopChild,
      launchChild,
    });

    expect(result.ok).toBe(true);
    expect(result.action).toBe('restarted_owned_child');
    expect(stopChild).toHaveBeenCalledWith(firstChild);
    expect(result.record.child).toBe(secondChild);
  });
});
