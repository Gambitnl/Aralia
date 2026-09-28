import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pathIsWildkin, scopeRecords } from './wildkin-scope.mjs';

test('Wildkin path scope accepts repo-relative and Windows absolute paths without matching sibling repos', () => {
  assert.equal(pathIsWildkin('Wildkin/src/chat/render.js'), true);
  assert.equal(pathIsWildkin('F:\\Repos\\Wildkin\\src\\chat\\render.js'), true);
  assert.equal(pathIsWildkin('file:///F:/Repos/Wildkin/src/chat/render.js'), true);
  assert.equal(pathIsWildkin('F:/Repos/Aralia/src/chat/render.js'), false);
  assert.equal(pathIsWildkin('Wildkin-extra/src/chat/render.js'), false);
});

test('Wildkin board scopes all seven panels without importing unrelated Agora traffic', () => {
  const campaigns = [
    { id: 'agora-wild-campaign', name: 'Wildkin sprint', paths: ['Wildkin/src'] },
    { id: 'agora-aralia-campaign', name: 'Aralia sprint', paths: ['src'] },
  ];
  const tasks = [
    { id: 'agora-wild.1', campaignId: 'agora-wild-campaign', refs: ['src/other.ts'] },
    { id: 'agora-wild.2', refs: ['F:/Repos/Wildkin/src/chat/render.js'] },
    { id: 'agora-aralia.1', campaignId: 'agora-aralia-campaign', refs: ['src/chat/render.js'] },
  ];
  const locks = [
    { id: 'wild-lock', paths: ['Wildkin/src/chat/render.js'] },
    { id: 'aralia-lock', paths: ['src/chat/render.js'] },
  ];
  const reservations = [
    { id: 'wild-reservation', paths: ['F:/Repos/Wildkin/src/chat/render.js'] },
    { id: 'aralia-reservation', paths: ['src/chat/render.js'] },
  ];
  const messages = [
    { id: 'wild-command', channel: 'command', body: 'Wildkin: prepare the chat fix' },
    { id: 'wild-task-message', channel: 'main', body: 'agora-wild.2 is ready' },
    { id: 'wild-campaign-message', channel: 'main', body: 'agora-wild-campaign is active' },
    { id: 'false-prefix', channel: 'main', body: 'agora-wild.20 is ready' },
    { id: 'false-word', channel: 'main', body: 'NotWildkin is a different name' },
    { id: 'aralia-message', channel: 'main', body: 'Aralia work is ready', from: 'wildkin-agent' },
  ];
  const scoped = scopeRecords(tasks, campaigns, locks, reservations, messages);
  assert.deepEqual(scoped.campaigns.map((item) => item.id), ['agora-wild-campaign']);
  assert.deepEqual(scoped.tasks.map((item) => item.id), ['agora-wild.1', 'agora-wild.2']);
  assert.deepEqual(scoped.locks.map((item) => item.id), ['wild-lock']);
  assert.deepEqual(scoped.reservations.map((item) => item.id), ['wild-reservation']);
  assert.deepEqual(scoped.messages.map((item) => item.id), [
    'wild-command', 'wild-task-message', 'wild-campaign-message',
  ]);
});
