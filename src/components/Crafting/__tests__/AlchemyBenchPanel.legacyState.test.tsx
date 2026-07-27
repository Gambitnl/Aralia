import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CraftingState } from '../../../types/crafting';
import { AlchemyBenchPanel } from '../AlchemyBenchPanel';

/**
 * This file proves the player-facing Alchemy Bench can open an older partial
 * crafting save instead of crashing when newer nested state is absent.
 *
 * The selector tests own the detailed merge contract. This mounted test protects
 * the panel integration that reads progression and statistics from that result.
 */

// ============================================================================
// Focused Game-State Boundary
// ============================================================================
// The bench reads the shared game context directly, so this controlled boundary
// supplies only the state involved in the legacy-save failure and records actions.
// ============================================================================

const useGameStateMock = vi.fn();

vi.mock('../../../state/GameContext', () => ({
    useGameState: () => useGameStateMock()
}));

vi.mock('../AlchemyBenchPanel.css', () => ({}));

describe('AlchemyBenchPanel legacy crafting state', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders preserved progression and default statistics from a partial save', () => {
        const dispatch = vi.fn();
        const partialLegacyCraftingState = {
            level: 4,
            xp: 45,
            bonusModifier: 3,
            knownRecipes: ['antitoxin'],
            toolProficiencies: ['Herbalism Kit'],
            unlockedAchievements: ['first-brew'],
            currentLocation: 'field'
        } as unknown as CraftingState;

        useGameStateMock.mockReturnValue({
            state: {
                party: [],
                inventory: [],
                gold: 125,
                crafting: partialLegacyCraftingState
            },
            dispatch
        });

        render(<AlchemyBenchPanel onClose={vi.fn()} />);

        expect(screen.getByText('Lv 4')).toBeInTheDocument();
        expect(screen.getByText('45 / 100 XP')).toBeInTheDocument();
        expect(screen.getByText('+3')).toBeInTheDocument();
        expect(screen.getByText('Total Crafted: 0')).toBeInTheDocument();
        expect(screen.getByText('Successes: 0')).toBeInTheDocument();

        // A present legacy object is normalized for reading; it must not be
        // replaced by the reducer's entirely-missing-state initialization path.
        expect(dispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'INIT_CRAFTING_STATE' })
        );
    });
});
