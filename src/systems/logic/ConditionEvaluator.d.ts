/**
 * @file src/systems/logic/ConditionEvaluator.ts
 * Generic engine for evaluating generic Logic Conditions.
 * Used by Spells (Contingency), Triggers, and AI.
 */
import { Condition } from '../../types/logic';
import { CombatCharacter, CombatState } from '../../types/combat';
export interface EvaluationContext {
    self: CombatCharacter;
    target?: CombatCharacter;
    source?: CombatCharacter;
    state?: CombatState;
}
export declare class ConditionEvaluator {
    /**
     * Evaluates a Condition tree against a given context.
     * @param condition The condition to evaluate.
     * @param context The context providing character/state data.
     * @returns boolean result.
     */
    static evaluate(condition: Condition, context: EvaluationContext): boolean;
    private static evaluateComposite;
    private static evaluateState;
    private static resolveTarget;
    private static evaluateStatus;
    private static evaluateAttribute;
    private static evaluateStat;
    private static evaluateCreatureType;
    private static getAttributeValue;
    private static getStatValue;
    private static compare;
}
