/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/__tests__/useGameHotkeys.test.ts
 *
 * Tests for the centralized game exploration hotkeys hook.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useGameHotkeys } from '../useGameHotkeys';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/core';
import { GamePhase } from '../../types';
import type { AppAction } from '../../state/actionTypes';

describe('useGameHotkeys', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let onAction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn<(action: AppAction) => void>();
    onAction = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers map toggle on KeyM', () => {
    const mockState = {
      ...createMockGameState(),
      phase: GamePhase.PLAYING,
      isMapVisible: false,
    };

    renderHook(() =>
      useGameHotkeys({
        gameState: mockState,
        dispatch,
        onAction,
      }),
    );

    const event = new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true });
    window.dispatchEvent(event);

    expect(onAction).toHaveBeenCalledWith({
      type: 'toggle_map',
      label: 'World Map',
    });
  });

  it('opens character sheet on KeyC for party[0]', () => {
    const mockCharacter = createMockPlayerCharacter({ name: 'Sir Testalot' });
    const mockState = {
      ...createMockGameState(),
      phase: GamePhase.PLAYING,
      party: [mockCharacter],
      characterSheetModal: { isOpen: false, character: null },
    };

    renderHook(() =>
      useGameHotkeys({
        gameState: mockState,
        dispatch,
        onAction,
      }),
    );

    const event = new KeyboardEvent('keydown', { code: 'KeyC', bubbles: true });
    window.dispatchEvent(event);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'OPEN_CHARACTER_SHEET',
      payload: { character: mockCharacter },
    });
  });

  it('closes character sheet on KeyC when already open', () => {
    const mockCharacter = createMockPlayerCharacter({ name: 'Sir Testalot' });
    const mockState = {
      ...createMockGameState(),
      phase: GamePhase.PLAYING,
      party: [mockCharacter],
      characterSheetModal: { isOpen: true, character: mockCharacter },
    };

    renderHook(() =>
      useGameHotkeys({
        gameState: mockState,
        dispatch,
        onAction,
      }),
    );

    const event = new KeyboardEvent('keydown', { code: 'KeyC', bubbles: true });
    window.dispatchEvent(event);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'CLOSE_CHARACTER_SHEET',
    });
  });

  it('dismisses active modal on Escape key', () => {
    const mockState = {
      ...createMockGameState(),
      phase: GamePhase.PLAYING,
      isMapVisible: true,
    };

    renderHook(() =>
      useGameHotkeys({
        gameState: mockState,
        dispatch,
        onAction,
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_MAP_VISIBILITY' });
  });

  it('toggles quest log on KeyQ or KeyJ', () => {
    const mockState = {
      ...createMockGameState(),
      phase: GamePhase.PLAYING,
    };

    renderHook(() =>
      useGameHotkeys({
        gameState: mockState,
        dispatch,
        onAction,
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_QUEST_LOG' });

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_QUEST_LOG' });
  });

  it('toggles discovery log on KeyL', () => {
    const mockState = {
      ...createMockGameState(),
      phase: GamePhase.PLAYING,
    };

    renderHook(() =>
      useGameHotkeys({
        gameState: mockState,
        dispatch,
        onAction,
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_DISCOVERY_LOG_VISIBILITY' });
  });

  it('toggles rest modal on KeyR', () => {
    const mockState = {
      ...createMockGameState(),
      phase: GamePhase.PLAYING,
    };

    renderHook(() =>
      useGameHotkeys({
        gameState: mockState,
        dispatch,
        onAction,
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_SHORT_REST_MODAL' });
  });

  it('toggles view mode on KeyV', () => {
    const mockState = {
      ...createMockGameState(),
      phase: GamePhase.PLAYING,
      worldViewMode: '3d' as const,
    };

    renderHook(() =>
      useGameHotkeys({
        gameState: mockState,
        dispatch,
        onAction,
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_WORLD_VIEW_MODE',
      payload: 'atlas',
    });
  });

  it('does nothing when disabled or not in PLAYING phase', () => {
    const mockState = {
      ...createMockGameState(),
      phase: GamePhase.MAIN_MENU,
    };

    renderHook(() =>
      useGameHotkeys({
        gameState: mockState,
        dispatch,
        onAction,
        disabled: true,
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true }));
    expect(onAction).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
