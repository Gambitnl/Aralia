import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';

/**
 * This file proves the TypeScript snapshot/delta tool without running Aralia's real compiler.
 *
 * Each test builds an isolated temporary project and injects deterministic compiler output.
 * This covers baseline capture, focused delta reporting, identity warnings, and simultaneous
 * writers without depending on unrelated errors in the shared checkout.
 *
 * Calls: the exported API from typecheck-delta.cjs
 * Depends on: Node's built-in test runner and temporary directories outside the repository
 */

const require = createRequire(import.meta.url);
const { runTypecheckDelta, SCHEMA_VERSION } = require('./typecheck-delta.cjs');

// ============================================================================
// Isolated Project and Fake Compiler Helpers
// ============================================================================
// Every test receives its own project root, config, compiler placeholder, and
// baseline path. Cleanup runs even when an assertion fails.
// ============================================================================

// Create only the files whose identity the production tool records. The compiler
// placeholder is never executed because each test injects a fake runner.
async function createFixture(t) {
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'aralia-typecheck-delta-'));
  const configPath = path.join(cwd, 'tsconfig.json');
  const compilerPath = path.join(cwd, 'node_modules', 'typescript', 'lib', 'tsc.js');
  const baselinePath = path.join(cwd, '.agent', 'typecheck-baselines', 'test-baseline.json');

  await fs.promises.mkdir(path.dirname(compilerPath), { recursive: true });
  await fs.promises.writeFile(configPath, '{"compilerOptions":{"noEmit":true}}\n', 'utf8');
  await fs.promises.writeFile(compilerPath, '// deterministic compiler placeholder\n', 'utf8');

  t.after(async () => {
    await fs.promises.rm(cwd, { recursive: true, force: true });
  });

  return { baselinePath, compilerPath, configPath, cwd };
}

// Return a spawn-like result with exactly the requested TypeScript diagnostics.
// Status 2 mirrors tsc's normal error exit and proves the tool accepts known debt.
function fakeRunner(...diagnostics) {
  return () => ({
    status: diagnostics.length > 0 ? 2 : 0,
    signal: null,
    stdout: diagnostics.join('\n'),
    stderr: '',
  });
}

// Run the public library API with stable time and injected compiler identity.
// Individual tests override only the behavior relevant to their contract.
async function runFixture(fixture, overrides = {}) {
  return runTypecheckDelta({
    ...fixture,
    compilerVersion: '5.9.3-test',
    now: () => new Date('2026-08-12T00:00:00.000Z'),
    runner: fakeRunner(),
    retryIntervalMs: 2,
    ...overrides,
  });
}

// ============================================================================
// First Capture
// ============================================================================
// A first run stores normalized, sorted diagnostics and succeeds even though the
// fake compiler reports the broad errors captured in that new baseline.
// ============================================================================
test('creates the first baseline with reproducible metadata and no delta failure', async (t) => {
  const fixture = await createFixture(t);
  const absoluteFile = path.join(fixture.cwd, 'src', 'zeta.ts');

  const result = await runFixture(fixture, {
    runner: fakeRunner(
      `${absoluteFile}(2,3): error TS2000: later path`,
      'src/alpha.ts(1,1): error TS1000: earlier path',
      'Found 2 errors.',
    ),
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.baselineCreated, true);
  assert.deepEqual(result.newDiagnostics, []);

  const baseline = JSON.parse(await fs.promises.readFile(fixture.baselinePath, 'utf8'));
  assert.equal(baseline.schemaVersion, SCHEMA_VERSION);
  assert.equal(baseline.capturedAt, '2026-08-12T00:00:00.000Z');
  assert.equal(baseline.config.path, 'tsconfig.json');
  assert.equal(baseline.compiler.path, 'node_modules/typescript/lib/tsc.js');
  assert.deepEqual(baseline.diagnostics, [
    'src/alpha.ts(1,1): error TS1000: earlier path',
    'src/zeta.ts(2,3): error TS2000: later path',
  ]);
});

// ============================================================================
// Added-Only Reporting
// ============================================================================
// A reused baseline prints the new normalized diagnostic but never repeats the
// existing baseline diagnostic in the human-facing report.
// ============================================================================
test('prints only newly present diagnostics and exits one', async (t) => {
  const fixture = await createFixture(t);
  const existing = 'src/existing.ts(1,1): error TS1001: baseline debt';
  const added = 'src/added.ts(4,2): error TS2002: slice regression';

  await runFixture(fixture, { runner: fakeRunner(existing) });
  const result = await runFixture(fixture, { runner: fakeRunner(existing, added) });
  const report = result.lines.join('\n');

  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.newDiagnostics, [added]);
  assert.match(report, /New diagnostics:\nsrc\/added\.ts/);
  assert.doesNotMatch(report, /baseline debt/);
});

// ============================================================================
// Disappeared Diagnostic Summary
// ============================================================================
// Removed baseline entries affect only the compact count. Their full text stays out
// of stdout so the only diagnostic lines after the summaries are newly present ones.
// ============================================================================
test('summarizes disappeared diagnostics without printing their lines', async (t) => {
  const fixture = await createFixture(t);
  const disappeared = 'src/gone.ts(3,1): error TS3003: baseline-only debt';
  const remaining = 'src/still.ts(5,1): error TS5005: remaining debt';

  await runFixture(fixture, { runner: fakeRunner(disappeared, remaining) });
  const result = await runFixture(fixture, { runner: fakeRunner(remaining) });
  const report = result.lines.join('\n');

  assert.equal(result.exitCode, 0);
  assert.equal(result.disappearedDiagnostics.length, 1);
  assert.match(report, /Disappeared baseline diagnostics: 1 \(lines omitted\)\./);
  assert.doesNotMatch(report, /baseline-only debt/);
  assert.doesNotMatch(report, /remaining debt/);
});

// ============================================================================
// Configuration and Compiler Identity Drift
// ============================================================================
// Hash, compiler path, version, and invocation changes are explained separately
// from the diagnostic delta so a zero-new result cannot hide unlike conditions.
// ============================================================================
test('reports config and compiler identity drift separately', async (t) => {
  const fixture = await createFixture(t);
  await runFixture(fixture, { compilerVersion: '5.8.0-test' });

  await fs.promises.writeFile(fixture.configPath, '{"compilerOptions":{"strict":true}}\n', 'utf8');
  const alternateCompilerPath = path.join(fixture.cwd, 'vendor', 'typescript', 'tsc.js');
  await fs.promises.mkdir(path.dirname(alternateCompilerPath), { recursive: true });
  await fs.promises.writeFile(alternateCompilerPath, '// alternate compiler placeholder\n', 'utf8');

  const result = await runFixture(fixture, {
    compilerPath: alternateCompilerPath,
    compilerVersion: '5.9.0-test',
  });
  const report = result.lines.join('\n');

  assert.match(report, /Config identity drift: SHA-256 changed\./);
  assert.match(report, /Compiler identity drift: path changed; version changed; invocation changed\./);
});

// ============================================================================
// Simultaneous Baseline Writers
// ============================================================================
// Two runs start against one absent path. Exactly one publishes the baseline; the
// other reads that complete JSON, and neither leaves a lock or temporary file behind.
// ============================================================================
test('simultaneous writers create one valid baseline without residue', async (t) => {
  const fixture = await createFixture(t);
  const diagnostic = 'src/shared.ts(7,2): error TS7007: shared capture';

  const [left, right] = await Promise.all([
    runFixture(fixture, { runner: fakeRunner(diagnostic) }),
    runFixture(fixture, { runner: fakeRunner(diagnostic) }),
  ]);

  assert.equal(Number(left.baselineCreated) + Number(right.baselineCreated), 1);
  assert.equal(left.exitCode, 0);
  assert.equal(right.exitCode, 0);

  const baseline = JSON.parse(await fs.promises.readFile(fixture.baselinePath, 'utf8'));
  assert.deepEqual(baseline.diagnostics, [diagnostic]);
  await assert.rejects(fs.promises.access(`${fixture.baselinePath}.lock`), { code: 'ENOENT' });

  const directoryEntries = await fs.promises.readdir(path.dirname(fixture.baselinePath));
  assert.deepEqual(directoryEntries, [path.basename(fixture.baselinePath)]);
});
