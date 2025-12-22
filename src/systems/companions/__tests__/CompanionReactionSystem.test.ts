/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/__tests__/CompanionReactionSystem.test.ts
 * Tests for the CompanionReactionSystem.
 */

import { describe, it, expect } from 'vitest';
import { CompanionReactionSystem } from '../CompanionReactionSystem';
import { Companion, DecisionContext, CompanionReactionRule } from '../../types/companions';

// Mock Companion Factory
const createMockCompanion = (id: string, rules: CompanionReactionRule[]): Companion => ({
  id,
  identity: { id, name: 'Mock Companion', race: 'Human', class: 'Fighter', background: 'Soldier' },
  personality: {
      openness: 50, conscientiousness: 50, extraversion: 50,
      agreeableness: 50, neuroticism: 50, values: [], fears: [], quirks: []
  },
  goals: [],
  relationships: {
      player: { targetId: 'player', level: 'stranger', approval: 0, history: [], unlocks: [] }
  },
  loyalty: 50,
  approvalHistory: [],
  reactionRules: rules
});

describe('CompanionReactionSystem', () => {
  it('should return null if no rules match', () => {
    const companion = createMockCompanion('c1', [
      { triggerTags: ['crime'], approvalChange: -10, dialoguePool: ['Bad!'] }
    ]);

    const context: DecisionContext = {
      id: 'd1',
      type: 'charity',
      tags: ['charity', 'good'], // No 'crime' tag
      magnitude: 1
    };

    const result = CompanionReactionSystem.evaluateReaction(companion, context);
    expect(result).toBeNull();
  });

  it('should calculate approval change based on magnitude', () => {
    const companion = createMockCompanion('c1', [
      { triggerTags: ['crime'], approvalChange: -5, dialoguePool: ['Stop!'] }
    ]);

    const context: DecisionContext = {
      id: 'd1',
      type: 'theft',
      tags: ['crime'],
      magnitude: 2 // Should double the impact
    };

    const result = CompanionReactionSystem.evaluateReaction(companion, context);
    expect(result).not.toBeNull();
    expect(result?.approvalChange).toBe(-10); // -5 * 2
    expect(result?.companionId).toBe('c1');
  });

  it('should select dialogue from the strongest rule', () => {
    const companion = createMockCompanion('c1', [
      { triggerTags: ['crime'], approvalChange: -5, dialoguePool: ['Crime is bad'] },
      { triggerTags: ['murder'], approvalChange: -20, dialoguePool: ['Murderer!'] }
    ]);

    const context: DecisionContext = {
      id: 'd1',
      type: 'murder',
      tags: ['crime', 'murder'],
      magnitude: 1
    };

    const result = CompanionReactionSystem.evaluateReaction(companion, context);
    expect(result?.approvalChange).toBe(-25); // -5 + -20
    expect(result?.dialogue).toBe('Murderer!'); // Stronger rule
  });

  it('should handle multiple matching tags and aggregate approval', () => {
     const companion = createMockCompanion('c1', [
      { triggerTags: ['smart'], approvalChange: 5, dialoguePool: ['Smart.'] },
      { triggerTags: ['risky'], approvalChange: -2, dialoguePool: ['Careful.'] }
    ]);

    const context: DecisionContext = {
      id: 'd1',
      type: 'tactic',
      tags: ['smart', 'risky'],
      magnitude: 1
    };

    const result = CompanionReactionSystem.evaluateReaction(companion, context);
    expect(result?.approvalChange).toBe(3); // 5 - 2
  });
});
