// @vitest-environment node
/**
 * This file proves the visual-test capture command rejects unsafe requests
 * before it creates output, opens Chromium, or contacts a development server.
 * It starts the real TypeScript command in short-lived child processes because
 * CLI rejection must be proved without relying on an imported helper alone.
 *
 * Called by: Vitest's focused tools/vistest test run.
 * Depends on: Node's TypeScript loader and the capture command's public CLI.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Page } from 'playwright';
import { describe, expect, it } from 'vitest';
import type { CaptureStep, VisScenario } from '../../../src/devtools/vistest/scenarios';
import { captureScenarioRecipe, isReloadInterruption, probeServedCode } from '../shoot';

// ============================================================================
// Real command runner
// ============================================================================
// This helper invokes Node with tsx's loader rather than an .cmd wrapper. That
// keeps the test portable in the Windows checkout and exercises the exact CLI
// boundary that artists and developers use from the terminal.
// ============================================================================

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const shootScript = path.join(repoRoot, 'tools/vistest/shoot.ts');
const { probeDevServer } = createRequire(import.meta.url)('../../../scripts/dev-server-watchdog.cjs') as {
  probeDevServer: (options: { baseUrl: string; modulePath: string; repoRoot: string; timeoutMs: number }) => Promise<{ ok: boolean; status: string }>;
};

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
  it('rejects a blank explicitly supplied marker before contacting a server', () => {
    const result = runShoot('--fresh-module', 'tools/vistest/shoot.ts', '--expect-served-code', '   ',
      '--base', 'http://127.0.0.1:1/Aralia/');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--expect-served-code must name a nonblank code expression');
    expect(result.stderr).not.toContain('LIVENESS_FAILURE');
  });

  it('requires an expression for ignored scratch modules before contacting a server', () => {
    const out = '.agent/vistest/captures/wfg347-no-marker-no-write';
    for (const modulePath of ['.agent/scratch/missing.ts', './.agent/scratch/missing.ts', '.agent\\scratch\\missing.ts']) {
      const result = runShoot('--fresh-module', modulePath, '--base', 'http://127.0.0.1:1/Aralia/',
        '--probe-timeout', '50', '--out', out);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('--expect-served-code is required for .agent');
      expect(result.stderr).not.toContain('LIVENESS_FAILURE');
      expect(existsSync(path.join(repoRoot, out))).toBe(false);
    }
  }, 15_000);

  it('prints help without starting capture work', () => {
    const unusedOutput = path.join(repoRoot, '.agent/vistest/captures/cli-help-no-write');
    const result = runShoot('--help', '--out', '.agent/vistest/captures/cli-help-no-write');

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: npx tsx tools/vistest/shoot.ts [options]');
    expect(result.stdout).toContain('--expect-served-code');
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

  it('rejects a source-comment marker stripped by Vite before creating output', async () => {
    const source = readFileSync(shootScript, 'utf8');
    const server = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/javascript' });
      if (request.url?.includes('?raw')) {
        response.end('export default ' + JSON.stringify(source) + ';');
      } else if (request.url?.includes('/tools/vistest/shoot.ts')) {
        response.end('export const roofHeight = riseAt(slope, sampleX, sampleY) * FT;');
      } else {
        response.end('<title>Mock Vite</title>');
      }
    });
    const port = await listen(server);
    const unusedOutput = path.join(repoRoot, '.agent/vistest/captures/comment-marker-no-write');

    try {
      const result = await runShootAsync(
        '--base', `http://127.0.0.1:${port}/Aralia/`,
        '--fresh-module', 'tools/vistest/shoot.ts',
        '--expect-served-code', 'LEGACY CAPTURE',
        '--probe-timeout', '1000',
        '--out', '.agent/vistest/captures/comment-marker-no-write',
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('SERVED_VARIANT_FAILURE');
      expect(result.stderr).toContain('no browser or capture output was created');
      expect(existsSync(unusedOutput)).toBe(false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 15_000);
});

describe('transformed served-code proof', () => {
  it('checks the ordinary module URL without creating another Vite cache entry', async () => {
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(request.url || '');
      response.writeHead(200, { 'Content-Type': 'text/javascript' });
      response.end('export const build = "ordinary-module";');
    });
    const port = await listen(server);
    try {
      const result = await probeServedCode({ baseUrl: `http://127.0.0.1:${port}/Aralia/`,
        modulePath: '.agent/scratch/work.ts', expectedCode: 'build = "ordinary-module"', timeoutMs: 1000 });
      expect(result.ok).toBe(true);
      expect(requests).toEqual(['/Aralia/.agent/scratch/work.ts']);
      expect(new URL(result.url).search).toBe('');
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it('rejects stale ignored scratch transforms after two edits and accepts fresh filenames on real Vite', async () => {
    // This is one disposable Vite service with no Aralia configuration, game,
    // browser or GPU. It reproduces the existing .agent watcher exclusion.
    const { createServer: createViteServer } = await import('vite');
    const scratch = path.join(repoRoot, '.agent/scratch/wfg347/vite-fixtures');
    mkdirSync(scratch, { recursive: true });
    const root = mkdtempSync(path.join(scratch, 'run-'));
    const modulePath = '.agent/scratch/work.ts';
    const target = path.join(root, modulePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(path.join(root, 'index.html'), '<html><body>Isolated Vite source proof</body></html>');
    writeFileSync(target, 'export const scratchBuild = "WF347-1";\n');
    const app = await createViteServer({ configFile: false, root, base: '/Aralia/', logLevel: 'silent',
      cacheDir: path.join(root, '.cache'), optimizeDeps: { noDiscovery: true, include: [] },
      server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/.agent/**'] } } });
    try {
      await app.listen();
      const address = app.httpServer?.address();
      if (!address || typeof address === 'string') throw new Error('No isolated Vite fixture port');
      const baseUrl = `http://127.0.0.1:${address.port}/Aralia/`;
      const options = { baseUrl, modulePath, timeoutMs: 3000 };
      // Prime the exact URL the page imports before any probe or disk edit.
      expect(await fetch(new URL(modulePath, baseUrl)).then(response => response.text()))
        .toContain('scratchBuild = "WF347-1"');
      expect((await probeServedCode({ ...options, expectedCode: 'scratchBuild = "WF347-1"' })).ok).toBe(true);
      for (const iteration of [2, 3]) {
        const expectedCode = `scratchBuild = "WF347-${iteration}"`;
        writeFileSync(target, `export const ${expectedCode};\n`);
        // Raw source is genuinely fresh, while the ignored ordinary transform
        // still executes the first build. Raw freshness cannot certify a frame.
        expect((await probeDevServer({ ...options, repoRoot: root })).ok).toBe(true);
        const ordinary = await fetch(new URL(modulePath, baseUrl)).then(response => response.text());
        expect(ordinary).toContain('scratchBuild = "WF347-1"');
        expect(ordinary).not.toContain(expectedCode);
        const rejected = await probeServedCode({ ...options, expectedCode });
        expect(rejected.ok).toBe(false);
        expect(rejected.error).toContain('not found in the transformed module');
        const freshPath = `.agent/scratch/iteration-${iteration}.ts`;
        writeFileSync(path.join(root, freshPath), readFileSync(target));
        expect((await probeServedCode({ ...options, modulePath: freshPath, expectedCode })).ok).toBe(true);
        expect((await probeServedCode({ ...options, modulePath: freshPath,
          expectedCode: 'scratchBuild = "WF347-1"' })).ok).toBe(false);
      }
    } finally {
      await app.close();
      expect(path.dirname(root)).toBe(path.resolve(scratch));
      rmSync(root, { recursive: true, force: true });
    }
  }, 20_000);

  it('accepts code in the transformed module and rejects stripped comments', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/javascript' });
      response.end('export const roofHeight = riseAt(slope, sampleX, sampleY) * FT;');
    });
    const port = await listen(server);
    const options = {
      baseUrl: `http://127.0.0.1:${port}/Aralia/`,
      modulePath: 'src/systems/worldforge/bridge/buildingHistoryParts.ts',
      timeoutMs: 1000,
    };
    try {
      expect((await probeServedCode({ ...options, expectedCode: 'riseAt(slope, sampleX, sampleY) * FT' })).ok).toBe(true);
      const missing = await probeServedCode({ ...options, expectedCode: 'LEGACY CAPTURE' });
      expect(missing.ok).toBe(false);
      expect(missing.error).toContain('not found in the transformed module');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
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
