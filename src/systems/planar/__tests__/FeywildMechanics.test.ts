
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeywildMechanics } from '../FeywildMechanics';
import * as combatUtils from '../../../utils/combatUtils';
import * as savingThrowUtils from '../../../utils/savingThrowUtils'; // Import the module to spy on
import { createMockPlayerCharacter } from '../../../utils/factories';

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// We don't mock the whole module because we want types, but we spy on the exported function.
// Since savingThrowUtils is a module of functions, we can spy on the import if we import * as.
// However, if FeywildMechanics imports { rollSavingThrow }, direct spying might be tricky depending on bundler.
// Vitest supports spying on imports.

vi.mock('../../../utils/savingThrowUtils', () => ({
  rollSavingThrow: vi.fn(),
  calculateSavingThrowBonus: vi.fn().mockReturnValue(0) // Mock dependency if needed
}));

describe('FeywildMechanics', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkMemoryLoss', () => {
    it('should result in memory loss on failed save', () => {
      // Mock save failure
      vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({ success: false, total: 5, rolls: [5] });

      const char = createMockPlayerCharacter({
          class: { name: 'Fighter', id: 'fighter', hitDie: 'd10', savingThrowProficiencies: [] },
          race: { name: 'Human', id: 'human', speed: 30, size: 'Medium' }
      });
      char.abilityScores.Wisdom = 10;

      const result = FeywildMechanics.checkMemoryLoss(char);
      expect(result.lostMemory).toBe(true);
      expect(result.message).toContain('slipping away');
    });

    it('should result in retained memory on success', () => {
       // Mock save success
       vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({ success: true, total: 16, rolls: [16] });

       const char = createMockPlayerCharacter();
       char.abilityScores.Wisdom = 10;

       const result = FeywildMechanics.checkMemoryLoss(char);
       expect(result.lostMemory).toBe(false);
       expect(result.message).toContain('retains their memories');
    });

    it('should apply advantage for Elves (Native)', () => {
        // Mock sequence: Fail then Success
        vi.mocked(savingThrowUtils.rollSavingThrow)
          .mockReturnValueOnce({ success: false, total: 5, rolls: [5] })
          .mockReturnValueOnce({ success: true, total: 20, rolls: [20] });

        const char = createMockPlayerCharacter({
            race: { name: 'High Elf', id: 'elf', speed: 30, size: 'Medium' }
        });
        char.abilityScores.Wisdom = 10;

        const result = FeywildMechanics.checkMemoryLoss(char);

        expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalledTimes(2);
        expect(result.lostMemory).toBe(false);
    });
  });

  describe('calculateTimeWarp', () => {
    const ONE_DAY_MINUTES = 1440;

    // For calculateTimeWarp, it calls rollDice directly from combatUtils.
    // We need to spy on combatUtils for this part.
    // Since we didn't mock the whole combatUtils module, we can spy on it.

    it('should compress time on roll 1-10', () => {
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(5);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);
        expect(result.warpedMinutes).toBe(1);
    });

    it('should be normal time on roll 11-15', () => {
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(13);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);
        expect(result.warpedMinutes).toBe(ONE_DAY_MINUTES);
    });

    it('should dilate time (weeks) on roll 16-17', () => {
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(16);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);
        expect(result.warpedMinutes).toBe(ONE_DAY_MINUTES * 7);
    });

    it('should dilate time (months) on roll 18-19', () => {
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(18);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);
        expect(result.warpedMinutes).toBe(ONE_DAY_MINUTES * 30);
    });

    it('should jump time (years) on roll 20', () => {
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(20);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);
        expect(result.warpedMinutes).toBe(ONE_DAY_MINUTES * 365);
    });
  });
});
