/**
 * @file tools/vistest/shoot.ts — the canonical visual-test capture runner.
 *
 *   npx tsx tools/vistest/shoot.ts --fresh-module src/App.tsx
 *   npx tsx tools/vistest/shoot.ts --fresh-module src/App.tsx --only crowd-commute
 *   npx tsx tools/vistest/shoot.ts --fresh-module src/App.tsx --base http://localhost:5174/Aralia/ --out .agent/vistest/captures
 *   npx tsx tools/vistest/shoot.ts --fresh-module src/App.tsx --width 1353 --height 1272 # constrained layout proof
 *
 * Interprets each scenario's declarative capture recipe from
 * src/devtools/vistest/scenarios.ts against a running dev server and writes
 * one PNG per scenario. Replaces the ad-hoc probe scripts that used to live
 * in .agent/scratch: `readback` uses the proven rAF framebuffer read (the
 * compositor screenshot starves under a busy R3F loop on SwiftShader), and
 * `screenshot` is a plain capture for pages where that works.
 *
 * Fails loudly: a failed step throws with the scenario id + step index, and
 * the process exits non-zero if any scenario failed.
 */
import { chromium, type Browser, type Page } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SCENARIOS, validateScenarios, type CaptureStep, type VisScenario } from '../../src/devtools/vistest/scenarios';
import { outputPath, scenarioUrl } from '../../src/devtools/vistest/runnerCore';

// The watchdog is CommonJS because it also runs as a preload-friendly Node
// command. This typed bridge reuses its authoritative statuses and hashing
// instead of rebuilding similar-but-different capture logic in TypeScript.
const require = createRequire(import.meta.url);
type FreshnessProbeResult = {
  ok: boolean;
  status: 'healthy' | 'liveness_failure' | 'freshness_failure';
  [key: string]: unknown;
};
type WatchdogModule = {
  DEFAULT_EVIDENCE_PATH: string;
  appendEvidence: (evidencePath: string, event: Record<string, unknown>) => string;
  probeDevServer: (options: {
    baseUrl: string;
    modulePath: string;
    repoRoot: string;
    timeoutMs: number;
  }) => Promise<FreshnessProbeResult>;
};
const watchdog = require('../../scripts/dev-server-watchdog.cjs') as WatchdogModule;

// ============================================================================
// Command-line safety boundary
// ============================================================================
// This section validates every request before the runner creates a directory,
// contacts a local server, or launches Chromium. Capture output is deliberately
// restricted to a Git-ignored directory so a typo cannot leave PNG proof in a
// tracked product folder that the repository snapshot process would publish.
// ============================================================================

type RunnerOptions = {
  base: string;
  outDir: string;
  only: string;
  viewportWidth: number;
  viewportHeight: number;
  freshnessModule: string;
  probeTimeoutMs: number;
};

type ParsedCommand =
  | { kind: 'help' }
  | { kind: 'run'; options: RunnerOptions }
  | { kind: 'error'; message: string };

const DEFAULT_OPTIONS: RunnerOptions = {
  base: 'http://localhost:5174/Aralia/',
  outDir: '.agent/vistest/captures',
  only: '',
  viewportWidth: 1600,
  viewportHeight: 1000,
  freshnessModule: '',
  probeTimeoutMs: 3000,
};

const HELP_TEXT = [
  'Usage: npx tsx tools/vistest/shoot.ts [options]',
  '',
  'Capture declarative visual-test scenarios from a running local server.',
  '',
  'Options:',
  '  --help                 Print this help and exit without starting a capture.',
  '  --base <url>           Dev-server base URL (default: ' + DEFAULT_OPTIONS.base + ')',
  '  --out <directory>      Git-ignored capture directory (default: ' + DEFAULT_OPTIONS.outDir + ')',
  '  --only <id[,id]>       Capture one or more scenario IDs.',
  '  --width <pixels>       Viewport width (default: ' + DEFAULT_OPTIONS.viewportWidth + ')',
  '  --height <pixels>      Viewport height (default: ' + DEFAULT_OPTIONS.viewportHeight + ')',
  '  --fresh-module <path>  Required repo-relative source file to verify through Vite.',
  '  --probe-timeout <ms>   Per-request preflight ceiling (default: ' + DEFAULT_OPTIONS.probeTimeoutMs + ')',
].join('\n');

/**
 * Ask Git whether a future capture file would be ignored instead of checking
 * the directory itself. Directory-only ignore rules match files below them,
 * which is exactly what this runner writes after it creates the folder.
 */
function isIgnoredCaptureDirectory(outDir: string): boolean {
  const probePath = path.join(outDir, '.vistest-ignore-probe');
  const result = spawnSync('git', ['check-ignore', '-q', '--', probePath], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });

  return result.status === 0;
}

/**
 * Turn the small supported flag set into runner options without performing
 * capture work. Keeping parsing side-effect-free lets help and invalid input
 * stop before the filesystem, browser, and development server are involved.
 */
function parseCommand(argv: readonly string[]): ParsedCommand {
  const options: RunnerOptions = { ...DEFAULT_OPTIONS };
  const valueFlags = new Set(['base', 'out', 'only', 'width', 'height', 'fresh-module', 'probe-timeout']);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    // Help intentionally wins immediately so it remains safe even when a user
    // has copied an incomplete capture command after the flag.
    if (token === '--help') {
      return { kind: 'help' };
    }

    if (!token.startsWith('--')) {
      return { kind: 'error', message: 'vistest: unexpected argument "' + token + '"' };
    }

    const name = token.slice(2);
    if (!valueFlags.has(name)) {
      return { kind: 'error', message: 'vistest: unknown option "' + token + '"; run with --help for usage' };
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      return { kind: 'error', message: 'vistest: missing value for --' + name };
    }

    if (name === 'base') options.base = value;
    if (name === 'out') options.outDir = value;
    if (name === 'only') options.only = value;
    if (name === 'fresh-module') options.freshnessModule = value;

    // Viewport dimensions are parsed here so invalid values cannot make the
    // runner start a browser and produce a misleadingly sized proof image.
    if (name === 'width' || name === 'height' || name === 'probe-timeout') {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return { kind: 'error', message: 'vistest: --' + name + ' must be a positive integer, received "' + value + '"' };
      }
      if (name === 'width') options.viewportWidth = parsed;
      if (name === 'height') options.viewportHeight = parsed;
      if (name === 'probe-timeout') options.probeTimeoutMs = parsed;
    }

    index += 1;
  }

  // Every screenshot must name the source file whose current bytes the Vite
  // server is expected to serve. Liveness alone cannot detect forged proof from
  // a responsive process whose module graph stopped refreshing.
  if (!options.freshnessModule) {
    return {
      kind: 'error',
      message: 'vistest: --fresh-module is required so capture cannot skip source freshness proof',
    };
  }

  // The runner writes one PNG below this directory per scenario. Rejecting a
  // destination that Git would track protects product assets from accidental
  // generated files and leaves ignored scratch directories available for proof.
  if (!isIgnoredCaptureDirectory(options.outDir)) {
    return {
      kind: 'error',
      message: 'vistest: --out must be a Git-ignored directory; "' + options.outDir + '" is not ignored',
    };
  }

  return { kind: 'run', options };
}

// ============================================================================
// Capture recipe execution
// ============================================================================
// These helpers execute the scenario recipes only after the command-line safety
// boundary has accepted the request. A watched Vite tree may reload while a
// recipe is evaluating the page. The bounded recovery path below waits for the
// replacement document, rechecks the recipe's latest readiness hook, and then
// retries only the interrupted instruction. Ordinary recipe failures remain
// failures so a broken action cannot be mistaken for a transient reload.
// ============================================================================

/** Pause when a scenario recipe needs the rendered game to settle before its next action. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A recipe gets two chances to recover after its first interrupted attempt. */
export const MAX_RELOAD_RECOVERIES = 2;

type WaitHookStep = Extract<CaptureStep, { kind: 'waitHook' }>;

type CaptureRunState = {
  publishedFrames: Set<string>;
};

type RecoveryOptions = {
  maxReloadRecoveries?: number;
};

/** Normalize thrown values before they cross the command-line reporting boundary. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Recognize only errors that mean the current JavaScript world disappeared
 * during navigation. Timeouts, missing elements, recipe exceptions, closed
 * pages, and filesystem failures are deliberately excluded from recovery.
 */
export function isReloadInterruption(error: unknown): boolean {
  const message = errorMessage(error);
  return /execution context was destroyed|cannot find context with specified id|most likely because of a navigation/i.test(message);
}

/**
 * Publish a completed PNG as one filesystem operation.
 *
 * The browser first returns the whole frame in memory. This helper writes that
 * frame beside its destination and then renames it into place, so a reload or
 * failed browser operation can never leave a partial PNG at the proof path.
 * The per-scenario set also makes a repeated terminal instruction idempotent:
 * once this run has published a frame, later calls cannot publish it twice.
 */
function publishFrameAtomically(targetPath: string, png: Buffer, state: CaptureRunState): void {
  if (state.publishedFrames.has(targetPath)) return;

  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(temporaryPath, png, { flag: 'wx' });
    renameSync(temporaryPath, targetPath);
    state.publishedFrames.add(targetPath);
  } finally {
    // The rename removes a successful temporary file. A failed write or rename
    // may leave one behind, so remove only this invocation's exact scratch path.
    rmSync(temporaryPath, { force: true });
  }
}

/**
 * Carry out one declarative scenario instruction and surface enough context to
 * explain a bad capture to the scenario author. Each instruction remains the
 * authority for its own timing and capture mode.
 */
async function runStep(
  page: Page,
  s: VisScenario,
  index: number,
  step: CaptureStep,
  outDir: string,
  state: CaptureRunState,
): Promise<void> {
  switch (step.kind) {
    case 'sleep':
      await sleep(step.ms);
      return;
    case 'waitHook': {
      const deadline = Date.now() + (step.timeoutMs ?? 60000);
      while (true) {
        const ok = await page.evaluate(`!!(${step.expr})`);
        if (ok) return;
        if (Date.now() > deadline) {
          throw new Error(`waitHook timed out: ${step.expr}`);
        }
        await sleep(500);
      }
    }
    case 'eval': {
      const result = await page.evaluate(step.js);
      // Recipes return short status strings ('posed', 'clicked'); surface
      // obvious failures instead of capturing a wrong frame.
      if (typeof result === 'string' && /missing|no |MISSING/i.test(result)) {
        throw new Error(`eval reported "${result}"`);
      }
      return;
    }
    case 'readback': {
      const dataUrl = await page.evaluate(
        () =>
          new Promise<string>((res, rej) => {
            const canvas = [...document.querySelectorAll('canvas')].find((c) => {
              try {
                return !!(c.getContext('webgl2') || c.getContext('webgl'));
              } catch {
                return false;
              }
            });
            if (!canvas) return rej(new Error('no webgl canvas'));
            requestAnimationFrame(() => {
              try {
                res(canvas.toDataURL('image/png'));
              } catch (e) {
                rej(e as Error);
              }
            });
          }),
      );
      const b64 = String(dataUrl).split(',')[1] ?? '';
      if (b64.length < 10000) {
        throw new Error(`readback produced a suspiciously small frame (${b64.length} b64 chars)`);
      }
      publishFrameAtomically(outputPath(outDir, s), Buffer.from(b64, 'base64'), state);
      return;
    }
    case 'screenshot': {
      await page.evaluate(() => document.fonts?.ready?.then(() => true).catch(() => true));
      const png = await page.screenshot({ type: 'png', timeout: 60000 });
      publishFrameAtomically(outputPath(outDir, s), png, state);
      return;
    }
    default: {
      const never: never = step;
      throw new Error(`unknown step ${JSON.stringify(never)}`);
    }
  }
}

/**
 * Run one recipe instruction with a bounded resume path for watched-tree
 * reloads. Each recovery consumes the same small budget whether navigation
 * interrupts document settling, the readiness hook, or the instruction itself.
 */
async function runStepWithReloadRecovery(
  page: Page,
  scenario: VisScenario,
  index: number,
  step: CaptureStep,
  outDir: string,
  state: CaptureRunState,
  readinessHook: WaitHookStep | undefined,
  maxReloadRecoveries: number,
): Promise<void> {
  let recoveryCount = 0;
  let recoveryPending = false;

  while (true) {
    try {
      if (recoveryPending) {
        // Wait for the replacement document before asking its readiness hook.
        // Without this boundary, the hook could run in the dying document and
        // immediately consume another recovery for no useful work.
        await page.waitForLoadState('domcontentloaded', { timeout: 30_000 });
        if (readinessHook) {
          await runStep(page, scenario, index, readinessHook, outDir, state);
        }
      }

      await runStep(page, scenario, index, step, outDir, state);
      return;
    } catch (error) {
      if (!isReloadInterruption(error)) throw error;

      if (recoveryCount >= maxReloadRecoveries) {
        throw new Error(
          `reload recovery exhausted after ${maxReloadRecoveries} attempt(s): ${errorMessage(error)}`,
        );
      }

      recoveryCount += 1;
      recoveryPending = true;
      console.warn(
        `vistest: scenario "${scenario.id}" step ${index} (${step.kind}) reload recovery ` +
        `${recoveryCount}/${maxReloadRecoveries}`,
      );
    }
  }
}

/**
 * Execute one scenario from its opening readiness check through its terminal
 * frame. Successful earlier scenarios remain durable if a later scenario
 * fails, while this scenario publishes its one terminal frame at most once.
 */
export async function captureScenarioRecipe(
  page: Page,
  scenario: VisScenario,
  outDir: string,
  options: RecoveryOptions = {},
): Promise<void> {
  const state: CaptureRunState = { publishedFrames: new Set<string>() };
  const maxReloadRecoveries = options.maxReloadRecoveries ?? MAX_RELOAD_RECOVERIES;
  let latestReadinessHook: WaitHookStep | undefined;

  for (const [index, step] of scenario.capture.entries()) {
    // A waitHook is itself the readiness checkpoint. Later interrupted steps
    // replay the latest completed hook before retrying their own instruction.
    const recoveryReadinessHook = step.kind === 'waitHook' ? undefined : latestReadinessHook;
    try {
      await runStepWithReloadRecovery(
        page,
        scenario,
        index,
        step,
        outDir,
        state,
        recoveryReadinessHook,
        maxReloadRecoveries,
      );
    } catch (error) {
      throw new Error(`scenario "${scenario.id}" step ${index} (${step.kind}): ${errorMessage(error)}`);
    }

    if (step.kind === 'waitHook') latestReadinessHook = step;
  }
}

/**
 * Validate the registry, select the requested scenarios, and create their PNG
 * proof only after the command-entry safety boundary has approved the request.
 */
/** Software-GL flags: the R3F surfaces must render identically on any machine. */
const CAPTURE_ARGS = [
  '--ignore-gpu-blocklist',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
];

/**
 * Launch the capture browser, preferring Playwright's own build and falling back
 * to an installed Chrome.
 *
 * Why the fallback exists: `npx playwright install` cannot write its browser
 * cache on this machine — `%LOCALAPPDATA%\ms-playwright` is a junction whose
 * target is a junction to ITSELF, so `mkdir` fails with ELOOP and no browser is
 * ever downloaded. That is a filesystem problem outside this repo, but it left
 * the whole visual-capture rig dead, and a dead rig means visual work gets
 * judged on claims instead of screenshots. Chrome is already installed, and for
 * screenshot capture a system Chrome is a fine substitute.
 *
 * Fails loudly when neither is available: a capture rig that silently produces
 * nothing is worse than one that stops.
 */
async function launchCaptureBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true, args: CAPTURE_ARGS });
  } catch (bundledError) {
    const message = bundledError instanceof Error ? bundledError.message : String(bundledError);
    if (!/Executable doesn't exist/i.test(message)) throw bundledError;
    console.warn('vistest: Playwright browser missing; falling back to installed Chrome.');
    try {
      return await chromium.launch({ headless: true, channel: 'chrome', args: CAPTURE_ARGS });
    } catch (chromeError) {
      const detail = chromeError instanceof Error ? chromeError.message : String(chromeError);
      throw new Error(
        `vistest: no capture browser available.\n` +
        `  Playwright build: ${message.split('\n')[0]}\n` +
        `  Installed Chrome: ${detail.split('\n')[0]}\n` +
        `  Fix one of them — visual work cannot be verified without a capture browser.`,
      );
    }
  }
}

async function main({
  base,
  outDir,
  only,
  viewportWidth,
  viewportHeight,
  freshnessModule,
  probeTimeoutMs,
}: RunnerOptions): Promise<void> {
  const problems = validateScenarios(SCENARIOS);
  if (problems.length > 0) {
    console.error('vistest: registry invalid:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
  const wanted = only
    ? SCENARIOS.filter((s) => only.split(',').includes(s.id))
    : SCENARIOS;
  if (only && wanted.length !== only.split(',').length) {
    const known = new Set(SCENARIOS.map((s) => s.id));
    const missing = only.split(',').filter((id) => !known.has(id));
    console.error(`vistest: unknown scenario id(s): ${missing.join(', ')}`);
    process.exit(1);
  }

  // Prove both event-loop liveness and named-module freshness before creating
  // the output directory or launching Chromium. A failed gate therefore cannot
  // leave a PNG that someone might mistake for valid after-change evidence.
  const preflight = await watchdog.probeDevServer({
    baseUrl: base,
    modulePath: freshnessModule,
    repoRoot: process.cwd(),
    timeoutMs: probeTimeoutMs,
  });
  const evidencePath = watchdog.appendEvidence(watchdog.DEFAULT_EVIDENCE_PATH, {
    event: 'vistest_preflight',
    ...preflight,
  });
  if (!preflight.ok) {
    console.error(`vistest: preflight ${preflight.status.toUpperCase()}; no browser or capture output was created; evidence=${evidencePath}`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(outDir, { recursive: true });

  let browser: Browser | null = null;
  let failed = 0;
  try {
    browser = await launchCaptureBrowser();

    for (const s of wanted) {
      const page = await browser.newPage({
        viewport: { width: viewportWidth, height: viewportHeight },
      });
      try {
        await page.goto(scenarioUrl(base, s), { waitUntil: 'domcontentloaded', timeout: 30000 });
        await captureScenarioRecipe(page, s, outDir);
        console.log(`shot ${outputPath(outDir, s)}`);
      } catch (e) {
        failed += 1;
        console.error(`FAILED ${(e as Error).message}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    // A launch error or unexpected scenario exception must not strand Chromium
    // and keep the operator's machine busy after the proof command has failed.
    await browser?.close();
  }

  if (failed > 0) {
    console.error(`vistest: ${failed}/${wanted.length} scenario(s) failed`);
    process.exit(1);
  }
  console.log(`vistest: ${wanted.length} scenario(s) captured to ${outDir}`);
}

// ============================================================================
// Command entry point
// ============================================================================
// Parse first so --help and malformed invocations finish before any capture
// side effect. The main runner only receives options that have passed the
// ignored-output safeguard above.
// ============================================================================

// Tests import the recovery helpers above without starting a production
// capture. A direct terminal invocation still follows the original CLI path.
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isDirectInvocation = invokedPath === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  const command = parseCommand(process.argv.slice(2));

  if (command.kind === 'help') {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (command.kind === 'error') {
    console.error(command.message);
    process.exit(1);
  }

  await main(command.options);
}
