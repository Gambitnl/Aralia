/** Lifecycle checks protect saved preferences and the boundaries between exploration, combat and loading timers. Browser storage and background catalogs are disposable spies. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { GamePhase } from '../../../types';
import { createMockGameState } from '../../../utils/core/factories';
import { useAppPreferences } from '../useAppPreferences';
import { useAppPhaseClock } from '../useAppPhaseClock';
import { useAppLoadingWatchdog } from '../useAppLoadingWatchdog';

const spies = vi.hoisted(() => ({
  read: vi.fn(), write: vi.fn(), initialize: vi.fn(), autosave: vi.fn(),
  monsters: vi.fn(async () => undefined),
}));
vi.mock('../../../services/saveLoadService', () => ({ initializeStorage: spies.initialize }));
vi.mock('../../../utils/core/storageUtils', () => ({ SafeStorage: { getItem: spies.read, trySetItem: spies.write } }));
vi.mock('../../useAutoSave', () => ({ useAutoSave: spies.autosave }));
vi.mock('../../../data/monsters', () => ({ loadMonstersData: spies.monsters }));
vi.mock('../../../data/items', () => ({ ITEMS: { fixture: { id: 'fixture' } } }));

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); spies.read.mockReturnValue(null); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('App preference lifecycle', () => {
  it('hydrates disabled autosave and difficulty before preference persistence', () => {
    spies.read.mockImplementation((key: string) => key.includes('auto_save') ? 'off' : 'hard');
    const dispatch = vi.fn();
    const state = createMockGameState({ phase: GamePhase.MAIN_MENU });
    renderHook(() => useAppPreferences(state, dispatch));
    expect(spies.initialize).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls).toEqual([
      [{ type: 'SET_AUTO_SAVE_ENABLED', payload: false }],
      [{ type: 'SET_COMBAT_DIFFICULTY', payload: 'hard' }],
    ]);
    expect(spies.autosave.mock.calls[0][1]).toBe(false);
    expect(spies.write.mock.invocationCallOrder[0]).toBeGreaterThan(spies.read.mock.invocationCallOrder[1]);
    expect(spies.monsters).not.toHaveBeenCalled();
  });

  it('defers catalogs until leaving the menu and retains loaded items across renders', async () => {
    const dispatch = vi.fn();
    const { result, rerender } = renderHook(({ phase }) => useAppPreferences(createMockGameState({ phase }), dispatch), { initialProps: { phase: GamePhase.MAIN_MENU } });
    expect(result.current.itemsById).toBeNull();
    await act(async () => { rerender({ phase: GamePhase.PLAYING }); });
    expect(result.current.itemsById).toEqual({ fixture: { id: 'fixture' } });
    expect(spies.monsters).toHaveBeenCalledTimes(1);
    rerender({ phase: GamePhase.PLAYING });
    expect(spies.monsters).toHaveBeenCalledTimes(1);
  });
});

describe('App clock ownership', () => {
  it('ticks exploration, pauses under a blocking modal and never ticks combat', () => {
    const dispatch = vi.fn();
    const state = createMockGameState({ phase: GamePhase.PLAYING, isLoading: false, isMapVisible: false, isDevMenuVisible: false });
    const { rerender } = renderHook(({ phase, blocked }) => useAppPhaseClock({ ...state, phase }, dispatch, { isOpen: blocked }), { initialProps: { phase: GamePhase.PLAYING, blocked: false } });
    act(() => vi.advanceTimersByTime(1000));
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADVANCE_TIME', payload: { seconds: 1 } });
    dispatch.mockClear();
    rerender({ phase: GamePhase.PLAYING, blocked: true });
    act(() => vi.advanceTimersByTime(3000));
    rerender({ phase: GamePhase.COMBAT, blocked: false });
    act(() => vi.advanceTimersByTime(3000));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('pauses the full Atlas planner, cancels its old tick, and resumes without catch-up', () => {
    const dispatch = vi.fn();
    const state = createMockGameState({ phase: GamePhase.PLAYING, isLoading: false, isMapVisible: false, isDevMenuVisible: false });
    const { rerender } = renderHook(({ surface, mode }: { surface: 'classic' | 'worldforge'; mode: 'atlas' | '3d' }) =>
      useAppPhaseClock({ ...state, mapSurface: surface, worldViewMode: mode }, dispatch, { isOpen: false }),
      { initialProps: { surface: 'classic' as 'classic' | 'worldforge', mode: 'atlas' as 'atlas' | '3d' } });
    act(() => vi.advanceTimersByTime(1000));
    expect(dispatch).toHaveBeenCalledTimes(1);
    dispatch.mockClear();
    rerender({ surface: 'worldforge', mode: 'atlas' });
    act(() => vi.advanceTimersByTime(60000));
    expect(dispatch).not.toHaveBeenCalled();
    rerender({ surface: 'worldforge', mode: '3d' });
    act(() => vi.advanceTimersByTime(999));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(dispatch.mock.calls).toEqual([[{ type: 'ADVANCE_TIME', payload: { seconds: 1 } }]]);
    dispatch.mockClear();
    rerender({ surface: 'worldforge', mode: 'atlas' });
    act(() => vi.advanceTimersByTime(5000));
    expect(dispatch).not.toHaveBeenCalled();
    rerender({ surface: 'classic', mode: 'atlas' });
    act(() => vi.advanceTimersByTime(1000));
    expect(dispatch.mock.calls).toEqual([[{ type: 'ADVANCE_TIME', payload: { seconds: 1 } }]]);
  });

  it('cancels the welcome transition if the player leaves it early', () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(({ phase }) => useAppPhaseClock(createMockGameState({ phase }), dispatch, { isOpen: false }), { initialProps: { phase: GamePhase.LOAD_TRANSITION } });
    act(() => vi.advanceTimersByTime(1999));
    expect(dispatch).not.toHaveBeenCalled();
    rerender({ phase: GamePhase.MAIN_MENU });
    act(() => vi.advanceTimersByTime(2000));
    expect(dispatch).not.toHaveBeenCalled();
    rerender({ phase: GamePhase.LOAD_TRANSITION });
    act(() => vi.advanceTimersByTime(2000));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_GAME_PHASE', payload: GamePhase.PLAYING });
  });
});

describe('App loading recovery', () => {
  it('restores controls at the original ceiling and cancels after loading ends', () => {
    const dispatch = vi.fn(); const message = vi.fn();
    const { rerender } = renderHook(({ loading }) => useAppLoadingWatchdog(createMockGameState({ isLoading: loading }), dispatch, message), { initialProps: { loading: true } });
    act(() => vi.advanceTimersByTime(59999));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_LOADING', payload: { isLoading: false } });
    expect(message).toHaveBeenCalledTimes(1);
    dispatch.mockClear(); rerender({ loading: false });
    act(() => vi.advanceTimersByTime(60000));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
