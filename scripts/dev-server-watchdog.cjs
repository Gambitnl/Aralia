/**
 * This file verifies that a local Vite server is both answering requests and
 * serving the same source that exists in the shared checkout.
 *
 * Visual capture commands call the exported probe before opening a browser.
 * Operators can also run this file directly for one check, a repeated watch,
 * or a consented supervisor that may restart only the Vite child it launched.
 * Every command-line check appends a JSON-line receipt under `.agent/` so a
 * failed or recovered server leaves readable evidence after the process ends.
 *
 * Called by: tools/vistest/shoot.ts and direct `node` watchdog commands.
 * Depends on: Node's HTTP, hashing, filesystem, and child-process libraries.
 */
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

// ============================================================================
// Shared result vocabulary and defaults
// ============================================================================
// Capture and watchdog callers use these exact labels. Keeping them here stops
// a dead server and a live-but-stale server from being collapsed into one vague
// "capture failed" result by different entry points.
// ============================================================================

const STATUS_HEALTHY = 'healthy';
const STATUS_LIVENESS_FAILURE = 'liveness_failure';
const STATUS_FRESHNESS_FAILURE = 'freshness_failure';
const DEFAULT_BASE_URL = 'http://127.0.0.1:3000/Aralia/';
const DEFAULT_TIMEOUT_MS = 3_000;
const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_EVIDENCE_PATH = path.join('.agent', 'dev-server-watchdog.log');

/** Create a stable SHA-256 fingerprint for source bytes. */
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Add a unique query value so Vite and intermediary caches must answer this
 * check as a new request instead of replaying an older capture-time response.
 */
function cacheBustedUrl(input, key) {
  const url = new URL(input);
  url.searchParams.set(key, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`);
  return url;
}

// ============================================================================
// Time-bounded HTTP reads
// ============================================================================
// Liveness settles when response headers arrive. Freshness reads the complete
// raw-module wrapper because the served source must be decoded and hashed.
// Both paths own a hard timer, so a listening but wedged socket cannot consume
// the visual worker's remaining turn indefinitely.
// ============================================================================

function requestUrl(url, { timeoutMs = DEFAULT_TIMEOUT_MS, readBody = false } = {}) {
  const startedAt = Date.now();
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve) => {
    let settled = false;
    let request;

    // Finish exactly once and tear down any socket that could otherwise keep a
    // failed proof command alive after its classification is already known.
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      try {
        request?.destroy();
      } catch {
        // The result is already durable; socket teardown is best effort.
      }
      resolve({ ...result, responseMs: Date.now() - startedAt });
    };

    const deadline = setTimeout(() => {
      finish({ ok: false, error: `request exceeded ${timeoutMs} ms` });
    }, timeoutMs);

    request = transport.request(
      url,
      {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store',
          Pragma: 'no-cache',
          'User-Agent': 'Aralia-WF-G30-Freshness-Probe/1.0',
        },
      },
      (response) => {
        const statusCode = Number(response.statusCode) || 0;

        // The base-page probe needs only proof that the event loop produced an
        // HTTP response. Drain no body, because a streaming page must not hold
        // the liveness classification open.
        if (!readBody) {
          response.destroy();
          finish({ ok: statusCode >= 200 && statusCode < 400, statusCode });
          return;
        }

        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += String(chunk);
        });
        response.on('end', () => {
          finish({ ok: statusCode >= 200 && statusCode < 300, statusCode, body });
        });
        response.on('aborted', () => finish({ ok: false, statusCode, error: 'response aborted before completion' }));
        response.on('error', (error) => finish({ ok: false, statusCode, error: error.message }));
      },
    );

    request.on('error', (error) => finish({ ok: false, error: error.message }));
    request.end();
  });
}

// ============================================================================
// Vite raw-module decoding and freshness comparison
// ============================================================================
// A `?raw` request returns a tiny JavaScript wrapper whose default export is the
// exact file text. We accept only that one string literal and evaluate it in an
// empty VM context. This avoids comparing Vite's transformed imports while
// still proving that the server read the current checkout bytes.
// ============================================================================

function decodeViteRawModule(body) {
  const prefix = /^\s*export\s+default\s+/.exec(body);
  if (!prefix) {
    throw new Error('served module was not a Vite raw-module wrapper');
  }

  const start = prefix[0].length;
  const quote = body[start];
  if (quote !== '"' && quote !== "'") {
    throw new Error('Vite raw-module wrapper did not start with a string literal');
  }

  let escaped = false;
  let end = -1;
  for (let index = start + 1; index < body.length; index += 1) {
    const character = body[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === quote) {
      end = index;
      break;
    }
  }

  if (end < 0) {
    throw new Error('Vite raw-module string did not terminate');
  }

  const literal = body.slice(start, end + 1);
  const decoded = vm.runInNewContext(literal, Object.create(null), { timeout: 50 });
  if (typeof decoded !== 'string') {
    throw new Error('Vite raw-module export was not text');
  }
  return decoded;
}

/**
 * Resolve a module only inside the selected checkout. A visual-proof command
 * may name source to verify, but it may not use the probe as an arbitrary local
 * file reader outside the repository.
 */
function resolveLocalModule(repoRoot, modulePath) {
  const root = path.resolve(repoRoot);
  const resolved = path.resolve(root, modulePath);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`freshness module must be a file below the repository root: ${modulePath}`);
  }
  return { root, resolved, relative: relative.replace(/\\/g, '/') };
}

/**
 * Run the authoritative WF-G30 probe. Liveness is checked first. Freshness is
 * checked only after a good base response, so the result always tells the
 * operator whether the server is dead or specifically serving stale source.
 */
async function probeDevServer({
  baseUrl = DEFAULT_BASE_URL,
  modulePath,
  repoRoot = process.cwd(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const checkedAt = new Date().toISOString();
  const normalizedBase = new URL(baseUrl);
  if (!normalizedBase.pathname.endsWith('/')) normalizedBase.pathname += '/';

  const livenessUrl = cacheBustedUrl(normalizedBase, 'wf_g30_liveness');
  const liveness = await requestUrl(livenessUrl, { timeoutMs, readBody: false });
  if (!liveness.ok) {
    return {
      ok: false,
      status: STATUS_LIVENESS_FAILURE,
      checkedAt,
      baseUrl: normalizedBase.toString(),
      liveness: { url: livenessUrl.toString(), ...liveness },
    };
  }

  if (!modulePath) {
    return {
      ok: false,
      status: STATUS_FRESHNESS_FAILURE,
      checkedAt,
      baseUrl: normalizedBase.toString(),
      liveness: { url: livenessUrl.toString(), ...liveness },
      freshness: { error: 'no named module was supplied for freshness proof' },
    };
  }

  let localModule;
  let localSource;
  try {
    localModule = resolveLocalModule(repoRoot, modulePath);
    localSource = fs.readFileSync(localModule.resolved);
  } catch (error) {
    return {
      ok: false,
      status: STATUS_FRESHNESS_FAILURE,
      checkedAt,
      baseUrl: normalizedBase.toString(),
      liveness: { url: livenessUrl.toString(), ...liveness },
      freshness: { modulePath, error: `could not read named local module: ${error.message}` },
    };
  }

  const moduleUrl = new URL(localModule.relative, normalizedBase);
  // Vite's raw plugin recognizes the bare `?raw` marker. URLSearchParams would
  // serialize an empty value as `raw=`, which this live Vite version treats as
  // a normal transformed module and therefore cannot provide exact source.
  const freshnessNonce = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  moduleUrl.search = `?raw&wf_g30_freshness=${encodeURIComponent(freshnessNonce)}`;
  const served = await requestUrl(moduleUrl, { timeoutMs, readBody: true });
  const expectedHash = sha256(localSource);

  if (!served.ok) {
    return {
      ok: false,
      status: STATUS_FRESHNESS_FAILURE,
      checkedAt,
      baseUrl: normalizedBase.toString(),
      liveness: { url: livenessUrl.toString(), ...liveness },
      freshness: {
        modulePath: localModule.relative,
        url: moduleUrl.toString(),
        expectedHash,
        ...served,
      },
    };
  }

  let servedSource;
  try {
    servedSource = decodeViteRawModule(served.body);
  } catch (error) {
    return {
      ok: false,
      status: STATUS_FRESHNESS_FAILURE,
      checkedAt,
      baseUrl: normalizedBase.toString(),
      liveness: { url: livenessUrl.toString(), ...liveness },
      freshness: {
        modulePath: localModule.relative,
        url: moduleUrl.toString(),
        expectedHash,
        statusCode: served.statusCode,
        responseMs: served.responseMs,
        error: error.message,
      },
    };
  }

  const actualHash = sha256(Buffer.from(servedSource, 'utf8'));
  const freshness = {
    modulePath: localModule.relative,
    url: moduleUrl.toString(),
    expectedHash,
    actualHash,
    statusCode: served.statusCode,
    responseMs: served.responseMs,
  };
  if (actualHash !== expectedHash) {
    return {
      ok: false,
      status: STATUS_FRESHNESS_FAILURE,
      checkedAt,
      baseUrl: normalizedBase.toString(),
      liveness: { url: livenessUrl.toString(), ...liveness },
      freshness,
    };
  }

  return {
    ok: true,
    status: STATUS_HEALTHY,
    checkedAt,
    baseUrl: normalizedBase.toString(),
    liveness: { url: livenessUrl.toString(), ...liveness },
    freshness,
  };
}

// ============================================================================
// Durable evidence
// ============================================================================
// JSON Lines stays readable with Get-Content while preserving every probe and
// restart event. The default `.log` suffix is already ignored by this repo.
// ============================================================================

function appendEvidence(evidencePath, event) {
  const resolved = path.resolve(evidencePath || DEFAULT_EVIDENCE_PATH);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.appendFileSync(resolved, `${JSON.stringify(event)}\n`, 'utf8');
  return resolved;
}

// ============================================================================
// Owned-child restart boundary
// ============================================================================
// A process record enters this WeakSet only when this module spawned it. Even
// explicit consent cannot turn an arbitrary PID or port listener into an owned
// child, which protects another agent's long-lived Vite process from takeover.
// ============================================================================

const ownedChildRecords = new WeakSet();

function isViteLaunch(command, args) {
  const executable = path.basename(String(command)).toLowerCase();
  const usesNode = executable === 'node' || executable === 'node.exe';
  const namesVite = args.some((argument) => /(^|[\\/])vite(?:\.js)?($|[\\/])/i.test(String(argument)));
  return usesNode && namesVite;
}

function launchOwnedViteChild({
  command,
  args,
  cwd = process.cwd(),
  stdio = 'inherit',
  spawnChild = spawn,
}) {
  if (!isViteLaunch(command, args)) {
    throw new Error('supervise accepts only a Node command whose arguments name the Vite executable');
  }
  // Tests inject a harmless ChildProcess-shaped fixture here. Production uses
  // Node's real spawn function and still applies the same Vite-only boundary.
  const child = spawnChild(command, args, { cwd, stdio, windowsHide: true, shell: false });
  const record = { child, command, args: [...args], cwd };
  ownedChildRecords.add(record);
  return record;
}

async function waitForExit(child, timeoutMs = 5_000) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function restartOwnedViteChild(record, {
  consentRestartOwnedChild = false,
  stopChild,
  launchChild = launchOwnedViteChild,
} = {}) {
  if (!consentRestartOwnedChild) {
    return { ok: false, action: 'consent_required' };
  }
  if (!ownedChildRecords.has(record)) {
    return { ok: false, action: 'foreign_owner_refused' };
  }

  // Stop only the exact ChildProcess object created by this module. No PID
  // lookup, port scan, or owner receipt can redirect this operation elsewhere.
  if (stopChild) {
    await stopChild(record.child);
  } else if (record.child.exitCode === null && record.child.signalCode === null) {
    record.child.kill('SIGTERM');
    const stopped = await waitForExit(record.child);
    if (!stopped) {
      // Starting a replacement while the owned child remains alive could race
      // for the same port. Leave recovery stopped and ask the operator instead.
      return { ok: false, action: 'owned_child_did_not_exit' };
    }
  }

  const replacement = launchChild({
    command: record.command,
    args: record.args,
    cwd: record.cwd,
    stdio: 'inherit',
  });
  return { ok: true, action: 'restarted_owned_child', record: replacement };
}

// ============================================================================
// Command-line watchdog and supervisor
// ============================================================================
// `probe` checks once. `watch` diagnoses repeated failures without owning a
// process. `supervise` starts a Vite child and may replace that child only when
// the operator supplied the explicit consent flag on this exact invocation.
// ============================================================================

function parseCli(argv) {
  const separator = argv.indexOf('--');
  const optionTokens = separator >= 0 ? argv.slice(0, separator) : argv;
  const childCommand = separator >= 0 ? argv.slice(separator + 1) : [];
  const mode = ['probe', 'watch', 'supervise'].includes(optionTokens[0]) ? optionTokens.shift() : 'probe';
  const options = new Map();

  for (let index = 0; index < optionTokens.length; index += 1) {
    const token = optionTokens[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument "${token}"`);
    const name = token.slice(2);
    if (name === 'consent-restart-owned-child') {
      options.set(name, true);
      continue;
    }
    const value = optionTokens[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${name}`);
    options.set(name, value);
    index += 1;
  }
  return { mode, options, childCommand };
}

function positiveNumber(value, fallback, name) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive number`);
  return parsed;
}

function printResult(result, evidencePath) {
  const moduleDetail = result.freshness
    ? ` module=${result.freshness.modulePath || '<missing>'} expected=${result.freshness.expectedHash || '<none>'} actual=${result.freshness.actualHash || '<none>'}`
    : '';
  const error = result.freshness?.error || result.liveness?.error || '';
  process.stdout.write(`WF-G30 ${result.status.toUpperCase()} base=${result.baseUrl}${moduleDetail}${error ? ` error=${error}` : ''} evidence=${evidencePath}\n`);
}

async function runCli(argv = process.argv.slice(2)) {
  const { mode, options, childCommand } = parseCli(argv);
  const probeOptions = {
    baseUrl: options.get('base') || DEFAULT_BASE_URL,
    modulePath: options.get('module'),
    repoRoot: options.get('repo-root') || process.cwd(),
    timeoutMs: positiveNumber(options.get('timeout-ms'), DEFAULT_TIMEOUT_MS, 'timeout-ms'),
  };
  const intervalMs = positiveNumber(options.get('interval-ms'), DEFAULT_INTERVAL_MS, 'interval-ms');
  const failureThreshold = positiveNumber(options.get('failure-threshold'), DEFAULT_FAILURE_THRESHOLD, 'failure-threshold');
  const evidencePath = options.get('evidence') || DEFAULT_EVIDENCE_PATH;

  if (!probeOptions.modulePath) {
    throw new Error('--module is required so a live server cannot pass without freshness proof');
  }

  let ownedRecord = null;
  const consent = options.get('consent-restart-owned-child') === true;
  if (mode === 'supervise') {
    if (!consent) throw new Error('supervise requires --consent-restart-owned-child');
    if (childCommand.length < 2) throw new Error('supervise requires `-- node <vite executable> ...`');
    ownedRecord = launchOwnedViteChild({ command: childCommand[0], args: childCommand.slice(1) });
    appendEvidence(evidencePath, {
      event: 'owned_child_started',
      at: new Date().toISOString(),
      pid: ownedRecord.child.pid,
      command: ownedRecord.command,
      args: ownedRecord.args,
    });
  }

  let consecutiveFailures = 0;
  while (true) {
    const result = await probeDevServer(probeOptions);
    const resolvedEvidencePath = appendEvidence(evidencePath, { event: 'probe', ...result });
    printResult(result, resolvedEvidencePath);
    consecutiveFailures = result.ok ? 0 : consecutiveFailures + 1;

    if (mode === 'probe') return result.ok ? 0 : 2;
    if (consecutiveFailures >= failureThreshold) {
      appendEvidence(evidencePath, {
        event: 'failure_threshold_reached',
        at: new Date().toISOString(),
        status: result.status,
        consecutiveFailures,
      });

      if (mode !== 'supervise') {
        process.stderr.write('WF-G30 watchdog stopped without mutation. Ask the owning operator to recover the server.\n');
        return 2;
      }

      const restarted = await restartOwnedViteChild(ownedRecord, { consentRestartOwnedChild: consent });
      appendEvidence(evidencePath, {
        event: restarted.action,
        at: new Date().toISOString(),
        previousPid: ownedRecord.child.pid,
        replacementPid: restarted.record?.child.pid || null,
      });
      if (!restarted.ok) return 2;
      ownedRecord = restarted.record;
      consecutiveFailures = 0;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// Run the CLI only for direct invocation. Imports receive the same probe and
// safety helpers without starting a watch loop as a side effect.
if (require.main === module) {
  runCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      process.stderr.write(`WF-G30 watchdog configuration error: ${error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  DEFAULT_EVIDENCE_PATH,
  STATUS_FRESHNESS_FAILURE,
  STATUS_HEALTHY,
  STATUS_LIVENESS_FAILURE,
  appendEvidence,
  decodeViteRawModule,
  launchOwnedViteChild,
  probeDevServer,
  restartOwnedViteChild,
  runCli,
  sha256,
};
