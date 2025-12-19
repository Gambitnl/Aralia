/**
 * @file src/types/logic.ts
 * Generic logic types for condition evaluation.
 * Used for building complex condition trees for spells (Contingency, Glyph),
 * AI decision making, and dialogue triggers.
 */

//==============================================================================
// Operators
//==============================================================================

export type LogicalOperator = 'AND' | 'OR' | 'NOT';
export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

//==============================================================================
// Condition Union
//==============================================================================

export type Condition =
  | CompositeCondition
  | StateCondition;

//==============================================================================
// Composite Conditions (Logic Tree)
//==============================================================================

export interface CompositeCondition {
  type: 'composite';
  operator: LogicalOperator;
  conditions: Condition[];
}

//==============================================================================
// State Conditions (Leaf Nodes)
//==============================================================================

export type StateCondition =
  | StatusCondition
  | AttributeCondition
  | StatCondition
  | CreatureTypeCondition;

/** Checks if a target has a specific status condition (e.g., 'Poisoned'). */
export interface StatusCondition {
  type: 'status';
  statusId: string; // e.g., 'poisoned'
  target: 'self' | 'target' | 'source';
  negate?: boolean;
}

/** Checks a dynamic attribute (e.g., HP, Spell Slots). */
export interface AttributeCondition {
  type: 'attribute';
  attribute: string; // e.g., 'hp', 'ac', 'spell_slots'
  operator: ComparisonOperator;
  value: number;
  target: 'self' | 'target' | 'source';
}

/** Checks a static stat (e.g., Strength Score). */
export interface StatCondition {
    type: 'stat';
    stat: string; // e.g. 'strength'
    operator: ComparisonOperator;
    value: number;
    target: 'self' | 'target' | 'source';
}

/**
 * Checks creature type (e.g., Undead).
 * Used by spells like Charm Person (Humanoid) or Hold Person.
 */
export interface CreatureTypeCondition {
    type: 'creature_type';
    /** The creature type to check for (e.g., "Humanoid"). Case-insensitive. */
    creatureType: string;
    target: 'self' | 'target' | 'source';
}
