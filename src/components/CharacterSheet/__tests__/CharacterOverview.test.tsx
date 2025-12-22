import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import CharacterOverview from '../CharacterOverview';
import { createMockPlayerCharacter } from '../../../utils/factories';

describe('CharacterOverview', () => {
  const mockOnOpenSkillDetails = vi.fn();

  it('renders character vitals', () => {
    const character = createMockPlayerCharacter({
      hp: 15,
      maxHp: 20,
      armorClass: 12,
      speed: 30,
    });

    render(
      <CharacterOverview 
        character={character} 
        onOpenSkillDetails={mockOnOpenSkillDetails} 
      />
    );

    expect(screen.getByText('Vitals')).toBeDefined();
    expect(screen.getByText(/Hit Points:/)).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
    expect(screen.getByText('Armor Class:')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
  });

  it('calls onOpenSkillDetails when button is clicked', () => {
    const character = createMockPlayerCharacter();

    render(
      <CharacterOverview 
        character={character} 
        onOpenSkillDetails={mockOnOpenSkillDetails} 
      />
    );

    const button = screen.getByText('View Skill Details');
    fireEvent.click(button);

    expect(mockOnOpenSkillDetails).toHaveBeenCalled();
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
      proficiencyBonus: 2,
    });

    render(
      <CharacterOverview 
        character={character} 
        onOpenSkillDetails={mockOnOpenSkillDetails} 
      />
    );

    expect(screen.getByText('Spellcasting')).toBeDefined();
    expect(screen.getByText('Intelligence')).toBeDefined();
    // Save DC: 8 + 2 (prof) + 3 (mod) = 13
    expect(screen.getByText('13')).toBeDefined();
  });
});
