/**
 * Proves the preservation scanner's end-to-end decisions in disposable repositories.
 * Fixtures cover real CLI exit codes, network failures, durable records, and clone
 * safety without touching Aralia's tasks, source files, or working-tree index.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  scanCodebase, fetchAgoraTasks, generateScaffoldCommand, compareReports,
  analyzeGitignoredImports, analyzeImageProofLeaks, parseOptions,
} from './sweep-stubs.mjs';

const cli = fileURLToPath(new URL('./sweep-stubs.mjs', import.meta.url));
const board = (tasks=[]) => async url => ({ok:true,json:async()=>url.endsWith('/tasks')?{tasks}:{agents:[]}});
function fixture(t, files={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'aralia-sweep-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const dir of ['src','tools','public/vendor/azgaar/modules','docs/projects','public/planmap'])fs.mkdirSync(path.join(root,dir),{recursive:true});
  put(root,'docs/projects/GLOBAL_GAPS.md','| Gap ID | Status | Gap |\n|---|---|---|\n');
  put(root,'public/planmap/topics.json','{"topics":[]}');
  for(const [file,text] of Object.entries(files))put(root,file,text);
  return root;
}
function put(root,file,text){const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,text);}
function git(root,...args){return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe']});}
async function invoke(root,args,fetchPayload={tasks:[]}) {
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/agents'?{agents:[]}:fetchPayload));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    return await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[cli,'--root',root,'--json',...args],{env:{...process.env,AGORA_URL:`http://127.0.0.1:${server.address().port}`},windowsHide:true});
      let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
      child.on('error',reject);child.on('close',code=>{try{resolve({code,report:JSON.parse(stdout),stderr});}catch(err){reject(new Error(stdout+stderr+err.message));}});
    });
  } finally { await new Promise(resolve=>server.close(resolve)); }
}

test('syntax findings preserve real JSX TODOs and reject example/regex traps',async t=>{
  const root=fixture(t,{'src/sample.tsx':[
    'const x = <div>hello</div>;',
    '// TODO: implement',
    'const r = /debugger; as any/;',
    `const s = 'throw new Error("todo")';`,
    'const trace = `${console.trace()}`;',
    'function pending() { throw new Error(',
    '  "todo"',
    '); }',
  ].join('\n')});
  const debt=await scanCodebase({repoRoot:root,fetchImpl:board()});
  assert.deepEqual(debt.unlisted.map(f=>f.type).sort(),['MARKER','THROW_UNIMPLEMENTED']);
  const debug=await scanCodebase({repoRoot:root,debugTraps:true,fetchImpl:()=>{throw Error('network must not run')}});
  assert.equal(debug.debugTraps.length,1);
});

test('blocked tracking, durable deferral, and completion review remain distinct',async t=>{
  const root=fixture(t,{'src/work.ts':'// TODO: paused task-12\nconst a=1;\n// TODO: later GG-42\nconst b=2;\n// TODO: still here task-13\n'});
  put(root,'docs/projects/GLOBAL_GAPS.md','| Gap ID | Status | Gap |\n|---|---|---|\n| GG-42 | open | Future feature |\n');
  const r=await scanCodebase({repoRoot:root,fetchImpl:board([{id:'task-12',state:'blocked'},{id:'task-13',state:'done'}])});
  assert.equal(r.tracked.length,1);assert.equal(r.recorded.length,1);assert.equal(r.completionReview.length,1);
  assert.equal(r.staleTasks,r.completionReview);
  assert.equal(r.gate.passed,false);
  put(root,'src/work.ts','// TODO: later GG-42\n');
  const deferred=await scanCodebase({repoRoot:root,fetchImpl:board()});
  assert.equal(deferred.gate.passed,true);
});

test('citations respect statement boundaries and known project gap IDs',async t=>{
  const root=fixture(t,{'src/work.ts':'// TODO: first\nconst x=1; // task-12\n// TODO: second COMBAT-G001\n'});
  put(root,'docs/projects/combat/GAPS.md','| Gap ID | Status | Gap |\n|---|---|---|\n| COMBAT-G001 | blocked | Future combat |\n');
  const r=await scanCodebase({repoRoot:root,fetchImpl:board([{id:'task-12',state:'open'}])});
  assert.equal(r.unlisted.length,1);assert.equal(r.recorded.length,1);assert.equal(r.tracked.length,0);
});

test('multiline executable stub owns its closing-line task citation',async t=>{
  const root=fixture(t,{'src/work.ts':'function build(){ return (\n {} as any\n ); // task-12\n}'});
  const r=await scanCodebase({repoRoot:root,fetchImpl:board([{id:'task-12',state:'open'}])});
  assert.equal(r.tracked.length,1);assert.equal(r.unlisted.length,0);
});

test('malformed Agora payloads fail the actual strict JSON CLI',async t=>{
  const root=fixture(t,{'src/clean.ts':'export const x=1;'});
  const result=await invoke(root,['--strict'],{});
  assert.equal(result.code,1);assert.equal(result.report.gate.passed,false);
  assert.match(result.report.subsystemErrors[0].error,/expected an array/);
  for(const payload of [{tasks:[{}]},{tasks:[{id:'task-1',state:'open',refs:[4]}]}]) {
    const checked=await fetchAgoraTasks(undefined,{fetchImpl:async()=>({ok:true,json:async()=>payload})});
    assert.ok(checked.error);
  }
});

test('offline citations are unverified and all local-only checks avoid the network',async t=>{
  const root=fixture(t,{'src/work.ts':'// TODO: later GG-42'});
  const r=await scanCodebase({repoRoot:root,fetchImpl:async()=>{throw Error('offline')}});
  assert.equal(r.unverifiedOffline.length,1);assert.equal(r.gate.passed,false);
  const local=await scanCodebase({repoRoot:root,paths:true,eol:true,health:true,fetchImpl:()=>{throw Error('must not fetch')}});
  assert.equal(local.subsystemErrors.length,0);assert.equal(local.summary.agoraOnline,null);
});

test('type debt is advisory consistently; explicit policy gates isolated and full CLI scans',async t=>{
  const root=fixture(t,{'src/work.ts':'export const value = {} as any;'});git(root,'init','-q');
  for(const args of [['--type-debt'],['--all']]) {
    const advisory=await invoke(root,[...args,'--strict']);
    assert.equal(advisory.code,0,JSON.stringify(advisory.report.gate));
    assert.equal(advisory.report.typeDebt.length,1);
    const gated=await invoke(root,[...args,'--gate-type-debt','--strict']);
    assert.equal(gated.code,1);
  }
});

test('API gate opt-ins select their checks without relying on CLI parsing',async t=>{
  const root=fixture(t,{'src/work.ts':'export const value = {} as any;\r\nexport const next=1;\n'});
  for (const [option,check] of [['gateTypeDebt','type_debt'],['gateEol','eol']]) {
    const report=await scanCodebase({repoRoot:root,[option]:true,fetchImpl:()=>{throw Error('local gate must not fetch')}});
    assert.deepEqual(report.scope.checks,[check]);
    assert.equal(report.subsystems[check].status,'has_findings');
    assert.equal(report.findings.length,1);
    assert.equal(report.gate.passed,false);
    assert.equal(report.subsystemErrors.length,0);
  }
});

test('comparison preserves line-shift identity and never labels disappearance resolved',async t=>{
  const root=fixture(t,{'src/work.ts':'// TODO: implement\nexport const a=1;'});
  const first=await scanCodebase({repoRoot:root,fetchImpl:board()});
  put(root,'src/work.ts','\n\n// TODO: implement\nexport const a=1;');
  const shifted=await scanCodebase({repoRoot:root,fetchImpl:board()});
  assert.equal(first.findings[0].findingId,shifted.findings[0].findingId);
  assert.equal(compareReports(first,shifted).previouslySeen.length,1);
  put(root,'src/work.ts','export const a=1;');
  const absent=await scanCodebase({repoRoot:root,fetchImpl:board()});
  const comparison=compareReports(first,absent);
  assert.equal(comparison.noLongerDetected.length,1);assert.equal(comparison.resolved,undefined);
  assert.throws(()=>compareReports(first,{...absent,coverage:{complete:false}}));
  assert.throws(()=>compareReports(first,{...absent,scope:{...absent.scope,checks:['eol']}}));
});

test('CLI comparison reads PowerShell UTF-16 snapshots and rejects failed selected checks',async t=>{
  const root=fixture(t,{'src/work.ts':'export const a=1;'});
  const first=await scanCodebase({repoRoot:root,eol:true});
  const snapshot=path.join(root,'prior.json');
  fs.writeFileSync(snapshot,Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(JSON.stringify(first),'utf16le')]));
  const result=await invoke(root,['--eol','--compare',snapshot,'--strict']);
  assert.equal(result.code,0);assert.ok(result.report.comparison);
  assert.throws(()=>compareReports(first,{...first,subsystems:{...first.subsystems,eol:{status:'error',findingsCount:0}},findings:[]}));
});

test('scaffolds include stable IDs, preserve quotes and group related observations',async t=>{
  const root=fixture(t,{'src/systems/combat/a.ts':'// TODO: first\nconst x=1;\n// TODO: second\n'});
  const r=await scanCodebase({repoRoot:root,fetchImpl:board()});
  assert.equal(r.proposals.length,1);
  const command=generateScaffoldCommand(r.proposals[0]);
  for(const f of r.findings)assert.ok(command.includes(f.findingId));
  assert.match(command,/--standalone --reason '/);
  assert.match(command,/Preserve current behavior/);
  const escaped=generateScaffoldCommand({...r.findings[0],text:"TODO: user's $() ` literal"});
  assert.ok(escaped.includes("user''s $() ` literal"));
});

test('static imports detect ignored dependencies while example strings do not create edges',t=>{
  const root=fixture(t,{'src/app.ts':`import {
 value
} from '../private/value';
const example = "import fake from '../private/example'";`,
    'private/value.ts':'export const value=1;','private/example.ts':'export const fake=2;','.gitignore':'private/\n'});
  git(root,'init','-q');git(root,'add','src/app.ts','.gitignore');
  assert.deepEqual(analyzeGitignoredImports(root).badImports,[{from:'src/app.ts',to:'private/value.ts'}]);
});

test('ignored type declarations are clone-breaking dependencies too',t=>{
  const root=fixture(t,{'src/app.ts':"import type { Value } from '../private/types';",'private/types.d.ts':'export type Value = string;','.gitignore':'private/\n'});
  git(root,'init','-q');git(root,'add','src/app.ts','.gitignore');
  assert.deepEqual(analyzeGitignoredImports(root).badImports,[{from:'src/app.ts',to:'private/types.d.ts'}]);
});

test('proof rules treat product assets symmetrically and detect capture names in both roots',t=>{
  const root=fixture(t,{'src/assets/hero.png':'asset','public/hero.png':'asset','docs/screenshot-01.png':'proof','public/screenshot-02.png':'proof'});git(root,'init','-q');
  assert.deepEqual(analyzeImageProofLeaks(root).leaks.map(x=>x.file).sort(),['docs/screenshot-01.png','public/screenshot-02.png']);
});

test('missing paths and parse errors cannot produce verified complete inventories',async t=>{
  const root=fixture(t,{'src/broken.ts':'const = ;'});
  const bad=await scanCodebase({repoRoot:root,fetchImpl:board()});
  assert.equal(bad.coverage.complete,false);assert.equal(bad.gate.passed,false);
  const missing=await scanCodebase({repoRoot:root,dir:'missing',eol:true});
  assert.equal(missing.coverage.complete,false);assert.equal(missing.gate.passed,false);
  assert.throws(()=>parseOptions(['--dir']));assert.throws(()=>parseOptions(['--typo']));
});

test('invalid PlanMap structure is an error rather than an empty verified plan',async t=>{
  const root=fixture(t,{'public/planmap/topics.json':'{}'});
  const result=await scanCodebase({repoRoot:root,planmap:true});
  assert.equal(result.subsystems.planmap.status,'error');
  assert.equal(result.coverage.complete,false);
  assert.equal(result.gate.passed,false);
});
