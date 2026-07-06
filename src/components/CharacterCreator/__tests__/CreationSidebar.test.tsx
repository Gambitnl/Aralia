/**
 * This file verifies the character creator progress sidebar.
 *
 * The sidebar is the player's map through character creation: it shows which
 * choices are available, what has already been completed, and where Start Over
 * lives. These tests protect that navigation contract, including cramped mobile
 * windows where the step list must remain readable.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import CreationSidebar from '../CreationSidebar';
import { CreationStep, initialCharacterCreatorState } from '../state/characterCreatorState';
import type { Race } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================
// Test data keeps the sidebar assertions tied to the visible human-only step
// without depending on the full race catalog.
const humanRace: Race = {
  id: 'human',
  name: 'Human',
  description: 'Versatile and ambitious.',
  traits: [],
};

const originalOffsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

// Reset layout measurements after tests that emulate browser geometry for the
// sidebar auto-scroll effect.
afterEach(() => {
  if (originalOffsetTop) {
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', originalOffsetTop);
  }
  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  }
  if (originalClientHeight) {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
  }
});

// ============================================================================
// Sidebar Contract Tests
// ============================================================================
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

  it('marks the current step for the sidebar-only auto-scroll target', () => {
    render(
      <CreationSidebar
        currentStep={CreationStep.NameAndReview}
        state={{
          ...initialCharacterCreatorState,
          selectedRace: humanRace,
          characterName: 'Dero Frost',
        }}
        onNavigateToStep={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Name & Review/i })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('creation-sidebar-current-step')).toContainElement(
      screen.getByRole('button', { name: /Name & Review/i })
    );
  });

  it('reserves enough mobile height for the progress list to be readable', () => {
    render(
      <CreationSidebar
        currentStep={CreationStep.Race}
        state={initialCharacterCreatorState}
        onNavigateToStep={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Character creation progress')).toHaveClass('min-h-56');
  });

  it('auto-scrolls the current step relative to the step list viewport', () => {
    // Browser offsetTop values are relative to the nearest positioned ancestor,
    // not always the scroll container itself. This geometry matches the mobile
    // creator window where the current Race row begins just inside the list.
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get() {
        if (this.getAttribute('data-testid') === 'creation-sidebar-steps') return 61;
        if (this.getAttribute('data-testid') === 'creation-sidebar-current-step') return 69;
        return 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        if (this.getAttribute('data-testid') === 'creation-sidebar-current-step') return 36;
        return 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        if (this.getAttribute('data-testid') === 'creation-sidebar-steps') return 80;
        return 0;
      },
    });

    render(
      <CreationSidebar
        currentStep={CreationStep.Race}
        state={initialCharacterCreatorState}
        onNavigateToStep={vi.fn()}
      />
    );

    expect(screen.getByTestId('creation-sidebar-steps').scrollTop).toBe(0);
  });
});
