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
// `indent` is the JSON.stringify indent this fixture is WRITTEN with, so a test
// can prove the command hands the file's own formatting back (WF-G117).
const mkMap = (indent = 2) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmadd-'));
  const file = path.join(dir, 'topics.json');
  fs.writeFileSync(file, JSON.stringify({
    campaigns: { tooling: { label: 'Tooling', color: 'teal' } },
    topics: [{
      id: 'existing-topic', title: 'Existing', campaign: 'tooling', status: 'parked',
      features: [{ title: 'Old step', status: 'parked' }],
    }],
  }, null, indent) + '\n');
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

// WF-G117: an unrelated broken topic used to refuse EVERY other agent's write,
// which pushed workers onto --no-validate. The validator still reads the whole
// map; only a problem naming the touched topic may block the write.
test('drift in another topic warns but does not block the caller write', () => {
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

  const payload = run(file, ['--topic', 'existing-topic', '--feature', 'Retry step'], { validate: true });
  assert.equal(payload.code, 0);
  // The unrelated problem is reported, attributed elsewhere, and stepped over.
  assert.match(payload.output, /warning \(elsewhere in the map, not "existing-topic"\)/);
  assert.match(payload.output, /bad-topic/);

  const after = readMap(file);
  assert.equal(after.topics[0].features.at(-1).title, 'Retry step');
  // The broken topic is left exactly as found — this command does not repair it.
  assert.deepEqual(after.topics[1], baseline.topics[1]);
});

// The other half of the scoping rule: a problem that DOES name the touched topic
// still refuses the write, and says the problem was inherited rather than caused.
test('drift in the touched topic still blocks the write', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmadd-scoped-'));
  const file = path.join(dir, 'topics.json');
  const baseline = {
    campaigns: { tooling: { label: 'Tooling', color: 'teal' } },
    topics: [
      // A broken link is a problem this command cannot accidentally fix, so it
      // survives the mutation and must be attributed to "existing-topic".
      { id: 'existing-topic', title: 'Existing', campaign: 'tooling', status: 'parked', link: 'docs/does-not-exist-wfg117.md' },
    ],
  };
  fs.writeFileSync(file, JSON.stringify(baseline, null, 2) + '\n');

  const payload = run(file, ['--topic', 'existing-topic', '--set-status', 'active'], { validate: true });
  assert.equal(payload.code, 1);
  assert.match(payload.output, /problem\(s\) naming "existing-topic"/);
  assert.match(payload.output, /\(pre-existing\)/);
  assert.match(payload.output, /caller-scoped validation failed/);
  assert.deepEqual(readMap(file), baseline);
  assert.equal(fs.existsSync(`${file}.tmp`), false);
});

// The gap's own proof (WF-G117): the file's indentation is the format of record.
// A hardcoded two-space write turned this one-field flip into a whole-file diff.
test('a status flip on a one-space map is a one-line diff', () => {
  const file = mkMap(1);
  // Pre-stamp today's date so the freshness stamp is not itself a second
  // changed line — the assertion is about formatting, not about `updated`.
  const seeded = readMap(file);
  seeded.topics[0].updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(file, JSON.stringify(seeded, null, 1) + '\n');

  const before = fs.readFileSync(file, 'utf8').split('\n');
  run(file, ['--topic', 'existing-topic', '--set-status', 'active']);
  const after = fs.readFileSync(file, 'utf8').split('\n');

  assert.equal(before.length, after.length);
  const changed = before.map((line, n) => [line, after[n]]).filter(([a, b]) => a !== b);
  assert.equal(changed.length, 1);
  assert.match(changed[0][1], /"status": "active"/);
});

// Feature capture writes through the same detector, so an appended feature adds
// lines without reformatting the ones around it.
test('adding a feature to a one-space map keeps the one-space indent', () => {
  const file = mkMap(1);
  run(file, ['--topic', 'existing-topic', '--feature', 'New step']);
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^ "campaigns": \{$/m);
  assert.equal(/^ {2}"campaigns"/m.test(text), false);
});

// ============================================================================
// Annotation Flags (--status-note / --verified)
// ============================================================================
// Both use the same --feature-match selector as --set-status and may be used
// WITHOUT a status flip, so an audit can record what it checked and when.
// ============================================================================

// A verification date on a feature needs no status change to be recorded.
test('--verified stamps a matched feature without touching its status', () => {
  const file = mkMap();
  const payload = run(file, ['--topic', 'existing-topic', '--feature-match', 'old step', '--verified', '2026-09-09']);
  assert.equal(payload.code, 0);
  const t = readMap(file).topics[0];
  assert.equal(t.features[0].verified, '2026-09-09');
  assert.equal(t.features[0].status, 'parked');
  assert.match(t.updated, DATE);
  assert.match(payload.output, /verified 2026-09-09/);
});

// The same flags address the topic itself when no --feature-match is given, and
// an empty note is the CLI's only way to retract one.
test('--status-note sets and clears a topic note', () => {
  const file = mkMap();
  run(file, ['--topic', 'existing-topic', '--status-note', 'checked against src/ on the day']);
  assert.equal(readMap(file).topics[0].status_note, 'checked against src/ on the day');
  run(file, ['--topic', 'existing-topic', '--status-note', '']);
  assert.equal('status_note' in readMap(file).topics[0], false);
});

// A status flip and an annotation are one edit, not two passes over the file.
test('--set-status and --verified apply together to one feature', () => {
  const file = mkMap();
  run(file, ['--topic', 'existing-topic', '--feature-match', 'old step', '--set-status', 'done', '--verified', '2026-09-09']);
  const f = readMap(file).topics[0].features[0];
  assert.equal(f.status, 'done');
  assert.equal(f.verified, '2026-09-09');
});

// New captures carry the annotations too, so an audit-driven addition does not
// need a second command.
test('new topic and new feature accept the annotation flags', () => {
  const file = mkMap();
  run(file, ['--new-topic', 'annotated', '--title', 'Annotated', '--campaign', 'tooling', '--verified', '2026-09-09', '--status-note', 'seeded by an audit']);
  const topic = readMap(file).topics.find((t) => t.id === 'annotated');
  assert.equal(topic.verified, '2026-09-09');
  assert.equal(topic.status_note, 'seeded by an audit');

  run(file, ['--topic', 'existing-topic', '--feature', 'Audited step', '--verified', '2026-09-09']);
  assert.equal(readMap(file).topics[0].features.at(-1).verified, '2026-09-09');
});

// A free-form date would pass this command and then fail the schema pattern
// downstream, so reject it at the door.
test('--verified rejects a value that is not YYYY-MM-DD', () => {
  const file = mkMap();
  const payload = run(file, ['--topic', 'existing-topic', '--verified', 'yesterday']);
  assert.equal(payload.code, 1);
  assert.match(payload.output, /--verified must be YYYY-MM-DD/);
  assert.equal('verified' in readMap(file).topics[0], false);
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
