
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import MerchantModal from '../MerchantModal';
import { Item, EconomyState } from '../../types';

// Mock dependencies
vi.mock('../../state/GameContext', () => ({
  useGameState: () => ({
    state: {
      economy: {
        marketFactors: { surplus: [], scarcity: [] },
        activeEvents: []
      }
    }
  })
}));

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: document.createElement('div') })
}));

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('MerchantModal', () => {
  const mockOnClose = vi.fn();
  const mockOnAction = vi.fn();

  const mockItem: Item = {
    id: 'test-item-1',
    name: 'Test Sword',
    type: 'weapon',
    description: 'A sharp sword',
    weight: 2,
    cost: '10 gp',
    value: 10
  };

  const defaultProps = {
    isOpen: true,
    merchantName: 'Test Merchant',
    merchantInventory: [mockItem],
    playerInventory: [],
    playerGold: 100,
    onClose: mockOnClose,
    onAction: mockOnAction,
  };

  it('renders correctly when open', () => {
    render(<MerchantModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Trading with Test Merchant/i)).toBeInTheDocument();
    expect(screen.getByText('Test Merchant')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<MerchantModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<MerchantModal {...defaultProps} />);

    // Find close button by aria-label
    const closeButton = screen.getByLabelText('Close shop');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays correct aria-labels for actions', () => {
    render(<MerchantModal {...defaultProps} />);

    const buyButton = screen.getByLabelText(/Buy Test Sword/i);
    expect(buyButton).toBeInTheDocument();
  });
});
