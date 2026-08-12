// planmap-add.test.mjs — every mutation stamps the touched topic with a real
// date, and feature capture returns its copy-ready Plan Map task reference.
// Run: node --test tools/agora/planmap-add.test.mjs

// ============================================================================
// Test Dependencies
// ============================================================================
// Node's built-in runner launches the real CLI and uses disposable filesystem
// fixtures, so no project test framework or shared Plan Map is involved.
// ============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This file proves that the Plan Map capture command changes only the requested
 * fixture data, keeps writes atomic, stamps freshness dates, and prints a task
 * reference that the reconciliation flow can consume without another lookup.
 * It launches the real command against disposable maps, so its assertions cover
 * the same command-line output and file behavior used by Agora operators.
 *
 * Runs: node --test tools/agora/planmap-add.test.mjs
 * Exercises: planmap-add.mjs and its validation-safe mutation path
 */

// ============================================================================
// Disposable Plan Map Fixtures
// ============================================================================
// Every test gets a private temporary map. This prevents focused proof from
// reading or changing the shared public Plan Map in the working checkout.
// ============================================================================

const here = path.dirname(fileURLToPath(import.meta.url));
const tool = path.join(here, 'planmap-add.mjs');

// Build the smallest valid map that supports topic, feature, and status edits.
const mkMap = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmadd-'));
  const file = path.join(dir, 'topics.json');
  fs.writeFileSync(file, JSON.stringify({
    campaigns: { tooling: { label: 'Tooling', color: 'teal' } },
    topics: [{
      id: 'existing-topic', title: 'Existing', campaign: 'tooling', status: 'parked',
      features: [{ title: 'Old step', status: 'parked' }],
    }],
  }, null, 2) + '\n');
  return file;
};

// ============================================================================
// Command and Fixture Readers
// ============================================================================
// The runner captures both success and failure output so tests can assert the
// operator-facing contract without printing child-process noise.
// ============================================================================

// Launch the production command against a fixture. Validation is skipped by
// default unless a test is specifically proving the validator boundary.
const run = (file, extra, opts = {}) => {
  const args = ['--file', file, ...(opts.validate ? [] : ['--no-validate']), ...extra];
  try {
    const output = execFileSync(process.execPath, [tool, ...args], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, output };
  } catch (err) {
    return {
      code: err.status ?? 1,
      output: `${err.stdout ?? ''}${err.stderr ?? ''}`,
    };
  }
};

// Read back the map after a command and recognize its day-level freshness stamp.
const readMap = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================================
// Freshness and Reference Output
// ============================================================================
// These cases cover successful mutations and the exact feature reference that
// lets callers immediately create a linked Agora task.
// ============================================================================

// A newly captured topic must immediately participate in freshness reporting.
test('new topic gets an updated stamp', () => {
  const file = mkMap();
  run(file, ['--new-topic', 'freshness-probe', '--title', 'Probe', '--campaign', 'tooling']);
  const data = readMap(file);
  const t = data.topics.find((x) => x.id === 'freshness-probe');
  assert.match(t.updated, DATE);
});

// Adding work to an existing topic refreshes that topic's last-change date.
test('adding a feature stamps the touched topic', () => {
  const file = mkMap();
  run(file, ['--topic', 'existing-topic', '--feature', 'New step']);
  assert.match(readMap(file).topics[0].updated, DATE);
});

// A feature addition returns the exact ref accepted by reconciliation, including
// truncation and occurrence numbering for colliding stable identities.
test('adding a feature prints the exact canonical Plan Map reference', () => {
  // Both titles share the same first 40 slug characters. The reconciliation
  // consumer therefore names the newly added occurrence with its "-2" suffix.
  const file = mkMap();
  const map = readMap(file);
  map.topics[0].features = [{
    title: 'Plan Map reference whose identifying prefix is deliberately over forty characters one',
    status: 'parked',
  }];
  fs.writeFileSync(file, JSON.stringify(map, null, 2) + '\n');

  // Assert the complete standard output so explanatory text cannot accidentally
  // swallow or alter the copy-ready reference line.
  const featureTitle = 'Plan Map reference whose identifying prefix is deliberately over forty characters two';
  const payload = run(file, ['--topic', 'existing-topic', '--feature', featureTitle]);
  assert.equal(payload.code, 0);
  assert.equal(
    payload.output,
    `added feature "${featureTitle}" to "existing-topic" (parked)\n` +
      'planmap:existing-topic/plan-map-reference-whose-identifying-pre-2\n',
  );
});

// A status transition also counts as a real Plan Map change for freshness.
test('set-status stamps the touched topic', () => {
  const file = mkMap();
  run(file, ['--topic', 'existing-topic', '--set-status', 'active']);
  const t = readMap(file).topics[0];
  assert.equal(t.status, 'active');
  assert.match(t.updated, DATE);
});

// A successful capture must not leave its staging file behind for later runs.
test('write is atomic: no .tmp file left behind', () => {
  const file = mkMap();
  run(file, ['--topic', 'existing-topic', '--set-status', 'active']);
  assert.equal(fs.existsSync(`${file}.tmp`), false);
});

// ============================================================================
// Validation Safety and Mutation Scope
// ============================================================================
// These cases prove a bad baseline is never rewritten and a successful command
// leaves every topic outside the caller's selection equivalent to its input.
// ============================================================================

// An invalid starting map stays data-equivalent across repeated calls,
// so an operator can repair the unrelated drift without removing duplicates.
test('validation failure from pre-existing drift does not write or duplicate on retry', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmadd-drift-'));
  const file = path.join(dir, 'topics.json');
  const baseline = {
    campaigns: { tooling: { label: 'Tooling', color: 'teal' } },
    topics: [
      { id: 'existing-topic', title: 'Existing', campaign: 'tooling', status: 'parked' },
      { id: 'bad-topic', title: 'Broken', campaign: 'tooling', status: 'not-a-status' },
    ],
  };
  fs.writeFileSync(file, JSON.stringify(baseline, null, 2) + '\n');

  const first = run(file, ['--topic', 'existing-topic', '--feature', 'Retry step'], { validate: true });
  const afterFirst = readMap(file);
  const second = run(file, ['--topic', 'existing-topic', '--feature', 'Retry step'], { validate: true });
  const afterSecond = readMap(file);

  assert.equal(first.code, 1);
  assert.equal(second.code, 1);
  assert.match(first.output, /pre-existing plan-map validation errors detected/i);
  assert.deepEqual(afterFirst, baseline);
  assert.deepEqual(afterSecond, baseline);
});

// A validated success may refresh and extend only the explicitly named topic.
test('successful update only mutates the caller-chosen topic', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmadd-target-'));
  const file = path.join(dir, 'topics.json');
  const before = {
    campaigns: { tooling: { label: 'Tooling', color: 'teal' } },
    topics: [
      {
        id: 'existing-topic',
        title: 'Existing',
        campaign: 'tooling',
        status: 'parked',
        features: [{ title: 'Old step', status: 'parked' }],
      },
      {
        id: 'other-topic',
        title: 'Other',
        campaign: 'tooling',
        status: 'active',
        updated: '2026-01-01',
        features: [{ title: 'Other step', status: 'active' }],
      },
    ],
  };
  fs.writeFileSync(file, JSON.stringify(before, null, 2) + '\n');

  const payload = run(file, ['--topic', 'existing-topic', '--feature', 'New step'], { validate: true });
  assert.equal(payload.code, 0);

  const after = readMap(file);
  const beforeTarget = before.topics.find((topic) => topic.id === 'existing-topic');
  const afterTarget = after.topics.find((topic) => topic.id === 'existing-topic');
  const beforeOther = before.topics.find((topic) => topic.id === 'other-topic');
  const afterOther = after.topics.find((topic) => topic.id === 'other-topic');

  assert.equal(beforeTarget.updated, undefined);
  assert.match(afterTarget.updated, DATE);
  assert.equal(beforeTarget.features.length + 1, afterTarget.features.length);
  assert.equal(afterTarget.features.at(-1).title, 'New step');
  assert.deepEqual(afterOther, beforeOther);
});
