import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rollAbilityCheck } from '../checkUtils';
import { CombatCharacter } from '../../../types/combat';
import { rollDice } from '../../combat/combatUtils';

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
});
