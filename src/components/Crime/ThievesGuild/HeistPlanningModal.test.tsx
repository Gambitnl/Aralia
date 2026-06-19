import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeistPlanningModal } from './HeistPlanningModal';
import { HeistPlan, HeistPhase, HeistIntel, HeistApproach } from '../../../types/crime';

describe('HeistPlanningModal', () => {
    const mockApproach: HeistApproach = {
        type: 'Stealth',
        riskModifier: -10,
        timeModifier: 1.5,
        requiredSkills: ['Stealth', 'ThievesTools']
    };

    const mockIntel: HeistIntel = {
        id: 'intel_1',
        locationId: 'loc_bank',
        type: 'GuardPatrol',
        description: 'Guards change shifts at midnight.',
        accuracy: 1.0
    };

    const mockPlan: HeistPlan = {
        id: 'plan_1',
        targetLocationId: 'loc_bank',
        phase: HeistPhase.Planning,
        leaderId: 'player_1',
        crew: [],
        collectedIntel: [],
        intelGathered: [mockIntel],
        approaches: [mockApproach],
        lootSecured: [],
        alertLevel: 0,
        turnsElapsed: 0,
        maxAlertLevel: 100
    };

    const mockOnSelectApproach = vi.fn();
    const mockOnStartHeist = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the target location and intel', () => {
        render(
            <HeistPlanningModal
                plan={mockPlan}
                onSelectApproach={mockOnSelectApproach}
                onStartHeist={mockOnStartHeist}
                onClose={mockOnClose}
            />
        );

        expect(screen.getByText(/Target: loc_bank/)).toBeDefined();
        expect(screen.getByText('Guards change shifts at midnight.')).toBeDefined();
    });

    it('handles approach selection and enables start button', () => {
        render(
            <HeistPlanningModal
                plan={mockPlan}
                onSelectApproach={mockOnSelectApproach}
                onStartHeist={mockOnStartHeist}
                onClose={mockOnClose}
            />
        );

        const startButton = screen.getByText('Begin Heist');
        expect(startButton).toHaveProperty('disabled', true);

        const approachButton = screen.getByText('Stealth').closest('button');
        fireEvent.click(approachButton!);

        expect(mockOnSelectApproach).toHaveBeenCalledWith(mockApproach);
        expect(startButton).toHaveProperty('disabled', false);

        fireEvent.click(startButton);
        expect(mockOnStartHeist).toHaveBeenCalled();
    });

    it('renders empty intel message when no intel is gathered', () => {
        const planWithoutIntel = { ...mockPlan, intelGathered: [] };
        render(
            <HeistPlanningModal
                plan={planWithoutIntel}
                onSelectApproach={mockOnSelectApproach}
                onStartHeist={mockOnStartHeist}
                onClose={mockOnClose}
            />
        );

        expect(screen.getByText('No intel gathering conducted yet.')).toBeDefined();
    });
});
