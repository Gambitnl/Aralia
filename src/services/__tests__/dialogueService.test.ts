
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerTopic,
  checkTopicPrerequisites,
  processTopicSelection,
  getAvailableTopics,
  getDynamicRumorTopics,
  getTopic
} from '../dialogueService';
import { ConversationTopic, DialogueSession, NPCKnowledgeProfile } from '../../types/dialogue';
import { GameState, SuspicionLevel, Item, NPC, WorldRumor } from '../../types/index';
import * as combatUtils from '../../utils/combatUtils';
import * as timeUtils from '../../utils/timeUtils';

// Mock rollDice
vi.mock('../../utils/combatUtils', () => ({
  rollDice: vi.fn()
}));

// Mock time utils for expiration check
vi.mock('../../utils/timeUtils', async () => {
    const actual = await vi.importActual('../../utils/timeUtils');
    return {
        ...actual,
        getGameDay: vi.fn()
    };
});

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
const createMockItem = (id: string, extraProps: unknown = {}): Item => ({
  id,
  name: id,
  description: 'test item',
  type: 'treasure',
  ...extraProps
});

const mockRumor: WorldRumor = {
    id: 'rumor_war',
    text: 'War is coming to the North.',
    type: 'skirmish',
    timestamp: 100,
    expiration: 200,
    sourceFactionId: 'faction_a',
    virality: 0.8
};

const mockLocalRumor: WorldRumor = {
    id: 'rumor_local_theft',
    text: 'A theft in the market.',
    type: 'misc',
    timestamp: 100,
    expiration: 200,
    locationId: 'loc_1',
    virality: 0.2 // Low virality, but local
};

const mockExpiredRumor: WorldRumor = {
    id: 'rumor_old_news',
    text: 'Old news.',
    type: 'misc',
    timestamp: 50,
    expiration: 90, // Expired if current day is 100
    virality: 0.9 // High virality shouldn't save it
};

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
  discoveryLog: [],
  activeRumors: [mockRumor, mockLocalRumor, mockExpiredRumor],
  currentLocationActiveDynamicNpcIds: [],
  currentLocationId: 'loc_1',
  gameTime: new Date()
} as unknown as GameState;

const mockSession: DialogueSession = {
  npcId: 'npc_1',
  availableTopicIds: [],
  discussedTopicIds: [],
  sessionDispositionMod: 0
};

// Helper to create an NPC with a specific knowledge profile
const createMockNPC = (id: string, knowledgeProfile?: NPCKnowledgeProfile, faction?: string): NPC => ({
  id,
  name: 'Test NPC',
  baseDescription: 'A test NPC',
  initialPersonalityPrompt: 'Friendly',
  role: 'civilian',
  knowledgeProfile,
  faction
});

describe('Dialogue Service', () => {
  beforeEach(() => {
    registerTopic(mockTopic);
    registerTopic(mockPrereqTopic);
    registerTopic(mockSkillTopic);
    registerTopic(mockGlobalTopic);
    vi.clearAllMocks();
    vi.mocked(timeUtils.getGameDay).mockReturnValue(100); // Current day 100
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

      // Should ONLY contain Global topics (and high virality rumors if applicable)
      // mockRumor has virality 0.8, so it is high enough to be global if not faction bound?
      // Our logic: virality > 0.5 AND no region/location -> Global.
      // So 'rumor_war' should appear.
      expect(topics.map(t => t.id)).toContain('test_topic_weather');
      expect(topics.map(t => t.id)).toContain('rumor_rumor_war');
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

  describe('Dynamic Rumors', () => {
    it('should generate topics for faction-relevant rumors', () => {
      const factionNPC = createMockNPC('npc_faction', undefined, 'faction_a');
      const topics = getDynamicRumorTopics(mockGameState, factionNPC);

      expect(topics.some(t => t.id === 'rumor_rumor_war')).toBe(true);
    });

    it('should generate topics for high virality rumors even if no faction match', () => {
       const neutralNPC = createMockNPC('npc_neutral');
       // mockRumor has virality 0.8
       const topics = getDynamicRumorTopics(mockGameState, neutralNPC);
       expect(topics.some(t => t.id === 'rumor_rumor_war')).toBe(true);
    });

    it('should generate topics for LOCAL rumors (Static NPC context)', () => {
        // NPC is not in dynamic list, so we assume they are in currentLocationId ('loc_1')
        // mockLocalRumor is at 'loc_1'
        const staticLocalNPC = createMockNPC('npc_local');
        const topics = getDynamicRumorTopics(mockGameState, staticLocalNPC);

        expect(topics.some(t => t.id === 'rumor_rumor_local_theft')).toBe(true);
    });

    it('should NOT generate topics for low virality rumors with no connection', () => {
        const secretRumor: WorldRumor = { ...mockRumor, id: 'secret', virality: 0.1, sourceFactionId: 'other' };
        // Clean state with only the secret rumor
        const state = { ...mockGameState, activeRumors: [secretRumor] } as unknown as GameState;

        const neutralNPC = createMockNPC('npc_neutral');
        const topics = getDynamicRumorTopics(state, neutralNPC);
        expect(topics.length).toBe(0);
    });

    it('should NOT generate topics for EXPIRED rumors', () => {
        // mockExpiredRumor has expiration 90, current day is 100
        const neutralNPC = createMockNPC('npc_neutral');
        const topics = getDynamicRumorTopics(mockGameState, neutralNPC);

        expect(topics.some(t => t.id === 'rumor_rumor_old_news')).toBe(false);
    });

    it('should NOT pollute the global registry', () => {
        const factionNPC = createMockNPC('npc_faction', undefined, 'faction_a');

        // Before calling, ensure rumor topic isn't in registry
        expect(getTopic('rumor_rumor_war')).toBeUndefined();

        // Call getAvailableTopics (which calls getDynamicRumorTopics)
        getAvailableTopics(mockGameState, 'npc_faction', mockSession, factionNPC);

        // After calling, registry should STILL be undefined for the rumor
        expect(getTopic('rumor_rumor_war')).toBeUndefined();
    });

    it('should verify processTopicSelection works with dynamic rumors despite not being in registry', () => {
         const result = processTopicSelection('rumor_rumor_war', mockGameState, mockSession);
         expect(result.status).toBe('neutral');
         expect(result.responsePrompt).toContain('War is coming');
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
