
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AbyssalMechanics, ABYSSAL_CORRUPTION_EFFECTS } from '../AbyssalMechanics';
import { PlayerCharacter, GameState } from '../../../types/index';
import { rollSavingThrow } from '../../../utils/savingThrowUtils';
import { logger } from '../../../utils/logger';

// Mock dependencies
vi.mock('../../../utils/savingThrowUtils', () => ({
  rollSavingThrow: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const rollSavingThrowMock = rollSavingThrow as unknown as { mockReturnValue: (value: unknown) => void };

// Helper to create a mock character
const createMockCharacter = (id: string, name: string): PlayerCharacter => ({
  id,
  name,
  race: { name: 'Human', id: 'human', traits: [], description: 'Test Human' },
  class: {
    name: 'Fighter', id: 'fighter', hitDie: 10,
    proficiencies: [], savingThrowProficiencies: [], features: [],
    primaryAbility: ['Strength'], description: 'Test Fighter',
    skillProficienciesAvailable: [], numberOfSkillProficiencies: 2,
    armorProficiencies: [], weaponProficiencies: []
  },
  level: 1,
  // Ensure both abilityScores and finalAbilityScores are populated with correct keys
  abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
  finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
  hp: 10,
  maxHp: 10,
  conditions: [],
  experience: 0,
  background: 'soldier',
  skills: [],
  speed: 30,
  armorClass: 10,
  darkvisionRange: 0,
  transportMode: 'foot',
  statusEffects: [],
  equippedItems: {},
});

describe('AbyssalMechanics', () => {
  let mockCharacter: PlayerCharacter;
  let mockGameState: GameState;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCharacter = createMockCharacter('char1', 'TestChar');
    mockGameState = {
      party: [mockCharacter],
      notifications: [],
    } as unknown as GameState;
  });

  describe('checkCorruption', () => {
    it('should return no corruption on successful save', () => {
      // Arrange
      rollSavingThrowMock.mockReturnValue({ success: true, total: 20 });

      // Act
      const result = AbyssalMechanics.checkCorruption(mockCharacter);

      // Assert
      expect(result.isCorrupted).toBe(false);
      expect(result.message).toContain('resists');
      expect(rollSavingThrow).toHaveBeenCalledWith(expect.anything(), 'Charisma', AbyssalMechanics.CORRUPTION_DC);
    });

    it('should return corruption on failed save', () => {
      // Arrange
      rollSavingThrowMock.mockReturnValue({ success: false, total: 5 });

      // Act
      const result = AbyssalMechanics.checkCorruption(mockCharacter);

      // Assert
      expect(result.isCorrupted).toBe(true);
      expect(result.effect).toBeDefined();
      expect(ABYSSAL_CORRUPTION_EFFECTS).toContain(result.effect);
      expect(result.message).toContain('corrupted by the Abyss');
    });
  });

  describe('applyCorruptionEffect', () => {
    it('should add corruption condition to character', () => {
      // Arrange
      const effect = ABYSSAL_CORRUPTION_EFFECTS[0];

      // Act
      AbyssalMechanics.applyCorruptionEffect(mockGameState, 'char1', effect);

      // Assert
      expect(mockCharacter.conditions).toContain(`Corruption: ${effect.name}`);
      expect(logger.info).toHaveBeenCalledWith(`Applied Corruption: ${effect.name} to char1`);
      expect(mockGameState.notifications).toHaveLength(1);
      expect(mockGameState.notifications[0].message).toContain(effect.flaw);
    });

    it('should not duplicate identical corruption', () => {
      // Arrange
      const effect = ABYSSAL_CORRUPTION_EFFECTS[0];
      mockCharacter.conditions = [`Corruption: ${effect.name}`];

      // Act
      AbyssalMechanics.applyCorruptionEffect(mockGameState, 'char1', effect);

      // Assert
      expect(mockCharacter.conditions).toHaveLength(1); // Still just one
      // Notification is still added per current implementation if called, but condition list doesn't grow.
      // The implementation explicitly checks for duplication and returns early, skipping both push AND notification.
      // Re-verifying implementation:
      // if (char.conditions.includes(conditionName)) { return; }
      // So NO notification should be added.
      expect(mockGameState.notifications).toHaveLength(0);
    });

    it('should handle character not found gracefully', () => {
      // Act
      AbyssalMechanics.applyCorruptionEffect(mockGameState, 'nonexistent', ABYSSAL_CORRUPTION_EFFECTS[0]);

      // Assert
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('clearCorruption', () => {
    it('should remove all corruption conditions', () => {
      // Arrange
      mockCharacter.conditions = ['Corruption: Treachery', 'Corruption: Bloodlust', 'Poisoned'];

      // Act
      AbyssalMechanics.clearCorruption(mockGameState, 'char1');

      // Assert
      expect(mockCharacter.conditions).toEqual(['Poisoned']);
      expect(mockGameState.notifications).toHaveLength(1);
      expect(mockGameState.notifications[0].message).toContain('fade from their soul');
    });

    it('should do nothing if no corruption present', () => {
      // Arrange
      mockCharacter.conditions = ['Poisoned'];

      // Act
      AbyssalMechanics.clearCorruption(mockGameState, 'char1');

      // Assert
      expect(mockCharacter.conditions).toEqual(['Poisoned']);
      expect(mockGameState.notifications).toHaveLength(0);
    });
  });
});
