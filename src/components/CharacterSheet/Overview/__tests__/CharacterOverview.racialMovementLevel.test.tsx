/**
 * Level-aware racial movement on the character sheet (GG-259).
 *
 * The overview used to call `deriveAlternateMovementSpeeds`, which reads every
 * race trait at once with no level to judge them by. A level-1 Dragonborn was
 * therefore shown a flying speed from Draconic Flight, a trait that does not
 * start until level 5. The overview now calls `getRacialMovementSpeedsForLevel`.
 *
 * These cases pin both ends of that window on the rendered sheet, not just in
 * the helper, so re-wiring the overview back to the level-blind reader fails
 * here.
 *
 * Called by: focused CharacterSheet Vitest checks.
 * Depends on: CharacterOverview and the canonical Dragonborn race record.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import CharacterOverview from '../CharacterOverview';
import { createMockPlayerCharacter } from '../../../../utils/core';
import { DRAGONBORN_DATA } from '../../../../data/races/dragonborn';

// useCharacterProficiencies pulls real class/race data; stub it so this render
// stays about the movement line.
vi.mock('../../../../hooks/useCharacterProficiencies', () => ({
  useCharacterProficiencies: () => ({
    skills: [],
    tools: [],
    armor: [],
    weapons: [],
    languages: [],
  }),
}));

const dragonbornAt = (level: number) => createMockPlayerCharacter({
  level,
  finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
  resistances: [],
  immunities: [],
  vulnerabilities: [],
  modifiers: { advantage: [], disadvantage: [], bonuses: [] },
  skills: [],
  race: DRAGONBORN_DATA,
});

describe('CharacterOverview racial movement is level-aware (GG-259)', () => {
  it('does not show a flying speed to a level-1 Dragonborn', () => {
    render(<CharacterOverview character={dragonbornAt(1)} />);

    expect(screen.queryByText(/fly:/i)).not.toBeInTheDocument();
  });

  it('shows the Draconic Flight speed once the character reaches level 5', () => {
    render(<CharacterOverview character={dragonbornAt(5)} />);

    expect(screen.getByText(/fly:/i)).toBeInTheDocument();
  });
});
