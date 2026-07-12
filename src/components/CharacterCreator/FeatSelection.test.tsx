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

// These focused feat records keep the test on the Character Creator contract:
// a selected feat must expose every required sub-choice before the player can
// confirm it into the creator state.
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

const elementalAdeptFeat: Feat & { isEligible: boolean; unmet: string[] } = {
  id: 'elemental_adept',
  name: 'Elemental Adept',
  description: 'Choose an ability score and a damage type for your spell affinity.',
  benefits: {
    abilityScoreIncrease: {},
    selectableAbilityScores: ['Intelligence', 'Wisdom', 'Charisma'],
    selectableDamageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
  },
  isEligible: true,
  unmet: [],
};

const renderFeatSelection = (
  availableFeats: Array<Feat & { isEligible: boolean; unmet: string[] }>,
  outputFeatId: string,
  outputChoiceKey: keyof FeatChoiceState,
  onConfirm = vi.fn(),
) => {
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
          availableFeats={availableFeats}
          selectedFeatId={selectedFeatId}
          featChoices={featChoices}
          onSelectFeat={setSelectedFeatId}
          onSetFeatChoice={handleSetFeatChoice}
          onConfirm={onConfirm}
          hasEligibleFeats={true}
        />
        <output data-testid={`${outputFeatId}-${String(outputChoiceKey)}`}>
          {String(featChoices[outputFeatId]?.[outputChoiceKey] ?? '')}
        </output>
      </SpellContext.Provider>
    );
  };

  render(<Harness />);
};

const renderSlasherFeatSelection = (onConfirm = vi.fn()) => {
  renderFeatSelection([slasherFeat], 'slasher', 'selectedAbilityScore', onConfirm);
};

const renderElementalAdeptFeatSelection = (onConfirm = vi.fn()) => {
  renderFeatSelection([elementalAdeptFeat], 'elemental_adept', 'selectedDamageType', onConfirm);
};

describe('FeatSelection', () => {
  it('keeps a preselected required feat active when its setup card is clicked', () => {
    const RequiredFeatHarness = () => {
      const [selectedFeatId, setSelectedFeatId] = useState('slasher');
      const [featChoices, setFeatChoices] = useState<Record<string, FeatChoiceState>>({});

      // This mirrors a background-provided feat: the slot is mandatory and the
      // player arrives with the feat selected but its sub-choice unfinished.
      return (
        <SpellContext.Provider value={mockSpells}>
          <FeatSelection
            availableFeats={[slasherFeat]}
            selectedFeatId={selectedFeatId}
            featChoices={featChoices}
            onSelectFeat={setSelectedFeatId}
            onSetFeatChoice={(featId, choiceType, value) => {
              setFeatChoices(current => ({
                ...current,
                [featId]: { ...(current[featId] ?? {}), [choiceType]: value },
              }));
            }}
            onConfirm={vi.fn()}
            hasEligibleFeats={true}
            allowSkip={false}
          />
        </SpellContext.Provider>
      );
    };

    render(<RequiredFeatHarness />);
    expect(screen.getByRole('button', { name: 'Strength +1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Slasher/i }));

    // The setup choices remain available instead of vanishing behind a
    // disabled Confirm button with no visible recovery path.
    expect(screen.getByRole('button', { name: 'Strength +1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dexterity +1' })).toBeInTheDocument();
  });

  it('requires and records the Slasher Strength/Dexterity ability choice before confirmation', () => {
    const onConfirm = vi.fn();
    renderSlasherFeatSelection(onConfirm);

    fireEvent.click(screen.getByRole('button', { name: /Slasher/i }));

    const confirmButton = screen.getByRole('button', { name: 'Confirm Feat' });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByText('Complete your choices below to finalize this feat.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Strength +1' }));

    expect(screen.getByTestId('slasher-selectedAbilityScore')).toHaveTextContent('Strength');
    const readyConfirmButton = screen.getByRole('button', { name: 'Confirm Feat' });
    expect(readyConfirmButton).not.toBeDisabled();

    fireEvent.click(readyConfirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('requires and records the Elemental Adept damage type choice before confirmation', () => {
    const onConfirm = vi.fn();
    renderElementalAdeptFeatSelection(onConfirm);

    fireEvent.click(screen.getByRole('button', { name: /Elemental Adept/i }));

    const confirmButton = screen.getByRole('button', { name: 'Confirm Feat' });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByText('Complete your choices below to finalize this feat.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Intelligence +1' }));
    expect(screen.getByRole('button', { name: 'Acid' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fire' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thunder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Feat' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Fire' }));

    expect(screen.getByTestId('elemental_adept-selectedDamageType')).toHaveTextContent('Fire');
    const readyConfirmButton = screen.getByRole('button', { name: 'Confirm Feat' });
    expect(readyConfirmButton).not.toBeDisabled();

    fireEvent.click(readyConfirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
