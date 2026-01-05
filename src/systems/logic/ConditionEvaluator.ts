/**
 * @file src/systems/logic/ConditionEvaluator.ts
 * Generic engine for evaluating generic Logic Conditions.
 * Used by Spells (Contingency), Triggers, and AI.
 */
import { Condition, CompositeCondition, StateCondition } from '../../types/logic';
import { CombatCharacter, CombatState } from '../../types/combat';

export interface EvaluationContext {
  self: CombatCharacter;
  target?: CombatCharacter;
  source?: CombatCharacter; // Origin of the effect/check
  state?: CombatState;      // Optional global state access
}

export class ConditionEvaluator {
  /**
   * Evaluates a Condition tree against a given context.
   * @param condition The condition to evaluate.
   * @param context The context providing character/state data.
   * @returns boolean result.
   */
  static evaluate(condition: Condition, context: EvaluationContext): boolean {
    if (condition.type === 'composite') {
      return this.evaluateComposite(condition, context);
    }
    return this.evaluateState(condition, context);
  }

  private static evaluateComposite(condition: CompositeCondition, context: EvaluationContext): boolean {
    if (condition.operator === 'NOT') {
      // For NOT, we expect exactly one child condition usually, but if array, negate ALL?
      // Convention: NOT operates on the first condition in the array, or implies AND of all then NOT.
      // Simplest: NOT requires length 1.
      if (condition.conditions.length === 0) return true; // NOT nothing = true? Or false?
      return !this.evaluate(condition.conditions[0], context);
    }

    if (condition.operator === 'AND') {
      return condition.conditions.every(c => this.evaluate(c, context));
    }

    if (condition.operator === 'OR') {
      return condition.conditions.some(c => this.evaluate(c, context));
    }

    return false;
  }

  private static evaluateState(condition: StateCondition, context: EvaluationContext): boolean {
    const targetChar = this.resolveTarget(condition.target, context);
    if (!targetChar) return false; // If target doesn't exist, condition fails

    switch (condition.type) {
      case 'status':
        return this.evaluateStatus(condition, targetChar);
      case 'attribute':
        return this.evaluateAttribute(condition, targetChar);
      case 'stat':
        return this.evaluateStat(condition, targetChar);
      case 'creature_type':
        return this.evaluateCreatureType(condition, targetChar);
    }
  }

  private static resolveTarget(targetType: 'self' | 'target' | 'source', context: EvaluationContext): CombatCharacter | undefined {
    if (targetType === 'self') return context.self;
    if (targetType === 'target') return context.target;
    if (targetType === 'source') return context.source;
    return undefined;
  }

  private static evaluateStatus(condition: import('../../types/logic').StatusCondition, character: CombatCharacter): boolean {
    const hasStatus = character.statusEffects.some(s => s.name.toLowerCase() === condition.statusId.toLowerCase());
    return condition.negate ? !hasStatus : hasStatus;
  }

  private static evaluateAttribute(condition: import('../../types/logic').AttributeCondition, character: CombatCharacter): boolean {
    const value = this.getAttributeValue(character, condition.attribute);
    return this.compare(value, condition.operator, condition.value);
  }

  private static evaluateStat(condition: import('../../types/logic').StatCondition, character: CombatCharacter): boolean {
     const value = this.getStatValue(character, condition.stat);
     return this.compare(value, condition.operator, condition.value);
  }

  private static evaluateCreatureType(condition: import('../../types/logic').CreatureTypeCondition, character: CombatCharacter): boolean {
    // TODO(Analyst): Populate creatureTypes on characters during initialization from Race/Class data.
    // Currently, this check relies on the property being present, but it may be undefined for legacy data.
    if (!character.creatureTypes || character.creatureTypes.length === 0) {
      return false;
    }

    // Case-insensitive check
    // If the character has ANY of the types matching the condition
    const conditionTypeLower = condition.creatureType.toLowerCase();
    return character.creatureTypes.some(type => type.toLowerCase() === conditionTypeLower);
  }

  private static getAttributeValue(character: CombatCharacter, attribute: string): number {
    switch (attribute.toLowerCase()) {
      case 'hp': return character.currentHP;
      case 'maxhp': return character.maxHP;
      case 'ac': return character.armorClass ?? 0;
      case 'movement': return character.stats.speed;
      case 'initiative': return character.initiative;
      default: return 0;
    }
  }

  private static getStatValue(character: CombatCharacter, stat: string): number {
      // stats are typically stored in character.stats[stat]
      // Mapping 'strength' -> 'str', etc. might be needed
      const key = stat.toLowerCase();
      // Assuming stats are flattened or accessible via abilities
      // CombatCharacter has 'abilities' { strength: 10... }
      // TODO(2026-01-03 pass 4 Codex-CLI): Replace loose stat lookup with an explicit key map once ConditionAttributes are typed.
      // Was a direct CharacterStats->Record cast; now cast through unknown to satisfy TS index-signature mismatch.
      const stats = character.stats as unknown as Record<string, number>;
      return typeof stats[key] === 'number' ? stats[key] : 0;
  }

  private static compare(actual: number, op: import('../../types/logic').ComparisonOperator, target: number): boolean {
    switch (op) {
      case 'eq': return actual === target;
      case 'neq': return actual !== target;
      case 'gt': return actual > target;
      case 'gte': return actual >= target;
      case 'lt': return actual < target;
      case 'lte': return actual <= target;
      default: return false;
    }
  }
}
