import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThievesGuildSafehouse } from './ThievesGuildSafehouse';
import { GuildMembership } from '../../../types/crime';

describe('ThievesGuildSafehouse', () => {
    const mockMembership: GuildMembership = {
        memberId: 'player_1',
        guildId: 'shadow_hands',
        rank: 3,
        reputation: 150,
        activeJobs: [],
        availableJobs: [],
        completedJobs: [],
        servicesUnlocked: []
    };

    const mockOnUseService = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the safehouse title and player rank', () => {
        render(
            <ThievesGuildSafehouse
                membership={mockMembership}
                onUseService={mockOnUseService}
                onClose={mockOnClose}
            />
        );

        expect(screen.getByText('The Undercroft')).toBeDefined();
        expect(screen.getByText('Rank 3')).toBeDefined();
    });

    it('renders services and disables ones above player rank', () => {
        render(
            <ThievesGuildSafehouse
                membership={{ ...mockMembership, rank: 2 }}
                onUseService={mockOnUseService}
                onClose={mockOnClose}
            />
        );

        // Rank 1 and 2 services should be available
        const rank1Service = screen.getByText('Street Fence');
        expect(rank1Service).toBeDefined();

        const rank2Service = screen.getByText('Safehouse Network');
        expect(rank2Service).toBeDefined();

        // Should NOT find higher rank services (because getAvailableServices only returns up to rank)
        const rank3Service = screen.queryByText('Bribe Officials');
        expect(rank3Service).toBeNull();
    });

    it('calls onUseService when an available service is clicked', () => {
        render(
            <ThievesGuildSafehouse
                membership={mockMembership}
                onUseService={mockOnUseService}
                onClose={mockOnClose}
            />
        );

        const safehouseButton = screen.getByText('Safehouse Network').closest('button');
        fireEvent.click(safehouseButton!);

        expect(mockOnUseService).toHaveBeenCalledWith('service_safehouse', 50, 'Safehouse Network');
    });

    it('calls onClose when close button is clicked', () => {
        render(
            <ThievesGuildSafehouse
                membership={mockMembership}
                onUseService={mockOnUseService}
                onClose={mockOnClose}
            />
        );

        // Assuming WindowFrame provides a close button
        const closeButton = screen.getByRole('button', { name: /close/i });
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalled();
    });
});
