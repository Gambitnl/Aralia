
import { describe, it, expect } from 'vitest';
import { ConditionEvaluator, EvaluationContext } from '../ConditionEvaluator';
import { Condition } from '../../../types/logic';
import { CombatCharacter } from '../../../types/combat';

// Mock character factory
const createMockCharacter = (id: string, hp: number, statusEffects: any[] = []): CombatCharacter => ({
  id,
  name: 'Mock',
  hp,
  maxHp: 100,
  stats: { armorClass: 15, movementSpeed: 30, initiativeBonus: 0, passivePerception: 10 },
  abilities: { strength: 10, dexterity: 12 },
  statusEffects,
  conditions: [], // Add required conditions property
  // ... minimal required fields
} as any as CombatCharacter);

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
      const poisonedHero = createMockCharacter('hero', 50, [{ statusCondition: { name: 'Poisoned' } }]);
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
