
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AbilityButton from '../AbilityButton';
import { Ability } from '../../../types/combat';
import { SpellSchool } from '@/types/spells';

describe('AbilityButton', () => {
    const mockOnSelect = vi.fn();

    const mockAbility: Ability = {
        id: 'fireball',
        name: 'Fireball',
        description: 'Explosion',
        type: 'spell',
        cost: { type: 'action' },
        targeting: 'area',
        range: 120,
        effects: [],
        spell: {
            id: 'fireball',
            name: 'Fireball',
            level: 3,
            school: SpellSchool.Evocation,
            classes: ['Wizard'],
            description: 'Explosion',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 120 },
            components: { verbal: true, somatic: true, material: true },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'area', range: 120, areaOfEffect: { shape: 'Sphere', size: 20 } },
            effects: []
        }
    };

    it('renders with spell visual fallback when icon is missing', () => {
        render(<AbilityButton ability={mockAbility} onSelect={mockOnSelect} isDisabled={false} />);

        // Should find the fallback icon for Evocation (Fire)
        expect(screen.getByText('🔥')).toBeInTheDocument();

        // Should have accessible label matching the updated format "Label (School), Cost cost"
        // Note: AbilityButton adds visual label which includes school
        expect(screen.getByLabelText(/Fireball \(Evocation\), Action cost/)).toBeInTheDocument();
    });

    it('uses provided icon if present', () => {
        const iconAbility = { ...mockAbility, icon: '🧨' };
        render(<AbilityButton ability={iconAbility} onSelect={mockOnSelect} isDisabled={false} />);

        expect(screen.getByText('🧨')).toBeInTheDocument();
        expect(screen.queryByText('🔥')).not.toBeInTheDocument();
    });

    it('calls onSelect when clicked', () => {
        render(<AbilityButton ability={mockAbility} onSelect={mockOnSelect} isDisabled={false} />);
        fireEvent.click(screen.getByRole('button'));
        expect(mockOnSelect).toHaveBeenCalled();
    });

    it('shows cooldown overlay', () => {
        const cooldownAbility = { ...mockAbility, currentCooldown: 2 };
        render(<AbilityButton ability={cooldownAbility} onSelect={mockOnSelect} isDisabled={false} />);

        expect(screen.getByText('2')).toBeInTheDocument();
    });
});
