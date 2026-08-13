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
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import type { Page } from 'playwright';
import { describe, expect, it } from 'vitest';
import type { CaptureStep, VisScenario } from '../../../src/devtools/vistest/scenarios';
import { captureScenarioRecipe, isReloadInterruption } from '../shoot';

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
// Reload-recovery fixture helpers
// ============================================================================
// These small page doubles model only the Playwright operations used by a
// declarative recipe. They make the retry count and readiness recheck directly
// observable while the filesystem assertions exercise the real atomic writer.
// A separate ignored fixture receipt drives an actual Chromium page.
// ============================================================================

type FakePageOptions = {
  frameLabel: string;
  screenshotReloads?: number;
  evalError?: Error;
};

type FakePageCounters = {
  readinessChecks: number;
  documentWaits: number;
  evalCalls: number;
  screenshotCalls: number;
};

/** Build one valid synthetic scenario without changing the product registry. */
function makeScenario(id: string, capture: CaptureStep[]): VisScenario {
  return {
    id,
    title: `Fixture ${id}`,
    group: 'combat',
    url: 'fixture.html',
    notes: 'Exercises the capture runner rather than product presentation.',
    capture,
  };
}

/**
 * Provide deterministic readiness, action, and screenshot behavior.
 * Screenshot reload failures use Playwright's real error wording so the test
 * protects the production classifier rather than a test-only signal.
 */
function makeFakePage(options: FakePageOptions): { page: Page; counters: FakePageCounters } {
  const counters: FakePageCounters = {
    readinessChecks: 0,
    documentWaits: 0,
    evalCalls: 0,
    screenshotCalls: 0,
  };

  const page = {
    evaluate: async (expression: unknown) => {
      if (typeof expression === 'string' && expression.includes('__fixtureReady')) {
        counters.readinessChecks += 1;
        return true;
      }

      if (typeof expression === 'string') {
        counters.evalCalls += 1;
        if (options.evalError) throw options.evalError;
        return 'fixture action complete';
      }

      // The screenshot path waits for fonts through a function expression.
      // The fixture has no fonts, so it is immediately ready.
      return true;
    },
    waitForLoadState: async () => {
      counters.documentWaits += 1;
    },
    screenshot: async () => {
      counters.screenshotCalls += 1;
      if (counters.screenshotCalls <= (options.screenshotReloads ?? 0)) {
        throw new Error('page.screenshot: Execution context was destroyed, most likely because of a navigation.');
      }
      return Buffer.from(options.frameLabel, 'utf8');
    },
  };

  return { page: page as unknown as Page, counters };
}

/** Create a unique ignored proof directory and remove it after each assertion. */
function makeRecoveryOutput(): string {
  const scratchRoot = path.join(repoRoot, '.agent/scratch/wfg51-sol/test-output');
  mkdirSync(scratchRoot, { recursive: true });
  return mkdtempSync(path.join(scratchRoot, 'run-'));
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

// ============================================================================
// Bounded reload and durable-frame checks
// ============================================================================
// These tests pin the WF-G51 contract: reloads recheck readiness and retake the
// interrupted frame, exhaustion is finite and loud, and real script failures
// are never relabeled as recoverable navigation.
// ============================================================================

describe('vistest reload recovery', () => {
  it('classifies navigation context loss without hiding real browser failures', () => {
    expect(isReloadInterruption(new Error('Execution context was destroyed, most likely because of a navigation.'))).toBe(true);
    expect(isReloadInterruption(new Error('Cannot find context with specified id 17'))).toBe(true);
    expect(isReloadInterruption(new Error('fixture action exploded'))).toBe(false);
    expect(isReloadInterruption(new Error('Frame was detached by the application'))).toBe(false);
    expect(isReloadInterruption(new Error('Target page, context or browser has been closed'))).toBe(false);
  });

  it('retakes an interrupted middle frame and publishes every frame exactly once', async () => {
    const outDir = makeRecoveryOutput();
    const readiness: CaptureStep = { kind: 'waitHook', expr: 'window.__fixtureReady === true' };
    const scenarios = [
      makeScenario('frame-1', [readiness, { kind: 'screenshot' }]),
      makeScenario('frame-2', [readiness, { kind: 'screenshot' }]),
      makeScenario('frame-3', [readiness, { kind: 'screenshot' }]),
    ];
    const first = makeFakePage({ frameLabel: 'frame one' });
    const interrupted = makeFakePage({ frameLabel: 'frame two retaken', screenshotReloads: 1 });
    const third = makeFakePage({ frameLabel: 'frame three' });

    try {
      await captureScenarioRecipe(first.page, scenarios[0], outDir);
      await captureScenarioRecipe(interrupted.page, scenarios[1], outDir);
      await captureScenarioRecipe(third.page, scenarios[2], outDir);

      expect(readdirSync(outDir).sort()).toEqual(['frame-1.png', 'frame-2.png', 'frame-3.png']);
      expect(readFileSync(path.join(outDir, 'frame-2.png'), 'utf8')).toBe('frame two retaken');
      expect(interrupted.counters.screenshotCalls).toBe(2);
      expect(interrupted.counters.documentWaits).toBe(1);
      expect(interrupted.counters.readinessChecks).toBe(2);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('fails loudly after the bounded recovery budget without leaving a frame', async () => {
    const outDir = makeRecoveryOutput();
    const scenario = makeScenario('reload-loop', [
      { kind: 'waitHook', expr: 'window.__fixtureReady === true' },
      { kind: 'screenshot' },
    ]);
    const fixture = makeFakePage({ frameLabel: 'never published', screenshotReloads: 99 });

    try {
      await expect(
        captureScenarioRecipe(fixture.page, scenario, outDir, { maxReloadRecoveries: 2 }),
      ).rejects.toThrow('scenario "reload-loop" step 1 (screenshot): reload recovery exhausted after 2 attempt(s)');
      expect(fixture.counters.screenshotCalls).toBe(3);
      expect(fixture.counters.documentWaits).toBe(2);
      expect(readdirSync(outDir)).toEqual([]);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('preserves a real script error as an immediate failure', async () => {
    const outDir = makeRecoveryOutput();
    const scenario = makeScenario('real-error', [
      { kind: 'waitHook', expr: 'window.__fixtureReady === true' },
      { kind: 'eval', js: 'window.performFixtureAction()' },
      { kind: 'screenshot' },
    ]);
    const fixture = makeFakePage({ frameLabel: 'must not exist', evalError: new Error('fixture action exploded') });

    try {
      await expect(captureScenarioRecipe(fixture.page, scenario, outDir)).rejects.toThrow(
        'scenario "real-error" step 1 (eval): fixture action exploded',
      );
      expect(fixture.counters.evalCalls).toBe(1);
      expect(fixture.counters.documentWaits).toBe(0);
      expect(fixture.counters.screenshotCalls).toBe(0);
      expect(readdirSync(outDir)).toEqual([]);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('keeps a single-shot recipe as one direct PNG publication', async () => {
    const outDir = makeRecoveryOutput();
    const scenario = makeScenario('single-shot', [{ kind: 'screenshot' }]);
    const fixture = makeFakePage({ frameLabel: 'single frame' });

    try {
      // Production captures routinely replace yesterday's PNG. Keep that
      // single-shot overwrite contract while the replacement remains atomic.
      writeFileSync(path.join(outDir, 'single-shot.png'), 'older frame');
      await captureScenarioRecipe(fixture.page, scenario, outDir);
      expect(readdirSync(outDir)).toEqual(['single-shot.png']);
      expect(readFileSync(path.join(outDir, 'single-shot.png'), 'utf8')).toBe('single frame');
      expect(fixture.counters.screenshotCalls).toBe(1);
      expect(fixture.counters.documentWaits).toBe(0);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
