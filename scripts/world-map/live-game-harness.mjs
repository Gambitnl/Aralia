/**
 * This command proves that Aralia's real live-game World Map is reachable.
 *
 * It starts the normal development app when needed, opens an isolated browser
 * session, enters the existing dev-only dummy game, changes only that in-memory
 * session to seed 1337, and opens the PLAYING-phase MapPane. The command records
 * the canonical SVG renderer, active layer preferences, route state, browser
 * details, and console failures under ignored scratch. It never uses a player's
 * browser profile or save storage, and normal start/continue behavior is not
 * changed. Deeper gameplay journeys and product save creation remain deferred.
 *
 * Run with: node scripts/world-map/live-game-harness.mjs
 */

// ============================================================================
// Dependencies and fixed proof contract
// ============================================================================
// The harness uses the repository's Playwright dependency and Node's standard
// process/file tools. All generated evidence stays under Aralia's ignored proof
// directory so the daily snapshot cannot publish it.
// ============================================================================

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
const PROOF_ROOT = join(
  REPO_ROOT,
  '.agent',
  'scratch',
  'proof',
  'world-map-quality',
  'live-game-harness',
);
const BEFORE_DIR = join(PROOF_ROOT, 'before');
const AFTER_DIR = join(PROOF_ROOT, 'after');
const PRIOR_LIMITATION = 'The earlier dummy bootstrap did not reach a live PLAYING MapPane, so source and preview evidence could not prove the player route.';
const PRIOR_LIMITATION_RECORDED_AT = '2026-07-18';
const FINGERPRINTED_MAP_SOURCES = [
  'src/App.tsx',
  'src/components/MapPane.tsx',
  'src/components/Worldforge/AtlasSvgView.tsx',
  'src/components/Worldforge/StartPointSelection.tsx',
  'src/components/Worldforge/AtlasDemo.tsx',
  'scripts/world-map/live-game-harness.mjs',
];
const DEFAULT_BASE_URL = 'http://127.0.0.1:3000/Aralia/';
const DEFAULT_SEED = 1337;
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
const REQUIRED_SELECTORS = [
  '[data-testid="window-world-map-window"]',
  '[data-testid="worldforge-map-viewport"]',
  '[data-testid="atlas-svg-view"]',
];

// ============================================================================
// Command options and route construction
// ============================================================================
// These small exported helpers keep the command's public behavior testable
// without launching a browser. Headed mode is the default because this lane's
// acceptance depends on inspected rendered proof, while --headless remains
// available for later automated checks.
// ============================================================================

export function parseHarnessArgs(argv = []) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    headed: true,
    seed: DEFAULT_SEED,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  // Read only the command's named options. Unknown values fail immediately so
  // a misspelled proof command cannot silently run a weaker verification.
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--headless') {
      options.headed = false;
      continue;
    }
    if (argument === '--headed') {
      options.headed = true;
      continue;
    }
    if (argument === '--base-url') {
      options.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (argument === '--seed') {
      options.seed = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (argument === '--timeout-ms') {
      options.timeoutMs = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`Unknown live-game world-map harness option: ${argument}`);
  }

  // The proof contract requires a real positive deterministic seed and enough
  // time for the procedural atlas to render. Invalid input is never replaced by
  // a random seed because that would make the evidence non-repeatable.
  if (!Number.isInteger(options.seed) || options.seed <= 0) {
    throw new Error(`The harness seed must be a positive integer; received ${options.seed}.`);
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1_000) {
    throw new Error(`The harness timeout must be at least 1000 ms; received ${options.timeoutMs}.`);
  }
  options.baseUrl = new URL(options.baseUrl).href;
  return options;
}

export function makePlayingRouteUrl(baseUrl) {
  const route = new URL(baseUrl);
  route.searchParams.set('dummy', '1');
  route.searchParams.set('live_map_harness', '1');
  return route.href;
}

// ============================================================================
// Fail-closed evidence validation
// ============================================================================
// The browser journey is not considered successful merely because a screenshot
// exists. These assertions require PLAYING state, a live party, seed 1337, the
// open modal, and the actual SVG component with a populated atlas. Tests pin the
// rejection behavior for unreachable or visually similar substitute routes.
// ============================================================================

export function validatePlayingMapEvidence(evidence, expectedSeed = DEFAULT_SEED) {
  if (evidence?.phase !== 'PLAYING') {
    throw new Error(`Live-game route was not PLAYING; received ${evidence?.phase ?? 'missing'}.`);
  }
  if (!Number.isInteger(evidence.partySize) || evidence.partySize < 1) {
    throw new Error('Live-game route did not contain a playable party.');
  }
  if (evidence.worldSeed !== expectedSeed) {
    throw new Error(`Live-game route did not retain controlled seed ${expectedSeed}.`);
  }
  if (evidence.isMapVisible !== true) {
    throw new Error('PLAYING route was reached, but its World Map modal was not open.');
  }
  if (evidence.renderer?.tagName !== 'svg') {
    throw new Error('Canonical AtlasSvgView was not mounted as an SVG renderer.');
  }
  if (!Number.isInteger(evidence.renderer.pathCount) || evidence.renderer.pathCount <= 20) {
    throw new Error('AtlasSvgView mounted without enough canonical atlas paths to prove a render.');
  }
  if (evidence.renderer.canvasCountWithinViewport !== 0) {
    throw new Error('The canonical world-map viewport still contains a canvas renderer.');
  }
  if (evidence.ancestry?.viewportInsideWindow !== true || evidence.ancestry?.rendererInsideViewport !== true) {
    throw new Error('The canonical renderer selector chain is present but not nested as WindowFrame -> MapPane viewport -> AtlasSvgView.');
  }
  if (evidence.preference?.key !== `aralia.atlas.layerPrefs.v1:${expectedSeed}`) {
    throw new Error(`Seed-scoped AtlasSvgView preference was not recorded for seed ${expectedSeed}.`);
  }
  if (evidence.preference?.value?.mapMode !== 'states' || evidence.preference.statesControlChecked !== true) {
    throw new Error('AtlasSvgView did not visibly activate and persist the States layer preference.');
  }

  // Every named surface must belong to the same mounted MapPane. Requiring all
  // selectors prevents a standalone preview or source-only dummy map from
  // satisfying the live-game acceptance contract.
  for (const selector of REQUIRED_SELECTORS) {
    if (evidence.selectors?.[selector] !== true) {
      throw new Error(`Required live-game renderer selector was unreachable: ${selector}`);
    }
  }
  return evidence;
}

// ============================================================================
// Safe local server ownership
// ============================================================================
// A responsive existing development server is reused and never stopped. When
// this command starts Vite itself, it records ownership and tears down only that
// process tree after proof, preserving every unrelated local service.
// ============================================================================

async function isServerReady(baseUrl) {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(baseUrl, child, timeoutMs, serverLog) {
  const deadline = Date.now() + timeoutMs;

  // Poll the exact Aralia base path instead of trusting process startup text.
  // This proves the route can answer before Playwright begins its stricter wait.
  while (Date.now() < deadline) {
    if (await isServerReady(baseUrl)) return;
    if (child.exitCode != null) {
      throw new Error(`Vite exited before serving Aralia.\n${serverLog.join('')}`);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`Vite did not serve ${baseUrl} within ${timeoutMs} ms.`);
}

async function ensureServer(baseUrl, timeoutMs) {
  if (await isServerReady(baseUrl)) {
    return { child: null, reused: true, log: [] };
  }

  const target = new URL(baseUrl);
  if (!['127.0.0.1', 'localhost'].includes(target.hostname)) {
    throw new Error(`The harness will not start a server for non-local host ${target.hostname}.`);
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const serverLog = [];
  const child = spawn(
    npmCommand,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', target.port || '3000', '--strictPort'],
    {
      cwd: REPO_ROOT,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );

  // Keep a bounded startup transcript for failure evidence without flooding the
  // command output or writing another tracked/runtime artifact.
  const rememberServerOutput = (chunk) => {
    serverLog.push(String(chunk));
    if (serverLog.length > 80) serverLog.shift();
  };
  child.stdout?.on('data', rememberServerOutput);
  child.stderr?.on('data', rememberServerOutput);
  await waitForServer(baseUrl, child, timeoutMs, serverLog);
  return { child, reused: false, log: serverLog };
}

async function stopOwnedServer(child) {
  if (!child || child.exitCode != null) return;

  // Windows npm wrappers create a child process tree. End only the wrapper this
  // harness started so Vite cannot linger after the headed browser closes.
  if (process.platform === 'win32' && child.pid) {
    await new Promise((resolveStop) => {
      const stopper = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        shell: false,
        stdio: 'ignore',
        windowsHide: true,
      });
      stopper.on('close', resolveStop);
      stopper.on('error', resolveStop);
    });
    return;
  }
  child.kill('SIGTERM');
}

// ============================================================================
// Ignored proof guard and pre-harness limitation receipt
// ============================================================================
// The command checks Git's ignore rules before creating any evidence. The
// before screenshot renders the exact old metrics receipt that skipped the
// in-game route; it is evidence of the prior limitation, not a claim that the
// old app view is being reconstructed today.
// ============================================================================

async function runQuietCommand(command, args) {
  return new Promise((resolveCommand) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('close', (code) => resolveCommand(code ?? 1));
    child.on('error', () => resolveCommand(1));
  });
}

async function assertProofPathsIgnored() {
  const candidates = [PROOF_ROOT, BEFORE_DIR, AFTER_DIR, join(PROOF_ROOT, 'proof.json')];

  // Check every directory/file shape the harness will create. One ignored parent
  // is not assumed to cover later filenames because .agent is only partly ignored.
  for (const candidate of candidates) {
    const relativeCandidate = relative(REPO_ROOT, candidate).replaceAll('\\', '/');
    const code = await runQuietCommand('git', ['check-ignore', '-q', relativeCandidate]);
    if (code !== 0) {
      throw new Error(`Refusing to write non-ignored proof path: ${relativeCandidate}`);
    }
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function makeBeforeLimitationReceipt() {
  // Keep the historical limitation in tracked source. The headed proof must
  // remain runnable in a fresh checkout where every ignored scratch file is
  // correctly absent.
  return {
    source: 'scripts/world-map/live-game-harness.mjs',
    recordedAt: PRIOR_LIMITATION_RECORDED_AT,
    limitation: PRIOR_LIMITATION,
  };
}

async function captureBeforeReceipt(browser) {
  const receipt = makeBeforeLimitationReceipt();
  const context = await browser.newContext({ viewport: DEFAULT_VIEWPORT });
  const page = await context.newPage();

  // Render the preserved audit receipt in a headed browser. This makes the
  // before artifact self-explanatory without pretending to recreate an old
  // runtime from a newer shared checkout.
  await page.setContent(`<!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>Pre-harness limitation receipt</title></head>
      <body style="margin:0;background:#07111f;color:#e5edf8;font:20px/1.5 system-ui,sans-serif;">
        <main style="max-width:1040px;margin:80px auto;padding:48px;border:2px solid #d97706;border-radius:18px;background:#111c2d;box-shadow:0 20px 70px #0008;">
          <p style="margin:0 0 12px;color:#fbbf24;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Before: pre-harness limitation</p>
          <h1 style="font-size:42px;margin:0 0 28px;">The live PLAYING MapPane was skipped</h1>
          <blockquote style="margin:0;padding:24px 28px;border-left:6px solid #f59e0b;background:#1f2937;font-size:28px;">${escapeHtml(receipt.limitation)}</blockquote>
          <p style="margin:32px 0 0;color:#aebbd0;">Durable source: <code>${escapeHtml(receipt.source)}</code></p>
          <p style="margin:8px 0 0;color:#aebbd0;">Recorded ${escapeHtml(receipt.recordedAt)}. This self-contained receipt lets a fresh checkout run the proof without ignored historical scratch.</p>
        </main>
      </body>
    </html>`);
  const screenshotPath = join(BEFORE_DIR, 'pre-harness-dummy-bootstrap-limitation.png');
  await page.screenshot({ path: screenshotPath });
  await context.close();
  return { screenshotPath, ...receipt };
}

async function fingerprintCurrentMapSources() {
  // A proof screenshot is only authoritative for the source tree that created
  // it. Hash the route and renderer files directly, including uncommitted work,
  // so later audits can detect stale evidence without relying on Git history.
  const hash = createHash('sha256');
  for (const sourcePath of FINGERPRINTED_MAP_SOURCES) {
    hash.update(sourcePath);
    hash.update('\0');
    hash.update(await readFile(join(REPO_ROOT, sourcePath)));
    hash.update('\0');
  }
  return { algorithm: 'sha256', value: hash.digest('hex'), files: FINGERPRINTED_MAP_SOURCES };
}

// ============================================================================
// Real PLAYING route journey
// ============================================================================
// This is the only runtime bootstrap. It uses the existing dev-only dummy start
// to create a real party, then the existing dev dispatch probe to replace only
// the isolated in-memory seed. It clicks the same Open World Map control a player
// uses and requires the full MapPane/viewport/AtlasSvgView chain.
// ============================================================================

async function reachLivePlayingMap(page, options) {
  const routeUrl = makePlayingRouteUrl(options.baseUrl);
  await page.goto(routeUrl, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });

  // Wait for the normal app reducer to finish the dummy start. A missing party,
  // blocked gate, or unavailable route times out and fails the command.
  await page.waitForFunction(
    () => {
      const state = window.__araliaState;
      return state?.phase === 'PLAYING' && state.partySize > 0;
    },
    null,
    { timeout: options.timeoutMs },
  );

  // Set the deterministic proof seed through the app's dev-gated reducer
  // dispatch. This context is ephemeral, so no player save or normal browser
  // local storage can observe the test-only seed.
  await page.evaluate((controlledSeed) => {
    if (typeof window.__araliaDispatch !== 'function') {
      throw new Error('Aralia dev dispatch probe is unavailable.');
    }
    window.__araliaDispatch({ type: 'SET_WORLD_SEED', payload: controlledSeed });
  }, options.seed);
  await page.waitForFunction(
    (controlledSeed) => window.__araliaState?.worldSeed === controlledSeed,
    options.seed,
    { timeout: options.timeoutMs },
  );

  // Use the actual PLAYING UI control. The dummy bootstrap normalizes its SPA
  // URL after PLAYING mounts; Playwright locators can wait behind that harmless
  // navigation and never dispatch an otherwise-ready click. Waiting on the DOM
  // state and invoking the real button keeps this proof tied to the UI control
  // without coupling it to router bookkeeping.
  await page.waitForFunction(
    () => {
      const button = document.querySelector('[data-testid="open-world-map"]');
      return button instanceof HTMLButtonElement
        && !button.disabled
        && button.getClientRects().length > 0;
    },
    null,
    { timeout: options.timeoutMs },
  );
  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="open-world-map"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) {
      throw new Error('Open World Map was not an enabled button on the PLAYING route.');
    }
    button.click();
  });
  await page.waitForFunction(
    () => window.__araliaState?.phase === 'PLAYING' && window.__araliaState?.isMapVisible === true,
    null,
    { timeout: options.timeoutMs },
  );
  await page.getByRole('dialog', { name: 'World Map' }).waitFor({
    state: 'visible',
    timeout: options.timeoutMs,
  });

  // AtlasSvgView is only accepted once the procedural geometry is populated.
  // A bare SVG shell or a canvas substitute cannot pass this wait.
  const atlas = page.getByTestId('atlas-svg-view');
  await atlas.waitFor({ state: 'visible', timeout: options.timeoutMs });
  await page.waitForFunction(
    () => (document.querySelector('[data-testid="atlas-svg-view"]')?.querySelectorAll('path').length ?? 0) > 20,
    null,
    { timeout: options.timeoutMs },
  );

  // Show and activate the seed-scoped States preference so the screenshot and
  // JSON both display a concrete, current preference rather than a hidden default.
  await page.getByTestId('atlas-layers-toggle').click();
  const statesPreference = page.getByLabel('States', { exact: true });
  await statesPreference.waitFor({ state: 'visible', timeout: options.timeoutMs });
  await statesPreference.check();
  const preferenceKey = `aralia.atlas.layerPrefs.v1:${options.seed}`;
  await page.waitForFunction(
    (key) => {
      const value = localStorage.getItem(key);
      return value != null && JSON.parse(value).mapMode === 'states';
    },
    preferenceKey,
    { timeout: options.timeoutMs },
  );

  // Let two animation frames settle after the preference change before the
  // screenshot, matching the renderer's committed visual state.
  await page.evaluate(() => new Promise((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
  }));
  return { routeUrl, preferenceKey };
}

async function collectPlayingEvidence(page, seed, preferenceKey) {
  // Playwright's label lookup uses the same accessible association a player
  // clicks. Reading the control this way avoids guessing at an implementation
  // value attribute that the map's radio buttons do not carry.
  const statesControlChecked = await page.getByLabel('States', { exact: true }).isChecked();
  return page.evaluate(({ expectedSeed, expectedPreferenceKey, selectors, checkedStatesControl }) => {
    const state = window.__araliaState ?? {};
    const mapWindow = document.querySelector('[data-testid="window-world-map-window"]');
    const viewport = document.querySelector('[data-testid="worldforge-map-viewport"]');
    const renderer = document.querySelector('[data-testid="atlas-svg-view"]');
    const preferenceRaw = localStorage.getItem(expectedPreferenceKey);
    const rectangles = {};

    // Record both reachability and geometry for every canonical surface. The
    // screenshot is the visual proof; these values make route failures machine-readable.
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) {
        rectangles[selector] = null;
        continue;
      }
      const box = element.getBoundingClientRect();
      rectangles[selector] = {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    }

    return {
      phase: state.phase ?? null,
      worldSeed: state.worldSeed ?? null,
      partySize: state.partySize ?? null,
      partyNames: state.partyNames ?? [],
      isMapVisible: state.isMapVisible ?? false,
      currentUrl: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      selectors: Object.fromEntries(selectors.map((selector) => [selector, document.querySelector(selector) != null])),
      rectangles,
      ancestry: {
        viewportInsideWindow: mapWindow?.contains(viewport) ?? false,
        rendererInsideViewport: viewport?.contains(renderer) ?? false,
      },
      renderer: {
        component: 'AtlasSvgView',
        selector: '[data-testid="atlas-svg-view"]',
        tagName: renderer?.tagName.toLowerCase() ?? null,
        pathCount: renderer?.querySelectorAll('path').length ?? 0,
        textCount: renderer?.querySelectorAll('text').length ?? 0,
        canvasCountWithinViewport: viewport?.querySelectorAll('canvas').length ?? 0,
      },
      preference: {
        key: expectedPreferenceKey,
        raw: preferenceRaw,
        value: preferenceRaw ? JSON.parse(preferenceRaw) : null,
        statesControlChecked: checkedStatesControl,
      },
      expectedSeed,
    };
  }, {
    expectedSeed: seed,
    expectedPreferenceKey: preferenceKey,
    selectors: REQUIRED_SELECTORS,
    checkedStatesControl: statesControlChecked,
  });
}

// ============================================================================
// Proof report and command lifecycle
// ============================================================================
// Successful runs write both machine-readable JSON and a compact Markdown
// receipt. Failed runs write failure.json and rethrow, so the shell receives a
// non-zero exit rather than a misleading screenshot-only success.
// ============================================================================

function markdownForProof(proof) {
  const consoleLines = proof.consoleAssessment.entries.length > 0
    ? proof.consoleAssessment.entries.map((entry) => `- ${entry.type}: ${entry.text}`).join('\n')
    : '- No browser warnings, errors, page errors, failed requests, or HTTP 4xx/5xx responses were captured.';
  return `# Live-game world map verification harness\n\n` +
    `- Command: \`${proof.command}\`\n` +
    `- Browser: ${proof.browser.name} ${proof.browser.version}\n` +
    `- Viewport: ${proof.viewport.width} x ${proof.viewport.height}\n` +
    `- Seed: ${proof.route.worldSeed}\n` +
    `- Phase: ${proof.route.phase}\n` +
    `- Route: ${proof.route.currentUrl}\n` +
    `- Renderer: ${proof.route.renderer.component} at \`${proof.route.renderer.selector}\` (${proof.route.renderer.pathCount} paths)\n` +
    `- Canvas renderers in canonical viewport: ${proof.route.renderer.canvasCountWithinViewport}\n` +
    `- Nested route chain: WindowFrame -> MapPane viewport -> AtlasSvgView\n` +
    `- Source fingerprint: \`${proof.sourceFingerprint.algorithm}:${proof.sourceFingerprint.value}\`\n` +
    `- Preference: \`${proof.route.preference.key}\` = \`${proof.route.preference.raw}\`\n` +
    `- Isolation: ephemeral Playwright context; no persistent browser profile or player save was opened\n` +
    `- Failure behavior: ${proof.failureBehavior}\n\n` +
    `## Console assessment\n\n${proof.consoleAssessment.summary}\n\n${consoleLines}\n`;
}

function assessConsoleEntries(entries) {
  // The local app is expected to warn when its optional AI key is absent, and
  // the current dev shell still requests a missing favicon. Keep both visible
  // while separating them from route, reducer, renderer, and network failures
  // that would invalidate this proof.
  const knownEnvironmentEntries = entries.filter((entry) => (
    entry.text.includes('API_KEY is missing')
    || entry.text.includes('favicon.ico')
    || entry.location?.url?.includes('favicon.ico')
  ));
  const relevantFailures = entries.filter((entry) => !knownEnvironmentEntries.includes(entry));
  return {
    count: entries.length,
    relevantFailureCount: relevantFailures.length,
    knownEnvironmentCount: knownEnvironmentEntries.length,
    summary: relevantFailures.length === 0
      ? 'No PLAYING-route or renderer failure was captured. The remaining entries are the known missing optional API key warning and missing favicon response.'
      : `${relevantFailures.length} console or transport entries require investigation.`,
    relevantFailures,
    knownEnvironmentEntries,
    entries,
  };
}

export async function runLiveMapHarness(options = parseHarnessArgs(process.argv.slice(2))) {
  await assertProofPathsIgnored();
  await mkdir(BEFORE_DIR, { recursive: true });
  await mkdir(AFTER_DIR, { recursive: true });

  const server = await ensureServer(options.baseUrl, options.timeoutMs);
  let browser;
  const consoleEntries = [];
  const startedAt = new Date().toISOString();
  const sourceFingerprint = await fingerprintCurrentMapSources();

  try {
    browser = await chromium.launch({ headless: !options.headed });
    const before = await captureBeforeReceipt(browser);
    const context = await browser.newContext({ viewport: DEFAULT_VIEWPORT });
    const page = await context.newPage();

    // Capture application warnings/errors and transport failures. Known benign
    // warnings remain visible in the report instead of being silently filtered.
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) {
        consoleEntries.push({ type: message.type(), text: message.text(), location: message.location() });
      }
    });
    page.on('pageerror', (error) => {
      consoleEntries.push({ type: 'pageerror', text: error.message });
    });
    page.on('requestfailed', (request) => {
      consoleEntries.push({
        type: 'requestfailed',
        text: `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown failure'}`,
      });
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        consoleEntries.push({ type: 'http', text: `${response.status()} ${response.url()}` });
      }
    });

    const journey = await reachLivePlayingMap(page, options);
    const routeEvidence = validatePlayingMapEvidence(
      await collectPlayingEvidence(page, options.seed, journey.preferenceKey),
      options.seed,
    );
    const afterScreenshotPath = join(AFTER_DIR, `playing-map-pane-seed-${options.seed}.png`);
    await page.screenshot({ path: afterScreenshotPath });
    const ephemeralStorageState = await context.storageState();

    // Close the isolated context before writing success. Its localStorage and
    // IndexedDB disappear here and were never connected to a player profile.
    await context.close();

    const proof = {
      capturedAt: new Date().toISOString(),
      startedAt,
      command: 'node scripts/world-map/live-game-harness.mjs',
      options,
      browser: { name: 'Chromium', version: browser.version(), headed: options.headed },
      viewport: DEFAULT_VIEWPORT,
      server: { baseUrl: options.baseUrl, reusedExistingServer: server.reused },
      sourceFingerprint,
      before,
      after: { screenshotPath: afterScreenshotPath },
      route: routeEvidence,
      rendererSelectors: REQUIRED_SELECTORS,
      consoleAssessment: assessConsoleEntries(consoleEntries),
      isolation: {
        persistentBrowserProfileUsed: false,
        playerSaveLoaded: false,
        contextClosedAfterCapture: true,
        ephemeralOrigins: ephemeralStorageState.origins.map((origin) => origin.origin),
      },
      failureBehavior: 'Missing PLAYING state, party, seed, open MapPane, nested selector chain, zero-canvas boundary, or populated SVG throws and exits non-zero; failure.json records the blocker.',
    };
    await writeFile(join(PROOF_ROOT, 'proof.json'), `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
    await writeFile(join(PROOF_ROOT, 'proof.md'), markdownForProof(proof), 'utf8');
    return proof;
  } catch (error) {
    const failure = {
      failedAt: new Date().toISOString(),
      command: 'node scripts/world-map/live-game-harness.mjs',
      options,
      error: error instanceof Error ? error.message : String(error),
      consoleAssessment: consoleEntries,
      failureBehavior: 'The command exits non-zero; no after screenshot is accepted as success.',
    };
    await writeFile(join(PROOF_ROOT, 'failure.json'), `${JSON.stringify(failure, null, 2)}\n`, 'utf8');
    throw error;
  } finally {
    await browser?.close();
    await stopOwnedServer(server.child);
  }
}

// Run only when invoked as the local proof command. Importing this file in the
// focused Vitest suite exercises helpers without opening a browser or server.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runLiveMapHarness()
    .then((proof) => {
      process.stdout.write(
        `Live PLAYING MapPane verified for seed ${proof.route.worldSeed}.\nProof: ${relative(REPO_ROOT, join(PROOF_ROOT, 'proof.json')).replaceAll('\\', '/')}\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(`Live-game world-map harness failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
