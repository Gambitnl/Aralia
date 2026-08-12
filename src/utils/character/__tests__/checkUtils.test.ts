/**
 * This file proves ability checks honor their real modifiers and roll controls.
 *
 * Spell riders, skill proficiency, advantage, and deterministic simulations all
 * enter through rollAbilityCheck. These focused checks keep the shared resolver
 * from widening a targeted modifier or bypassing the normal dice engine.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rollAbilityCheck } from '../checkUtils';
import { CombatCharacter } from '../../../types/combat';
import { rollDice } from '../../combat/combatUtils';
import { rollSavingThrow } from '../savingThrowUtils';

vi.mock('../../combat/combatUtils', () => ({
  rollDice: vi.fn()
}));

const createCombatant = (): CombatCharacter => ({
  id: 'enhanced-target',
  name: 'Enhanced Target',
  stats: {
    strength: 16,
    dexterity: 14,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    maxHp: 20,
    currentHp: 20,
    ac: 12,
    speed: 30
  },
  level: 3,
  position: { x: 0, y: 0 },
  conditions: [],
  statusEffects: [],
  modifiers: {
    advantage: ['advantage on Strength ability checks from Enhance Ability'],
    disadvantage: [],
    bonuses: []
  }
} as unknown as CombatCharacter);

const createGuidedCombatant = (skill: string): CombatCharacter => ({
  ...createCombatant(),
  statusEffects: [
    {
      id: `guidance-${skill.toLowerCase()}`,
      name: `Guidance (${skill})`,
      type: 'buff',
      duration: 10,
      source: 'Guidance',
      sourceCasterId: 'caster',
      effect: { type: 'condition' },
      abilityCheckModifier: {
        appliesTo: 'ability_check',
        bonusDice: '1d4',
        skillSelection: 'chosen_skill',
        skillChooser: 'caster',
        skillPool: 'any_skill',
        frequency: 'every_matching_check',
        durationScope: 'while_active',
        notes: 'The target receives the bonus only for ability checks using the skill chosen when the spell is cast.'
      },
      modifiers: {
        skill
      }
    }
  ]
} as unknown as CombatCharacter);

describe('rollAbilityCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies Enhance Ability advantage only to the chosen ability', () => {
    // Strength is the chosen Enhance Ability option. The checker should roll
    // twice and keep the higher d20 because the modifier names Strength.
    vi.mocked(rollDice).mockReturnValueOnce(3).mockReturnValueOnce(17);
    const strengthCheck = rollAbilityCheck(createCombatant(), 'Strength');

    expect(strengthCheck.roll).toBe(17);
    expect(strengthCheck.total).toBe(20);
    expect(rollDice).toHaveBeenCalledTimes(2);

    // Dexterity is not the chosen option. The same modifier text still contains
    // "ability checks", but it must not grant global advantage.
    vi.clearAllMocks();
    vi.mocked(rollDice).mockReturnValueOnce(4).mockReturnValueOnce(19);
    const dexterityCheck = rollAbilityCheck(createCombatant(), 'Dexterity');

    expect(dexterityCheck.roll).toBe(4);
    expect(dexterityCheck.total).toBe(6);
    expect(rollDice).toHaveBeenCalledTimes(1);
  });

  it('applies Guidance only to the matching skill ability check and leaves saves untouched', () => {
    const guidedTarget = createGuidedCombatant('Arcana');

    // Guidance should boost the selected skill check, not every Intelligence
    // check and not any unrelated saving throw or attack roll path.
    vi.mocked(rollDice).mockImplementation((notation: string) => notation === '1d4' ? 4 : 16);
    const arcanaCheck = rollAbilityCheck(guidedTarget, 'Intelligence', 'Arcana');
    expect(arcanaCheck.modifiersApplied).toEqual([{ source: 'Guidance', value: 4 }]);

    vi.clearAllMocks();
    vi.mocked(rollDice).mockReturnValueOnce(9);
    const historyCheck = rollAbilityCheck(guidedTarget, 'Intelligence', 'History');
    expect(historyCheck.modifiersApplied).toBeUndefined();

    vi.clearAllMocks();
    vi.mocked(rollDice).mockReturnValueOnce(12);
    const abilityOnlyCheck = rollAbilityCheck(guidedTarget, 'Intelligence');
    expect(abilityOnlyCheck.modifiersApplied).toBeUndefined();

    vi.clearAllMocks();
    vi.mocked(rollDice).mockReturnValueOnce(11);
    const savingThrow = rollSavingThrow(guidedTarget, 'Wisdom', 10);
    expect(savingThrow.modifiersApplied).toBeUndefined();
  });

  it('applies source-backed fixed-skill advantage without widening the target', () => {
    // Hunter's Mark-style source data uses a fixed skill list and a string
    // advantage label rather than Guidance's numeric dice contract. The shared
    // check path should honor the listed skills and ignore unrelated checks.
    const markedTarget = {
      ...createCombatant(),
      statusEffects: [{
        id: 'hunters-mark-check',
        name: "Hunter's Mark",
        type: 'debuff',
        duration: 10,
        source: "Hunter's Mark",
        effect: { type: 'condition' },
        abilityCheckModifier: {
          appliesTo: 'Wisdom (Perception or Survival) checks to find the marked target',
          bonusDice: '',
          flatModifier: 'advantage',
          skillSelection: 'fixed_skills',
          skillChooser: 'spell',
          skillPool: ['Perception', 'Survival'],
          frequency: 'every_matching_check',
          durationScope: 'while_mark_remains_on_target'
        }
      }]
    } as unknown as CombatCharacter;

    vi.mocked(rollDice).mockReturnValueOnce(2).mockReturnValueOnce(18);
    const perceptionCheck = rollAbilityCheck(markedTarget, 'Wisdom', 'Perception');
    expect(perceptionCheck.roll).toBe(18);
    expect(rollDice).toHaveBeenCalledTimes(2);

    vi.clearAllMocks();
    vi.mocked(rollDice).mockReturnValueOnce(9);
    const investigationCheck = rollAbilityCheck(markedTarget, 'Intelligence', 'Investigation');
    expect(investigationCheck.roll).toBe(9);
    expect(rollDice).toHaveBeenCalledTimes(1);
  });

  it('forwards an injected random stream through the shared d20 roller', () => {
    const deterministicRng = vi.fn(() => 0.85);
    vi.mocked(rollDice).mockReturnValue(18);

    const result = rollAbilityCheck(
      createCombatant(),
      'Dexterity',
      'Acrobatics',
      { rng: deterministicRng },
    );

    expect(result.roll).toBe(18);
    expect(rollDice).toHaveBeenCalledWith('1d20', { rng: deterministicRng });
  });
});
