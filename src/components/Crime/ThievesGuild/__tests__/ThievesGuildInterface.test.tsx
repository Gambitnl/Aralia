
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ThievesGuildInterface from '../ThievesGuildInterface';
import { GameProvider } from '../../../../state/GameContext';
import { initialGameState } from '../../../../state/appState';
import { GuildJob, GuildJobType } from '../../../../types/crime';

// Mock the system to control random generation
vi.mock('../../../../systems/crime/ThievesGuildSystem', () => ({
    ThievesGuildSystem: {
        generateJobs: vi.fn(() => [
            {
                id: 'job-1',
                title: 'Test Job',
                description: 'A test job',
                type: 'Burglary',
                difficulty: 1,
                requiredRank: 1,
                rewardGold: 100,
                rewardReputation: 10,
                status: 'Available',
                targetLocationId: 'loc-1',
                guildId: 'shadow_hands'
            }
        ]),
        getAvailableServices: vi.fn(() => [
            {
                id: 'service-1',
                name: 'Test Fence',
                description: 'Fences items',
                type: 'Fence',
                requiredRank: 1,
                costGold: 0,
                cooldownHours: 0
            }
        ])
    }
}));

describe('ThievesGuildInterface', () => {
    const mockDispatch = vi.fn();
    const mockOnClose = vi.fn();

    const renderWithState = (customState: Partial<typeof initialGameState> = {}) => {
        const state = {
            ...initialGameState,
            ...customState,
            thievesGuild: {
                ...initialGameState.thievesGuild,
                ...customState.thievesGuild
            },
            // Ensure permissions allow showing dev/debug items if needed
            party: [{ id: 'p1', name: 'Player' }]
        };

        return render(
            <GameProvider state={state} dispatch={mockDispatch}>
                <ThievesGuildInterface onClose={mockOnClose} />
            </GameProvider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the recruitment screen when rank is 0', () => {
        renderWithState({ thievesGuild: { rank: 0 } });

        expect(screen.getByText('The Shadows Watch')).toBeInTheDocument();
        expect(screen.getByText('Seek Membership')).toBeInTheDocument();
    });

    it('dispatches JOIN_GUILD when clicking Seek Membership', () => {
        renderWithState({ thievesGuild: { rank: 0 } });

        fireEvent.click(screen.getByText('Seek Membership'));

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'JOIN_GUILD',
            payload: { guildId: 'shadow_hands' }
        });
    });

    it('renders the main interface when rank > 0', () => {
        renderWithState({ thievesGuild: { rank: 1, reputation: 50, activeJobs: [] } });

        expect(screen.getByText('Shadow Hands Guild')).toBeInTheDocument();
        expect(screen.getByText(/Rank:/)).toBeInTheDocument();
        expect(screen.getByText('Associate')).toBeInTheDocument();
    });

    it('displays available jobs and accepts them', () => {
        renderWithState({ thievesGuild: { rank: 1, reputation: 50, activeJobs: [] } });

        // Check job list (mocked above)
        expect(screen.getByText('Test Job')).toBeInTheDocument();

        // Accept job
        fireEvent.click(screen.getByText('Accept Contract'));

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'ACCEPT_GUILD_JOB',
            payload: expect.objectContaining({
                job: expect.objectContaining({ id: 'job-1' })
            })
        });
    });

    it('displays active jobs tab correctly', () => {
        const activeJob: GuildJob = {
            id: 'job-active',
            title: 'Active Job 1',
            description: 'Doing things',
            type: GuildJobType.Burglary,
            difficulty: 2,
            requiredRank: 1,
            rewardGold: 200,
            rewardReputation: 20,
            status: 'Active',
            targetLocationId: 'loc-2',
            guildId: 'shadow_hands'
        };

        renderWithState({
            thievesGuild: {
                rank: 1,
                reputation: 50,
                activeJobs: [activeJob]
            }
        });

        // Switch tab
        fireEvent.click(screen.getByText(/Active Jobs/));

        expect(screen.getByText('Active Job 1')).toBeInTheDocument();
        expect(screen.getByText('Abandon')).toBeInTheDocument();
    });
});
