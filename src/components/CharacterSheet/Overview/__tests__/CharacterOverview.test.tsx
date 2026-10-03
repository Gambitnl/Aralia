import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import CharacterOverview from '../CharacterOverview';
import { createMockPlayerCharacter } from '../../../../utils/core';
import { LIZARDFOLK_DATA } from '../../../../data/races/lizardfolk';
import { TABAXI_DATA } from '../../../../data/races/tabaxi';

// useCharacterProficiencies pulls real class/race data; stub it to keep the
// overview render focused on the GG-7 alternate-movement-speed display.
vi.mock('../../../../hooks/useCharacterProficiencies', () => ({
  useCharacterProficiencies: () => ({
    skills: [],
    tools: [],
    armor: [],
    weapons: [],
    languages: [],
  }),
}));

describe('CharacterOverview movement speeds (GG-7)', () => {
  // GG-259 changed the reader. The overview now calls
  // `getRacialMovementSpeedsForLevel`, which resolves a character's race
  // through the shared racial trait library BY ID so it can see each trait's
  // level window. An ad-hoc race object with invented trait prose therefore no
  // longer contributes, and this case used to pin exactly that: a lizardfolk
  // record carrying a climbing sentence the canonical lizardfolk never had.
  // Both modes are still covered, now from canonical races that really grant
  // them - swim from Lizardfolk, climb from Tabaxi's Cat's Claws.
  it('renders the canonical swim speed alongside base speed', () => {
    const character = createMockPlayerCharacter({
      finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      modifiers: { advantage: [], disadvantage: [], bonuses: [] },
      skills: [],
      race: LIZARDFOLK_DATA,
    });

    render(<CharacterOverview character={character} />);

    expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    expect(screen.getByText(/swim:/i)).toBeInTheDocument();
  });

  it('renders the canonical climbing speed alongside base speed', () => {
    const character = createMockPlayerCharacter({
      finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      modifiers: { advantage: [], disadvantage: [], bonuses: [] },
      skills: [],
      race: TABAXI_DATA,
    });

    render(<CharacterOverview character={character} />);

    expect(screen.getByText(/climb:/i)).toBeInTheDocument();
  });

  it('does not render the alternate-speed line when a race has walking speed only', () => {
    const character = createMockPlayerCharacter({
      finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      modifiers: { advantage: [], disadvantage: [], bonuses: [] },
      skills: [],
      race: { id: 'human', name: 'Human', description: '', traits: ['Speed: 30 feet'] },
    });

    render(<CharacterOverview character={character} />);

    expect(screen.queryByText(/swim:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/climb:/i)).not.toBeInTheDocument();
  });
it('shows heavy-armor speed penalty warning for characters with insufficient Strength (GG-19)', () => {
    const character = createMockPlayerCharacter({
      finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      modifiers: { advantage: [], disadvantage: [], bonuses: [] },
      skills: [],
      equippedItems: {
        Torso: {
          id: 'plate-armor',
          name: 'Plate Armor',
          type: 'armor',
          slot: 'Torso',
          weight: 65,
          armorCategory: 'Heavy',
          baseArmorClass: 18,
          addsDexterityModifier: false,
          strengthRequirement: 15,
        } as any,
      },
      race: { id: 'human', name: 'Human', description: '', traits: ['Speed: 30 feet'] },
    });

    render(<CharacterOverview character={character} />);

    // The warning icon "warning" text is rendered by material-symbols-outlined
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText(/Speed:/)).toBeInTheDocument();
  });
});
