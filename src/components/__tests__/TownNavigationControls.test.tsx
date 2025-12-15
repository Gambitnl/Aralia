import React from 'react';
import { render, screen } from '@testing-library/react';
import TownNavigationControls from '../TownNavigationControls';
import { TownDirection } from '../../types/town';
import { vi } from 'vitest';

describe('TownNavigationControls', () => {
    const mockOnMove = vi.fn();
    const mockOnExit = vi.fn();

    it('renders directional buttons with accessible labels', () => {
        render(
            <TownNavigationControls
                onMove={mockOnMove}
                onExit={mockOnExit}
            />
        );

        // Verify all directional buttons have aria-labels
        expect(screen.getByLabelText('Move North')).toBeInTheDocument();
        expect(screen.getByLabelText('Move South')).toBeInTheDocument();
        expect(screen.getByLabelText('Move East')).toBeInTheDocument();
        expect(screen.getByLabelText('Move West')).toBeInTheDocument();
        expect(screen.getByLabelText('Move Northwest')).toBeInTheDocument();
        expect(screen.getByLabelText('Move Northeast')).toBeInTheDocument();
        expect(screen.getByLabelText('Move Southwest')).toBeInTheDocument();
        expect(screen.getByLabelText('Move Southeast')).toBeInTheDocument();

        // Verify exit button
        expect(screen.getByLabelText('Leave Town')).toBeInTheDocument();
    });

    it('renders building buttons with accessible labels', () => {
        const buildings = [
            { id: 'b1', name: 'Tavern', type: 'Inn' },
            { id: 'b2', name: 'Blacksmith', type: 'Shop' }
        ];

        render(
            <TownNavigationControls
                onMove={mockOnMove}
                onExit={mockOnExit}
                adjacentBuildings={buildings}
            />
        );

        expect(screen.getByLabelText('Enter Tavern (Inn)')).toBeInTheDocument();
        expect(screen.getByLabelText('Enter Blacksmith (Shop)')).toBeInTheDocument();
    });

    it('marks disabled buttons correctly', () => {
        render(
            <TownNavigationControls
                onMove={mockOnMove}
                onExit={mockOnExit}
                disabled={true}
            />
        );

        expect(screen.getByLabelText('Move North')).toBeDisabled();
        expect(screen.getByLabelText('Leave Town')).toBeDisabled();
    });

    it('marks blocked directions as disabled', () => {
        render(
            <TownNavigationControls
                onMove={mockOnMove}
                onExit={mockOnExit}
                blockedDirections={['north']}
            />
        );

        expect(screen.getByLabelText('Move North')).toBeDisabled();
        expect(screen.getByLabelText('Move South')).not.toBeDisabled();
    });
});
