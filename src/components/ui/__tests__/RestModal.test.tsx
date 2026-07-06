import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RestModal from '../RestModal';
import LongRestModal from '../LongRestModal';
import { createMockPlayerCharacter } from '../../../utils/core/factories';

vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => React.createRef(),
}));

describe('RestModal', () => {
  const mockParty = [
    createMockPlayerCharacter({
      id: 'char-1',
      name: 'Ada',
      hp: 10,
      maxHp: 20,
      level: 2,
      class: { name: 'Fighter' },
      finalAbilityScores: { Constitution: 14 },
      // Fighter level 2 has 2d10 hit dice pool
      classLevels: { fighter: 2 },
    }),
  ];

  it('renders nothing when closed', () => {
    const { container } = render(
      <RestModal
        isOpen={false}
        party={mockParty}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders characters and hit dice details when open', () => {
    render(
      <RestModal
        isOpen={true}
        party={mockParty}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText('Short Rest')).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('HP 10/20 · Level 2 Fighter')).toBeInTheDocument();
    expect(screen.getByText('2/2 available')).toBeInTheDocument();
  });

  it('locks background page scrolling while open', () => {
    const { unmount } = render(
      <RestModal
        isOpen={true}
        party={mockParty}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overscrollBehavior).toBe('contain');

    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overscrollBehavior).toBe('');
  });

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(
      <RestModal
        isOpen={true}
        party={mockParty}
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('allows incrementing and decrementing hit dice spend', () => {
    const onConfirm = vi.fn();
    render(
      <RestModal
        isOpen={true}
        party={mockParty}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const plusButton = screen.getByRole('button', { name: 'Spend more d10 for Ada' });
    const minusButton = screen.getByRole('button', { name: 'Spend fewer d10 for Ada' });

    // Spend 1 hit die
    fireEvent.click(plusButton);
    expect(screen.getByText('1')).toBeInTheDocument();

    // Spend 2 hit dice (max available)
    fireEvent.click(plusButton);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(plusButton).toBeDisabled();

    // Decrease to 1
    fireEvent.click(minusButton);
    expect(screen.getByText('1')).toBeInTheDocument();

    // Confirm rest
    fireEvent.click(screen.getByRole('button', { name: 'Begin Rest' }));
    expect(onConfirm).toHaveBeenCalledWith({
      'char-1': {
        10: 1,
      },
    });
  });

  it('keeps short-rest close, stepper, and footer controls touch-sized', () => {
    render(
      <RestModal
        isOpen={true}
        party={mockParty}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Close short rest' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Spend fewer d10 for Ada' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Spend more d10 for Ada' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Begin Rest' })).toHaveClass('min-h-11');
  });

  it('keeps long-rest close, choice select, and footer controls touch-sized', () => {
    const partyWithRestChoice = [
      createMockPlayerCharacter({
        id: 'char-2',
        name: 'Bryn',
        race: {
          id: 'test-race',
          name: 'Test Race',
          description: '',
          traits: [],
          restChoices: [
            {
              id: 'season-choice',
              traitName: 'Seasonal Training',
              options: [{ type: 'season' }],
            },
          ],
        },
      }),
    ];

    render(
      <LongRestModal
        isOpen={true}
        party={partyWithRestChoice}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Cancel long rest' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('combobox')).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Confirm Long Rest' })).toHaveClass('min-h-11');
  });
});
