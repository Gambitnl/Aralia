
import { describe, it, expect } from 'vitest';
import { ConditionEvaluator, EvaluationContext } from '../ConditionEvaluator';
import { Condition } from '../../../types/logic';
import { CombatCharacter } from '../../../types/combat';

// Minimal class payload; evaluator never inspects class details.
const mockClass = {
  id: 'fighter',
  name: 'Fighter',
  description: '',
  hitDie: 10,
  primaryAbility: [],
  savingThrowProficiencies: [],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 0,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: []
};

// Shared action economy stub so CombatCharacter typing stays valid in tests.
const baseActionEconomy = {
  action: { used: false, remaining: 1 },
  bonusAction: { used: false, remaining: 1 },
  reaction: { used: false, remaining: 1 },
  movement: { used: 0, total: 30 },
  freeActions: 0
};

// Mock character factory for the evaluator; keep only fields it reads.
// TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
const createMockCharacter = (id: string, currentHP: number, statusEffects: { name: string }[] = []): CombatCharacter => ({
  id,
  name: 'Mock',
  level: 1,
  class: mockClass,
  position: { x: 0, y: 0 },
  stats: { speed: 30 } as unknown as CombatCharacter['stats'],
  abilities: [],
  team: 'player',
  currentHP,
  maxHP: 100,
  initiative: 0,
  armorClass: 15,
  statusEffects,
  conditions: [], // Add required conditions property
  actionEconomy: baseActionEconomy
// TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
} as unknown as CombatCharacter);

describe('ConditionEvaluator', () => {
  const hero = createMockCharacter('hero', 50);
  const villain = createMockCharacter('villain', 100);

  const context: EvaluationContext = {
    self: hero,
    target: villain
  };

  it('evaluates simple attribute comparison (HP < 60)', () => {
    const condition: Condition = {
      type: 'attribute',
      attribute: 'hp',
      operator: 'lt',
      value: 60,
      target: 'self'
    };
    expect(ConditionEvaluator.evaluate(condition, context)).toBe(true);
  });

  it('evaluates simple attribute comparison (HP > 60)', () => {
    const condition: Condition = {
      type: 'attribute',
      attribute: 'hp',
      operator: 'gt',
      value: 60,
      target: 'self'
    };
    expect(ConditionEvaluator.evaluate(condition, context)).toBe(false);
  });

  it('evaluates composite AND logic', () => {
    const condition: Condition = {
      type: 'composite',
      operator: 'AND',
      conditions: [
        { type: 'attribute', attribute: 'hp', operator: 'lt', value: 60, target: 'self' },
        { type: 'attribute', attribute: 'hp', operator: 'gt', value: 90, target: 'target' }
      ]
    };
    // Hero HP 50 (<60), Villain HP 100 (>90) -> True AND True
    expect(ConditionEvaluator.evaluate(condition, context)).toBe(true);
  });

  it('evaluates composite OR logic', () => {
    const condition: Condition = {
      type: 'composite',
      operator: 'OR',
      conditions: [
        { type: 'attribute', attribute: 'hp', operator: 'gt', value: 60, target: 'self' }, // False
        { type: 'attribute', attribute: 'hp', operator: 'gt', value: 90, target: 'target' } // True
      ]
    };
    expect(ConditionEvaluator.evaluate(condition, context)).toBe(true);
  });

  it('evaluates status condition', () => {
      const poisonedHero = createMockCharacter('hero', 50, [{ name: 'Poisoned' }]);
      const ctx = { self: poisonedHero };
      const condition: Condition = {
          type: 'status',
          statusId: 'Poisoned',
          target: 'self'
      };
      expect(ConditionEvaluator.evaluate(condition, ctx)).toBe(true);
  });

  it('evaluates creature type (Humanoid match)', () => {
    const human = createMockCharacter('human', 50);
    human.creatureTypes = ['Humanoid'];

    const contextWithHuman = {
      self: human,
      target: human
    };

    const condition: Condition = {
      type: 'creature_type',
      creatureType: 'Humanoid',
      target: 'self'
    };
    expect(ConditionEvaluator.evaluate(condition, contextWithHuman)).toBe(true);
  });

  it('evaluates creature type (Humanoid mismatch)', () => {
    const beast = createMockCharacter('beast', 50);
    beast.creatureTypes = ['Beast'];

    const contextWithBeast = {
      self: beast,
      target: beast
    };

    const condition: Condition = {
      type: 'creature_type',
      creatureType: 'Humanoid',
      target: 'self'
    };
    expect(ConditionEvaluator.evaluate(condition, contextWithBeast)).toBe(false);
  });
});
