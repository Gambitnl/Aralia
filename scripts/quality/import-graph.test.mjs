import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
function git(root, args) {
  const result = spawnSync('git', ['-C', root, '-c', 'core.fsmonitor=false', ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
import graph from './import-graph.cjs';

test('the orphan import graph sees scripts and nested test importers', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wf-g199-'));
  const write = (relative, content) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return file;
  };
  try {
    const scriptOnly = write('src/validation/script-only.ts', 'export const value = 1;');
    const testOnly = write('src/validation/test-only.ts', 'export const value = 2;');
    const orphan = write('src/validation/orphan.ts', 'export const value = 3;');
    write('src/validation/script-only.js', 'export const value = 1;');
    write('scripts/check.mjs', "import '../src/validation/script-only.js';\n");
    write('src/validation/__tests__/validator.test.ts', "import '../test-only';\n");
    write('src/validation/commented.ts', "// import './orphan';\n");

    const { inbound, edges } = graph.collectImportEdges(root);
    assert.equal(inbound.get(scriptOnly), 1);
    assert.equal(inbound.get(testOnly), 1);
    assert.equal(inbound.has(orphan), false);
    assert.ok(edges.some((edge) => edge.from === 'scripts/check.mjs' && edge.to === 'src/validation/script-only.ts'));
    assert.ok(edges.some((edge) => edge.from.endsWith('validator.test.ts') && edge.to === 'src/validation/test-only.ts'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


// A converging DAG must not be mistaken for a cycle by an iterative DFS; groups
// are maximal mutual-reachability sets, with self imports retained explicitly.
test('cycle groups distinguish a converging DAG, independent SCCs and self imports', () => {
  const files = ['a', 'b', 'c', 'd', 'e', 'self'];
  const edge = (from, to) => ({ from, to, kind: 'static' });
  assert.deepEqual(graph.cycleGroups(files, [edge('a', 'b'), edge('a', 'c'), edge('c', 'b')]), []);
  const groups = graph.cycleGroups(files, [edge('a', 'b'), edge('b', 'a'), edge('b', 'c'), edge('d', 'e'), edge('e', 'd'), edge('self', 'self')]);
  assert.deepEqual(groups.map(group => group.members), [['a', 'b'], ['d', 'e'], ['self']]);
  assert.equal(groups[0].edges.length, 2);
});

test('iterative cycle traversal handles a deep graph without call-stack overflow', () => {
  const files = Array.from({ length: 15000 }, (_, i) => String(i));
  const edges = files.slice(1).map((to, i) => ({ from: String(i), to }));
  assert.deepEqual(graph.cycleGroups(files, edges), []);
});

test('fresh graph resolves aliases, emitted js paths and barrels, while separating type and deferred edges', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-cycles-'));
  git(root, ['init', '--quiet']);
  const write = (relative, content) => {
    const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content);
  };
  try {
    write('tsconfig.json', JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'bundler', paths: { '@/*': ['./src/*'] } } }));
    write('src/a.ts', 'import { b } from "@/barrel"; export const a = () => b; const example = "import x from \\\"./fake\\\"";');
    write('src/barrel/index.ts', 'export { b } from "../b.js";');
    write('src/b.ts', 'import { a } from "./a"; export const b = a;');
    write('src/types.ts', 'import type { a } from "./a"; export type Result = typeof a;');
    write('src/lazy.ts', 'export const load = () => import("./a");');
    write('src/explicit.ts', 'import { type Result } from "./types"; export type Value = Result;');
    write('src/ignored.test.ts', 'import "./missing-test";');
    const report = graph.cycleReport(root);
    assert.equal(report.complete, true, JSON.stringify(report.issues));
    assert.equal(report.groups.length, 1);
    assert.deepEqual(report.groups[0].members, ['src/a.ts', 'src/b.ts', 'src/barrel/index.ts']);
    assert.equal(report.eagerCandidateGroups.length, 1);
    assert.equal(report.emittedCandidateGroups.length, 1);
    assert.ok(report.edges.some(edge => edge.from === 'src/types.ts' && edge.kind === 'type'));
    assert.ok(report.edges.some(edge => edge.from === 'src/explicit.ts' && edge.kind === 'type'));
    assert.ok(report.edges.some(edge => edge.from === 'src/lazy.ts' && edge.kind === 'dynamic'));
    assert.match(report.sourceSha256, /^[a-f0-9]{64}$/);
    write('src/broken.ts', 'import "./missing"; const = ;');
    const partial = graph.cycleReport(root);
    assert.equal(partial.complete, false);
    assert.ok(partial.issues.some(issue => issue.kind === 'syntax'));
    assert.ok(partial.issues.some(issue => issue.kind === 'unresolved'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});


test('unmarked type-only cycles disappear from isolated emitted candidate groups', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-type-cycle-'));
  git(root, ['init', '--quiet']);
  try {
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src/a.ts'), 'import { B } from "./b"; export interface A { b: B }');
    fs.writeFileSync(path.join(root, 'src/b.ts'), 'import { A } from "./a"; export interface B { a: A }');
    const report = graph.cycleReport(root);
    assert.equal(report.eagerCandidateGroups.length, 1);
    assert.equal(report.emittedCandidateGroups.length, 0);
    assert.equal(report.eagerCoverageComplete, true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});


test('verbatim inline-type imports retain side effects and become emitted candidates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-verbatim-'));
  try {
    git(root, ['init', '--quiet']); fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'bundler', isolatedModules: true, verbatimModuleSyntax: true } }));
    fs.writeFileSync(path.join(root, 'src/a.ts'), 'import { type B } from "./b"; export interface A { b: B }');
    fs.writeFileSync(path.join(root, 'src/b.ts'), 'export { type A } from "./a"; export interface B { value: number }');
    const report = graph.cycleReport(root);
    assert.equal(report.compilerAssumptions.verbatimModuleSyntax, true);
    assert.equal(report.compilerAssumptions.isolatedModules, true);
    assert.equal(report.eagerCandidateGroups.length, 1);
    assert.equal(report.emittedCandidateGroups.length, 1);
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'bundler', isolatedModules: true, verbatimModuleSyntax: false } }));
    assert.equal(graph.cycleReport(root).eagerCandidateGroups.length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('each group member reports tracked, untracked or ignored provenance', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-provenance-'));
  try {
    git(root, ['init', '--quiet']); fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, '.gitignore'), 'src/ignored.ts\n');
    fs.writeFileSync(path.join(root, 'src/tracked.ts'), 'import "./untracked";');
    fs.writeFileSync(path.join(root, 'src/untracked.ts'), 'import "./ignored";');
    fs.writeFileSync(path.join(root, 'src/ignored.ts'), 'import "./tracked";');
    git(root, ['add', 'src/tracked.ts']);
    const report = graph.cycleReport(root);
    assert.deepEqual(report.groups[0].memberProvenance, {
      'src/ignored.ts': 'ignored', 'src/tracked.ts': 'tracked', 'src/untracked.ts': 'untracked',
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
