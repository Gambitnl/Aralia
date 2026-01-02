
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ActionEconomyBar from '../ActionEconomyBar';
import { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '@/utils/factories';

describe('ActionEconomyBar', () => {
    const mockOnExecuteAction = vi.fn();

    const mockCharacter: CombatCharacter = createMockCombatCharacter({
        id: 'char1',
        name: 'Hero',
        team: 'player',
        initiative: 10,
        actionEconomy: {
            action: { used: false, remaining: 1 },
            bonusAction: { used: false, remaining: 1 },
            reaction: { used: false, remaining: 1 },
            movement: { used: 0, total: 30 },
            freeActions: 1
        }
    });

    it('renders indicators for action, bonus, and reaction', () => {
        render(<ActionEconomyBar character={mockCharacter} onExecuteAction={mockOnExecuteAction} />);

        expect(screen.getByLabelText('Action')).toBeInTheDocument();
        expect(screen.getByLabelText('Bonus Action')).toBeInTheDocument();
        expect(screen.getByLabelText('Reaction')).toBeInTheDocument();
    });

    it('renders indicator for free interaction', () => {
        render(<ActionEconomyBar character={mockCharacter} onExecuteAction={mockOnExecuteAction} />);
        expect(screen.getByLabelText('Free Object Interaction')).toBeInTheDocument();
    });

    it('shows free interaction as used when freeActions <= 0', () => {
        const usedFreeChar = {
            ...mockCharacter,
            actionEconomy: {
                ...mockCharacter.actionEconomy,
                freeActions: 0
            }
        };
        render(<ActionEconomyBar character={usedFreeChar} onExecuteAction={mockOnExecuteAction} />);

        const freeInteraction = screen.getByLabelText('Free Object Interaction');
        // The container holding the emoji is what we're looking for.
        // In the implementation, we'll check if the parent div has the used styling.
        // We can check for "opacity-40" or "line-through" on the text if we implement it that way.
        expect(freeInteraction.closest('div')).toHaveClass('opacity-40');
    });

    it('shows movement bar correctly', () => {
        const movedChar = {
            ...mockCharacter,
            actionEconomy: {
                ...mockCharacter.actionEconomy,
                movement: { used: 15, total: 30 }
            }
        };
        render(<ActionEconomyBar character={movedChar} onExecuteAction={mockOnExecuteAction} />);

        expect(screen.getByText('15 / 30')).toBeInTheDocument();
    });

    it('renders sustain button when concentrating', () => {
        const concentratingChar: CombatCharacter = {
            ...mockCharacter,
            concentratingOn: {
                spellId: 'spell1',
                spellName: 'Bless',
                spellLevel: 1,
                startedTurn: 0,
                effectIds: [],
                canDropAsFreeAction: true,
                sustainedThisTurn: false,
                sustainCost: { actionType: 'action', optional: false }
            }
        };

        render(<ActionEconomyBar character={concentratingChar} onExecuteAction={mockOnExecuteAction} />);

        const sustainBtn = screen.getByText(/Sustain Bless/i);
        expect(sustainBtn).toBeInTheDocument();

        fireEvent.click(sustainBtn);
        // Expect onExecuteAction to be called with a sustain action
        expect(mockOnExecuteAction).toHaveBeenCalledWith(expect.objectContaining({
            type: 'sustain',
            cost: { type: 'action' }
        }));
    });

     it('does not render sustain button if already sustained', () => {
        const concentratingChar: CombatCharacter = {
            ...mockCharacter,
            concentratingOn: {
                spellId: 'spell1',
                spellName: 'Bless',
                spellLevel: 1,
                startedTurn: 0,
                effectIds: [],
                canDropAsFreeAction: true,
                sustainedThisTurn: true, // Already sustained
                sustainCost: { actionType: 'action', optional: false }
            }
        };

        render(<ActionEconomyBar character={concentratingChar} onExecuteAction={mockOnExecuteAction} />);

        expect(screen.queryByText(/Sustain Bless/i)).not.toBeInTheDocument();
    });
});
