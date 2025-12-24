
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeywildMechanics, TimeWarpResult } from '../FeywildMechanics';
import * as combatUtils from '../../utils/combatUtils';
import { PlayerCharacter, GameState } from '../../types/index';
import { createMockPlayerCharacter, createMockGameState } from '../../utils/factories';

// Mock logger to avoid clutter
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FeywildMechanics', () => {

  describe('checkMemoryLoss', () => {
    it('should result in memory loss on failed save', () => {
      // Mock save to fail (roll 1)
      vi.spyOn(combatUtils, 'rollDice').mockReturnValue(1);
      // Note: rollSavingThrow calls rollDice internally.
      // However, createMockPlayerCharacter might return decent stats, so 1 + mods might still be low.

      const char = createMockPlayerCharacter({
          class: { name: 'Fighter', id: 'fighter', hitDie: 'd10', savingThrowProficiencies: [] },
          race: { name: 'Human', id: 'human', speed: 30, size: 'Medium' }
      });
      // Ensure wisdom mod is low for test reliability
      char.attributes.wisdom = 10; // Mod 0

      // We need to mock savingThrowUtils or just mock rollDice if we know the internal logic.
      // Better: Mock rollSavingThrow from savingThrowUtils if exported.
      // But FeywildMechanics imports it.
      // Let's rely on rollDice mock since savingThrowUtils uses it.

      const result = FeywildMechanics.checkMemoryLoss(char);
      expect(result.lostMemory).toBe(true);
      expect(result.message).toContain('slipping away');
    });

    it('should result in retained memory on success', () => {
       // Mock save to succeed (roll 20)
       vi.spyOn(combatUtils, 'rollDice').mockReturnValue(20);

       const char = createMockPlayerCharacter();
       char.attributes.wisdom = 10;

       const result = FeywildMechanics.checkMemoryLoss(char);
       expect(result.lostMemory).toBe(false);
       expect(result.message).toContain('retains their memories');
    });

    it('should apply advantage for Elves (Native)', () => {
        // Mock sequence: First roll fail (1), Second roll success (20)
        const rollSpy = vi.spyOn(combatUtils, 'rollDice').mockReturnValueOnce(1).mockReturnValueOnce(20);

        const char = createMockPlayerCharacter({
            race: { name: 'High Elf', id: 'elf', speed: 30, size: 'Medium' }
        });
        char.attributes.wisdom = 10;

        const result = FeywildMechanics.checkMemoryLoss(char);

        // Should have rolled twice
        expect(rollSpy).toHaveBeenCalledTimes(2);
        expect(result.lostMemory).toBe(false);
    });
  });

  describe('calculateTimeWarp', () => {
    const ONE_DAY_MINUTES = 1440;

    it('should compress time on roll 1-10', () => {
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(5);
        const result = FeywildMechanics.calculateTimeWarp(ONE_DAY_MINUTES);

        // 1440 mins / 1440 = 1 min
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
