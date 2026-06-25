import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SkillSelection from './SkillSelection';
// TODO(lint-intent): 'Skill' is unused in this test; use it in the assertion path or remove it.
import { Skill as _Skill, AbilityScores, Class, Race, RacialSelectionData } from '../../types';

// Mock Tooltip since it might use complex logic or context
vi.mock('../ui/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Constants
const mockClass: Class = {
  id: 'cleric',
  name: 'Cleric',
  description: 'A priestly champion.',
  hitDie: 8,
  primaryAbility: ['Wisdom'],
  savingThrowProficiencies: ['Wisdom', 'Charisma'],
  skillProficienciesAvailable: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: [],
};

const wizardClass: Class = {
  id: 'wizard',
  name: 'Wizard',
  description: 'A scholarly magic-user.',
  hitDie: 6,
  primaryAbility: ['Intelligence'],
  savingThrowProficiencies: ['Intelligence', 'Wisdom'],
  skillProficienciesAvailable: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: [],
};

const mockAbilityScores: AbilityScores = {
  Strength: 10,
  Dexterity: 10,
  Constitution: 10,
  Intelligence: 10,
  Wisdom: 16,
  Charisma: 12,
};

const mockRace: Race = {
  id: 'human',
  name: 'Human',
  description: 'A human.',
  traits: [],
};

const mockRacialSelections: Record<string, RacialSelectionData> = {};

// Mock SKILLS_DATA which is imported in the component
// Since the component imports SKILLS_DATA from '../../constants', and we are running in vitest with proper module resolution,
// we rely on the actual constants file existing. If not, we would need to mock the module.
// Assuming the file exists and has content. If the component fails to render due to missing constant, we'll know.

describe('SkillSelection', () => {
  it('renders correctly', () => {
    render(
      <SkillSelection
        charClass={mockClass}
        abilityScores={mockAbilityScores}
        race={mockRace}
        racialSelections={mockRacialSelections}
        onSkillsSelect={() => {}}
        onBack={() => {}}
      />
    );

    // Check for title
    expect(screen.getByText('Select Skills')).toBeDefined();

    // Check for skill checkboxes (based on mockClass skills)
    // The skills available for cleric are: history, insight, medicine, persuasion, religion
    // We expect to find labels or text for them.
    // Note: The actual display name comes from SKILLS_DATA constant.
    // Assuming SKILLS_DATA has 'History', 'Insight', etc.
  });

  it('keeps background-granted class skills visible without counting them as class picks', () => {
    render(
      <SkillSelection
        charClass={wizardClass}
        abilityScores={mockAbilityScores}
        race={mockRace}
        racialSelections={mockRacialSelections}
        selectedBackground="sage"
        onSkillsSelect={() => {}}
        onBack={() => {}}
      />
    );

    const arcanaButton = screen.getByRole('button', { name: /Arcana/i });
    const historyButton = screen.getByRole('button', { name: /History/i });

    expect(within(arcanaButton).getByText('Background')).toBeInTheDocument();
    expect(within(historyButton).getByText('Background')).toBeInTheDocument();

    fireEvent.click(arcanaButton);

    expect(screen.getByText(/Selected:\s*0\s*\/\s*2/)).toBeInTheDocument();
  });
});
