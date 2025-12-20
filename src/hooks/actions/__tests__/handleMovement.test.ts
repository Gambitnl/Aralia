import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMovement } from '../handleMovement';
import * as GeminiService from '../../../services/geminiService';
import { GameState, Action, PlayerCharacter } from '../../../types';
import * as SeasonalSystem from '../../../systems/time/SeasonalSystem';
import { Season } from '../../../utils/timeUtils';

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
  let mockDispatch: any;
  let mockAddMessage: any;
  let mockAddGeminiLog: any;
  let mockLogDiscovery: any;
  let mockGetTileTooltipText: any;
  let mockGameState: any;
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
    } as any;

    mockGameState = {
      currentLocationId: 'coord_10_10',
      subMapCoordinates: { x: 5, y: 5 },
      gameTime: new Date(Date.UTC(351, 3, 15, 12, 0)),
      worldSeed: 'test-seed',
      mapData: {
        gridSize: { rows: 20, cols: 20 },
        tiles: Array(20).fill(null).map(() => Array(20).fill({ biomeId: 'forest', discovered: true })),
      },
      questLog: [],
      devModelOverride: false
    };

    mockAction = {
      id: 'move_North',
      type: 'MOVE_PLAYER',
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
      dispatch: mockDispatch,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      logDiscovery: mockLogDiscovery,
      getTileTooltipText: mockGetTileTooltipText,
      playerContext: 'context',
      playerCharacter: mockPlayerCharacter,
    });

    const timeCall = mockDispatch.mock.calls.find((c: any) => c[0].type === 'ADVANCE_TIME');
    expect(timeCall).toBeDefined();
    expect(timeCall[0].payload.seconds).toBe(1800);
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
      dispatch: mockDispatch,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      logDiscovery: mockLogDiscovery,
      getTileTooltipText: mockGetTileTooltipText,
      playerContext: 'context',
      playerCharacter: mockPlayerCharacter,
    });

    const timeCall = mockDispatch.mock.calls.find((c: any) => c[0].type === 'ADVANCE_TIME');
    expect(timeCall).toBeDefined();
    expect(timeCall[0].payload.seconds).toBe(2700);
  });
});
