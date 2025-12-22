import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReactionPrompt } from '../ReactionPrompt';
import { createMockSpell } from '../../../utils/factories';

describe('ReactionPrompt', () => {
    const mockOnResolve = vi.fn();
    const mockSpells = [
        createMockSpell({ id: 'shield', name: 'Shield', description: '+5 AC' }),
        createMockSpell({ id: 'hellish-rebuke', name: 'Hellish Rebuke', description: 'Fire damage' })
    ];

    it('renders the reaction opportunity header', () => {
        render(
            <ReactionPrompt
                attackerName="Goblin"
                reactionSpells={mockSpells}
                triggerType="hit"
                onResolve={mockOnResolve}
            />
        );
        expect(screen.getByText(/reaction opportunity/i)).toBeInTheDocument();
        // The text is split into a span for "Goblin" and the rest.
        // We can check for "Goblin" separately or use a custom matcher if needed,
        // but for now checking "hit you!" is sufficient context verification.
        expect(screen.getByText(/Goblin/i)).toBeInTheDocument();
        expect(screen.getByText(/hit you!/i)).toBeInTheDocument();
    });

    it('renders buttons for each spell', () => {
        render(
            <ReactionPrompt
                attackerName="Goblin"
                reactionSpells={mockSpells}
                triggerType="hit"
                onResolve={mockOnResolve}
            />
        );
        expect(screen.getByRole('button', { name: /Cast Shield/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cast Hellish Rebuke/i })).toBeInTheDocument();
    });

    it('calls onResolve with spell ID when a spell is clicked', () => {
        render(
            <ReactionPrompt
                attackerName="Goblin"
                reactionSpells={mockSpells}
                triggerType="hit"
                onResolve={mockOnResolve}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Cast Shield/i }));
        expect(mockOnResolve).toHaveBeenCalledWith('shield');
    });

    it('calls onResolve with null when Skip is clicked', () => {
        render(
            <ReactionPrompt
                attackerName="Goblin"
                reactionSpells={mockSpells}
                triggerType="hit"
                onResolve={mockOnResolve}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Skip Reaction/i }));
        expect(mockOnResolve).toHaveBeenCalledWith(null);
    });
});
