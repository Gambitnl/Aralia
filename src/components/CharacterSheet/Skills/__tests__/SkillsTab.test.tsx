import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SkillsTab from '../SkillsTab';
import { createMockPlayerCharacter } from '../../../../utils/core/factories';

describe('SkillsTab', () => {
  it('keeps the expertise column at zero until the character model exposes expertise state', () => {
    // This test pins the current contract: the sheet can show skill proficiency
    // totals, but it does not yet source a separate expertise value from the
    // character model.
    const character = createMockPlayerCharacter({
      finalAbilityScores: {
        Strength: 10,
        Dexterity: 16,
        Constitution: 10,
        Intelligence: 10,
        Wisdom: 10,
        Charisma: 10,
      },
      proficiencyBonus: 2,
      skills: [
        { id: 'stealth', name: 'Stealth', ability: 'Dexterity' },
      ],
    });

    render(<SkillsTab character={character} />);

    const stealthRow = within(screen.getByTestId('skills-table-scroll')).getByText('Stealth').closest('tr');

    expect(stealthRow).not.toBeNull();
    if (!stealthRow) {
      return;
    }

    // Dex 16 -> +3, proficient -> +2, expertise is still absent, so the total
    // remains +5 and the expertise cell stays as the placeholder dash.
    expect(within(stealthRow).getByText('+3')).toBeInTheDocument();
    expect(within(stealthRow).getByText('+2')).toBeInTheDocument();
    expect(within(stealthRow).getByText('+5')).toBeInTheDocument();
    expect(stealthRow.children[3]).toHaveTextContent('-');
  });

  it('uses compact skill cards on phone-width sheets and keeps the table scrollable on wider sheets', () => {
    const character = createMockPlayerCharacter({
      finalAbilityScores: {
        Strength: 10,
        Dexterity: 16,
        Constitution: 10,
        Intelligence: 10,
        Wisdom: 10,
        Charisma: 10,
      },
      proficiencyBonus: 2,
      skills: [
        { id: 'stealth', name: 'Stealth', ability: 'Dexterity' },
      ],
    });

    render(<SkillsTab character={character} />);

    const compactList = screen.getByTestId('skills-compact-list');
    const tableScroll = screen.getByTestId('skills-table-scroll');

    expect(compactList).toHaveClass('min-[521px]:hidden');
    expect(tableScroll).toHaveClass('max-[520px]:hidden', 'overflow-x-auto');
    expect(within(compactList).getByText('Stealth', { exact: false })).toBeInTheDocument();
    expect(within(compactList).getByText('+5')).toBeInTheDocument();
  });
});
