
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeywildMechanics } from '../FeywildMechanics';
import * as combatUtils from '../../../utils/combatUtils';
import { createMockPlayerCharacter } from '../../../utils/factories';

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock combatUtils
// We use a factory to ensure we return a Spy for rollDice and a custom implementation for createPlayerCombatCharacter
vi.mock('../../../utils/combatUtils', async (importOriginal) => {
    const actual = await importOriginal<typeof combatUtils>();
    return {
        ...actual,
        rollDice: vi.fn(),
        createPlayerCombatCharacter: vi.fn((pc) => {
            // Return a valid CombatCharacter structure
            return {
                ...pc, // Copy ID, name, etc.
                stats: pc.attributes || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
                savingThrowProficiencies: pc.class?.savingThrowProficiencies || [],
                proficiencyBonus: 2,
                level: 1,
                hp: 10,
                maxHp: 10,
                ac: 10,
                initiativeBonus: 0,
                speed: 30,
                conditions: [],
                resistances: [],
                vulnerabilities: [],
                immunities: [],
                abilities: [],
                statusEffects: [],
                finalAbilityScores: pc.attributes || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
                classIdentifier: pc.class?.id || 'fighter',
                raceIdentifier: pc.race?.id || 'human',
                alignment: 'Neutral'
            };
        })
    };
});

describe('FeywildMechanics', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkMemoryLoss', () => {
    it('should result in memory loss on failed save', () => {
      // Mock save to fail (roll 1)
      vi.mocked(combatUtils.rollDice).mockReturnValue(1);

      const char = createMockPlayerCharacter({
          class: { name: 'Fighter', id: 'fighter', hitDie: 'd10', savingThrowProficiencies: [] },
          race: { name: 'Human', id: 'human', speed: 30, size: 'Medium' }
      });
      // Ensure attributes exist
      char.attributes = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };

      const result = FeywildMechanics.checkMemoryLoss(char);

      // Verify result
      expect(result.lostMemory).toBe(true);
      expect(result.message).toContain('slipping away');
    });

    it('should result in retained memory on success', () => {
       // Mock save to succeed (roll 20)
       vi.mocked(combatUtils.rollDice).mockReturnValue(20);

       const char = createMockPlayerCharacter();
       char.attributes = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };

       const result = FeywildMechanics.checkMemoryLoss(char);
       expect(result.lostMemory).toBe(false);
       expect(result.message).toContain('retains their memories');
    });

    it('should apply advantage for Elves (Native)', () => {
        // Mock sequence: First roll fail (1), Second roll success (20)
        vi.mocked(combatUtils.rollDice).mockReturnValueOnce(1).mockReturnValueOnce(20);

        const char = createMockPlayerCharacter({
            race: { name: 'High Elf', id: 'elf', speed: 30, size: 'Medium' }
        });
        char.attributes = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };

        const result = FeywildMechanics.checkMemoryLoss(char);

        // Should have rolled twice
        expect(combatUtils.rollDice).toHaveBeenCalledTimes(2);
        expect(result.lostMemory).toBe(false);
    });
  });

  describe('calculateTimeWarp', () => {
    const ONE_DAY_MINUTES = 1440;

    it('should compress time on roll 1-10', () => {
        vi.mocked(combatUtils.rollDice).mockReturnValue(5);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);

        // 1440 mins / 1440 = 1 min
        expect(result.warpedMinutes).toBe(1);
        expect(result.description).toContain('mere minutes');
    });

    it('should be normal time on roll 11-15', () => {
        vi.mocked(combatUtils.rollDice).mockReturnValue(13);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);

        expect(result.warpedMinutes).toBe(ONE_DAY_MINUTES);
        expect(result.description).toContain('flowed normally');
    });

    it('should dilate time (weeks) on roll 16-17', () => {
        vi.mocked(combatUtils.rollDice).mockReturnValue(16);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);

        // 1 day -> 1 week (7 days)
        expect(result.warpedMinutes).toBe(ONE_DAY_MINUTES * 7);
        expect(result.description).toContain('week has passed');
    });

    it('should dilate time (months) on roll 18-19', () => {
        vi.mocked(combatUtils.rollDice).mockReturnValue(18);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);

        // 1 day -> 1 month (30 days)
        expect(result.warpedMinutes).toBe(ONE_DAY_MINUTES * 30);
        expect(result.description).toContain('Days became months');
    });

    it('should jump time (years) on roll 20', () => {
        vi.mocked(combatUtils.rollDice).mockReturnValue(20);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);

        // 1 day -> 1 year (365 days)
        expect(result.warpedMinutes).toBe(ONE_DAY_MINUTES * 365);
        expect(result.description).toContain('Years have passed');
    });
  });
});
