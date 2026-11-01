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

test('WF266: finished build-only work is active evidence, never feature delivery', () => {
  const data = mkData();
  const owner='11111111-1111-4111-8111-111111111111';
  const record={buildTask:'agora-build',followUpTask:'agora-review',reviewer:{agentId:owner},deliveryRefs:['planmap:forests/named-forests'],buildPrerequisites:[],tuningFiles:[]};
  const build = {id:'agora-build',campaignId:'demo',state:'done',refs:record.deliveryRefs,body:'REFERENCE-ONLY: VISUAL-HANDOFF: '+JSON.stringify(record)};
  reconcileBoardToPlanmap(data, [build]);
  assert.equal(data.topics[0].features[0].status, 'active');
  assert.equal(data.topics[0].status, 'active');
  const review = {id:'agora-review',campaignId:'demo',claimedBy:owner,state:'blocked',deps:[build.id],refs:build.refs,body:'VISUAL-REVIEW: '+JSON.stringify(record)};
  reconcileBoardToPlanmap(data, [build,review]);
  assert.equal(data.topics[0].features[0].status, 'active');
  review.state='done';
  reconcileBoardToPlanmap(data, [build,review]);
  assert.equal(data.topics[0].features[0].status, 'done');
});

test('WF266: contradictory reviewer delivery refs cannot independently promote another feature',()=>{
  const data=mkData();data.topics[0].features.push({title:'Other forests',status:'specced'});
  const owner='11111111-1111-4111-8111-111111111111',ref='planmap:forests/named-forests';
  const record={buildTask:'agora-build',followUpTask:'agora-review',reviewer:{agentId:owner},deliveryRefs:[ref],buildPrerequisites:[],tuningFiles:[]};
  const build={id:record.buildTask,campaignId:'demo',state:'done',refs:[ref],body:'VISUAL-HANDOFF: '+JSON.stringify(record)};
  const review={id:record.followUpTask,campaignId:'demo',state:'done',claimedBy:owner,deps:[build.id],refs:[ref,'planmap:forests/other-forests'],body:'VISUAL-REVIEW: '+JSON.stringify(record)};
  reconcileBoardToPlanmap(data,[build,review]);
  assert.equal(data.topics[0].features[0].status,'active');
  assert.equal(data.topics[0].features[1].status,'specced');
  review.refs=[ref];review.claimedBy='another-agent';
  reconcileBoardToPlanmap(data,[build,review]);
  assert.equal(data.topics[0].features[0].status,'active');
  review.claimedBy=owner;
  reconcileBoardToPlanmap(data,[build,review]);
  assert.equal(data.topics[0].features[0].status,'done');
});
