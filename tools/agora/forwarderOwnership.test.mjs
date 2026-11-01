import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createForwarderResolver } from './forwarderOwnership.mjs';

// Disposable sources never execute. Throwing implementation text proves that
// tracing uses syntax only, rather than loading worker/game code for discovery.
function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-forwarders-'));
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  });
  for (const [ref, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, ref)), { recursive: true });
    fs.writeFileSync(path.join(root, ref), text);
  }
  return createForwarderResolver(root);
}

test('WF-G247: resolves named, default, star and JS-specifier chains without executing targets', t => {
  const trace = fixture(t, {
    'src/facade.ts': "// compatibility\nexport { default } from './middle.js';",
    'src/middle.ts': "export * from './impl'; export { value as default } from './impl';",
    'src/impl.ts': "throw new Error('must not execute'); export const value = 1;",
  });
  assert.deepEqual(trace('src/facade.ts'), { facade: 'src/facade.ts', target: 'src/impl.ts',
    chain: ['src/facade.ts', 'src/middle.ts', 'src/impl.ts'] });
  assert.equal(trace('src/not-yet-created.ts'), null);
  assert.equal(trace('src/impl.ts'), null);
});

test('WF-G247: retains TS path aliases and ignores only type-only declarations', t => {
  const trace = fixture(t, {
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
    'src/facade.ts': "import type { X } from './types'; export type { X } from './types';\n"
      + "export { type Y } from './types'; interface Local {} type Alias = Local; export { value } from '@/impl';",
    'src/impl.ts': 'export const value = 1;',
  });
  assert.equal(trace('src/facade.ts').target, 'src/impl.ts');
});

test('WF-G247: local runtime code, side-effect imports and multi-target barrels are not pure facades', t => {
  const trace = fixture(t, {
    'src/runtime.ts': "export { value } from './impl'; export const local = 2;",
    'src/effect.ts': "import './effectTarget'; export { value } from './impl';",
    'src/barrel.ts': "export * from './impl'; export * from './other';",
    'src/type.ts': "export type { X } from './types';",
  });
  for (const ref of ['runtime', 'effect', 'barrel', 'type']) assert.equal(trace('src/' + ref + '.ts'), null);
});

test('WF-G247: cycles, unresolved internal targets, syntax errors and repository escapes refuse analysis', t => {
  const trace = fixture(t, {
    'src/a.ts': "export * from './b';", 'src/b.ts': "export * from './a';",
    'src/missing.ts': "export * from './absent';", 'src/bad.ts': 'export { broken from ;',
  });
  assert.throws(() => trace('src/a.ts'), /forwarder cycle/);
  assert.throws(() => trace('src/missing.ts'), /cannot resolve runtime forwarder target/);
  assert.throws(() => trace('src/bad.ts'), /invalid syntax/);
  assert.throws(() => trace('../outside.ts'), /escapes repository/);
});

test('WF-G247: the actual CharacterActor facade resolves to its moved implementation', () => {
  const trace = createForwarderResolver();
  assert.deepEqual(trace('src/components/BattleMap/characters/CharacterActor.tsx'), {
    facade: 'src/components/BattleMap/characters/CharacterActor.tsx',
    target: 'src/components/BattleMap/characters/characterActor/CharacterActor.tsx',
    chain: ['src/components/BattleMap/characters/CharacterActor.tsx',
      'src/components/BattleMap/characters/characterActor/CharacterActor.tsx'],
  });
});

test('WF-G247: a long chain is bounded and an internal target cannot escape through a junction', t => {
  const files = Object.fromEntries(Array.from({ length: 34 }, (_, i) =>
    ['src/chain' + i + '.ts', i < 33 ? "export * from './chain" + (i + 1) + "';" : 'export const done = true;']));
  const trace = fixture(t, files);
  assert.throws(() => trace('src/chain0.ts'), /exceeds 32 files/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-forwarder-junction-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-forwarder-outside-'));
  t.after(() => {
    for (const target of [root, outside]) {
      assert.ok(path.resolve(target).startsWith(path.resolve(os.tmpdir()) + path.sep));
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
  fs.writeFileSync(path.join(outside, 'impl.ts'), 'export const value = true;');
  fs.symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  fs.writeFileSync(path.join(root, 'facade.ts'), "export * from './linked/impl';");
  assert.throws(() => createForwarderResolver(root)('facade.ts'), /escapes repository/);
});
