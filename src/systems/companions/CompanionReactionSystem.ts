// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 08/06/2026, 13:34:24
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/CompanionReactionSystem.ts
 * Evaluates companion reactions to player decisions.
 */

import { Companion, DecisionContext, ReactionResult, CompanionReactionRule, RelationshipLevel } from '../../types/companions';

// Relationship reactions use the same coarse approval ladder as the rest of the companion system.
// Keeping the mapping local avoids importing a heavier manager just to compare bounds.
const RELATIONSHIP_LEVEL_WEIGHTS: Record<RelationshipLevel, number> = {
  hated: -5,
  enemy: -4,
  rival: -3,
  distrusted: -2,
  wary: -1,
  stranger: 0,
  acquaintance: 1,
  friend: 2,
  close: 3,
  devoted: 4,
  romance: 5
};

const getRelationshipWeight = (level: RelationshipLevel): number => RELATIONSHIP_LEVEL_WEIGHTS[level];

const meetsRelationshipRequirements = (companion: Companion, rule: CompanionReactionRule): boolean => {
  if (!rule.requirements) {
    return true;
  }

  const needsRelationshipState = Boolean(rule.requirements.minRelationship || rule.requirements.maxRelationship);
  if (!needsRelationshipState) {
    return true;
  }

  const playerRelationship = companion.relationships['player'];

  // Relationship bounds are evaluated against the current player relationship only when
  // the rule actually declares min/max relationship requirements.
  if (!playerRelationship) {
    return false;
  }

  const currentWeight = getRelationshipWeight(playerRelationship.level);

  if (rule.requirements.minRelationship) {
    const minWeight = getRelationshipWeight(rule.requirements.minRelationship);
    if (currentWeight < minWeight) {
      return false;
    }
  }

  if (rule.requirements.maxRelationship) {
    const maxWeight = getRelationshipWeight(rule.requirements.maxRelationship);
    if (currentWeight > maxWeight) {
      return false;
    }
  }

  return true;
};

export class CompanionReactionSystem {

  /**
   * Evaluates how a companion reacts to a specific decision context.
   * Returns a ReactionResult if they react, or null if they don't care.
   */
  static evaluateReaction(companion: Companion, context: DecisionContext): ReactionResult | null {
    // 1. Find matching rules
    // RALPH: Matches player decision "Tags" (e.g., 'aggressive', 'greedy') against Companion Rules.
    // A rule matches if ANY of its triggerTags are present in the decision's tags.
    const matchingRules = companion.reactionRules.filter(rule =>
      rule.triggerTags.some(tag => context.tags.includes(tag)) &&
      meetsRelationshipRequirements(companion, rule)
    );

    if (matchingRules.length === 0) {
      return null;
    }

    // 2. Aggregate effects
    // Strategy: Sum approval changes. Use the dialogue from the "strongest" rule (highest absolute approval change).
    // RALPH: Calculates total approval impact but only selects the most "intense" dialogue response.
    let totalApproval = 0;
    let strongestRule: CompanionReactionRule | null = null;
    let maxAbsChange = -1;

    for (const rule of matchingRules) {
      // Calculate change based on magnitude
      // Base change * magnitude
      const change = rule.approvalChange * context.magnitude;
      totalApproval += change;

      const absChange = Math.abs(change);
      if (absChange > maxAbsChange) {
        maxAbsChange = absChange;
        strongestRule = rule;
      }
    }

    // If total approval is 0 and we have no strongest rule (unlikely if rules matched), return null
    if (!strongestRule && totalApproval === 0) {
      return null;
    }

    // Fallback if total is 0 but we matched a rule (e.g. flavor reaction with 0 approval)
    if (!strongestRule && matchingRules.length > 0) {
        strongestRule = matchingRules[0];
    }

    // 3. Select dialogue
    let dialogue: string | undefined;
    if (strongestRule && strongestRule.dialoguePool.length > 0) {
       // Pick random dialogue
       const idx = Math.floor(Math.random() * strongestRule.dialoguePool.length);
       dialogue = strongestRule.dialoguePool[idx];
    }

    return {
      companionId: companion.id,
      approvalChange: totalApproval,
      dialogue: dialogue,
      isSilent: false
    };
  }
}
