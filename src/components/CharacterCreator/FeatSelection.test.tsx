/**
 * @file FeatSelection.test.tsx
 * Focused tests for feat sub-choice setup in the Character Creator.
 */
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FeatSelection from './FeatSelection';
import SpellContext from '../../context/SpellContext';
import type { Feat } from '../../types';
import type { FeatChoiceState, FeatChoiceValue } from './state/characterCreatorState';

const motionComponent = (tag: keyof JSX.IntrinsicElements) => {
  return ({
    children,
    layout,
    layoutId,
    whileTap,
    whileHover,
    whileInView,
    initial,
    animate,
    exit,
    transition,
    variants,
    custom,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement(tag, props as React.HTMLAttributes<HTMLElement>, children);
};

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, key) => motionComponent(key as keyof JSX.IntrinsicElements),
  }),
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

const mockSpells = {
  get: vi.fn(),
  all: [],
  getByLevel: vi.fn(() => []),
  getByIds: vi.fn(() => []),
  getBySchool: vi.fn(() => []),
  // Test only needs a context shell; Slasher does not grant spell choices.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const slasherFeat: Feat & { isEligible: boolean; unmet: string[] } = {
  id: 'slasher',
  name: 'Slasher',
  description: 'Gain Strength or Dexterity +1 and add Slasher combat riders.',
  benefits: {
    abilityScoreIncrease: {},
    selectableAbilityScores: ['Strength', 'Dexterity'],
  },
  isEligible: true,
  unmet: [],
};

const renderSlasherFeatSelection = (onConfirm = vi.fn()) => {
  const Harness = () => {
    const [selectedFeatId, setSelectedFeatId] = useState('');
    const [featChoices, setFeatChoices] = useState<Record<string, FeatChoiceState>>({});

    const handleSetFeatChoice = (featId: string, choiceType: string, value: FeatChoiceValue) => {
      setFeatChoices(current => ({
        ...current,
        [featId]: {
          ...(current[featId] ?? {}),
          [choiceType]: value,
        },
      }));
    };

    return (
      <SpellContext.Provider value={mockSpells}>
        <FeatSelection
          availableFeats={[slasherFeat]}
          selectedFeatId={selectedFeatId}
          featChoices={featChoices}
          onSelectFeat={setSelectedFeatId}
          onSetFeatChoice={handleSetFeatChoice}
          onConfirm={onConfirm}
          hasEligibleFeats={true}
        />
        <output data-testid="slasher-asi">
          {featChoices.slasher?.selectedAbilityScore ?? ''}
        </output>
      </SpellContext.Provider>
    );
  };

  render(<Harness />);
};

describe('FeatSelection', () => {
  it('requires and records the Slasher Strength/Dexterity ability choice before confirmation', () => {
    const onConfirm = vi.fn();
    renderSlasherFeatSelection(onConfirm);

    fireEvent.click(screen.getByRole('button', { name: /Slasher/i }));

    const confirmButton = screen.getByRole('button', { name: 'Confirm Feat' });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByText('Complete your choices below to finalize this feat.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Strength +1' }));

    expect(screen.getByTestId('slasher-asi')).toHaveTextContent('Strength');
    const readyConfirmButton = screen.getByRole('button', { name: 'Confirm Feat' });
    expect(readyConfirmButton).not.toBeDisabled();

    fireEvent.click(readyConfirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
