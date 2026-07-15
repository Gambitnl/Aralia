// tools/agora/planmap-reconcile-lib.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileBoardToPlanmap } from './planmap-reconcile-lib.mjs';

const mkData = () => ({
  topics: [{
    id: 'forests', title: 'Forests', campaign: 'world', status: 'specced',
    features: [{ title: 'Named forests', status: 'specced' }],
  }],
});

test('done task flips feature and derives topic active->done chain', () => {
  const data = mkData();
  const tasks = [{ state: 'done', refs: ['planmap:forests/named-forests'] }];
  const { changes } = reconcileBoardToPlanmap(data, tasks);
  assert.equal(data.topics[0].features[0].status, 'done');
  assert.equal(data.topics[0].status, 'done');
  assert.equal(changes.length, 2);
});

test('never downgrades; disconnected topics reported', () => {
  const data = mkData();
  data.topics[0].features[0].status = 'done';
  data.topics[0].status = 'done';
  const { changes, disconnected } = reconcileBoardToPlanmap(data, [
    { state: 'claimed', refs: ['planmap:forests/named-forests'] },
  ]);
  assert.equal(changes.length, 0);
  assert.equal(data.topics[0].status, 'done');
  assert.deepEqual(disconnected, []);
});

test('idempotent: second run yields zero changes', () => {
  const data = mkData();
  const tasks = [{ state: 'done', refs: ['planmap:forests/named-forests'] }];
  reconcileBoardToPlanmap(data, tasks);
  const second = reconcileBoardToPlanmap(data, tasks);
  assert.equal(second.changes.length, 0);
});
