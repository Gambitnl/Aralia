// WF-G285: durable completion overlap is a warning, never a measurement or edit.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taskReferenceFreshness, normalizeTaskFileRef, formatReferenceFreshness} from './taskFreshness.mjs';
const root = 'F:/Repos/Aralia';
const target = (patch = {}) => ({id:'target', title:'Sweep remaining spells', state:'open', createdAt:10, updatedAt:10, refs:['src/spells.ts'], body:'There are 23 affected spells.', history:[], ...patch});
const source = (patch = {}) => ({id:'source', title:'Add missing handlers', state:'done', createdAt:1, updatedAt:20, campaignId:'another-campaign', refs:['src/spells.ts'], history:[{at:20, action:'state', state:'done'}], ...patch});
const view = (rows, options = {}) => taskReferenceFreshness(rows, {repoRoot:root, ...options}).get('target');

test('WF-G285 flags cross-campaign overlap without changing counts, readiness or raw records', () => {
  const rows = [target({ready:true, deps:[], claimedBy:null}), source()], before = JSON.stringify(rows);
  const result = view(rows); assert.equal(result.status, 'unverified');
  assert.deepEqual(result.completions, [{taskId:'source', title:'Add missing handlers', at:20, historyIndex:0, sharedRefs:['src/spells.ts']}]);
  assert.match(formatReferenceFreshness(result).join('\n'), /COUNTS UNVERIFIED.*source/);
  assert.equal(JSON.stringify(rows), before); assert.equal(rows[0].ready, true);
});
test('WF-G285 normalizes exact file refs, not basenames, directories, topics or foreign roots', () => {
  assert.equal(normalizeTaskFileRef('F:\\Repos\\Aralia\\src\\spells.ts:12#label', root), 'src/spells.ts');
  assert.equal(normalizeTaskFileRef('./SRC/spells.ts#name', root), 'src/spells.ts');
  for (const ref of ['planmap:spells', 'src/', 'src/*.ts', '../src/spells.ts', 'https://example.test/src/spells.ts', 'F:/Other/src/spells.ts']) assert.equal(normalizeTaskFileRef(ref, root), null, ref);
  assert.equal(view([target(), source({refs:['other/spells.ts']})]).status, 'not_flagged');
  assert.equal(view([target({refs:['src/spells.ts:45']}), source({refs:['F:/Repos/Aralia/src/spells.ts#handler']})]).status, 'unverified');
  assert.equal(view([target(),source({refs:['src/spells.ts:12-25']})]).status,'unverified');
});
test('WF-G285 completion survives reopening and later completion is a distinct receipt', () => {
  const s = source({state:'open', updatedAt:40, history:[{at:20,action:'state',state:'done'},{at:30,action:'state',state:'open'}]});
  assert.equal(view([target(),s]).completions[0].at,20);
  s.history.push({at:40,action:'state',state:'done'});
  assert.deepEqual(view([target(),s]).completions.map(x=>x.at), [20,40]);
  assert.equal(view([target({updatedAt:50, body:'COUNT-SOURCE: node scripts/count.mjs\nRechecked instructions.'}),s]).status,'unverified');
});
test('WF-G285 uses refs at completion, not unrelated later ref edits', () => {
  const s=source({refs:['src/other.ts'],history:[{at:20,action:'state',state:'done'},{at:30,action:'edit',fields:['refs'],from:{refs:['src/spells.ts']}}]});
  assert.equal(view([target(),s]).status,'unverified');
  s.history[0].refs=['src/not-shared.ts']; assert.equal(view([target(),s]).status,'not_flagged');
  delete s.history[0].refs; delete s.history[1].from;
  assert.equal(view([target(),s]).status,'unavailable');
});
test('WF-G285 no false clear from missing provenance, partial boards or exhausted bounds', () => {
  assert.equal(view([target(),source({history:[]})]).status,'unavailable');
  assert.equal(view([target({createdAt:null}),source()]).status,'unavailable');
  assert.equal(view([target(),source()],{complete:false}).status,'unavailable');
  assert.equal(view([target(),source()],{limits:{tasks:1}}).status,'unavailable');
  assert.equal(view([target(),source()],{limits:{comparisons:0}}).status,'unavailable');
  assert.equal(view([target(),source({history:[{action:'state',state:'done',at:'bad'}]})]).status,'unavailable');
  const badDate=view([target(),source({history:[{action:'state',state:'done',at:Number.MAX_SAFE_INTEGER}]})]);
  assert.equal(badDate.status,'unavailable'); assert.doesNotThrow(()=>formatReferenceFreshness(badDate));
});
test('WF-G285 old completion and non-completion changes do not trigger; finished targets are not applicable', () => {
  assert.equal(view([target(),source({history:[{at:9,action:'state',state:'done'}]})]).status,'not_flagged');
  assert.equal(view([target(),source({state:'claimed',history:[{at:20,action:'edit',fields:['body']}]})]).status,'not_flagged');
  assert.equal(view([target({state:'done'}),source()]).status,'not_applicable');
  assert.equal(view([target(),source({history:[{at:10,action:'state',state:'done'}]})]).status,'unverified');
});

test('WF-G285 exact author review clears only matching receipts; stale, copied and malformed notes do not', () => {
  const review={taskId:'target',sourceTask:'source',completedAt:20,historyIndex:0,refs:['src/spells.ts'],proof:'Read-only count script returned 14 remaining items.'};
  const note=value=>({action:'note',at:30,reason:'COUNT-REVIEW: '+JSON.stringify(value)});
  const t=target({history:[note(review)]}),s=source();
  assert.equal(view([t,s]).status,'review_recorded'); assert.equal(view([t,s]).completions[0].reviewedAt,30);
  for(const patch of [{taskId:'copied-target'},{completedAt:19},{historyIndex:1},{refs:['src/other.ts']},{refs:['src/spells.ts','src/spells.ts']},{proof:'TODO recheck'},{permission:'edit'}]){
    assert.equal(view([target({history:[note({...review,...patch})]}),s]).status,'unverified');
  }
  t.history=[{action:'note',at:30,reason:'COUNT-REVIEW: malformed'}];assert.equal(view([t,s]).status,'unverified');
  t.history=[note(review)];s.history.push({action:'state',state:'done',at:40});assert.equal(view([t,s]).status,'unverified');
  t.history.push({action:'note',at:50,reason:'COUNT-REVIEW: '+JSON.stringify({...review,completedAt:40,historyIndex:1})});
  assert.equal(view([t,s]).status,'review_recorded');
  t.history=Array(33).fill(note(review));assert.equal(view([t,s]).status,'unavailable');
});
