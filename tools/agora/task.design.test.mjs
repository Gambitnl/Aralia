import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { createStore } from './store.mjs';
import { run } from './client.mjs';

test('WF-G304: multiline design is durable and legacy design checkpoints render as a block', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-task-design-'));
  const dataDir = path.join(root, 'data');
  const env = { AGORA_DIR: path.join(root, 'identity'), AGORA_AGENT_ID: 'design-test', AGORA_PET: 'gf-sd' };
  const app = createAgoraServer({ dir: dataDir });
  let listening = false;
  try {
    await new Promise((resolve) => app.listen(0, resolve));
    listening = true;
    const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
    const cli = (argv) => run(argv, { env, baseUrl });
    const reg = await cli(['register', 'design-test', '--pet', 'gf-sd']);
    assert.equal(reg.code, 0, reg.lines.join('\n'));

    const created = await cli([
      'task', 'new', 'Design the biome transition', '--standalone', '--reason', 'design handoff',
      '--body', 'Write a design first, then return the task to open for implementation.',
    ]);
    assert.equal(created.code, 0, created.lines.join('\n'));
    const taskId = created.task.id;
    const firstDesign = 'Goal: soften the shared atlas-cell edge.\n1. Pass neighbour biome context.\n2. Preserve the old seed stream.';
    const saved = await cli(['task', 'design', taskId, '--text', firstDesign]);
    assert.equal(saved.code, 0, saved.lines.join('\n'));
    assert.equal(saved.task.design, firstDesign);

    const designPath = path.join(root, 'design.txt');
    const finalDesign = 'Goal: soften the shared atlas-cell edge.\n1. Pass neighbour biome context.\n2. Preserve the old seed stream.\n3. Pin identical output without neighbours.\n';
    fs.writeFileSync(designPath, finalDesign, 'utf8');
    const fromFile = await cli(['task', 'design', taskId, '--file', designPath]);
    assert.equal(fromFile.code, 0, fromFile.lines.join('\n'));
    assert.equal(fromFile.task.design, finalDesign);
    const listed = await (await fetch(`${baseUrl}/tasks`)).json();
    assert.equal(listed.tasks.find((task) => task.id === taskId).design, finalDesign);
    const shown = await cli(['task', 'show', taskId]);
    assert.equal(shown.code, 0, shown.lines.join('\n'));
    const designAt = shown.lines.indexOf('  design:');
    assert.ok(designAt >= 0, shown.lines.join('\n'));
    assert.deepEqual(shown.lines.slice(designAt + 1, designAt + 1 + finalDesign.split('\n').length),
      finalDesign.split('\n').map((line) => `    ${line}`));

    const ambiguous = await cli(['task', 'design', taskId, '--text', 'inline', '--file', designPath]);
    assert.equal(ambiguous.code, 1);
    const missing = await cli(['task', 'design', taskId, '--file', path.join(root, 'missing.txt')]);
    assert.equal(missing.code, 1);
    assert.equal((await (await fetch(`${baseUrl}/tasks`)).json()).tasks.find((task) => task.id === taskId).design, finalDesign);

    const legacy = await cli([
      'task', 'new', 'Legacy design handoff', '--standalone', '--reason', 'historical format',
      '--body', 'A worker wrote design in checkpoint.next.',
    ]);
    assert.equal(legacy.code, 0, legacy.lines.join('\n'));
    assert.equal((await cli(['task', 'claim', legacy.task.id])).code, 0);
    const oldNext = 'DESIGN (biome transitions) - not built:\n1. Pass neighbour context.\n2. Preserve the old seed.';
    const checkpoint = await cli(['task', 'checkpoint', legacy.task.id, '--did', 'design pass', '--next', oldNext]);
    assert.equal(checkpoint.code, 0, checkpoint.lines.join('\n'));
    const legacyShown = await cli(['task', 'show', legacy.task.id]);
    assert.equal(legacyShown.code, 0, legacyShown.lines.join('\n'));
    const legacyAt = legacyShown.lines.indexOf('  design (legacy checkpoint.next):');
    assert.ok(legacyAt >= 0, legacyShown.lines.join('\n'));
    assert.deepEqual(legacyShown.lines.slice(legacyAt + 1, legacyAt + 1 + oldNext.split('\n').length),
      oldNext.split('\n').map((line) => `    ${line}`));

    await app.close();
    listening = false;
    const reloaded = createStore({ dir: dataDir });
    try {
      assert.equal(reloaded.listTasks().find((task) => task.id === taskId).design, finalDesign);
    } finally {
      reloaded.close();
    }
  } finally {
    if (listening) await app.close();
    if (path.dirname(root) === os.tmpdir()) fs.rmSync(root, { recursive: true, force: true });
  }
});
