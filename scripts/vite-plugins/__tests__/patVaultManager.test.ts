/**
 * This file checks the PAT Vault's Windows Credential Manager contract.
 *
 * The vault is a local operator page, so these tests focus on the behavior that
 * other code relies on: stable Windows credential target names and status
 * calculation when a token is stored in DPAPI-backed Windows Credential Manager
 * instead of an environment variable or sidecar file.
 *
 * Called by: Vitest when agents run the focused PAT Vault checks.
 * Depends on: patVaultManager helper exports.
 */
import { describe, expect, test } from 'vitest';

import { credentialManagerTarget, statusOf } from '../patVaultManager';

// ============================================================================
// Credential Manager Contract
// ============================================================================
// These tests do not write real credentials. They verify the pure helpers that
// keep every browser card, API route, and Windows cmdkey call pointed at the
// same generic credential target.
// ============================================================================

describe('patVaultManager Windows Credential Manager support', () => {
  test('uses a stable Aralia-scoped generic credential target', () => {
    expect(credentialManagerTarget('qoder-bob')).toBe('AraliaPATVault:qoder-bob');
  });

  test('treats Credential Manager presence as an active token source', () => {
    expect(statusOf({}, false, false, true)).toBe('active');
  });

  test('keeps static OAuth and subscription statuses authoritative', () => {
    expect(statusOf({ staticStatus: 'pending' }, false, false, true)).toBe('pending');
  });
});
