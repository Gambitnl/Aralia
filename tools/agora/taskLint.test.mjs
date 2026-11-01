// tools/agora/taskLint.test.mjs
// WF-G111 (tooling half): the pre-dispatch freshness check for a task body.
//
//   node --test tools/agora/taskLint.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import {
  extractBareFileNames,
  lintTask,
  extractPathTokens,
  extractTaskOwnershipPaths,
  extractDeclaredCreates,
  extractPlanmapStatusClaims,
  extractBacktickedIdentifiers,
  formatLintReport,
  defaultGrepSrc,
  defaultIgnoredPaths,
  isTestPath,
  defaultFindSplitCandidates,
  extractSchemaClaims,
  defaultGrepTypes,
  extractTypeFieldClaims,
  defaultCheckFileFields,
  REPO_ROOT,
  inspectSourceCitations,
  inspectSourceMembers,
} from './taskLint.mjs';

// WF294: an address existing somewhere is not proof that the named record owns it.
test('WF294: the historical wrong owner must not be a clean data task',()=>{
  const body='Review IB-0001 address https://github.com/ahujasid/blender-mcp in public/idea-board/records.json.';
  const report=lintTask({title:'Repair source identity',body},{fileExists:()=>true,ignoredPaths:()=>[],grepSrc:()=>true,basenameExists:()=>true,grepTypes:()=>[],checkFileFields:()=>[]});
  assert.equal(report.clean,false);assert.match(formatLintReport(report).join('\n'),/WF-G294/);
});

// WF267: spelling provenance is a separate obligation from an existing path.
test('WF267: an unsupported prescribed data value is not a clean task',()=>{
  const body='Add "timing": "each_caster_turn" (or the canonical "frequency") to public/data/spells/level-3/animate-dead.json effects[1].grantedActions[0].';
  const report=lintTask({id:'agora-provenance',title:'Repair cadence',body},{fileExists:()=>true,ignoredPaths:()=>[],grepSrc:()=>true,basenameExists:()=>true,grepTypes:()=>[],checkFileFields:()=>[]});
  assert.equal(report.clean,false);assert.match(formatLintReport(report).join('\n'),/WF-G267/);
});

test('WF-G285: lint needs complete board context and measured review, not a declared count command', () => {
  const task={id:'count-target',title:'Review sweep',body:'Review the current work.',refs:[],state:'open',createdAt:10,history:[]};
  const options={fileExists:()=>true,ignoredPaths:()=>[],grepSrc:()=>true,basenameExists:()=>true,findSplitCandidates:()=>[],grepTypes:()=>[],checkFileFields:()=>[]};
  assert.equal(lintTask(task,options).clean,true,'standalone pure lint has no board claim');
  for(const boardTasks of [[],null]){
    const report=lintTask(task,{...options,boardTasks,completeBoard:false});assert.equal(report.clean,false);
    assert.equal(report.referenceFreshness.status,'unavailable');assert.match(formatLintReport(report).join('\n'),/COUNTS UNVERIFIED.*unavailable/);
  }
  const source={id:'count-source',title:'Sibling',refs:['src/file.ts'],createdAt:1,state:'done',history:[{action:'state',state:'done',at:20}]};
  task.refs=['src/file.ts'];task.body+='\nCOUNT-SOURCE: node scripts/count.mjs';
  const report=lintTask(task,{...options,boardTasks:[task,source]});assert.equal(report.clean,false);assert.equal(report.referenceFreshness.status,'unverified');
});

// WF283: adjacent declarations cannot rescue a hand-transcribed wrong member.
const memberSource = 'export type Cultural = "shrine" | "garden";\nexport type Civic = "gatehouse";\nexport enum Phase { Ready = "idle", Busy = 2, Done }';
const memberClaim = { file: 'src/village.ts', symbol: 'Cultural', kind: 'string-union', quote: memberSource.split('\n')[0], members: ['shrine', 'garden'] };
const membersBody = value => 'REFERENCE-ONLY: SOURCE-MEMBERS: ' + JSON.stringify(value);
test('WF283: exact union and enum names pass; adjacent, missing and duplicate members fail', () => {
  const options = { readSource: () => memberSource };
  const check = value => inspectSourceMembers({ body: membersBody(value) }, options);
  assert.equal(check(memberClaim).issues.length, 0);
  for (const members of [['shrine', 'garden', 'gatehouse'], ['shrine'], ['shrine', 'garden', 'garden']]) assert.ok(check({ ...memberClaim, members }).issues.length);
  assert.match(check({ ...memberClaim, members: ['shrine', 'gatehouse'] }).issues[0].reason, /missing.*garden.*extra.*gatehouse/);
  const enumeration = { ...memberClaim, symbol: 'Phase', kind: 'enum', quote: memberSource.split('\n')[2], members: ['Done', 'Busy', 'Ready'] };
  assert.equal(check(enumeration).issues.length, 0, 'member equality is unordered; enum values are not member names');
  assert.ok(check({ ...enumeration, members: ['idle', '2', 'Done'] }).issues.length);
  assert.ok(check({ ...enumeration, kind: 'string-union' }).issues.length);
});
test('WF283: unavailable, stale, ambiguous, nested and unsupported declarations stay unresolved', () => {
  for (const source of [undefined, 'export type Cultural = "shrine";', memberSource + '\n' + memberClaim.quote, 'namespace N { ' + memberClaim.quote + ' }', 'export type Cultural = "shrine" | Civic;', 'export type Cultural<T> = "shrine" | "garden";', 'export type Cultural = ;', '\0', 'x'.repeat(2 * 1024 * 1024 + 1)]) {
    assert.ok(inspectSourceMembers({ body: membersBody(memberClaim) }, { readSource: () => source }).issues.length);
  }
  assert.ok(inspectSourceMembers({ body: membersBody({ ...memberClaim, quote: '"shrine"' }) }, { readSource: () => memberSource }).issues.length, 'quote must be the complete actual declaration, not an incidental literal');
  assert.ok(inspectSourceMembers({ body: membersBody({ ...memberClaim, file: '../outside.ts' }) }).issues.length);
  assert.ok(inspectSourceMembers({ body: membersBody({ ...memberClaim, members: ['shrine', 'garden'], permission: 'write' }) }).issues.length);
  assert.match(inspectSourceMembers({ body: 'SOURCE-MEMBERS: ' + 'x'.repeat(32769) }).issues[0].reason, /32768/);
  assert.match(inspectSourceMembers({ body: Array(33).fill('SOURCE-MEMBERS: invalid').join('\n') }).issues.at(-1).reason, /32/);
});
test('WF283: metadata never grants ownership and obvious unverified prose claims need review', () => {
  const task = { body: membersBody(memberClaim) }, options = { readSource: () => memberSource };
  assert.deepEqual(extractTaskOwnershipPaths(task), []);
  assert.ok(inspectSourceMembers({ body: task.body + '\n' + task.body }, options).issues.length);
  const legacy = { body: 'DO: Cultural union members in src/village.ts are `shrine`, `garden`, `gatehouse`.' };
  assert.match(inspectSourceMembers(legacy, options).issues[0].reason, /SOURCE-MEMBERS/);
  assert.equal(inspectSourceMembers({ body: 'SNAPSHOT: ' + legacy.body }, options).issues.length, 0);
  assert.equal(inspectSourceMembers({ body: 'SOURCE-MEMBERS-UNVERIFIED: ' + JSON.stringify({ file: 'src/village.ts', symbol: 'Cultural', reason: 'Source is unavailable.' }) }, options).issues.length, 1);
});

test('WF283: native lint result fails a declaration mismatch without global grep rescue', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-members-'));
  try {
    fs.mkdirSync(path.join(root, 'src')); fs.writeFileSync(path.join(root, memberClaim.file), memberSource);
    const options = { repoRoot: root, ignoredPaths: () => [], grepSrc: () => true, basenameExists: () => true };
    const good = lintTask({ body: membersBody(memberClaim) }, options);
    assert.equal(good.clean, true); assert.deepEqual(good.checkedIdentifiers, []);
    const bad = lintTask({ body: membersBody({ ...memberClaim, members: ['shrine', 'garden', 'gatehouse'] }) }, options);
    assert.equal(bad.clean, false); assert.match(formatLintReport(bad).join('\n'), /WF-G283.*|extra.*gatehouse/);
    assert.equal(fs.readFileSync(path.join(root, memberClaim.file), 'utf8'), memberSource);
  } finally { assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); assert.match(path.basename(root), /^agora-members-/); fs.rmSync(root, { recursive: true, force: true }); }
});

// WF307 detects sibling growth even when the old quote and symbol still match.
test('WF237: quoted wiring evidence does not invent identifiers or edit grants', () => {
  const body = 'REFERENCE-ONLY: ACTION-WIRING: '+JSON.stringify({roles:{handler:{file:'src/notAnEdit.ts',quote:'`imaginaryIdentifier` + src/alsoNotAnEdit.ts'}}});
  assert.deepEqual(extractTaskOwnershipPaths({body}),[]);
});

test('WF282: quoted union records grant no paths and inventory limits do not widen ordinary anchors', async () => {
  const { readCitationSource } = await import('./taskLint.mjs');
  const body='REFERENCE-ONLY: UNION-CHANGE: '+JSON.stringify({file:'src/notAnEdit.ts',quote:'`imaginaryIdentifier` + src/alsoNotAnEdit.ts'});
  assert.deepEqual(extractTaskOwnershipPaths({body}),[]);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-union-reader-'));
  try{
    fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src/large.ts'),'a'.repeat(2*1024*1024+1));
    assert.throws(()=>readCitationSource(root,'src/large.ts'),/2 MiB/);
    assert.equal(readCitationSource(root,'src/large.ts',{limitBytes:16*1024*1024}).length,2*1024*1024+1);
    for(const limitBytes of [0,Infinity,16*1024*1024+1])assert.throws(()=>readCitationSource(root,'src/large.ts',{limitBytes}),/invalid bounded/);
  }finally{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.match(path.basename(root),/^agora-union-reader-/);fs.rmSync(root,{recursive:true,force:true});}
});

test('WF307: legacy range replacement needs a review while dated evidence stays historical', async () => {
  const { inspectSourceReviews } = await import('./taskLint.mjs');
  assert.equal(inspectSourceReviews({ body: 'Replace src/attack.ts:12-25 with the shared command.' }).issues.length, 1);
  for (const prefix of ['SNAPSHOT', 'REFERENCE-ONLY', 'VERIFIED']) {
    assert.equal(inspectSourceReviews({ body: prefix + ': Replace src/attack.ts:12-25 with the shared command.' }).issues.length, 0);
  }
});

test('WF307: unchanged anchor and old symbol do not clear a changed replacement block', async () => {
  const api = await import('./taskLint.mjs');
  const initial = '// BEGIN ATTACK\nbaseAttack();\n// END ATTACK';
  let source = initial;
  const input = { id: 'attack-v1', file: 'src/attack.ts', start: '// BEGIN ATTACK', end: '// END ATTACK', symbols: ['baseAttack'], reason: 'Reviewed attack preservation boundary.' };
  const options = { readSource: () => source };
  const first = api.captureSourceReview(input, options);
  const body = 'SOURCE-CITATION: ' + JSON.stringify({ file: input.file, quote: 'baseAttack();' }) + '\nSYMBOL-CHECK: ' + JSON.stringify({ file: input.file, symbol: 'baseAttack', expect: 'present' }) + '\nSOURCE-REVIEW: ' + JSON.stringify(first);
  assert.equal(api.inspectSourceReviews({ body }, options).issues.length, 0);
  source = source.replace('baseAttack();', 'baseAttack();\nsiblingRider();');
  assert.equal(api.inspectSourceCitations({ body }, options).issues.length, 0);
  assert.equal(api.inspectSymbolChecks({ body }, options).issues.length, 0);
  assert.match(api.inspectSourceReviews({ body }, options).issues[0].reason, /changed.*reconcile/);
  const second = api.captureSourceReview({ ...input, id: 'attack-v2', supersedes: first.id, symbols: ['baseAttack', 'siblingRider'], reason: 'Sibling rider now exists; preserve its behavior when replacing the attack block.' }, options);
  const after = body + '\nSOURCE-REVIEW: ' + JSON.stringify(second);
  const report = api.inspectSourceReviews({ body: after }, options);
  assert.equal(report.issues.length, 0); assert.deepEqual(report.active[0].symbols, ['baseAttack', 'siblingRider']); assert.ok(after.startsWith(body));
  assert.deepEqual(extractTaskOwnershipPaths({ body: after }), []);
});

test('WF307: review chains, boundaries, metadata and source availability fail closed', async () => {
  const api = await import('./taskLint.mjs'), source = '// BEGIN\nbaseAttack();\n// END';
  const input = { id: 'review-v1', file: 'src/one.ts', start: '// BEGIN', end: '// END', symbols: ['baseAttack'], reason: 'Preserve the reviewed current attack.' };
  const options = { readSource: () => source };
  for (const invalid of [{ ...input, file: 'one.ts' }, { ...input, start: input.end }, { ...input, symbols: [] }, { ...input, symbols: ['baseAttack', 'baseAttack'] },
    { ...input, symbols: ['invented'] }, { ...input, symbols: Array(65).fill('baseAttack') }, { ...input, reason: 'TBD' }, { ...input, sha256: 'invented' }]) assert.throws(() => api.captureSourceReview(invalid, options));
  for (const readSource of [() => { throw new Error('unavailable'); }, () => undefined, () => source + source, () => '// END\nbaseAttack();\n// BEGIN', () => '// BEGIN\n' + 'x'.repeat(65536) + '\n// END']) assert.throws(() => api.captureSourceReview(input, { readSource }));
  const first = api.captureSourceReview(input, options), line = value => 'SOURCE-REVIEW: ' + JSON.stringify(value);
  for (const invalid of [{ ...first, observedAt: '2026-02-30T00:00:00.000Z' }, { ...first, observedAt: '2999-01-01T00:00:00.000Z' },
    { ...first, sha256: 'x' }, { ...first, extra: 'not supported' }, { ...first, supersedes: 'unknown' }]) assert.ok(api.inspectSourceReviews({ body: line(invalid) }, options).issues.length);
  assert.ok(api.inspectSourceReviews({ body: line(first) + '\n' + line(first) }, options).issues.length);
  const unlinked = { ...first, id: 'review-v2' }; assert.match(api.inspectSourceReviews({ body: line(first) + '\n' + line(unlinked) }, options).issues[0].reason, /supersede/);
  assert.match(api.inspectSourceReviews({ body: 'SOURCE-REVIEW: ' + 'x'.repeat(8193) }, options).issues[0].reason, /8192/);
  assert.match(api.inspectSourceReviews({ body: Array(33).fill('SOURCE-REVIEW: invalid').join('\n') }, options).issues.at(-1).reason, /more than 32/);
  assert.equal(api.inspectSourceReviews({ body: 'SNAPSHOT: ' + line(first) }, options).declarations.length, 0);
});

// WF272 binds each authored symbol premise to its exact file, not a global hit.
test('WF272: a global hit cannot rescue a wrong-file premise or an already-present field', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-symbol-'));
  try {
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src/consumer.ts'), 'export const consume = action.cost.movementCost;\n');
    fs.writeFileSync(path.join(root, 'src/movement.ts'), 'export function findPath() {}\n');
    fs.writeFileSync(path.join(root, 'src/character.ts'), 'interface PlayerCharacter { subclassId?: string; }\n');
    const task = { body: 'SYMBOL-CHECK: ' + JSON.stringify({ file: 'src/consumer.ts', symbol: 'findPath', expect: 'present' }) };
    const report = lintTask(task, { repoRoot: root, ignoredPaths: () => new Set(), grepSrc: () => true });
    assert.equal(report.clean, false); assert.match(formatLintReport(report).join('\n'), /WF-G272.*|SYMBOL PREMISES/);
    const { inspectSymbolChecks } = await import('./taskLint.mjs');
    assert.match(report.symbolChecks.issues[0].reason, /expected present.*absent/);
    const check = value => inspectSymbolChecks({ body: 'SYMBOL-CHECK: ' + JSON.stringify(value) }, { repoRoot: root });
    assert.equal(check({ file: 'src/movement.ts', symbol: 'findPath', expect: 'present' }).issues.length, 0);
    assert.match(check({ file: 'src/character.ts', symbol: 'subclassId', expect: 'absent' }).issues[0].reason, /expected absent.*present/);
    assert.equal(check({ file: 'src/consumer.ts', symbol: 'findPath', expect: 'absent' }).issues.length, 0);
  } finally { assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
});

test('WF272: literal whole identifiers are case sensitive, bounded and explicitly not semantic proof', async () => {
  const { inspectSymbolChecks } = await import('./taskLint.mjs');
  const declaration = { file: 'src/one.ts', symbol: 'findPath', expect: 'present' };
  const task = value => ({ body: 'SYMBOL-CHECK: ' + JSON.stringify(value) });
  assert.ok(inspectSymbolChecks(task(declaration), { readSource: () => 'refindPath findPathExtra FindPath findPath\u00e9' }).issues.length);
  assert.deepEqual(inspectSymbolChecks(task(declaration), { readSource: () => '// findPath\r\n"findPath"' }).resolved[0].lines, [1, 2], 'comments and strings match; this is deliberately not a declaration/call parser');
  assert.equal(inspectSymbolChecks(task({ ...declaration, symbol: '$field' }), { readSource: () => '$field' }).issues.length, 0);
  for (const invalid of [{ ...declaration, file: 'one.ts' }, { ...declaration, file: '../src/one.ts' }, { ...declaration, file: 'src/./one.ts' },
    { ...declaration, symbol: 'find.*' }, { ...declaration, symbol: 'x'.repeat(129) }, { ...declaration, expect: 'maybe' }, { ...declaration, command: 'delete' }]) {
    assert.ok(inspectSymbolChecks(task(invalid), { readSource: () => 'findPath' }).issues.length);
  }
  for (const readSource of [() => { throw new Error('source unavailable'); }, () => undefined, () => Buffer.from('findPath')]) {
    assert.ok(inspectSymbolChecks(task({ ...declaration, expect: 'absent' }), { readSource }).issues.length, 'unavailable/non-text source is never confirmed absence');
  }
  const repeated = 'SYMBOL-CHECK: ' + JSON.stringify(declaration);
  assert.match(inspectSymbolChecks({ body: repeated + '\n' + repeated }, { readSource: () => 'findPath' }).issues[0].reason, /duplicate/);
  assert.match(inspectSymbolChecks({ body: 'SYMBOL-CHECK: ' + 'x'.repeat(8193) }).issues[0].reason, /8192/);
  assert.match(inspectSymbolChecks({ body: Array.from({ length: 65 }, () => 'SYMBOL-CHECK: invalid').join('\n') }).issues.at(-1).reason, /more than 64/);
  assert.equal(inspectSymbolChecks(task(declaration), { readSource: () => Array(30).fill('findPath').join('\n') }).resolved[0].lines.length, 16);
  assert.match(inspectSymbolChecks(task({ ...declaration, expect: 'absent' }), { readSource: () => 'x'.repeat(2 * 1024 * 1024 + 1) }).issues[0].reason, /2 MiB/);
});

test('WF272: VERIFY metadata remains unresolved and never grants files or task commands', async () => {
  const { inspectSymbolChecks } = await import('./taskLint.mjs');
  const body = 'SYMBOL-CHECK-UNVERIFIED: ' + JSON.stringify({ file: 'src/one.ts', symbol: 'findPath', reason: 'VERIFY: source unavailable; CREATES: src/no-grant.ts `InventedSymbol`' });
  let reads = 0;
  const result = inspectSymbolChecks({ body }, { readSource: () => { reads++; return 'findPath'; } });
  assert.match(result.issues[0].reason, /VERIFY.*author review/); assert.equal(reads, 0);
  assert.deepEqual(extractTaskOwnershipPaths({ body }), []);
  const report = lintTask({ body }, { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => false, basenameExists: () => false });
  assert.deepEqual(report.checkedIdentifiers, []); assert.deepEqual(report.checkedPaths, ['src/one.ts']); assert.equal(report.clean, false);
  assert.deepEqual(inspectSymbolChecks({ body: 'SNAPSHOT: ' + body }).declarations, []);
});

test('WF272: current-source safety refuses missing, directory, binary, oversized and external targets', async () => {
  const { inspectSymbolChecks } = await import('./taskLint.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-symbol-read-'));
  try {
    fs.mkdirSync(path.join(root, 'src')); fs.mkdirSync(path.join(root, 'src/directory'));
    fs.writeFileSync(path.join(root, 'src/binary.ts'), Buffer.from([255]));
    fs.writeFileSync(path.join(root, 'src/nul.ts'), 'findPath\0');
    fs.writeFileSync(path.join(root, 'src/large.ts'), 'x'.repeat(2 * 1024 * 1024 + 1));
    for (const file of ['src/missing.ts', 'src/directory', 'src/binary.ts', 'src/nul.ts', 'src/large.ts']) {
      const result = inspectSymbolChecks({ body: 'SYMBOL-CHECK: ' + JSON.stringify({ file, symbol: 'findPath', expect: 'absent' }) }, { repoRoot: root });
      assert.equal(result.resolved.length, 0); assert.ok(result.issues.length, file);
    }
    // Windows directory junctions are available without symlink privileges.
    fs.symlinkSync(os.tmpdir(), path.join(root, 'src/outside'), 'junction');
    const escaped = inspectSymbolChecks({ body: 'SYMBOL-CHECK: ' + JSON.stringify({ file: 'src/outside', symbol: 'findPath', expect: 'absent' }) }, { repoRoot: root });
    assert.match(escaped.issues[0].reason, /outside the repository/);
  } finally { assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
});

// WF211 uses source bytes as location evidence, never old line-number authority.
test('WF325: original one-hit acceptance contradicts a deduplication goal and cannot lint clean', () => {
  const task = { title: 'One status-icon function, not two', body: 'ACCEPTANCE: grep -rn "case \'dot\':" src/ returns ONE hit.' };
  const report = lintTask(task, { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => true });
  assert.equal(report.clean, false);
  assert.match(formatLintReport(report).join('\n'), /WF-G325.*DEDUP-ACCEPTANCE|DEDUP-ACCEPTANCE.*WF-G325/);
});

test('WF325: labeled acceptance rejects role contradictions, omissions, ambiguity and malformed metadata', async () => {
  const { inspectDedupAcceptance } = await import('./taskLint.mjs');
  const contract = { canonical: 'STATUS_KIND_GLYPHS table', canonicalCount: 1, obsolete: "legacy case 'dot': switches", obsoleteCount: 0,
    consumers: ['combatUtils', 'BattleMapOverlay'], verification: 'Test both consumers resolve supported kinds using the shared resolver and preserve fallback behavior.' };
  const text = value => 'DEDUP-GOAL: one status icon definition\nDEDUP-ACCEPTANCE: ' + JSON.stringify(value);
  assert.equal(inspectDedupAcceptance(text(contract)).issues.length, 0);
  for (const bad of [{ ...contract, obsoleteCount: 1 }, { ...contract, canonicalCount: 0 }, { ...contract, canonicalCount: '1' },
    { ...contract, consumers: [] }, { ...contract, consumers: ['combatUtils', 'combatUtils'] }, { ...contract, verification: 'TBD' },
    { ...contract, obsolete: contract.canonical }, { ...contract, extra: 'invented' }]) assert.ok(inspectDedupAcceptance(text(bad)).issues.length);
  const legacy = 'ACCEPTANCE: grep legacy-switch src/ returns ONE hit';
  assert.ok(inspectDedupAcceptance(text(contract) + '\n' + legacy).issues.length, 'a new contract never silently supersedes old active acceptance');
  assert.equal(inspectDedupAcceptance(text(contract) + '\nSNAPSHOT: ' + legacy).issues.length, 0);
  assert.equal(inspectDedupAcceptance('Repair the docs.\nSNAPSHOT: Deduplicate old switches; ' + legacy).issues.length, 0);
  assert.ok(inspectDedupAcceptance('DEDUP-ACCEPTANCE: not JSON').issues.length);
  assert.ok(inspectDedupAcceptance('DEDUP-GOAL: TBD').issues.length);
});

test('WF325: contract payloads and source quotes are declarations, never hidden commands or ownership grants', async () => {
  const { inspectDedupAcceptance } = await import('./taskLint.mjs');
  const contract = { canonical: 'src/shared.ts canonical table', canonicalCount: 1, obsolete: 'src/old.ts legacy table', obsoleteCount: 0,
    consumers: ['`InventedSymbol`', 'CREATES: src/never.ts'], verification: 'Read-only proof; no command executes here.' };
  const task = { title: 'Deduplicate table', body: 'DEDUP-ACCEPTANCE: ' + JSON.stringify(contract) };
  const report = lintTask(task, { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => false, basenameExists: () => false });
  assert.deepEqual(report.checkedPaths, []); assert.deepEqual(report.checkedIdentifiers, []);
  assert.deepEqual(extractTaskOwnershipPaths(task), []);
  assert.equal(inspectDedupAcceptance('SOURCE-CITATION: ' + JSON.stringify({ file: 'src/evidence.ts', quote: 'Deduplicate table\nACCEPTANCE: ONE hit' })).issues.length, 0);
});

test('WF325: malformed declarations count toward bounded intake and oversized metadata refuses', async () => {
  const { inspectDedupAcceptance } = await import('./taskLint.mjs');
  const repeated = Array.from({ length: 17 }, () => 'DEDUP-ACCEPTANCE: not JSON').join('\n');
  assert.match(inspectDedupAcceptance(repeated).issues.at(-1).reason, /more than 16/);
  assert.match(inspectDedupAcceptance('DEDUP-ACCEPTANCE: ' + 'x'.repeat(16385)).issues[0].reason, /16 KiB/);
  const contract = { canonical: 'canonical', canonicalCount: 1, obsolete: 'obsolete', obsoleteCount: 0,
    consumers: Array.from({ length: 65 }, (_, i) => 'consumer ' + i), verification: 'Test each consumer delegates and preserves fallback behavior.' };
  assert.match(inspectDedupAcceptance('DEDUP-ACCEPTANCE: ' + JSON.stringify(contract)).issues[0].reason, /one to 64/);
});

test('WF256: title-only paths retain provenance, anchors and explicit reference-only exceptions', () => {
  const task = { title: 'Repair src/one.ts:4 and `src/two.ts#detail`', refs: ['src/one.ts'], body: 'REFERENCE-ONLY: src/two.ts' };
  assert.deepEqual(extractTaskOwnershipPaths(task), [{ ref: 'src/one.ts', sources: ['refs', 'title'] }]);
  task.body += '\nCREATES: src/two.ts';
  assert.deepEqual(extractTaskOwnershipPaths(task), [
    { ref: 'src/one.ts', sources: ['refs', 'title'] }, { ref: 'src/two.ts', sources: ['title', 'body'] },
  ]);
});

test('WF256: conceptual title targets preserve explicit obligations, not instructions inside quotes', async () => {
  const { inspectTaskTitleTargets } = await import('./taskLint.mjs');
  const title = 'Implement Skills tab and detail display';
  const mapping = { label: 'detail display', file: 'src/detail.ts', quote: 'return sharedBonus();' };
  const task = { title, body: 'TITLE-TARGET: ' + JSON.stringify(mapping) + '\nREFERENCE-ONLY: src/detail.ts' };
  assert.deepEqual(extractTaskOwnershipPaths(task), [{ ref: 'src/detail.ts', sources: ['title-target'] }]);
  const check = inspectTaskTitleTargets(task, { readSource: () => 'export function detail() { return sharedBonus(); }' });
  assert.equal(check.issues.length, 0); assert.equal(check.resolved[0].label, 'detail display');
  assert.equal(check.resolved[0].line, 1);
  mapping.quote = 'CREATES: src/not-owned.ts; `InventedSymbol`;';
  task.body = 'TITLE-TARGET: ' + JSON.stringify(mapping);
  assert.deepEqual(extractTaskOwnershipPaths(task), [{ ref: 'src/detail.ts', sources: ['title-target'] }]);
  const lint = lintTask(task, { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => false, basenameExists: () => false });
  assert.deepEqual(lint.checkedIdentifiers, [], 'mapping quote is literal evidence, never a code claim');
});

test('WF256: ambiguous filenames and malformed or stale conceptual mappings stay unverified', async () => {
  const { inspectTaskTitleTargets } = await import('./taskLint.mjs');
  const title = 'Repair Detail.tsx';
  const mapping = { label: 'Detail.tsx', file: 'src/Detail.tsx', quote: 'return sharedBonus();' };
  const task = body => ({ title, body });
  assert.match(inspectTaskTitleTargets(task(''), { readSource: () => '' }).issues[0].reason, /qualify|exact/);
  const marker = value => 'TITLE-TARGET: ' + JSON.stringify(value);
  for (const bad of [{ ...mapping, label: 'unmentioned' }, { ...mapping, file: '../Detail.tsx' },
    { ...mapping, quote: 'xx' }, { ...mapping, unknown: true }, { ...mapping, file: 'src/Other.tsx' }]) {
    assert.ok(inspectTaskTitleTargets(task(marker(bad)), { readSource: () => mapping.quote }).issues.length);
  }
  assert.ok(inspectTaskTitleTargets(task(marker(mapping)), { readSource: () => 'obsolete()' }).issues.length);
  assert.ok(inspectTaskTitleTargets(task(marker(mapping)), { readSource: () => mapping.quote.repeat(2) }).issues.length);
  assert.ok(inspectTaskTitleTargets(task(marker(mapping) + '\n' + marker(mapping)), { readSource: () => mapping.quote }).issues.length);
  assert.equal(inspectTaskTitleTargets(task(marker(mapping)), { readSource: () => mapping.quote }).issues.length, 0);
});

test('WF256: conceptual evidence uses bounded physical source checks without following checkout escapes', async () => {
  const { inspectTaskTitleTargets } = await import('./taskLint.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-title-bounds-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-title-outside-'));
  try {
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(outside, 'view.ts'), 'export const View = true;');
    fs.symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const target = { label: 'view', file: 'linked/view.ts', quote: 'export const View = true;' };
    const task = { title: 'Repair view', body: 'TITLE-TARGET: ' + JSON.stringify(target) };
    assert.match(inspectTaskTitleTargets(task, { repoRoot: root }).issues[0].reason, /outside/);
    target.file = 'src/large.ts'; fs.writeFileSync(path.join(root, 'src/large.ts'), 'x'.repeat(2 * 1024 * 1024 + 1));
    task.body = 'TITLE-TARGET: ' + JSON.stringify(target);
    assert.match(inspectTaskTitleTargets(task, { repoRoot: root }).issues[0].reason, /2 MiB/);
    task.body = 'TITLE-TARGET: ' + JSON.stringify({ ...target, quote: 'q'.repeat(2049) });
    assert.match(inspectTaskTitleTargets(task, { repoRoot: root }).issues[0].reason, /2048/);
    task.body = 'TITLE-TARGET: ' + 'x'.repeat(8193);
    assert.match(inspectTaskTitleTargets(task, { repoRoot: root }).issues[0].reason, /8192/);
    task.body = Array.from({ length: 65 }, () => 'TITLE-TARGET: {}').join('\n');
    assert.ok(inspectTaskTitleTargets(task, { repoRoot: root }).issues.some(item => /64/.test(item.reason)));
  } finally {
    fs.unlinkSync(path.join(root, 'linked'));
    for (const file of [root, outside]) { assert.equal(path.dirname(file), fs.realpathSync(os.tmpdir())); fs.rmSync(file, { recursive: true, force: true }); }
  }
});

test('WF211: a quoted source citation survives a tracking comment before its target', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-citation-'));
  try {
    fs.mkdirSync(path.join(root, 'src'));
    const file = 'src/guard.ts', source = 'export function guard(token) {\n  if (!known.has(token)) return false;\n}\n';
    fs.writeFileSync(path.join(root, file), source);
    const task = { body: 'SOURCE-CITATION: ' + JSON.stringify({ file, quote: 'if (!known.has(token)) return false;', observedLine: 2 }) };
    const options = { repoRoot: root, fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => true };
    const before = lintTask(task, options); assert.equal(before.sourceCitations?.resolved[0]?.line, 2);
    fs.writeFileSync(path.join(root, file), '// tracked in Agora task agora-fixture\n' + source);
    const after = lintTask(task, options); assert.equal(after.clean, true); assert.equal(after.sourceCitations.resolved[0].line, 3);
    assert.equal(after.sourceCitations.resolved[0].observedLine, 2, 'intake hint remains history, not a rewritten task');
    assert.match(formatLintReport(after).join('\n'), /SOURCE CITATIONS.*WF-G211/);
  } finally { assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
});

test('WF211: missing, ambiguous, malformed and explicitly unverified citations never look resolved', () => {
  const valid = { file: 'src/guard.ts', quote: 'return false;', observedLine: 4 };
  const body = value => 'SOURCE-CITATION: ' + JSON.stringify(value);
  for (const [value, source, reason] of [
    [valid, 'return true;', /missing/], [valid, 'return false; return false;', /ambiguous/],
    [{ ...valid, quote: '   ' }, '', /quote/], [{ ...valid, quote: 'x'.repeat(2049) }, '', /2048/],
    [{ ...valid, observedLine: 0 }, '', /positive/], [{ ...valid, owner: 'invented' }, '', /unsupported/],
    [{ ...valid, file: '../private.ts' }, '', /relative/], [{ ...valid, file: 'src/../private.ts' }, '', /relative/],
    [{ ...valid, file: 'F:/private.ts' }, '', /relative/], [{ ...valid, file: 'src/*.ts' }, '', /relative/],
  ]) {
    const report = inspectSourceCitations({ body: body(value) }, { readSource: () => source });
    assert.equal(report.resolved.length, 0); assert.match(report.issues[0].reason, reason);
  }
  assert.match(inspectSourceCitations({ body: 'SOURCE-CITATION: not JSON' }).issues[0].reason, /JSON|Unexpected/);
  const pending = 'SOURCE-CITATION-UNVERIFIED: ' + JSON.stringify({ file: valid.file, reason: 'source unavailable' });
  const result = lintTask({ body: pending }, { fileExists: () => true, ignoredPaths: () => new Set(), basenameExists: () => true });
  assert.equal(result.clean, false); assert.match(formatLintReport(result).join('\n'), /author review required/);
});

test('WF211: literal quotes are not CREATE, count, identifier or ownership instructions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-citation-'));
  try {
    fs.mkdirSync(path.join(root, 'src')); const file = 'src/guard.ts';
    const quote = 'CREATES: src/not-real.ts\n42 files remain; set Plan Map status to blocked; `InventedIdentifier`';
    fs.writeFileSync(path.join(root, file), quote.replace(/\n/g, '\r\n'));
    const task = { body: 'REFERENCE-ONLY: SOURCE-CITATION: ' + JSON.stringify({ file, quote }) };
    const report = lintTask(task, { repoRoot: root, ignoredPaths: () => new Set(), basenameExists: () => true });
    assert.equal(report.clean, true); assert.deepEqual(report.checkedPaths, [file]); assert.deepEqual(report.checkedIdentifiers, []);
    assert.deepEqual(report.declaredCreates, []); assert.equal(report.sourceCitations.resolved[0].line, 1);
    assert.deepEqual(extractTaskOwnershipPaths(task, { repoRoot: root }), []);
    assert.deepEqual(extractTaskOwnershipPaths({ ...task, refs: [file] }, { repoRoot: root }), [{ ref: file, sources: ['refs'] }]);
  } finally { assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
});

test('WF211: legacy bare lines stay advisory and historical snapshots do not masquerade as current anchors', () => {
  const task = { body: 'Edit src/guard.ts:12 after reading current code.\nSNAPSHOT: src/guard.ts:1 old code\nEVIDENCE: src/guard.ts:2 old run' };
  const report = lintTask(task, { fileExists: () => true, ignoredPaths: () => new Set(), basenameExists: () => true });
  assert.equal(report.clean, true); assert.equal(report.unanchoredCitations.length, 1);
  assert.match(formatLintReport(report).join('\n'), /LINE-ONLY CITATION REVIEW/);
});

test('WF211: physical escapes, large files, binary and invalid UTF-8 source remain unverified', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-citation-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-citation-outside-'));
  try {
    fs.mkdirSync(path.join(root, 'src')); fs.writeFileSync(path.join(outside, 'guard.ts'), 'return false;');
    fs.symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    fs.writeFileSync(path.join(root, 'src/large.ts'), 'x'.repeat(2 * 1024 * 1024 + 1));
    fs.writeFileSync(path.join(root, 'src/binary.ts'), 'return false;\0');
    fs.writeFileSync(path.join(root, 'src/invalid.ts'), Buffer.from([0xff, 0xfe]));
    for (const [file, reason] of [['linked/guard.ts', /outside/], ['src/large.ts', /limit/], ['src/binary.ts', /text/], ['src/invalid.ts', /encoded|encoding/i], ['src/missing.ts', /ENOENT/]]) {
      const report = inspectSourceCitations({ body: 'SOURCE-CITATION: ' + JSON.stringify({ file, quote: 'return false;' }) }, { repoRoot: root });
      assert.equal(report.resolved.length, 0); assert.match(report.issues[0].reason, reason);
    }
  } finally {
    fs.unlinkSync(path.join(root, 'linked')); assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); assert.equal(path.dirname(outside), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('WF211: bounded declarations expose partial coverage rather than passing unchecked evidence', () => {
  const citation = 'SOURCE-CITATION: ' + JSON.stringify({ file: 'src/guard.ts', quote: 'return false;' }); let reads = 0;
  const report = inspectSourceCitations({ body: Array(65).fill(citation).join('\n') }, { readSource: () => { reads++; return 'return false;'; } });
  assert.equal(reads, 64); assert.equal(report.resolved.length, 64); assert.equal(report.checked, 64);
  assert.match(report.issues[0].reason, /remaining evidence unchecked/);
});

test('WF-G288: explicit roadmap assignments use topic and feature schema enums', () => {
  const schema = { properties: { topics: { items: { properties: {
    status: { enum: ['active', 'done'] },
    features: { items: { properties: { status: { enum: ['active', 'built'] } } } },
  } } } } };
  const options = { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true,
    basenameExists: () => true, planmapSchema: () => schema };
  const task = { refs: ['planmap:example'], body: [
    '3. Either set status to blocked with a status_note naming the dead consumer, or set it to superseded.',
    'Set Plan Map feature status to done.',
    'PLANMAP-STATUS: feature built',
    'node tools/agora/planmap-add.mjs --topic example --status=blocked',
  ].join('\n') };
  const result = lintTask(task, options);
  assert.equal(result.clean, false);
  assert.deepEqual(result.invalidPlanmapStatuses.map(x => [x.status, x.kind, x.line]), [
    ['blocked', 'topic', 2], ['done', 'feature', 3], ['blocked', 'topic', 5],
  ]);
  assert.deepEqual(result.invalidPlanmapStatuses[1].allowed, ['active', 'built']);
  assert.match(formatLintReport(result).join('\n'), /INVALID PLAN MAP STATUS.*WF-G288/);
  assert.match(formatLintReport(result).join('\n'), /No record was rewritten/);
  assert.match(formatLintReport(result).join('\n'), /status_note/);
  assert.throws(() => lintTask(task, { ...options, planmapSchema: () => ({}) }), /enum is missing/);
});

test('WF-G288: blocked tasks, negation and labeled historical evidence are not roadmap assignments', () => {
  const task = { refs: ['planmap:example'], body: [
    'Set Agora task status to blocked; Plan Map remains active.',
    'Do not set Plan Map status to blocked.',
    'Never mark Plan Map feature as blocked.',
    'EVIDENCE: the old task said set Plan Map status to blocked.',
    'KNOWN-INVALID: node tools/agora/planmap-add.mjs --status blocked',
    'A blocked state is not a Plan Map status. The task needs review.',
  ].join('\n') };
  assert.deepEqual(extractPlanmapStatusClaims(task), []);
  assert.deepEqual(extractPlanmapStatusClaims({ body: 'Set task status to blocked.' }), []);
  assert.deepEqual(extractPlanmapStatusClaims({ body: 'Set status to blocked.' }), []);
});

test('WF-G288: canonical vocabulary accepts all current statuses and reports unsupported prose assignments', () => {
  const body = ['parked', 'specced', 'active', 'done', 'superseded'].map(status =>
    `Set Plan Map status to ${status}.`).join('\n');
  const options = { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => true };
  assert.equal(lintTask({ body }, options).clean, true);
  const task = { body: 'Mark Plan Map feature as planned. Update Plan Map topic status: BLOCKED.' };
  const result = lintTask(task, options);
  assert.deepEqual(result.invalidPlanmapStatuses.map(x => x.status), ['planned', 'BLOCKED']);
  assert.deepEqual(result.invalidPlanmapStatuses[0].allowed, ['parked', 'specced', 'active', 'done', 'superseded']);
});

test('ownership paths combine refs and body without losing their origin or line anchors', () => {
  const task = { refs: ['src/feature.ts#build', 'planmap:feature'], body: [
    'Edit `F:\\Repos\\Aralia\\src\\feature.ts:12:4` and src/new.ts:9.',
    'Read https://example.com/src/external.ts; workflow:WF-G265 is not a file.',
  ].join('\n') };
  const expected = [
    { ref: 'src/feature.ts', sources: ['refs', 'body'] },
    { ref: 'src/new.ts', sources: ['body'] },
  ];
  for (let index = 0; index < 3; index++) {
    assert.deepEqual(extractTaskOwnershipPaths(task, { repoRoot: 'F:/Repos/Aralia' }), expected);
  }
});

test('reference and absence declarations exempt evidence, but never override an explicit edit', () => {
  const task = { refs: ['docs/evidence.md', 'src/old.ts', 'src/new.ts'], body: [
    'REFERENCE-ONLY: docs/evidence.md',
    'EXPECTED-ABSENT: src/ghost.ts',
    'ABSENT: src/old.ts src/new.ts',
    'DELETES: src/old.ts',
    'CREATES: src/new.ts',
    'Edit src/current.ts.',
  ].join('\n') };
  assert.deepEqual(extractTaskOwnershipPaths(task), [
    { ref: 'src/old.ts', sources: ['refs', 'body'] },
    { ref: 'src/new.ts', sources: ['refs', 'body'] },
    { ref: 'src/current.ts', sources: ['body'] },
  ]);
});

test('WF-G351: only complete creation marker words declare future files', () => {
  // Completion facts and similar words must not become overwrite instructions.
  for (const marker of ['CREATED', 'CREATED FILE', 'CREATED (verified)', 'CREATION',
    'CREATESuffix', 'CREATE_OTHER', 'NEW FILESnapshot', 'NEW FILES_extra']) {
    for (let repeat = 0; repeat < 3; repeat++) {
      assert.deepEqual(extractDeclaredCreates(`> - ${marker}: src/present.ts\r\n`), [], marker);
    }
  }
  for (const marker of ['CREATE', 'CREATES', 'NEW FILE', 'NEW FILES',
    'creates (reviewed new file)', 'CREATE - owner assigned', 'NEW FILES [explicit intent]']) {
    for (let repeat = 0; repeat < 3; repeat++) {
      assert.deepEqual(extractDeclaredCreates(`> - ${marker}: src/new.ts, src/other.ts\r\n`),
        ['src/new.ts', 'src/other.ts'], marker);
    }
  }
});

test('WF-G351: completed creation facts retain ordinary freshness and ownership checks', () => {
  const options = { fileExists: file => file === 'src/present.ts', ignoredPaths: () => new Set(),
    grepSrc: () => true, basenameExists: () => true };
  const task = { refs: ['src/present.ts'], body: 'CREATED: src/present.ts\nCREATED FILE: src/present.ts' };
  const result = lintTask(task, options);
  assert.equal(result.clean, true);
  assert.deepEqual(result.staleCreates, []); assert.deepEqual(result.newPaths, []);
  assert.deepEqual(extractTaskOwnershipPaths(task), [{ ref: 'src/present.ts', sources: ['refs', 'body'] }]);
  const missing = lintTask({ body: 'CREATED: src/missing.ts' }, options);
  assert.equal(missing.clean, false);
  assert.deepEqual(missing.missingPaths, ['src/missing.ts']);
  assert.deepEqual(missing.newPaths, [], 'past-tense wording never exempts an absent path');
});

test('WF-G351: genuine annotated creation, absence and explicit edit safeguards remain intact', () => {
  const options = { fileExists: file => file === 'src/present.ts', ignoredPaths: () => new Set(),
    grepSrc: () => true, basenameExists: () => true };
  const result = lintTask({ body: 'CREATED: src/present.ts\nCREATES (new): src/new.ts src/present.ts\nABSENT: src/present.ts' }, options);
  assert.equal(result.clean, false);
  assert.deepEqual(result.newPaths, ['src/new.ts']);
  assert.deepEqual(result.staleCreates, ['src/present.ts']);
  assert.deepEqual(result.presentDespiteAbsent, ['src/present.ts']);
  assert.match(formatLintReport(result).join('\n'), /STALE CREATES/);
  assert.deepEqual(extractTaskOwnershipPaths({ body:
    'REFERENCE-ONLY: src/new.ts\nCREATES: src/new.ts\nCREATED: src/present.ts' }), [
    { ref: 'src/new.ts', sources: ['body'] }, { ref: 'src/present.ts', sources: ['body'] },
  ], 'a real creation still requires ownership; past-tense facts grant nothing');
});

test('extractPathTokens finds repo paths and ignores refs, globs and prose', () => {
  const text = [
    'Split `src/components/Crafting/SalvageModal.tsx` and see docs/projects/GLOBAL_GAPS.md,',
    'per planmap:crafting/salvage and https://example.com/a/b.',
    'Sweep src/systems/**/*.ts and tools/agora for the rest.',
    'The old directory is src/components/BattleMap3D/; the Windows spelling is src\\hooks\\combat\\useBattleMap.ts.',
    'A ratio of 3/4 is not a path.',
  ].join('\n');
  const found = extractPathTokens(text);
  assert.ok(found.includes('src/components/Crafting/SalvageModal.tsx'));
  assert.ok(found.includes('docs/projects/GLOBAL_GAPS.md'));
  assert.ok(found.includes('tools/agora'));
  assert.ok(found.includes('src/components/BattleMap3D'));
  assert.ok(found.includes('src/hooks/combat/useBattleMap.ts'));
  assert.ok(!found.some((t) => t.startsWith('planmap:')), 'a scheme-prefixed ref is not a path');
  assert.ok(!found.some((t) => t.startsWith('https:')), 'a URL is not a path');
  assert.ok(!found.includes('src/systems/**/*.ts'), 'a glob is not a path');
  assert.ok(!found.includes('3/4'), 'a ratio is not a path');
});

test('WF-G350: quoted external Windows paths never become checkout fragments', () => {
  for (const quote of ['"', "'", '`']) {
    for (const host of ['D:/Program Files/Git/bin/bash.exe', 'D:\\Program Files\\Git\\bin\\bash.exe']) {
      assert.deepEqual(extractPathTokens(`Use ${quote}${host}${quote} then src/missing.ts.`), ['src/missing.ts']);
    }
    assert.deepEqual(extractBareFileNames(`Read ${quote}D:/Host Files/old guide.md${quote} then missing.ts.`), ['missing.ts']);
  }
});

test('WF-G350: quoting host context preserves task ownership and source anchors', () => {
  const task = { refs: ['"D:/Program Files/Git/bin/bash.exe"', 'src/ref.ts'], body:
    'Run "D:/Program Files/Git/bin/bash.exe"; edit `F:/Repos/Aralia/src/owned.ts:12` and src/body.ts.' };
  assert.deepEqual(extractTaskOwnershipPaths(task, { repoRoot: 'F:/Repos/Aralia' }), [
    { ref: 'src/ref.ts', sources: ['refs'] },
    { ref: 'src/owned.ts', sources: ['body'] },
    { ref: 'src/body.ts', sources: ['body'] },
  ]);
});

test('WF-G350: host quoting does not hide missing paths, basenames or creation/absence failures', () => {
  const options = { fileExists: file => file === 'src/present.ts', ignoredPaths: () => new Set(),
    grepSrc: () => true, basenameExists: () => false };
  const result = lintTask({ body: [
    'Run "D:/Program Files/Git/bin/bash.exe" and edit src/missing.ts; inspect missing.ts.',
    'CREATES: src/new.ts src/present.ts',
    'ABSENT: src/gone.ts src/present.ts',
    'Read "D:/Host Files/missing guide.md".',
  ].join('\n') }, options);
  assert.deepEqual(result.missingPaths, ['src/missing.ts']);
  assert.deepEqual(result.missingFileNames, ['missing.ts']);
  assert.deepEqual(result.newPaths, ['src/new.ts']);
  assert.deepEqual(result.staleCreates, ['src/present.ts']);
  assert.deepEqual(result.presentDespiteAbsent, ['src/present.ts']);
  assert.equal(result.clean, false);
  assert.equal(lintTask({ body: 'Run "D:/Program Files/Git/bin/bash.exe".' }, options).clean, true);
});

test('WF-G350: malformed quotes and quoted commands retain ordinary path scanning', () => {
  for (const text of [
    'Use "D:/Program Files/Git/bin/bash.exe then src/missing.ts.',
    'Use "D:/Program Files/Git/bin/bash.exe\nthen src/missing.ts".',
    'Run `node tools/agora/client.mjs task lint src/missing.ts`.',
    'Run `D:/Program Files/Git/bin/bash.exe src/missing.ts`.',
    "Don't hide src/missing.ts or 'ordinary prose src/other.ts'.",
  ]) assert.ok(extractPathTokens(text).includes('src/missing.ts'), text);
  assert.deepEqual(extractPathTokens('"src/missing.ts" https://example.com/a/b planmap:topic/item src/a/**'), ['src/missing.ts']);
  // Unquoted space-containing host paths remain ambiguous; authors must quote the path alone.
  assert.ok(extractPathTokens('D:/Program Files/Git/bin/bash.exe').includes('Files/Git/bin/bash.exe'));
});

test('WF-G343: actionable corpus counts need a repeatable measurement source', () => {
  const options = { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => true };
  const body = 'Repair all 20 Enchantment Gap rows and 23 Upcast Gap rows.';
  const stale = lintTask({ body }, options);
  assert.equal(stale.clean, false);
  assert.equal(stale.countSourceCheck.claims.length, 1);
  assert.equal(stale.countSourceCheck.missingSources, true);
  assert.match(formatLintReport(stale).join('\n'), /WF-G343.*COUNT-SOURCE/);
  const fresh = lintTask({ body: body + '\nCOUNT-SOURCE: node --import tsx tools/agora/countSpellGaps.mjs' }, options);
  assert.equal(fresh.clean, true);
  assert.equal(fresh.countSourceCheck.sources[0].command, 'node --import tsx tools/agora/countSpellGaps.mjs');
  assert.match(formatLintReport(fresh).join('\n'), /not executed.*timestamp.*result/);
});

test('WF-G343: snapshots, ordinary numbers and duration limits are not current corpus claims', () => {
  const options = { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => true };
  for (const body of [
    'EVIDENCE: the historical task listed 20 Enchantment Gap rows.',
    'SNAPSHOT: 2026-09-22 measured 2 Enchantment Gap rows.',
    'HISTORY: fixed 10 files in the previous wave.',
    'Render for at least 3 seconds; use rule 7, level 8, and priority 2.',
    'Write 3 focused tests for this behavior.',
    'Create 3 new files for the tool.',
  ]) assert.equal(lintTask({ body }, options).clean, true, body);
  assert.equal(lintTask({ body: 'COUNT-CLAIM: twenty stale corpus entries' }, options).clean, false);
});

test('WF-G343: empty, placeholder and literal-output sources cannot satisfy the declaration', () => {
  const options = { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => true };
  for (const command of ['', '<measurement command>', 'TODO', 'echo 20', 'Write-Output 20']) {
    const result = lintTask({ body: 'Repair 20 rows.\nCOUNT-SOURCE: ' + command }, options);
    assert.equal(result.clean, false, command);
    assert.equal(result.countSourceCheck.invalidSources.length, 1);
  }
  const missing = lintTask({ body: 'COUNT-SOURCE: node tools/missing-count.mjs' }, { ...options, fileExists: () => false });
  assert.deepEqual(missing.missingPaths, ['tools/missing-count.mjs']);
});

test('WF-G343: measurement scripts are read-only context, never implicit edit ownership', () => {
  const task = { refs: ['tools/agora/countSpellGaps.mjs'], body: [
    'COUNT-SOURCE: node --import tsx tools/agora/countSpellGaps.mjs',
    'Edit src/owned.ts.',
  ].join('\n') };
  assert.deepEqual(extractTaskOwnershipPaths(task), [{ ref: 'src/owned.ts', sources: ['body'] }]);
  task.body += '\nCREATES: tools/agora/countSpellGaps.mjs';
  assert.deepEqual(extractTaskOwnershipPaths(task), [
    { ref: 'tools/agora/countSpellGaps.mjs', sources: ['refs', 'body'] },
    { ref: 'src/owned.ts', sources: ['body'] },
  ]);
});

test('WF-G333: unresolved implementation discovery is a task-authoring defect, not a file grant', () => {
  const options = { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => true };
  for (const body of ['DISCOVER: the settings UI component',
    'Owned files: discover: the campaign/game settings type and reducer',
    '- DISCOVERY-REQUIRED: settings UI and src/components/ActionPane/SystemMenu.tsx',
    'TO-DISCOVER: the production caller']) {
    const result = lintTask({ body }, options);
    assert.equal(result.clean, false, body);
    assert.equal(result.pendingDiscoveries?.length, 1);
    assert.match(formatLintReport(result).join('\n'), /WF-G333.*resolve.*before.*dispatch/i);
  }
});

test('WF-G333: historical evidence, gameplay discovery and exact new paths remain valid', () => {
  const options = { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => true };
  for (const body of ['EVIDENCE: DISCOVER: the settings screen was a historical unresolved target.',
    'SNAPSHOT: old packet said discover: the settings UI component.',
    'Allow characters to discover hidden places on the map.',
    'Edit src/components/ActionPane/SystemMenu.tsx; author reviewed its current Rules control.']) {
    assert.equal(lintTask({ body }, options).clean, true, body);
  }
  const created = lintTask({ body: 'CREATES: tools/agora/deliberate-new.mjs' },
    { ...options, fileExists: () => false, basenameExists: () => false });
  assert.equal(created.clean, true); assert.deepEqual(created.newPaths, ['tools/agora/deliberate-new.mjs']);
  assert.equal(lintTask({ body: 'Edit src/unresolved/does-not-exist.ts' }, { ...options, fileExists: () => false }).clean, false);
});

test('extractBacktickedIdentifiers takes code names and leaves English words alone', () => {
  const text = 'Wire `TOGGLE_LEDGER_BOOK` into `useModalOrchestration()`, keep `SalvageModal` and set state `open`. Also `store.acquireLock` and `a b`.';
  const found = extractBacktickedIdentifiers(text);
  assert.deepEqual(found, ['TOGGLE_LEDGER_BOOK', 'useModalOrchestration', 'SalvageModal', 'acquireLock']);
  assert.ok(!found.includes('open'), 'a lowercase English word is not an identifier claim');
});

test('lintTask reports missing paths and ungreppable identifiers, and stays clean otherwise', () => {
  const present = new Set(['src/real/thing.ts', 'tools/agora']);
  const greppable = new Set(['RealThing']);
  const result = lintTask(
    {
      id: 'agora-1234',
      title: 'Repair `RealThing`',
      body: 'Edit `src/real/thing.ts` and `src/ghost/absent.ts`; rename `GHOST_ACTION` inside tools/agora.',
      refs: ['src/also/missing.ts', 'workflow:WF-G111'],
    },
    {
      fileExists: (p) => present.has(p),
      ignoredPaths: () => new Set(),
      grepSrc: (n) => greppable.has(n),
    },
  );
  assert.deepEqual(result.missingPaths, ['src/ghost/absent.ts', 'src/also/missing.ts']);
  assert.deepEqual(result.missingIdentifiers, ['GHOST_ACTION']);
  assert.equal(result.clean, false);
  assert.ok(result.checkedPaths.includes('tools/agora'));

  const clean = lintTask(
    { id: 'agora-5678', body: 'Edit `src/real/thing.ts` for `RealThing`.' },
    { fileExists: (p) => present.has(p), ignoredPaths: () => new Set(), grepSrc: (n) => greppable.has(n) },
  );
  assert.deepEqual(clean.missingPaths, []);
  assert.deepEqual(clean.missingIdentifiers, []);
  assert.equal(clean.clean, true);
});

test('a path that EXISTS but is gitignored is a note, never a missing path', () => {
  const result = lintTask(
    { id: 'agora-9999', body: 'The pane is `src/components/DesignPreview/steps/PreviewTown3D.tsx`.' },
    {
      fileExists: () => true,
      ignoredPaths: (paths) => new Set(paths),
      grepSrc: () => true,
    },
  );
  assert.deepEqual(result.missingPaths, []);
  assert.deepEqual(result.ignoredPaths, ['src/components/DesignPreview/steps/PreviewTown3D.tsx']);
  assert.equal(result.clean, true, 'an ignored-but-present file does not fail the lint');
  const report = formatLintReport(result).join('\n');
  assert.match(report, /GITIGNORED/);
});

test('formatLintReport names both defect classes', () => {
  const report = formatLintReport({
    taskId: 'agora-abcd',
    checkedPaths: ['a/b.ts'],
    checkedIdentifiers: ['Xy'],
    missingPaths: ['a/b.ts'],
    ignoredPaths: [],
    missingIdentifiers: ['Xy'],
    clean: false,
  }).join('\n');
  assert.match(report, /MISSING PATHS \(1\)/);
  assert.match(report, /UNGREPPABLE IDENTIFIERS \(1\)/);
});

test('the default git probes answer over a real temp repo', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-tasklint-'));
  try {
    // check-ignore only answers inside a repository, so the fixture is one.
    spawnSync('git', ['init', '-q', root], { encoding: 'utf8' });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'real.ts'), 'export const RealSymbol = 1;\n');
    fs.writeFileSync(path.join(root, 'src', 'hidden.ts'), 'export const HiddenSymbol = 2;\n');
    fs.writeFileSync(path.join(root, '.gitignore'), 'src/hidden.ts\n');
    assert.equal(defaultGrepSrc(root, 'RealSymbol'), true);
    assert.equal(defaultGrepSrc(root, 'NoSuchSymbolAnywhere'), false);
    // --no-index means an ignored file's contents are still searched, which is
    // what a worker's own grep would do.
    assert.equal(defaultGrepSrc(root, 'HiddenSymbol'), true);
    const ignored = defaultIgnoredPaths(root, ['src/real.ts', 'src/hidden.ts']);
    assert.equal(ignored.has('src/hidden.ts'), true);
    assert.equal(ignored.has('src/real.ts'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('WF-G158: a bare file name with no directory is checked by basename across the repo', () => {
  assert.deepEqual(
    extractBareFileNames('Change processEndOfTurnEffects (same file or useTurnOrder.ts) and `useCombatEngine.ts`; skip .ts and foo/bar.ts'),
    ['useTurnOrder.ts', 'useCombatEngine.ts'],
  );
  const known = new Set(['useCombatEngine.ts']);
  const result = lintTask(
    { id: 'agora-9999', body: 'Refactor useTurnOrder.ts and useCombatEngine.ts' },
    { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: (n) => known.has(n) },
  );
  assert.deepEqual(result.missingFileNames, ['useTurnOrder.ts']);
  assert.equal(result.clean, false);
  assert.ok(formatLintReport(result).some((l) => /MISSING FILE NAMES/.test(l)));
});

test('WF-G158: the default basename probe finds a real file and misses a ghost', () => {
  const real = lintTask({ id: 'x', body: 'see taskLint.mjs' }, { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true });
  assert.deepEqual(real.missingFileNames, []);
  const ghost = lintTask({ id: 'y', body: 'see zz-no-such-file-9f8e7d.ts' }, { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true });
  assert.deepEqual(ghost.missingFileNames, ['zz-no-such-file-9f8e7d.ts']);
});

test('WF-G167: missing test path identifies split test suite candidates', () => {
  assert.equal(isTestPath('src/utils/combat/__tests__/combatUtils.test.ts'), true);
  assert.equal(isTestPath('src/utils/combat/combatUtils.ts'), false);
  assert.equal(isTestPath('tests/foo.spec.js'), true);

  // Live repository check: combatUtils.test.ts is missing, but split suites exist
  const splits = defaultFindSplitCandidates(REPO_ROOT, 'src/utils/combat/__tests__/combatUtils.test.ts');
  assert.ok(splits.length >= 8, 'should find combatUtils split test files');
  assert.ok(splits.includes('combatUtils_attack.test.ts'));
  assert.ok(splits.includes('combatUtils_character.test.ts'));

  const result = lintTask({
    id: 'agora-test-wfg167',
    body: 'Run gate with npx vitest run src/utils/combat/__tests__/combatUtils.test.ts',
  });
  assert.equal(result.clean, false);
  assert.equal(result.missingTestPaths.length, 1);
  assert.equal(result.missingTestPaths[0].path, 'src/utils/combat/__tests__/combatUtils.test.ts');
  assert.ok(result.missingTestPaths[0].splitCandidates.includes('combatUtils_attack.test.ts'));

  const report = formatLintReport(result).join('\n');
  assert.match(report, /MISSING TEST PATHS/);
  assert.match(report, /WF-G167/);
  assert.match(report, /split test suites found/);
});

test('WF-G165: suspect schema claims detect existing types in src/types/**', () => {
  const claims = extractSchemaClaims("Add a schema for savePenalty in src/types/spells.ts; mind-sliver has no schema or handler");
  assert.ok(claims.some((c) => c.typeName === 'savePenalty'));

  // Live repository check: savePenalty exists in spellEffectTypes.ts and combat.ts
  const hits = defaultGrepTypes(REPO_ROOT, 'savePenalty');
  assert.ok(hits.includes('src/types/spellEffectTypes.ts'));

  const result = lintTask({
    id: 'agora-test-wfg165',
    body: 'Add a schema for savePenalty in src/types/spells.ts',
  });
  assert.equal(result.clean, false);
  assert.ok(result.suspectSchemaClaims.some((c) => c.typeName === 'savePenalty'));

  const report = formatLintReport(result).join('\n');
  assert.match(report, /SUSPECT SCHEMA CLAIMS/);
  assert.match(report, /WF-G165/);
  assert.match(report, /src\/types\/spellEffectTypes\.ts/);
});

test('WF-G161: unresolved type fields detect claims of fields missing from named file', () => {
  const claims = extractTypeFieldClaims('Pass town (wealth, biome, dominant races from src/types/world.ts) to generator');
  assert.equal(claims.length, 1);
  assert.equal(claims[0].file, 'src/types/world.ts');
  assert.ok(claims[0].fields.includes('wealth'));

  // Live repository check: wealth is NOT in src/types/world.ts
  const missing = defaultCheckFileFields(REPO_ROOT, 'src/types/world.ts', ['wealth', 'biome']);
  assert.deepEqual(missing, ['wealth'], 'wealth is missing, biome is present');

  const result = lintTask({
    id: 'agora-test-wfg161',
    body: 'Pass the current town (wealth, biome, dominant races from src/types/world.ts) into generator',
  });
  assert.equal(result.clean, false);
  assert.equal(result.unresolvedTypeFields.length, 1);
  assert.ok(result.unresolvedTypeFields[0].missingFields.includes('wealth'));

  const report = formatLintReport(result).join('\n');
  assert.match(report, /UNRESOLVED TYPE FIELDS/);
  assert.match(report, /WF-G161/);
  assert.match(report, /missing \[.*wealth.*\]/);
});
