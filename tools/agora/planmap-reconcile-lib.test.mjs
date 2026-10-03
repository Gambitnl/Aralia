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

test('WF-G150: a feature named as the primary of a campaign that is not done stays active', () => {
  const data = mkData();
  // The measured case: one done task (the approval step) was the only evidence.
  const tasks = [{ state: 'done', refs: ['planmap:forests/named-forests'] }];
  const campaigns = [{ id: 'agora-8148', state: 'active', charter: { body: { planMapPrimary: 'planmap:forests/named-forests' } } }];
  const { held } = reconcileBoardToPlanmap(data, tasks, { campaigns });
  assert.equal(data.topics[0].features[0].status, 'active');
  assert.deepEqual(held, ['forests/named-forests: primary of campaign agora-8148, which is not done']);

  // Once the campaign is done, the same evidence may finish the feature.
  const later = mkData();
  reconcileBoardToPlanmap(later, tasks, { campaigns: [{ ...campaigns[0], state: 'done' }] });
  assert.equal(later.topics[0].features[0].status, 'done');
});

test('WF-G150: a task closed by triage is no evidence that the work exists', () => {
  const data = mkData();
  const { evidence } = reconcileBoardToPlanmap(data, [
    { state: 'done', closedReason: 'obsolete: removed', refs: ['planmap:forests/named-forests'] },
  ]);
  assert.equal(evidence, 0);
  assert.equal(data.topics[0].features[0].status, 'specced');
});

test('idempotent: second run yields zero changes', () => {
  const data = mkData();
  const tasks = [{ state: 'done', refs: ['planmap:forests/named-forests'] }];
  reconcileBoardToPlanmap(data, tasks);
  const second = reconcileBoardToPlanmap(data, tasks);
  assert.equal(second.changes.length, 0);
});
