import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dispatch } from 'react';
import { handleObserveSettlement } from '../handleMovement';
import type { Action, GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';
import * as OllamaTextService from '../../../services/ollamaTextService';

/**
 * "Scout Village/Town" (OBSERVE_VILLAGE / OBSERVE_TOWN) used to be a stub that
 * printed a canned line and logged "AI description pending implementation".
 * These tests lock in the real behavior: it generates an observation via the
 * model, surfaces it to the player, and costs in-game time.
 */

vi.mock('../../../services/ollamaTextService', () => ({
  generateActionOutcome: vi.fn(),
}));

vi.mock('../../../utils/entityIntegrationUtils', () => ({
  resolveAndRegisterEntities: vi.fn(async () => undefined),
}));

const mockGameState = {
  currentLocationId: 'coord_15_10',
  gameTime: new Date(Date.UTC(2026, 5, 28, 7, 0, 0)),
} as unknown as GameState;

describe('handleObserveSettlement (Scout)', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let addMessage: ReturnType<typeof vi.fn>;
  let addGeminiLog: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatch = vi.fn();
    addMessage = vi.fn();
    addGeminiLog = vi.fn();
  });

  it('surfaces a model-generated observation and advances time', async () => {
    (OllamaTextService.generateActionOutcome as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { text: 'Two guards lean on the north gate; the market square is half-empty.', promptSent: 'p', rawResponse: 'r' },
    });

    const action = { type: 'OBSERVE_TOWN', label: 'Scout Town' } as Action;

    await handleObserveSettlement({
      gameState: mockGameState,
      dispatch: dispatch as unknown as Dispatch<AppAction>,
      addMessage,
      addGeminiLog,
      action,
      generalActionContext: 'Outside the town of Fokong, dawn.',
    });

    expect(OllamaTextService.generateActionOutcome).toHaveBeenCalledTimes(1);
    expect(addMessage.mock.calls.some(([m]) => /two guards lean on the north gate/i.test(m))).toBe(true);
    expect(addGeminiLog.mock.calls.some(([, , out]) => /pending implementation/i.test(out || ''))).toBe(false);
    expect(dispatch.mock.calls.some(([a]) => a.type === 'ADVANCE_TIME')).toBe(true);
  });

  it('reports honestly when the model returns nothing, and still advances time', async () => {
    (OllamaTextService.generateActionOutcome as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: 'No Ollama model available',
    });

    const action = { type: 'OBSERVE_VILLAGE', label: 'Scout Village' } as Action;

    await handleObserveSettlement({
      gameState: mockGameState,
      dispatch: dispatch as unknown as Dispatch<AppAction>,
      addMessage,
      addGeminiLog,
      action,
      generalActionContext: 'Outside a village.',
    });

    // No fabricated reconnaissance — the player is told nothing new was learned.
    expect(addMessage.mock.calls.some(([m]) => /nothing new|reveals nothing/i.test(m))).toBe(true);
    expect(dispatch.mock.calls.some(([a]) => a.type === 'ADVANCE_TIME')).toBe(true);
  });
});
