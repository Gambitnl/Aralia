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
import ts from 'typescript';
import { lintTask } from '../../tools/agora/taskLint.mjs';
import {
  scanCodebase, fetchAgoraTasks, generateScaffoldCommand, compareReports,
  analyzeGitignoredImports, analyzeImageProofLeaks, parseOptions,
} from './sweep-stubs.mjs';

const cli = fileURLToPath(new URL('./sweep-stubs.mjs', import.meta.url));
const board = (tasks=[]) => async url => ({ok:true,json:async()=>url.endsWith('/tasks')?{tasks}:{agents:[]}});

// The historical failure pattern is reproduced only in temporary source. The
// compiler proves why a base interface is insufficient, not Aralia acceptance.
const unionTypeFixture = [
  "interface EffectTrigger { type: 'enter'; frequency?: 'once'; }",
  'interface BaseEffect { trigger: EffectTrigger; }',
  "interface NormalEffect extends BaseEffect { kind: 'normal'; }",
  "interface ReactiveEffect extends Omit<BaseEffect, 'trigger'> { kind: 'reactive'; trigger: { type: 'reaction' }; }",
  'type SpellEffect = NormalEffect | ReactiveEffect;',
  'declare const effect: SpellEffect;',
  'export const gate = (effect.trigger as any).frequency;',
].join('\n') + '\n';

test('WF210: historical-equivalent removal advice is unverified even when quotes and task lint pass', async t => {
  const root = fixture(t, { 'src/review.ts': unionTypeFixture });
  const report = await scanCodebase({ repoRoot: root, srcDir: path.join(root, 'src'), asAny: true, fetchImpl: board() });
  const finding = report.findings.find(item => item.type === 'AS_ANY_CAST'); assert.ok(finding);
  assert.equal(finding.typeReview.status, 'unverified');
  assert.equal(finding.trackingStatus, 'advisory'); assert.deepEqual(report.proposals, []);
  const premise = 'BaseEffect.trigger is already typed as EffectTrigger (which declares type and frequency)';
  const removal = 'Remove the any assertion mechanically; no narrowing is needed.';
  const command = generateScaffoldCommand({ findings: [finding], refs: [finding.file], title: 'Investigate cast premise',
    currentBehavior: premise, nextAction: removal, acceptanceCriteria: ['Remove the cast.'], typeReview: { status: 'verified' } }, { repoRoot: root });
  assert.match(command, /TYPE-PREMISE-UNVERIFIED:/); assert.match(command, /every relevant union member/); assert.match(command, /narrowing helper/);
  assert.ok(command.includes('UNVERIFIED proposed Current behavior to preserve: ' + premise));
  assert.ok(command.includes('UNVERIFIED proposed Next action: ' + removal)); assert.ok(!command.includes('\nNext action: ' + removal));
  const body = command.slice(command.indexOf("--body '") + 8, -1).replace(/''/g, "'");
  assert.equal(lintTask({ body, refs: [finding.file] }, { repoRoot: root }).clean, true, 'path and quote lint is not assignability proof');
  const compile = (name, text) => {
    put(root, name, text); const program = ts.createProgram([path.join(root, name)], { strict: true, noEmit: true, types: [], skipLibCheck: true, target: ts.ScriptTarget.ES2022 });
    return ts.getPreEmitDiagnostics(program);
  };
  const unsafe = compile('unsafe.ts', unionTypeFixture.replace('(effect.trigger as any).frequency', 'effect.trigger.frequency'));
  assert.ok(unsafe.some(item => item.code === 2339 && ts.flattenDiagnosticMessageText(item.messageText, ' ').includes('frequency')));
  const narrowed = compile('narrowed.ts', unionTypeFixture.replace('(effect.trigger as any).frequency', "'frequency' in effect.trigger ? effect.trigger.frequency : undefined"));
  assert.deepEqual(narrowed, [], narrowed.map(item => ts.flattenDiagnosticMessageText(item.messageText, ' ')).join('\n'));
  assert.equal(fs.readFileSync(path.join(root, 'src/review.ts'), 'utf8'), unionTypeFixture);
});

test('WF210: real scanner CLI exposes unverified type review and never mutates source or board', async t => {
  const root = fixture(t, { 'src/review.ts': unionTypeFixture });
  const methods = [], server = http.createServer((req, res) => {
    methods.push(req.method); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(req.url === '/tasks' ? { tasks: [] } : { agents: [] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const execute = args => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, '--root', root, '--dir', path.join(root, 'src'), '--as-any', '--agora-state', ...args], {
      env: { ...process.env, AGORA_URL: 'http://127.0.0.1:' + server.address().port }, windowsHide: true,
    });
    let stdout = '', stderr = ''; const timer = setTimeout(() => { child.kill(); reject(new Error('type scaffold proof timed out')); }, 30000);
    child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
    child.once('error', error => { clearTimeout(timer); reject(error); }); child.once('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
  try {
    const reportRun = await execute(['--json']); assert.equal(reportRun.code, 0, reportRun.stderr); const report = JSON.parse(reportRun.stdout);
    assert.equal(report.typeDebt[0].typeReview.status, 'unverified');
    assert.equal(report.typeDebt[0].trackingStatus, 'advisory'); assert.deepEqual(report.proposals, []);
    const scaffold = await execute(['--scaffold']); assert.equal(scaffold.code, 0, scaffold.stdout + scaffold.stderr);
    assert.match(scaffold.stdout, /TYPE-PREMISE-UNVERIFIED:/); assert.match(scaffold.stdout, /before assigning cast removal/);
    assert.match(scaffold.stdout, /Omit or redeclaration/); assert.match(scaffold.stdout, /focused compile\/type evidence/);
    assert.equal(fs.readFileSync(path.join(root, 'src/review.ts'), 'utf8'), unionTypeFixture);
    assert.ok(methods.length); assert.ok(methods.every(method => method === 'GET'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('WF210: normal scanner suggestions keep their existing non-type wording', t => {
  const root = fixture(t, { 'src/review.ts': '// TODO: inspect current intent\n' });
  const text = generateScaffoldCommand({ type: 'TODO', findingId: 'ordinary', file: 'src/review.ts', line: 1, text: 'TODO: inspect current intent' }, { repoRoot: root });
  assert.doesNotMatch(text, /TYPE-PREMISE-UNVERIFIED|UNVERIFIED proposed/); assert.match(text, /Next action: Review existing work and choose a disposition/);
});

test('WF211: regenerated scaffold retains its quote after tracking annotations shift the line', t => {
  const source = 'export function guard(token) {\n  if (!known.has(token)) return false;\n}\n';
  const root = fixture(t, { 'src/guard.ts': source });
  const finding = { findingId: 'finding-citation', file: 'src/guard.ts', line: 2, type: 'CURRENT_SOURCE_PROOF', text: 'if (!known.has(token)) return false;' };
  const before = generateScaffoldCommand(finding, { repoRoot: root }); assert.match(before, /SOURCE-CITATION:/);
  put(root, finding.file, '// tracked in Agora task agora-fixture\n' + source);
  const after = generateScaffoldCommand(finding, { repoRoot: root });
  assert.match(after, /SOURCE-CITATION:/); assert.match(after, /"observedLine":3/);
  assert.ok(after.includes(finding.text)); assert.ok(after.includes(finding.findingId));
  assert.ok(!after.includes('SOURCE-CITATION-UNVERIFIED:'));
});

test('WF211: scaffold quote absence and ambiguity require review, never a guessed current line', t => {
  const root = fixture(t, { 'src/guard.ts': '// TODO: inspect\n// TODO: inspect\n' });
  const finding = { findingId: 'finding-review', file: 'src/guard.ts', line: 1, type: 'MARKER', text: 'TODO: inspect' };
  const ambiguous = generateScaffoldCommand(finding, { repoRoot: root });
  assert.match(ambiguous, /SOURCE-CITATION-UNVERIFIED:/); assert.match(ambiguous, /ambiguous/);
  put(root, finding.file, 'export const current = true;');
  const absent = generateScaffoldCommand(finding, { repoRoot: root });
  assert.match(absent, /SOURCE-CITATION-UNVERIFIED:/); assert.match(absent, /missing/);
  assert.match(absent, /A removed marker or absent scan finding is not proof of completion/);
});

test('WF211: real scaffold CLI uses its supplied root and preserves source and stable finding identity', async t => {
  const root = fixture(t, { 'src/review.ts': '// TODO: inspect this local fixture\nexport const value = true;\n' });
  const methods = [], server = http.createServer((req, res) => {
    methods.push(req.method); res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/tasks' ? { tasks: [] } : { agents: [] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const execute = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, '--root', root, '--dir', path.join(root, 'src'), '--scaffold'], {
      env: { ...process.env, AGORA_URL: 'http://127.0.0.1:' + server.address().port }, windowsHide: true,
    });
    let output = ''; const timer = setTimeout(() => { child.kill(); reject(new Error('scaffold proof timed out')); }, 30000);
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolve({ code, output }); });
  });
  try {
    const file = path.join(root, 'src/review.ts'), original = fs.readFileSync(file, 'utf8');
    const first = await execute(); assert.equal(first.code, 0, first.output); assert.match(first.output, /SOURCE-CITATION:/);
    const payload = text => JSON.parse(text.match(/^SOURCE-CITATION: (.+)$/m)[1]);
    const before = payload(first.output); assert.equal(before.observedLine, 1); assert.equal(fs.readFileSync(file, 'utf8'), original);
    const shifted = '// tracked in Agora task agora-fixture\n' + original; fs.writeFileSync(file, shifted);
    const second = await execute(); assert.equal(second.code, 0, second.output); const after = payload(second.output);
    assert.equal(after.observedLine, 2); assert.equal(after.quote, before.quote); assert.equal(after.findingId, before.findingId);
    assert.equal(fs.readFileSync(file, 'utf8'), shifted); assert.ok(methods.length); assert.ok(methods.every(method => method === 'GET'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
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
