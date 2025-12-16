
import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateProficiencyBonus, calculateSpellDC, rollSavingThrow, SavingThrowModifier } from '../savingThrowUtils';
import { createMockCombatCharacter } from '../factories';
import { CombatCharacter } from '@/types/combat';

// Mock rollDice to be deterministic for testing modifiers
vi.mock('../combatUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../combatUtils')>();
  return {
    ...actual,
    rollDice: vi.fn((dice: string) => {
      // Simple mock: return average or fixed value
      if (dice === '1d4') return 2;
      return 5;
    }),
  };
});

describe('savingThrowUtils', () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateProficiencyBonus', () => {
    it('calculates correct bonus for levels 1-20', () => {
      expect(calculateProficiencyBonus(1)).toBe(2);
      expect(calculateProficiencyBonus(4)).toBe(2);
      expect(calculateProficiencyBonus(5)).toBe(3);
      expect(calculateProficiencyBonus(8)).toBe(3);
      expect(calculateProficiencyBonus(9)).toBe(4);
      expect(calculateProficiencyBonus(12)).toBe(4);
      expect(calculateProficiencyBonus(13)).toBe(5);
      expect(calculateProficiencyBonus(16)).toBe(5);
      expect(calculateProficiencyBonus(17)).toBe(6);
      expect(calculateProficiencyBonus(20)).toBe(6);
    });

    it('handles edge cases', () => {
        expect(calculateProficiencyBonus(0)).toBe(2); // Should treat as level 1 approx or min 2
        // Based on implementation: 2 + floor(max(0, -1) / 4) = 2 + 0 = 2. Correct.
    });
  });

  describe('calculateSpellDC', () => {
    it('calculates DC correctly for a wizard', () => {
      const wizard = createMockCombatCharacter({
        level: 5,
        class: {
            id: 'wizard', name: 'Wizard', spellcasting: { ability: 'Intelligence' }
        } as any,
        stats: {
          strength: 10, dexterity: 10, constitution: 10,
          intelligence: 18, // +4 Mod
          wisdom: 10, charisma: 10,
          baseInitiative: 0, speed: 30, cr: '1'
        }
      });
      // DC = 8 + PB(3) + Mod(4) = 15
      expect(calculateSpellDC(wizard)).toBe(15);
    });

    it('defaults to Intelligence if class has no spellcasting ability', () => {
      const fighter = createMockCombatCharacter({
        level: 1,
        class: { id: 'fighter', name: 'Fighter' } as any, // No spellcasting prop
        stats: {
            strength: 16, dexterity: 10, constitution: 10,
            intelligence: 10, // +0 Mod
            wisdom: 10, charisma: 10,
            baseInitiative: 0, speed: 30, cr: '1'
        }
      });
      // DC = 8 + PB(2) + Mod(0) = 10
      expect(calculateSpellDC(fighter)).toBe(10);
    });
  });

  describe('rollSavingThrow', () => {
    it('calculates total correctly with positive modifier', () => {
      const char = createMockCombatCharacter({
        stats: {
            strength: 10, dexterity: 14, // +2 Mod
            constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
            baseInitiative: 0, speed: 30, cr: '1'
        }
      });

      // Spy on Math.random to force a roll of 10
      // Math.floor(0.45 * 20) + 1 = 9 + 1 = 10
      vi.spyOn(Math, 'random').mockReturnValue(0.45);

      const result = rollSavingThrow(char, 'Dexterity', 15);

      expect(result.roll).toBe(10);
      expect(result.total).toBe(12); // 10 + 2
      expect(result.success).toBe(false); // 12 < 15
    });

    it('adds proficiency bonus if proficient', () => {
        const char = createMockCombatCharacter({
            level: 1, // PB +2
            stats: {
                strength: 10, dexterity: 14, // +2 Mod
                constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
                baseInitiative: 0, speed: 30, cr: '1'
            },
            savingThrowProficiencies: ['Dexterity']
        });

        vi.spyOn(Math, 'random').mockReturnValue(0.45); // Roll 10

        const result = rollSavingThrow(char, 'Dexterity', 15);
        // Total = 10 (Roll) + 2 (Dex) + 2 (PB) = 14
        expect(result.total).toBe(14);
    });

    it('applies external modifiers (dice)', () => {
        const char = createMockCombatCharacter({
            stats: {
                strength: 10, dexterity: 10, // +0 Mod
                constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
                baseInitiative: 0, speed: 30, cr: '1'
            }
        });

        vi.spyOn(Math, 'random').mockReturnValue(0.45); // Roll 10

        const modifiers: SavingThrowModifier[] = [
            { source: 'Bane', dice: '1d4' } // Mocked to return 2
        ];

        const result = rollSavingThrow(char, 'Dexterity', 10, modifiers);
        // Total = 10 (Roll) + 0 (Mod) - 2 (Bane) = 8
        expect(result.total).toBe(8);
        expect(result.modifiersApplied).toHaveLength(1);
        expect(result.modifiersApplied![0].value).toBe(-2);
    });

    it('applies external modifiers (flat)', () => {
        const char = createMockCombatCharacter({
            stats: {
                strength: 10, dexterity: 10, // +0 Mod
                constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
                baseInitiative: 0, speed: 30, cr: '1'
            }
        });

        vi.spyOn(Math, 'random').mockReturnValue(0.45); // Roll 10

        const modifiers: SavingThrowModifier[] = [
            { source: 'Cover', flat: 2 }
        ];

        const result = rollSavingThrow(char, 'Dexterity', 10, modifiers);
        // Total = 10 (Roll) + 0 (Mod) + 2 (Cover) = 12
        expect(result.total).toBe(12);
        expect(result.modifiersApplied).toHaveLength(1);
        expect(result.modifiersApplied![0].value).toBe(2);
    });

    it('handles Natural 20 and Natural 1 flags', () => {
        const char = createMockCombatCharacter();

        // Roll 20
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        const result20 = rollSavingThrow(char, 'Dexterity', 30);
        expect(result20.roll).toBe(20);
        expect(result20.natural20).toBe(true);
        // Note: 5e rules say nat 20 is not auto success for saves, only attacks.
        // But some implementations might differ. The code says:
        // success: total >= dc
        // Wait, the code in savingThrowUtils.ts implementation:
        // natural20: roll === 20
        // But success is solely total >= dc.
        // I should check if the code implements auto-success for saves.
        // Reading the code again: return { success: total >= dc, ... }
        // So no auto success. This matches 5e rules (mostly).

        // Roll 1
        vi.spyOn(Math, 'random').mockReturnValue(0.01);
        const result1 = rollSavingThrow(char, 'Dexterity', 5);
        expect(result1.roll).toBe(1);
        expect(result1.natural1).toBe(true);
    });
  });
});
