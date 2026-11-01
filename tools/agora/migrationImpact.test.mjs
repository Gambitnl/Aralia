// Disposable fixtures prove syntax evidence without executing tests, changing
// game files or claiming that a listed reference proves a runtime failure.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { migrationImpact, formatMigrationImpact } from './migrationImpact.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-migration-impact-'));
  const write = (file, value) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  };
  write('base.json', JSON.stringify({ compilerOptions: {
    moduleResolution: 'bundler', module: 'ESNext', paths: { '@/*': ['./src/*'] },
  } }));
  write('tsconfig.json', JSON.stringify({ extends: './base.json', include: ['src'] }));
  write('src/core.ts', 'export const rollD20 = () => 20; export const unchanged = 1;');
  write('src/barrel.ts', "export { rollD20 as toss } from './core'; export { unchanged } from './core';");
  write('src/index.ts', "export * from './barrel';");
  write('src/other.ts', 'export const rollD20 = 0; export const unrelated = 1;');
  return { root, write, cleanup: () => {
    const target = path.resolve(root);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  } };
}

test('WF-G312: alias/relative/barrel references and renamed exports retain exact evidence locations', () => {
  const f = fixture();
  try {
    f.write('src/tests/a.test.ts', [
      "import { vi as v } from 'vitest';",
      "import { rollD20 as roll, unchanged } from '@/core';",
      "import { toss } from '../index';",
      "import * as core from '../core';",
      "v.mock('@/core', () => ({ rollD20: () => 5 }));",
      "vi.doMock('../index', () => ({}));",
      "core.rollD20(); core['rollD20']();",
      "jest.spyOn(Math, 'random');",
      "Math.random = () => 0.5;",
      "vi.stubGlobal('Math', {});",
    ].join('\n'));
    f.write('src/tests/z.spec.js', "const { rollD20 } = require('../core');\nawait import('@/core');\nvi.mock(import('../core'));\n");
    const report = migrationImpact({ repoRoot: f.root, module: 'src/core.ts', symbols: ['rollD20'], tests: ['src/tests'] });
    assert.equal(report.scannedTests, 2);
    assert.equal(report.affectedTests, 2);
    const named = report.findings.filter(item => item.kind === 'moved-symbol-import');
    assert.deepEqual(named.map(item => [item.line, item.detail, item.certainty]), [
      [2, 'rollD20 from @/core', 'reference'], [3, 'toss from ../index', 'reference'],
    ]);
    assert.ok(report.findings.some(item => item.kind === 'module-mock' && item.line === 5));
    assert.ok(report.findings.some(item => item.kind === 'module-doMock' && item.line === 6));
    assert.equal(report.findings.filter(item => item.kind === 'moved-namespace-access').length, 2);
    for (const kind of ['math-random-spy', 'math-random-override', 'math-global-stub', 'module-require', 'module-dynamic-import']) {
      assert.ok(report.findings.some(item => item.kind === kind), kind);
    }
    assert.ok(report.findings.some(item => item.kind === 'module-mock' && item.file.endsWith('z.spec.js') && item.certainty === 'reference'));
    assert.match(formatMigrationImpact(report), /a\.test\.ts:2:\d+ \[moved-symbol-import, reference\]/);
    assert.deepEqual(migrationImpact({ repoRoot: f.root, module: 'src/core.ts', symbols: ['rollD20'], tests: ['src/tests'] }), report);
  } finally { f.cleanup(); }
});

test('WF-G312: comments, strings and unrelated exports do not become matches; uncertain targets stay candidates', () => {
  const f = fixture();
  try {
    f.write('src/tests/review.test.ts', [
      "// vi.mock('@/core'); vi.spyOn(Math, 'random');",
      "const prose = \"vi.mock('@/core')\";",
      "import { unchanged } from '../core';",
      "import { unrelated } from '../other';",
      "import { rollD20 } from '../other';",
      "vi.mock(variable); import(computed);",
    ].join('\n'));
    const report = migrationImpact({ repoRoot: f.root, module: 'src/core.ts', symbols: ['rollD20'], tests: ['src/tests'] });
    assert.equal(report.findings.length, 3);
    assert.ok(report.findings.every(item => item.line >= 5 && item.certainty === 'candidate'));
    assert.equal(report.findings.filter(item => item.kind === 'unresolved-module-target').length, 2);
    assert.match(report.limits, /not runtime failure proof/);
  } finally { f.cleanup(); }
});

test('WF-G312: scan is explicitly scoped, ignores non-tests and never imports test code', () => {
  const f = fixture();
  try {
    const marker = path.join(f.root, 'EXECUTED');
    f.write('src/tests/unsafe.test.js', "require('node:fs').writeFileSync(" + JSON.stringify(marker) + ", 'executed');\nvi.mock('../core');");
    f.write('src/tests/production.ts', "vi.mock('../core');");
    f.write('src/outside/sibling.test.ts', "vi.mock('../core');");
    const before = fs.readFileSync(path.join(f.root, 'src/tests/unsafe.test.js'), 'utf8');
    const report = migrationImpact({ repoRoot: f.root, module: 'src/core.ts', symbols: ['rollD20'], tests: ['src/tests', 'src/tests/unsafe.test.js'] });
    assert.equal(report.scannedTests, 1);
    assert.deepEqual(report.findings.map(item => item.file), ['src/tests/unsafe.test.js']);
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.readFileSync(path.join(f.root, 'src/tests/unsafe.test.js'), 'utf8'), before);
    assert.throws(() => migrationImpact({ repoRoot: f.root, module: 'src/core.ts', symbols: ['rollD20'], tests: [] }), /affected test subtree/);
    assert.throws(() => migrationImpact({ repoRoot: f.root, module: 'src/core.ts', symbols: [], tests: ['src/tests'] }), /at least one moved export/);
    assert.throws(() => migrationImpact({ repoRoot: f.root, module: 'src/core.ts', symbols: ['rollD20'], tests: ['../'] }), /escapes repository/);
    assert.throws(() => migrationImpact({ repoRoot: f.root, module: 'src/core.ts', symbols: ['rollD20'], tests: ['src/tests/production.ts'] }), /not a test file/);
    f.write('src/tests/broken.test.ts', 'const impossible = {');
    assert.throws(() => migrationImpact({ repoRoot: f.root, module: 'src/core.ts', symbols: ['rollD20'], tests: ['src/tests'] }), /invalid syntax.*broken\.test\.ts/);
  } finally { f.cleanup(); }
});

test('WF-G312: re-export cycles terminate and irrelevant renamed exports do not imply moved-symbol access', () => {
  const f = fixture();
  try {
    f.write('src/cycleA.ts', "export * from './cycleB';");
    f.write('src/cycleB.ts', "export * from './cycleA'; export * from './core';");
    f.write('src/tests/cycle.test.ts', "import { rollD20 } from '../cycleA';\nimport { unchanged } from '../index';");
    const report = migrationImpact({ repoRoot: f.root, module: 'src/core.ts', symbols: ['rollD20'], tests: ['src/tests'] });
    assert.equal(report.findings.length, 1);
    assert.equal(report.findings[0].line, 1);
  } finally { f.cleanup(); }
});

test('WF-G312: CLI reports current test paths from another cwd and fails incomplete arguments', () => {
  const script = fileURLToPath(new URL('./migrationImpact.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--module', 'src/utils/combat/combatUtils.ts',
    '--symbol', 'rollD20', '--tests', 'src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts', '--json'],
  { cwd: os.tmpdir(), encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.scannedTests, 1);
  assert.equal(report.module, 'src/utils/combat/combatUtils.ts');
  // The historical Math.random pin was already replaced in this worktree.
  // Preserve that reality: the replacement namespace spy is a review candidate.
  assert.ok(report.findings.some(item => item.kind === 'moved-export-spy' && item.certainty === 'candidate'));
  const invalid = spawnSync(process.execPath, [script, '--module'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /incomplete argument/);
});
