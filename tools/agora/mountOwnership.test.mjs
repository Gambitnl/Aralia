// WF-G214 checks are structural packet evidence, never product visual acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
const api = await import('./mountOwnership.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});

function fixture(check) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-mount-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    moduleResolution: 'bundler', module: 'esnext', baseUrl: '.', paths: { '@/*': ['src/*'] } } }));
  fs.writeFileSync(path.join(root, 'src/leaf.tsx'), 'export const Weather = () => null;');
  fs.writeFileSync(path.join(root, 'src/parent.tsx'), "import { Weather as Local } from '@/leaf'; export const Parent = () => <Local />;");
  const packet = { id: 'PK-leaf', files: ['src/leaf.tsx', 'src/parent.tsx'], taskIds: ['agora-build'], mountPoints: [{
    leaf: 'src/leaf.tsx', parent: 'src/parent.tsx', symbol: 'Weather', relation: 'existing', delivery: 'owned' }] };
  try { check(root, packet); }
  finally { assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
}

test('WF214: aliases, named/default/namespace runtime imports are audited without source execution or permission expansion', () => {
  assert.equal(typeof api.inspectPacketMounts, 'function');
  fixture((root, packet) => {
    const before = JSON.stringify(packet), bytes = fs.readFileSync(path.join(root, 'src/parent.tsx'), 'utf8');
    const result = api.inspectPacketMounts(packet, [], { repoRoot: root });
    assert.equal(result[0].importVerified, true); assert.equal(result[0].jsxReferences, 1);
    assert.equal(JSON.stringify(packet), before); assert.equal(fs.readFileSync(path.join(root, 'src/parent.tsx'), 'utf8'), bytes);
    for (const [source, symbol] of [["import Value from './leaf'; export const P = () => <Value />;", 'default'],
      ["import * as Leaf from './leaf'; export const P = () => <Leaf.Weather />;", 'Weather']]) {
      fs.writeFileSync(path.join(root, 'src/parent.tsx'), source);
      assert.equal(api.inspectPacketMounts({ ...packet, mountPoints: [{ ...packet.mountPoints[0], symbol }] }, [], { repoRoot: root })[0].jsxReferences, 1);
    }
    fs.writeFileSync(path.join(root, 'src/parent.tsx'), "import { Weather } from './leaf'; throw Error('DO NOT EXECUTE');");
    const noRender = api.inspectPacketMounts(packet, [], { repoRoot: root })[0];
    assert.equal(noRender.importVerified, true); assert.equal(noRender.jsxReferences, 0, 'an import is not a mount/render claim');
  });
});

test('WF214: false parents, comments, strings, type-only and unresolved imports cannot prove an existing relationship', () => {
  assert.equal(typeof api.inspectPacketMounts, 'function');
  fixture((root, packet) => {
    for (const source of ["// import { Weather } from './leaf';\nexport const P = () => null;",
      "const decoy = \"import { Weather } from './leaf'\";", "import type { Weather } from './leaf';",
      "import { type Weather } from './leaf';", "export { Weather } from './leaf';",
      "import { Weather } from './missing';", 'import { Weather } from ;']) {
      fs.writeFileSync(path.join(root, 'src/parent.tsx'), source);
      assert.throws(() => api.inspectPacketMounts(packet, [], { repoRoot: root }), /WF-G214/);
    }
  });
});

test('WF214: exact schemas, owned parent/leaf and containment are mandatory; planned new-file intent stays explicitly unverified', () => {
  assert.equal(typeof api.inspectPacketMounts, 'function');
  fixture((root, packet) => {
    const entry = packet.mountPoints[0];
    for (const patch of [{ leaf: '../outside.tsx' }, { parent: 'C:/outside.tsx' }, { leaf: 'src/*.tsx' },
      { symbol: '' }, { relation: 'assumed' }, { delivery: 'automatic' }, { typo: true },
      { followUpTask: 'agora-follow' }, { leaf: 'src/missing.tsx' }]) {
      assert.throws(() => api.inspectPacketMounts({ ...packet, mountPoints: [{ ...entry, ...patch }] }, [], { repoRoot: root }), /WF-G214/);
    }
    for (const files of [['src/leaf.tsx'], ['src/parent.tsx'], []]) {
      assert.throws(() => api.inspectPacketMounts({ ...packet, files }, [], { repoRoot: root }), /WF-G214/);
    }
    assert.throws(() => api.inspectPacketMounts({ ...packet, mountPoints: [entry, entry] }, [], { repoRoot: root }), /duplicate/);
    const planned = { ...packet, files: ['src/new-leaf.tsx', 'src/new-parent.tsx'], mountPoints: [{ ...entry,
      leaf: 'src/new-leaf.tsx', parent: 'src/new-parent.tsx', relation: 'planned', reason: 'New feature in new parent; no existing import claim.' }] };
    assert.equal(api.inspectPacketMounts(planned, [], { repoRoot: root })[0].importVerified, false);
    delete planned.mountPoints[0].reason;
    assert.throws(() => api.inspectPacketMounts(planned, [], { repoRoot: root }), /reason/);
    assert.deepEqual(api.inspectPacketMounts({ id: 'plain', files: [] }), []);
  });
});

test('WF214: deferred mounting requires an exact current unfinished follow-up, parent obligation and blocking build dependency', () => {
  assert.equal(typeof api.inspectPacketMounts, 'function');
  fixture((root, packet) => {
    packet.files = ['src/leaf.tsx']; Object.assign(packet.mountPoints[0], { delivery: 'deferred', followUpTask: 'agora-follow' });
    const build = { id: 'agora-build', state: 'claimed', campaignId: 'agora-wave' };
    const follow = { id: 'agora-follow', state: 'open', campaignId: 'agora-wave', refs: ['src/parent.tsx'],
      deps: [{ id: build.id, type: 'blocks' }], body: api.mountFollowUpLine(packet.mountPoints[0]) };
    assert.equal(api.inspectPacketMounts(packet, [build, follow], { repoRoot: root })[0].followUpVerified, true);
    for (const patch of [{ state: 'done' }, { campaignId: 'agora-other' }, { campaignId: null }, { refs: [] }, { deps: [] },
      { deps: [{ id: build.id, type: 'discovered-from' }] }, { body: 'Unrelated work' }]) {
      assert.throws(() => api.inspectPacketMounts(packet, [build, { ...follow, ...patch }], { repoRoot: root }), /WF-G214/);
    }
    assert.throws(() => api.inspectPacketMounts(packet, [build], { repoRoot: root }), /follow-up/);
    assert.throws(() => api.inspectPacketMounts(packet, [follow], { repoRoot: root }), /build/);
    assert.throws(() => api.inspectPacketMounts({ ...packet, files: ['src/leaf.tsx', 'src/parent.tsx'] }, [build, follow], { repoRoot: root }), /already owns/);
  });
});

test('WF214: a repository-relative mount path cannot read source through an external junction', () => {
  assert.equal(typeof api.inspectPacketMounts, 'function');
  fixture((root, packet) => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-mount-outside-'));
    try {
      fs.writeFileSync(path.join(outside, 'parent.tsx'), "import { Weather } from '../leaf';");
      fs.symlinkSync(outside, path.join(root, 'src/linked'), process.platform === 'win32' ? 'junction' : 'dir');
      packet.files.push('src/linked/parent.tsx'); packet.mountPoints[0].parent = 'src/linked/parent.tsx';
      assert.throws(() => api.inspectPacketMounts(packet, [], { repoRoot: root }), /outside.*repository/);
    } finally {
      fs.unlinkSync(path.join(root, 'src/linked'));
      assert.equal(path.dirname(outside), fs.realpathSync(os.tmpdir())); fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});
