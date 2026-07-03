// tools/agora/resolution.test.mjs
// Tests for the WF-G1..G14 resolution batch: git shim, updateGapRow (--apply),
// CLOSED_STATUSES/unrecognized bucket, registry-driven probe/launch, seed-time
// ref validation, and validatePlan constraint warnings.
//   node --test "tools/agora/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { updateGapRow, CLOSED_STATUSES } from './gapIndex.mjs';
import { reconcileGaps, launchSpec, probeAgent, validatePlan, loadRegistry } from './orchestrate.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SHIM = path.join(DIR, 'git-shim', 'git-shim.mjs');

function tmpFile(content) {
  const d = path.join(os.tmpdir(), 'agora-res-test', crypto.randomUUID());
  fs.mkdirSync(d, { recursive: true });
  const f = path.join(d, 'GAPS.md');
  fs.writeFileSync(f, content);
  return f;
}

// --- WF-G1: git shim ---------------------------------------------------------

test('git shim: blocks destructive git (exit 2 + reason), passes safe git through', () => {
  // Destructive → exit 2 with the guard's reason on stderr.
  let denied = false;
  try {
    execFileSync(process.execPath, [SHIM, 'reset', '--hard'], { encoding: 'utf8' });
  } catch (e) {
    denied = true;
    assert.equal(e.status, 2);
    assert.match(String(e.stderr), /shared-checkout git guard/);
  }
  assert.ok(denied, 'reset --hard denied');

  // Safe → delegates to the real git (we are inside a repo; exit 0).
  const out = execFileSync(process.execPath, [SHIM, '--version'], { encoding: 'utf8' });
  assert.match(out, /git version/);
});

// --- WF-G3: updateGapRow -----------------------------------------------------

const GAPS_FIXTURE = `| Gap ID | Status | Severity | Gap | Evidence | Next action |
|---|---|---|---|---|---|
| G1 | open | high | thing broken | src/x.ts:10 | fix it |
| G2 | resolved | low | old thing | done long ago | — |
`;

test('updateGapRow: rewrites status + appends evidence for the matching row only', () => {
  const f = tmpFile(GAPS_FIXTURE);
  const ok = updateGapRow(f, 'G1', { status: 'resolved', appendEvidence: 'board task done: 5 tests green' });
  assert.equal(ok, true);
  const after = fs.readFileSync(f, 'utf8');
  assert.match(after, /\| G1 \| resolved \| high \| thing broken \| src\/x\.ts:10; board task done: 5 tests green \|/);
  assert.match(after, /\| G2 \| resolved \| low \|/); // untouched
  assert.equal(updateGapRow(f, 'G99', { status: 'resolved' }), false); // absent id → false, file intact
  fs.rmSync(path.dirname(f), { recursive: true, force: true });
});

// --- WF-G13: status taxonomy -------------------------------------------------

test('reconcileGaps: routed/unknown statuses land in their own buckets', () => {
  const task = { id: 't1', state: 'done', title: 'x', refs: ['spells:G1', 'spells:G2', 'spells:G3'], result: 'r' };
  const gaps = [
    { id: 'G1', project: 'spells', status: 'routed', file: 'f' },        // CLOSED (moved)
    { id: 'G2', project: 'spells', status: 'in_scope_now', file: 'f' },  // unrecognized
    { id: 'G3', project: 'spells', status: 'open', file: 'f' },          // stale-open
  ];
  const rec = reconcileGaps([task], gaps);
  assert.equal(rec.alreadyClosed.length, 1);
  assert.equal(rec.unrecognizedStatus.length, 1);
  assert.equal(rec.unrecognizedStatus[0].gap.status, 'in_scope_now');
  assert.equal(rec.staleOpen.length, 1);
  assert.ok(CLOSED_STATUSES.has('routed'));
});

// --- WF-G5/G2: registry-driven dispatch -------------------------------------

test('launchSpec + probeAgent are registry-driven; kilo is wired', () => {
  const reg = loadRegistry();
  const kilo = launchSpec('kilo', 'PROMPT', reg);
  assert.equal(kilo.cmd, 'kilo');
  assert.deepEqual(kilo.args, ['run', '-m', 'kilo/kilo-auto/free', 'PROMPT']);
  const codex = launchSpec('codex', 'P', reg);
  assert.equal(codex.cmd, 'codex');
  assert.throws(() => launchSpec('cursor', 'P', reg), /no launch spec/);

  // probeAgent honors quotaProbe from an injected registry (stubbed command).
  const stub = {
    agents: {
      okbot: { quotaProbe: { command: process.execPath, args: ['-e', 'console.log("fine")'] } },
      drybot: { quotaProbe: { command: process.execPath, args: ['-e', 'console.log("usage limit reached")'], dryPattern: 'usage limit', dryReason: 'dry' } },
      nobot: {},
    },
  };
  assert.equal(probeAgent('okbot', stub).ok, true);
  const dry = probeAgent('drybot', stub);
  assert.equal(dry.ok, false);
  assert.equal(dry.reason, 'dry');
  assert.match(probeAgent('nobot', stub).reason, /no quotaProbe/);
});

test('validatePlan accepts kilo as a worker now (wired + ready)', () => {
  const plan = { wave: 'w', packets: [{ id: 'PK-1', handle: 'h', agent: 'kilo', scope: 's', files: ['src/x.ts'] }] };
  assert.equal(validatePlan(plan), true);
});

// --- WF-G14: stale-constraint warnings ---------------------------------------

test('validatePlan warns (via onWarn) when a packet agent has expired constraints', () => {
  const registry = {
    agents: {
      oldbot: {
        roles: ['worker'], status: 'ready',
        dispatch: { type: 'cli', command: 'oldbot' },
        constraints: [{ note: 'quota window', expiresAt: '2020-01-01' }],
      },
    },
  };
  const warnings = [];
  const plan = { wave: 'w', packets: [{ id: 'PK-1', handle: 'h', agent: 'oldbot', scope: 's', files: ['a'] }] };
  assert.equal(validatePlan(plan, { registry, onWarn: (m) => warnings.push(m) }), true);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /EXPIRED constraint \(2020-01-01\)/);
});
