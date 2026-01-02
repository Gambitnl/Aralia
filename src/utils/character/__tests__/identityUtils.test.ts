/**
 * @file src/utils/__tests__/identityUtils.test.ts
 * Tests for the Identity System utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  createTrueIdentity,
  createAlias,
  createDisguise,
  createSecret,
  initializePlayerIdentity,
  switchPersona,
  learnSecret,
  verifySecret,
  checkDisguiseVulnerabilities,
} from '../identityUtils';

describe('Identity System', () => {
  describe('Factory Functions', () => {
    it('creates a true identity correctly', () => {
      const id = createTrueIdentity('Hero', 'A simple farmer');
      expect(id.name).toBe('Hero');
      expect(id.type).toBe('true');
      expect(id.history).toBe('A simple farmer');
    });

    it('creates an alias correctly', () => {
      const alias = createAlias('Snake', 'A shadowy thief', 50);
      expect(alias.name).toBe('Snake');
      expect(alias.type).toBe('alias');
      expect(alias.credibility).toBe(50);
    });
  });

  describe('Player Identity State', () => {
    it('initializes state correctly', () => {
      const state = initializePlayerIdentity('char-123', 'Aragorn');
      expect(state.characterId).toBe('char-123');
      expect(state.trueIdentity.name).toBe('Aragorn');
      expect(state.currentPersonaId).toBe(state.trueIdentity.id);
      expect(state.aliases).toHaveLength(0);
    });

    it('switches persona to an existing alias', () => {
      let state = initializePlayerIdentity('char-123', 'Bruce Wayne');
      const alias = createAlias('Batman', 'Vigilante');
      state = { ...state, aliases: [alias] };

      const newState = switchPersona(state, alias.id);
      expect(newState.currentPersonaId).toBe(alias.id);
    });

    it('throws error when switching to non-existent alias', () => {
      const state = initializePlayerIdentity('char-123', 'Bruce Wayne');
      expect(() => switchPersona(state, 'fake-id')).toThrow();
    });
  });

  describe('Secrets', () => {
    it('learns a new secret', () => {
      let state = initializePlayerIdentity('char-1', 'Spy');
      const secret = createSecret('king', 'The king is a doppelganger', 10);

      state = learnSecret(state, secret);
      expect(state.knownSecrets).toHaveLength(1);
      expect(state.knownSecrets[0].content).toBe('The king is a doppelganger');
    });

    it('does not duplicate known secrets', () => {
      let state = initializePlayerIdentity('char-1', 'Spy');
      const secret = createSecret('king', 'The king is a doppelganger', 10);

      state = learnSecret(state, secret);
      state = learnSecret(state, secret); // Try adding again

      expect(state.knownSecrets).toHaveLength(1);
    });

    it('verifies a secret and increases its value', () => {
      const secret = createSecret('duke', 'Stealing taxes', 5);
      expect(secret.verified).toBe(false);

      const verified = verifySecret(secret);
      expect(verified.verified).toBe(true);
      expect(verified.value).toBeGreaterThan(5);
    });
  });

  describe('Disguise Mechanics', () => {
    it('detects vulnerabilities based on environment', () => {
      const disguise = createDisguise('Guard', 15, ['Rain', 'Speaking Orcish']);

      const triggered = checkDisguiseVulnerabilities(disguise, ['Sunny', 'Rain']);
      expect(triggered).toContain('Rain');
      expect(triggered).toHaveLength(1);

      const triggered2 = checkDisguiseVulnerabilities(disguise, ['Snow']);
      expect(triggered2).toHaveLength(0);
    });
  });
});
