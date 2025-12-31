import { describe, it, expect } from 'vitest';
import { MemorySystem } from '../MemorySystem';
import { NPC, CreatureSize, Alignment } from '../../../types/creatures';
import { MemoryInteractionType, MemoryImportance } from '../../../types/memory';

describe('MemorySystem', () => {
  const mockNPC: NPC = {
    id: 'npc-123',
    name: 'Test NPC',
    type: 'Humanoid',
    size: 'Medium' as CreatureSize,
    alignment: 'N' as Alignment,
    challengeRating: 0,
    xpValue: 0,
    description: 'A test NPC',
    languages: [],
    senses: [],
    role: 'Villager',
    isQuestGiver: false,
    isEssential: false,
    memory: MemorySystem.createEmptyMemory(1000),
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    stats: {} as unknown, // Minimal mock
    currentHp: 10,
    maxHp: 10,
    armorClass: 10,
    speed: 30,
    initiativeBonus: 0,
    proficiencyBonus: 2,
    passivePerception: 10,
    conditions: [],
    inventory: [],
    equipped: {}
  };

  it('should record an interaction and update attitude', () => {
    const interaction = {
      type: 'magical_manipulation' as MemoryInteractionType,
      summary: 'Charmed by player',
      attitudeChange: -20,
      significance: MemoryImportance.Major
    };

    const updatedNPC = MemorySystem.recordInteraction(mockNPC, interaction, 1001);

    expect(updatedNPC.memory.interactions).toHaveLength(1);
    expect(updatedNPC.memory.interactions[0].type).toBe('magical_manipulation');
    expect(updatedNPC.memory.interactions[0].date).toBe(1001);
    expect(updatedNPC.memory.attitude).toBe(-20);
  });

  it('should clamp attitude between -100 and 100', () => {
    let npc = MemorySystem.recordInteraction(mockNPC, {
      type: 'gift',
      summary: 'Big Gift',
      attitudeChange: 200, // Should cap at 100
      significance: 10
    }, 1000);

    expect(npc.memory.attitude).toBe(100);

    npc = MemorySystem.recordInteraction(npc, {
      type: 'insult',
      summary: 'Big Insult',
      attitudeChange: -300, // Should cap at -100
      significance: 10
    }, 1001);

    expect(npc.memory.attitude).toBe(-100);
  });

  it('should learn a new fact', () => {
    const fact = {
      id: 'player_is_mage',
      confidence: 0.8,
      significance: 5,
      source: 'witnessed' as const
    };

    const updatedNPC = MemorySystem.learnFact(mockNPC, fact, 1005);

    expect(updatedNPC.memory.knownFacts).toHaveLength(1);
    expect(updatedNPC.memory.knownFacts[0].id).toBe('player_is_mage');
  });

  it('should update an existing fact if confidence is higher', () => {
    let npc = MemorySystem.learnFact(mockNPC, {
      id: 'player_is_mage',
      confidence: 0.5,
      significance: 5,
      source: 'gossip'
    }, 1000);

    npc = MemorySystem.learnFact(npc, {
      id: 'player_is_mage',
      confidence: 0.9,
      significance: 5,
      source: 'witnessed'
    }, 1001);

    expect(npc.memory.knownFacts).toHaveLength(1);
    expect(npc.memory.knownFacts[0].confidence).toBe(0.9);
    expect(npc.memory.knownFacts[0].source).toBe('witnessed');
  });

  it('should not update fact if confidence is lower', () => {
    let npc = MemorySystem.learnFact(mockNPC, {
      id: 'player_is_mage',
      confidence: 0.9,
      significance: 5,
      source: 'witnessed'
    }, 1000);

    npc = MemorySystem.learnFact(npc, {
      id: 'player_is_mage',
      confidence: 0.2,
      significance: 5,
      source: 'gossip'
    }, 1001);

    expect(npc.memory.knownFacts[0].confidence).toBe(0.9);
  });
});
