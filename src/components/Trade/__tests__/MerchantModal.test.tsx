
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import MerchantModal from '../MerchantModal';
import { Item } from '../../../types';

// Mock dependencies
vi.mock('../../../state/GameContext', () => ({
  useGameState: () => ({
    state: {
      economy: {
        marketFactors: { surplus: [], scarcity: [] },
        buyMultiplier: 1,
        sellMultiplier: 0.5,
        activeEvents: []
      }
    }
  })
}));

vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: document.createElement('div') })
}));

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
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
    costInGp: 10
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

    const dialog = screen.getByRole('dialog', { name: /Trading with Test Merchant/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
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

  it('dispatches BUY_ITEM in the transaction-wrapped shape the handler consumes', () => {
    // Regression guard: a flat { item, cost } payload was silently ignored by
    // handleMerchantAction (it reads payload.transaction.buy), so every Buy
    // click did nothing. The payload MUST be transaction-wrapped.
    const cheapItem: Item = {
      id: 'torch-item-1',
      name: 'Torch',
      type: 'light_source',
      description: 'A simple torch',
      weight: 1,
      cost: '1 cp',
      costInGp: 0.01
    };

    render(
      <MerchantModal
        {...defaultProps}
        merchantInventory={[cheapItem]}
        playerGold={1}
      />
    );

    fireEvent.click(screen.getByLabelText(/Buy Torch/i));

    expect(mockOnAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'BUY_ITEM',
        payload: expect.objectContaining({
          transaction: expect.objectContaining({
            buy: expect.objectContaining({
              item: expect.objectContaining({ id: 'torch-item-1' }),
              cost: 0.01,
            }),
          }),
        }),
      })
    );
  });

  it('dispatches SELL_ITEM in the transaction-wrapped shape the handler consumes', () => {
    const ownedItem: Item = {
      id: 'owned-gem-1',
      name: 'Gem',
      type: 'treasure',
      description: 'A shiny gem',
      weight: 0.1,
      cost: '20 gp',
      costInGp: 20,
    };

    render(
      <MerchantModal
        {...defaultProps}
        merchantInventory={[]}
        playerInventory={[ownedItem]}
      />
    );

    fireEvent.click(screen.getByLabelText(/Sell Gem/i));

    expect(mockOnAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SELL_ITEM',
        payload: expect.objectContaining({
          transaction: expect.objectContaining({
            sell: expect.objectContaining({ itemId: 'owned-gem-1' }),
          }),
        }),
      })
    );
  });

  it('renders a path-style icon as an image, not raw text', () => {
    const stockedItem: Item = {
      ...mockItem,
      id: 'dagger-1',
      name: 'Dagger',
      icon: '/assets/icons/items/dagger.svg',
    };
    render(<MerchantModal {...defaultProps} merchantInventory={[stockedItem]} />);

    // No raw path text anywhere
    expect(screen.queryByText('/assets/icons/items/dagger.svg')).not.toBeInTheDocument();
    // An <img> whose src resolves to the asset
    const dialog = screen.getByRole('dialog');
    const img = dialog.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toMatch(/assets\/icons\/items\/dagger\.svg$/);
  });

  it('renders emoji glyph for items without an icon asset', () => {
    render(<MerchantModal {...defaultProps} merchantInventory={[{ ...mockItem, icon: '🗡️' }]} />);
    expect(screen.getByText('🗡️')).toBeInTheDocument();
  });

  it('hides the market-conditions line when there is no surplus or scarcity', () => {
    render(<MerchantModal {...defaultProps} />);
    expect(screen.queryByText(/surplus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/scarcity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/none/i)).not.toBeInTheDocument();
  });

  it('shows flavor text when the market has surplus and scarcity', () => {
    render(
      <MerchantModal
        {...defaultProps}
        economy={{
          marketFactors: { surplus: ['food'], scarcity: ['weapon'] },
          buyMultiplier: 1,
          sellMultiplier: 0.5,
          activeEvents: [],
        } as any}
      />
    );
    expect(screen.getByText(/Plenty of food this season — prices are down\. Weapon is scarce — prices are up\./)).toBeInTheDocument();
  });
});
