// Isolated source/header fixtures prove the audit without editing game files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { deletionChecklist, formatDeletionChecklist } from './deletionChecklist.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-deletion-'));
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  return { root, write, close() {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  } };
}
const header = dependents => `/**\n * ARCHITECTURAL ADVISORY:\n * Dependents: ${dependents}\n * Imports: src/data/old.ts\n */\n`;

test('WF321: missing target finds exact root/src-relative and Windows header paths only', () => {
  const f = fixture();
  try {
    f.write('src/core.ts', header('src/data/old.ts, data\\old.ts, src/data/old.tsx, src/other/old.ts')
      + 'const prose = "src/data/old.ts";');
    f.write('src/other.ts', '/** Dependents: src/data/old.ts */');
    const before = fs.readFileSync(path.join(f.root, 'src/core.ts'));
    const report = deletionChecklist({ repoRoot: f.root, deleted: ['src\\data\\old.ts'], scan: ['src'] });
    assert.deepEqual(report.targets, [{ path: 'src/data/old.ts', exists: false }]);
    assert.deepEqual(report.headerHits, [
      { file: 'src/core.ts', line: 3, target: 'src/data/old.ts', stale: true },
      { file: 'src/core.ts', line: 3, target: 'src/data/old.ts', stale: true },
    ]);
    assert.deepEqual(fs.readFileSync(path.join(f.root, 'src/core.ts')), before);
    assert.equal(fs.existsSync(path.join(f.root, 'src/data/old.ts')), false);
    assert.match(formatDeletionChecklist(report), /src\/core\.ts:3.*\[stale\]/);
  } finally { f.close(); }
});

test('WF321: present target, wrapped/absolute headers, duplicate scopes and CRLF retain evidence', () => {
  const f = fixture();
  try {
    f.write('src/data/old.ts', 'export const table = [1];');
    f.write('src/reader.ts', header(`other/file.ts,\n * ${path.join(f.root, 'src/data/old.ts')}`).replace(/\n/g, '\r\n'));
    const report = deletionChecklist({ repoRoot: f.root, deleted: ['src/data/old.ts', './src/data/old.ts'], scan: ['src', 'src/reader.ts'] });
    assert.equal(report.scannedFiles, 2);
    assert.equal(report.targets.length, 1);
    assert.deepEqual(report.headerHits, [{ file: 'src/reader.ts', line: 4, target: 'src/data/old.ts', stale: false }]);
    assert.match(report.limits, /no complete runtime graph, edit permission/);
  } finally { f.close(); }
});

test('WF321: explicit scan boundaries reject traversal and do not execute source', () => {
  const f = fixture();
  try {
    f.write('src/owned/core.ts', header('data/old.ts') + 'throw new Error("must not execute");');
    f.write('src/sibling/core.ts', header('data/old.ts'));
    const options = { repoRoot: f.root, deleted: ['src/data/old.ts'], scan: ['src/owned'] };
    assert.deepEqual(deletionChecklist(options).headerHits.map(hit => hit.file), ['src/owned/core.ts']);
    assert.throws(() => deletionChecklist({ ...options, deleted: ['../other.ts'] }), /parent traversal/);
    assert.throws(() => deletionChecklist({ ...options, deleted: ['/other.ts'] }), /repository-relative/);
    assert.throws(() => deletionChecklist({ ...options, scan: [] }), /--scan/);
    assert.throws(() => deletionChecklist({ ...options, scan: ['../'] }), /parent traversal/);
    assert.throws(() => deletionChecklist({ ...options, deleted: [] }), /--deleted/);
  } finally { f.close(); }
});

test('WF320/321: deletion template requires direct-export controls and parent-owned follow-ups', () => {
  const guide = fs.readFileSync(new URL('./ORCHESTRATOR.md', import.meta.url), 'utf8');
  assert.match(guide, /Deletion Task Checklist \(WF-G320\/WF-G321\)/);
  for (const text of ['EXPECTED-ABSENT:', 'directly imports the surviving export',
    'negative control', 'deletionChecklist.mjs', 'explicit parent-owned follow-up', '--sync --only']) {
    assert.ok(guide.includes(text), text);
  }
});

test('WF320: a direct-export acceptance test fails when disposable surviving data is emptied', () => {
  const f = fixture();
  try {
    // This demonstrates the template's control in a private data fixture. It
    // neither changes nor certifies the production naval table or its runtime.
    f.write('data.mjs', 'export const events = [{ id: "required", effect: () => 1 }];');
    f.write('acceptance.test.mjs', [
      'import assert from "node:assert/strict";',
      'import test from "node:test";',
      'import { events } from "./data.mjs";',
      'test("surviving table", () => {',
      'assert.ok(events.some(event => event.id === "required"));',
      'assert.equal(new Set(events.map(event => event.id)).size, events.length);',
      'assert.ok(events.every(event => typeof event.effect === "function"));',
      '});',
    ].join('\n'));
    // A nested node:test child must not inherit the parent's internal runner
    // context; otherwise its failing test can be reported as a successful child.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const run = () => spawnSync(process.execPath, ['--test', path.join(f.root, 'acceptance.test.mjs')], { encoding: 'utf8', env });
    assert.equal(run().status, 0);
    f.write('data.mjs', 'export const events = [];');
    const control = run();
    assert.equal(control.status, 1);
    assert.match(control.stdout, /not ok 1 - surviving table/);
  } finally { f.close(); }
});

test('WF321: source directory links are skipped rather than scanned as owned work', () => {
  const f = fixture();
  try {
    f.write('src/owned.ts', header('data/old.ts'));
    f.write('elsewhere/peer.ts', header('data/old.ts'));
    fs.symlinkSync(path.join(f.root, 'elsewhere'), path.join(f.root, 'src/peer'), 'junction');
    const report = deletionChecklist({ repoRoot: f.root, deleted: ['src/data/old.ts'], scan: ['src'] });
    assert.deepEqual(report.headerHits.map(hit => hit.file), ['src/owned.ts']);
    assert.equal(report.scannedFiles, 1);
  } finally { f.close(); }
});
