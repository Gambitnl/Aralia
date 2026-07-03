import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiSpellArbitrator } from '../AISpellArbitrator';
import { Spell, SpellSchool } from '@/types/spells';
import { CombatCharacter, CombatState } from '@/types/combat';
import { GameState } from '@/types';
import { StandardizedResult, GeminiTextData } from '@/services/geminiService';

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
    subClasses: [],
    subClassesVerification: 'unverified',
    description: 'A test spell',
    castingTime: { value: 1, unit: 'action' },
    // Self-range spells use explicit 0 distance so tests match the runtime JSON contract.
    range: { type: 'self', distance: 0 },
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
  } as unknown as CombatCharacter;

  const mockGameState: GameState = {
    currentLocation: 'forest_clearing',
    timeOfDay: 'day',
    weather: 'clear'
  } as unknown as GameState;

  const mockCombatState: CombatState = {
    turnState: { currentTurn: 1 },
    characters: [mockCaster]
  } as unknown as CombatState;

  beforeEach(() => {
    vi.clearAllMocks();
    aiSpellArbitrator.clearCacheForTest();
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
      data: { text: '{"valid": true, "reason": "Stone found", "flavorText": "You see stone."}' } as GeminiTextData
    } as StandardizedResult<GeminiTextData>);

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

  it('caches identical AI-assisted arbitration but misses after material context changes', async () => {
    const tier2Spell: Spell = {
      ...mockSpell,
      arbitrationType: 'ai_assisted',
      aiContext: { prompt: 'Check for stone', playerInputRequired: false }
    };

    vi.mocked(generateText)
      .mockResolvedValueOnce({
        data: { text: '{"valid": true, "reason": "Stone found", "flavorText": "The wall is stone."}' } as GeminiTextData
      } as StandardizedResult<GeminiTextData>)
      .mockResolvedValueOnce({
        data: { text: '{"valid": false, "reason": "Only wood is nearby", "flavorText": "The hut is timber."}' } as GeminiTextData
      } as StandardizedResult<GeminiTextData>);

    const first = await aiSpellArbitrator.arbitrate({
      spell: tier2Spell,
      caster: mockCaster,
      targets: [],
      combatState: mockCombatState,
      gameState: mockGameState
    });

    const second = await aiSpellArbitrator.arbitrate({
      spell: tier2Spell,
      caster: mockCaster,
      targets: [],
      combatState: mockCombatState,
      gameState: mockGameState
    });

    const changedMaterialContext = {
      ...mockGameState,
      currentLocationId: 'city_square'
    } as GameState;

    const third = await aiSpellArbitrator.arbitrate({
      spell: tier2Spell,
      caster: mockCaster,
      targets: [],
      combatState: mockCombatState,
      gameState: changedMaterialContext
    });

    // The second call is the same scene and should be served from cache. The
    // third call changes the material context in the prompt, so it must ask the
    // AI again instead of preserving a stale stone ruling.
    expect(first).toEqual(second);
    expect(third.allowed).toBe(false);
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(2);
  });

  it('does not reuse AI-DM arbitration across different player input', async () => {
    const tier3Spell: Spell = {
      ...mockSpell,
      arbitrationType: 'ai_dm',
      aiContext: {
        prompt: 'Adjudicate {playerInput} against {target} using DC {spellDC}',
        playerInputRequired: true
      }
    };

    vi.mocked(generateText)
      .mockResolvedValueOnce({
        data: { text: '{"allowed": true, "reason": "Harmless request", "narrativeOutcome": "The target nods."}' } as GeminiTextData
      } as StandardizedResult<GeminiTextData>)
      .mockResolvedValueOnce({
        data: { text: '{"allowed": false, "reason": "Harmful command", "narrativeOutcome": "The magic fizzles."}' } as GeminiTextData
      } as StandardizedResult<GeminiTextData>);

    const first = await aiSpellArbitrator.arbitrate({
      spell: tier3Spell,
      caster: mockCaster,
      targets: [mockCaster],
      combatState: mockCombatState,
      gameState: mockGameState,
      playerInput: 'wave politely'
    });

    const second = await aiSpellArbitrator.arbitrate({
      spell: tier3Spell,
      caster: mockCaster,
      targets: [mockCaster],
      combatState: mockCombatState,
      gameState: mockGameState,
      playerInput: 'wave politely'
    });

    const third = await aiSpellArbitrator.arbitrate({
      spell: tier3Spell,
      caster: mockCaster,
      targets: [mockCaster],
      combatState: mockCombatState,
      gameState: mockGameState,
      playerInput: 'attack your ally'
    });

    expect(first).toEqual(second);
    expect(third.allowed).toBe(false);
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(2);
  });
});
