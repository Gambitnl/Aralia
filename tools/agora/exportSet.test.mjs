// tools/agora/exportSet.test.mjs
// WF-G132/G133: the export-set helper must follow re-exports, so a barrel and
// the module it replaced print the same set, and must name kinds so a lost
// type is visible. The fixture is a tiny module + barrel under a temp dir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exportSetOf } from './exportSet.mjs';

test('exportSetOf lists functions, types and consts and follows a barrel re-export', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-exportset-'));
  try {
    fs.writeFileSync(path.join(dir, 'impl.ts'), [
      'export function run(): number { return 1; }',
      'export interface Shape { id: string }',
      'export type Kind = "a" | "b";',
      'export const LIMIT = 3;',
      'export enum Mode { On, Off }',
      '',
    ].join('\n'));
    fs.writeFileSync(path.join(dir, 'barrel.ts'), 'export * from "./impl";\nexport const EXTRA = 1;\n');
    const impl = exportSetOf('impl.ts', { repoRoot: dir });
    assert.deepEqual(Object.keys(impl).sort(), ['Kind', 'LIMIT', 'Mode', 'Shape', 'run']);
    assert.deepEqual(impl.run, ['function']);
    assert.deepEqual(impl.Shape, ['interface']);
    assert.deepEqual(impl.Kind, ['type']);
    assert.deepEqual(impl.LIMIT, ['const']);
    assert.ok(impl.Mode.includes('enum'));
    const barrel = exportSetOf('barrel.ts', { repoRoot: dir });
    assert.deepEqual(Object.keys(barrel).sort(), ['EXTRA', 'Kind', 'LIMIT', 'Mode', 'Shape', 'run']);
    assert.deepEqual(barrel.Shape, ['interface'], 'a re-exported type keeps its kind');
    assert.throws(() => exportSetOf('missing.ts', { repoRoot: dir }), /no such file/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
