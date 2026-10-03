#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

/**
 * This file captures and compares reproducible TypeScript error snapshots.
 *
 * Agents call it through `npm run typecheck:delta` when the shared checkout already
 * contains unrelated compiler errors. It runs the repository's installed compiler
 * directly, stores one ignored baseline safely, and prints only errors that are new
 * relative to that capture. The baseline is timestamped evidence, not proof that an
 * error existed before any particular edit.
 *
 * Called by: the `typecheck:delta` package script and its deterministic node:test suite
 * Depends on: the installed TypeScript compiler, the selected tsconfig, and Node's file APIs
 */

// ============================================================================
// Stable Format and Timing Defaults
// ============================================================================
// These values define the on-disk contract and put a firm upper bound on waiting
// for another agent that is publishing the same shared baseline.
// ============================================================================
const SCHEMA_VERSION = 1;
const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_RETRY_INTERVAL_MS = 40;

// ============================================================================
// Path and Diagnostic Normalization
// ============================================================================
// Baselines must compare the same way on Windows and other platforms. Paths are
// therefore recorded relative to the working root with forward slashes, and only
// complete TypeScript `error TS` lines are retained.
// ============================================================================

// Use forward slashes in persisted metadata and diagnostic paths so snapshots do
// not change merely because another agent reads them on a different platform.
function slashPath(value) {
  return value.replace(/\\/g, '/');
}

// Describe a path relative to the command's working root. An outside path keeps
// its `../` segments, which remains reproducible without leaking an absolute root.
function rootRelativePath(cwd, targetPath) {
  const relativePath = path.relative(cwd, path.resolve(targetPath));
  return slashPath(relativePath || '.');
}

// Normalize a single compiler line while preserving the diagnostic's wording.
// File-prefixed errors receive a root-relative slash path; configuration-level
// errors such as `error TS18003` have no file path and remain otherwise unchanged.
function normalizeDiagnosticLine(line, cwd) {
  const trimmedLine = String(line).replace(/\t/g, ' ').trim();
  if (!/\berror TS\d+:/.test(trimmedLine)) return null;

  const fileDiagnostic = trimmedLine.match(/^(.*?)(\(\d+,\d+\):\s*error TS\d+:.*)$/);
  if (!fileDiagnostic) return trimmedLine;

  const rawFilePath = fileDiagnostic[1].trim();
  const absoluteFilePath = path.isAbsolute(rawFilePath)
    ? rawFilePath
    : path.resolve(cwd, rawFilePath);
  return `${rootRelativePath(cwd, absoluteFilePath)}${fileDiagnostic[2]}`;
}

// Keep every normalized occurrence and sort with a locale-independent comparison.
// Preserving duplicates lets the delta notice when the same diagnostic appears in
// one additional compiler context instead of silently treating it as unchanged.
function normalizeDiagnostics(output, cwd) {
  return String(output)
    .split(/\r?\n/)
    .map((line) => normalizeDiagnosticLine(line, cwd))
    .filter((line) => line !== null)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

// Subtract diagnostics as a counted collection rather than a simple set. A line
// is new only after every matching occurrence in the reference has been consumed.
function subtractDiagnostics(candidateDiagnostics, referenceDiagnostics) {
  const remainingReferenceCounts = new Map();
  for (const diagnostic of referenceDiagnostics) {
    remainingReferenceCounts.set(diagnostic, (remainingReferenceCounts.get(diagnostic) || 0) + 1);
  }

  const difference = [];
  for (const diagnostic of candidateDiagnostics) {
    const remainingCount = remainingReferenceCounts.get(diagnostic) || 0;
    if (remainingCount > 0) {
      remainingReferenceCounts.set(diagnostic, remainingCount - 1);
    } else {
      difference.push(diagnostic);
    }
  }
  return difference;
}

// ============================================================================
// Command-Line Options
// ============================================================================
// The public command intentionally has only baseline and config selectors. The
// compiler flags are fixed so two agents cannot accidentally compare unlike runs.
// ============================================================================

// Convert the small command-line surface into absolute working paths. Unknown or
// incomplete options fail loudly instead of being forwarded to a shell or compiler.
function parseArguments(argv, cwd) {
  let baselineArgument = null;
  let configArgument = 'tsconfig.json';
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--baseline' || argument === '--config') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a path.`);
      }
      if (argument === '--baseline') baselineArgument = value;
      if (argument === '--config') configArgument = value;
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      help = true;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  const configPath = path.resolve(cwd, configArgument);
  const defaultBaselinePath = path.join(cwd, '.agent', 'typecheck-baselines', 'tsconfig-baseline.json');
  return {
    baselinePath: path.resolve(cwd, baselineArgument || defaultBaselinePath),
    configPath,
    help,
  };
}

// Explain the deliberately narrow interface without implying that a baseline can
// establish when a diagnostic was introduced.
function helpText() {
  return [
    'Usage: npm run typecheck:delta -- [--baseline <json>] [--config <tsconfig>]',
    '',
    'Creates the baseline once, then prints only diagnostics newly present since that capture.',
    'A baseline records conditions at its timestamp; it cannot prove an error pre-dated an edit.',
  ].join('\n');
}

// ============================================================================
// Compiler Execution and Snapshot Metadata
// ============================================================================
// The compiler is launched through the current Node executable with shell handling
// disabled. This avoids command-wrapper differences and prevents arguments from
// being interpreted as shell input.
// ============================================================================

// The production runner invokes exactly the installed tsc JavaScript entrypoint.
// Tests replace this function with a deterministic fake and never run a real compiler.
function runCompilerDirectly({ executable, args, cwd }) {
  return spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  });
}

// Read TypeScript's own package metadata rather than trusting a wrapper's version
// output. The compiler entrypoint and version therefore describe the same install.
async function readCompilerVersion(compilerPath) {
  const packagePath = path.resolve(path.dirname(compilerPath), '..', 'package.json');
  const packageText = await fs.promises.readFile(packagePath, 'utf8');
  const packageMetadata = JSON.parse(packageText);
  if (typeof packageMetadata.version !== 'string' || packageMetadata.version.length === 0) {
    throw new Error(`TypeScript version is missing from ${packagePath}.`);
  }
  return packageMetadata.version;
}

// Hash the exact selected configuration bytes. Any edit, including an inherited
// config pointer change, is visible as identity drift on the next comparison.
async function sha256File(filePath) {
  const contents = await fs.promises.readFile(filePath);
  return crypto.createHash('sha256').update(contents).digest('hex');
}

// Run the fixed compiler command and return only normalized TypeScript errors.
// A nonzero tsc exit is expected when errors exist; a failure with no TypeScript
// diagnostic is treated as a tool failure rather than an empty successful run.
function collectCurrentDiagnostics({ cwd, compilerPath, configPath, runner }) {
  const compilerArgs = [compilerPath, '--noEmit', '--pretty', 'false', '--project', configPath];
  const result = runner({ executable: process.execPath, args: compilerArgs, cwd });

  if (result.error) throw result.error;
  if (result.signal) throw new Error(`TypeScript compiler ended from signal ${result.signal}.`);

  const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`;
  const diagnostics = normalizeDiagnostics(combinedOutput, cwd);
  if (result.status !== 0 && diagnostics.length === 0) {
    throw new Error(`TypeScript compiler exited ${result.status} without a TypeScript error diagnostic.`);
  }

  return {
    compilerArgs,
    compilerExitCode: result.status ?? 0,
    diagnostics,
  };
}

// Assemble everything needed to interpret the capture later. Compiler and config
// paths are root-relative while the cwd records which root the capture described.
async function createCurrentSnapshot(options) {
  const {
    cwd,
    compilerPath,
    configPath,
    compilerVersion,
    now,
    runner,
  } = options;
  const compilerResult = collectCurrentDiagnostics({ cwd, compilerPath, configPath, runner });
  const configRelativePath = rootRelativePath(cwd, configPath);
  const compilerRelativePath = rootRelativePath(cwd, compilerPath);

  return {
    schemaVersion: SCHEMA_VERSION,
    capturedAt: now().toISOString(),
    cwd: slashPath(path.resolve(cwd)),
    config: {
      path: configRelativePath,
      sha256: await sha256File(configPath),
    },
    compiler: {
      path: compilerRelativePath,
      version: compilerVersion,
    },
    invocation: {
      executable: slashPath(process.execPath),
      arguments: [
        compilerRelativePath,
        '--noEmit',
        '--pretty',
        'false',
        '--project',
        configRelativePath,
      ],
    },
    compilerExitCode: compilerResult.compilerExitCode,
    diagnostics: compilerResult.diagnostics,
  };
}

// ============================================================================
// Baseline Validation, Locking, and Atomic Publication
// ============================================================================
// Baseline writers coordinate through an adjacent directory created atomically.
// Readers may use a complete published baseline immediately, while incomplete or
// missing state is retried only until the bounded deadline.
// ============================================================================

// Reject unknown or damaged baseline shapes before they can produce a misleading
// comparison. Schema changes must be explicit because this file is shared evidence.
function validateBaseline(candidate) {
  if (!candidate || typeof candidate !== 'object') throw new Error('Baseline must be a JSON object.');
  if (candidate.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported baseline schema version: ${candidate.schemaVersion}.`);
  }
  if (typeof candidate.capturedAt !== 'string') throw new Error('Baseline capturedAt is missing.');
  if (!candidate.config || typeof candidate.config.path !== 'string' || typeof candidate.config.sha256 !== 'string') {
    throw new Error('Baseline config identity is incomplete.');
  }
  if (!candidate.compiler || typeof candidate.compiler.path !== 'string' || typeof candidate.compiler.version !== 'string') {
    throw new Error('Baseline compiler identity is incomplete.');
  }
  if (!candidate.invocation || !Array.isArray(candidate.invocation.arguments)) {
    throw new Error('Baseline invocation is incomplete.');
  }
  if (!Array.isArray(candidate.diagnostics) || candidate.diagnostics.some((line) => typeof line !== 'string')) {
    throw new Error('Baseline diagnostics must be an array of strings.');
  }
  return candidate;
}

// Read one published candidate without assuming that another process has finished.
// Missing files and temporarily unparseable JSON are distinguishable from a valid
// JSON document whose schema is wrong and should never be silently retried.
async function readBaselineOnce(baselinePath) {
  try {
    const text = await fs.promises.readFile(baselinePath, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return { state: 'unparseable', error };
    }
    return { state: 'ready', baseline: validateBaseline(parsed) };
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'missing' };
    throw error;
  }
}

// Publish through a uniquely owned temporary file in the destination directory.
// The final rename is atomic, so readers see either no baseline or the whole JSON.
async function publishBaselineAtomically(baselinePath, snapshot) {
  const directory = path.dirname(baselinePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(baselinePath)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`,
  );

  try {
    await fs.promises.writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await fs.promises.rename(temporaryPath, baselinePath);
  } finally {
    // Only this invocation knows the random temporary name, so cleaning it cannot
    // remove another agent's in-progress publication.
    await fs.promises.unlink(temporaryPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

// Pause between lock attempts without blocking other concurrent writers in the
// same Node process. Tests inject a shorter pause to keep concurrency proof fast.
function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Return the existing complete baseline or become the one writer allowed to create
// it. A writer owns the lock only when its mkdir succeeds and removes only that lock.
async function createOrReadBaseline(options) {
  const {
    baselinePath,
    currentSnapshot,
    lockTimeoutMs,
    retryIntervalMs,
    wait,
  } = options;
  const lockPath = `${baselinePath}.lock`;
  const deadline = Date.now() + lockTimeoutMs;

  await fs.promises.mkdir(path.dirname(baselinePath), { recursive: true });

  while (Date.now() <= deadline) {
    const readResult = await readBaselineOnce(baselinePath);
    if (readResult.state === 'ready') {
      return { baseline: readResult.baseline, created: false };
    }

    let ownsLock = false;
    try {
      await fs.promises.mkdir(lockPath);
      ownsLock = true;

      // Re-read after acquiring the lock because another writer may have published
      // between our first read and this successful mkdir attempt.
      const lockedReadResult = await readBaselineOnce(baselinePath);
      if (lockedReadResult.state === 'ready') {
        return { baseline: lockedReadResult.baseline, created: false };
      }
      if (lockedReadResult.state === 'unparseable') {
        throw new Error(`Baseline is not valid JSON: ${baselinePath}.`);
      }

      await publishBaselineAtomically(baselinePath, currentSnapshot);
      return { baseline: currentSnapshot, created: true };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    } finally {
      if (ownsLock) {
        // The empty lock directory was created by this invocation, so removing it
        // cannot release a lock held by another baseline writer.
        await fs.promises.rmdir(lockPath).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
        });
      }
    }

    await wait(retryIntervalMs);
  }

  const finalReadResult = await readBaselineOnce(baselinePath);
  if (finalReadResult.state === 'ready') {
    return { baseline: finalReadResult.baseline, created: false };
  }
  if (finalReadResult.state === 'unparseable') {
    throw new Error(`Baseline stayed unreadable until the retry deadline: ${baselinePath}.`);
  }
  throw new Error(`Timed out waiting for the baseline writer lock: ${lockPath}.`);
}

// ============================================================================
// Drift Analysis and Human-Facing Report
// ============================================================================
// Disappeared errors are summarized without printing their lines. Configuration and
// compiler changes are reported separately so an apparently clean delta is not read
// as a comparison between unlike compiler conditions.
// ============================================================================

// Describe exactly which configuration identity fields changed since capture.
function describeConfigDrift(baseline, currentSnapshot) {
  const changes = [];
  if (baseline.config.path !== currentSnapshot.config.path) changes.push('path changed');
  if (baseline.config.sha256 !== currentSnapshot.config.sha256) changes.push('SHA-256 changed');
  return changes.length > 0 ? changes.join('; ') : 'none';
}

// Compiler drift includes the executable identity and fixed invocation. Invocation
// is included because changing flags would make the diagnostic sets incomparable.
function describeCompilerDrift(baseline, currentSnapshot) {
  const changes = [];
  if (baseline.compiler.path !== currentSnapshot.compiler.path) changes.push('path changed');
  if (baseline.compiler.version !== currentSnapshot.compiler.version) changes.push('version changed');
  if (JSON.stringify(baseline.invocation) !== JSON.stringify(currentSnapshot.invocation)) {
    changes.push('invocation changed');
  }
  return changes.length > 0 ? changes.join('; ') : 'none';
}

// Build a compact report whose only diagnostic lines are genuinely new entries.
// Baseline and disappeared lines remain private to the JSON evidence and counts.
function buildReport(options) {
  const {
    baseline,
    baselineCreated,
    baselinePath,
    cwd,
    currentSnapshot,
    disappearedDiagnostics,
    newDiagnostics,
  } = options;
  const lines = [
    `Typecheck delta: baseline ${baselineCreated ? 'created' : 'reused'} at ${rootRelativePath(cwd, baselinePath)}.`,
    `Baseline captured: ${baseline.capturedAt}.`,
    `Diagnostics: baseline ${baseline.diagnostics.length}; current ${currentSnapshot.diagnostics.length}; new ${newDiagnostics.length}.`,
    `Disappeared baseline diagnostics: ${disappearedDiagnostics.length} (lines omitted).`,
    `Config identity drift: ${describeConfigDrift(baseline, currentSnapshot)}.`,
    `Compiler identity drift: ${describeCompilerDrift(baseline, currentSnapshot)}.`,
    'Evidence limit: this baseline describes only its capture timestamp; it cannot prove an error pre-dated an edit.',
  ];

  if (newDiagnostics.length > 0) {
    lines.push('New diagnostics:', ...newDiagnostics);
  }
  return lines;
}

// ============================================================================
// Orchestration API and CLI Entry Point
// ============================================================================
// The exported API accepts injected time, waiting, and compiler runners so tests can
// prove the concurrency contract without depending on the repository's current debt.
// ============================================================================

// Execute one capture-or-compare operation and return structured evidence alongside
// the intended process exit code: zero for capture/no-new, one for new diagnostics.
async function runTypecheckDelta(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const configPath = path.resolve(options.configPath || path.join(cwd, 'tsconfig.json'));
  const baselinePath = path.resolve(
    options.baselinePath || path.join(cwd, '.agent', 'typecheck-baselines', 'tsconfig-baseline.json'),
  );
  const compilerPath = path.resolve(
    options.compilerPath || path.join(cwd, 'node_modules', 'typescript', 'lib', 'tsc.js'),
  );
  const runner = options.runner || runCompilerDirectly;
  const now = options.now || (() => new Date());
  const wait = options.wait || delay;
  const compilerVersion = options.compilerVersion || await readCompilerVersion(compilerPath);

  const currentSnapshot = await createCurrentSnapshot({
    cwd,
    compilerPath,
    configPath,
    compilerVersion,
    now,
    runner,
  });
  const baselineResult = await createOrReadBaseline({
    baselinePath,
    currentSnapshot,
    lockTimeoutMs: options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS,
    retryIntervalMs: options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS,
    wait,
  });

  const newDiagnostics = baselineResult.created
    ? []
    : subtractDiagnostics(currentSnapshot.diagnostics, baselineResult.baseline.diagnostics);
  const disappearedDiagnostics = baselineResult.created
    ? []
    : subtractDiagnostics(baselineResult.baseline.diagnostics, currentSnapshot.diagnostics);
  const lines = buildReport({
    baseline: baselineResult.baseline,
    baselineCreated: baselineResult.created,
    baselinePath,
    cwd,
    currentSnapshot,
    disappearedDiagnostics,
    newDiagnostics,
  });

  if (options.writeLine) {
    for (const line of lines) options.writeLine(line);
  }

  return {
    baseline: baselineResult.baseline,
    baselineCreated: baselineResult.created,
    currentSnapshot,
    disappearedDiagnostics,
    exitCode: newDiagnostics.length > 0 ? 1 : 0,
    lines,
    newDiagnostics,
  };
}

// Translate command-line arguments into the injectable API and reserve exit code 2
// for malformed options, compiler launch failures, or unreadable baseline evidence.
async function main(argv = process.argv.slice(2)) {
  try {
    const cwd = process.cwd();
    const parsed = parseArguments(argv, cwd);
    if (parsed.help) {
      process.stdout.write(`${helpText()}\n`);
      return 0;
    }

    const result = await runTypecheckDelta({
      cwd,
      baselinePath: parsed.baselinePath,
      configPath: parsed.configPath,
      writeLine: (line) => process.stdout.write(`${line}\n`),
    });
    return result.exitCode;
  } catch (error) {
    process.stderr.write(`Typecheck delta failed: ${error.message}\n`);
    return 2;
  }
}

// Run the CLI only when Node executes this file directly. Tests require the same
// file as a library so fake compiler results can exercise the real implementation.
if (require.main === module) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

module.exports = {
  SCHEMA_VERSION,
  buildReport,
  createOrReadBaseline,
  describeCompilerDrift,
  describeConfigDrift,
  main,
  normalizeDiagnosticLine,
  normalizeDiagnostics,
  parseArguments,
  runTypecheckDelta,
  subtractDiagnostics,
};
