
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EncounterModal from '../Combat/EncounterModal';
// TODO(lint-intent): 't' is unused in this test; use it in the assertion path or remove it.
import { t as _t } from '../../utils/i18n';

// Mock i18n
vi.mock('../../utils/i18n', () => ({
  t: (key: string) => key,
}));

// EncounterModal now reads the active party from the game state when callers do
// not provide a party override. These unit tests only care about modal rendering
// states, so the hook is mocked with an empty party instead of mounting the full
// application provider around every assertion.
vi.mock('../../state/GameContext', () => ({
  useGameState: () => ({
    state: {
      party: [],
    },
  }),
}));

function openAiGeneratedTab() {
  // The modal now opens on the bestiary builder by default. These regression
  // tests cover the older AI-generated encounter surface, so each test switches
  // to that tab before asserting its loading, error, empty, or result content.
  fireEvent.click(screen.getByRole('button', { name: 'AI Generated' }));
}

describe('EncounterModal', () => {
  const mockOnClose = vi.fn();
  const mockOnAction = vi.fn();

  it('renders loading state correctly using translation keys', () => {
    render(
      <EncounterModal
        isOpen={true}
        onClose={mockOnClose}
        encounter={null}
        sources={null}
        error={null}
        isLoading={true}
        onAction={mockOnAction}
      />
    );

    expect(screen.getByRole('dialog', { name: 'encounter_modal.title' })).toBeInTheDocument();
    openAiGeneratedTab();

    expect(screen.getByText('encounter_modal.loading')).toBeInTheDocument();
    expect(screen.getByText('encounter_modal.loading_flavor')).toBeInTheDocument();
  });

  it('renders error state correctly using translation keys', () => {
    const errorMsg = 'Test Error';
    render(
      <EncounterModal
        isOpen={true}
        onClose={mockOnClose}
        encounter={null}
        sources={null}
        error={errorMsg}
        isLoading={false}
        onAction={mockOnAction}
      />
    );

    openAiGeneratedTab();

    expect(screen.getByText('encounter_modal.error_title')).toBeInTheDocument();
    expect(screen.getByText(errorMsg)).toBeInTheDocument();
  });

  it('renders no encounter state correctly using translation keys', () => {
    render(
      <EncounterModal
        isOpen={true}
        onClose={mockOnClose}
        encounter={[]}
        sources={null}
        error={null}
        isLoading={false}
        onAction={mockOnAction}
      />
    );

    openAiGeneratedTab();

    expect(screen.getByText('encounter_modal.no_encounter')).toBeInTheDocument();
  });

  it('renders encounter details and buttons correctly using translation keys', () => {
    const mockEncounter = [
      { name: 'Goblin', quantity: 2, cr: '1/4', description: 'Small and angry', hp: 7, ac: 15, actions: [] }
    ];

    render(
      <EncounterModal
        isOpen={true}
        onClose={mockOnClose}
        encounter={mockEncounter}
        sources={null}
        error={null}
        isLoading={false}
        onAction={mockOnAction}
      />
    );

    openAiGeneratedTab();

    expect(screen.getByText('encounter_modal.title')).toBeInTheDocument();
    expect(screen.getByText('Goblin x 2')).toBeInTheDocument();
    expect(screen.getByText('encounter_modal.simulate')).toBeInTheDocument();
    expect(screen.getByText('encounter_modal.close')).toBeInTheDocument();
  });
});
