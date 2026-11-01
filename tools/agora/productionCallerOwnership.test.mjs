// WF-G255: prove mandatory production delivery without executing game code.
// Private source trees and boards isolate syntax/ownership checks from shared
// runtime files, live workers and the protected daemon restart boundary.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import { inspectProductionCallers, hasProductionWiringIntent, assertTaskProductionCallers, productionFollowUpLine, productionCallerPromptBlock } from './productionCallerOwnership.mjs';

const clone=value=>structuredClone(value);
function fixture(run) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-prod-caller-'));
  const write=(file,text)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),text);};
  const pure='export function describe(value: string): string { return value; }';
  const caller='import type { GameState } from "./types/state";\nimport { describe as render } from "./pure";\nexport function integrate(gameState: GameState) { const memory = gameState.npcMemory; return render(memory); }';
  write('src/types/state.ts','export interface GameState { npcMemory: string; }');
  write('src/pure.ts',pure);write('src/caller.ts',caller);
  const entry={id:'witness',module:{file:'src/pure.ts',symbol:'describe',quote:pure},callers:[{file:'src/caller.ts',symbol:'integrate',quote:'export function integrate(gameState: GameState)',relation:'existing',reason:'Direct current caller of the pure formatter.',delivery:'owned'}],
    state:{field:'npcMemory',quote:'const memory = gameState.npcMemory;',relation:'existing',reason:'Caller holds canonical GameState and passes its memory to the formatter.'},review:'Parent traced the current pure formatter to its nearest state-holding caller; companion tests and actual integration proof remain required.'};
  const packet={id:'delivery',scope:'Wire witness context into dialogue',files:['src/pure.ts','src/caller.ts'],productionCallers:[entry]};
  try{return run({root,write,pure,caller,entry,packet,inspect:p=>inspectProductionCallers(p,undefined,{repoRoot:root})});}
  finally{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.match(path.basename(root),/^agora-prod-caller-/);fs.rmSync(root,{recursive:true,force:true});}
}

test('explicit symbol/file wiring instructions trigger, historical context and policy do not',()=>{
  for(const s of ['Wire buildWitnessDialogueContext into dialogue','wiring `src/a.ts` through the hook','Integrate reader with the state owner'])assert.equal(hasProductionWiringIntent(s),true,s);
  for(const s of ['Repair a parser','REFERENCE-ONLY: wire foo into bar','HISTORY: wire foo into bar','ACTION DELIVERY (WF-G237): wire foo into bar'])assert.equal(hasProductionWiringIntent(s),false,s);
});
test('ordinary Markdown and function notation cannot hide explicit wiring instructions',()=>{
  for(const prose of ['Wire **A** to **B**','Wire `A()` to B','Integrate *reader* into **dialogue**'])assert.equal(hasProductionWiringIntent(prose),true,prose);
});
test('destructured runtime aliases and namespace roots cannot shadow their imports',()=>fixture(({packet,inspect,write,caller})=>{
  const changes=[caller.replace('integrate(gameState: GameState)','integrate(gameState: GameState, { render }: any)'),
    caller.replace('import { describe as render }','import * as Pure').replace('integrate(gameState: GameState)','integrate(gameState: GameState, Pure: any)').replace('render(memory)','Pure.describe(memory)')];
  for(const changed of changes){write('src/caller.ts',changed);packet.productionCallers[0].callers[0].quote=changed.split('\n')[2].split(' { const')[0];assert.throws(()=>inspect(packet),/unshadowed direct runtime import\/call/);}
}));
test('generic or local type bindings cannot substitute for imported canonical GameState',()=>fixture(({packet,inspect,write,caller})=>{
  for(const changed of [caller.replace('integrate(gameState: GameState)','integrate<GameState>(gameState: GameState)'),
    caller.replace('const memory =','type GameState = any; const memory =')]){
    write('src/caller.ts',changed);packet.productionCallers[0].callers[0].quote=changed.split('\n')[2].split(' {')[0];assert.throws(()=>inspect(packet),/GameState.*shadowed/);
  }
}));
test('namespace context root shadowing is not current state-holder proof',()=>fixture(({packet,inspect,write})=>{
  write('src/state/GameContext.tsx','export function useOptionalGameState() { return null as any; }');
  write('src/caller.ts','import * as Context from "./state/GameContext";\nimport { describe as render } from "./pure";\nexport function integrate(Context: any) { const ctx = Context.useOptionalGameState(); const memory = ctx.state.npcMemory; return render(memory); }');
  packet.productionCallers[0].callers[0].quote='export function integrate(Context: any)';packet.productionCallers[0].state.quote='const memory = ctx.state.npcMemory;';assert.throws(()=>inspect(packet),/accessor is shadowed/);
}));
test('named function expressions cannot manufacture imported production calls',()=>fixture(({packet,inspect,write,caller})=>{
  write('src/caller.ts',caller.replace('return render(memory);','const f = function render(x: string) { return render(x); }; return f(memory);'));
  assert.throws(()=>inspect(packet),/unshadowed direct runtime import\/call/);
}));
test('dynamic bracket keys cannot prove the named canonical state field',()=>fixture(({packet,inspect,write,caller})=>{
  write('src/caller.ts',caller.replace('const memory = gameState.npcMemory;','const npcMemory = "other"; const memory = gameState[npcMemory];'));
  packet.productionCallers[0].state.quote='const memory = gameState[npcMemory];';assert.throws(()=>inspect(packet),/supported GameState/);
  write('src/caller.ts',caller.replace('gameState.npcMemory','gameState["npcMemory"]'));
  packet.productionCallers[0].state.quote='const memory = gameState["npcMemory"];';assert.equal(inspect(packet)[0].stateSyntaxVerified,true);
}));
test('a current owned runtime alias call and canonical state access are checked without mutating the packet',()=>fixture(({packet,inspect})=>{
  const before=JSON.stringify(packet),report=inspect(packet);assert.equal(report[0].callers[0].syntaxVerified,true);assert.equal(report[0].stateSyntaxVerified,true);assert.equal(JSON.stringify(packet),before);
}));
test('complete typed state is a state-holding caller even when the pure module reads its fields',()=>fixture(({packet,inspect})=>{
  packet.productionCallers[0].state.quote='export function integrate(gameState: GameState)';assert.equal(inspect(packet)[0].stateSyntaxVerified,true);
}));
test('state context access must come from the canonical unshadowed runtime hook',()=>fixture(({packet,inspect,write})=>{
  write('src/state/GameContext.tsx','export function useOptionalGameState() { return null as any; }');
  write('src/caller.ts','import { useOptionalGameState as useState } from "./state/GameContext";\nimport { describe as render } from "./pure";\nexport function integrate() { const ctx = useState(); const memory = ctx?.state.npcMemory; return render(memory); }');
  packet.productionCallers[0].callers[0].quote='export function integrate()';packet.productionCallers[0].state.quote='const memory = ctx?.state.npcMemory;';assert.equal(inspect(packet)[0].stateSyntaxVerified,true);
  write('src/caller.ts','import { useOptionalGameState as useState } from "./state/GameContext";\nimport { describe as render } from "./pure";\nexport function integrate(useState: any) { const ctx = useState(); const memory = ctx?.state.npcMemory; return render(memory); }');
  packet.productionCallers[0].callers[0].quote='export function integrate(useState: any)';assert.throws(()=>inspect(packet),/accessor is shadowed/);
}));
test('null/empty/malformed/duplicate/unowned declarations fail closed',()=>fixture(({packet,inspect,entry})=>{
  for(const declaration of [null,{},[],[{}],[entry,entry],[{...entry,review:'TODO'}]])assert.throws(()=>inspect({...packet,productionCallers:declaration}),/WF-G255/);
  for(const file of ['src/../pure.ts','src/*.ts','src/caller.test.ts','src/types/state.d.ts']){const p=clone(packet);p.productionCallers[0].module.file=file;assert.throws(()=>inspect(p),/exact production source/);}
  const p=clone(packet);p.files=['src/pure.ts'];assert.throws(()=>inspect(p),/state\/caller outside owned files/);
}));
test('stale/ambiguous/comment anchors and wrong field/source claims are not current state proof',()=>fixture(({packet,inspect,write,caller})=>{
  for(const patch of [{quote:'missing'},{quote:'const memory = gameState.npcMemory;\nmissing'},{field:'unknown'},{quote:'// gameState.npcMemory'}]){
    const p=clone(packet);Object.assign(p.productionCallers[0].state,patch);assert.throws(()=>inspect(p),/WF-G255/);
  }
  write('src/caller.ts',caller+'\n// const memory = gameState.npcMemory;');assert.throws(()=>inspect(packet),/ambiguous state-owner/);
}));
test('type-only, unused, wrong-module and shadowed calls cannot prove an existing runtime link',()=>fixture(({packet,inspect,write,caller})=>{
  for(const change of [caller.replace('import { describe as render }','import type { describe as render }'),caller.replace('return render(memory)','return memory'),caller.replace('from "./pure"','from "./other"'),caller.replace('const memory =','const render = (x: string) => x; const memory =')]){
    write('src/other.ts','export function describe(x: string) { return x; }');write('src/caller.ts',change);assert.throws(()=>inspect(packet),/unshadowed direct runtime import\/call/);
  }
}));
test('namespace runtime calls are supported; fake local GameState types are not',()=>fixture(({packet,inspect,write,caller})=>{
  write('src/caller.ts',caller.replace('import { describe as render }','import * as Pure').replace('render(memory)','Pure.describe(memory)'));assert.equal(inspect(packet)[0].callers[0].syntaxVerified,true);
  write('src/caller.ts',caller.replace('import type { GameState } from "./types/state";','interface GameState { npcMemory: string; }'));assert.throws(()=>inspect(packet),/supported GameState/);
}));
test('unrelated/nested shadowed state cannot substitute for the declared state holder',()=>fixture(({packet,inspect,write,caller})=>{
  write('src/caller.ts',caller.replace('const memory = gameState.npcMemory;','const f = (gameState: any) => gameState.npcMemory; const memory = gameState.npcMemory;'));assert.throws(()=>inspect(packet),/state binding is shadowed/);
}));
test('planned links retain current anchors and ownership but are explicitly not current syntax proof',()=>fixture(({packet,inspect,write,caller})=>{
  write('src/caller.ts',caller.replace('return render(memory)','return memory'));
  const record=packet.productionCallers[0];record.callers[0].relation='planned';record.state.relation='planned';assert.equal(inspect(packet)[0].callers[0].syntaxVerified,false);assert.equal(inspect(packet)[0].stateSyntaxVerified,false);
  packet.files=['src/pure.ts'];assert.throws(()=>inspect(packet),/outside owned files/);
}));
test('each intermediate caller is owned or explicitly deferred, not just the final hook',()=>fixture(({packet,inspect,write,entry})=>{
  write('src/bridge.ts','import { describe } from "./pure"; export function bridge(value: string) { return describe(value); }');
  write('src/caller.ts','import type { GameState } from "./types/state"; import { bridge as render } from "./bridge"; export function integrate(gameState: GameState) { const memory = gameState.npcMemory; return render(memory); }');
  entry.callers.unshift({file:'src/bridge.ts',symbol:'bridge',quote:'export function bridge(value: string)',relation:'existing',reason:'Current intermediate formatter.',delivery:'owned'});
  assert.throws(()=>inspect(packet),/outside owned files.*bridge/);packet.files.push('src/bridge.ts');assert.equal(inspect(packet)[0].callers.length,2);
}));
test('deferred callers require exact unfinished same-campaign blocking follow-ups and durable edit obligations',()=>fixture(({packet,entry,root})=>{
  packet.files=['src/pure.ts'];packet.taskIds=['agora-build'];Object.assign(entry.callers[0],{delivery:'deferred',followUpTask:'agora-follow'});
  const build={id:'agora-build',state:'claimed',campaignId:'campaign'};
  const follow={id:'agora-follow',state:'in_progress',campaignId:'campaign',refs:['src/caller.ts'],body:productionFollowUpLine(entry,entry.callers[0]),deps:[{id:build.id,type:'blocks'}]};
  const inspect=tasks=>inspectProductionCallers(packet,tasks,{repoRoot:root});assert.equal(inspect([build,follow])[0].callers[0].followUpVerified,true);
  for(const patch of [{state:'done'},{campaignId:'other'},{body:'Implement integration'},{refs:[]},{deps:[]},{deps:[{id:build.id,type:'related'}]},{deps:[{id:build.id,type:'relates_to'}]},{body:'REFERENCE-ONLY: src/caller.ts\n'+follow.body}])assert.throws(()=>inspect([build,{...follow,...patch}]),/WF-G255/);
  assert.throws(()=>inspect([{...build,state:'done'},follow]),/current build task/);
  assert.throws(()=>inspect([build]),/current,unfinished/);
}));
test('task metadata cannot be dropped, changed or duplicated in a new packet; prompts preserve explicit limits',()=>fixture(({packet,entry})=>{
  const body=productionCallerPromptBlock(packet);assert.match(body,/REFERENCE-ONLY: PRODUCTION-CALLER:/);assert.match(body,/Planned\/deferred wiring remains incomplete/);assert.match(body,/grant no files, locks or commands/);
  assert.doesNotThrow(()=>assertTaskProductionCallers(packet,{title:'Wire witness context into dialogue',body}));
  for(const p of [{...packet,productionCallers:[]},{...packet,productionCallers:[{...entry,review:'Different premise'}]}])assert.throws(()=>assertTaskProductionCallers(p,{body}),/retained exactly/);
  assert.throws(()=>assertTaskProductionCallers(packet,{body:body+'\nREFERENCE-ONLY: PRODUCTION-CALLER: '+JSON.stringify(entry)}),/retained exactly/);
  assert.throws(()=>assertTaskProductionCallers(packet,{body:'PRODUCTION-CALLER: broken'}),/invalid task/);
}));
