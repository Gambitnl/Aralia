
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
            subClasses: [],
            subClassesVerification: 'unverified',
            description: 'Explosion',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 120 },
            components: { verbal: true, somatic: true, material: true },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'area', range: 120, areaOfEffect: { shape: 'Sphere', size: 20 }, validTargets: ['creatures'] },
            effects: []
        }
    };

    it('renders a generated SVG spell visual when icon is missing', () => {
        const { container } = render(<AbilityButton ability={mockAbility} onSelect={mockOnSelect} isDisabled={false} />);

        // Spell buttons now use the combat SVG pack instead of relying on an
        // emoji fallback. The empty alt keeps the decorative image out of the
        // accessible name, which still comes from the button label.
        const icon = container.querySelector('img');
        expect(icon).toBeInTheDocument();
        expect(icon?.getAttribute('src')).toContain('data:image/svg+xml');

        // Should have accessible label matching the updated format "Label (School), Cost cost"
        // Note: AbilityButton adds visual label which includes school
        expect(screen.getByLabelText(/Fireball \(Evocation\), Action cost/)).toBeInTheDocument();
    });

    it('keeps a provided icon for a custom non-spell utility', () => {
        const iconAbility: Ability = {
            ...mockAbility,
            id: 'custom_tool',
            name: 'Custom Tool',
            type: 'utility',
            spell: undefined,
            icon: '🧨',
            effects: []
        };
        render(<AbilityButton ability={iconAbility} onSelect={mockOnSelect} isDisabled={false} />);

        expect(screen.getByText('🧨')).toBeInTheDocument();
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

    it('warns when a weapon attack is not proficient', () => {
        const weaponAbility: Ability = {
            ...mockAbility,
            id: 'attack_greatsword',
            name: 'Greatsword',
            description: 'Attack with Greatsword.',
            type: 'attack',
            spell: undefined,
            icon: 'âš”ï¸',
            range: 1,
            weapon: {
                id: 'greatsword',
                name: 'Greatsword',
                type: 'weapon',
                weight: 6,
                value: 50,
                description: 'A heavy blade.',
                quantity: 1,
                damageDice: '2d6',
                damageType: 'slashing',
                category: 'Martial'
            },
            isProficient: false
        };

        render(<AbilityButton ability={weaponAbility} onSelect={mockOnSelect} isDisabled={false} />);

        expect(screen.getByText('!')).toBeInTheDocument();
        expect(screen.getByRole('button')).toHaveAccessibleName(/warning: No proficiency bonus or weapon mastery on this attack/);
    });
});
