/**
 * This file proves that Agora board states and live events select the intended
 * Codex pet animation rows. It protects the operator dashboard from silently
 * showing an unrelated action when coordination event shapes evolve.
 *
 * Called by: Node's built-in test runner
 * Depends on: pet-actions.mjs, which contains the shared mapping policy
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PET_ACTIONS,
  PRESENCE_CEREMONIES,
  petReactionsForEvent,
  presenceCeremonyForEvent,
  steadyAgentPetAction,
  taskPetAction,
} from './pet-actions.mjs';

// ============================================================================
// Atlas and Persistent State
// ============================================================================
// These checks cover all nine atlas rows and the precedence operators rely on
// when an agent owns more than one kind of Agora record.
// ============================================================================

test('pet atlas exposes every fixed action row exactly once', () => {
  assert.deepEqual(
    Object.values(PET_ACTIONS).map((action) => action.row).sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
  );
});

test('presence ceremonies walk, speak, tap, and reverse through valid atlas rows', () => {
  assert.deepEqual(
    PRESENCE_CEREMONIES['check-in'].map((step) => step.phase),
    ['walk-in', 'wave-hello', 'announce-arrival', 'approach-pad', 'tap-in'],
  );
  assert.deepEqual(
    PRESENCE_CEREMONIES['check-out'].map((step) => step.phase),
    ['announce-departure', 'tap-out', 'walk-back', 'wave-goodbye', 'walk-out'],
  );
  for (const steps of Object.values(PRESENCE_CEREMONIES)) {
    assert.ok(steps.every((step) => PET_ACTIONS[step.action]));
    assert.equal(steps.filter((step) => step.speech).length, 1);
    assert.ok(steps.filter((step) => step.speech).every((step) => step.durationMs >= 3000));
  }
  assert.equal(PRESENCE_CEREMONIES['check-in'].filter((step) => step.tap).length, 1);
  assert.equal(PRESENCE_CEREMONIES['check-out'].filter((step) => step.tap).length, 1);
  assert.equal(PRESENCE_CEREMONIES['task-claim'].filter((step) => step.tap).length, 0);
  assert.equal(PRESENCE_CEREMONIES['check-in'].at(-1).position, 'pad');
  assert.equal(PRESENCE_CEREMONIES['check-out'].at(-1).position, 'end');
});

test('presence event resolver uses the arrival payload and the pre-drop roster snapshot', () => {
  const agent = { id: 'agent-a', handle: 'worker.a', pet: { slug: 'gf-sd' } };
  assert.deepEqual(
    presenceCeremonyForEvent('agent.register', { agent }, []),
    { kind: 'check-in', initialPosition: 'start', agent, speech: 'Hi! worker.a signing in!' },
  );
  assert.deepEqual(
    presenceCeremonyForEvent('agent.drop', { agentId: 'agent-a' }, [agent]),
    { kind: 'check-out', initialPosition: 'pad', agent, speech: 'worker.a signing out!' },
  );
  assert.deepEqual(
    presenceCeremonyForEvent(
      'task.claim',
      { taskId: 'task-a', agentId: 'agent-a' },
      [agent],
      [{ id: 'task-a', title: 'Trace the signal' }],
    ),
    { kind: 'task-claim', initialPosition: 'mid', agent, speech: "I'm taking on task Trace the signal!" },
  );
  assert.equal(presenceCeremonyForEvent('agent.drop', { agentId: 'missing' }, [agent]), null);
  assert.equal(presenceCeremonyForEvent('agent.register', { agent: { id: 'petless' } }, []), null);
  assert.equal(presenceCeremonyForEvent('task.claim', { taskId: 'missing', agentId: 'agent-a' }, [agent], []), null);
  assert.equal(presenceCeremonyForEvent('agent.touch', {}, [agent]), null);
});

test('task state maps to working, waiting, failure, completion, or rest', () => {
  assert.equal(taskPetAction({ state: 'open' }), 'idle');
  assert.equal(taskPetAction({ state: 'claimed' }), 'waiting');
  assert.equal(taskPetAction({ state: 'in_progress' }), 'running');
  assert.equal(taskPetAction({ state: 'blocked' }), 'failed');
  assert.equal(taskPetAction({ state: 'done' }), 'jumping');
});

test('steady agent action prefers task urgency before files, queues, and campaigns', () => {
  const common = {
    agentId: 'agent-a',
    locks: [{ agentId: 'agent-a' }],
    reservations: [{ agentId: 'agent-a' }],
    campaigns: [{ agentId: 'agent-a', state: 'active' }],
  };

  assert.equal(steadyAgentPetAction({ ...common, tasks: [{ claimedBy: 'agent-a', state: 'blocked' }] }), 'failed');
  assert.equal(steadyAgentPetAction({ ...common, tasks: [{ claimedBy: 'agent-a', state: 'in_progress' }] }), 'running');
  assert.equal(steadyAgentPetAction({ ...common, tasks: [{ claimedBy: 'agent-a', state: 'claimed' }] }), 'waiting');
  assert.equal(steadyAgentPetAction({ ...common, tasks: [] }), 'running');
  assert.equal(steadyAgentPetAction({ ...common, tasks: [], locks: [] }), 'waiting');
  assert.equal(steadyAgentPetAction({ ...common, tasks: [], locks: [], reservations: [] }), 'review');
  assert.equal(steadyAgentPetAction({ agentId: 'agent-a' }), 'idle');
});

// ============================================================================
// Momentary Event Reactions
// ============================================================================
// Every event assertion checks the actual actor id as well as the animation.
// This matters for handoffs, where two different pets react to one event.
// ============================================================================

test('file and reservation events use directional, waiting, and success actions', () => {
  assert.deepEqual(petReactionsForEvent('lock.acquire', { lock: { agentId: 'a' } }), [{ agentId: 'a', action: 'running-right' }]);
  assert.deepEqual(petReactionsForEvent('lock.release', { agentId: 'a' }), [{ agentId: 'a', action: 'running-left' }]);
  assert.deepEqual(petReactionsForEvent('lock.expired', { agentId: 'a' }), [{ agentId: 'a', action: 'failed' }]);
  assert.deepEqual(petReactionsForEvent('reservation.create', { reservation: { agentId: 'a' } }), [{ agentId: 'a', action: 'waiting' }]);
  assert.deepEqual(petReactionsForEvent('reservation.fulfill', { agentId: 'a' }), [{ agentId: 'a', action: 'jumping' }]);
});

test('task lifecycle and handoff events animate the responsible pets', () => {
  assert.deepEqual(petReactionsForEvent('task.claim', { agentId: 'a' }), [{ agentId: 'a', action: 'jumping' }]);
  assert.deepEqual(petReactionsForEvent('task.state', { agentId: 'a', state: 'in_progress' }), [{ agentId: 'a', action: 'running' }]);
  assert.deepEqual(petReactionsForEvent('task.state', { agentId: 'a', state: 'blocked' }), [{ agentId: 'a', action: 'failed' }]);
  assert.deepEqual(petReactionsForEvent('task.handoff', { agentId: 'a', toAgentId: 'b' }), [
    { agentId: 'a', action: 'waving' },
    { agentId: 'b', action: 'jumping' },
  ]);
});

test('communication and governance events use waving and review actions', () => {
  assert.deepEqual(petReactionsForEvent('message.post', { message: { from: 'a' } }), [{ agentId: 'a', action: 'waving' }]);
  assert.deepEqual(petReactionsForEvent('campaign.claim', { campaign: { agentId: 'a' } }), [{ agentId: 'a', action: 'review' }]);
  assert.deepEqual(petReactionsForEvent('task.create', { task: { createdBy: 'a' } }), [{ agentId: 'a', action: 'review' }]);
});
