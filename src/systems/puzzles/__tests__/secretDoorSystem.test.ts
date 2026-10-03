/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/__tests__/secretDoorSystem.test.ts
 * Tests for the Secret Door system logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchForSecretDoor,
  investigateMechanism,
  operateSecretDoor
} from '../secretDoorSystem';
import { SecretDoor } from '../types';
import { PlayerCharacter } from '../../../types/character';
import { createMockPlayerCharacter } from '../../../utils/core/factories';
import * as diceRollers from '../../../systems/dice/rollers';

// Mock the dice roller
vi.mock('../../dice/rollers', () => ({
  rollDice: vi.fn()
}));
// The puzzle systems read the modern PlayerCharacter shape: secretDoorSystem
// resolves abilities through getPuzzleCharacterStats, which prefers
// finalAbilityScores (then abilityScores) over the legacy `stats` field, and it
// derives proficiency from character.classes / character.class. So this stub is
// built from the shared factory with only the values the checks care about.
const ROGUE_CLASS = {
  id: 'rogue',
  name: 'Rogue',
  description: '',
  hitDie: 8,
  primaryAbility: ['Dexterity'],
  savingThrowProficiencies: ['Dexterity', 'Intelligence'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 0,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: []
} as PlayerCharacter['class'];

const ROGUE_ABILITIES = {
  Strength: 10,
  Dexterity: 16,
  Constitution: 14,
  Intelligence: 14, // +2, drives the Investigation check
  Wisdom: 16, // +3, drives the Perception check
  Charisma: 10
};

const mockCharacter: PlayerCharacter = createMockPlayerCharacter({
  id: 'char-1',
  name: 'Test Rogue',
  class: ROGUE_CLASS,
  classes: [ROGUE_CLASS],
  abilityScores: ROGUE_ABILITIES,
  finalAbilityScores: ROGUE_ABILITIES,
  proficiencyBonus: 2
});

describe('SecretDoor System', () => {
  let mockDoor: SecretDoor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDoor = {
      id: 'sd-001',
      name: 'Library Passage',
      tileId: '10-10',
      detectionDC: 15,
      mechanismDC: 12,
      mechanismDescription: 'pull the fake book',
      isLocked: false,
      state: 'hidden'
    };
  });

  describe('searchForSecretDoor', () => {
    it('detects the door on a high roll', () => {
      // Wis +3, Prof +2 = +5 bonus. DC 15. Need roll >= 10.
      vi.mocked(diceRollers.rollDice).mockReturnValue(10);

      const result = searchForSecretDoor(mockCharacter, mockDoor);

      expect(result.success).toBe(true);
      expect(result.state).toBe('detected');
      expect(mockDoor.state).toBe('detected');
      expect(result.xpAward).toBe(50);
    });

    it('fails to detect on a low roll', () => {
      // Wis +3, Prof +2 = +5 bonus. DC 15. Roll 2 -> Total 7.
      vi.mocked(diceRollers.rollDice).mockReturnValue(2);

      const result = searchForSecretDoor(mockCharacter, mockDoor);

      expect(result.success).toBe(false);
      expect(result.state).toBe('hidden');
      expect(mockDoor.state).toBe('hidden');
    });

    it('returns success immediately if already detected', () => {
      mockDoor.state = 'detected';
      const result = searchForSecretDoor(mockCharacter, mockDoor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('clearly see');
    });
  });

  describe('investigateMechanism', () => {
    it('succeeds on high roll', () => {
      mockDoor.state = 'detected';
      // Int +2, Prof +2 = +4. DC 12. Need roll >= 8.
      vi.mocked(diceRollers.rollDice).mockReturnValue(10);

      const result = investigateMechanism(mockCharacter, mockDoor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('pull the fake book');
    });

    it('fails if door is hidden', () => {
      mockDoor.state = 'hidden';
      const result = investigateMechanism(mockCharacter, mockDoor);
      expect(result.success).toBe(false);
      expect(result.message).toContain('cannot investigate');
    });
  });

  describe('operateSecretDoor', () => {
    it('opens the door if detected and unlocked', () => {
      mockDoor.state = 'detected';
      mockDoor.isLocked = false;

      const result = operateSecretDoor(mockCharacter, mockDoor);
      expect(result.success).toBe(true);
      expect(result.state).toBe('open');
      expect(mockDoor.state).toBe('open');
    });

    it('fails if locked', () => {
      mockDoor.state = 'detected';
      mockDoor.isLocked = true;

      const result = operateSecretDoor(mockCharacter, mockDoor);
      expect(result.success).toBe(false);
      expect(result.message).toContain('stuck or locked');
    });

    it('closes the door if already open', () => {
      mockDoor.state = 'open';
      const result = operateSecretDoor(mockCharacter, mockDoor);
      expect(result.success).toBe(true);
      expect(result.state).toBe('closed');
      expect(mockDoor.state).toBe('closed');
    });
  });
});
