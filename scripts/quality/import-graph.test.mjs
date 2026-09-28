import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
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
