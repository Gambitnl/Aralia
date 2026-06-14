/**
 * @file mapSurfaceToggle.test.ts
 * Worldforge surface toggle: SET_MAP_SURFACE swaps the 2D cartographic surface
 * ('classic' GameLayout ↔ 'worldforge' native cartographer) without disturbing
 * the independent worldViewMode (2D atlas vs streamed 3D). Legacy saves without
 * the field heal to 'classic' on load.
 */
import { describe, it, expect } from 'vitest';
import { appReducer } from '../appState';
import { GamePhase, GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { createMockPlayerCharacter } from '../../utils/factories';

const makeState = (overrides: Partial<GameState> = {}): GameState =>
  ({
    party: [createMockPlayerCharacter()],
    phase: GamePhase.PLAYING,
    worldViewMode: 'atlas',
    mapSurface: 'classic',
    isThreeDVisible: false,
    ...overrides,
  }) as unknown as GameState;

describe('mapSurface toggle (Worldforge)', () => {
  it('SET_MAP_SURFACE switches classic → worldforge', () => {
    const state = makeState();
    const next = appReducer(state, { type: 'SET_MAP_SURFACE', payload: 'worldforge' });
    expect(next.mapSurface).toBe('worldforge');
  });

  it('SET_MAP_SURFACE switches worldforge → classic', () => {
    const state = makeState({ mapSurface: 'worldforge' });
    const next = appReducer(state, { type: 'SET_MAP_SURFACE', payload: 'classic' });
    expect(next.mapSurface).toBe('classic');
  });

  it('SET_MAP_SURFACE does not disturb worldViewMode', () => {
    const state = makeState({ worldViewMode: '3d' });
    const next = appReducer(state, { type: 'SET_MAP_SURFACE', payload: 'worldforge' });
    expect(next.worldViewMode).toBe('3d');
    expect(next.mapSurface).toBe('worldforge');
  });

  it('LOAD_GAME_SUCCESS without mapSurface heals to classic', () => {
    const state = makeState({ mapSurface: 'worldforge' });
    const action = {
      type: 'LOAD_GAME_SUCCESS',
      payload: { party: state.party },
    } as AppAction;
    const next = appReducer(state, action);
    expect(next.mapSurface).toBe('classic');
  });

  it('LOAD_GAME_SUCCESS preserves saved worldforge surface', () => {
    const state = makeState();
    const action = {
      type: 'LOAD_GAME_SUCCESS',
      payload: { party: state.party, mapSurface: 'worldforge' },
    } as AppAction;
    const next = appReducer(state, action);
    expect(next.mapSurface).toBe('worldforge');
  });
});
