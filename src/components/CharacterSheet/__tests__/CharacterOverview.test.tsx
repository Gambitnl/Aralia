import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import CharacterOverview from '../Overview/CharacterOverview';
import { createMockPlayerCharacter } from '../../../utils/factories';

describe('CharacterOverview', () => {
  it('renders character vitals', () => {
    const character = createMockPlayerCharacter({
      hp: 15,
      maxHp: 20,
      armorClass: 12,
      speed: 30,
    });

    render(
      <CharacterOverview character={character} />
    );

    expect(screen.getByText('Vitals')).toBeDefined();
    expect(screen.getByText(/Hit Points:/)).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
    expect(screen.getByText('Armor Class:')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
  });

  it('renders spellcasting section if character has spellcasting ability', () => {
    const character = createMockPlayerCharacter({
      spellcastingAbility: 'intelligence',
      finalAbilityScores: {
        Strength: 10,
        Dexterity: 10,
        Constitution: 10,
        Intelligence: 16,
        Wisdom: 10,
        Charisma: 10,
      },
      proficiencyBonus: 3,
    });

    render(
      <CharacterOverview character={character} />
    );

    expect(screen.getByText('Spellcasting')).toBeDefined();
    expect(screen.getByText(/Int\s*\(\+3\)/)).toBeDefined();
    // Save DC: 8 + 3 (prof) + 3 (mod) = 14
    expect(screen.getByText('14')).toBeDefined();
  });
});
