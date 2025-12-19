import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ActionButton } from '../ActionButton';
import { Action } from '../../../types';

describe('ActionButton', () => {
  const mockAction: Action = {
    type: 'move',
    label: 'Go North',
    targetId: 'north_exit',
  };
  const mockOnClick = vi.fn();

  it('renders correctly with label', () => {
    render(<ActionButton action={mockAction} onClick={mockOnClick} disabled={false} />);
    expect(screen.getByRole('button', { name: /Go North/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    render(<ActionButton action={mockAction} onClick={mockOnClick} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Go North/i }));
    expect(mockOnClick).toHaveBeenCalledWith(mockAction);
  });

  it('is disabled when disabled prop is true', () => {
    render(<ActionButton action={mockAction} onClick={mockOnClick} disabled={true} />);
    expect(screen.getByRole('button', { name: /Go North/i })).toBeDisabled();
  });

  it('shows badge count when provided', () => {
    render(<ActionButton action={mockAction} onClick={mockOnClick} disabled={false} badgeCount={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows 99+ badge count when > 99', () => {
    render(<ActionButton action={mockAction} onClick={mockOnClick} disabled={false} badgeCount={100} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('converts numeric targetId to string for move actions', () => {
    const numericAction: Action = {
      type: 'move',
      label: 'Go South',
      targetId: 123 as any, // Simulate runtime issue or legacy data
    };
    render(<ActionButton action={numericAction} onClick={mockOnClick} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Go South/i }));

    expect(mockOnClick).toHaveBeenCalledWith(expect.objectContaining({
      targetId: '123'
    }));
  });
});
