
import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateProficiencyBonus, calculateSpellDC, rollSavingThrow, SavingThrowModifier } from '../savingThrowUtils';
import { createMockCombatCharacter } from '../factories';
import * as combatUtils from '../combatUtils';

// Mock rollDice
// We need to spy on it to change return values per test
vi.mock('../combatUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../combatUtils')>();
  return {
    ...actual,
    rollDice: vi.fn(),
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
        expect(calculateProficiencyBonus(0)).toBe(2);
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

      // Mock rollDice to return 10 when called with '1d20'
      const rollDiceMock = vi.mocked(combatUtils.rollDice);
      rollDiceMock.mockImplementation((dice: string) => {
          if (dice === '1d20') return 10;
          return 0;
      });

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

        const rollDiceMock = vi.mocked(combatUtils.rollDice);
        rollDiceMock.mockReturnValue(10); // 1d20 returns 10

        const result = rollSavingThrow(char, 'Dexterity', 15);
        // Total = 10 (Roll) + 2 (Dex) + 2 (PB) = 14
        expect(result.total).toBe(14);
    });

    it('applies external modifiers (dice) as penalty', () => {
        const char = createMockCombatCharacter({
            stats: {
                strength: 10, dexterity: 10, // +0 Mod
                constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
                baseInitiative: 0, speed: 30, cr: '1'
            }
        });

        const rollDiceMock = vi.mocked(combatUtils.rollDice);
        rollDiceMock.mockImplementation((dice: string) => {
            if (dice === '1d20') return 10;
            if (dice === '-1d4') return -2; // Penalty
            return 0;
        });

        const modifiers: SavingThrowModifier[] = [
            { source: 'Bane', dice: '-1d4' } // Use negative dice string for penalty
        ];

        const result = rollSavingThrow(char, 'Dexterity', 10, modifiers);
        // Total = 10 (Roll) + 0 (Mod) - 2 (Bane) = 8
        expect(result.total).toBe(8);
        expect(result.modifiersApplied).toHaveLength(1);
        expect(result.modifiersApplied![0].value).toBe(-2);
    });

    it('applies external modifiers (dice) as bonus', () => {
        const char = createMockCombatCharacter({
            stats: {
                strength: 10, dexterity: 10, // +0 Mod
                constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
                baseInitiative: 0, speed: 30, cr: '1'
            }
        });

        const rollDiceMock = vi.mocked(combatUtils.rollDice);
        rollDiceMock.mockImplementation((dice: string) => {
            if (dice === '1d20') return 10;
            if (dice === '1d4') return 2;
            return 0;
        });

        const modifiers: SavingThrowModifier[] = [
            { source: 'Bless', dice: '1d4' } // Positive dice string for bonus
        ];

        const result = rollSavingThrow(char, 'Dexterity', 10, modifiers);
        // Total = 10 (Roll) + 0 (Mod) + 2 (Bless) = 12
        expect(result.total).toBe(12);
        expect(result.modifiersApplied).toHaveLength(1);
        expect(result.modifiersApplied![0].value).toBe(2);
    });

    it('applies external modifiers (flat)', () => {
        const char = createMockCombatCharacter({
            stats: {
                strength: 10, dexterity: 10, // +0 Mod
                constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
                baseInitiative: 0, speed: 30, cr: '1'
            }
        });

        const rollDiceMock = vi.mocked(combatUtils.rollDice);
        rollDiceMock.mockReturnValue(10);

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
        const rollDiceMock = vi.mocked(combatUtils.rollDice);

        // Roll 20
        rollDiceMock.mockReturnValue(20);
        const result20 = rollSavingThrow(char, 'Dexterity', 30);
        expect(result20.roll).toBe(20);
        expect(result20.natural20).toBe(true);

        // Roll 1
        rollDiceMock.mockReturnValue(1);
        const result1 = rollSavingThrow(char, 'Dexterity', 5);
        expect(result1.roll).toBe(1);
        expect(result1.natural1).toBe(true);
    });
  });
});
