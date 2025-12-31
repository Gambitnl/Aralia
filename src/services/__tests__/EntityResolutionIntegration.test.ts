
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { handleGeminiCustom } from '../../hooks/actions/handleGeminiCustom';
import * as GeminiService from '../geminiService';
import { EntityResolverService } from '../EntityResolverService';
import { GameState } from '../../types';

// Mock dependencies
vi.mock('../geminiService');
vi.mock('../EntityResolverService');

describe('Linker Gap Verification: Entity Resolution Integration', () => {
  const mockDispatch = vi.fn();
  const mockAddMessage = vi.fn();
  const mockAddGeminiLog = vi.fn();
  const mockGetCurrentLocation = vi.fn().mockReturnValue({ id: 'loc_1', npcIds: [] });
  const mockGetCurrentNPCs = vi.fn().mockReturnValue([]);

  const mockGameState = {
    party: [{ finalAbilityScores: {}, skills: [] }],
    npcMemory: {},
    gameTime: new Date(),
    devModelOverride: null,
  } as unknown as GameState;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock behaviors
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    (EntityResolverService.resolveEntitiesInText as unknown).mockReturnValue([]);
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    (EntityResolverService.ensureEntityExists as unknown).mockResolvedValue({ created: false, entity: null });
  });

  it('verifies that handleGeminiCustom NOW resolves entities from AI text', async () => {
    // 1. Mock AI output mentioning a new location
    const aiText = "You travel to the city of Silverdale.";
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    (GeminiService.generateActionOutcome as unknown).mockResolvedValue({
      data: { text: aiText },
      error: null
    });

    // 2. Mock Entity Resolver to find it
    const mockReference = { type: 'location', normalizedName: 'Silverdale', exists: false };
    const mockCreationResult = { entity: { id: 'silverdale', name: 'Silverdale' }, created: true, type: 'location' };
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    (EntityResolverService.resolveEntitiesInText as unknown).mockReturnValue([mockReference]);
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    (EntityResolverService.ensureEntityExists as unknown).mockResolvedValue(mockCreationResult);

    // 3. Execute the action
    await handleGeminiCustom({
      action: { type: 'gemini_custom_action', label: 'Go to Silverdale', payload: { geminiPrompt: 'I go to Silverdale' } },
      gameState: mockGameState,
      dispatch: mockDispatch,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      generalActionContext: '',
      getCurrentLocation: mockGetCurrentLocation,
      getCurrentNPCs: mockGetCurrentNPCs,
    });

    // 4. Assertions (proving the gap is closed)
    expect(EntityResolverService.resolveEntitiesInText).toHaveBeenCalledWith(aiText, mockGameState);
    expect(EntityResolverService.ensureEntityExists).toHaveBeenCalledWith('location', 'Silverdale', mockGameState);

    // Check that registration action was dispatched
    const registerActions = mockDispatch.mock.calls.filter(call => call[0].type === 'REGISTER_DYNAMIC_ENTITY');
    expect(registerActions.length).toBeGreaterThan(0);
    expect(registerActions[0][0].payload.entityType).toBe('location');
    expect(registerActions[0][0].payload.entity.id).toBe('silverdale');
  });
});
