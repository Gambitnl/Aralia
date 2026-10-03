
import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateProficiencyBonus, calculateSaveDamage, calculateSpellDC, extractSaveQualifiers, hasSavingThrowProficiency, qualifierMatches, rollSavingThrow, SavingThrowModifier, SaveAdvantageModifier } from '../savingThrowUtils';
import { createMockCombatCharacter } from '../../core/factories';
import * as diceRollers from '../../../systems/dice/rollers';

// Mock rollDice
// We need to spy on it to change return values per test
vi.mock('../../../systems/dice/rollers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../systems/dice/rollers')>();
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
            id: 'wizard',
            name: 'Wizard',
            description: '',
            hitDie: 6,
            primaryAbility: ['Intelligence'],
            savingThrowProficiencies: [],
            skillProficienciesAvailable: [],
            numberOfSkillProficiencies: 0,
            armorProficiencies: [],
            weaponProficiencies: [],
            features: [],
            spellcasting: { ability: 'Intelligence' }
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
        class: { id: 'fighter', name: 'Fighter', description: '', hitDie: 10, primaryAbility: ['Strength'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any, // No spellcasting prop
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
    // Deterministic callers must still enter through the shared dice parser.
    // This protects scenario proof from replacing save math with a fixed total.
    it('forwards an injected random stream through the shared dice engine', () => {
      const char = createMockCombatCharacter({
        stats: {
          strength: 10, dexterity: 10, constitution: 10,
          intelligence: 10, wisdom: 10, charisma: 10,
          baseInitiative: 0, speed: 30, cr: '1'
        }
      });
      const rng = vi.fn(() => 0.89);
      const rollDiceMock = vi.mocked(diceRollers.rollDice);
      rollDiceMock.mockImplementation((dice, options) => {
        if (dice === '1d20' && options?.rng) {
          return Math.floor(options.rng() * 20) + 1;
        }
        return 0;
      });

      const result = rollSavingThrow(
        char,
        'Strength',
        13,
        undefined,
        undefined,
        undefined,
        { rng },
      );

      expect(result).toMatchObject({ roll: 18, total: 18, success: true, dc: 13 });
      expect(rollDiceMock).toHaveBeenCalledWith('1d20', { rng });
    });

    it('calculates total correctly with positive modifier', () => {
      const char = createMockCombatCharacter({
        stats: {
            strength: 10, dexterity: 14, // +2 Mod
            constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
            baseInitiative: 0, speed: 30, cr: '1'
        }
      });

      // Mock rollDice to return 10 when called with '1d20'
      const rollDiceMock = vi.mocked(diceRollers.rollDice);
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

        const rollDiceMock = vi.mocked(diceRollers.rollDice);
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

        const rollDiceMock = vi.mocked(diceRollers.rollDice);
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

        const rollDiceMock = vi.mocked(diceRollers.rollDice);
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

        const rollDiceMock = vi.mocked(diceRollers.rollDice);
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
        const rollDiceMock = vi.mocked(diceRollers.rollDice);

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

    it('only applies advantage to specific abilities if mentioned', () => {
        const char = createMockCombatCharacter({
            modifiers: { advantage: ['advantage on Intelligence, Wisdom, and Charisma saving throws'], disadvantage: [], bonuses: [] } as any,
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' }
        });

        const rollDiceMock = vi.mocked(diceRollers.rollDice);
        // Setup returns: First roll 10, second roll 20. If advantage is active, max(10,20) = 20.
        rollDiceMock.mockReturnValueOnce(10).mockReturnValueOnce(20).mockReturnValue(5); // 5 for any other bonus rolls just in case

        const resultWis = rollSavingThrow(char, 'Wisdom', 15);
        expect(resultWis.roll).toBe(20); // Max of 10 and 20

        rollDiceMock.mockClear();
        // Setup returns for Dex: First roll 10, second roll 20. If no advantage, it just takes the 10.
        rollDiceMock.mockReturnValueOnce(10).mockReturnValueOnce(20).mockReturnValue(5);

      const resultDex = rollSavingThrow(char, 'Dexterity', 15);
      expect(resultDex.roll).toBe(10); // Should just be the first roll
    });

    // Helper: deterministic d20 sequence for a single rollSavingThrow call.
    // Uses mockReset() (NOT mockClear) so the mockReturnValueOnce queue never leaks
    // between assertions — restoreAllMocks/mockClear do not drain that queue, so a
    // prior test's unconsumed value would otherwise bleed into the next roll.
    const setRolls = (mock: ReturnType<typeof vi.mocked<typeof diceRollers.rollDice>>, ...rolls: number[]) => {
        mock.mockReset();
        for (const r of rolls) mock.mockReturnValueOnce(r);
        mock.mockReturnValue(0); // any extra dice (bonuses etc.) contribute nothing here
    };

    it('applies a structured advantage modifier only to the named ability (RM-SAVE-002)', () => {
        const char = createMockCombatCharacter({
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' }
        });

        const rollDiceMock = vi.mocked(diceRollers.rollDice);

        const structured: SaveAdvantageModifier[] = [
            { type: 'advantage', context: 'saving_throw', abilities: ['Intelligence'] }
        ];

        // Intelligence save: two rolls (10, 20), advantage takes the max.
        setRolls(rollDiceMock, 10, 20);
        const resultInt = rollSavingThrow(char, 'Intelligence', 15, undefined, undefined, structured);
        expect(resultInt.roll).toBe(20);

        // Dexterity save: modifier does not name Dexterity, so no advantage — first roll stands.
        setRolls(rollDiceMock, 10, 20);
        const resultDex = rollSavingThrow(char, 'Dexterity', 15, undefined, undefined, structured);
        expect(resultDex.roll).toBe(10);
    });

    it('applies contextual structured advantage ONLY to matching effects (RM-SAVE-001)', () => {
        const char = createMockCombatCharacter({
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' }
        });

        const rollDiceMock = vi.mocked(diceRollers.rollDice);

        // "advantage on saving throws against poison" — unconditional on ability, gated on context.
        const structured: SaveAdvantageModifier[] = [
            { type: 'advantage', context: 'saving_throw', against: ['poison'], source: 'Dwarven Resilience' }
        ];

        // Poison effect: advantage applies, max(10, 20) = 20.
        setRolls(rollDiceMock, 10, 20);
        const resultPoison = rollSavingThrow(char, 'Constitution', 15, undefined, { damageType: 'poison' }, structured);
        expect(resultPoison.roll).toBe(20);

        // Fire effect: advantage does NOT apply, first roll stands.
        setRolls(rollDiceMock, 10, 20);
        const resultFire = rollSavingThrow(char, 'Constitution', 15, undefined, { damageType: 'fire' }, structured);
        expect(resultFire.roll).toBe(10);

        // No context supplied: a contextual modifier cannot be confirmed, so it does not over-apply.
        setRolls(rollDiceMock, 10, 20);
        const resultNoCtx = rollSavingThrow(char, 'Constitution', 15, undefined, undefined, structured);
        expect(resultNoCtx.roll).toBe(10);
    });

    it('matches contextual advantage via effect tags, not just damageType', () => {
        const char = createMockCombatCharacter({
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' }
        });

        const rollDiceMock = vi.mocked(diceRollers.rollDice);
        const structured: SaveAdvantageModifier[] = [
            { type: 'advantage', context: 'saving_throw', against: ['disease'] }
        ];

        setRolls(rollDiceMock, 10, 20);
        const result = rollSavingThrow(char, 'Constitution', 15, undefined, { tags: ['magic', 'disease'] }, structured);
        expect(result.roll).toBe(20);
    });

    it('applies an unconditional structured modifier to every ability', () => {
        const char = createMockCombatCharacter({
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' }
        });

        const rollDiceMock = vi.mocked(diceRollers.rollDice);
        // No abilities, no against => applies to all saves.
        const structured: SaveAdvantageModifier[] = [
            { type: 'advantage', context: 'saving_throw' }
        ];

        setRolls(rollDiceMock, 10, 20);
        const result = rollSavingThrow(char, 'Charisma', 15, undefined, undefined, structured);
        expect(result.roll).toBe(20);
    });

    it('applies a structured disadvantage modifier', () => {
        const char = createMockCombatCharacter({
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' }
        });

        const rollDiceMock = vi.mocked(diceRollers.rollDice);
        const structured: SaveAdvantageModifier[] = [
            { type: 'disadvantage', context: 'saving_throw', abilities: ['Wisdom'] }
        ];

        // Disadvantage takes the min of the two rolls.
        setRolls(rollDiceMock, 18, 4);
        const result = rollSavingThrow(char, 'Wisdom', 15, undefined, undefined, structured);
        expect(result.roll).toBe(4);
    });

    it('narrows a legacy contextual advantage string when effectContext is supplied', () => {
        const char = createMockCombatCharacter({
            modifiers: { advantage: ['advantage on saving throws against poison'], disadvantage: [], bonuses: [] } as any,
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' }
        });

        const rollDiceMock = vi.mocked(diceRollers.rollDice);

        // Poison context: legacy string still applies -> advantage, max(10, 20) = 20.
        setRolls(rollDiceMock, 10, 20);
        const resultPoison = rollSavingThrow(char, 'Constitution', 15, undefined, { damageType: 'poison' });
        expect(resultPoison.roll).toBe(20);

        // Fire context: legacy string is narrowed and no longer over-applies -> first roll stands.
        setRolls(rollDiceMock, 10, 20);
        const resultFire = rollSavingThrow(char, 'Constitution', 15, undefined, { damageType: 'fire' });
        expect(resultFire.roll).toBe(10);
    });

    it('preserves legacy broad behavior for contextual strings when no effectContext is given', () => {
        const char = createMockCombatCharacter({
            modifiers: { advantage: ['advantage on saving throws against poison'], disadvantage: [], bonuses: [] } as any,
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' }
        });

        const rollDiceMock = vi.mocked(diceRollers.rollDice);
        // No effectContext: unchanged (broad) behavior — advantage still applies, max(10, 20) = 20.
        setRolls(rollDiceMock, 10, 20);
        const result = rollSavingThrow(char, 'Constitution', 15);
        expect(result.roll).toBe(20);
    });
  });

  describe('calculateSaveDamage', () => {
    it('returns zero damage on a successful save when the effect uses saveEffect none', () => {
      const saveResult = {
        success: true,
        roll: 18,
        total: 18,
        dc: 13,
        natural20: false,
        natural1: false
      };

      expect(calculateSaveDamage(8, saveResult, 'none')).toBe(0);
    });

    it('still returns full damage on a failed save when the effect uses saveEffect none', () => {
      const saveResult = {
        success: false,
        roll: 2,
        total: 2,
        dc: 13,
        natural20: false,
        natural1: true
      };

      expect(calculateSaveDamage(8, saveResult, 'none')).toBe(8);
    });

    it('keeps half damage behavior unchanged for half-damage saves', () => {
      const saveResult = {
        success: true,
        roll: 18,
        total: 18,
        dc: 13,
        natural20: false,
        natural1: false
      };

      expect(calculateSaveDamage(9, saveResult, 'half')).toBe(4);
    });
  });

  // ==========================================================================
  // PHB 2024 saving-throw rules (SYS-2, agora-3d12.2)
  // ==========================================================================
  // Two rule families the helper only partly represented: proficiency stacking
  // (the bonus is added at most once, from any source, however it is spelled)
  // and 2024 species traits, which narrow by CONDITION rather than by damage
  // type. The context-free calls below deliberately pin the PRESERVED broad
  // behavior so the narrowing change stays opt-in.
  // ==========================================================================
  describe('PHB 2024 proficiency stacking', () => {
    const baseStats = {
      strength: 10, dexterity: 10, constitution: 10, intelligence: 10,
      wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1'
    };

    it('adds the proficiency bonus only once when class and feat both grant the same save', () => {
      // Mock class is a Wizard (Intelligence + Wisdom saves); Resilient (Intelligence)
      // grants the same save a second time. PHB 2024: PB is never added twice.
      const char = createMockCombatCharacter({
        level: 9, // PB +4
        stats: { ...baseStats },
        savingThrowProficiencies: ['Intelligence']
      });

      const rollDiceMock = vi.mocked(diceRollers.rollDice);
      rollDiceMock.mockReturnValue(10);

      const result = rollSavingThrow(char, 'Intelligence', 15);
      // 10 (roll) + 0 (Int mod) + 4 (PB, once) = 14, not 18.
      expect(result.total).toBe(14);
    });

    it('adds the proficiency bonus only once for a duplicated proficiency entry', () => {
      const char = createMockCombatCharacter({
        level: 5, // PB +3
        stats: { ...baseStats },
        savingThrowProficiencies: ['Dexterity', 'Dexterity']
      });

      const rollDiceMock = vi.mocked(diceRollers.rollDice);
      rollDiceMock.mockReturnValue(10);

      expect(rollSavingThrow(char, 'Dexterity', 15).total).toBe(13);
    });

    it('honors abbreviated and untrimmed proficiency spellings', () => {
      // Regression: the previous exact lowercase compare missed "dex" and
      // " Dexterity ", silently dropping a real proficiency grant.
      const abbreviated = createMockCombatCharacter({
        level: 1, // PB +2
        stats: { ...baseStats },
        savingThrowProficiencies: ['dex' as never]
      });
      const padded = createMockCombatCharacter({
        level: 1,
        stats: { ...baseStats },
        savingThrowProficiencies: [' Dexterity ' as never]
      });

      const rollDiceMock = vi.mocked(diceRollers.rollDice);
      rollDiceMock.mockReturnValue(10);

      expect(rollSavingThrow(abbreviated, 'Dexterity', 15).total).toBe(12);
      expect(rollSavingThrow(padded, 'Dexterity', 15).total).toBe(12);
    });

    it('does not add proficiency on top of an explicit monster save bonus', () => {
      // A published stat block's save bonus already includes proficiency, so it
      // replaces the computed modifier instead of stacking with it.
      const char = createMockCombatCharacter({
        level: 9,
        stats: { ...baseStats, dexterity: 18, saveBonuses: { dex: 7 } } as never,
        savingThrowProficiencies: ['Dexterity']
      });

      const rollDiceMock = vi.mocked(diceRollers.rollDice);
      rollDiceMock.mockReturnValue(10);

      expect(rollSavingThrow(char, 'Dexterity', 15).total).toBe(17);
    });

    it('reports proficiency from any source through hasSavingThrowProficiency', () => {
      const char = createMockCombatCharacter({ savingThrowProficiencies: ['con' as never] });

      expect(hasSavingThrowProficiency(char, 'Intelligence')).toBe(true);  // class grant
      expect(hasSavingThrowProficiency(char, 'Constitution')).toBe(true);  // feat grant, abbreviated
      expect(hasSavingThrowProficiency(char, 'Strength')).toBe(false);
    });
  });

  describe('PHB 2024 species traits', () => {
    const baseStats = {
      strength: 10, dexterity: 10, constitution: 10, intelligence: 10,
      wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1'
    };

    const withAdvantage = (text: string) => createMockCombatCharacter({
      modifiers: { advantage: [text], disadvantage: [], bonuses: [] } as never,
      stats: { ...baseStats }
    });

    const setRolls = (mock: ReturnType<typeof vi.mocked<typeof diceRollers.rollDice>>, ...rolls: number[]) => {
      mock.mockReset();
      for (const r of rolls) mock.mockReturnValueOnce(r);
      mock.mockReturnValue(0);
    };

    it('narrows Fey Ancestry to the Charmed condition instead of every save', () => {
      // 2024 wording carries no "against X" clause, so the old capture never fired
      // and this trait granted advantage on EVERY saving throw.
      const char = withAdvantage('You have advantage on saving throws you make to avoid or end the Charmed condition.');
      const rollDiceMock = vi.mocked(diceRollers.rollDice);

      setRolls(rollDiceMock, 10, 20);
      expect(rollSavingThrow(char, 'Wisdom', 15, undefined, { tags: ['charmed'] }).roll).toBe(20);

      setRolls(rollDiceMock, 10, 20);
      expect(rollSavingThrow(char, 'Dexterity', 15, undefined, { damageType: 'fire' }).roll).toBe(10);
    });

    it('reads the condition out of "against being frightened" (Brave)', () => {
      // The old regex captured the filler word "being" as the qualifier.
      const char = withAdvantage('Advantage on saving throws against being frightened.');
      const rollDiceMock = vi.mocked(diceRollers.rollDice);

      setRolls(rollDiceMock, 10, 20);
      expect(rollSavingThrow(char, 'Wisdom', 15, undefined, { tags: ['frightened'] }).roll).toBe(20);

      setRolls(rollDiceMock, 10, 20);
      expect(rollSavingThrow(char, 'Wisdom', 15, undefined, { tags: ['charmed'] }).roll).toBe(10);
    });

    it('matches Dwarven Resilience "Poisoned condition" against a poison effect tag', () => {
      const char = withAdvantage('You have advantage on saving throws you make to avoid or end the Poisoned condition.');
      const rollDiceMock = vi.mocked(diceRollers.rollDice);

      setRolls(rollDiceMock, 10, 20);
      expect(rollSavingThrow(char, 'Constitution', 15, undefined, { damageType: 'poison' }).roll).toBe(20);

      setRolls(rollDiceMock, 10, 20);
      expect(rollSavingThrow(char, 'Constitution', 15, undefined, { damageType: 'necrotic' }).roll).toBe(10);
    });

    it('preserves broad behavior for a condition-phrased trait when no effectContext is given', () => {
      const char = withAdvantage('You have advantage on saving throws you make to avoid or end the Charmed condition.');
      const rollDiceMock = vi.mocked(diceRollers.rollDice);

      setRolls(rollDiceMock, 10, 20);
      expect(rollSavingThrow(char, 'Dexterity', 15).roll).toBe(20);
    });

    it('keeps Gnomish Cunning on Intelligence, Wisdom and Charisma only', () => {
      const char = withAdvantage('You have advantage on Intelligence, Wisdom, and Charisma saving throws.');
      const rollDiceMock = vi.mocked(diceRollers.rollDice);

      setRolls(rollDiceMock, 10, 20);
      expect(rollSavingThrow(char, 'Charisma', 15).roll).toBe(20);

      setRolls(rollDiceMock, 10, 20);
      expect(rollSavingThrow(char, 'Strength', 15).roll).toBe(10);
    });

    it('does not stack two advantage sources and cancels advantage against disadvantage', () => {
      const rollDiceMock = vi.mocked(diceRollers.rollDice);

      const twoTraits = createMockCombatCharacter({
        modifiers: {
          advantage: [
            'Advantage on saving throws against being frightened.',
            'Advantage on all saving throws.'
          ],
          disadvantage: [],
          bonuses: []
        } as never,
        stats: { ...baseStats }
      });
      setRolls(rollDiceMock, 10, 20, 20);
      expect(rollSavingThrow(twoTraits, 'Wisdom', 15, undefined, { tags: ['frightened'] }).roll).toBe(20);
      // Advantage is a binary state: exactly two d20s, never three.
      expect(rollDiceMock).toHaveBeenCalledTimes(2);

      const bothWays = createMockCombatCharacter({
        modifiers: {
          advantage: ['Advantage on all saving throws.'],
          disadvantage: ['Disadvantage on all saving throws.'],
          bonuses: []
        } as never,
        stats: { ...baseStats }
      });
      setRolls(rollDiceMock, 10, 20);
      expect(rollSavingThrow(bothWays, 'Wisdom', 15).roll).toBe(10);
      expect(rollDiceMock).toHaveBeenCalledTimes(1);
    });

    it('extracts qualifiers from both 2024 condition wording and legacy "against" wording', () => {
      expect(extractSaveQualifiers('advantage on saving throws to avoid or end the Charmed condition'))
        .toContain('charmed');
      expect(extractSaveQualifiers('advantage on saving throws against being frightened'))
        .toContain('frightened');
      expect(extractSaveQualifiers('advantage on saving throws against poison')).toEqual(['poison']);
      // Unconditional trait: no qualifier, so it applies regardless of context.
      expect(extractSaveQualifiers('advantage on all saving throws')).toEqual([]);
    });

    it('treats condition and noun spellings of the same qualifier as one', () => {
      expect(qualifierMatches('Poisoned', 'poison')).toBe(true);
      expect(qualifierMatches('charmed', 'charmed')).toBe(true);
      expect(qualifierMatches('frightened', 'charmed')).toBe(false);
    });
  });
});
