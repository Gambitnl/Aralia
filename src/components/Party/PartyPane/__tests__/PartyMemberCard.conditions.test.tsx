/**
 * @file PartyMemberCard.conditions.test.tsx
 * PRV6: the roster card must surface a member's active status conditions
 * (starving / fatigued / poisoned from travel) — kept in its own file so the
 * main PartyMemberCard suite stays untouched in the shared checkout.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PartyMemberCard from '../PartyMemberCard';
import { PlayerCharacter } from '../../../../types';

vi.mock('@/utils/character', () => ({
    validateCharacterChoices: () => [],
}));

const baseCharacter = (): PlayerCharacter => ({
    id: 'char1',
    name: 'Aethelgard',
    race: { name: 'Elf', id: 'elf', description: '', traits: [] },
    class: {
        name: 'Wizard',
        id: 'wizard',
        description: '',
        hitDie: 6,
        primaryAbility: ['Intelligence'],
        savingThrowProficiencies: ['Intelligence', 'Wisdom'],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 2,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: [],
    },
    level: 3,
    hp: 15,
    maxHp: 24,
    armorClass: 12,
    abilityScores: { Strength: 10, Dexterity: 14, Constitution: 12, Intelligence: 16, Wisdom: 12, Charisma: 10 },
    finalAbilityScores: { Strength: 10, Dexterity: 14, Constitution: 12, Intelligence: 16, Wisdom: 12, Charisma: 10 },
    skills: [],
    proficiencyBonus: 2,
    speed: 30,
    darkvisionRange: 60,
    transportMode: 'foot',
    equippedItems: {},
    statusEffects: [],
    hitPointDice: [{ die: 6, max: 3, current: 2 }],
} as unknown as PlayerCharacter);

const renderCard = (conditions?: string[]) => {
    const character = { ...baseCharacter(), conditions };
    return render(
        <PartyMemberCard
            character={character}
            onMoreClick={vi.fn()}
            onMissingChoiceClick={vi.fn()}
        />,
    );
};

describe('PartyMemberCard conditions (PRV6)', () => {
    it('shows a chip for each active condition', () => {
        renderCard(['starving', 'poisoned']);
        expect(screen.getByText('Starving')).toBeInTheDocument();
        expect(screen.getByText('Poisoned')).toBeInTheDocument();
    });

    it('renders no condition strip for a healthy member', () => {
        renderCard([]);
        expect(screen.queryByTestId('condition-chips')).not.toBeInTheDocument();
    });

    it('tolerates a character with no conditions field at all', () => {
        renderCard(undefined);
        expect(screen.queryByTestId('condition-chips')).not.toBeInTheDocument();
    });
});
