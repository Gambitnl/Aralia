
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerTopic,
  checkTopicPrerequisites,
  processTopicSelection
} from '../dialogueService';
import { ConversationTopic, DialogueSession } from '../../types/dialogue';
import { GameState, SuspicionLevel, Item } from '../../types/index';
import * as combatUtils from '../../utils/combatUtils';

// Mock rollDice
vi.mock('../../utils/combatUtils', () => ({
  rollDice: vi.fn()
}));

// Mocks
const mockTopic: ConversationTopic = {
  id: 'test_topic_ruins',
  label: 'Ask about the ruins',
  category: 'lore',
  playerPrompt: 'Tell me about the old ruins.',
  unlocksTopics: ['test_topic_treasure'],
  isOneTime: true
};

const mockPrereqTopic: ConversationTopic = {
  id: 'test_topic_restricted',
  label: 'Secret Talk',
  category: 'personal',
  playerPrompt: 'Tell me your secret.',
  prerequisites: [
    { type: 'relationship', targetId: 'npc_1', value: 50 },
    { type: 'item_owned', targetId: 'gold_coin', value: 3 },
    { type: 'min_gold', value: 100 }
  ]
};

const mockSkillTopic: ConversationTopic = {
  id: 'test_topic_persuade',
  label: 'Persuade Guard',
  category: 'rumor',
  playerPrompt: 'Let me pass.',
  skillCheck: {
    skill: 'Persuasion',
    dc: 15,
    successUnlocks: ['unlocked_area'],
    xpReward: 100,
    failureConsequence: {
      response: 'Get lost!',
      dispositionChange: -10,
      lockTopic: true
    }
  }
};

// Helper to create mock items
const createMockItem = (id: string, extraProps: any = {}): Item => ({
  id,
  name: id,
  description: 'test item',
  type: 'treasure',
  ...extraProps
});

const mockGameState = {
  npcMemory: {
    'npc_1': {
      disposition: 60,
      knownFacts: [],
      suspicion: SuspicionLevel.Unaware,
      goals: []
    }
  },
  inventory: [
    createMockItem('gold_coin'),
    createMockItem('gold_coin'),
    createMockItem('gold_coin'), // 3 coins
    createMockItem('sword')
  ],
  gold: 150, // Meets min_gold requirement
  questLog: [],
  discoveryLog: []
} as unknown as GameState;

const mockSession: DialogueSession = {
  npcId: 'npc_1',
  availableTopicIds: [],
  discussedTopicIds: [],
  sessionDispositionMod: 0
};

describe('Dialogue Service', () => {
  beforeEach(() => {
    registerTopic(mockTopic);
    registerTopic(mockPrereqTopic);
    registerTopic(mockSkillTopic);
    vi.clearAllMocks();
  });

  describe('checkTopicPrerequisites', () => {
    it('should return true if no prerequisites', () => {
      const result = checkTopicPrerequisites(mockTopic, mockGameState, 'npc_1');
      expect(result).toBe(true);
    });

    it('should return true if all conditions (relationship, unstacked items, gold) are met', () => {
      const result = checkTopicPrerequisites(mockPrereqTopic, mockGameState, 'npc_1');
      expect(result).toBe(true);
    });

    it('should return false if relationship is too low', () => {
      const lowRelState = {
        ...mockGameState,
        npcMemory: {
          'npc_1': { ...mockGameState.npcMemory['npc_1'], disposition: 10 }
        }
      } as unknown as GameState;

      const result = checkTopicPrerequisites(mockPrereqTopic, lowRelState, 'npc_1');
      expect(result).toBe(false);
    });

    it('should return false if item count is insufficient', () => {
      const poorState = {
        ...mockGameState,
        inventory: [
           createMockItem('gold_coin'),
           createMockItem('gold_coin')
        ]
      } as unknown as GameState;

      const result = checkTopicPrerequisites(mockPrereqTopic, poorState, 'npc_1');
      expect(result).toBe(false);
    });

    it('should return true if item count is sufficient via stacking', () => {
      const stackedState = {
        ...mockGameState,
        inventory: [
           createMockItem('gold_coin', { count: 5 })
        ]
      } as unknown as GameState;

      const result = checkTopicPrerequisites(mockPrereqTopic, stackedState, 'npc_1');
      expect(result).toBe(true);
    });

    it('should return false if gold is insufficient', () => {
      const poorState = {
        ...mockGameState,
        gold: 50
      } as unknown as GameState;

      const result = checkTopicPrerequisites(mockPrereqTopic, poorState, 'npc_1');
      expect(result).toBe(false);
    });
  });

  describe('processTopicSelection', () => {
    it('should return prompt and unlocks for normal topic', () => {
      const result = processTopicSelection('test_topic_ruins', mockGameState, mockSession);
      expect(result.status).toBe('neutral');
      expect(result.responsePrompt).toBe('Tell me about the old ruins.');
      expect(result.unlocks).toContain('test_topic_treasure');
      expect(mockSession.discussedTopicIds).toContain('test_topic_ruins');
    });

    it('should return success result when skill check passes', () => {
      vi.mocked(combatUtils.rollDice).mockReturnValue(15); // Roll 15

      const result = processTopicSelection('test_topic_persuade', mockGameState, mockSession, 0);

      expect(result.status).toBe('success');
      expect(result.unlocks).toContain('unlocked_area');
      expect(result.xpReward).toBe(100);
    });

    it('should return failure result when skill check fails', () => {
      vi.mocked(combatUtils.rollDice).mockReturnValue(5); // Roll 5 + 0 < 15

      const result = processTopicSelection('test_topic_persuade', mockGameState, mockSession, 0);

      expect(result.status).toBe('failure');
      expect(result.responsePrompt).toBe('Get lost!');
      expect(result.dispositionChange).toBe(-10);
      expect(result.lockTopic).toBe(true);
    });

    it('should account for skill modifier', () => {
      vi.mocked(combatUtils.rollDice).mockReturnValue(10); // Roll 10
      // 10 + 6 = 16 >= 15 (Success)

      const result = processTopicSelection('test_topic_persuade', mockGameState, mockSession, 6);

      expect(result.status).toBe('success');
    });
  });
});
