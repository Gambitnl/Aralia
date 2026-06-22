import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RestModal from '../RestModal';
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
});
