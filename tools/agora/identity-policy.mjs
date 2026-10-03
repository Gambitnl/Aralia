/**
 * This file defines the registration provenance Agora requires before an AI
 * agent may enter Presence. The store and CLI share these pure rules so a
 * client-side preflight can never promise a weaker contract than the daemon.
 *
 * Called by: store.mjs, client.mjs, and identity-policy.test.mjs
 * Depends on: no runtime state; inputs are registration fields only
 */

// ============================================================================
// Task/Thread Identity Gate
// ============================================================================
// Humans using the dashboard do not have a Codex task id. Elevated fleet roles
// always need traceable provenance, while workers are gated when their declared
// runtime, model, or conventional handle identifies them as Codex.
// ============================================================================

export function normalizeThreadId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function registrationThreadRequirement({ handle, model, type, role } = {}) {
  const normalizedRole = String(role || 'worker').trim().toLowerCase();
  if (normalizedRole === 'human') return null;
  if (normalizedRole === 'orchestrator' || normalizedRole === 'master') return 'orchestrator';

  const normalizedType = String(type || '').trim().toLowerCase();
  const normalizedModel = String(model || '').trim().toLowerCase();
  const normalizedHandle = String(handle || '').trim().toLowerCase();
  const codexRuntime = normalizedType.includes('codex');
  const codexModel = normalizedModel.includes('codex') || /^gpt(?:[-./]|$)/.test(normalizedModel);
  const codexHandle = /^codex(?:[-._/]|$)/.test(normalizedHandle);
  return codexRuntime || codexModel || codexHandle ? 'codex' : null;
}

export function validateRegistrationThreadIdentity(registration = {}) {
  const requirement = registrationThreadRequirement(registration);
  const sessionId = normalizeThreadId(registration.sessionId);
  if (!requirement || sessionId) return { ok: true, required: Boolean(requirement), requirement, sessionId };
  return {
    ok: false,
    required: true,
    requirement,
    sessionId: '',
    error: `task/thread id is required as sessionId for ${requirement} registration; pass --session <id>`,
  };
}
