import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SkillDetailDisplay from '../SkillDetailDisplay';
import { createMockPlayerCharacter } from '../../../../utils/core/factories';

/**
 * Guards agora-db71.18: the detail overlay must agree with the Skills tab.
 *
 * Until this packet, this view hard-coded a +2 proficiency bonus and declared
 * `expertiseBonus = 0`, so a level-5 rogue with Expertise in Stealth read
 * "+2 / N/A / +5" here and "+4 / +4 / +11" one tab away on the same sheet. Both
 * numbers now come from the sources SkillsTab uses — the character's own
 * `proficiencyBonus` and `calculateExpertiseBonus` over `featChoices` (PK-20).
 *
 * Depends on: SkillDetailDisplay.tsx, skillModifierUtils.ts.
 */

const scoresWithDex16 = {
  Strength: 10,
  Dexterity: 16,
  Constitution: 10,
  Intelligence: 10,
  Wisdom: 10,
  Charisma: 10,
};

const rowFor = (skillName: string): HTMLElement => {
  const row = screen.getByText(skillName).closest('tr');
  if (!row) throw new Error(`No row for ${skillName}`);
  return row;
};

describe('SkillDetailDisplay - expertise and proficiency (agora-db71.18)', () => {
  it('reads the expertise pick from featChoices and doubles the proficiency bonus', () => {
    const character = createMockPlayerCharacter({
      finalAbilityScores: scoresWithDex16,
      proficiencyBonus: 4,
      skills: [
        { id: 'stealth', name: 'Stealth', ability: 'Dexterity' },
        { id: 'acrobatics', name: 'Acrobatics', ability: 'Dexterity' },
      ],
      featChoices: { skill_expert: { selectedExpertiseSkills: ['Stealth'] } },
    });

    render(<SkillDetailDisplay isOpen onClose={vi.fn()} character={character} />);

    // Dex 16 -> +3; proficiency +4 from the character, not a hard-coded 2;
    // expertise adds another +4, so the total is +11.
    const stealth = rowFor('Stealth');
    // Columns: skill | mod | proficiency | expertise | total | notes.
    expect(stealth.children[2]).toHaveTextContent('+4');
    expect(stealth.children[3]).toHaveTextContent('+4');
    expect(stealth.children[4]).toHaveTextContent('+11');

    // Acrobatics is proficient but was not picked: +3 +4 = +7, no expertise.
    const acrobatics = rowFor('Acrobatics');
    expect(acrobatics.children[4]).toHaveTextContent('+7');
    expect(acrobatics.children[3]).toHaveTextContent('N/A');
  });

  it('grants no expertise on a skill the character is not proficient in', () => {
    // `calculateExpertiseBonus` returns 0 without proficiency: doubling nothing
    // is nothing, and the view must not invent a bonus the roll will not get.
    const character = createMockPlayerCharacter({
      finalAbilityScores: scoresWithDex16,
      proficiencyBonus: 4,
      skills: [],
      featChoices: { skill_expert: { selectedExpertiseSkills: ['Stealth'] } },
    });

    render(<SkillDetailDisplay isOpen onClose={vi.fn()} character={character} />);

    const stealth = rowFor('Stealth');
    expect(stealth.children[4]).toHaveTextContent('+3');
    expect(stealth.children[3]).toHaveTextContent('N/A');
  });

  it('falls back to +2 proficiency only when the sheet stores none', () => {
    const character = createMockPlayerCharacter({
      finalAbilityScores: scoresWithDex16,
      proficiencyBonus: undefined as unknown as number,
      skills: [{ id: 'stealth', name: 'Stealth', ability: 'Dexterity' }],
    });

    render(<SkillDetailDisplay isOpen onClose={vi.fn()} character={character} />);

    expect(rowFor('Stealth').children[4]).toHaveTextContent('+5');
  });
});
