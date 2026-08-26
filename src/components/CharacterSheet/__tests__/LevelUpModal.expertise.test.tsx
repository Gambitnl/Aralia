import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import LevelUpModal from '../LevelUpModal';
import { CLASSES_DATA } from '../../../data/classes';
import { createMockPlayerCharacter } from '../../../utils/core/factories';

/**
 * Guards the level-up Expertise picker (agora-db71.18).
 *
 * `skillModifierUtils` (PK-20) reads Expertise from
 * `featChoices[<sourceId>].selectedExpertiseSkills`, and nothing in the game
 * ever wrote that key: the bard's level-2 Expertise and the wizard's Scholar
 * feature arrived with no way to choose a skill, so the reader always found an
 * empty list. These tests assert the WRITE path — what the modal hands to
 * `onConfirm` — because that is the half that was missing.
 *
 * Depends on: LevelUpModal.tsx, tierOneFeatures.ts, skillModifierUtils.ts.
 */

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

/** A bard one XP-step from level 2, where the Expertise feature arrives. */
const bardToL2 = () =>
  createMockPlayerCharacter({
    class: CLASSES_DATA['bard'],
    level: 1,
    xp: 300,
    proficiencyBonus: 2,
    skills: [
      { id: 'persuasion', name: 'Persuasion', ability: 'Charisma' },
      { id: 'deception', name: 'Deception', ability: 'Charisma' },
      { id: 'performance', name: 'Performance', ability: 'Charisma' },
    ],
  });

describe('LevelUpModal Expertise picker (agora-db71.18)', () => {
  it('offers the bard Expertise choice at the level it arrives, limited to proficient skills', () => {
    render(<LevelUpModal isOpen character={bardToL2()} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText('Expertise: choose your Expertise')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Persuasion' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deception' })).toBeInTheDocument();
    // Athletics is a real skill the bard is not proficient in: doubling a
    // proficiency they do not have is worth nothing, so it is not offered.
    expect(screen.queryByRole('button', { name: 'Athletics' })).not.toBeInTheDocument();
  });

  it('blocks confirm until both picks are made, then writes selectedExpertiseSkills', () => {
    const onConfirm = vi.fn();
    render(<LevelUpModal isOpen character={bardToL2()} onClose={vi.fn()} onConfirm={onConfirm} />);

    const confirm = screen.getByRole('button', { name: /Confirm Level Up/i });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Persuasion' }));
    // One of two: still incomplete.
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Deception' }));
    expect(confirm).not.toBeDisabled();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].featChoices).toEqual({
      expertise: { selectedExpertiseSkills: ['persuasion', 'deception'] },
    });
  });

  it('caps the picks at the feature allowance and lets a pick be taken back', () => {
    const onConfirm = vi.fn();
    render(<LevelUpModal isOpen character={bardToL2()} onClose={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Persuasion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deception' }));
    // A third click must not land: the bard chooses two.
    fireEvent.click(screen.getByRole('button', { name: 'Performance' }));
    expect(screen.getByRole('button', { name: 'Performance' })).toHaveAttribute('aria-pressed', 'false');

    // Re-clicking a chosen skill releases it.
    fireEvent.click(screen.getByRole('button', { name: 'Deception' }));
    expect(screen.getByRole('button', { name: 'Deception' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Confirm Level Up/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Performance' }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Level Up/i }));
    expect(onConfirm.mock.calls[0][0].featChoices).toEqual({
      expertise: { selectedExpertiseSkills: ['persuasion', 'performance'] },
    });
  });

  it('does not offer a picker to a class whose level has no Expertise feature', () => {
    const fighter = createMockPlayerCharacter({
      class: CLASSES_DATA['fighter'],
      level: 1,
      xp: 300,
      skills: [{ id: 'athletics', name: 'Athletics', ability: 'Strength' }],
    });
    render(<LevelUpModal isOpen character={fighter} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.queryByText(/choose your Expertise/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Level Up/i })).not.toBeDisabled();
  });
});
