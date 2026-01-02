
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { handleMovement } from '../handleMovement';
import { generateTravelEvent } from '../../../services/travelEventService';
import { TravelEvent } from '../../../types/exploration';
import { GameState, PlayerCharacter } from '../../../types';
// TODO(lint-intent): 'DIRECTION_VECTORS' is unused in this test; use it in the assertion path or remove it.
import { DIRECTION_VECTORS as _DIRECTION_VECTORS } from '../../../config/mapConfig';
// TODO(lint-intent): 'LOCATIONS' is unused in this test; use it in the assertion path or remove it.
import { LOCATIONS as _LOCATIONS } from '../../../constants';

// Mock dependencies
vi.mock('../../../services/travelEventService');
vi.mock('../../../services/geminiService', () => ({
  generateWildernessLocationDescription: vi.fn().mockResolvedValue({
    data: { text: 'You see a test wilderness.', promptSent: 'prompt' },
  }),
  generateLocationDescription: vi.fn(),
}));
vi.mock('../../../utils/submapUtils', () => ({
  getSubmapTileInfo: vi.fn().mockReturnValue({ effectiveTerrainType: 'path', isImpassable: false })
}));

// Mock Data
const mockDispatch = vi.fn();
const mockAddMessage = vi.fn();
const mockAddGeminiLog = vi.fn();
const mockLogDiscovery = vi.fn();
const mockGetTileTooltipText = vi.fn();

const mockPlayer: PlayerCharacter = {
  name: 'TestHero',
  proficiencyBonus: 2,
  abilityScores: { strength: 14, dexterity: 12, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
  finalAbilityScores: { strength: 14, dexterity: 12, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
  skills: [{ id: 'athletics', name: 'Athletics', bonus: 4 }], // Proficient in Athletics
  transportMode: 'foot'
} as unknown as PlayerCharacter;

// Use a simplified map setup to ensure valid movement
const mockGameState: GameState = {
  currentLocationId: 'coord_10_10',
  subMapCoordinates: { x: 5, y: 5 },
  gameTime: new Date(),
  mapData: {
    gridSize: { rows: 20, cols: 20 },
    tiles: Array(20).fill(null).map((_, y) => Array(20).fill(null).map((_, x) => ({
      biomeId: 'forest',
      coordinates: { x, y },
      discovered: true,
      isPlayerCurrent: x === 10 && y === 10,
      locationId: `coord_${x}_${y}`
    })))
  },
  companions: {},
  worldSeed: 12345,
  questLog: [],
  activeRumors: [],
  factions: {},
  currentLocationActiveDynamicNpcIds: []
} as unknown as GameState;

describe('handleMovement - Skill Check Events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should auto-resolve a successful skill check event', async () => {
    // Mock Math.random to return 0.5 (Roll 11)
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const skillEvent: TravelEvent = {
      id: 'test_obstacle',
      description: 'An obstacle blocks the path.',
      skillCheck: {
        check: { skill: 'athletics', dc: 10 }, // 11 + 4 = 15 > 10 => Success
        successEffect: { type: 'delay', amount: 0, description: 'Success Effect' },
        successDescription: 'You overcome it.',
        failureDescription: 'You fail.',
      },
      effect: { type: 'delay', amount: 1, description: 'Default Delay' }
    };
    (generateTravelEvent as Mock).mockReturnValue(skillEvent);

    await handleMovement({
      action: { type: 'move', targetId: 'North', label: 'Move North' }, // Use 'North' (capitalized) to match DIRECTION_VECTORS keys
      gameState: mockGameState,
      dispatch: mockDispatch as any,
      addMessage: mockAddMessage as any,
      addGeminiLog: mockAddGeminiLog as any,
      logDiscovery: mockLogDiscovery as any,
      getTileTooltipText: mockGetTileTooltipText as any,
      playerContext: '',
      playerCharacter: mockPlayer
    });

    // Expect success description
    expect(mockAddMessage).toHaveBeenCalledWith(expect.stringContaining('You overcome it'), 'system');
  });

  it('should auto-resolve a failed skill check event', async () => {
    // Mock Math.random to return 0.0 (Roll 1) -> 1 + 4 = 5 < DC 20
    vi.spyOn(Math, 'random').mockReturnValue(0.0);

    const skillEvent: TravelEvent = {
      id: 'test_obstacle_hard',
      description: 'A hard obstacle.',
      skillCheck: {
        check: { skill: 'athletics', dc: 20 },
        successEffect: { type: 'delay', amount: 0, description: 'Success' },
        successDescription: 'Success.',
        failureEffect: { type: 'delay', amount: 2, description: 'Fail Delay' },
        failureDescription: 'You fail hard.',
      },
      effect: { type: 'delay', amount: 1 } // Fallback
    };
    (generateTravelEvent as Mock).mockReturnValue(skillEvent);

    await handleMovement({
      action: { type: 'move', targetId: 'North', label: 'Move North' }, // Use 'North'
      gameState: mockGameState,
      dispatch: mockDispatch as any,
      addMessage: mockAddMessage as any,
      addGeminiLog: mockAddGeminiLog as any,
      logDiscovery: mockLogDiscovery as any,
      getTileTooltipText: mockGetTileTooltipText as any,
      playerContext: '',
      playerCharacter: mockPlayer
    });

    // Expect failure description
    expect(mockAddMessage).toHaveBeenCalledWith(expect.stringContaining('You fail hard'), 'system');
  });
});
