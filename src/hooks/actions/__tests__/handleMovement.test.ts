import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMovement } from '../handleMovement';
import * as GeminiService from '../../../services/geminiService';
import { GameState, Action, PlayerCharacter } from '../../../types';
import * as SeasonalSystem from '../../../systems/time/SeasonalSystem';
import { Season } from '../../../utils/timeUtils';
import { initialGameState } from '../../../state/appState';

// Mocks
vi.mock('../../../services/geminiService');
vi.mock('../../../systems/time/SeasonalSystem');

// Mock submapUtils
vi.mock('../../../utils/submapUtils', () => ({
  getSubmapTileInfo: vi.fn(() => ({
    effectiveTerrainType: 'wilderness', // implies 30 min (1800s) travel
    isImpassable: false,
  })),
}));

// Mock timeUtils
vi.mock('../../../utils/timeUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/timeUtils')>();
  return {
    ...actual,
    getTimeModifiers: vi.fn(() => ({
      travelCostMultiplier: 1.0,
      visionModifier: 1.0,
      description: 'Day',
    })),
  };
});

describe('handleMovement - Seasonal Effects', () => {
  let mockDispatch: ReturnType<typeof vi.fn>;
  let mockAddMessage: ReturnType<typeof vi.fn>;
  let mockAddGeminiLog: ReturnType<typeof vi.fn>;
  let mockLogDiscovery: ReturnType<typeof vi.fn>;
  let mockGetTileTooltipText: ReturnType<typeof vi.fn>;
  let mockGameState: GameState;
  let mockAction: Action;
  let mockPlayerCharacter: PlayerCharacter;

  beforeEach(() => {
    mockDispatch = vi.fn();
    mockAddMessage = vi.fn();
    mockAddGeminiLog = vi.fn();
    mockLogDiscovery = vi.fn();
    mockGetTileTooltipText = vi.fn();

    mockPlayerCharacter = {
      id: 'player1',
      name: 'Hero',
      transportMode: 'foot',
    } as PlayerCharacter;

    mockGameState = {
      ...initialGameState,
      currentLocationId: 'coord_10_10',
      subMapCoordinates: { x: 5, y: 5 },
      gameTime: new Date(Date.UTC(351, 3, 15, 12, 0)),
      worldSeed: 12345 as any,
      mapData: {
        gridSize: { rows: 20, cols: 20 },
        tiles: Array(20).fill(null).map(() => Array(20).fill({ biomeId: 'forest', discovered: true })),
      },
      questLog: [],
      devModelOverride: null
    };

    mockAction = {
      type: 'move',
      label: 'North',
      targetId: 'North',
    };

    // Fix: Mock Gemini Service response to return expected structure
    vi.mocked(GeminiService.generateWildernessLocationDescription).mockResolvedValue({
      data: {
        text: 'A forest.',
        promptSent: 'prompt',
        rawResponse: 'response'
      }
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    } as any);

    vi.mocked(SeasonalSystem.getSeasonalEffects).mockReturnValue({
      season: Season.Spring,
      travelCostMultiplier: 1.0,
      resourceScarcity: 1.0,
      resourceYield: 1.0,
      survivalDCModifier: 0,
      description: 'Spring breeze.',
      elements: []
    });
  });

  it('applies standard travel time in Spring', async () => {
    await handleMovement({
      action: mockAction,
      gameState: mockGameState,
      dispatch: mockDispatch as unknown as React.Dispatch<any>,
      addMessage: mockAddMessage as any,
      addGeminiLog: mockAddGeminiLog as any,
      logDiscovery: mockLogDiscovery as any,
      getTileTooltipText: mockGetTileTooltipText as any,
      playerContext: 'context',
      playerCharacter: mockPlayerCharacter,
    });
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    const timeCall = (mockDispatch as unknown as { mock: { calls: any[] } }).mock.calls.find((c: any[]) => c[0].type === 'ADVANCE_TIME');
    expect(timeCall).toBeDefined();
    expect(timeCall?.[0].payload.seconds).toBe(1800);
  });

  it('increases travel time in Winter', async () => {
    vi.mocked(SeasonalSystem.getSeasonalEffects).mockReturnValue({
      season: Season.Winter,
      travelCostMultiplier: 1.5,
      resourceScarcity: 1.5,
      resourceYield: 0.5,
      survivalDCModifier: 2,
      description: 'Freezing cold.',
      elements: ['cold']
    });

    await handleMovement({
      action: mockAction,
      gameState: mockGameState,
      dispatch: mockDispatch as unknown as React.Dispatch<any>,
      addMessage: mockAddMessage as any,
      addGeminiLog: mockAddGeminiLog as any,
      logDiscovery: mockLogDiscovery as any,
      getTileTooltipText: mockGetTileTooltipText as any,
      playerContext: 'context',
      playerCharacter: mockPlayerCharacter,
    });
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    const timeCall = (mockDispatch as unknown as { mock: { calls: any[] } }).mock.calls.find((c: any[]) => c[0].type === 'ADVANCE_TIME');
    expect(timeCall).toBeDefined();
    expect(timeCall?.[0].payload.seconds).toBe(2700);
  });
});
