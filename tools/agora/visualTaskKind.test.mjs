// The shared classification is evidence routing, not visual proof or a parser
// that grants permissions. Damaged build metadata must still block promotion.
import test from 'node:test';
import assert from 'node:assert/strict';
import {isVisualBuildOnlyTask,canonicalVisualDeliveryRefs,visualBlockingDepTypes,visualDependencyTypes} from './visualTaskKind.mjs';
import {TASK_DEP_TYPES} from './store.mjs';

test('WF266: build markers and damaged handoffs are build-only evidence',()=>{
  for(const body of ['VISUAL-HANDOFF: {}','REFERENCE-ONLY: VISUAL-HANDOFF: broken',
    'VISUAL SPLIT [campaign/split] BUILD sha256=abc\nBuild only'])
    assert.equal(isVisualBuildOnlyTask({body}),true);
});

test('WF266: ordinary work, review tasks and quoted read context stay distinct',()=>{
  for(const body of [undefined,'Build a component','VISUAL-REVIEW: {}',
    'VISUAL SPLIT [campaign/split] REVIEW sha256=abc',
    'REFERENCE-ONLY: Original combined purpose: "VISUAL-HANDOFF: {}"'])
    assert.equal(isVisualBuildOnlyTask({body}),false);
});

test('WF266: archived workflow refs remain canonical without the active index',()=>{
  assert.deepEqual(canonicalVisualDeliveryRefs({refs:['workflow:WF-G247','WF-G247',
    'planmap:forests/named-forests','forest:G1','src/forest.ts']},[],[{id:'G1',project:'forest'}]),
    ['WF-G247','forest:G1','planmap:forests/named-forests','workflow:WF-G247']);
});

test('WF266: pure projection mirrors all current board blocking dependency types',()=>{
  assert.deepEqual([...visualDependencyTypes].sort(),Object.keys(TASK_DEP_TYPES).sort());
  assert.deepEqual([...visualBlockingDepTypes].sort(),Object.entries(TASK_DEP_TYPES)
    .filter(([,spec])=>spec.blocking).map(([type])=>type).sort());
});
