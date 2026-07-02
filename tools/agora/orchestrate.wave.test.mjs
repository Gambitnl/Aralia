// Tests for wave lifecycle helpers: waveStatus (completion detection),
// buildWaveReport (campaign retrospective), reconcileGaps (board→tracker
// close-loop: done tasks whose referenced gaps are still open).
//   node --test "tools/agora/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { waveStatus, buildWaveReport, reconcileGaps } from './orchestrate.mjs';

const seeded = { 'PK-a': 't1', 'PK-b': 't2' };

function task(id, state, extra = {}) {
  return {
    id, state,
    title: `${id}-title`, claimedBy: null, deps: [], refs: [], result: null,
    createdAt: 1000, updatedAt: 2000,
    history: [{ at: 1000, by: 'orch', action: 'created', state: 'open' }],
    ...extra,
  };
}

test('waveStatus: pending until every seeded task is done/blocked', () => {
  let s = waveStatus(seeded, [task('t1', 'done'), task('t2', 'in_progress')]);
  assert.equal(s.complete, false);
  assert.deepEqual(s.pending.map((p) => p.packetId), ['PK-b']);

  s = waveStatus(seeded, [task('t1', 'done'), task('t2', 'blocked')]);
  assert.equal(s.complete, true);
  assert.deepEqual(s.done.map((p) => p.packetId), ['PK-a']);
  assert.deepEqual(s.blocked.map((p) => p.packetId), ['PK-b']);

  // A seeded task missing from the board (shouldn't happen) counts as pending, honestly.
  s = waveStatus(seeded, [task('t1', 'done')]);
  assert.equal(s.complete, false);
});

test('buildWaveReport: per-packet timings, claimants, reap counts, and results', () => {
  const tasks = [
    task('t1', 'done', {
      claimedBy: 'agent-A', result: '3 files; tests green', updatedAt: 61000,
      history: [
        { at: 1000, by: 'orch', action: 'created', state: 'open' },
        { at: 2000, by: 'agent-A', action: 'claimed', state: 'claimed' },
        { at: 61000, by: 'agent-A', action: 'state', state: 'done', result: '3 files; tests green' },
      ],
    }),
    task('t2', 'done', {
      claimedBy: 'agent-B', updatedAt: 30000,
      history: [
        { at: 1000, by: 'orch', action: 'created', state: 'open' },
        { at: 2000, by: 'agent-X', action: 'claimed', state: 'claimed' },
        { at: 9000, by: 'agent-X', action: 'reaped', state: 'open' },
        { at: 10000, by: 'agent-B', action: 'claimed', state: 'claimed' },
        { at: 30000, by: 'agent-B', action: 'state', state: 'done' },
      ],
    }),
  ];
  const rep = buildWaveReport(seeded, tasks);
  const a = rep.packets.find((p) => p.packetId === 'PK-a');
  const b = rep.packets.find((p) => p.packetId === 'PK-b');
  assert.equal(a.state, 'done');
  assert.equal(a.msToDone, 60000); // created 1000 -> done 61000
  assert.equal(a.reaps, 0);
  assert.equal(a.result, '3 files; tests green');
  assert.equal(b.reaps, 1); // agent-X died; agent-B finished it
  assert.equal(rep.totals.done, 2);
  assert.equal(rep.totals.reaps, 1);
});

test('reconcileGaps: flags done tasks whose referenced gap is still open', () => {
  const doneTasks = [
    task('t1', 'done', { refs: ['spells:G7'], result: 'fixed upcast; 5 tests' }),
    task('t2', 'done', { refs: ['spells:G9'], result: 'already closed in tracker' }),
    task('t3', 'done', { refs: ['mystery:G1'], result: 'ref matches nothing' }),
  ];
  const allGaps = [
    { id: 'G7', project: 'spells', status: 'open', gap: 'upcast broken', file: 'docs/projects/spells/GAPS.md' },
    { id: 'G9', project: 'spells', status: 'resolved', gap: 'old thing', file: 'docs/projects/spells/GAPS.md' },
  ];
  const rec = reconcileGaps(doneTasks, allGaps);
  assert.equal(rec.staleOpen.length, 1);
  assert.equal(rec.staleOpen[0].gap.id, 'G7');
  assert.equal(rec.staleOpen[0].task.result, 'fixed upcast; 5 tests');
  assert.deepEqual(rec.alreadyClosed.map((x) => x.gap.id), ['G9']);
  assert.deepEqual(rec.unmatchedRefs, ['mystery:G1']);
});
