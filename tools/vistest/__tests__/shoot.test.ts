/**
 * This file proves the visual-test capture command rejects unsafe requests
 * before it creates output, opens Chromium, or contacts a development server.
 * It starts the real TypeScript command in short-lived child processes because
 * importing the command directly would run its production entry point.
 *
 * Called by: Vitest's focused tools/vistest test run.
 * Depends on: Node's TypeScript loader and the capture command's public CLI.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// Real command runner
// ============================================================================
// This helper invokes Node with tsx's loader rather than an .cmd wrapper. That
// keeps the test portable in the Windows checkout and exercises the exact CLI
// boundary that artists and developers use from the terminal.
// ============================================================================

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const shootScript = path.join(repoRoot, 'tools/vistest/shoot.ts');

function runShoot(...args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', shootScript, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 10_000,
  });
}

/**
 * Keep the Vitest process free to answer mock HTTP requests while the real
 * capture command runs. The synchronous helper above remains useful for CLI
 * errors that never contact a server.
 */
function runShootAsync(...args: string[]): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', shootScript, ...args], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('vistest child exceeded the focused-test timeout'));
    }, 10_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

/** Start a disposable local server and return the port chosen by Windows. */
async function listen(server: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP test address.');
  return address.port;
}

// ============================================================================
// No-side-effect command checks
// ============================================================================
// Each test uses a unique ignored destination that should remain absent. The
// command must reject or finish before this directory exists; if it ever starts
// a real capture by mistake, the failing assertion identifies the regression.
// ============================================================================

describe('vistest capture command safety', () => {
  it('prints help without starting capture work', () => {
    const unusedOutput = path.join(repoRoot, '.agent/vistest/captures/cli-help-no-write');
    const result = runShoot('--help', '--out', '.agent/vistest/captures/cli-help-no-write');

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: npx tsx tools/vistest/shoot.ts [options]');
    expect(existsSync(unusedOutput)).toBe(false);
  }, 15_000);

  it('rejects an unknown flag before creating capture output', () => {
    const unusedOutput = path.join(repoRoot, '.agent/vistest/captures/cli-unknown-no-write');
    const result = runShoot('--not-a-real-vistest-option', '--out', '.agent/vistest/captures/cli-unknown-no-write');

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown option "--not-a-real-vistest-option"');
    expect(existsSync(unusedOutput)).toBe(false);
  }, 15_000);

  it('refuses a capture directory that Git would track', () => {
    const trackedOutput = path.join(repoRoot, 'public/vistest-captures/cli-safety-no-write');
    const result = runShoot(
      '--fresh-module', 'tools/vistest/__tests__/shoot.test.ts',
      '--out', 'public/vistest-captures/cli-safety-no-write',
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--out must be a Git-ignored directory');
    expect(existsSync(trackedOutput)).toBe(false);
  }, 15_000);

  it('requires a named module before any capture work can begin', () => {
    const unusedOutput = path.join(repoRoot, '.agent/vistest/captures/missing-freshness-no-write');
    const result = runShoot('--out', '.agent/vistest/captures/missing-freshness-no-write');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--fresh-module is required');
    expect(existsSync(unusedOutput)).toBe(false);
  }, 15_000);

  it('classifies a dead server before creating output or opening Chromium', async () => {
    const throwaway = createServer();
    const port = await listen(throwaway);
    await new Promise<void>((resolve) => throwaway.close(() => resolve()));
    const unusedOutput = path.join(repoRoot, '.agent/vistest/captures/dead-preflight-no-write');

    const result = runShoot(
      '--base', `http://127.0.0.1:${port}/Aralia/`,
      '--fresh-module', 'tools/vistest/__tests__/shoot.test.ts',
      '--probe-timeout', '300',
      '--out', '.agent/vistest/captures/dead-preflight-no-write',
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('LIVENESS_FAILURE');
    expect(result.stderr).toContain('no browser or capture output was created');
    expect(existsSync(unusedOutput)).toBe(false);
  }, 10_000);

  it('classifies stale served source before creating output or opening Chromium', async () => {
    const server = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/javascript' });
      response.end(request.url?.includes('raw') ? 'export default "stale source";' : '<title>Mock Vite</title>');
    });
    const port = await listen(server);
    const unusedOutput = path.join(repoRoot, '.agent/vistest/captures/stale-preflight-no-write');

    try {
      const result = await runShootAsync(
        '--base', `http://127.0.0.1:${port}/Aralia/`,
        '--fresh-module', 'tools/vistest/__tests__/shoot.test.ts',
        '--probe-timeout', '500',
        '--out', '.agent/vistest/captures/stale-preflight-no-write',
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('FRESHNESS_FAILURE');
      expect(result.stderr).toContain('no browser or capture output was created');
      expect(existsSync(unusedOutput)).toBe(false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 10_000);
});
