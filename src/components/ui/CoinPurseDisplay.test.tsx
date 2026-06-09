import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CoinPurseDisplay, { CoinBadge } from './CoinPurseDisplay';

// Tooltip is mocked here so the tests can focus on the coin badges' accessible
// trigger semantics without depending on portal positioning.
vi.mock('../Tooltip', () => ({
  default: ({ children, content }: { children: React.ReactNode; content: string }) => (
    <div data-testid="tooltip-mock" title={content}>
      {children}
    </div>
  ),
}));

describe('CoinPurseDisplay', () => {
  it('renders a keyboard-focusable zero gold badge when the purse has no coins', () => {
    render(<CoinPurseDisplay goldValue={0} />);

    const zeroGold = screen.getByRole('img', { name: '0 Gold pieces' });
    expect(zeroGold).toHaveAttribute('tabIndex', '0');
    expect(zeroGold).toHaveTextContent('0');
    expect(zeroGold).toHaveTextContent('gp');
  });

  it('keeps direct zero-value badges collapsed unless explicitly requested', () => {
    const { rerender } = render(<CoinBadge type="sp" amount={0} />);
    expect(screen.queryByRole('img', { name: '0 Silver pieces' })).not.toBeInTheDocument();

    rerender(<CoinBadge type="sp" amount={0} showZero />);
    expect(screen.getByRole('img', { name: '0 Silver pieces' })).toBeInTheDocument();
  });
});
