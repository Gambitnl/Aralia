// Source-only shared-type discovery and ownership evidence. Every write is in
// an isolated fixture; even throwing source modules must never be executed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectSharedTypeDependencies, sharedTypePromptBlock } from './sharedTypeOwnership.mjs';

function fixture(check) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-shared-types-'));
  const put = (ref, text) => { const file = path.join(root, ref); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  const packet = { id: 'PK-worker', handle: 'worker-fixture', files: ['src/worker.ts'] };
  const inspect = (packets = [packet], locks = []) => inspectSharedTypeDependencies({ packets },
    new Map([[packet.id, new Set(packet.files)]]), locks, { repoRoot: root });
  try { check({ root, put, packet, inspect }); }
  finally {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); assert.match(path.basename(root), /^agora-shared-types-/);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('WF228: aliases, mixed/type imports and renamed barrels expose the actual declaring files', () => fixture(({ root, put, inspect }) => {
  put('tsconfig.base.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@contracts/*': ['src/contracts/*'] } } }));
  put('tsconfig.json', JSON.stringify({ extends: './tsconfig.base.json', include: ['src'] }));
  put('src/contracts/leaf.ts', 'throw new Error("never execute");\nexport interface Contract { value: string }\nexport type State = string;\nexport enum Mode { A }\nexport function runtimeOnly() {}');
  put('src/contracts/barrel.ts', 'export { Contract as Renamed, runtimeOnly } from "./leaf"; export type { State } from "./leaf";');
  put('src/contracts/local.ts', 'import type { Mode as Local } from "./leaf"; export { Local as PublicMode };');
  put('src/contracts/default.ts', 'export default interface DefaultContract { value: string }');
  put('src/worker.ts', ['import { Renamed as Alias, runtimeOnly } from "@contracts/barrel";',
    'import type { State } from "@contracts/barrel";', 'import { type PublicMode } from "@contracts/local";',
    'import type DefaultContract from "@contracts/default";', 'type Imported = import("@contracts/leaf").Contract;',
    '// import type { Fake } from "./ghost";'].join('\n'));
  const before = fs.readFileSync(path.join(root, 'src/contracts/leaf.ts'));
  const audit = inspect();
  assert.deepEqual(audit.issues, []); assert.equal(audit.checkedSources, 1);
  const leaf = audit.entries.find(entry => entry.file === 'src/contracts/leaf.ts');
  assert.deepEqual(new Set(leaf.symbols), new Set(['Contract', 'State', 'Mode']));
  assert.ok(leaf.evidence.some(item => item.via.join(' -> ') === 'src/contracts/local.ts -> src/contracts/leaf.ts'));
  assert.ok(leaf.evidence.every(item => item.line > 0 && item.specifier));
  assert.ok(!leaf.symbols.includes('runtimeOnly'));
  assert.ok(audit.entries.some(entry => entry.file === 'src/contracts/default.ts' && entry.symbols.includes('DefaultContract')));
  assert.deepEqual(fs.readFileSync(path.join(root, 'src/contracts/leaf.ts')), before);
  assert.equal(fs.existsSync(path.join(root, 'src/ghost.ts')), false);
}));

test('WF228: wildcard contracts and explicit typeof context stay qualified, not invented semantic claims', () => fixture(({ put, inspect }) => {
  put('src/types/leaf.ts', 'export interface Contract {}\nexport class Entity {}\nexport const runtime = 1;');
  put('src/types/index.ts', 'export * from "./leaf";');
  put('src/worker.ts', 'import * as Namespace from "./types";\nimport type { runtime } from "./types/leaf";');
  const entry = inspect().entries.find(item => item.file === 'src/types/leaf.ts');
  assert.deepEqual(new Set(entry.symbols), new Set(['Contract', 'Entity', 'runtime']));
  assert.ok(entry.evidence.some(item => item.symbol === 'runtime' && /declaration not identified/.test(item.basis)));
}));

test('WF228: owner globs and live holders are observations, never grants or plan mutations', () => fixture(({ put, packet, inspect }) => {
  put('src/types/contract.ts', 'export interface Contract {}');
  put('src/worker.ts', 'import type { Contract } from "./types/contract";');
  const owner = { id: 'PK-types', handle: 'type-fixture', files: ['src/types/*.ts'] };
  const locks = [{ id: 'holder-fixture', agentId: 'another-agent', paths: [], globs: ['src/types/**'], reason: 'test observation' }];
  const before = JSON.stringify({ packet, owner, locks });
  assert.equal(inspect().entries[0].ownership, 'unassigned');
  const audit = inspect([packet, owner], locks), entry = audit.entries[0];
  assert.equal(entry.ownership, 'sibling'); assert.deepEqual(entry.owners, [{ packetId: owner.id, handle: owner.handle }]);
  assert.deepEqual(entry.locks, [{ id: 'holder-fixture', agentId: 'another-agent', reason: 'test observation' }]);
  assert.match(sharedTypePromptBlock(packet, audit), /REFERENCE-ONLY: SHARED-TYPE:/);
  assert.match(sharedTypePromptBlock(packet, audit), /not edit permission/);
  const sibling = { ...owner, id: 'PK-overlap' };
  assert.equal(inspect([packet, owner, sibling]).entries[0].ownership, 'ambiguous');
  const self = { ...packet, files: [...packet.files, 'src/types/contract.ts'] };
  assert.equal(inspect([self]).entries[0].ownership, 'self');
  assert.equal(JSON.stringify({ packet, owner, locks }), before);
  assert.match(sharedTypePromptBlock(packet), /Audit not supplied/);
}));

test('WF228: unresolved links, invalid syntax, planned source and unsupported imports expose audit issues', () => fixture(({ put, packet, inspect }) => {
  put('src/broken.ts', 'export interface Broken {');
  put('src/worker.ts', 'import type { Missing } from "./missing";\nimport type { Broken } from "./broken";\nimport Old = require("./old");');
  packet.files.push('src/planned.ts');
  const audit = inspect();
  assert.equal(audit.entries.length, 0);
  for (const expected of [/unresolved import/, /unverified syntax/, /planned or missing source/, /import-equals/]) {
    assert.ok(audit.issues.some(item => expected.test(item.message)), String(expected));
  }
  assert.match(sharedTypePromptBlock(packet, audit), /SHARED-TYPE-AUDIT-ISSUE/);
}));

test('WF228: cyclic/deep barrels are incomplete evidence but retain independently verified contracts', () => fixture(({ put, inspect }) => {
  put('src/a.ts', 'export * from "./b"; export * from "./good";');
  put('src/b.ts', 'export * from "./a";');
  put('src/good.ts', 'export interface Contract {}');
  for (let index = 0; index < 18; index++) put(`src/deep${index}.ts`, index === 17
    ? 'export interface Deep {}' : `export type { Deep } from "./deep${index + 1}";`);
  put('src/worker.ts', 'import { Contract } from "./a";\nimport type { Deep } from "./deep0";');
  const audit = inspect();
  assert.ok(audit.entries.some(item => item.file === 'src/good.ts' && item.symbols.includes('Contract')));
  assert.ok(audit.issues.some(item => /cyclic type/.test(item.message)));
  assert.ok(audit.issues.some(item => /16 import\/export links/.test(item.message)));
}));

test('WF228: physical escapes and external package types are not repository ownership candidates', () => fixture(({ root, put, inspect }) => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-shared-outside-'));
  try {
    fs.writeFileSync(path.join(outside, 'contract.ts'), 'export interface Foreign {}');
    fs.symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    put('node_modules/fixture-lib/package.json', '{"name":"fixture-lib","types":"index.d.ts"}');
    put('node_modules/fixture-lib/index.d.ts', 'export interface PackageType {}');
    put('src/worker.ts', 'import type { Foreign } from "../linked/contract";\nimport type { PackageType } from "fixture-lib";');
    const audit = inspect(); assert.equal(audit.entries.length, 0);
    assert.ok(audit.issues.some(item => /outside repository/.test(item.message)));
    assert.ok(!audit.issues.some(item => /fixture-lib/.test(item.message)), 'package libraries are intentionally excluded');
  } finally {
    fs.unlinkSync(path.join(root, 'linked')); assert.equal(path.dirname(outside), fs.realpathSync(os.tmpdir()));
    fs.rmSync(outside, { recursive: true, force: true });
  }
}));

test('WF228: parsing stays bounded and never converts incomplete discovery to an absence claim', () => fixture(({ put, inspect }) => {
  const lines = [];
  for (let index = 0; index < 257; index++) {
    put(`src/types/c${index}.ts`, 'export interface Contract {}');
    lines.push(`import type { Contract as C${index} } from "./types/c${index}";`);
  }
  put('src/worker.ts', lines.join('\n'));
  const audit = inspect(); assert.equal(audit.entries.length, 255);
  assert.ok(audit.issues.some(item => /256 parsed files/.test(item.message)));
  const prompt = sharedTypePromptBlock({ id: 'PK-worker' }, audit);
  assert.match(prompt, /incomplete audits are not proof of absence/);
  assert.match(prompt, /SHARED-TYPE-AUDIT-PARTIAL/); assert.match(prompt, /ask the parent for the full current partition report/);
  assert.ok(Buffer.byteLength(prompt, 'utf8') < 10000, 'the excerpt does not overflow one task-new shell argument');
  assert.equal(audit.entries.length, 255, 'the full partition evidence remains available');
  const oversized = { ...audit, entries: [{ ...audit.entries[0], symbols: ['Large'.repeat(2000)] }], issues: [] };
  const omitted = sharedTypePromptBlock({ id: 'PK-worker' }, oversized);
  assert.match(omitted, /Evidence omitted/); assert.doesNotMatch(omitted, /No candidates/);
}));
