import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiSpellArbitrator, ArbitrationRequest } from '../AISpellArbitrator';
import { Spell, SpellSchool } from '@/types/spells';
import { CombatCharacter, CombatState } from '@/types/combat';
import { GameState } from '@/types';

// Mock geminiService
vi.mock('@/services/geminiService', () => ({
  generateText: vi.fn()
}));

import { generateText } from '@/services/geminiService';

describe('AISpellArbitrator', () => {
  const mockSpell: Spell = {
    id: 'test-spell',
    name: 'Test Spell',
    level: 1,
    school: SpellSchool.Evocation,
    classes: ['Wizard'],
    description: 'A test spell',
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'self' },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'instantaneous', concentration: false },
    targeting: { type: 'self', validTargets: ['self'] },
    effects: [],
    arbitrationType: 'mechanical'
  };

  const mockCaster: CombatCharacter = {
    id: 'caster-1',
    name: 'Merlin',
    position: { x: 10, y: 10 },
    stats: { currentHP: 10, maxHP: 10 },
    team: 'player'
  } as any;

  const mockGameState: GameState = {
    currentLocation: 'forest_clearing',
    timeOfDay: 'day',
    weather: 'clear'
  } as any;

  const mockCombatState: CombatState = {
    turnState: { currentTurn: 1 },
    characters: [mockCaster]
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow mechanical spells immediately', async () => {
    const result = await aiSpellArbitrator.arbitrate({
      spell: mockSpell,
      caster: mockCaster,
      targets: [],
      combatState: mockCombatState,
      gameState: mockGameState
    });

    expect(result.allowed).toBe(true);
    expect(vi.mocked(generateText)).not.toHaveBeenCalled();
  });

  it('should validate tier 2 spells', async () => {
    const tier2Spell: Spell = {
      ...mockSpell,
      arbitrationType: 'ai_assisted',
      aiContext: { prompt: 'Check for stone', playerInputRequired: false }
    };

    vi.mocked(generateText).mockResolvedValue({
      data: { text: '{"valid": true, "reason": "Stone found", "flavorText": "You see stone."}' }
    } as any);

    const result = await aiSpellArbitrator.arbitrate({
      spell: tier2Spell,
      caster: mockCaster,
      targets: [],
      combatState: mockCombatState,
      gameState: mockGameState
    });

    expect(result.allowed).toBe(true);
    expect(result.narrativeOutcome).toBe('You see stone.');
    expect(vi.mocked(generateText)).toHaveBeenCalled();
  });

  it('should reject tier 3 spells without input', async () => {
    const tier3Spell: Spell = {
      ...mockSpell,
      arbitrationType: 'ai_dm',
      aiContext: { prompt: 'DM check', playerInputRequired: true }
    };

    const result = await aiSpellArbitrator.arbitrate({
      spell: tier3Spell,
      caster: mockCaster,
      targets: [],
      combatState: mockCombatState,
      gameState: mockGameState,
      playerInput: undefined // Missing input
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Player input required');
  });
});
