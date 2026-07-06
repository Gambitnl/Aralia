/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/gameEntry/__tests__/OpeningSituationGate.test.tsx
 *
 * Tests the visible opening-situation gate controls. The gate is the small
 * overlay that appears when a fresh, generated opening cannot be written by the
 * local model; these tests make sure the player can retry generation without
 * being offered a false bypass into a broken main view.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpeningSituationGate } from '../OpeningSituationGate';
import { createMockGameState } from '../../../utils/factories';
import type { AppAction } from '../../../state/actionTypes';

describe('OpeningSituationGate', () => {
    it('keeps the failed-opening blocker honest and exposes retry only', () => {
        const dispatch = vi.fn<[AppAction], void>();
        const state = {
            ...createMockGameState(),
            gameEntry: { status: 'model-unavailable' as const, situation: null, error: 'NO_MODEL' },
        };

        render(<OpeningSituationGate gameState={state} dispatch={dispatch} />);

        // The opening scene is not currently optional in the live main view.
        // A Dismiss button used to clear this blocker, then the game crashed
        // into the generic error boundary with no recovery actions.
        const blocker = screen.getByTestId('opening-situation-unavailable');
        expect(within(blocker).queryByTestId('opening-situation-dismiss')).toBeNull();

        const retry = within(blocker).getByTestId('opening-situation-retry');
        expect(retry).toHaveClass('min-h-11');
        fireEvent.click(retry);

        expect(dispatch).toHaveBeenCalledWith({ type: 'BEGIN_OPENING_SITUATION' });
    });
});
