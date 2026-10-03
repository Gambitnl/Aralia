/**
 * This file verifies how Plan Map features become Agora wave packets.
 *
 * Each test writes a private Plan Map fixture and output file under the system
 * temporary directory. That keeps the shared, frequently dirty Plan Map out of
 * the test path while exercising the real command-line converter end to end.
 *
 * Called by: `node --test tools/agora/planmap-to-wave.test.mjs`.
 * Depends on: planmap-to-wave.mjs and Node's built-in test runner.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// Isolated Command Harness
// ============================================================================
// The harness supplies `--file` and `--out` paths for every invocation, so a
// failed or successful test cannot read or overwrite repository Plan Map data.
// ============================================================================

const here = path.dirname(fileURLToPath(import.meta.url));
const tool = path.join(here, 'planmap-to-wave.mjs');

const makeHarness = (t, features) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planmap-to-wave-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const input = path.join(dir, 'topics.json');
  const output = path.join(dir, 'wave.json');
  fs.writeFileSync(input, JSON.stringify({
    topics: [{
      id: 'fixture-topic',
      title: 'Fixture Topic',
      sub: 'Focused converter fixture',
      link: 'docs/fixture.md',
      status: 'active',
      features,
    }],
  }, null, 2));

  return { input, output };
};

const run = ({ input, output }) => execFileSync(process.execPath, [
  tool,
  'fixture-topic',
  '--file',
  input,
  '--out',
  output,
], { encoding: 'utf8' });

const readPlan = ({ output }) => JSON.parse(fs.readFileSync(output, 'utf8'));

const runFailure = (harness) => {
  try {
    run(harness);
  } catch (error) {
    assert.equal(fs.existsSync(harness.output), false);
    return {
      status: error.status,
      output: `${error.stdout ?? ''}${error.stderr ?? ''}`,
    };
  }
  assert.fail('expected planmap-to-wave to reject the fixture');
};

// ============================================================================
// Parallel Defaults and Explicit Dependencies
// ============================================================================
// Packet order and identity still follow the filtered feature list. Scheduling
// edges appear only when a feature explicitly names stable predecessor slugs.
// ============================================================================

test('features without explicit predecessors produce parallel packets by default', (t) => {
  const harness = makeHarness(t, [
    { title: 'Draft Contract', status: 'active', parallel: false },
    { title: 'Build Adapter', status: 'specced', parallel: true },
    { title: 'Verify Rollout', status: 'parked' },
  ]);

  run(harness);
  const plan = readPlan(harness);

  assert.deepEqual(plan.packets.map((packet) => ({
    id: packet.id,
    handle: packet.handle,
    after: packet.after,
    refs: packet.refs,
  })), [
    { id: 'PK-1', handle: 'draft-contract', after: [], refs: ['planmap:fixture-topic/draft-contract'] },
    { id: 'PK-2', handle: 'build-adapter', after: [], refs: ['planmap:fixture-topic/build-adapter'] },
    { id: 'PK-3', handle: 'verify-rollout', after: [], refs: ['planmap:fixture-topic/verify-rollout'] },
  ]);
  assert.equal(plan.packets[0].agent, 'claude');
  assert.equal(plan.pet, 'gf-sd');
  assert.deepEqual(plan.packets.map((packet) => packet.pet), ['dream-girl', 'nous-girl', 'cyberman']);
  assert.deepEqual(plan.packets[0].files, ['TODO: list the packet-owned files (disjoint across packets)']);
});

test('explicit predecessor slugs resolve to packet IDs after done features are filtered', (t) => {
  const harness = makeHarness(t, [
    { title: 'Draft Contract', status: 'active' },
    { title: 'Retired Bridge', status: 'done' },
    { title: 'Build Adapter', status: 'active', after: ['draft-contract'] },
    { title: 'Verify Rollout', status: 'active', after: ['draft-contract', 'build-adapter'] },
  ]);

  run(harness);
  const packets = readPlan(harness).packets;

  assert.deepEqual(packets.map((packet) => packet.id), ['PK-1', 'PK-2', 'PK-3']);
  assert.deepEqual(packets.map((packet) => packet.after), [[], ['PK-1'], ['PK-1', 'PK-2']]);
});

// ============================================================================
// Invalid Dependency Declarations
// ============================================================================
// Bad edges fail before a skeleton is written. Messages distinguish malformed
// declarations, unknown slugs, and real features skipped because they are done.
// ============================================================================

test('rejects a non-array after declaration', (t) => {
  const failure = runFailure(makeHarness(t, [
    { title: 'Draft Contract', status: 'active' },
    { title: 'Build Adapter', status: 'active', after: 'draft-contract' },
  ]));

  assert.notEqual(failure.status, 0);
  assert.match(failure.output, /feature "build-adapter" has invalid after declaration/);
  assert.match(failure.output, /expected an array of stable feature slugs/);
});

test('rejects an unknown predecessor slug', (t) => {
  const failure = runFailure(makeHarness(t, [
    { title: 'Build Adapter', status: 'active', after: ['missing-contract'] },
  ]));

  assert.notEqual(failure.status, 0);
  assert.match(failure.output, /unknown predecessor "missing-contract"/);
});

test('rejects a predecessor that was skipped because it is done', (t) => {
  const failure = runFailure(makeHarness(t, [
    { title: 'Retired Bridge', status: 'done' },
    { title: 'Build Adapter', status: 'active', after: ['retired-bridge'] },
  ]));

  assert.notEqual(failure.status, 0);
  assert.match(failure.output, /predecessor "retired-bridge" is skipped because its status is "done"/);
});
