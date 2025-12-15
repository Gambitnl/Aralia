import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CoinDisplay from './CoinDisplay';

// Mock Tooltip since it uses Portals and might be complex to test in isolation without full DOM
vi.mock('./Tooltip', () => ({
  default: ({ children, content }: { children: React.ReactNode; content: string }) => (
    <div data-testid="tooltip-mock" title={content}>
      {children}
    </div>
  ),
}));

describe('CoinDisplay', () => {
  const defaultProps = {
    label: 'GP',
    amount: 100,
    color: 'text-yellow-400',
    icon: '🪙',
    tooltip: 'Gold Pieces',
  };

  it('renders the coin amount and label', () => {
    render(<CoinDisplay {...defaultProps} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('GP')).toBeInTheDocument();
    expect(screen.getByText('🪙')).toBeInTheDocument();
  });

  it('applies the correct color class', () => {
    render(<CoinDisplay {...defaultProps} />);
    const amountElement = screen.getByText('100');
    expect(amountElement).toHaveClass('text-yellow-400');
  });

  it('renders with accessibility attributes', () => {
    render(<CoinDisplay {...defaultProps} />);
    const container = screen.getByLabelText('100 Gold Pieces');
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('tabIndex', '0');
  });

  it('wraps content in a tooltip', () => {
    render(<CoinDisplay {...defaultProps} />);
    expect(screen.getByTestId('tooltip-mock')).toHaveAttribute('title', 'Gold Pieces');
  });
});
