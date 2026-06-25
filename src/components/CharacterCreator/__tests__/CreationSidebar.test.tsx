import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CreationSidebar from '../CreationSidebar';
import { CreationStep, initialCharacterCreatorState } from '../state/characterCreatorState';
import type { Race } from '../../../types';

// Test data keeps the sidebar assertions tied to the visible human-only step
// without depending on the full race catalog.
const humanRace: Race = {
  id: 'human',
  name: 'Human',
  description: 'Versatile and ambitious.',
  traits: [],
};

describe('CreationSidebar', () => {
  it('allows navigating to an incomplete step via click', () => {
    const onNavigateToStep = vi.fn();

    render(
      <CreationSidebar
        currentStep={CreationStep.Race}
        state={initialCharacterCreatorState}
        onNavigateToStep={onNavigateToStep}
      />
    );

    const ageButton = screen.getByRole('button', { name: /\bAge\b/i });
    expect(ageButton).toBeEnabled();

    fireEvent.click(ageButton);
    expect(onNavigateToStep).toHaveBeenCalledWith(CreationStep.AgeSelection);
  });

  it('hides the racial feat step until a human lineage is selected', () => {
    render(
      <CreationSidebar
        currentStep={CreationStep.Race}
        state={initialCharacterCreatorState}
        onNavigateToStep={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /\bRacial Feat\b/i })).not.toBeInTheDocument();
  });

  it('shows and allows navigating to the racial feat step for human lineage', () => {
    const onNavigateToStep = vi.fn();
    const humanState = {
      ...initialCharacterCreatorState,
      selectedRace: humanRace,
    };

    render(
      <CreationSidebar
        currentStep={CreationStep.Race}
        state={humanState}
        onNavigateToStep={onNavigateToStep}
      />
    );

    const featButton = screen.getByRole('button', { name: /\bRacial Feat\b/i });
    expect(featButton).toBeEnabled();

    fireEvent.click(featButton);
    expect(onNavigateToStep).toHaveBeenCalledWith(CreationStep.RacialFeatSelection);
  });

  it('does not count future default-complete steps in the progress total', () => {
    render(
      <CreationSidebar
        currentStep={CreationStep.Race}
        state={{
          ...initialCharacterCreatorState,
          selectedRace: humanRace,
        }}
        onNavigateToStep={vi.fn()}
      />
    );

    expect(screen.getByText('1 / 10 steps complete')).toBeInTheDocument();
  });
});
