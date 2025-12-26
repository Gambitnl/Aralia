
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeywildMechanics } from '../FeywildMechanics';
import * as combatUtils from '../../../utils/combatUtils';
import * as savingThrowUtils from '../../../utils/savingThrowUtils';
import { createMockPlayerCharacter } from '../../../utils/factories';

// Mock logger to avoid clutter
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FeywildMechanics', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkMemoryLoss', () => {
    it('should result in memory loss on failed save', () => {
      vi.spyOn(savingThrowUtils, 'rollSavingThrow').mockReturnValue({
          success: false,
          total: 5,
          roll: 5,
          dc: 15,
          natural20: false,
          natural1: false
      });

      const char = createMockPlayerCharacter();
      char.race.name = 'Human';

      const result = FeywildMechanics.checkMemoryLoss(char);
      expect(result.lostMemory).toBe(true);
      expect(result.message).toContain('slipping away');
    });

    it('should result in retained memory on success', () => {
       vi.spyOn(savingThrowUtils, 'rollSavingThrow').mockReturnValue({
          success: true,
          total: 18,
          roll: 18,
          dc: 15,
          natural20: false,
          natural1: false
       });

       const char = createMockPlayerCharacter();
       char.race.name = 'Human';

       const result = FeywildMechanics.checkMemoryLoss(char);
       expect(result.lostMemory).toBe(false);
       expect(result.message).toContain('retains their memories');
    });

    it('should apply advantage for Elves (Native) - RELAXED CHECK', () => {
        const savingThrowSpy = vi.spyOn(savingThrowUtils, 'rollSavingThrow')
            .mockReturnValueOnce({
                success: false,
                total: 5,
                roll: 5,
                dc: 15,
                natural20: false,
                natural1: false
            })
            .mockReturnValueOnce({
                success: true,
                total: 20,
                roll: 20,
                dc: 15,
                natural20: true, // Nat 20 just to be sure
                natural1: false
            });

        const char = createMockPlayerCharacter({
            race: { name: 'High Elf', id: 'elf', speed: 30, size: 'Medium' }
        });

        const result = FeywildMechanics.checkMemoryLoss(char);

        // Ensure it tried at least twice (failed then retried)
        expect(savingThrowSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(result.lostMemory).toBe(false);
    });
  });

  describe('calculateTimeWarp', () => {
    const ONE_DAY_MINUTES = 1440;

    it('should compress time on roll 1-10', () => {
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(5);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);

        expect(result.warpedMinutes).toBe(1);
        expect(result.description).toContain('mere minutes');
    });

    it('should be normal time on roll 11-15', () => {
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(13);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);

        expect(result.warpedMinutes).toBe(ONE_DAY_MINUTES);
        expect(result.description).toContain('flowed normally');
    });

    it('should dilate time (weeks) on roll 16-17', () => {
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(16);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);

        // 1 day -> 1 week (7 days)
        expect(result.warpedMinutes).toBe(ONE_DAY_MINUTES * 7);
        expect(result.description).toContain('week has passed');
    });

    it('should dilate time (months) on roll 18-19', () => {
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(18);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);

        // 1 day -> 1 month (30 days)
        expect(result.warpedMinutes).toBe(ONE_DAY_MINUTES * 30);
        expect(result.description).toContain('Days became months');
    });

    it('should jump time (years) on roll 20', () => {
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(20);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);

        // 1 day -> 1 year (365 days)
        expect(result.warpedMinutes).toBe(ONE_DAY_MINUTES * 365);
        expect(result.description).toContain('Years have passed');
    });
  });
});
