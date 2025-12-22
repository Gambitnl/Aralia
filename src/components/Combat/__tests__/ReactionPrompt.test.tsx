import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReactionPrompt } from '../ReactionPrompt';
import { createMockSpell } from '../../../utils/factories';

// Mock the useFocusTrap hook to verify it's being called
const mockFocusTrapRef = { current: null };
vi.mock('../../hooks/useFocusTrap', () => ({
    useFocusTrap: vi.fn(() => mockFocusTrapRef)
}));

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

    // Accessibility Tests
    it('has correct ARIA roles and attributes', () => {
        render(
            <ReactionPrompt
                attackerName="Goblin"
                reactionSpells={mockSpells}
                triggerType="hit"
                onResolve={mockOnResolve}
            />
        );

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'reaction-title');
        expect(dialog).toHaveAttribute('aria-describedby', 'reaction-description');
    });

    it('links title and description via IDs', () => {
        render(
            <ReactionPrompt
                attackerName="Goblin"
                reactionSpells={mockSpells}
                triggerType="hit"
                onResolve={mockOnResolve}
            />
        );

        const title = screen.getByText(/Reaction Opportunity!/i);
        expect(title).toHaveAttribute('id', 'reaction-title');

        // Note: The description text is split, but the container p tag has the ID
        // We find the element by ID to verify it exists and contains the text
        const description = document.getElementById('reaction-description');
        expect(description).toBeInTheDocument();
        expect(description).toHaveTextContent(/Goblin/);
        expect(description).toHaveTextContent(/hit you!/);
    });
});
