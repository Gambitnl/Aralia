/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/gameEntry/__tests__/OpeningSituationGate.test.tsx
 *
 * Tests the visible opening-situation gate controls. The gate is the small
 * overlay that appears when a fresh, generated opening cannot be written by the
 * local model; these tests make sure the player can retry generation, open the
 * shared LLM choice pane, reach developer logs, and avoid a false bypass into a
 * broken main view.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpeningSituationGate } from '../OpeningSituationGate';
import { createMockGameState } from '../../../utils/core';
import type { AppAction } from '../../../state/actionTypes';
import { INITIAL_SCENE_IMAGE_STATE } from '../../../systems/gameEntry/types';

describe('OpeningSituationGate', () => {
    it('keeps the failed-opening blocker honest and exposes recovery choices', () => {
        const dispatch = vi.fn<(action: AppAction) => void>();
        const state = {
            ...createMockGameState(),
            gameEntry: {
                status: 'model-unavailable' as const,
                situation: null,
                sceneImage: INITIAL_SCENE_IMAGE_STATE,
                error: 'NO_MODEL',
            },
        };

        render(<OpeningSituationGate gameState={state} dispatch={dispatch} />);

        const blocker = screen.getByTestId('opening-situation-unavailable');

        // The blocker covers the ordinary in-game menu button, so it provides a
        // direct route to the same developer menu and its prompt/log viewers.
        fireEvent.click(within(blocker).getByTestId('opening-situation-dev-menu'));
        expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_DEV_MENU' });

        // A failed local model is not a dead end: the player can open Aralia's
        // shared provider pane and choose the configured cloud alternative.
        const chooseLlm = within(blocker).getByTestId('opening-situation-choose-llm');
        expect(chooseLlm).toHaveClass('min-h-11');
        fireEvent.click(chooseLlm);

        expect(screen.getByText('Ollama Dependency')).toBeInTheDocument();
        expect(screen.getByTestId('groq-provider-section')).toBeInTheDocument();

        // Retrying remains available for players who start their existing local
        // model instead of switching providers.
        const retry = within(blocker).getByTestId('opening-situation-retry');
        expect(retry).toHaveClass('min-h-11');
        fireEvent.click(retry);
        expect(dispatch).toHaveBeenCalledWith({ type: 'BEGIN_OPENING_SITUATION' });

        // A player can also choose to continue directly into the world to play immediately.
        const skip = within(blocker).getByTestId('opening-situation-skip');
        expect(skip).toHaveClass('min-h-11');
        fireEvent.click(skip);
        expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_OPENING_SITUATION' });
    });

    it('allows skipping straight to world during opening situation generation', () => {
        const dispatch = vi.fn<(action: AppAction) => void>();
        const state = {
            ...createMockGameState(),
            gameEntry: {
                status: 'generating' as const,
                situation: null,
                sceneImage: INITIAL_SCENE_IMAGE_STATE,
                error: null,
            },
        };

        render(<OpeningSituationGate gameState={state} dispatch={dispatch} />);

        const banner = screen.getByTestId('opening-situation-generating');
        expect(banner).toBeInTheDocument();

        const skipBtn = within(banner).getByTestId('opening-situation-generating-skip');
        fireEvent.click(skipBtn);
        expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_OPENING_SITUATION' });
    });
});
