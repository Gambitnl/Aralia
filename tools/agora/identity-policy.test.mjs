/**
 * These tests protect Agora's mandatory task/thread provenance classifier.
 * They keep human dashboard identities usable while preventing Codex workers
 * and governance roles from entering Presence without a traceable thread.
 *
 * Called by: Node's built-in test runner
 * Depends on: identity-policy.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeThreadId,
  registrationThreadRequirement,
  validateRegistrationThreadIdentity,
} from './identity-policy.mjs';

test('task/thread policy recognizes governance and Codex identity markers', () => {
  assert.equal(registrationThreadRequirement({ role: 'orchestrator' }), 'orchestrator');
  assert.equal(registrationThreadRequirement({ role: 'master' }), 'orchestrator');
  assert.equal(registrationThreadRequirement({ type: 'codex-cli' }), 'codex');
  assert.equal(registrationThreadRequirement({ model: 'gpt-5.6-sol' }), 'codex');
  assert.equal(registrationThreadRequirement({ model: 'gpt-5.3-codex-spark' }), 'codex');
  assert.equal(registrationThreadRequirement({ handle: 'codex-worker-42' }), 'codex');
});

test('human and non-Codex worker registrations remain outside the Codex gate', () => {
  assert.equal(registrationThreadRequirement({ role: 'human', model: 'gpt-5.6-sol' }), null);
  assert.equal(registrationThreadRequirement({ handle: 'claude-worker', model: 'claude-opus-4-8' }), null);
  assert.equal(registrationThreadRequirement({ handle: 'agora-watchdog', type: 'service' }), null);
});

test('required registrations reject blank ids and normalize accepted ids', () => {
  assert.deepEqual(validateRegistrationThreadIdentity({ handle: 'codex-worker' }), {
    ok: false,
    required: true,
    requirement: 'codex',
    sessionId: '',
    error: 'task/thread id is required as sessionId for codex registration; pass --session <id>',
  });
  assert.deepEqual(validateRegistrationThreadIdentity({ role: 'orchestrator', sessionId: '  thread-123  ' }), {
    ok: true,
    required: true,
    requirement: 'orchestrator',
    sessionId: 'thread-123',
  });
  assert.equal(normalizeThreadId(null), '');
});
