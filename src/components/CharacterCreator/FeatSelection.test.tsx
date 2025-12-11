import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FeatSelection from './FeatSelection';
import { Feat, AbilityScoreName } from '../../types';
import SpellContext from '../../context/SpellContext';

// Mock types
interface FeatOption extends Feat {
  isEligible: boolean;
  unmet: string[];
}

// Mock feats data
const mockFeats: FeatOption[] = [
  {
    id: 'elemental_adept',
    name: 'Elemental Adept',
    description: 'Test Description',
    isEligible: true,
    unmet: [],
    benefits: {
      selectableDamageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
    },
  },
  {
      id: 'alert',
      name: 'Alert',
      description: 'Test Alert',
      isEligible: true,
      unmet: [],
  }
];

describe('FeatSelection', () => {
  const mockOnSelectFeat = vi.fn();
  const mockOnSetFeatChoice = vi.fn();
  const mockOnConfirm = vi.fn();
  const mockDispatch = vi.fn();

  it('renders Elemental Adept and allows damage type selection', () => {
    const featChoices = {
        'elemental_adept': { selectedDamageType: undefined }
    };

    render(
      <SpellContext.Provider value={{}}>
        <FeatSelection
          availableFeats={mockFeats}
          selectedFeatId="elemental_adept"
          featChoices={featChoices}
          onSelectFeat={mockOnSelectFeat}
          onSetFeatChoice={mockOnSetFeatChoice}
          onConfirm={mockOnConfirm}
          hasEligibleFeats={true}
          dispatch={mockDispatch}
        />
      </SpellContext.Provider>
    );

    // Check if damage type selector is visible
    expect(screen.getByText('Select Damage Type:')).toBeInTheDocument();

    // Check if damage types are rendered
    expect(screen.getByText('Acid')).toBeInTheDocument();
    expect(screen.getByText('Fire')).toBeInTheDocument();

    // Click on a damage type
    fireEvent.click(screen.getByText('Fire'));
    expect(mockOnSetFeatChoice).toHaveBeenCalledWith('elemental_adept', 'selectedDamageType', 'Fire');
  });

  it('disables continue button if damage type is not selected', () => {
      const featChoices = {
          'elemental_adept': { selectedDamageType: undefined }
      };

      render(
        <SpellContext.Provider value={{}}>
          <FeatSelection
            availableFeats={mockFeats}
            selectedFeatId="elemental_adept"
            featChoices={featChoices}
            onSelectFeat={mockOnSelectFeat}
            onSetFeatChoice={mockOnSetFeatChoice}
            onConfirm={mockOnConfirm}
            hasEligibleFeats={true}
            dispatch={mockDispatch}
          />
        </SpellContext.Provider>
      );

      const continueButton = screen.getByText('Continue');
      expect(continueButton).toBeDisabled();
  });

  it('enables continue button if damage type is selected', () => {
    const featChoices = {
        'elemental_adept': { selectedDamageType: 'Fire' }
    };

    render(
      <SpellContext.Provider value={{}}>
        <FeatSelection
          availableFeats={mockFeats}
          selectedFeatId="elemental_adept"
          featChoices={featChoices}
          onSelectFeat={mockOnSelectFeat}
          onSetFeatChoice={mockOnSetFeatChoice}
          onConfirm={mockOnConfirm}
          hasEligibleFeats={true}
          dispatch={mockDispatch}
        />
      </SpellContext.Provider>
    );

    const continueButton = screen.getByText('Continue');
    expect(continueButton).not.toBeDisabled();
  });
});
