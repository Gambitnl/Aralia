import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CombatResultModal } from '../CombatResultModal';
import { Item } from '../../../../types';

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, className, role, 'aria-modal': ariaModal, 'aria-labelledby': ariaLabelledby, 'aria-describedby': ariaDescribedby, ...props }: any, ref: any) => (
      <div
        ref={ref}
        className={className}
        role={role}
        aria-modal={ariaModal}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        {...props}
      >
        {children}
      </div>
    ))
  },
  useReducedMotion: () => false,
}));

// Mock Focus Trap
vi.mock('../../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => React.createRef()
}));

describe('CombatResultModal', () => {
  const mockOnClose = vi.fn();
  const mockRewards = {
    gold: 100,
    xp: 500,
    items: [{ id: '1', name: 'Magic Sword' } as Item]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders victory state correctly', () => {
    render(
      <CombatResultModal
        battleState="victory"
        rewards={mockRewards}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Victory!')).toBeInTheDocument();
    expect(screen.getByText('100 Gold')).toBeInTheDocument();
    expect(screen.getByText('500 XP')).toBeInTheDocument();
    expect(screen.getByText('Magic Sword')).toBeInTheDocument();

    // Check for button text
    const button = screen.getByRole('button', { name: /Collect & Continue/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('renders defeat state correctly', () => {
    render(
      <CombatResultModal
        battleState="defeat"
        rewards={null}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Defeat!')).toBeInTheDocument();
    expect(screen.queryByText('Gold')).not.toBeInTheDocument();

    const button = screen.getByRole('button', { name: /Return to Title/i });
    expect(button).toBeInTheDocument();
  });

  it('has accessible attributes', () => {
    render(
      <CombatResultModal
        battleState="victory"
        rewards={mockRewards}
        onClose={mockOnClose}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'combat-result-title');

    // Check if live region exists for rewards
    const rewardsRegion = screen.getByText('Battle Rewards').closest('div');
    expect(rewardsRegion).toHaveAttribute('aria-live', 'polite');
  });
});
