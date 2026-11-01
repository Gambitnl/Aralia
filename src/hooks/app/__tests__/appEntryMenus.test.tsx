/** Entry/menu regressions protect the original character handoff, save-clear wait, generation lock and developer command order. All storage is replaced with disposable spies. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { GamePhase } from '../../../types';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/core/factories';
import type { useGameInitialization } from '../../useGameInitialization';
import { useAppCharacterEntry } from '../useAppCharacterEntry';
import { useAppWorldGeneration } from '../useAppWorldGeneration';
import { useAppDeveloperMenu } from '../useAppDeveloperMenu';
const storage = vi.hoisted(() => ({ hasSaveGame: vi.fn(() => false), clearAllSaves: vi.fn<() => Promise<void>>(async () => undefined) }));
vi.mock('../../../services/saveLoadService', () => storage);
beforeEach(() => { vi.clearAllMocks(); storage.hasSaveGame.mockReturnValue(false); });
afterEach(cleanup);

describe('character entry ownership', () => {
  it('renders the pending name and passes the exact build into the chosen town once', () => {
    const state = createMockGameState({ worldSeed: 42 }); const dispatch = vi.fn(); const start = vi.fn<ReturnType<typeof useGameInitialization>["startGame"]>(async () => undefined);
    const character = createMockPlayerCharacter({ name: 'C1 Traveler' }); const inventory = state.inventory;
    const { result } = renderHook(() => useAppCharacterEntry(state, dispatch, start));
    act(() => result.current.handleCharacterCreated(character, inventory));
    expect(result.current.pendingCharacterName).toBe('C1 Traveler');
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_GAME_PHASE', payload: GamePhase.START_POINT_SELECTION });
    act(() => result.current.handleStartTownConfirmed({ atlasCellId: 7, name: 'Town', stateName: 'Region', x: 12, y: 34 }));
    expect(start).toHaveBeenCalledWith(character, inventory, 42, { atlasCellId: 7, name: 'Town', region: 'Region', centerPx: [12, 34] });
    expect(start.mock.calls[0][0]).toBe(character);
    expect(start.mock.calls[0][1]).toBe(inventory);
    expect(result.current.pendingCharacterName).toBeUndefined();
    act(() => result.current.handleStartTownConfirmed({ atlasCellId: 7 }));
    expect(start).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_GAME_PHASE', payload: GamePhase.CHARACTER_CREATION });
  });

  it('forgets a backed-out build and routes missing pending state back to creation', () => {
    const dispatch = vi.fn(); const start = vi.fn<ReturnType<typeof useGameInitialization>["startGame"]>(async () => undefined);
    const { result } = renderHook(() => useAppCharacterEntry(createMockGameState(), dispatch, start));
    act(() => result.current.handleCharacterCreated(createMockPlayerCharacter(), []));
    act(() => result.current.handleStartSelectionBack());
    expect(result.current.pendingCharacterName).toBeUndefined();
    act(() => result.current.handleStartTownConfirmed({ atlasCellId: 7 }));
    expect(start).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_GAME_PHASE', payload: GamePhase.CHARACTER_CREATION });
  });

  it('waits for storage clearance before refreshing the main menu', async () => {
    let resolveClear!: () => void;
    storage.clearAllSaves.mockImplementationOnce(() => new Promise<void>(resolve => { resolveClear = resolve; }));
    const dispatch = vi.fn(); const { result } = renderHook(() => useAppCharacterEntry(createMockGameState(), dispatch, vi.fn(async () => undefined)));
    let pending!: Promise<void>;
    act(() => { pending = result.current.handleClearAllSaves(); });
    expect(dispatch).not.toHaveBeenCalled();
    await act(async () => { resolveClear(); await pending; });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU });
  });
});

describe('world generation menu ownership', () => {
  it('refuses regeneration while a save exists', () => {
    storage.hasSaveGame.mockReturnValue(true); const dispatch = vi.fn();
    const { result } = renderHook(() => useAppWorldGeneration(createMockGameState({ party: [] }), dispatch, vi.fn()));
    result.current.handleRegenerateWorldMap(77);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_NOTIFICATION', payload: { type: 'warning', message: 'World generation is locked because save data exists. Clear saves to unlock it.' } });
  });

  it('hands the previewed seed and authored item snapshot into new-game setup', () => {
    const dispatch = vi.fn(); const initialize = vi.fn();
    const { result } = renderHook(() => useAppWorldGeneration(createMockGameState({ party: [], worldSeed: 42 }), dispatch, initialize));
    result.current.handleNewGame();
    expect(initialize).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: 'START_NEW_GAME_SETUP', payload: { worldSeed: 42, dynamicLocationItemIds: expect.any(Object) } });
  });
});

describe('developer menu ownership', () => {
  it('closes the menu before invoking the awaited quick-start path', async () => {
    const order: string[] = []; const dispatch = vi.fn(() => { order.push('dispatch'); });
    const skip = vi.fn(async () => { order.push('skip'); });
    const { result } = renderHook(() => useAppDeveloperMenu(createMockGameState(), dispatch, vi.fn(), vi.fn(async () => undefined), vi.fn(async () => undefined), skip));
    await act(async () => result.current.handleDevMenuAction('quick_start_dev'));
    expect(order).toEqual(['dispatch', 'skip']);
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_DEV_MENU' });
  });

  it('opens a closed glossary atomically and selects directly when already open', () => {
    const dispatch = vi.fn(); const action = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(({ open }) => useAppDeveloperMenu(createMockGameState({ isGlossaryVisible: open }), dispatch, vi.fn(), action, vi.fn(async () => undefined), vi.fn(async () => undefined)), { initialProps: { open: false } });
    result.current.handleNavigateToGlossaryFromTooltip('term');
    expect(action).toHaveBeenCalledWith({ type: 'TOGGLE_GLOSSARY_VISIBILITY', label: 'Open Glossary', payload: { initialTermId: 'term' } });
    expect(dispatch).not.toHaveBeenCalled();
    rerender({ open: true }); result.current.handleNavigateToGlossaryFromTooltip('next');
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_GLOSSARY_TERM_FOR_MODAL', payload: 'next' });
  });
});
