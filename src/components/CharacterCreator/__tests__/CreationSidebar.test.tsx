import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CreationSidebar from '../CreationSidebar';
import { CreationStep, initialCharacterCreatorState } from '../state/characterCreatorState';

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

    const ageButton = screen.getByRole('button', { name: /^Age\b/i });
    expect(ageButton).toBeEnabled();

    fireEvent.click(ageButton);
    expect(onNavigateToStep).toHaveBeenCalledWith(CreationStep.AgeSelection);
  });

  it('shows and allows navigating to the feat step before reaching it', () => {
    const onNavigateToStep = vi.fn();

    render(
      <CreationSidebar
        currentStep={CreationStep.Race}
        state={initialCharacterCreatorState}
        onNavigateToStep={onNavigateToStep}
      />
    );

    const featButton = screen.getByRole('button', { name: 'Feat' });
    expect(featButton).toBeEnabled();

    fireEvent.click(featButton);
    expect(onNavigateToStep).toHaveBeenCalledWith(CreationStep.FeatSelection);
  });
});
