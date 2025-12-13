import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SelectionCard } from './SelectionCard';

describe('SelectionCard', () => {
  it('renders title and children', () => {
    render(<SelectionCard title="Test Card" data-testid="card">Card Content</SelectionCard>);
    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(
      <SelectionCard
        title="Test Card"
        footer={<button>Action</button>}
      />
    );
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('handles click events when onClick is provided', () => {
    const handleClick = vi.fn();
    render(<SelectionCard title="Clickable" onClick={handleClick} />);

    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies selected styles correctly', () => {
    const { rerender } = render(<SelectionCard title="Selectable" selected={false} data-testid="card" />);
    const card = screen.getByTestId('card');

    expect(card).toHaveClass('bg-gray-700');
    expect(card).not.toHaveClass('bg-sky-900');

    rerender(<SelectionCard title="Selectable" selected={true} data-testid="card" />);
    expect(card).toHaveClass('bg-sky-900');
    expect(card).toHaveClass('border-sky-500');
  });

  it('supports keyboard interaction (Enter/Space) when interactive', () => {
    const handleClick = vi.fn();
    render(<SelectionCard title="Keyboard" onClick={handleClick} />);

    const card = screen.getByRole('button');

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});
