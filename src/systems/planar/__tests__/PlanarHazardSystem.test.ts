
import { describe, it, expect, vi, beforeEach } from 'vitest';
// TODO(lint-intent): 'HazardOutcome' is unused in this test; use it in the assertion path or remove it.
import { PlanarHazardSystem, HazardOutcome as _HazardOutcome } from '../PlanarHazardSystem';
import { CombatCharacter, GameState, Location, PlayerCharacter } from '../../../types';
import { Plane } from '../../../types/planes';
import { getCurrentPlane } from '../../../utils/planarUtils';
// TODO(lint-intent): 'createPlayerCombatCharacter' is unused in this test; use it in the assertion path or remove it.
import { createPlayerCombatCharacter as _createPlayerCombatCharacter } from '../../../utils/combatUtils';
import { rollSavingThrow } from '../../../utils/savingThrowUtils';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/factories';

// Mock dependencies
vi.mock('../../../utils/planarUtils', () => ({
  getCurrentPlane: vi.fn()
}));

vi.mock('../../../utils/combatUtils', async (importOriginal) => {
    const actual = await importOriginal() as typeof import('../../../utils/combatUtils');
    return {
        ...actual,
        rollDice: vi.fn().mockReturnValue(3), // Fixed roll for predictability
        // TODO(2026-01-03 pass 4 Codex-CLI): Mocked combat character is partial; tighten once hazards require more fields.
        createPlayerCombatCharacter: vi.fn().mockReturnValue({
            id: 'p1',
            stats: { wisdom: 10, constitution: 10 }
        } as unknown as CombatCharacter)
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
    baseDescription: 'Test',
    planeId: 'abyss',
    mapCoordinates: { x: 0, y: 0 },
    exits: {},
    biomeId: 'test_biome'
  };

  const mockCharacter: PlayerCharacter = createMockPlayerCharacter({ id: 'char1', name: 'Hero', hp: 20, maxHp: 20 });
  const basePlane: Plane = {
    id: 'material',
    name: 'Material Plane',
    description: 'Default plane',
    traits: [],
    natives: [],
    hazards: [],
    emotionalValence: 'neutral',
    timeFlow: 'normal',
    atmosphereDescription: 'Calm and familiar.',
    effects: {}
  };
  const makeSaveResult = (success: boolean, total: number) => ({
    success,
    total,
    roll: total,
    dc: 15,
    natural20: false,
    natural1: false
  });

  beforeEach(() => {
    mockGameState = createMockGameState({
      currentLocationId: mockLocation.id,
      dynamicLocations: { [mockLocation.id]: mockLocation },
      party: [mockCharacter],
      notifications: []
    });

    vi.clearAllMocks();
  });

  it('should return empty outcome if plane has no hazards', () => {
    vi.mocked(getCurrentPlane).mockReturnValue({
      ...basePlane,
      id: 'material',
      name: 'Material Plane'
    });

    const result = PlanarHazardSystem.processPeriodicHazards(mockGameState, 10);
    expect(result.events).toHaveLength(0);
    expect(result.globalMessages).toHaveLength(0);
  });

  it('should apply psychic damage from plane effects', () => {
    vi.mocked(getCurrentPlane).mockReturnValue({
      ...basePlane,
      id: 'abyss',
      name: 'The Abyss',
      effects: { psychicDamagePerMinute: 2 }
    });

    const result = PlanarHazardSystem.processPeriodicHazards(mockGameState, 5); // 5 minutes

    expect(result.globalMessages[0]).toContain('The intense pressure of The Abyss assaults your mind');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].damage).toBe(10); // 2 * 5
    expect(result.events[0].damageType).toBe('psychic');
    expect(result.events[0].characterId).toBe('char1');
  });

  it('should process hazards with saves', () => {
    vi.mocked(getCurrentPlane).mockReturnValue({
      ...basePlane,
      id: 'abyss',
      name: 'The Abyss',
      hazards: [{
        name: 'Mind Warp',
        description: 'Warps the mind',
        saveDC: 15,
        damage: '1d6 psychic'
      }],
      effects: {}
    });

    // Mock failed save
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    vi.mocked(rollSavingThrow).mockReturnValue(makeSaveResult(false, 10));

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
      ...basePlane,
      id: 'abyss',
      name: 'The Abyss',
      hazards: [{
        name: 'Mind Warp',
        description: 'Warps the mind',
        saveDC: 15,
        damage: '1d6 psychic'
      }],
      effects: {}
    });

    // Mock successful save
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    vi.mocked(rollSavingThrow).mockReturnValue(makeSaveResult(true, 20));

    const result = PlanarHazardSystem.processPeriodicHazards(mockGameState, 1);

    expect(result.events).toHaveLength(0);
  });
});
