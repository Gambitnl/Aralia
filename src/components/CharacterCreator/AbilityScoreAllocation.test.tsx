import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AbilityScoreAllocation from './AbilityScoreAllocation';
import { Race, Class as CharClass } from '../../types';

// Mock data
const mockRace: Race = {
  id: 'human',
  name: 'Human',
  description: 'Versatile and ambitious.',
  traits: [],
} as Race;

const mockClass: CharClass = {
  id: 'fighter',
  name: 'Fighter',
  description: 'A master of martial combat.',
  hitDie: 10,
  primaryAbility: ['Strength'],
  savingThrowProficiencies: ['Strength', 'Constitution'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: []
} as CharClass;

describe('AbilityScoreAllocation', () => {
  it('renders correctly', () => {
    const onAbilityScoresSet = vi.fn();
    const onBack = vi.fn();

    render(
      <AbilityScoreAllocation
        race={mockRace}
        selectedClass={mockClass}
        onAbilityScoresSet={onAbilityScoresSet}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Assign Ability Scores')).toBeDefined();
    expect(screen.getByText(/Points Available/)).toBeDefined();
  });
});
