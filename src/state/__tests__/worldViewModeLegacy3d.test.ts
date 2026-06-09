/**
 * @file worldViewModeLegacy3d.test.ts
 * W3DUI-22: PLAYING streamed 3D (worldViewMode) must not stack on legacy ThreeDModal (isThreeDVisible).
 */
import { describe, it, expect } from 'vitest';
import { appReducer } from '../appState';
import { uiReducer } from '../reducers/uiReducer';
import { GamePhase, GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { createMockPlayerCharacter } from '../../utils/factories';
import { getGameDay } from '../../utils/core';

const makeState = (overrides: Partial<GameState> = {}): GameState =>
  ({
    party: [createMockPlayerCharacter()],
    phase: GamePhase.PLAYING,
    worldViewMode: 'atlas',
    isThreeDVisible: false,
    ...overrides,
  }) as unknown as GameState;

describe('worldViewMode vs legacy ThreeDModal (W3DUI-22)', () => {
  it('SET_WORLD_VIEW_MODE 3d clears isThreeDVisible', () => {
    const state = makeState({ isThreeDVisible: true });
    const next = appReducer(state, { type: 'SET_WORLD_VIEW_MODE', payload: '3d' });
    expect(next.worldViewMode).toBe('3d');
    expect(next.isThreeDVisible).toBe(false);
  });

  it('TOGGLE_THREE_D_VISIBILITY in PLAYING keeps legacy modal off', () => {
    const state = makeState({ isThreeDVisible: false });
    const patch = uiReducer(state, { type: 'TOGGLE_THREE_D_VISIBILITY' });
    expect(patch.isThreeDVisible).toBe(false);
  });

  it('TOGGLE_THREE_D_VISIBILITY outside PLAYING still toggles', () => {
    const state = makeState({ phase: GamePhase.MAIN_MENU, isThreeDVisible: false });
    const patch = uiReducer(state, { type: 'TOGGLE_THREE_D_VISIBILITY' });
    expect(patch.isThreeDVisible).toBe(true);
  });

  it('LOAD_GAME_SUCCESS with 3d worldViewMode clears legacy flag', () => {
    const state = makeState();
    const action = {
      type: 'LOAD_GAME_SUCCESS',
      payload: {
        worldViewMode: '3d',
        isThreeDVisible: true,
        party: state.party,
      },
    } as AppAction;
    const next = appReducer(state, action);
    expect(next.worldViewMode).toBe('3d');
    expect(next.isThreeDVisible).toBe(false);
  });

  it('LOAD_GAME_SUCCESS backfills shortRestTracker when omitted from saved payload', () => {
    const state = makeState();
    const loadedSaveDate = new Date(Date.UTC(351, 0, 3, 12, 0, 0));
    const action = {
      type: 'LOAD_GAME_SUCCESS',
      payload: {
        party: state.party,
        gameTime: loadedSaveDate,
        currentLocationId: state.currentLocationId,
      },
    } as AppAction;

    const next = appReducer(state, action);

    expect(next.shortRestTracker).toEqual({
      restsTakenToday: 0,
      lastRestDay: getGameDay(loadedSaveDate),
      lastRestEndedAtMs: null,
    });
  });
});
