import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SkillsTab from '../SkillsTab';
import { createMockPlayerCharacter } from '../../../../utils/core/factories';
import { PlayerCharacter } from '../../../../types/character';
import { BLESSING_EFFECTS } from '../../../../data/religion/blessings';

describe('SkillsTab', () => {
  it('leaves the expertise column empty for a character who has not been granted expertise', () => {
    // The sheet reads expertise picks from featChoices (agora-7601). A character
    // with no such pick shows proficiency only, and the expertise cell stays a dash.
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

    // Dex 16 -> +3, proficient -> +2, no expertise pick, so the total
    // remains +5 and the expertise cell stays as the placeholder dash.
    expect(within(stealthRow).getByText('+3')).toBeInTheDocument();
    expect(within(stealthRow).getByText('+2')).toBeInTheDocument();
    expect(within(stealthRow).getByText('+5')).toBeInTheDocument();
    expect(stealthRow.children[3]).toHaveTextContent('-');
  });

  it('doubles the proficiency bonus on a skill the character has expertise in', () => {
    // agora-7601: a recorded expertise pick reaches the total, and only the
    // picked skill. Acrobatics is proficient too, so the row proves the pick is
    // read per skill rather than applied to every proficiency.
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
        { id: 'acrobatics', name: 'Acrobatics', ability: 'Dexterity' },
      ],
      featChoices: {
        skill_expert: { selectedExpertiseSkills: ['Stealth'] },
      },
    });

    render(<SkillsTab character={character} />);

    const table = within(screen.getByTestId('skills-table-scroll'));
    const stealthRow = table.getByText('Stealth').closest('tr');
    const acrobaticsRow = table.getByText('Acrobatics').closest('tr');

    expect(stealthRow).not.toBeNull();
    expect(acrobaticsRow).not.toBeNull();
    if (!stealthRow || !acrobaticsRow) {
      return;
    }

    // Dex 16 -> +3, proficient -> +2, expertise -> +2 more, total +7.
    expect(stealthRow.children[3]).toHaveTextContent('+2');
    expect(within(stealthRow).getByText('+7')).toBeInTheDocument();

    // Acrobatics is proficient but was not picked, so it stays at +5.
    expect(acrobaticsRow.children[3]).toHaveTextContent('-');
    expect(within(acrobaticsRow).getByText('+5')).toBeInTheDocument();
  });

  it('names a divine blessing in the notes when it grants advantage on a skill', () => {
    // agora-0a28: the sheet reads the same structured rider the check resolver
    // reads, so it cannot promise an advantage the roll will not grant.
    const character = createMockPlayerCharacter({
      proficiencyBonus: 2,
      skills: [],
      // The repo carries two StatusEffect shapes; religionReducer bridges them the
      // same way when it grants a blessing.
      statusEffects: [BLESSING_EFFECTS['blessing_scales_of_justice'].effect] as unknown as PlayerCharacter['statusEffects'],
    });

    render(<SkillsTab character={character} />);

    const table = within(screen.getByTestId('skills-table-scroll'));
    const insightRow = table.getByText('Insight').closest('tr');
    const perceptionRow = table.getByText('Perception').closest('tr');

    expect(insightRow).not.toBeNull();
    expect(perceptionRow).not.toBeNull();
    if (!insightRow || !perceptionRow) {
      return;
    }

    expect(within(insightRow).getByText('Advantage (Scales of Justice)')).toBeInTheDocument();
    // Perception is also a Wisdom skill; the blessing must not widen to it.
    expect(perceptionRow.children[5]).toHaveTextContent('-');
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
