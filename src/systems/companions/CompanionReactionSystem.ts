/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/CompanionReactionSystem.ts
 * Evaluates companion reactions to player decisions.
 */

import { Companion, DecisionContext, ReactionResult, CompanionReactionRule } from '../../types/companions';

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
      rule.triggerTags.some(tag => context.tags.includes(tag))
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
      // Check requirements if present
      if (rule.requirements) {
        // TODO(lint-intent): 'relationship' is declared but unused, suggesting an unfinished state/behavior hook in this block.
        // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
        // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
        const _relationship = companion.relationships['player']; // Assume player is target for now
        // Skip if requirements not met (omitted for MVP simplicity, but placeholding logic)
        // if (rule.requirements.minRelationship && ...) continue;
      }

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
