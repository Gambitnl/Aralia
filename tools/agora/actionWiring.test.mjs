// Synthetic routes reconstruct the registry's missing wiring, not old tasks.
// Every fixture is private; no game module executes and no path is granted.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-action-wiring-'));
  const sources = {
    'src/state/actionTypes.ts': "export type AppAction = { type: 'MOVE_ITEM'; payload: { itemId: string } } | { type: 'END_BATTLE'; payload: { finalEnemyState: string[] } };",
    'src/state/reducers/characterReducer.ts': "export function reducer(action: any) { switch(action.type) { case 'MOVE_ITEM': return action.payload.itemId; case 'END_BATTLE': return action.payload.finalEnemyState; } }",
    'src/types/actions.ts': "export type ActionType = 'MOVE_ITEM'; export type Action = { type: 'MOVE_ITEM'; payload: { itemId: string } }; export const ACTION_METADATA = { MOVE_ITEM: { isUiToggle: true } };",
    'src/hooks/actions/actionHandlers.ts': "export const handlers = { MOVE_ITEM: (action: any) => { dispatch({ type: 'MOVE_ITEM', payload: action.payload }); } };",
    'src/components/Inventory.tsx': "export function Inventory() { onAction({ type: 'MOVE_ITEM', payload: { itemId: 'one' } }); }",
    'src/utils/combat/battleEndActions.ts': "export const createBattleEndActions = (finalEnemyState: string[]) => [{ type: 'END_BATTLE', payload: { finalEnemyState } }];",
    'src/App.tsx': "import { createBattleEndActions as build } from './utils/combat/battleEndActions'; export function App(finalEnemyState: string[]) { return build(finalEnemyState); }",
  };
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  for (const [file, text] of Object.entries(sources)) write(file, text);
  const role = file => ({ file, quote: sources[file], change: true });
  const ui = { id: 'inventory-ui', kind: 'ui', action: 'MOVE_ITEM', relation: 'existing', reason: 'Preserve the complete inventory UI dispatch route.', payloadFields: ['itemId'], metadataExpectation: { isUiToggle: true }, roles: {
    stateType: role('src/state/actionTypes.ts'), reducer: role('src/state/reducers/characterReducer.ts'), uiType: role('src/types/actions.ts'), metadata: role('src/types/actions.ts'), handler: role('src/hooks/actions/actionHandlers.ts'), emitter: role('src/components/Inventory.tsx'),
  } };
  const payload = { id: 'battle-payload', kind: 'payload', action: 'END_BATTLE', relation: 'existing', reason: 'Forward the final enemy outcomes into the reducer.', payloadFields: ['finalEnemyState'], builderExport: 'createBattleEndActions', roles: {
    stateType: role('src/state/actionTypes.ts'), reducer: role('src/state/reducers/characterReducer.ts'), builder: role('src/utils/combat/battleEndActions.ts'), caller: role('src/App.tsx'),
  } };
  const packet = { id: 'PK-17-fixture', files: ['src/state/actionTypes.ts', 'src/state/reducers/characterReducer.ts', 'src/components/Inventory.tsx', 'src/App.tsx'], actionWiring: [ui, payload] };
  const cleanup = () => { assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); assert.match(path.basename(root), /^agora-action-wiring-/); fs.rmSync(root, { recursive: true, force: true }); };
  return { root, sources, write, ui, payload, packet, cleanup };
}

test('WF237: registry-backed UI and payload omissions expose all three required files without widening scope', async () => {
  const { inspectPacketActionWiring } = await import('./actionWiring.mjs'); const f = fixture();
  try {
    const before = structuredClone(f.packet), result = inspectPacketActionWiring(f.packet, { repoRoot: f.root });
    for (const file of ['src/types/actions.ts', 'src/hooks/actions/actionHandlers.ts', 'src/utils/combat/battleEndActions.ts']) assert.ok(result.references.includes(file));
    assert.equal(result.entries.every(entry => entry.syntaxVerified), true); assert.deepEqual(f.packet, before);
    assert.deepEqual(result.entries[1].roles.map(role => role.name), ['stateType', 'reducer', 'builder', 'caller']);
  } finally { f.cleanup(); }
});

test('WF237: missing metadata, forwarding and discriminated action declarations refuse current relationships', async () => {
  const { inspectPacketActionWiring } = await import('./actionWiring.mjs');
  for (const [file, transform] of [
    ['src/types/actions.ts', text => text.replace('isUiToggle: true', 'isUiToggle: false')],
    ['src/types/actions.ts', text => text.replace("export type ActionType = 'MOVE_ITEM'", "export type ActionType = 'OTHER'")],
    ['src/hooks/actions/actionHandlers.ts', text => text.replace("type: 'MOVE_ITEM'", "type: 'OTHER'")],
    ['src/state/reducers/characterReducer.ts', text => text.replace("case 'MOVE_ITEM'", "case 'OTHER'")],
  ]) {
    const f = fixture(); try {
      f.write(file, transform(f.sources[file]));
      for (const entry of f.packet.actionWiring) for (const role of Object.values(entry.roles)) if (role.file === file) role.quote = fs.readFileSync(path.join(f.root, file), 'utf8');
      assert.throws(() => inspectPacketActionWiring(f.packet, { repoRoot: f.root }), /WF-G237/);
    } finally { f.cleanup(); }
  }
});

test('WF237: payload builder must actually construct each field and caller must resolve the declared export', async () => {
  const { inspectPacketActionWiring } = await import('./actionWiring.mjs');
  for (const [file, transform] of [
    ['src/utils/combat/battleEndActions.ts', text => text.replace('payload: { finalEnemyState }', 'payload: {}')],
    ['src/App.tsx', text => text.replace('return build(', 'return unconnected(')],
  ]) {
    const f = fixture(); try {
      f.packet.actionWiring = [f.payload]; f.write(file, transform(f.sources[file]));
      for (const role of Object.values(f.payload.roles)) if (role.file === file) role.quote = fs.readFileSync(path.join(f.root, file), 'utf8');
      assert.throws(() => inspectPacketActionWiring(f.packet, { repoRoot: f.root }), /WF-G237/);
    } finally { f.cleanup(); }
  }
});

test('WF237: stale anchors, unsupported syntax, malformed roles and limits stay unresolved', async () => {
  const { inspectPacketActionWiring } = await import('./actionWiring.mjs'); const f = fixture();
  try {
    for (const change of [p => { p.actionWiring[0].roles.handler.quote = 'not current'; }, p => { delete p.actionWiring[0].roles.uiType; },
      p => { p.actionWiring[0].roles.handler.file = '../outside.ts'; }, p => { p.actionWiring[0].roles.handler.extra = true; },
      p => { p.actionWiring[0].payloadFields = ['itemId', 'itemId']; }, p => { p.actionWiring[0].reason = 'TBD'; },
      p => { p.actionWiring = Array(17).fill(p.actionWiring[0]); }, p => { p.actionWiring[0].extra = true; }]) {
      const packet = structuredClone(f.packet); change(packet); assert.throws(() => inspectPacketActionWiring(packet, { repoRoot: f.root }), /WF-G237/);
    }
    f.write('src/hooks/actions/actionHandlers.ts', f.sources['src/hooks/actions/actionHandlers.ts'] + '\nconst broken = ;');
    assert.throws(() => inspectPacketActionWiring(f.packet, { repoRoot: f.root }), /syntax/);
  } finally { f.cleanup(); }
});

test('WF237: planned relationships and reviewed read-only roles do not masquerade as built delivery', async () => {
  const { inspectPacketActionWiring, actionWiringPromptBlock } = await import('./actionWiring.mjs'); const f = fixture();
  try {
    f.ui.relation = 'planned'; f.ui.action = 'NEW_ACTION';
    const context = f.ui.roles.uiType; context.change = false; context.reason = 'Existing UI type context is only being inspected for this planned route.';
    const result = inspectPacketActionWiring(f.packet, { repoRoot: f.root }); assert.equal(result.entries[0].syntaxVerified, false);
    // The same file still needs ownership because metadata is a declared edit.
    assert.ok(result.references.includes(context.file)); assert.match(actionWiringPromptBlock(f.packet), /PLANNED|planned/);
    delete context.reason; assert.throws(() => inspectPacketActionWiring(f.packet, { repoRoot: f.root }), /read-only/);
    context.reason = 'The current UI type is inspected without changing its contract.';
    f.ui.roles.emitter = {file:'src/components/NewInventory.tsx',newFile:true,change:true,reason:'Parent assigns this exact new emitter for planned delivery.'};
    assert.ok(inspectPacketActionWiring(f.packet,{repoRoot:f.root}).references.includes(f.ui.roles.emitter.file));
    f.write(f.ui.roles.emitter.file,'export const existing = true;');
    assert.throws(()=>inspectPacketActionWiring(f.packet,{repoRoot:f.root}),/stale/);
  } finally { f.cleanup(); }
});

test('WF237: core reducer and AppAction edits need affected routes or a current justified unchanged review', async () => {
  const { inspectPacketActionWiring } = await import('./actionWiring.mjs'); const f = fixture();
  try {
    const packet = { id: 'PK-core', files: f.packet.files.slice(0, 2) };
    assert.throws(() => inspectPacketActionWiring(packet, { repoRoot: f.root }), /audit/);
    packet.actionWiringReview = { reason: 'Only source comments change; action names, dispatch and payload contracts are unchanged.', sources: packet.files.map(file => ({ file, quote: f.sources[file] })) };
    const result = inspectPacketActionWiring(packet, { repoRoot: f.root }); assert.equal(result.references.length, 0);
    assert.equal(result.review.current, true); packet.actionWiringReview.sources.pop(); assert.throws(() => inspectPacketActionWiring(packet, { repoRoot: f.root }), /unreviewed/);
  } finally { f.cleanup(); }
});

test('WF237: stale or dropped durable task routes require parent reconciliation, not silent plan replacement', async () => {
  const { assertTaskActionWiring } = await import('./actionWiring.mjs'); const f = fixture();
  try {
    const task = { id:'agora-fixture', body:'REFERENCE-ONLY: ACTION-WIRING: '+JSON.stringify(f.ui) };
    assert.doesNotThrow(()=>assertTaskActionWiring(f.packet,task));
    assert.throws(()=>assertTaskActionWiring({...f.packet,actionWiring:[]},task),/WF-G237/);
    const changed = structuredClone(f.packet); changed.actionWiring[0].roles.handler.change = false;
    assert.throws(()=>assertTaskActionWiring(changed,task),/differs|different/);
    assert.throws(()=>assertTaskActionWiring(f.packet,{...task,body:task.body+'\n'+task.body}),/duplicate/);
    assert.throws(()=>assertTaskActionWiring(f.packet,{...task,body:'ACTION-WIRING: {bad'}),/JSON/);
  } finally { f.cleanup(); }
});

test('WF237: stale or dropped durable task routes require parent reconciliation, not silent plan replacement', async () => {
  const { assertTaskActionWiring } = await import('./actionWiring.mjs'); const f = fixture();
  try {
    const task = { id:'agora-fixture', body:'REFERENCE-ONLY: ACTION-WIRING: '+JSON.stringify(f.ui) };
    assert.doesNotThrow(()=>assertTaskActionWiring(f.packet,task));
    assert.throws(()=>assertTaskActionWiring({...f.packet,actionWiring:[]},task),/WF-G237/);
    const changed = structuredClone(f.packet); changed.actionWiring[0].roles.handler.change = false;
    assert.throws(()=>assertTaskActionWiring(changed,task),/differs|different/);
    assert.throws(()=>assertTaskActionWiring(f.packet,{...task,body:task.body+'\n'+task.body}),/duplicate/);
    assert.throws(()=>assertTaskActionWiring(f.packet,{...task,body:'ACTION-WIRING: {bad'}),/JSON/);
  } finally { f.cleanup(); }
});
