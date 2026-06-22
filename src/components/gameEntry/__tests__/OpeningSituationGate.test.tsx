/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/gameEntry/__tests__/OpeningSituationGate.test.tsx
 *
 * Tests the visible opening-situation gate controls. The gate is the small
 * overlay that appears when a fresh, generated opening cannot be written by the
 * local model; these tests make sure the player can either retry generation or
 * dismiss the failed opening and keep playing.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpeningSituationGate } from '../OpeningSituationGate';
import { createMockGameState } from '../../../utils/factories';
import type { AppAction } from '../../../state/actionTypes';

describe('OpeningSituationGate', () => {
    it('dispatches a skip action from the failed-opening dismiss button', () => {
        const dispatch = vi.fn<[AppAction], void>();
        const state = {
            ...createMockGameState(),
            gameEntry: { status: 'model-unavailable' as const, situation: null, error: 'NO_MODEL' },
        };

        render(<OpeningSituationGate gameState={state} dispatch={dispatch} />);

        // The dismiss button lives on the failed-opening card itself, separate
        // from the explanatory Ollama pane, so it is available at the blocker.
        const blocker = screen.getByTestId('opening-situation-unavailable');
        fireEvent.click(within(blocker).getByTestId('opening-situation-dismiss'));

        expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_OPENING_SITUATION' });
    });
});
