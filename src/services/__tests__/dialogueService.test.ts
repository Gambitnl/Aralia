
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerTopic,
  checkTopicPrerequisites,
  processTopicSelection,
  getAvailableTopics
} from '../dialogueService';
import { ConversationTopic, DialogueSession, NPCKnowledgeProfile } from '../../types/dialogue';
import { GameState, SuspicionLevel, Item, NPC } from '../../types/index';
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

const mockGlobalTopic: ConversationTopic = {
  id: 'test_topic_weather',
  label: 'Weather',
  category: 'rumor',
  playerPrompt: 'Nice weather.',
  isGlobal: true
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

// Helper to create an NPC with a specific knowledge profile
const createMockNPC = (id: string, knowledgeProfile?: NPCKnowledgeProfile): NPC => ({
  id,
  name: 'Test NPC',
  baseDescription: 'A test NPC',
  initialPersonalityPrompt: 'Friendly',
  role: 'civilian',
  knowledgeProfile
});

describe('Dialogue Service', () => {
  beforeEach(() => {
    registerTopic(mockTopic);
    registerTopic(mockPrereqTopic);
    registerTopic(mockSkillTopic);
    registerTopic(mockGlobalTopic);
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

  describe('NPC Knowledge & Willingness', () => {
    it('should filter out topics the NPC does not know', () => {
      // NPC with NO knowledge profile
      const dumbNPC = createMockNPC('npc_dumb');
      const topics = getAvailableTopics(mockGameState, 'npc_dumb', mockSession, dumbNPC);

      // Should ONLY contain Global topics
      expect(topics.map(t => t.id)).toContain('test_topic_weather');
      expect(topics.map(t => t.id)).not.toContain('test_topic_ruins');
    });

    it('should include topics explicitly known in knowledge profile', () => {
      const wiseNPC = createMockNPC('npc_wise', {
          baseOpenness: 50,
          topicOverrides: {
              'test_topic_ruins': { known: true }
          }
      });

      const topics = getAvailableTopics(mockGameState, 'npc_wise', mockSession, wiseNPC);
      expect(topics.map(t => t.id)).toContain('test_topic_ruins');
      expect(topics.map(t => t.id)).toContain('test_topic_weather');
      // Should NOT contain skill topic as it wasn't added to profile
      expect(topics.map(t => t.id)).not.toContain('test_topic_persuade');
    });

    it('should filter out topics marked as NOT known even if profile exists', () => {
       const forgetfulNPC = createMockNPC('npc_forget', {
          baseOpenness: 50,
          topicOverrides: {
              'test_topic_ruins': { known: false }
          }
      });

      const topics = getAvailableTopics(mockGameState, 'npc_forget', mockSession, forgetfulNPC);
      expect(topics.map(t => t.id)).not.toContain('test_topic_ruins');
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

    it('should adjust DC based on NPC willingness modifier', () => {
      // Base DC is 15.
      // NPC is very willing (+5 modifier).
      // Effective DC should be 15 - 5 = 10.
      // Roll is 10.
      // 10 >= 10 -> Success. (If no modifier, 10 < 15 -> Failure)

      const willingNPC = createMockNPC('npc_willing', {
          baseOpenness: 50,
          topicOverrides: {
              'test_topic_persuade': { known: true, willingnessModifier: 5 }
          }
      });

      vi.mocked(combatUtils.rollDice).mockReturnValue(10);

      const result = processTopicSelection('test_topic_persuade', mockGameState, mockSession, 0, willingNPC);
      expect(result.status).toBe('success');
    });

    it('should increase DC if NPC is unwilling (negative modifier)', () => {
      // Base DC 15.
      // NPC is unwilling (-5 modifier).
      // Effective DC should be 15 - (-5) = 20.
      // Roll is 18.
      // 18 < 20 -> Failure. (If no modifier, 18 >= 15 -> Success)

       const unwillingNPC = createMockNPC('npc_unwilling', {
          baseOpenness: 50,
          topicOverrides: {
              'test_topic_persuade': { known: true, willingnessModifier: -5 }
          }
      });

      vi.mocked(combatUtils.rollDice).mockReturnValue(18);

      const result = processTopicSelection('test_topic_persuade', mockGameState, mockSession, 0, unwillingNPC);
      expect(result.status).toBe('failure');
    });
  });
});
