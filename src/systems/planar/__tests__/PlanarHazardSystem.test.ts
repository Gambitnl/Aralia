
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanarHazardSystem, HazardOutcome } from '../PlanarHazardSystem';
import { GameState, PlayerCharacter, Location } from '../../../types';
import { getCurrentPlane } from '../../../utils/planarUtils';
import { createPlayerCombatCharacter } from '../../../utils/combatUtils';
import { rollSavingThrow } from '../../../utils/savingThrowUtils';

// Mock dependencies
vi.mock('../../../utils/planarUtils', () => ({
  getCurrentPlane: vi.fn()
}));

vi.mock('../../../utils/combatUtils', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        rollDice: vi.fn().mockReturnValue(3), // Fixed roll for predictability
        createPlayerCombatCharacter: vi.fn().mockReturnValue({
            id: 'p1',
            stats: { wisdom: 10, constitution: 10 }
        })
    };
});

vi.mock('../../../utils/savingThrowUtils', () => ({
  rollSavingThrow: vi.fn()
}));

describe('PlanarHazardSystem', () => {
  let mockGameState: GameState;
  const mockLocation: Location = {
    id: 'loc1',
    name: 'Test Loc',
    description: 'Test',
    type: 'wilderness',
    planeId: 'abyss',
    coordinates: { x: 0, y: 0 },
    exits: {}
  };

  const mockCharacter: PlayerCharacter = {
    id: 'char1',
    name: 'Hero',
    hp: 20,
    maxHp: 20,
    race: { id: 'human', name: 'Human' } as any,
    class: { id: 'fighter', name: 'Fighter' } as any,
    level: 1,
    finalAbilityScores: {
      Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10
    }
  } as any;

  beforeEach(() => {
    mockGameState = {
      currentLocation: mockLocation,
      party: [mockCharacter],
      gameTime: { day: 1, timeOfDay: 'Day' },
      inventory: [],
      quests: [],
      notifications: []
    } as any;

    vi.clearAllMocks();
  });

  it('should return empty outcome if plane has no hazards', () => {
    vi.mocked(getCurrentPlane).mockReturnValue({
      id: 'material',
      name: 'Material Plane',
      hazards: [],
      traits: [],
      effects: {},
    } as any);

    const result = PlanarHazardSystem.processPeriodicHazards(mockGameState, 10);
    expect(result.events).toHaveLength(0);
    expect(result.globalMessages).toHaveLength(0);
  });

  it('should apply psychic damage from plane effects', () => {
    vi.mocked(getCurrentPlane).mockReturnValue({
      id: 'abyss',
      name: 'The Abyss',
      hazards: [],
      traits: [],
      effects: { psychicDamagePerMinute: 2 },
    } as any);

    const result = PlanarHazardSystem.processPeriodicHazards(mockGameState, 5); // 5 minutes

    expect(result.globalMessages[0]).toContain('The intense pressure of The Abyss assaults your mind');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].damage).toBe(10); // 2 * 5
    expect(result.events[0].damageType).toBe('psychic');
    expect(result.events[0].characterId).toBe('char1');
  });

  it('should process hazards with saves', () => {
    vi.mocked(getCurrentPlane).mockReturnValue({
      id: 'abyss',
      name: 'The Abyss',
      hazards: [{
        name: 'Mind Warp',
        description: 'Warps the mind',
        saveDC: 15,
        damage: '1d6 psychic'
      }],
      traits: [],
      effects: {},
    } as any);

    // Mock failed save
    vi.mocked(rollSavingThrow).mockReturnValue({ success: false, total: 10 } as any);

    const result = PlanarHazardSystem.processPeriodicHazards(mockGameState, 1);

    expect(rollSavingThrow).toHaveBeenCalledWith(expect.anything(), 'Wisdom', 15);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].hazardName).toBe('Mind Warp');
    // We mocked rollDice to return 3
    expect(result.events[0].damage).toBe(3);
    expect(result.events[0].damageType).toBe('psychic');
  });

  it('should not apply hazard effects on successful save', () => {
    vi.mocked(getCurrentPlane).mockReturnValue({
      id: 'abyss',
      name: 'The Abyss',
      hazards: [{
        name: 'Mind Warp',
        description: 'Warps the mind',
        saveDC: 15,
        damage: '1d6 psychic'
      }],
      traits: [],
      effects: {},
    } as any);

    // Mock successful save
    vi.mocked(rollSavingThrow).mockReturnValue({ success: true, total: 20 } as any);

    const result = PlanarHazardSystem.processPeriodicHazards(mockGameState, 1);

    expect(result.events).toHaveLength(0);
  });
});
