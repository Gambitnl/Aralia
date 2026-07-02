import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillClarificationPane } from '../SkillClarificationPane';

const CANDIDATES = [
  { name: 'Persuasion', ability: 'Charisma' as const, proficient: true, modifier: 5 },
  { name: 'Deception', ability: 'Charisma' as const, proficient: false, modifier: -1 },
];

describe('SkillClarificationPane', () => {
  it('lists candidates with modifiers and flags proficiency', () => {
    render(<SkillClarificationPane candidates={CANDIDATES} onPick={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Persuasion')).toBeTruthy();
    expect(screen.getByText('+5')).toBeTruthy();
    expect(screen.getByTestId('skill-proficient-Persuasion')).toBeTruthy();
    expect(screen.queryByTestId('skill-proficient-Deception')).toBeNull();
  });
  it('calls onPick with the chosen candidate', () => {
    const onPick = vi.fn();
    render(<SkillClarificationPane candidates={CANDIDATES} onPick={onPick} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId('skill-pick-Deception'));
    expect(onPick).toHaveBeenCalledWith(CANDIDATES[1]);
  });
});
