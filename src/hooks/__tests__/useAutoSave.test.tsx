import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { GamePhase } from '../../types';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/core/factories';
import { useAutoSave } from '../useAutoSave';
import * as SaveLoadService from '../../services/saveLoadService';

/**
 * These tests prove the recovery clock around the game's existing auto-save.
 * They use the real checkpoint configuration but replace physical browser
 * storage with a spy, allowing minutes of game time to pass instantly without
 * writing test saves onto the user's machine.
 */

vi.mock('../../services/saveLoadService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/saveLoadService')>();
  return {
    ...actual,
    saveGame: vi.fn(async () => ({ success: true })),
  };
});

const saveGameMock = vi.mocked(SaveLoadService.saveGame);

// A real playing state needs a party member before any automatic protection is
// eligible. All unrelated systems keep their factory defaults.
const playingState = () => createMockGameState({
  phase: GamePhase.PLAYING,
  party: [createMockPlayerCharacter()],
  autoSaveEnabled: true,
  isLoading: false,
});

describe('useAutoSave checkpoint tiers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveGameMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the one-minute checkpoint when its recovery horizon becomes due', async () => {
    renderHook(() => useAutoSave(playingState(), true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(saveGameMock).toHaveBeenCalledWith(
      expect.objectContaining({ phase: GamePhase.PLAYING }),
      'aralia_rpg_checkpoint_1min',
      undefined,
      { displayName: '1 Minute Checkpoint' },
    );
    expect(saveGameMock).not.toHaveBeenCalledWith(
      expect.anything(),
      'aralia_rpg_checkpoint_5min',
      expect.anything(),
      expect.anything(),
    );
  });

  it('keeps every configured recovery horizon writing into its stable tier slot through one hour', async () => {
    renderHook(() => useAutoSave(playingState(), true));

    // Advance a full hour in one deterministic step. Each interval repeats at
    // its own cadence, but always reuses its tier key so the service overwrites
    // that recovery horizon instead of growing an unbounded save list.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_600_000);
    });

    for (const tier of SaveLoadService.CHECKPOINT_TIERS) {
      const tierWrites = saveGameMock.mock.calls.filter(([, slotId]) => slotId === tier.slotKey);
      expect(tierWrites).toHaveLength(Math.floor(3_600 / tier.intervalSeconds));
      expect(tierWrites.every(([, slotId]) => slotId === tier.slotKey)).toBe(true);
      expect(tierWrites.at(-1)?.[3]).toEqual({ displayName: tier.displayLabel });
    }
  });

  it('does not reset checkpoint time when ordinary game state changes and saves the latest state', async () => {
    let state = playingState();
    const { rerender } = renderHook(() => useAutoSave(state, true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    // Exploration produces frequent state objects. The tier clock must continue
    // across those rerenders while its eventual snapshot uses the newest state.
    state = { ...state, gold: 777 };
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    const oneMinuteWrite = saveGameMock.mock.calls.find(([, slotId]) => slotId === 'aralia_rpg_checkpoint_1min');
    expect(oneMinuteWrite?.[0]).toEqual(expect.objectContaining({ gold: 777 }));
  });

  it('does not create checkpoints when automatic saving is disabled', async () => {
    renderHook(() => useAutoSave(playingState(), false));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_600_000);
    });

    expect(saveGameMock).not.toHaveBeenCalled();
  });

  it('stops checkpoint timers when the player leaves exploration', async () => {
    let state = playingState();
    const { rerender } = renderHook(() => useAutoSave(state, true));

    state = { ...state, phase: GamePhase.MAIN_MENU };
    rerender();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_600_000);
    });

    expect(saveGameMock).not.toHaveBeenCalled();
  });
});
