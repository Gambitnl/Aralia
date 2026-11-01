// Union ownership fixtures never import or execute game modules. They exercise
// declaration identity, sparse tables and fail-closed source-only discovery.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
const modulePath='./unionConsumerOwnership.mjs';
async function fixture(check){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-unions-'));
  const put=(file,text)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);};
  const quote='export type BuildingType = "home" | "shop";';put('src/town.ts','throw new Error("never execute");\n'+quote);
  const change={id:'town-change',file:'src/town.ts',symbol:'BuildingType',quote,members:['home','shop'],added:['keep'],removed:[],reason:'Extend the town vocabulary with a reviewed new building kind.',otherUsesReview:'Parent reviews sparse tables, subsets and other call sites separately; this fixture changes no game behavior.'};
  const packet={id:'PK-town',files:['src/town.ts'],unionChanges:[change]};
  try{const api=await import(modulePath);await check({root,put,quote,change,packet,...api,inspect:(packets=[packet],limits)=>api.inspectUnionConsumers({packets},{repoRoot:root,limits})});}
  finally{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.match(path.basename(root),/^agora-unions-/);fs.rmSync(root,{recursive:true,force:true});}
}
test('WF282: declaration identities separate same names and find aliased exhaustive consumers',()=>fixture(({put,packet,inspect})=>{
  put('src/other.ts','export type BuildingType = "alien" | "other";');
  put('src/barrel.ts','export { BuildingType as Renamed } from "./town";');
  put('src/table.ts','import type { Renamed as Kind } from "./barrel"; const LABEL: Record<Kind,string> = { home:"H", shop:"S" };');
  put('src/namespace.ts','import type * as Town from "./town"; const LABEL: Record<Town.BuildingType,number> = {home:1,shop:2};');
  put('src/inline.ts','const LABEL: Record<import("./town").BuildingType,number> = {home:1,shop:2};');
  put('src/unrelated.ts','import type {BuildingType} from "./other"; const LABEL: Record<BuildingType,number> = {alien:1,other:2};');
  const before=JSON.stringify(packet),audit=inspect(),entry=audit.packets[0];
  assert.deepEqual(new Set(entry.references),new Set(['src/town.ts','src/table.ts','src/namespace.ts','src/inline.ts']));
  assert.ok(entry.changes[0].consumers.every(item=>item.line>0&&item.file));assert.equal(JSON.stringify(packet),before);
}));
test('WF282: partial and value-position uses do not become exhaustive edit obligations',()=>fixture(({put,inspect})=>{
  put('src/table.ts','import type {BuildingType} from "./town"; const SPARSE: Readonly<Partial<Record<BuildingType,number>>> = {}; const VALUES: Record<string,BuildingType> = {}; const RESTORED: Required<Partial<Record<BuildingType,number>>> = {home:1,shop:2};');
  const audit=inspect().packets[0],items=audit.changes[0].consumers;
  assert.ok(items.some(item=>item.kind==='sparse-record'));assert.ok(items.some(item=>item.kind==='record-value'));assert.equal(items.filter(item=>item.kind==='exhaustive-record').length,1);assert.deepEqual(audit.references,['src/town.ts','src/table.ts']);
}));
test('WF282: complete literal vocabulary differs from intentionally partial typed samples',()=>fixture(({put,inspect})=>{
  put('src/all.test.ts','import type {BuildingType} from "./town"; const ALL: BuildingType[] = ["home","shop"];');
  put('src/subset.test.ts','import type {BuildingType} from "./town"; const SAMPLE: readonly BuildingType[] = ["home"];');
  const entry=inspect().packets[0];assert.deepEqual(entry.references,['src/town.ts','src/all.test.ts']);assert.ok(entry.changes[0].consumers.some(item=>item.kind==='complete-literal-vocabulary'));assert.ok(entry.changes[0].consumers.some(item=>item.file==='src/subset.test.ts'&&!item.required));
}));
test('WF282: current member and anchor premises cannot silently survive union growth',()=>fixture(({put,packet,quote,inspect})=>{
  packet.unionChanges[0].members=['home'];assert.throws(()=>inspect(),/member|stale/);packet.unionChanges[0].members=['home','shop'];
  put('src/town.ts',quote.replace(';',' | "sibling";'));assert.throws(()=>inspect(),/anchor|stale/);
}));
test('WF282: unchanged owned unions need exact current review, not omission or placeholders',()=>fixture(({root,packet,change,quote,inspect})=>{
  delete packet.unionChanges;assert.throws(()=>inspect(),/unchanged|unreviewed/);
  packet.unionReviews=[{file:change.file,symbol:change.symbol,quote,members:change.members,reason:'Only another field changes; this finite union and its callers are unchanged.'}];assert.equal(inspect().packets[0].unchanged.length,1);
  packet.unionReviews[0].reason='TODO';assert.throws(()=>inspect(),/reason|malformed/);
}));
test('WF282: unsupported relevant aliases, shadowed utilities and discovery limits refuse',()=>fixture(({put,inspect})=>{
  put('src/table.ts','import type {BuildingType} from "./town"; type Table<K extends string> = Record<K,number>; const LABEL: Table<BuildingType> = {home:1,shop:2};');
  assert.throws(()=>inspect(),/unsupported/);
  put('src/table.ts','import type {BuildingType} from "./town"; type Record<K,V> = {other:V}; const LABEL: Record<BuildingType,number> = {other:1};');assert.throws(()=>inspect(),/shadow|unsupported/);
  assert.throws(()=>inspect(undefined,{files:1}),/limit|inventory/);
}));
test('WF282: durable task declarations cannot be dropped or rewritten by a dispatch plan',()=>fixture(({packet,change,assertTaskUnions})=>{
  const task={id:'agora-fixture',body:'REFERENCE-ONLY: UNION-CHANGE: '+JSON.stringify(change)};assert.doesNotThrow(()=>assertTaskUnions(packet,task));assert.throws(()=>assertTaskUnions({...packet,unionChanges:[]},task),/different|missing/);
  assert.throws(()=>assertTaskUnions(packet,{...task,body:task.body+'\n'+task.body}),/duplicate/);assert.throws(()=>assertTaskUnions(packet,{...task,body:'UNION-CHANGE: nope'}),/JSON/);
}));

test('WF282: conflicting wave deltas and unresolved local Record keys refuse',()=>fixture(({put,packet,inspect})=>{
  const sibling=structuredClone(packet);sibling.id='PK-other';sibling.unionChanges[0].added=['castle'];assert.throws(()=>inspect([packet,sibling]),/conflicting/);
  put('src/table.ts','import type {BuildingType} from "./missing"; const LABEL: Record<BuildingType,number> = {};');assert.throws(()=>inspect(),/unresolved local/);
  put('src/table.ts','type Kind = import("./missing").BuildingType; const LABEL: Record<Kind,number> = {};');assert.throws(()=>inspect(),/unresolved local/);
}));

test('WF282: grouped unchanged hashes and relevant transformed tables refuse stale or unsupported evidence',()=>fixture(({root,put,packet,quote,inspect,captureUnchangedUnionContext})=>{
  delete packet.unionChanges;packet.unionReviews=[captureUnchangedUnionContext('src/town.ts','This fixture changes no vocabulary or caller contract.',{repoRoot:root})];assert.equal(inspect().packets[0].unchanged.length,1);
  put('src/town.ts',fs.readFileSync(path.join(root,'src/town.ts'),'utf8')+'\n// concurrent context');assert.throws(()=>inspect(),/hash/);
  put('src/town.ts',quote);packet.unionChanges=[{id:'delta',file:'src/town.ts',symbol:'BuildingType',quote,members:['home','shop'],added:['keep'],removed:[],reason:'Add the reviewed building kind.',otherUsesReview:'Parent reviews sparse and other uses separately.'}];delete packet.unionReviews;
  for(const text of ['const LABEL: Record<Exclude<BuildingType,"home">,number> = {};','type Table = Record<BuildingType,number>; const LABEL: Table = {};','type Table = { [K in BuildingType]: number };']){
    put('src/table.ts','import type {BuildingType} from "./town"; '+text);assert.throws(()=>inspect(),/unsupported/);
  }
}));

test('WF282: generic mapped and transitive table aliases cannot hide required consumers',()=>fixture(({put,inspect})=>{
  for(const text of ['type Table<K extends string> = {[P in K]: number}; const X: Table<BuildingType> = {};','type Table<K extends string> = Record<K,number>; type Mid<K extends string> = Table<K>; const X: Mid<BuildingType> = {};']){
    put('src/table.ts','import type {BuildingType} from "./town"; '+text);assert.throws(()=>inspect(),/unsupported/);
  }
}));

test('WF282: satisfies lists and parenthesized sparse wrappers preserve classification',()=>fixture(({put,inspect})=>{
  put('src/table.ts','import type {BuildingType} from "./town"; const ALL = (["home","shop"] as const) satisfies readonly BuildingType[]; const SAMPLE = ["home"] satisfies BuildingType[]; const SPARSE: Partial<(Record<BuildingType,number>)> = {}; const FULL: Required<(Partial<(Record<BuildingType,number>)>)> = {home:1,shop:2};');
  const items=inspect().packets[0].changes[0].consumers;assert.equal(items.filter(item=>item.kind==='complete-literal-vocabulary').length,1);assert.equal(items.filter(item=>item.kind==='typed-array').length,1);assert.equal(items.filter(item=>item.kind==='sparse-record').length,1);assert.equal(items.filter(item=>item.kind==='exhaustive-record').length,1);
  put('src/table.ts','import type {BuildingType} from "./missing"; const ALL: BuildingType[] = ["home","shop"];');assert.throws(()=>inspect(),/unresolved local vocabulary/);
}));

test('WF282: a concurrently added consumer prevents a complete-inventory claim',()=>fixture(({root,put,inspect})=>{
  const original=fs.readdirSync;let walks=0;
  try{fs.readdirSync=function(directory,...args){if(path.resolve(directory)===path.join(root,'src')&&++walks===2)put('src/new.ts','import type {BuildingType} from "./town"; const X: Record<BuildingType,number> = {};');return original.call(this,directory,...args);};assert.throws(()=>inspect(),/inventory membership changed/);}
  finally{fs.readdirSync=original;}
}));

test('WF282: disjoint grouped reviews round-trip through their durable brief',()=>fixture(({root,put,packet,inspect,captureUnchangedUnionContext,unionPromptBlock,assertTaskUnions})=>{
  put('src/town.ts','export type BuildingType = "home" | "shop";\nexport type Role = "one" | "two";');delete packet.unionChanges;
  const record=captureUnchangedUnionContext('src/town.ts','Both fixture contracts are deliberately unchanged.',{repoRoot:root});packet.unionReviews=[{...record,symbols:['BuildingType']},{...record,symbols:['Role']}];assert.equal(inspect().packets[0].unchanged.length,2);assert.doesNotThrow(()=>assertTaskUnions(packet,{body:unionPromptBlock(packet)}));
}));

test('WF282: the declaration owner records its delta and wave reviews cannot contradict it',()=>fixture(({packet,change,inspect})=>{
  const delegate=structuredClone(packet);delegate.id='PK-delegate';delegate.files=[];assert.throws(()=>inspect([packet,delegate]),/source-owning/);
  const reviewed={id:'PK-review',files:[],unionReviews:[{file:change.file,symbol:change.symbol,quote:change.quote,members:change.members,reason:'This fixture incorrectly asserts unchanged contract across the same wave.'}]};assert.throws(()=>inspect([packet,reviewed]),/contradicts unchanged/);
}));

test('WF282: import-type and shadowed Array table aliases refuse rather than omit ownership',()=>fixture(({put,inspect})=>{
  put('src/tables.ts','export type Table<K extends string> = Record<K,number>;');
  put('src/table.ts','import type {BuildingType} from "./town"; const X: import("./tables").Table<BuildingType> = {};');assert.throws(()=>inspect(),/unsupported/);
  put('src/table.ts','import type {BuildingType} from "./town"; type Array<K extends string> = Record<K,number>; const X: Array<BuildingType> = {};');assert.throws(()=>inspect(),/unsupported/);
}));

test('WF282: parenthesized declarations and satisfies types keep complete vocabulary ownership',()=>fixture(({put,inspect})=>{
  put('src/table.ts','import type {BuildingType} from "./town"; const ALL: (BuildingType[]) = ["home","shop"];');assert.ok(inspect().packets[0].changes[0].consumers.some(item=>item.kind==='complete-literal-vocabulary'));
  put('src/table.ts','import type {BuildingType} from "./town"; const ALL = ["home","shop"] satisfies (readonly BuildingType[]);');assert.ok(inspect().packets[0].changes[0].consumers.some(item=>item.kind==='complete-literal-vocabulary'));
}));
