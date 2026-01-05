import { describe, it, expect } from 'vitest';
import { MemorySystem } from '../MemorySystem';
import { NPC } from '../../../types';
import { MemoryInteractionType, MemoryImportance, NPCMemory } from '../../../types/memory'; // Added NPCMemory for typed helper.

describe('MemorySystem', () => {
  // TODO(2026-01-03 pass 4 Codex-CLI): NPC memory remains out-of-band; cast until NPCs carry memory directly.
  const mockNPC = {
    id: 'npc-123',
    name: 'Test NPC',
    baseDescription: 'A test NPC',
    initialPersonalityPrompt: 'A friendly villager.',
    role: 'civilian',
    memory: MemorySystem.createEmptyMemory(1000)
  } as unknown as NPC;

  // Was reading npc.memory directly; helper asserts and returns a typed NPCMemory.
  const expectMemory = (npc: NPC): NPCMemory => {
    expect(npc.memory).toBeDefined();
    return npc.memory as NPCMemory;
  };

  it('should record an interaction and update attitude', () => {
    const interaction = {
      type: 'dialogue' as MemoryInteractionType,
      summary: 'Charmed by player',
      attitudeChange: -20,
      significance: MemoryImportance.Major
    };

    const updatedNPC = MemorySystem.recordInteraction(mockNPC, interaction, 1001);

    // Was accessing updatedNPC.memory directly; use helper to assert defined.
    const memory = expectMemory(updatedNPC);
    expect(memory.interactions).toHaveLength(1);
    expect(memory.interactions[0].type).toBe('dialogue');
    expect(memory.interactions[0].date).toBe(1001);
    expect(memory.attitude).toBe(-20);
  });

  it('should clamp attitude between -100 and 100', () => {
    let npc = MemorySystem.recordInteraction(mockNPC, {
      type: 'gift',
      summary: 'Big Gift',
      attitudeChange: 200, // Should cap at 100
      significance: 10
    }, 1000);

    // Was accessing npc.memory directly; use helper to assert defined.
    let memory = expectMemory(npc);
    expect(memory.attitude).toBe(100);

    npc = MemorySystem.recordInteraction(npc, {
      type: 'insult',
      summary: 'Big Insult',
      attitudeChange: -300, // Should cap at -100
      significance: 10
    }, 1001);

    memory = expectMemory(npc);
    expect(memory.attitude).toBe(-100);
  });

  it('should learn a new fact', () => {
    const fact = {
      id: 'player_is_mage',
      confidence: 0.8,
      significance: 5,
      source: 'witnessed' as const
    };

    const updatedNPC = MemorySystem.learnFact(mockNPC, fact, 1005);

    // Was accessing updatedNPC.memory directly; use helper to assert defined.
    const memory = expectMemory(updatedNPC);
    expect(memory.knownFacts).toHaveLength(1);
    expect(memory.knownFacts[0].id).toBe('player_is_mage');
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

    // Was accessing npc.memory directly; use helper to assert defined.
    const memory = expectMemory(npc);
    expect(memory.knownFacts).toHaveLength(1);
    expect(memory.knownFacts[0].confidence).toBe(0.9);
    expect(memory.knownFacts[0].source).toBe('witnessed');
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

    // Was accessing npc.memory directly; use helper to assert defined.
    const memory = expectMemory(npc);
    expect(memory.knownFacts[0].confidence).toBe(0.9);
  });
});
