import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { run as runCandidate } from './client-runtime.mjs';
import { parseA2H } from './dashboard/a2h-feed.mjs';

/**
 * Proves `say --need --ref` writes a tagged agent-to-human (A2H) message that
 * the dashboard feed parses, addresses it to the live human, and refuses a bad
 * need, an unknown board reference, or empty text without posting anything.
 *
 * Exercises: client-runtime.mjs cmdSay (A2H mode)
 */

test('say --need --ref posts a parseable A2H message to the live human, and refuses bad input', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-a2h-say-'));
  const app = createAgoraServer({ dir: path.join(dir, 'daemon') });
  await new Promise((resolve) => app.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  const agent = { baseUrl, env: { AGORA_DIR: path.join(dir, 'identity'), AGORA_AGENT_ID: 'a2h-agent' } };
  const human = { baseUrl, env: { AGORA_DIR: path.join(dir, 'identity'), AGORA_AGENT_ID: 'a2h-human' } };
  try {
    assert.equal((await runCandidate(['register', 'a2h-agent', '--pet', 'dream-girl'], agent)).code, 0);
    assert.equal((await runCandidate(['register', 'Remy', '--pet', 'gf-sd', '--role', 'human'], human)).code, 0);
    const created = await runCandidate(['task', 'new', 'A2H fixture', '--standalone', '--reason', 'disposable fixture', '--body', 'fixture'], agent);
    assert.equal(created.code, 0, created.lines.join('\n'));
    const taskId = /Task created: (\S+)/.exec(created.lines.join('\n'))?.[1];
    assert.ok(taskId, created.lines.join('\n'));
    const agents = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    const humanId = agents.agents.find((entry) => entry.handle === 'Remy').id;
    const countMessages = async () => (await fetch(`${baseUrl}/messages?channel=all`).then((response) => response.json())).messages.length;

    const sent = await runCandidate(['say', '--need', 'decision', '--ref', taskId, 'Should the queue adapter go live?'], agent);
    assert.equal(sent.code, 0, sent.lines.join('\n'));
    assert.equal(sent.message.to, humanId);
    assert.deepEqual(parseA2H(sent.message.body), { need: 'decision', ref: taskId, text: 'Should the queue adapter go live?' });

    const before = await countMessages();
    const badNeed = await runCandidate(['say', '--need', 'urgent', '--ref', taskId, 'text'], agent);
    assert.equal(badNeed.code, 1);
    assert.match(badNeed.lines.join('\n'), /--need must be one of/);
    const unknownRef = await runCandidate(['say', '--need', 'info', '--ref', 'agora-nope.9', 'text'], agent);
    assert.equal(unknownRef.code, 1);
    assert.match(unknownRef.lines.join('\n'), /is not a task or campaign/);
    const missingRef = await runCandidate(['say', '--need', 'info', 'text'], agent);
    assert.equal(missingRef.code, 1);
    assert.equal(await countMessages(), before, 'a refused A2H message posts nothing');
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  }
});
