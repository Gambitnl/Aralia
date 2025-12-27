
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ActionEconomyBar from '../ActionEconomyBar';
import { CombatCharacter } from '../../../types/combat';

describe('ActionEconomyBar', () => {
    const mockOnExecuteAction = vi.fn();

    const mockCharacter: CombatCharacter = {
        id: 'char1',
        name: 'Hero',
        type: 'player',
        team: 'player',
        hp: 10,
        maxHp: 10,
        ac: 15,
        speed: 30,
        position: { x: 0, y: 0, z: 0 },
        initiative: 10,
        actionEconomy: {
            action: { used: false, total: 1 },
            bonusAction: { used: false, total: 1 },
            reaction: { used: false, total: 1 },
            movement: { used: 0, total: 30 }
        },
        abilities: [],
        conditions: [],
        resistances: {},
        stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        isDead: false,
        visual: { color: 'red', model: 'warrior' }
    };

    it('renders indicators for action, bonus, and reaction', () => {
        render(<ActionEconomyBar character={mockCharacter} onExecuteAction={mockOnExecuteAction} />);

        expect(screen.getByLabelText('Action')).toBeInTheDocument();
        expect(screen.getByLabelText('Bonus Action')).toBeInTheDocument();
        expect(screen.getByLabelText('Reaction')).toBeInTheDocument();
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
                level: 1,
                sourceId: 'char1',
                startTime: 0,
                sustainedThisTurn: false,
                sustainCost: { actionType: 'action' }
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
                level: 1,
                sourceId: 'char1',
                startTime: 0,
                sustainedThisTurn: true, // Already sustained
                sustainCost: { actionType: 'action' }
            }
        };

        render(<ActionEconomyBar character={concentratingChar} onExecuteAction={mockOnExecuteAction} />);

        expect(screen.queryByText(/Sustain Bless/i)).not.toBeInTheDocument();
    });
});
