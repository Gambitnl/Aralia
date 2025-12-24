
import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkConcentration, calculateConcentrationDC } from '../concentrationUtils';
import * as combatUtils from '../combatUtils';
import { CombatCharacter } from '../../types/combat';

describe('concentrationUtils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockCharacter = (constitution: number, proficiencies: string[] = [], level: number = 1): CombatCharacter => ({
    id: 'char1',
    name: 'Test Character',
    level,
    stats: {
      constitution,
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    savingThrowProficiencies: proficiencies as any,
    class: {
      id: 'wizard',
      name: 'Wizard',
      savingThrowProficiencies: [], // Class proficiencies handled via savingThrowUtils usually, checking both
    } as any,
  } as CombatCharacter);

  describe('calculateConcentrationDC', () => {
    it('should be 10 for low damage', () => {
      expect(calculateConcentrationDC(1)).toBe(10);
      expect(calculateConcentrationDC(19)).toBe(10);
      expect(calculateConcentrationDC(20)).toBe(10); // 20 / 2 = 10
    });

    it('should be half damage for high damage', () => {
      expect(calculateConcentrationDC(22)).toBe(11);
      expect(calculateConcentrationDC(30)).toBe(15);
      expect(calculateConcentrationDC(100)).toBe(50);
    });

    it('should round down', () => {
      expect(calculateConcentrationDC(21)).toBe(10); // 10.5 -> 10? No, max(10, 10) = 10.
      expect(calculateConcentrationDC(23)).toBe(11); // 11.5 -> 11
    });
  });

  describe('checkConcentration', () => {
    it('should use rollSavingThrow logic (Constitution + Proficiency)', () => {
      // Setup: Con 14 (+2), Proficiency (+2 at level 1), Damage 22 (DC 11)
      // Roll 8 + 2 (Con) + 2 (Prof) = 12. Success.
      // If logic is broken (no prof), 8 + 2 = 10. Fail.

      const char = mockCharacter(14, ['Constitution']);

      // Mock rollDice to return 8
      vi.spyOn(combatUtils, 'rollDice').mockReturnValue(8);

      const result = checkConcentration(char, 22);

      expect(result.dc).toBe(11);
      expect(result.roll).toBe(12); // 8 + 2 + 2
      expect(result.success).toBe(true);
    });

    it('should fail if roll is too low', () => {
      // Setup: Con 10 (+0), No Prof, Damage 22 (DC 11)
      // Roll 10 + 0 = 10. Fail.

      const char = mockCharacter(10, []);
      vi.spyOn(combatUtils, 'rollDice').mockReturnValue(10);

      const result = checkConcentration(char, 22);

      expect(result.dc).toBe(11);
      expect(result.roll).toBe(10);
      expect(result.success).toBe(false);
    });

    it('should handle Constitution penalty', () => {
        // Setup: Con 8 (-1), No Prof, Damage 2 (DC 10)
        // Roll 10 - 1 = 9. Fail.
        const char = mockCharacter(8, []);
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(10);

        const result = checkConcentration(char, 2);
        expect(result.roll).toBe(9);
        expect(result.success).toBe(false);
    });
  });
});
