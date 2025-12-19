import { describe, it, expect } from 'vitest';
import {
  initializeIdentityState,
  equipDisguise,
  removeDisguise,
  createAlias,
  switchPersona,
  learnSecret,
  checkDisguise,
  attemptDeception,
  getCurrentPersona
} from '../identityService';
import {
  createMockPlayerCharacter
} from '@/utils/factories';
import { Disguise, Secret } from '@/types/identity';

describe('IdentityService', () => {
  const character = createMockPlayerCharacter({ name: 'Test Hero' });

  it('initializes identity state correctly', () => {
    const state = initializeIdentityState(character);
    expect(state.characterId).toBe(character.id);
    expect(state.trueIdentity.name).toBe('Test Hero');
    expect(state.trueIdentity.type).toBe('true');
    expect(state.aliases).toHaveLength(0);
    expect(state.activeDisguise).toBeNull();
  });

  it('equips and removes disguises', () => {
    let state = initializeIdentityState(character);
    const disguise: Disguise = {
      id: 'd1',
      targetAppearance: 'Guard',
      quality: 15,
      vulnerabilities: []
    };

    state = equipDisguise(state, disguise);
    expect(state.activeDisguise).toEqual(disguise);

    state = removeDisguise(state);
    expect(state.activeDisguise).toBeNull();
  });

  it('creates aliases', () => {
    let state = initializeIdentityState(character);
    state = createAlias(state, 'Countess Vane', 'Noble from the north');

    expect(state.aliases).toHaveLength(1);
    expect(state.aliases[0].name).toBe('Countess Vane');
    expect(state.aliases[0].type).toBe('alias');
  });

  it('switches personas', () => {
    let state = initializeIdentityState(character);
    state = createAlias(state, 'Countess Vane', 'Noble');
    const aliasId = state.aliases[0].id;

    state = switchPersona(state, aliasId);
    expect(state.currentPersonaId).toBe(aliasId);

    const current = getCurrentPersona(state);
    expect(current.name).toBe('Countess Vane');

    state = switchPersona(state, state.trueIdentity.id);
    expect(state.currentPersonaId).toBe(state.trueIdentity.id);
  });

  it('manages secrets', () => {
    let state = initializeIdentityState(character);
    const secret: Secret = {
      id: 's1',
      subjectId: 'king',
      content: 'The King is a doppelganger',
      verified: true,
      value: 10,
      knownBy: [],
      tags: ['political']
    };

    state = learnSecret(state, secret);
    expect(state.knownSecrets).toHaveLength(1);
    expect(state.knownSecrets[0].content).toBe(secret.content);

    // Should not add duplicate
    state = learnSecret(state, secret);
    expect(state.knownSecrets).toHaveLength(1);
  });

  it('checks disguise vs perception', () => {
    const disguise: Disguise = {
      id: 'd1',
      targetAppearance: 'Guard',
      quality: 15,
      vulnerabilities: []
    };

    // Roll/DC check logic
    expect(checkDisguise(disguise, 10)).toBe(true); // 15 >= 10
    expect(checkDisguise(disguise, 20)).toBe(false); // 15 < 20
    expect(checkDisguise(disguise, 20, 10)).toBe(true); // 15+10 >= 20
  });

  it('handles deception attempts', () => {
    const state = initializeIdentityState(character);
    // Note: attemptDeception uses random dice, so we can't assert exact success without mocking rollDice.
    // However, we can check the structure of the result.

    const result = attemptDeception(state, 5, 10, 10);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('detected');
    expect(result).toHaveProperty('margin');
  });
});
